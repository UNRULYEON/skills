// Self-contained Playwright capture runner.
// Resolves `playwright` from the project, from $PW_HOME/node_modules, or from
// this file's own folder — it never writes to the project it captures.

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const VIEWPORTS = {
  desktop: { width: 1280, height: 720, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  mobile: { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

function loadPlaywright() {
  // Project first: a repo that already has Playwright needs no install at all.
  const candidates = [
    path.join(process.cwd(), "node_modules"),
    process.env.PW_HOME ? path.join(process.env.PW_HOME, "node_modules") : null,
    path.join(import.meta.dirname, "node_modules"),
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      return createRequire(path.join(dir, "noop.js"))("playwright");
    } catch {}
  }

  try {
    return createRequire(import.meta.url)("playwright");
  } catch {
    throw new Error(
      "playwright not found. Run the bootstrap step of the visual-capture skill — it installs "
        + "playwright into $PW_HOME with the project's own package manager — then re-run with "
        + "PW_HOME set.",
    );
  }
}

// Playwright records .webm only, and its own bundled ffmpeg is stripped of the
// mp4 muxer — conversion needs a full ffmpeg build.
function findFfmpeg() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;

  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) return "ffmpeg";

  const homes = [process.env.PW_HOME, path.join(os.tmpdir(), "claude-playwright"), process.cwd()];
  for (const home of homes) {
    if (!home) continue;
    try {
      return createRequire(path.join(home, "node_modules", "noop.js"))("ffmpeg-static");
    } catch {}
  }

  return null;
}

function toMp4(source, ffmpeg) {
  const target = source.replace(/\.webm$/, ".mp4");
  const result = spawnSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    source,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    // libx264 requires even dimensions.
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    target,
  ], { stdio: ["ignore", "ignore", "inherit"] });

  if (result.status !== 0) {
    console.error(`ffmpeg failed, keeping ${path.basename(source)}`);
    return source;
  }

  rmSync(source);
  return target;
}

// Captures must never land in the diff: use the requested directory, else
// .visual-capture when git already ignores it, else a temp directory.
function resolveOutDir(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.VISUAL_CAPTURE_OUT) return path.resolve(process.env.VISUAL_CAPTURE_OUT);

  const candidate = path.resolve(".visual-capture");
  if (spawnSync("git", ["check-ignore", "-q", candidate], { stdio: "ignore" }).status === 0) {
    return candidate;
  }

  const fallback = path.join(os.tmpdir(), "visual-capture");
  console.error(`${candidate} is not gitignored — writing to ${fallback} instead`);
  return fallback;
}

function parseArgs(argv) {
  const args = { viewport: "both", waitFor: null, steps: null, delay: 0, highlight: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];

    if (arg === "--url") args.url = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--name") args.name = next();
    else if (arg === "--viewport") args.viewport = next();
    else if (arg === "--steps") args.steps = next();
    else if (arg === "--wait-for") args.waitFor = next();
    else if (arg === "--highlight") args.highlight.push(next());
    else if (arg === "--delay") args.delay = Number(next());
    else if (arg === "--video") args.video = true;
    else if (arg === "--keep-webm") args.keepWebm = true;
    else if (arg === "--full-page") args.fullPage = true;
    else throw new Error(`unknown flag: ${arg}`);
  }

  if (!args.url) throw new Error("--url is required");
  if (!args.name) throw new Error("--name is required");

  args.out = resolveOutDir(args.out);

  const names = args.viewport === "both" ? ["desktop", "mobile"] : args.viewport.split(",");
  args.viewports = names.map((viewportName) => {
    const viewport = VIEWPORTS[viewportName.trim()];
    if (!viewport) throw new Error(`unknown viewport: ${viewportName}`);
    return { name: viewportName.trim(), ...viewport };
  });

  return args;
}

async function launch(playwright) {
  try {
    return await playwright.chromium.launch({ channel: "chrome" });
  } catch (error) {
    try {
      return await playwright.chromium.launch();
    } catch {
      throw new Error(
        `no Chrome available (${error.message.split("\n")[0]}). Install a browser with the `
          + "project's package runner (npx --yes / bunx / pnpm dlx): "
          + "<runner> playwright@latest install chromium",
      );
    }
  }
}

const warnedSelectors = new Set();

// Outlines the elements the diff touched, so a reader comparing before and
// after knows where to look. Outline draws outside the box and takes no space,
// so the marked page lays out exactly like the unmarked one.
async function markHighlights(page, selectors) {
  const found = await page.evaluate((sels) => {
    const id = "visual-capture-highlight";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = "[data-visual-capture-highlight]{"
        + "outline:3px solid #ff2d55!important;outline-offset:2px!important;}";
      document.head.append(style);
    }

    let count = 0;
    for (const selector of sels) {
      for (const element of document.querySelectorAll(selector)) {
        element.setAttribute("data-visual-capture-highlight", "");
        count++;
      }
    }
    return count;
  }, selectors);

  const key = selectors.join(", ");
  if (found === 0 && !warnedSelectors.has(key)) {
    warnedSelectors.add(key);
    console.error(`no element matched ${key} — capturing unmarked`);
  }
  return found;
}

async function captureViewport(browser, args, viewport) {
  const { name: viewportName, ...device } = viewport;
  const outDir = path.resolve(args.out);
  mkdirSync(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    // Screenshots freeze animations so reruns are byte-comparable; video keeps them.
    reducedMotion: args.video ? "no-preference" : "reduce",
    recordVideo: args.video
      ? { dir: outDir, size: { width: device.width, height: device.height } }
      : undefined,
  });

  const page = await context.newPage();
  const written = [];
  let shotIndex = 0;
  let videoSource = null;

  async function capture(label = "") {
    if (args.highlight.length) await markHighlights(page, args.highlight);
    const suffix = label ? `-${label}` : shotIndex === 0 ? "" : `-${shotIndex}`;
    const file = path.join(outDir, `${args.name}-${viewportName}${suffix}.png`);
    await page.screenshot({ path: file, fullPage: Boolean(args.fullPage) });
    written.push(file);
    shotIndex++;
    return file;
  }

  try {
    await page.goto(args.url, { waitUntil: "networkidle", timeout: 30_000 }).catch(() =>
      page.goto(args.url, { waitUntil: "load", timeout: 30_000 })
    );
    if (args.waitFor) await page.waitForSelector(args.waitFor, { timeout: 15_000 });
    await page.evaluate(() => document.fonts?.ready);
    if (args.delay) await page.waitForTimeout(args.delay);
    // Video never calls capture(), so mark up front and record the whole run marked.
    if (args.highlight.length && args.video) await markHighlights(page, args.highlight);

    if (args.steps) {
      const mod = await import(pathToFileURL(path.resolve(args.steps)).href);
      await mod.default({ page, capture, viewport: { name: viewportName, ...device } });
    }

    if (!args.video && written.length === 0) await capture();
    if (args.video) videoSource = await page.video()?.path();
  } finally {
    // The video file is only finalised once the context closes.
    await context.close();
  }

  if (videoSource) {
    const target = path.join(outDir, `${args.name}-${viewportName}.webm`);
    renameSync(videoSource, target);
    written.push(args.ffmpeg ? toMp4(target, args.ffmpeg) : target);
  }

  return written;
}

const args = parseArgs(process.argv.slice(2));

if (args.video && !args.keepWebm) {
  args.ffmpeg = findFfmpeg();
  if (!args.ffmpeg) {
    console.error(
      "no ffmpeg found — writing .webm instead of .mp4. For mp4, install a full ffmpeg "
        + "(brew install ffmpeg), or add ffmpeg-static to $PW_HOME with the project's package "
        + "manager.",
    );
  }
}

const playwright = loadPlaywright();
const browser = await launch(playwright);
const results = [];

try {
  for (const viewport of args.viewports) {
    results.push(...await captureViewport(browser, args, viewport));
  }
} finally {
  await browser.close();
}

for (const file of results) console.log(file);

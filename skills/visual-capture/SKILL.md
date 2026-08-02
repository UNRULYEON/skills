---
name: visual-capture
description: Use when the user wants screenshots, a video, or a before/after of a UI change in a web app — "show me what this looks like", "capture the new page", "record the interaction", "screenshot my changes", "did this break the mobile layout". Works out the affected routes from the branch diff against main and captures each one before and after in Chrome with Playwright, without adding Playwright to the project.
---

# Visual capture

Turn a **branch diff** into pictures: screenshots or a video of the routes the diff touches, in Chrome, at desktop 1280×720 and mobile 430×932.

Every capture is a **pair** — the merge-base and the branch, same route, same viewport, same flags. A lone "after" shot shows what the page looks like, not what the change did, so the baseline is part of the job, not an upgrade to it. The only acceptable single-sided result is a baseline that genuinely cannot be built or served, reported as such.

Playwright is a **guest** — it runs from outside the repository. Never add a dependency, config file, or install script to the project being captured.

## 1. Read the diff

```bash
BASE=$(git merge-base HEAD main)
git diff --stat "$BASE" -- .        # committed + working-tree changes vs main
git status --porcelain
```

Read the actual hunks of the UI-bearing files (pages, routes, components, styles). Work out, for each change, **what a viewer would see differently** — a new element, a moved one, a state that only appears after a click.

Completion criterion: every changed UI file is either mapped to a route that renders it, or written off as invisible (types, tests, server-only code). This accounting is working reasoning — it never reaches the response, which is only the lists from step 5.

If nothing in the diff is visible, say that in one line and stop — do not capture a random page.

## 2. Pick the target

Assemble a capture list: one entry per route, each with a `name` slug, the URL on the running dev server, and the flags it needs — every entry gets captured twice, on the baseline and on the branch.

A change that is only visible after interaction (hover, open, submit, scroll) is a **steps** capture — see [`references/interactions.md`](references/interactions.md). A change to motion or a transition is a **video** capture (`--video`).

Decide the framing now, per route: the default shoots the viewport only, so anything below the fold — a footer, a table's last rows, a section at the bottom of a long page — needs `--full-page`, or a scroll in a steps file. A capture that does not contain the changed element is a wasted run.

Find the dev server URL from the project's own scripts (`package.json`, README, `.env`). If no server is running, start it in the background.

**Ready means HTTP 200 on the route you are about to capture** — not merely that the port answers:

```bash
curl -o /dev/null -sw '%{http_code}\n' http://localhost:3000/settings
```

A 500 renders as a perfectly photogenic error page and will screenshot as if it were a real result. On any non-200, read the dev server log, fix the render error, and capture only once the route returns 200. A route you cannot reach at all (auth, seeded data) is one of step 5's one-line exceptions.

## 3. Bootstrap Playwright

**Install nothing until you have checked the project.** A repo that already ships Playwright needs no bootstrap at all, and reaching for a package manager it bans is how this step gets killed by a hook.

```bash
node -e "require.resolve('playwright')" 2>/dev/null && echo "project has playwright — skip the rest"
```

If that prints, go straight to step 4; the runner resolves the project's copy first.

Otherwise install into `$PW_HOME` with **the project's own package manager** — the `packageManager` field in `package.json`, else the lockfile. It is the project's rule even though the install lands outside the project.

```bash
export PW_HOME="${TMPDIR:-/tmp}/claude-playwright"
mkdir -p "$PW_HOME"
[ -f "$PW_HOME/package.json" ] || echo '{"private":true}' > "$PW_HOME/package.json"

add() {
  if [ -f bun.lock ] || [ -f bun.lockb ]; then bun add --cwd "$PW_HOME" "$@"
  elif [ -f pnpm-lock.yaml ]; then pnpm add --dir "$PW_HOME" "$@"
  elif [ -f yarn.lock ]; then (cd "$PW_HOME" && yarn add "$@")
  else npm install --prefix "$PW_HOME" "$@"; fi
}

[ -d "$PW_HOME/node_modules/playwright" ] || add playwright@latest

# mp4 conversion only — skip unless you are recording video
command -v ffmpeg >/dev/null \
  || [ -d "$PW_HOME/node_modules/ffmpeg-static" ] \
  || add ffmpeg-static
```

A blocked install means the manager was misdetected — re-read the lockfile rather than retrying with `npm`. Package runners follow the same rule: `npx --yes`, `bunx`, `pnpm dlx`, `yarn dlx`.

The `package.json` matters: without one, a second install into the same prefix prunes the first package.

bun and pnpm skip lifecycle scripts by default, so Playwright's postinstall browser download does not run — harmless here, since captures use the Chrome already on the machine. The runner launches Chrome via `channel: "chrome"`; without one it falls back to bundled Chromium and tells you the install command.

## 4. Capture the pair

Stand up the baseline first — worktree, env files, free port, cleanup — following [`references/before-after.md`](references/before-after.md), then run the **same command twice**, changing only the port and the output directory:

```bash
node <skill>/scripts/capture.mjs --url "http://localhost:$BASE_PORT/settings" --out "$OUT/before" --name settings
node <skill>/scripts/capture.mjs --url "http://localhost:3000/settings"       --out "$OUT/after"  --name settings
```

Any flag you pass to one, pass to the other: a `--full-page` before against a viewport-only after is not a comparison.

Both viewports run by default and write `<name>-desktop.png` and `<name>-mobile.png`. The runner prints one **absolute** path per file it wrote — `--out` is resolved against the working directory — so those lines feed straight into the Read tool and into the report.

| Flag                   | Effect                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `--viewport desktop`   | One viewport only (`desktop`, `mobile`, or a comma list)               |
| `--video`              | Record an `.mp4` per viewport instead of a bare screenshot              |
| `--keep-webm`          | Skip mp4 conversion and keep Playwright's raw `.webm`                  |
| `--steps <file.mjs>`   | Drive the page and shoot at chosen moments                             |
| `--full-page`          | Whole scrollable page rather than the viewport                         |
| `--wait-for <sel>`     | Block until a selector appears                                         |
| `--delay <ms>`         | Extra settle time after load                                           |
| `--name`               | Output slug (required)                                                 |
| `--out <dir>`          | Override the output directory                                          |

The runner picks the output directory itself, so captures never land in the diff: `--out` if given, else `$VISUAL_CAPTURE_OUT`, else `.visual-capture` when `git check-ignore` says the project already ignores it, else a temp directory (it prints which on stderr). Point `$VISUAL_CAPTURE_OUT` at the scratchpad to keep a session's captures together. Adding `.visual-capture` to the project's `.gitignore` is the user's call, not yours.

Screenshots run with reduced motion so reruns are comparable; video keeps animation.

Playwright records `.webm`; the runner converts it to H.264 `.mp4` (the portable format — it plays in any browser, Slack, Quicktime, and a GitHub comment) using the first ffmpeg it finds: `$FFMPEG`, `ffmpeg` on `PATH`, then `ffmpeg-static` in `$PW_HOME`. Playwright's own bundled ffmpeg is stripped of the mp4 muxer, so it is not used. With no ffmpeg at all it keeps the `.webm` and says so on stderr.

## 5. Report

Read every image back with the Read tool — before **and** after, both viewports — before writing a word. An unopened screenshot is not evidence.

Then the entire response is **two lists**:

```
desktop
- /abs/path/before/settings-desktop.png
- /abs/path/after/settings-desktop.png

mobile
- /abs/path/before/settings-mobile.png
- /abs/path/after/settings-mobile.png
```

Each list is before then after, in that order. Every bullet is one absolute path, copied from the runner's stdout — a bullet with no path means that capture never happened, so fix the capture rather than shipping an empty line. Video pairs take the same shape with `.mp4` paths. More than one route: repeat the two lists per route, under a bare `/route` line.

The lists carry the finding — the reader is looking at the images. Everything you worked out along the way (which files were written off, page heights, framing choices, contrast opinions, worktree cleanup, that the servers returned 200) is **working reasoning, not output**: it stays out of the response, and no preamble, summary, or sign-off goes in front of the lists.

One exception: a fact that changes how the images should be read, at most one line, above the lists. A baseline that could not be built (list the after path alone), a route you could not reach, a capture that shows a rendering error. Absent one of those, the response opens on the word `desktop`.

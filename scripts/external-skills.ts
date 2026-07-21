#!/usr/bin/env bun

// Vendors skills from other GitHub repos into skills/<local_name>, pinned to a
// specific commit. See external-sources/README.md for the registry format
// and docs/adding-an-external-skill.md for the step-by-step workflow.

import { parse as parseYaml } from "yaml";
import { readdir, mkdtemp, rm, cp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import ora, { type Ora } from "ora";
import pc from "picocolors";
import * as clack from "@clack/prompts";

interface RegistryEntry {
  provider: string;
  local_name: string;
  upstream_repo: string;
  upstream_path: string;
  pinned_ref: string;
  update_policy: "latest" | "manual";
  status: "active" | "deprecated";
  owner: string;
}

const ROOT = new URL("..", import.meta.url).pathname;
const EXTERNAL_SOURCES_DIR = join(ROOT, "external-sources");
const SKILLS_DIR = join(ROOT, "skills");

const short = (sha: string) => sha.slice(0, 7);
const arrow = pc.dim("->");

async function loadRegistry(): Promise<RegistryEntry[]> {
  const files = (await readdir(EXTERNAL_SOURCES_DIR)).filter((f) => f.endsWith(".yml"));
  const entries: RegistryEntry[] = [];

  for (const file of files) {
    const raw = await readFile(join(EXTERNAL_SOURCES_DIR, file), "utf-8");
    const doc = parseYaml(raw) as { provider: string; skills: Omit<RegistryEntry, "provider">[] };
    for (const skill of doc.skills) {
      entries.push({ provider: doc.provider, ...skill });
    }
  }

  return entries;
}

function resolveTargets(
  entries: RegistryEntry[],
  localName: string | undefined,
  all: boolean,
): RegistryEntry[] {
  if (all) return entries;
  if (!localName) {
    throw new Error("Pass a local_name or --all.");
  }
  const match = entries.find((e) => e.local_name === localName);
  if (!match) {
    throw new Error(
      `No registry entry found for "${localName}". Known: ${entries.map((e) => e.local_name).join(", ")}`,
    );
  }
  return [match];
}

async function fetchUpstreamDir(
  entry: RegistryEntry,
  workDir: string,
  spinner: Ora,
): Promise<string> {
  const tarball = join(workDir, "src.tar.gz");

  spinner.text = `${entry.local_name} ${pc.dim("fetching tarball...")}`;
  await $`gh api repos/${entry.upstream_repo}/tarball/${entry.pinned_ref} > ${tarball}`.quiet();

  spinner.text = `${entry.local_name} ${pc.dim("extracting...")}`;
  await $`tar -xzf ${tarball} -C ${workDir}`.quiet();

  const extractedRootName = (await readdir(workDir)).find((name) => name !== "src.tar.gz");
  if (!extractedRootName) {
    throw new Error(`Failed to extract tarball for ${entry.upstream_repo}@${entry.pinned_ref}`);
  }

  return join(workDir, extractedRootName, entry.upstream_path);
}

function buildUpstreamMd(entry: RegistryEntry): string {
  return `---
provider: ${entry.provider}
local_name: ${entry.local_name}
upstream_repo: ${entry.upstream_repo}
upstream_path: ${entry.upstream_path}
pinned_ref: ${entry.pinned_ref}
update_policy: ${entry.update_policy}
status: ${entry.status}
owner: ${entry.owner}
---

# Upstream

This directory is vendored from an external skill registry entry. Do not
edit its contents directly — edit \`external-sources/${entry.provider}.yml\`
and re-run \`bun scripts/external-skills.ts sync ${entry.local_name} --write\`.

- Source repo: [${entry.upstream_repo}](https://github.com/${entry.upstream_repo})
- Source path: \`${entry.upstream_path}\`
- Pinned commit: [\`${entry.pinned_ref}\`](https://github.com/${entry.upstream_repo}/commit/${entry.pinned_ref})
- Update policy: ${entry.update_policy}
`;
}

function printSyncPlan(entries: RegistryEntry[]): void {
  console.log(
    pc.bold(
      `\nPlan ${pc.dim(`(${entries.length} skill${entries.length === 1 ? "" : "s"}, dry-run)`)}`,
    ),
  );
  for (const entry of entries) {
    console.log(
      `  ${pc.yellow("○")} ${pc.bold(entry.local_name)} ${arrow} ${pc.cyan(`skills/${entry.local_name}`)}\n` +
        `    ${pc.dim(`from ${entry.upstream_repo}/${entry.upstream_path}@${short(entry.pinned_ref)}`)}`,
    );
  }
  console.log(pc.dim("\nRe-run with --write to apply.\n"));
}

async function syncEntry(entry: RegistryEntry): Promise<{ ok: boolean; error?: string }> {
  const spinner = ora({ text: entry.local_name, color: "cyan" }).start();
  const workDir = await mkdtemp(join(tmpdir(), "external-skill-"));

  try {
    const sourcePath = await fetchUpstreamDir(entry, workDir, spinner);
    const destPath = join(SKILLS_DIR, entry.local_name);

    spinner.text = `${entry.local_name} ${pc.dim("writing files...")}`;
    await rm(destPath, { recursive: true, force: true });
    await cp(sourcePath, destPath, { recursive: true });
    await Bun.write(join(destPath, "UPSTREAM.md"), buildUpstreamMd(entry));

    spinner.succeed(
      `${pc.bold(entry.local_name)} ${arrow} ${pc.cyan(`skills/${entry.local_name}`)} ` +
        pc.dim(`@ ${short(entry.pinned_ref)}`),
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(`${pc.bold(entry.local_name)} ${pc.red(message)}`);
    return { ok: false, error: message };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function runSync(entries: RegistryEntry[], write: boolean): Promise<void> {
  if (!write) {
    printSyncPlan(entries);
    return;
  }

  console.log(pc.bold(`\nSyncing ${entries.length} skill${entries.length === 1 ? "" : "s"}\n`));

  const results = [];
  for (const entry of entries) results.push(await syncEntry(entry));

  const failed = results.filter((r) => !r.ok).length;
  const summary = `${pc.green(`${results.length - failed} synced`)}${failed ? `, ${pc.red(`${failed} failed`)}` : ""}`;
  console.log(`\n${summary}\n`);

  if (failed) process.exitCode = 1;
}

async function bumpPins(entries: RegistryEntry[], write: boolean): Promise<void> {
  const candidates = entries.filter((e) => e.update_policy === "latest");
  if (candidates.length === 0) {
    console.log(pc.dim("No entries with update_policy: latest."));
    return;
  }

  console.log(
    pc.bold(
      `\nChecking ${candidates.length} skill${candidates.length === 1 ? "" : "s"} for updates\n`,
    ),
  );

  let updates = 0;
  for (const entry of candidates) {
    const spinner = ora({ text: entry.local_name, color: "cyan" }).start();

    const defaultBranch = (
      await $`gh api repos/${entry.upstream_repo} -q .default_branch`.text()
    ).trim();
    const latestSha = (
      await $`gh api repos/${entry.upstream_repo}/commits/${defaultBranch} -q .sha`.text()
    ).trim();

    if (latestSha === entry.pinned_ref) {
      spinner.succeed(
        `${pc.bold(entry.local_name)} ${pc.dim(`up to date @ ${short(entry.pinned_ref)}`)}`,
      );
      continue;
    }

    updates += 1;
    spinner.warn(
      `${pc.bold(entry.local_name)} ${pc.dim(short(entry.pinned_ref))} ${arrow} ${pc.green(short(latestSha))}`,
    );

    if (write) {
      const path = join(EXTERNAL_SOURCES_DIR, `${entry.provider}.yml`);
      const raw = await readFile(path, "utf-8");
      const updated = raw.replace(
        new RegExp(
          `(local_name: ${entry.local_name}\\n(?:.*\\n)*?\\s*pinned_ref: )${entry.pinned_ref}`,
        ),
        `$1${latestSha}`,
      );
      await Bun.write(path, updated);
      entry.pinned_ref = latestSha;
    }
  }

  if (updates === 0) {
    console.log(pc.green("\nAll pins up to date.\n"));
  } else if (write) {
    console.log(pc.bold(`\n${updates} pin${updates === 1 ? "" : "s"} bumped.`));
    console.log(pc.dim("Run `sync --all --write` to vendor the bumped pins.\n"));
  } else {
    console.log(
      pc.dim(
        `\n${updates} update${updates === 1 ? "" : "s"} available. Re-run with --write to apply.\n`,
      ),
    );
  }
}

function parseFlags(args: string[]): {
  positionals: string[];
  flags: Record<string, string | true>;
} {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags[name] = next;
      i += 1;
    } else {
      flags[name] = true;
    }
  }

  return { positionals, flags };
}

/** Accepts a `github.com/owner/repo/blob|tree/<ref>/<path>[/SKILL.md]` URL and pulls out its parts. */
function parseGithubSkillUrl(url: string): { repo: string; ref: string; path: string } | null {
  const match = url.match(
    /github\.com\/([^/]+\/[^/]+)\/(?:blob|tree)\/([^/]+)\/(.+?)(?:\/SKILL\.md)?\/?$/,
  );
  if (!match) return null;
  const [, repo, ref, path] = match as unknown as [string, string, string, string];
  return { repo, ref, path };
}

async function repoExists(repo: string): Promise<boolean> {
  const result = await $`gh api repos/${repo}`.quiet().nothrow();
  return result.exitCode === 0;
}

async function resolveRef(repo: string, ref: string): Promise<string> {
  const sha = (await $`gh api repos/${repo}/commits/${ref} -q .sha`.text()).trim();
  return sha;
}

async function defaultBranch(repo: string): Promise<string> {
  return (await $`gh api repos/${repo} -q .default_branch`.text()).trim();
}

async function pathExistsUpstream(repo: string, path: string, ref: string): Promise<boolean> {
  const result = await $`gh api repos/${repo}/contents/${path}?ref=${ref}`.quiet().nothrow();
  return result.exitCode === 0;
}

function serializeProviderFile(
  provider: string,
  skills: Omit<RegistryEntry, "provider">[],
): string {
  const header = `# Registry of external skills vendored via this provider.
# Do not edit vendored skill directories directly — edit this file and
# re-run: bun scripts/external-skills.ts sync <local_name> --write
`;
  const body = skills
    .map(
      (s) => `  - local_name: ${s.local_name}
    upstream_repo: ${s.upstream_repo}
    upstream_path: ${s.upstream_path}
    pinned_ref: ${s.pinned_ref}
    update_policy: ${s.update_policy}
    status: ${s.status}
    owner: ${s.owner}`,
    )
    .join("\n");

  return `${header}\nprovider: ${provider}\nskills:\n${body}\n`;
}

async function addEntry(rawArgs: string[]): Promise<void> {
  const { positionals, flags } = parseFlags(rawArgs);
  const force = flags.force === true;
  const write = flags.write === true;
  const interactive = process.stdin.isTTY && process.stdout.isTTY;

  let repo: string | undefined;
  let path: string | undefined;
  let pin = typeof flags.pin === "string" ? flags.pin : undefined;

  const fromUrl = positionals[0] ? parseGithubSkillUrl(positionals[0]) : null;
  if (fromUrl) {
    repo = fromUrl.repo;
    path = fromUrl.path;
    pin ??= fromUrl.ref === "main" || fromUrl.ref === "master" ? undefined : fromUrl.ref;
  } else {
    repo = positionals[0];
    path = positionals[1];
  }

  if (interactive) clack.intro(pc.bold("Add an external skill"));

  if (!repo) {
    if (!interactive) throw new Error("Missing <owner/repo or GitHub URL>. See usage below.");
    const answer = await clack.text({
      message: "Upstream repo (owner/repo) or a GitHub skill URL",
      validate: (v) => (v?.trim() ? undefined : "Required"),
    });
    if (clack.isCancel(answer)) throw new Error("Cancelled.");
    const parsed = parseGithubSkillUrl(answer);
    repo = parsed?.repo ?? answer.trim();
    path ??= parsed?.path;
    pin ??= parsed?.ref;
  }

  if (!path) {
    if (!interactive) throw new Error("Missing <upstream_path>. See usage below.");
    const answer = await clack.text({
      message: `Path within ${repo} (e.g. skills/productivity/grilling)`,
      validate: (v) => (v?.trim() ? undefined : "Required"),
    });
    if (clack.isCancel(answer)) throw new Error("Cancelled.");
    path = answer.trim();
  }

  const spinner = ora({ text: `Looking up ${repo}...`, color: "cyan" }).start();
  if (!(await repoExists(repo))) {
    spinner.fail(`Repo not found or inaccessible: ${pc.bold(repo)}`);
    process.exitCode = 1;
    return;
  }

  const ref = pin ?? (await defaultBranch(repo));
  spinner.text = `Resolving ${ref}...`;
  const pinnedRef = await resolveRef(repo, ref);

  spinner.text = `Checking ${path} exists at ${short(pinnedRef)}...`;
  if (!(await pathExistsUpstream(repo, path, pinnedRef))) {
    spinner.fail(`Path not found upstream: ${pc.bold(`${repo}/${path}`)} @ ${short(pinnedRef)}`);
    process.exitCode = 1;
    return;
  }
  spinner.succeed(`Found ${pc.bold(`${repo}/${path}`)} @ ${short(pinnedRef)}`);

  const defaultLocalName = path.split("/").filter(Boolean).pop()!;
  const defaultProvider = repo.split("/")[0]!;

  let localName = typeof flags["local-name"] === "string" ? flags["local-name"] : undefined;
  let provider = typeof flags.provider === "string" ? flags.provider : undefined;
  let owner = typeof flags.owner === "string" ? flags.owner : undefined;

  if (interactive) {
    localName ??= (await promptText("Local skill name", defaultLocalName)) ?? defaultLocalName;
    provider ??=
      (await promptText("Provider (registry file name)", defaultProvider)) ?? defaultProvider;
    owner ??= (await promptText("Owner (who maintains this in your repo)", "amar")) ?? "amar";
  } else {
    localName ??= defaultLocalName;
    provider ??= defaultProvider;
    owner ??= "amar";
  }

  const entries = await loadRegistry();
  const existing = entries.find((e) => e.local_name === localName);
  if (existing && !force) {
    throw new Error(
      `"${localName}" already exists (${existing.upstream_repo}/${existing.upstream_path}). Pass --force to overwrite.`,
    );
  }

  const newEntry: RegistryEntry = {
    provider,
    local_name: localName,
    upstream_repo: repo,
    upstream_path: path,
    pinned_ref: pinnedRef,
    update_policy: pin ? "manual" : "latest",
    status: "active",
    owner,
  };

  const registryPath = join(EXTERNAL_SOURCES_DIR, `${provider}.yml`);

  if (!write) {
    const plan =
      `  ${pc.yellow("○")} ${pc.bold(localName)} ${arrow} ${pc.cyan(`external-sources/${provider}.yml`)}\n` +
      `    ${pc.dim(`repo: ${repo}  path: ${path}`)}\n` +
      `    ${pc.dim(`pinned_ref: ${pinnedRef} (${newEntry.update_policy})  owner: ${owner}`)}`;
    const message = `${pc.bold("Plan (dry-run)")}\n${plan}\n\n${pc.dim("Re-run with --write to add it to the registry.")}`;
    if (interactive) clack.outro(message);
    else console.log(`\n${message}\n`);
    return;
  }

  const stripProvider = ({ provider: _provider, ...rest }: RegistryEntry) => rest;
  const providerEntries = [
    ...entries
      .filter((e) => e.provider === provider && e.local_name !== localName)
      .map(stripProvider),
    stripProvider(newEntry),
  ];

  await Bun.write(registryPath, serializeProviderFile(provider, providerEntries));

  const confirmation =
    `Added ${pc.bold(localName)} to ${pc.cyan(`external-sources/${provider}.yml`)}\n` +
    pc.dim(`Next: bun scripts/external-skills.ts sync ${localName} --write`);
  if (interactive) clack.outro(confirmation);
  else console.log(`${pc.green("added")} ${confirmation}`);
}

async function promptText(message: string, defaultValue: string): Promise<string | undefined> {
  const answer = await clack.text({ message, placeholder: defaultValue, defaultValue });
  if (clack.isCancel(answer)) throw new Error("Cancelled.");
  return answer || defaultValue;
}

try {
  const [command, ...rest] = process.argv.slice(2);
  const write = rest.includes("--write");
  const all = rest.includes("--all");
  const localName = rest.find((arg) => !arg.startsWith("--"));

  const entries = await loadRegistry();

  switch (command) {
    case "add": {
      await addEntry(rest);
      break;
    }
    case "sync": {
      const targets = resolveTargets(entries, localName, all);
      await runSync(targets, write);
      break;
    }
    case "bump-pins": {
      const targets = localName || all ? resolveTargets(entries, localName, all) : entries;
      await bumpPins(targets, write);
      break;
    }
    default: {
      console.error(`Usage:
  bun scripts/external-skills.ts add <owner/repo | github-url> [<upstream_path>] [--local-name X] [--provider X] [--owner X] [--pin <ref>] [--force] [--write]
  bun scripts/external-skills.ts sync <local_name> [--write]
  bun scripts/external-skills.ts sync --all [--write]
  bun scripts/external-skills.ts bump-pins [<local_name> | --all] [--write]`);
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(pc.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

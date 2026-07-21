# Adding an external skill

All commands: `bun scripts/external-skills.ts <command>`. Every command that
writes to disk defaults to a dry-run — nothing is fetched or written until you
pass `--write`.

## 1. Register it

```sh
# Paste a GitHub blob URL to the skill's SKILL.md directly:
bun scripts/external-skills.ts add https://github.com/<owner>/<repo>/blob/<branch>/path/to/<skill>/SKILL.md

# ...or pass repo + path explicitly:
bun scripts/external-skills.ts add <owner>/<repo> <path/to/skill>
```

This looks up the repo, resolves the current commit (or use `--pin <ref>` to
pin something other than the default branch's HEAD), and confirms the path
actually exists upstream — before printing what it _would_ add. Re-run with
`--write` to append the entry to `external-sources/<provider>.yml`.

Useful flags: `--local-name`, `--provider`, `--owner`, `--force` (to
overwrite an existing entry).

## 2. Vendor it

```sh
bun scripts/external-skills.ts sync <local_name>          # dry-run
bun scripts/external-skills.ts sync <local_name> --write   # fetches + writes skills/<local_name>/
```

This downloads the pinned commit's tarball, copies the skill's directory
into `skills/<local_name>/`, and writes an `UPSTREAM.md` provenance file
next to it (source repo, path, pinned commit).

## 3. Commit

Review `git diff`, then commit both the registry entry and the vendored
`skills/<local_name>/` directory together.

## Later: keeping it current

```sh
bun scripts/external-skills.ts bump-pins            # check for upstream updates (dry-run)
bun scripts/external-skills.ts bump-pins --write     # advance pinned_ref for entries with update_policy: latest
bun scripts/external-skills.ts sync --all --write    # re-vendor everything at its (possibly bumped) pin
```

Entries with `update_policy: manual` are skipped by `bump-pins` — advance
their `pinned_ref` by hand when you want to.

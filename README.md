# skills

Personal collection of [agent skills](https://agentskills.io/specification).

## Prerequisites

- [GitHub CLI](https://cli.github.com) (`gh`), authenticated (`gh auth login`) — v2.90.0+ for the `gh skill` command (preview)
- [Bun](https://bun.sh) — needed for local development (`scripts/external-skills.ts`, lint/format/tsc)

## Installing a skill

```sh
# Install a specific skill for Claude Code, user scope (available in every project)
gh skill install UNRULYEON/skills <skill-name> --agent claude-code --scope user

# Install for a single project instead
gh skill install UNRULYEON/skills <skill-name> --agent claude-code --scope project

# See what's available in this repo
gh skill install UNRULYEON/skills
```

## Updating installed skills

```sh
gh skill update --all
```

## Local development

```sh
bun install       # install dependencies
bun run lint       # oxlint
bun run format     # oxfmt (use format:check in CI)
bun run tsc        # type-check
```

## Creating a new skill

1. `mkdir skills/<skill-name>` and copy `template/SKILL.md.template` there as `SKILL.md`, then fill it in (`name` must match the directory name).
2. Validate it: `gh skill publish --dry-run`
3. Open a PR (`main` is protected — direct pushes aren't allowed) and merge once CI passes.

### Adding an external (vendored) skill

Register and vendor a skill from another repo via `scripts/external-skills.ts` — see [`docs/adding-an-external-skill.md`](docs/adding-an-external-skill.md) for the full workflow.

# skills

Personal collection of [agent skills](https://agentskills.io/specification).

## Prerequisites

- [GitHub CLI](https://cli.github.com) (`gh`), authenticated (`gh auth login`) — v2.90.0+ for the `gh skill` command (preview)
- [Bun](https://bun.sh) — only needed to run `scripts/external-skills.ts` (adding/syncing/vendoring external skills), not for installing skills from this repo

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

## Adding/updating a new skill

1. Copy `template/` to `skills/<skill-name>/` and fill in `SKILL.md` (`name` must match the directory name).
2. Validate it: `gh skill publish --dry-run`
3. Commit and push.
4. Tag a release when ready: `gh skill publish`

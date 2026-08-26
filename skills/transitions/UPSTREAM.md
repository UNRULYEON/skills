---
provider: Jakubantalik
local_name: transitions
status: forked
owner: amar
---

# Upstream

This skill was originally two separate vendored entries from the same
upstream repo, `transitions-dev` and `transitions-polish`. They were merged
by hand into this single `transitions` skill to remove duplicate/colliding
commands between them (both defined a `transitions review` command with
different behavior).

This directory is now a **deliberate fork**: it is no longer registered in
`external-sources/Jakubantalik.yml` and will not be touched by
`bun scripts/external-skills.ts sync` or the weekly external-skills-sync
workflow. Pulling in future upstream changes means diffing them in by hand.

- Source repo: [Jakubantalik/transitions.dev](https://github.com/Jakubantalik/transitions.dev)
- Source paths at fork time: `skills/transitions-dev`, `skills/transitions-polish`
- Pinned commit at fork time: [`67d5c679305a8a1eb7507d56c3f143c0b47602df`](https://github.com/Jakubantalik/transitions.dev/commit/67d5c679305a8a1eb7507d56c3f143c0b47602df)

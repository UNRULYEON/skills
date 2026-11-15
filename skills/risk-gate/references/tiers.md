# Tier rules

`.github/risk-tiers.json` has this shape:

```json
{
  "fallbackTier": 1,
  "bumpAtLines": 400,
  "bumpAtFiles": 25,
  "tests": {
    "match": ["**/*.test.ts", "**/*.test.tsx", "**/*.snap", "e2e/**/*.spec.ts"],
    "except": [".github/**"],
    "sources": [{ "test": "^(.*)\\.test\\.tsx?(\\.snap)?$", "source": ["$1.ts", "$1.tsx"] }]
  },
  "tiers": {
    "0": ["docs/**/*.{md,png}", "**/*.md"],
    "1": ["**/AGENTS.md", "**/CLAUDE.md", ".claude/**"],
    "2": [".github/**", "migrations/**", "package.json", "src/auth/**"]
  }
}
```

## How the script decides

- A file gets the highest tier whose glob list matches it. A file that no list matches gets `fallbackTier`.
- A test file (it matches `tests.match` and not `tests.except`) is tier 0. A test of a tier 2 file is tier 1, so a person sees each change to the tests that protect tier 2 code. `tests.sources` finds that file: each rule has a regular expression `test` and the source paths it gives, with `$1` for the first group. Without `sources`, the script uses the TypeScript rule above.
- The pull request gets the highest tier of its files.
- A tier 1 pull request with at least `bumpAtLines` changed lines or `bumpAtFiles` files goes up to tier 2.
- A body with `**Door:** one-way` is tier 2.
- The globs use `Bun.Glob`. `**/*.md` also matches a file at the root.

## Tier 2

Tier 2 is the code where a bad merge is hard to undo or hurts users or money. Look for each of these, and name the paths that hold it:

- Payments, invoices, credits, prices and refunds.
- Sign-in, sessions, tokens, roles and access control.
- The database schema, migrations and code that deletes or moves data.
- CI and deploy: `.github/**` (always tier 2, so a change to the gate needs a person).
- Config that changes the whole build or runtime: the package manifest and lockfile, the build config, the TypeScript or compiler config, the lint config, the infrastructure config.
- Each test config that decides what runs, for example the Vitest or Playwright config.

Keep tier 2 narrow. Each path there costs one approval for each pull request that touches it.

## Tier 0

Tier 0 merges with no person. Put a path there only if a wrong change in it cannot break the product: docs, Markdown, tests of tier 0 or tier 1 code, and screenshots. The agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/**`) are tier 1, because they change how the agents work.

## Test files in other languages

Add a rule to `tests.match` and to `tests.sources` for each language of the repository:

| Language | `tests.match` | `tests.sources` |
| --- | --- | --- |
| Go | `**/*_test.go` | `{ "test": "^(.*)_test\\.go$", "source": ["$1.go"] }` |
| Python | `**/test_*.py`, `**/*_test.py` | `{ "test": "^(.*/)?test_(.*)\\.py$", "source": ["$1$2.py"] }` |
| Rust (separate tests) | `tests/**/*.rs` | none |
| Ruby | `spec/**/*_spec.rb` | `{ "test": "^spec/(.*)_spec\\.rb$", "source": ["app/$1.rb", "lib/$1.rb"] }` |

When the tests live in another folder than the code, write the path change into `source`, as the Ruby row does.

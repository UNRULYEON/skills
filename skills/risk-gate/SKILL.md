---
name: risk-gate
description: Set up the risk gate in a GitHub repository. Each pull request gets a risk tier from the files it changes. Tier 0 merges with no person. Tier 1 and tier 2 need a person's `approved` label on the head commit. Use when the user wants to add the risk gate, risk tiers or label approval to a project.
disable-model-invocation: true
---

The **gate** is a required check named `risk-gate`. It reads the changed files of a pull request, sets the label `risk:0`, `risk:1` or `risk:2`, and decides:

- **Tier 0** (docs, tests, screenshots): it turns on auto-merge. CI green is enough.
- **Tier 1** (all other code): it passes only when a person added `approved` on the head commit.
- **Tier 2** (money, sign-in, data, migrations, workflows, config): the same as tier 1, and the pull request must fill in `**Door:**` and `**Blast Radius:**` under Merge Danger.

A push, an edit of the body or a change of the base revokes an approval that is older than the change. The gate runs on `pull_request_target`, so it always takes its workflow, its script and its rules from the default branch. A pull request cannot change its own gate.

The parts are in `assets/`. Copy them as they are. Change only the lines that each step names.

## Steps

### 1. Survey the repository

Collect these facts and write them down for the user:

- The default branch, and if the repository is private or public. A ruleset on a private repository needs GitHub Pro, Team or Enterprise.
- Each CI workflow that runs on `pull_request`, and the exact name of each job. Matrix jobs report one check for each value, for example `test (1/4)`.
- Each workflow that runs on a push to the default branch, for example a deploy. If one exists, tier 0 auto-merge needs `MERGE_TOKEN`, because a merge with the default token does not start other workflows.
- The merge methods that the repository allows (`gh api repos/{owner}/{repo} --jq '{squash: .allow_squash_merge, merge: .allow_merge_commit, rebase: .allow_rebase_merge, auto: .allow_auto_merge}'`).
- The languages, and how the project names its test files.
- The agent instruction files that exist: `CLAUDE.md`, `AGENTS.md` or both.
- A `.github/risk-tiers.json` or a `risk-gate` workflow that exists. If one exists, stop and ask the user if you must replace it.

Done when each fact above has a value.

### 2. Write the tier rules

Write `.github/risk-tiers.json`. Follow [references/tiers.md](references/tiers.md) for the format and for how to choose the tier 2 paths. Show the user the tier 2 list with one reason for each path, and change it until the user agrees.

Done when the user agreed to the tier 2 list, and each top-level folder of the repository is in a tier list or falls to `fallbackTier` on purpose.

### 3. Calibrate the rules on past pull requests

Copy `assets/risk-tier.ts` to `.github/scripts/risk-tier.ts`. Run it against the last 30 merged pull requests:

```sh
for n in $(gh pr list --state merged --limit 30 --json number --jq '.[].number'); do
  gh api --paginate "repos/{owner}/{repo}/pulls/$n/files" \
    --jq '.[] | "\(.filename)\t\(.additions + .deletions)", (select(.previous_filename) | "\(.previous_filename)\t0\told")' \
    | bun .github/scripts/risk-tier.ts .github/risk-tiers.json | head -1 | sed "s/^/#$n /"
done
```

Show the user the count for each tier, and the pull requests where the tier looks wrong. A tier that is too high costs the user an approval. A tier that is too low lets a risky change merge with no person. If a result looks wrong, change the rules and run again.

Done when the user accepts the tier of each of the 30 pull requests.

### 4. Add the workflow and the template

- Copy `assets/risk-gate.yml` to `.github/workflows/risk-gate.yml`. Replace `--squash` in the step "Turn on auto-merge for tier 0" with the merge method of the repository.
- Copy `assets/pull-request-template.md` to `.github/pull_request_template.md`. If a template exists, add its Merge Danger section to the existing template.

Done when both files are in place and `--squash` matches an allowed merge method.

### 5. Add the agent rules

Add `assets/agent-rules.md` to the agent instruction file of the repository (`AGENTS.md` if it exists, else `CLAUDE.md`). Replace each `<...>` placeholder with the values from steps 1 and 2. If the file has rules that contradict a rule there, show both to the user and ask which one stays.

Done when the file has no `<...>` placeholder.

### 6. Open the pull request

Make a branch and open a pull request with all the files. The default branch has no rules yet, so the gate treats this pull request as tier 2. Fill in Merge Danger: the door is two-way, and the blast radius is each pull request after the merge.

Done when CI is green on the pull request and only `risk-gate` waits for the person's `approved` label.

### 7. Set up GitHub after the merge

After the user merges, follow [references/github-setup.md](references/github-setup.md): the labels, auto-merge, `MERGE_TOKEN` and the ruleset. Each item changes a repository setting, so show the user each command and run it only when the user agrees.

Done when the three checks at the end of `references/github-setup.md` passed.

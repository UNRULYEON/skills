# GitHub setup

Run these after the pull request with the gate merged. Each one changes a repository setting, so show each command to the user first.

## Labels

The gate makes the `risk:*` labels itself. Make the label that a person adds:

```sh
gh label create approved --color 0e8a16 --description "A person approved the head commit" --force
```

## Auto-merge

```sh
gh api -X PATCH repos/{owner}/{repo} -F allow_auto_merge=true
```

## MERGE_TOKEN

Tier 0 auto-merge uses `MERGE_TOKEN`. A merge with the default `GITHUB_TOKEN` does not start other workflows, so a deploy on push would not run. If the repository has no workflow on push to the default branch, the token is optional.

The user makes a fine-grained personal access token for this repository only, with **Contents: read and write** and **Pull requests: read and write**. Then:

```sh
gh secret set MERGE_TOKEN
```

The command reads the token from the terminal, so the token is not in the shell history. Without the secret, the gate passes tier 0 but does not turn on auto-merge, and its log says so.

## Ruleset

Make one ruleset for the default branch. It requires the pull request flow, the `risk-gate` check and each CI check:

```sh
gh api -X POST repos/{owner}/{repo}/rulesets --input - <<'JSON'
{
  "name": "Required checks",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false, "require_last_push_approval": false, "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "risk-gate" },
          { "context": "<each CI job name from step 1>" }
        ] } }
  ]
}
JSON
```

The names in `required_status_checks` must match the job names exactly:

- A required check that no job reports blocks each pull request forever. When you rename a CI job, split it into shards or remove it, change the ruleset at the same time.
- A job that skips counts as a pass. That is correct for a job that a path filter skips. It is wrong when a failed job before it makes it skip, so give such a job `if: ${{ !cancelled() }}` and check the results of the jobs before it.
- With `strict_required_status_checks_policy`, a pull request must be up to date with the default branch. After one pull request merges, the next one shows `BEHIND`. Update it (`gh pr update-branch <number> --rebase`). The update is a push, so the person must approve again.
- Do not require a shard job (`test (1/4)`). Require the job that merges the shards and fails when a shard failed. Then the ruleset does not change when the number of shards changes.

## Checks

Do all three, and show the result to the user:

1. **Tier 0 merges alone.** Open a pull request that changes only a Markdown file. It gets `risk:0`, and it merges when CI is green.
2. **Tier 1 waits for a person.** Open a pull request that changes one line of code. It gets `risk:1`, and `risk-gate` fails with "A person must add the approved label." After the user adds `approved`, `risk-gate` passes.
3. **A push revokes the approval.** Push one more commit to the pull request of check 2. The `approved` label goes away, and `risk-gate` fails again.

Close the pull requests of checks 2 and 3 without a merge.

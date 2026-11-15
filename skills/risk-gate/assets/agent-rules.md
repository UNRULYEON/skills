## Pull requests

- Never push to `<default branch>` directly. Make a branch, push it and open a pull request.
- Wait for the CI checks on the pull request. Fix a red check before you ask for review.
- Split large work into several small pull requests. Each pull request must be reviewable on its own and must leave CI green.
- Fill in the pull request template: Summary, Evidence and Merge Danger.
- Never add the `approved` label. Only a person adds it. A push to the pull request removes it, and the person must approve the new commits.

## Review

- Find the tier of your branch: `git diff --numstat --no-renames origin/<default branch>...HEAD | awk '{print $3 "\t" $1+$2}' | bun .github/scripts/risk-tier.ts`
- Tier 0 needs no review. Tier 1 needs a code review. Tier 2 needs a code review and a security review. Run a review for a tier 0 change too if you think it is risky.
- Run each review in a subagent with a fresh context. Never run it in the context that wrote the code.
- Tell the security reviewer to look at sign-in, access control, input handling, secrets, payments and data exposure.
- Give each reviewer a bar. Tell it to report only a bug that gives a wrong result in normal use, a security hole that someone can exploit, or a break of a rule in this file. Tell it not to report style, design alternatives or races that need two events in the same second.
- Before you ask for a review, run the change for real. A review cannot replace a run.
- Fix each finding, or write a reply that says why the finding is wrong. Do not ask for approval while a finding is open.
- Fix the cause, not the symptom. If a new round finds a new gap in the code that you fixed in the last round, stop patching. Propose a different design to a person.
- Do at most three rounds of fix and review on one pull request. After the third round, stop. Write a comment that lists what is open, and ask a person.
- In Evidence, say which reviews you ran and what they found. Wait for each review to finish before you write Evidence. No check in CI enforces the reviews, so a person must read this.

## Merge policy

- The script `.github/scripts/risk-tier.ts` sets a risk tier for each pull request from the files that it changes. The author does not set it. The rules are in `.github/risk-tiers.json`.
- Tier 0 is docs, tests and screenshots. When CI is green, the pull request merges with no person.
- Tier 1 is all other code. A person must add the `approved` label.
- Tier 2 is <tier 2 areas from step 2>, workflows and config. A person must add the `approved` label. The pull request must fill in Door and Blast Radius under Merge Danger.
- A test of tier 2 code is tier 1, so a person sees each change to the tests that protect tier 2 code.
- A pull request that declares `**Door:** one-way` is tier 2, whatever files it changes. A change that is hard to undo is a one-way door, for example a migration that drops data, a change to payments or a change to sign-in.
- A large tier 1 change goes up to tier 2.
- Never lower a tier in the same pull request as the code that needs it.

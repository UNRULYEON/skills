# Standing up the baseline

Mechanics for the "before" half of every capture pair: a second copy of the repo at the merge-base, served alongside the branch.

Use a **worktree** rather than stashing or checking out — the working tree stays untouched, so a running dev server and any uncommitted work survive.

## 1. Create the worktree

```bash
BASE=$(git merge-base HEAD main)
WT="${TMPDIR:-/tmp}/visual-capture-base"
git worktree add --detach "$WT" "$BASE"
```

Confirm it really is the baseline before spending an install on it — grep the worktree for markup the branch **added** and expect nothing back:

```bash
grep -r "Save preferences" "$WT/app" || echo "confirmed absent in baseline"
```

A hit means the worktree is on the wrong ref (or the change was already on `main`); fix that before continuing.

## 2. Bring over untracked config

Gitignored env files do not exist in a fresh worktree, and a server missing them typically **builds and serves but 500s every request** — the failure looks like a broken baseline rather than a missing file.

```bash
cp .env .env.local .env.*.local "$WT" 2>/dev/null
```

Copy whatever else is gitignored but load-bearing (local certs, `.npmrc`, a SQLite file). These copies may hold secrets, so they are part of cleanup — see step 5.

## 3. Install and serve on a free port

Install inside `$WT` with the project's package manager — the same one step 3 of the skill detected — against the worktree's own lockfile (`bun install`, `pnpm install --frozen-lockfile`, `npm ci`, …). `$WT` is outside the repository's tracked tree, so nothing lands in the diff.

The branch's server is already running, so probe for a port instead of assuming one:

```bash
PORT=$(node -e "const s=require('net').createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})")
```

Start the baseline server on that port (the flag name varies per framework) and wait for **HTTP 200** on the route, exactly as in the main capture step.

## 4. Capture both

Return to step 4 of the skill and run the pair against `$PORT` (before) and the branch's port (after).

A pair that comes back identical is a finding too: either the diff is invisible on that route, or the route is not the one that renders it.

## 5. Clean up — always

Run this even when the capture failed. It is housekeeping, not a finding — it stays out of the response:

```bash
kill "$BASE_SERVER_PID"          # stop the baseline server first
git worktree remove --force "$WT"  # takes the copied env files with it
```

The worktree removal is what deletes the secrets copied in step 2 — leaving the worktree behind leaves those files on disk.

When the baseline cannot be built or served (dependencies from a different lockfile era, a migration the old code cannot run), clean up, then give the "after" paths alone under step 5's one-line exception, naming why the baseline was unavailable.

# Babysit

Drive an already-open pull request to merged — as opposed to
[ship](ship.md), which gets a fresh diff to merge-ready in the first place.

1. Read the PR's current state fully: the diff, open review threads, and CI
   status. Don't assume anything from when it was opened still holds.
2. Resolve what's blocking in order of cost: merge conflicts first, then
   failing CI, then open review threads.
3. For each review thread, either make the requested change or reply with
   why not. Don't leave one silent.
4. Re-check CI after each fix rather than stacking several unverified fixes
   before re-running it.
   ([sequence into verifiable units](../principles.md#sequence-into-verifiable-units))
5. Report merge-readiness plainly: merged, green and ready, or exactly
   what's still outstanding.

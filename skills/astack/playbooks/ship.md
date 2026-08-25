# Ship

1. Read the full diff before calling it ready — don't rely on remembering
   what was written.
2. Run the project's own checks (lint, typecheck, build, test — whatever it
   defines) from a real run and confirm they're green. Don't assume a check
   would pass.
   ([prove it against the real artifact](../principles.md#prove-it-against-the-real-artifact))
3. Review the diff independently for correctness and scope creep before
   proposing it as ready — the same scrutiny you'd apply to someone else's
   change.
4. Open or update the pull request with a description that states why the
   change exists, not just what it touches.
5. Report merge-readiness plainly: green and ready, or what's still
   blocking.

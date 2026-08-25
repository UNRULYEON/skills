# Bug fix

1. Reproduce the defect before changing anything. Find or write the smallest
   input that triggers it, and confirm it fails. If it can't be reproduced,
   say so and stop — don't guess at a fix for a bug you can't observe.
2. Trace the failure to its root cause. Ask why at each layer until the
   answer is the actual origin, not a symptom one layer up.
   ([fix root causes](../principles.md#fix-root-causes))
3. Fix at the root cause, with the smallest change that removes it.
   ([bias toward deletion](../principles.md#bias-toward-deletion))
4. Re-run the original repro and confirm it now passes. Check the
   surrounding behavior for regressions the fix could have introduced.
5. Report: what was broken, why, what changed, and what confirms it's fixed.

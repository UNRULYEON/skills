# Refactoring

1. Capture the current behavior before touching structure — existing tests,
   or a manual check you can repeat — so you have a baseline to prove against.
2. Remove dead weight first: unused branches, redundant abstractions, stub
   references. ([subtract before you add](../principles.md#subtract-before-you-add))
3. Change structure in verifiable units — one seam at a time, checked before
   moving to the next.
   ([sequence into verifiable units](../principles.md#sequence-into-verifiable-units))
4. Re-run the baseline from step 1 and confirm nothing changed behaviorally.
5. Report: what moved, what stayed identical, and how sameness was proven —
   not asserted.

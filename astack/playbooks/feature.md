# Feature

1. Name the data shape the feature operates on before writing any logic.
   ([data structures first](../principles.md#data-structures-first))
2. Put validation and guards at the boundary where the feature receives
   external input; keep the core logic pure.
   ([boundary discipline](../principles.md#boundary-discipline))
3. Build the smallest version that satisfies the request. Don't add
   configuration, flags, or generality the request didn't ask for.
4. Verify it end to end against the real artifact — run it, don't just read
   the code and reason about it.
   ([prove it against the real artifact](../principles.md#prove-it-against-the-real-artifact))
5. Report: what was built, how it was verified, and anything explicitly out
   of scope.

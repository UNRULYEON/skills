# Visual parity

1. Capture the reference and the current state as real evidence — actual
   screenshots or rendered output of both — not a description of what each
   should look like. Use the project's `visual-capture` skill, if installed,
   to produce a before/after pair against the real routes.
2. Diff them directly, property by property or pixel by pixel, to find
   where they actually differ — not where you'd expect them to differ.
   ([prove it against the real artifact](../principles.md#prove-it-against-the-real-artifact))
3. Fix the smallest set of properties that closes the gap. Don't restyle
   beyond what the reference requires.
   ([bias toward deletion](../principles.md#bias-toward-deletion))
4. Re-capture and re-diff after each fix instead of batching multiple
   visual changes before checking.
   ([sequence into verifiable units](../principles.md#sequence-into-verifiable-units))
5. Report: what matched, what didn't, and the final diff confirming
   parity — not a visual description in words.

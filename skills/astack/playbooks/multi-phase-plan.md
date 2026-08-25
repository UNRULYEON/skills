# Multi-phase plan

1. Break the work into phases where each phase ends in a state that's
   independently reviewable and verifiable — not one large diff spanning
   all of them.
   ([sequence into verifiable units](../principles.md#sequence-into-verifiable-units))
2. Sequence phases so each one leaves the system working, not mid-migration.
   Avoid a phase that only makes sense once a later phase lands.
3. State the target end state up front and converge each phase toward it
   directly, rather than adding temporary compatibility scaffolding meant to
   be deleted later.
   ([bias toward deletion](../principles.md#bias-toward-deletion))
4. Verify each phase against the real artifact before starting the next.
   ([prove it against the real artifact](../principles.md#prove-it-against-the-real-artifact))
5. Report progress phase by phase: what landed, what's next, and what would
   block the next phase from starting.

# Principles

## bias toward deletion

The smallest change that solves the problem beats a larger one, even a more
"complete" one. When a fix could be a deletion instead of an addition, delete.
Apply when choosing between adding a workaround and removing what makes the
workaround necessary.

## subtract before you add

Before extending a system, remove what's already dead: unused branches, stub
references, redundant validators. Building on top of dead weight compounds it.
Apply at the start of any feature or refactor that touches a file with
accumulated cruft.

## data structures first

Choose the core types and sequencing before writing logic. Get the data
structures right and the code that operates on them becomes obvious; get them
wrong and every downstream function pays for it. Apply before writing any
nontrivial logic, not just at architecture time.

## minimize reader load

Count the layers between a question and its answer, and the state a reader has
to hold in their head to follow the code. Collapse wrappers that have exactly
one caller. Shrink mutable scope. Apply whenever a change would add a layer of
indirection — ask whether it earns its keep first.

## boundary discipline

Concentrate validation and guards at system boundaries — CLI input, config,
network responses, external APIs. Trust internal types once past the boundary,
and keep core logic pure. Apply whenever external data enters the system;
don't scatter re-checks throughout the call chain.

## illegal states unrepresentable

Parse external data into a type that can't represent the invalid cases, at the
boundary, once. Don't pass raw external data deeper into the system and
re-validate it at each use. Apply to any external input: user forms, API
responses, config files.

## prove it against the real artifact

Verify against the real thing — run the feature, read the actual output,
inspect the actual diff — not a proxy, a mock of the thing under test, or "it
compiles." Apply after any change, before calling it done.

## fix root causes

Trace a symptom to where it actually originates before writing a fix.
Reproduce it first. Ask why until the answer stops being "because the code
above did something wrong" and starts being the actual cause. Resist adding a
null check or try/catch that silences a crash without addressing why it
happened.

## sequence into verifiable units

Break work into steps that each end in a state you can check — not just a
state you hope is correct. Verify one step before starting the next, so a
failure is caught where it happened, not three steps later. Apply to
multi-step work: migrations, sweeps, staged rollouts, stacked changes.

## encode the lesson

When a rule keeps needing to be restated, that's a sign it should be encoded
as a lint rule, a script, a type, or a check — not repeated as prose. Prose is
forgotten; a check that fails the build is not. Apply once you notice yourself
explaining the same constraint more than once.

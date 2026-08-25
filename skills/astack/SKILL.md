---
name: astack
description: Rigor-mode router for engineering tasks. Matches a task to a playbook (bug fix, feature, refactor, investigation, ship) and carries a compact set of engineering principles through it. Invoke at the start of any task bigger than a one-line edit.
argument-hint: "Describe the task: what you want done."
disable-model-invocation: true
---

# astack

Route the task below to a playbook, then run it. Read the principles index once at
the start of the task. Open a specific principle's full entry in `principles.md`
only when a step calls for it. Open one playbook file after picking it — not the
others.

## 1. Match a playbook

| playbook | for |
|---|---|
| [bug-fix](playbooks/bug-fix.md) | reproducing and fixing a defect |
| [feature](playbooks/feature.md) | new or changed behavior |
| [refactoring](playbooks/refactoring.md) | a behavior-preserving structural change |
| [investigation](playbooks/investigation.md) | a read-only question — how, why, is this true |
| [ship](playbooks/ship.md) | getting a fresh diff to merge-ready and landed |
| [babysit](playbooks/babysit.md) | driving an already-open PR to merged: conflicts, review threads, CI |
| [perf](playbooks/perf.md) | tracing a measured slowness and improving it against a baseline |
| [prototype](playbooks/prototype.md) | settling a design choice cheaply with throwaway competing sketches |
| [visual-parity](playbooks/visual-parity.md) | pixel- or property-exact UI equivalence between two implementations |
| [multi-phase-plan](playbooks/multi-phase-plan.md) | work that spans phases or stacked PRs |

No match? Apply the principles below directly and design a short sequence of
verifiable steps for the task instead of forcing it into one of these.

## 2. Principles index

Apply these throughout the task, not just at the step that names them.

| principle | rule |
|---|---|
| [bias toward deletion](principles.md#bias-toward-deletion) | smallest change that solves the problem; prefer removing code to adding it |
| [subtract before you add](principles.md#subtract-before-you-add) | clear dead weight and stub references before building on top |
| [data structures first](principles.md#data-structures-first) | settle core types and sequencing before writing logic |
| [minimize reader load](principles.md#minimize-reader-load) | collapse one-caller wrappers, shrink hidden state, cut layers between question and answer |
| [boundary discipline](principles.md#boundary-discipline) | concentrate guards at system boundaries; trust internal types; keep core logic pure |
| [illegal states unrepresentable](principles.md#illegal-states-unrepresentable) | parse external data at the boundary; don't lie to the type system |
| [prove it against the real artifact](principles.md#prove-it-against-the-real-artifact) | run the feature, read the actual value, inspect the diff — not a proxy or "it compiles" |
| [fix root causes](principles.md#fix-root-causes) | reproduce first, ask why until you reach it; resist guards that silence a crash instead of fixing it |
| [sequence into verifiable units](principles.md#sequence-into-verifiable-units) | break work into steps that each end in a checkable state; verify each before the next |
| [encode the lesson](principles.md#encode-the-lesson) | turn a recurring rule into a lint, script, or check instead of more prose |

## 3. Route the work

Reach for these by role instead of doing everything in the main thread:

| need | reach for |
|---|---|
| read-only investigation, "how does X work" | an `Explore` subagent |
| a cross-cutting design decision before writing code | plan mode, or a `Plan` subagent |
| research or a work unit heavy enough to pollute the main thread | a forked subagent |
| N independent attempts to compare before committing | parallel subagent calls, then take the best parts |
| reviewing a diff before calling it ready | the project's own review skill, if one is installed; otherwise review it yourself against the principles above |
| a deletion/simplification pass | the project's own cleanup skill, if one is installed; otherwise apply bias-toward-deletion and subtract-before-you-add directly |
| a long-running or overnight task | this session's loop/scheduling mechanism |

## 4. Report

State what changed and how it was verified — not a narration of the steps taken
to get there. If a step in the playbook couldn't be completed, say so plainly
instead of reporting success.

<!-- Playbook/principle structure adapted from pstack's poteto-mode
     (github.com/cursor/plugins/tree/main/pstack, MIT), rewritten for Claude Code. -->

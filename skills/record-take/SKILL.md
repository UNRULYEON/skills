---
name: record-take
description: Record a reproducible screen video of a web page with CleanShot X from a scripted take. Use when the user wants a demo, showcase or looping video of a web app, or wants to write, change, rehearse or re-record a take.
---

A **take** is a TypeScript file that exports `TAKE`: a URL, a window size, and a list of steps. The runner opens the URL in the user's normal Safari, moves the real pointer and presses real keys, and records the Safari window with CleanShot X. The same take gives the same video on each run, because the delays come from a seeded random source.

```sh
bun <this skill's folder>/scripts/index.ts <take-file> --rehearse
```

- `--rehearse` runs the steps without a recording.
- `--warmup` stops after the page load until the user presses Enter, so that they can prepare the window by hand (sign in, close a banner).
- No flag makes the recording.

## Steps

1. **Find the take.** Search the project for a `takes/` folder. Put a new take there, or in `takes/` at the project root when there is none. Read one take that is there before you write a new one: it shows the pace the user likes.
2. **Write or change the take.** [`TAKES.md`](TAKES.md) has every field, step and target. Read it before you write a step.
3. **Tell the user that the run starts**, and that it takes control of the pointer and the keyboard until it ends. A touch on the mouse or a key during the run breaks the take.
4. **Rehearse** until the run prints its last step and exits with code 0. The runner prints each step as `n/total` before it does the step, so the last printed line shows where a failure is.
5. **Record** when the rehearsal is clean and the user wants the video. The runner prints `The recording is on.` when CleanShot X records, and only then plays the steps. The run is done when it exits with code 0 and a new video is in the CleanShot X export folder (`defaults read pl.maketheweb.cleanshotx exportPath`). Give the user that file path.

## How to check a rehearsal

The terminal has no Screen Recording permission, so look at page state, not at screenshots. Add `{ eval: "return document.querySelector('h1')?.innerText" }` steps where you want proof: the runner prints the returned value. Remove these probes before the recording.

A `waitFor` step after each action that loads or opens something is the usual fix for a step that fails on a slow run. It also makes the take independent of network speed, where a fixed `wait` is not.

## What the machine must have

Give the user the applicable line when a run fails on it.

- Safari > Develop > "Allow JavaScript from Apple Events" is on.
- The terminal app has the Accessibility permission (System Settings > Privacy & Security). Without it the pointer and the keys do nothing.
- CleanShot X is installed, and its "Record screen" shortcut is `ctrl+alt+cmd+r`. For a different shortcut, set `CLEANSHOT_STOP_SHORTCUT`. The runner uses this shortcut to stop the recording, so a wrong value leaves the recording on.
- The screen is larger than the take's `width` and `height` plus the Safari toolbar. The runner prints a warning when the page area is not the requested size.

`Ctrl+C` stops the recording and closes the Safari window that the runner opened.

A run that fails with `AppleEvent timed out` had a Safari that did not answer. Run it again before you change the take.

## The runner code

The code is in `scripts/`. `bun test` in that folder runs its tests. `pointer.swift` is compiled on the first run to `~/Library/Caches/record-take/pointer`.

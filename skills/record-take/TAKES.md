# Take files

A take file needs no imports. The types are in [`scripts/steps.ts`](scripts/steps.ts). The runner rejects a file without `TAKE` and a step of an unknown kind before it opens Safari.

```ts
const ALBUM = { text: "Mr. Morale & The Big Steppers" };

export const TAKE = {
  url: "https://example.com",
  width: 1280,
  height: 800,
  ready: { text: "Recently played" },
  setup: [{ click: { text: "Recently played" }, duration: 0 }],
  loop: true,
  steps: [
    { wait: 500 },
    { press: "cmd+k" },
    { waitFor: { selector: "[role=dialog] input" } },
    { zoom: 1.8, at: { selector: "[role=dialog]" }, duration: 700 },
    { type: "kendrick", delay: { min: 50, max: 140 } },
    { waitFor: { text: "Kendrick Lamar", with: "Hiphop/Rap" } },
    { pressUntil: "down", highlighted: ALBUM, delay: 280 },
    { zoom: 1, duration: 700 },
    { press: "return" },
    { waitFor: { text: "Back" } },
    { wait: 1500 },
  ],
};
```

## Take fields

| Field | Default | Meaning |
| --- | --- | --- |
| `url` | required | The page that the new Safari window opens. |
| `width`, `height` | required | The size of the page area in CSS pixels. The window chrome is added on top. |
| `ready` | none | A target that must be on the page before anything else runs. |
| `setup` | none | Steps that run before the recording starts. Use them to put the page in its start state. |
| `steps` | required | The recorded steps. |
| `cursor` | page center | The page point where the pointer is when the recording starts. |
| `settle` | 1500 | Milliseconds between the setup and the start of the recording. |
| `seed` | 1 | The seed for the random delays. Change it for a different rhythm. |
| `loop` | false | Adds a move back to `cursor` and a hold of 1 s at the end, so that the last frame equals the first. For a clean loop, the steps must also bring the page back to its start state and to zoom 1. |

## Targets

A target is one of these. All coordinates are page points: CSS pixels from the top left corner of the page area.

- `{ text }` matches an element whose `innerText` or `aria-label` is exactly the text.
- `{ text, with }` matches an element whose `innerText` contains the two strings. Use it for a row: `{ text: "SaWaDiKa", with: "3:09" }`.
- `{ selector }` matches a CSS selector.
- `{ x, y }` is a fixed page point.

When more than one element matches, the smallest one wins. The pointer goes to the center of the element. Add `at: { x: 0.9, y: 0.5 }` for a different place: the values are fractions of the element's width and height. A target must be in the view, and the runner waits up to 10 s for it. Use `scrollTo` first for an element that is outside the view.

## Steps

All durations and delays are in milliseconds. A delay is a number or `{ min, max }`. A range gives the human rhythm, and it is the same on each run.

| Step | Options (default) | Effect |
| --- | --- | --- |
| `{ wait: 500 }` | | Holds. |
| `{ waitFor: target }` | `timeout` (10000) | Waits until the target is in the view. |
| `{ moveTo: target }` | `duration` (700) | Moves the pointer with an ease in and out. |
| `{ click: target }` | `duration` (700) | Moves, then clicks. `doubleClick` and `rightClick` are the same. |
| `{ drag: target, to: target }` | `duration` (700) | Presses on the first target and releases on the second. |
| `{ scroll: 400 }` | `duration` (1000) | Scrolls the scroll container below the pointer by pixels. A negative number scrolls up. `"top"` and `"bottom"` go to the edge. |
| `{ scrollTo: target }` | `duration` (1000) | Scrolls until the target is in the middle of its scroll container. The target cannot be a point. |
| `{ type: "text" }` | `delay` (60), `submit` | Types each character. `submit: true` presses return at the end. |
| `{ press: "cmd+k" }` | `times` (1), `delay` (250) | Presses a key. |
| `{ pressUntil: "down", highlighted: target }` | `delay` (250), `limit` (30) | Presses the key until the highlighted element contains the target text. The highlighted element is `[data-highlighted]`, or the target's `selector`. |
| `{ zoom: 1.8, at: target }` | `duration` (900) | Scales the page so that the target moves toward the center. `{ zoom: 1 }` goes back. |
| `{ go: "https://..." }` | | Loads a different URL and waits for the load. |
| `{ eval: "..." }` | | Runs a function body in the page. A returned value is printed. |

Keys for `press` and `pressUntil`: the letters `a` to `z`, `return`, `enter`, `tab`, `space`, `delete`, `escape`, `left`, `right`, `up`, `down`, `[` and `]`. Modifiers: `cmd`, `shift`, `alt` or `opt`, `ctrl`. The table has no digits: use `type` for them.

## Pace

A take is a video for a viewer, not a test. Put a `wait` of 300 to 1500 ms after each visible change, so that the viewer can read the result. Use `duration: 0` only in `setup`, where no one sees the pointer jump.

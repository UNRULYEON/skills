---
name: visual-capture
description: Use when the user wants screenshots, a video, or a before/after of a UI change in a web app — "show me what this looks like", "capture the new page", "record the interaction", "screenshot my changes", "did this break the mobile layout". Works out the affected routes from the branch diff against main and captures each one before and after in Chrome with agent-browser, without adding it to the project.
---

# Visual capture

Turn a **branch diff** into pictures: screenshots or a video of the routes the diff touches, in Chrome, at desktop 1280×720 and mobile 430×932.

Every capture is a **pair** — the merge-base and the branch, same route, same viewport, same commands. A lone "after" shot shows what the page looks like, not what the change did, so the baseline is part of the job, not an upgrade to it. The only acceptable single-sided result is a baseline that genuinely cannot be built or served, reported as such.

agent-browser is a **guest** — a CLI driven from outside the repository. Never add it as a project dependency, config file, or install script.

## 1. Read the diff

```bash
BASE=$(git merge-base HEAD main)
git diff --stat "$BASE" -- .        # committed + working-tree changes vs main
git status --porcelain
```

Read the actual hunks of the UI-bearing files (pages, routes, components, styles). Work out, for each change, **what a viewer would see differently** — a new element, a moved one, a state that only appears after a click.

Completion criterion: every changed UI file is either mapped to a route that renders it, or written off as invisible (types, tests, server-only code). This accounting is working reasoning — it never reaches the response, which is only the lists from step 5.

If nothing in the diff is visible, say that in one line and stop — do not capture a random page.

## 2. Pick the target

Assemble a capture list: one entry per route, each with a `name` slug, the URL on the running dev server, and the commands it needs — every entry gets captured twice, on the baseline and on the branch.

A change that is only visible after interaction (hover, open, submit, scroll) is a **steps** capture — see [`references/interactions.md`](references/interactions.md). A change to motion or a transition is a **video** capture (`record start` / `record stop`).

Decide the framing now, per route: the default shoots the viewport only, so anything below the fold — a footer, a table's last rows, a section at the bottom of a long page — needs `screenshot --full`, or a scroll in a steps run. A capture that does not contain the changed element is a wasted run.

Decide the **highlight** too. An element the diff *modified* — restyled, moved, resized, reworded — is hard to spot in a full page, so run `agent-browser highlight <selector>` (repeatable) right before the screenshot on both sides, turning the pair into a spot-the-difference with the answer circled. An element the diff *added* needs no highlight: it is the only thing in the after that is not in the before.

Pick a selector that exists on **both** sides — the modified element's own `id`, `data-*`, or a stable class — because a selector that only matches after the change marks one shot and leaves the other bare.

Find the dev server URL from the project's own scripts (`package.json`, README, `.env`). If no server is running, start it in the background.

**Ready means HTTP 200 on the route you are about to capture** — not merely that the port answers:

```bash
curl -o /dev/null -sw '%{http_code}\n' http://localhost:3000/settings
```

A 500 renders as a perfectly photogenic error page and will screenshot as if it were a real result. On any non-200, read the dev server log, fix the render error, and capture only once the route returns 200. A route you cannot reach at all (auth, seeded data) is one of step 5's one-line exceptions.

## 3. Get agent-browser ready

**Install nothing until you have checked the machine.** A user who already has agent-browser on `PATH` needs no bootstrap at all, and reaching for a package manager the project bans is how this step gets killed by a hook.

```bash
command -v agent-browser >/dev/null 2>&1 && echo "agent-browser on PATH — use it directly"
```

If that prints, call it as `agent-browser` for the rest of this skill. Otherwise run it through the project's own package runner instead of installing anything — **the project's rule even though the run happens outside the project**:

```bash
run() {
  if [ -f bun.lock ] || [ -f bun.lockb ]; then bunx agent-browser "$@"
  elif [ -f pnpm-lock.yaml ]; then pnpm dlx agent-browser "$@"
  elif [ -f yarn.lock ]; then yarn dlx agent-browser "$@"
  else npx --yes agent-browser "$@"; fi
}
```

Use `run` in place of `agent-browser` for every command below. A persistent install (`npm install -g agent-browser`, `brew install agent-browser`) is faster on repeat runs but is the user's call, not yours — default to the ad hoc runner, which leaves nothing behind.

agent-browser needs its own Chrome build (Chrome for Testing), fetched into its own cache — once per machine, outside the project. The first real command often triggers that download on its own; if a command instead errors about a missing browser, run `agent-browser install` (through `run` if using the ad hoc runner) once, then retry.

The CLI surface is large. If a command or flag below doesn't behave as documented, run `agent-browser <command> --help` to confirm current syntax before working around it.

## 4. Capture the pair

Stand up the baseline first — worktree, env files, free port, cleanup — following [`references/before-after.md`](references/before-after.md), then run the **same command sequence twice**, changing only the port, the session name, and the output path.

Resolve the output directory once, the same way for both sides — captures must never land in the diff:

```bash
OUT="${VISUAL_CAPTURE_OUT:-}"
[ -z "$OUT" ] && { git check-ignore -q .visual-capture && OUT=".visual-capture" || OUT="${TMPDIR:-/tmp}/visual-capture"; }
mkdir -p "$OUT/before" "$OUT/after"
OUT="$(cd "$OUT" && pwd)"   # absolute — step 5's report and the Read tool both need it
```

Point `$VISUAL_CAPTURE_OUT` at the scratchpad to keep a session's captures together. Adding `.visual-capture` to the project's `.gitignore` is the user's call, not yours.

Give each side of a pair its own session name so the two browsers never collide, and drive the whole capture as one `batch` call:

`--session` is a global option and goes **before** the subcommand, not after it:

```bash
run --session settings-desktop-before batch \
  "open http://localhost:$PORT/settings" \
  "set viewport 1280 720 2" \
  "wait --load networkidle" \
  "screenshot $OUT/before/settings-desktop.png" \
  "close"

run --session settings-desktop-after batch \
  "open http://localhost:3000/settings" \
  "set viewport 1280 720 2" \
  "wait --load networkidle" \
  "screenshot $OUT/after/settings-desktop.png" \
  "close"
```

Mobile uses `set viewport 430 932 3` for the same pixel size and DPI as before. `set device "<name>"` picks up touch/mobile emulation as a bundle when a close-enough preset exists, but its dimensions won't line up with 430×932 — pick one convention per project and use it on both sides of every pair; never mix them within a pair.

Any command you run on one side, run on the other, in the same order — a `--full` before against a viewport-only after is not a comparison, and a highlight on one side alone reads as if the marker itself were the change.

| Command | Effect |
| --- | --- |
| `screenshot <path>` | Viewport-only screenshot |
| `screenshot <path> --full` | Whole scrollable page |
| `highlight <sel>` | Outline the matching element in place, right before the screenshot (repeatable) |
| `wait <sel>` | Block until a selector appears |
| `wait <ms>` | Extra settle time after load |
| `wait --load networkidle` | Block until the network goes idle |
| `wait --text "<text>"` | Block until a substring appears on the page |
| `set viewport <w> <h> <scale>` | Exact pixel size + device scale factor |
| `record start <path>.webm` / `record stop` | Record instead of a bare screenshot |

Interaction-only changes are a **steps** capture: chain more commands (`click`, `hover`, `fill`, `find role ...`) between `open` and `screenshot`, still inside one `batch` call — see [`references/interactions.md`](references/interactions.md). A change to motion or a transition is a **video** capture: `record start` right after the page settles, run the interaction, then `record stop`.

`record` writes `.webm`; convert to a portable `.mp4` for anything leaving the terminal (Slack, a PR comment, Quicktime):

```bash
ffmpeg -hide_banner -loglevel error -y -i "$OUT/after/settings-desktop.webm" \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -movflags +faststart \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "$OUT/after/settings-desktop.mp4"
```

Skip the conversion and keep the `.webm` if ffmpeg isn't on the machine.

Always end a session with `close`, even one that failed partway — agent-browser keeps a browser alive per session in a background daemon until told to stop, and a leaked one is exactly the footprint a guest tool must not leave behind.

## 5. Report

Read every image back with the Read tool — before **and** after, both viewports — before writing a word. An unopened screenshot is not evidence.

Then the entire response is **two lists**:

```
desktop
- /abs/path/before/settings-desktop.png
- /abs/path/after/settings-desktop.png

mobile
- /abs/path/before/settings-mobile.png
- /abs/path/after/settings-mobile.png
```

Each list is before then after, in that order. Every bullet is one absolute path. A bullet with no path means that capture never happened, so fix the capture rather than shipping an empty line. Video pairs take the same shape with `.mp4` (or `.webm`) paths. More than one route: repeat the two lists per route, under a bare `/route` line.

The lists carry the finding — the reader is looking at the images. Everything you worked out along the way (which files were written off, page heights, framing choices, contrast opinions, session/worktree cleanup, that the servers returned 200) is **working reasoning, not output**: it stays out of the response, and no preamble, summary, or sign-off goes in front of the lists.

One exception: a fact that changes how the images should be read, at most one line, above the lists. A baseline that could not be built (list the after path alone), a route you could not reach, a capture that shows a rendering error. Absent one of those, the response opens on the word `desktop`.

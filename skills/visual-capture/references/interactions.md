# Interaction captures

Chain agent-browser commands inside one `batch` call instead of writing a script — every command after `open` sees the page the previous one left it in, and the session stays alive between them. `--session <name>` is a global option and goes **before** `batch`, not after it.

```bash
run --session settings-desktop-after batch \
  "open http://localhost:3000/settings" \
  "set viewport 1280 720 2" \
  "wait --load networkidle" \
  "screenshot $OUT/after/settings-desktop-closed.png" \
  "find role button click --name Menu" \
  "wait [role=menu]" \
  "screenshot $OUT/after/settings-desktop-open.png" \
  "close"
```

Run the identical sequence against the baseline port for the before half — same commands, same order, only the URL, session name, and output path change.

Rules that keep a run reproducible:

- Reach for elements with `find role <role> <action> --name <name>`, `find text <text> <action>`, or `find label <label> <action>` — semantic locators survive the next refactor the way a brittle CSS selector doesn't. Fall back to a CSS or text selector only when no accessible role, label, or text distinguishes the element.
- Wait on a **state** — `wait <selector>`, `wait --text "<text>"`, `wait --load networkidle` — never a bare `wait <ms>` alone, before shooting. A short `wait <ms>` (100–200ms) is fine as a settle pause *after* a state wait, not instead of one.
- Every capture that matters gets its own `screenshot` call with a label baked into the path (`-closed`, `-open`) — an unlabelled capture only tells you it ran, not which moment it caught.
- Leave the page in a state the next viewport's run can start fresh from — each viewport gets its own `--session <name> batch` call and its own browser, so nothing carries over between them.

For a video instead of stills: start `record start <path>.webm` right after the page settles (after the `wait --load` step), run the interaction commands with a short `wait 200` before and after each one so the result is watchable, then `record stop` — no separate `screenshot` calls are needed inside a video run.

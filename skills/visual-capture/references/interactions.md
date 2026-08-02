# Interaction captures

A steps file drives the page after load. Write it to the scratchpad — never into the project — and pass it with `--steps`.

It default-exports an async function receiving `{ page, capture, viewport }`:

- `page` — the Playwright [`Page`](https://playwright.dev/docs/api/class-page).
- `capture(label?)` — screenshot at this moment. Labels become the filename suffix (`settings-desktop-menu-open.png`). Unlabelled shots number themselves.
- `viewport` — `{ name, width, height, isMobile, hasTouch, deviceScaleFactor }`, so one file can branch per viewport.

```js
export default async function ({ page, capture, viewport }) {
  await capture("closed");

  if (viewport.isMobile) await page.getByRole("button", { name: "Menu" }).tap();
  else await page.getByRole("button", { name: "Menu" }).click();

  await page.getByRole("menu").waitFor();
  await capture("open");
}
```

With `--steps` and no `--video`, only the moments you call `capture()` are written — call it at least once. With `--video`, the whole run is recorded to an `.mp4` and any `capture()` calls are written alongside it.

Rules that keep a run reproducible:

- Reach for elements by role, label, or text — the same selectors survive the next refactor.
- Wait on a **state** (`waitFor`, `toBeVisible`), never a bare timeout, before shooting.
- Leave the page in a state the next viewport can start from, or reset it — each viewport gets a fresh context, so this only matters within one steps file.
- Slow a video down with `page.waitForTimeout` between actions; a 200 ms pause before and after each interaction makes the result watchable.

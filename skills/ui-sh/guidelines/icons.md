# Icons

Covers: SVG icons, Heroicons, inline checkmarks, icon buttons, icon sizing, and icon alignment with text.

## Design Rules

- Never generate raw SVG icons — import from the project's existing icon library, or use Heroicons if no library is established
- Never wrap icons in decorative containers (colored squares, circles with backgrounds) — use the icon directly
- Never scale icons — `viewBox="0 0 24 24"` always uses `size-6`, `viewBox="0 0 20 20"` uses `size-5`, `viewBox="0 0 16 16"` uses `size-4`; if the icon looks too small, use a different icon set, don't increase the size class
- Always use 16px/micro icons (`size-4`) when inline with `text-sm` text — checklists, feature items, comparison tables, inline labels; only use 20px/mini icons (`size-5`) for navigation list icons
- Icons next to a text group (label + supporting text) — align the icon with the first line/label using `items-start` or `items-baseline`, never `items-center` on the group
- Application UIs (dashboards, settings, admin, sidebar nav, forms) — only use Heroicons Micro (16px, `size-4`); never use 20px/mini or 24px/outline icons in application UIs

## Coding Rules

- Use `size-{n} h-lh` on SVG icons to vertically center them with adjacent text; set the `font-size` on a wrapper element instead of using top margins or manual alignment
- Use `currentColor` and set color via `text-{color}` — one SVG asset, recolored per state (hover, selected, disabled) from CSS color alone, not separate `fill-{color}`/`stroke-{color}` variants per state (see `better`'s `ui.md` principle 14, if installed)
- Always add `shrink-0` to icons inside flex containers

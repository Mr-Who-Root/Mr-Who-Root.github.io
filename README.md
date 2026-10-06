# me

A single-page "Cyber-Sentry" HUD portfolio — near-black background, neon cyan/crimson/yellow
accents, angular notched panels, scanline and grid overlays, a boot sequence, a custom
crosshair cursor, and scroll-triggered reveals.

Sections: Hero → About → Skills → Field Ops (projects) → Service Record (experience +
education) → Credentials (certifications) → Secure Channel (contact).

## How it works

Pure static site — `index.html` + `style.css` + `app.js`, no build step, no framework.
`app.js` fetches `data.json` at runtime and renders every section from it, so **editing
`data.json` and pushing is enough to update the live site** — no rebuild required.

Content mapping from `data.json`:

| `data.json`      | Where it appears                                            |
| ---------------- | ----------------------------------------------------------- |
| `personalInfo`   | hero name/chip/tagline, ID panel, About, Contact (`phone` is never shown) |
| `experience`     | Service Record timeline (`// DEPLOYMENT`); consecutive roles at the same company are grouped as promotions, `"Present"` marks the current role |
| `education`      | Service Record timeline (`// TRAINING`), ID panel org badge  |
| `skills`         | Combat Skills tag groups                                     |
| `projects`       | Field Ops cards + filter bar (SECURITY / AI / MOBILE tags are inferred from each project's text and technologies) |
| `customSections` | Credentials cards sorted newest first (hackathons/awards show as achievements), and the hero ID badge |

The hero ID panel never shows a photo (`personalInfo.photo` is ignored): it shows a radar
with one blip per project and a typed readout cycling through focus areas (`FOCUS` in `app.js`).

### Interaction details

- **Custom cursor** — a crosshair reticle that trails the pointer, expands on hover, and
  shows a readout label. Set per element with `data-cursor="LABEL"`. Automatically disabled
  for touch devices (`pointer: fine`) and for `prefers-reduced-motion`.
- **Accessibility** — `prefers-reduced-motion` skips the boot sequence, the name glitch, the
  radar sweep, and reveal animations. If `IntersectionObserver` is missing or JS fails, all
  content falls back to visible rather than staying blank.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

(`file://` won't work — browsers block `fetch()` of local files. Any static server is fine.)

## Deploy to GitHub Pages

1. Push to GitHub — the root already has `index.html` and `.nojekyll`, so no build step.
2. **Settings → Pages → Build and deployment → Source → Deploy from a branch**.
3. Branch `main`, folder `/ (root)`. Save.

To update content later, edit `data.json` and push — Pages serves it immediately.

**When you change `app.js` or `style.css`, bump the `?v=` number on both in `index.html`.**
Pages tells browsers to cache files for 10 minutes; without the bump a visitor can get the new
`index.html` with their cached old `app.js`, which breaks the page until the cache expires.

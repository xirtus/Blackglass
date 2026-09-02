# BLACKGLASS // HYDRA — Game Design Microsite

A static multi-page HTML design bible for the information-containment strategy game.

## Open locally
Open `index.html` directly, or serve the folder with any static server.

## Deploy
- GitHub Pages: publish this folder/repository root.
- Netlify: drag/drop the folder or connect the repository (`netlify.toml` included).
- Vercel: deploy as a static project (`vercel.json` included).
- Any nginx/Apache/static host: copy the folder unchanged.

No JavaScript build step is required. The only optional external dependency is the Charts.css CDN stylesheet; `assets/site.css` contains fallback chart styling so the plan remains readable if the CDN is unavailable.

## Key files
- `index.html` — main command index
- `01-vision.html` … `17-references.html` — design pages
- `all-in-one.html` — printable/searchable consolidated spec
- `16-prompt.html` — full coding-agent build prompt
- `assets/site.css`, `assets/site.js` — shared presentation

## Working-title note
BLACKGLASS // HYDRA is used as a fictional working title. The game plan recommends fictionalizing private locations, synthetic surveillance data, and abstracting harmful real-world procedures.

## Revision 1.1 — Dual perspective
The same deterministic scenario is now designed to be playable as either **BLACKGLASS // Containment** or **HYDRA // Disclosure**. See `18-leaker-network.html`. The master build prompt and relevant simulation/campaign/UI/QA pages require strict hidden-information boundaries and a bounded BLACKGLASS AI opponent when playing HYDRA.

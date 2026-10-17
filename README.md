# Nirvana (POC)

A calm new tab your agents run, plus a reading sidebar. Agents write to the new tab with the `tab` CLI. Today's reading lives in Chrome's side panel: toggle it with the "Today's reading" button on the new tab, the toolbar button, or ⌥⇧N, and it stays put while you switch tabs. Opened as a plain web page (http://127.0.0.1:7777, any browser), the same button slides the reading in as a drawer. Your clicks (dismiss, tick, open) flow back so agents can tidy it.

```
tab serve &          # local server on 127.0.0.1:7777 (state in ~/.nirvana)
tab demo             # sample widgets
tab help
```

**Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `extension/`.
Then click the toolbar button (pin it) or press ⌥⇧N to toggle. Change the shortcut at `chrome://extensions/shortcuts`.
**Without the extension:** open http://127.0.0.1:7777.

- `bin/tab.mjs` — CLI agents call (`pin`, `set`, `brief`, `notice`, `layout`, `read`, `events`, …)
- `lib/server.mjs` — state file → live updates (SSE); serves sandboxed HTML widgets at `/w/:id`
- `extension/` — MV3: `newtab.html` (greeting, search, AI shortcuts, agents' lines) and `feed.html` (side panel, headlines only); one shared `app.js`/`app.css`; `background.js` toggles the panel. Paints from cache, animates only what changed; sky follows time of day
- `lib/news.mjs` — Today's reading: RSS/Atom presets per topic (tech, ai, science, design, business, world, sports) + custom feeds, refreshed once a day, interleaved so no source dominates
- `skill/SKILL.md` — teaches agents the rules (calm, ≤6 widgets, use `--ttl`, read `events`)

Security: only the extension or the local page can read state (other origins get 403). Agent HTML runs in an opaque-origin sandbox and can't reach the page, cookies or tabs. Search always goes through the user's own search engine (`chrome.search`).

Next: swap the local server for byagent (token + API), so agents anywhere can write to your tab.

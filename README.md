# Nirvana (POC)

A calm new tab your agents run. Agents write to it with the `tab` CLI; you see it every time you open a tab. Your clicks (dismiss, tick, open) flow back so agents can tidy it.

```
tab serve &          # local server on 127.0.0.1:7777 (state in ~/.nirvana)
tab demo             # sample widgets
tab help
```

**Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `extension/`.
**Without the extension:** open http://127.0.0.1:7777 (or set it as your homepage).

- `bin/tab.mjs` — CLI agents call (`pin`, `set`, `brief`, `notice`, `layout`, `read`, `events`, …)
- `lib/server.mjs` — state file → live updates (SSE); serves sandboxed HTML widgets at `/w/:id`
- `extension/` — MV3 new tab; sky follows time of day (dawn, day, dusk, night)
- `skill/SKILL.md` — teaches agents the rules (calm, ≤6 widgets, use `--ttl`, read `events`)

Security: only the extension or the local page can read state (other origins get 403). Agent HTML runs in an opaque-origin sandbox and can't reach the page, cookies or tabs. Search always goes through the user's own search engine (`chrome.search`).

Next: swap the local server for byagent (token + API), so agents anywhere can write to your tab.

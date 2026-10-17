# Nirvana (POC)

A calm new tab your agents run, plus a reading sidebar. Agents write to the new tab with the `tab` CLI. Today's reading lives in Chrome's side panel: toggle it with the "Today's reading" button on the new tab, the toolbar button, or ⌥⇧N, and it stays put while you switch tabs. Opened as a plain web page (http://127.0.0.1:7777, any browser), the same button slides the reading in as a drawer. Your clicks (dismiss, tick, open) flow back so agents can tidy it.

## Setup

You need Node 20+ and Chrome (or any browser, as a plain page).

1. **Get the code and the `tab` command**
   ```
   git clone <this repo> ~/nirvana && cd ~/nirvana
   npm link            # puts `tab` on your PATH (or: ln -s "$PWD/bin/tab.mjs" ~/.local/bin/tab)
   ```
2. **Load the extension:** open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the `extension/` folder. Pin the toolbar button if you like (⌥⇧N toggles Today's reading).
3. **Open a new tab.** You'll see "Let your agent set up this tab" with a prompt and a **Copy** button.
4. **Paste the prompt into your agent** in the terminal (Claude Code, Codex, Gemini CLI, OpenCode, anything that can run commands). It runs `tab onboard`, which has it:
   - keep the server running (`tab autostart on`, a launchd job on macOS)
   - ask you what the tab should keep an eye on, how often to refresh, which parts to show (usage, weather, AI shortcuts, reading, the agent hint), your reading topics and the look
   - apply your answers, then create a **routine**: your agent, run headless on a schedule (`claude -p`, `codex exec`, …), that refreshes the tab
   - do the first refresh and hide the setup card

Prefer to do it by hand? Click "I'll do it myself", then:
```
tab autostart on                                   # or: tab serve &
tab weather "Dubai"                                # tab show usage|weather|ask|sites|reading|hint on|off
tab show sites on                                  # your most visited sites under the AI shortcuts (or a fixed list: tab sites '[…]')
tab news topics tech ai
tab theme photo                                    # sky | scene | photo
tab routine set --every 2h --hours 8-22 --agent claude --brief "Open PRs, CI on main, my next trip"
tab routine run                                    # once now; log in ~/.nirvana/routine.log
```
Change anything later by asking your agent ("hide the weather", "refresh every hour"), or with the same commands. `tab routine off` and `tab autostart off` remove the background jobs.

**Without the extension:** run the server and open http://127.0.0.1:7777. Same page; Today's reading opens as a drawer.

## How it works

- `bin/tab.mjs` — CLI agents call (`pin`, `set`, `brief`, `notice`, `layout`, `read`, `events`, …)
- `lib/server.mjs` — state file → live updates (SSE); serves sandboxed HTML widgets at `/w/:id`
- `extension/` — MV3: `newtab.html` (greeting, search, AI shortcuts, agents' lines) and `feed.html` (side panel, headlines only); one shared `app.js`/`app.css`; `background.js` toggles the panel. Paints from cache, animates only what changed; sky follows time of day
- `lib/news.mjs` — Today's reading: RSS/Atom presets per topic (tech, ai, science, design, business, world, sports) + custom feeds, refreshed once a day, interleaved so no source dominates
- `lib/usage.mjs` — the usage pill at the top left: how much of each Claude Code and Codex rate-limit window (5 hours, week) you've used. Read-only, from each tool's own login (Claude Code's keychain entry, `~/.codex`) or Codex's session logs; polled every 5 minutes, only while a new tab is open. Hover for reset times
- `lib/onboard.mjs` — `tab onboard` (the setup interview agents follow) and `tab routine prompt` (what each scheduled run follows)
- `lib/routine.mjs` — background jobs: `tab autostart` (server at login) and `tab routine` (your agent on a schedule, with quiet hours). launchd on macOS; prints a crontab line elsewhere
- `lib/weather.mjs` — weather beside the time (Open-Meteo, no key), every 30 minutes while a tab is open
- `skill/SKILL.md` — teaches agents the rules (calm, ≤6 widgets, use `--ttl`, read `events`)

Security: only the extension or the local page can read state (other origins get 403). Agent HTML runs in an opaque-origin sandbox and can't reach the page, cookies or tabs. Search always goes through the user's own search engine (`chrome.search`).

Next: swap the local server for byagent (token + API), so agents anywhere can write to your tab.

## Looks

`tab theme sky` (default) is the soft drifting gradient. `tab theme scene` swaps it for a blurred landscape that follows the time of day (dawn, day, dusk, night), with light text and the agents' lines on one glass card. The scenes are 96px Unsplash thumbnails via picsum.photos (Unsplash license), ~2 KB each, blurred up in CSS. `tab theme photo` shows the same four photos sharp and full size (2400px, ~200 to 650 KB each, in `extension/photos/`), with the agents' lines straight on the picture and the AI shortcuts hidden until you type.

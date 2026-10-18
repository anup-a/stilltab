# Chrome Web Store listing

## Name (from manifest, 41/75)
Stilltab: New Tab Dashboard for AI Agents

## Summary (from manifest, 120/132)
Your AI agents keep one calm new tab current: what needs you, what's coming up, plan usage, weather and today's reading.

## Category
Productivity (Workflow & Planning)

## Language
English

## Description

Stilltab works with Claude Code, Codex or any command line agent. Your agent decides what matters most right now and keeps the page tidy, on a schedule you choose.

🌅 Calm by default
• A beautiful photo that follows the time of day: dawn, day, dusk and night
• A different dawn and dusk photo every day
• Switch to a soft gradient sky in one click
• At most six short lines. Done things leave on their own

🤖 Run by your agents
• Needs you, Coming up, Lately: one line each, with a short number like "3 open" or "12 days"
• A one-line brief from your agent about what matters most today
• Click any line for details. Tick, dismiss or reorder, and your agent adapts on its next run
• A routine: your agent refreshes the tab every few hours, headless, in quiet hours you set

📊 Plan usage at a glance
• Session and weekly usage for Claude Code and Codex
• Exactly when each limit renews

🔎 Everything else you open a tab for
• Search with your own search engine
• One-click shortcuts to ask your favorite AI chat app
• Your most visited sites, if you want them
• Weather next to the time
• Today's reading: headlines from topics and feeds you pick, in Chrome's side panel

⚡ Set up in one paste
1. Install the free, open source tab command: npm i -g github:anup-a/stilltab
2. Open a new tab and copy the prompt it shows
3. Paste it into your agent. It asks a few questions and sets everything up

🔒 Private by design
Everything lives in a file on your own computer and is served from 127.0.0.1. No accounts, no analytics, no servers of ours.

Setup guide and source: https://github.com/anup-a/stilltab
Privacy policy: https://anup-a.github.io/stilltab/privacy.html

## Single purpose
Replaces the new tab page with a calm dashboard that the user's own AI agents keep up to date, showing what needs the user's attention, upcoming items, plan usage, weather and a reading list.

## Permission justifications

- **sidePanel**: Today's reading (the headline list) opens in Chrome's side panel from the toolbar button or the new tab, so it stays open while the user switches tabs.
- **search**: The search box on the new tab sends the query to the user's default search engine through chrome.search, as Chrome's own new tab does, instead of hard-coding a search provider.
- **topSites**: Optional "frequently visited" row under search, off by default. When the user turns it on, the new tab reads Chrome's most visited sites to show them as shortcuts. Nothing is stored or sent.
- **Host permission http://127.0.0.1:7777/\***: The new tab's content comes from a small server the user runs on their own machine (the open source `tab` CLI). The extension reads the page state from it and reports clicks and dismissals back to it. It only reaches localhost.

## Remote code
No. All JavaScript is packaged in the extension. The page loads site icons (images) from Google's favicon service and data (JSON) from the local server only.

## Data usage (privacy practices tab)
- Collected: none. (Check nothing.)
- Certify: not sold to third parties; not used for purposes unrelated to the single purpose; not used for creditworthiness or lending.

## Assets
- Icon: extension/icons/icon128.png (96px art, 16px padding)
- Screenshots (1280x800): store/1-hero.jpg, 2-lines.jpg, 3-usage.jpg, 4-reading.jpg, 5-setup.jpg
- Small promo tile (440x280): store/promo-440x280.jpg; marquee (1400x560): store/marquee-1400x560.jpg
- Upload: store/stilltab-0.1.1.zip (contents of extension/)
- Promo video (removed from the listing on 2026-10-18: the YouTube thumbnail looked low quality): 4K60 master /Users/owl/code/videos/stilltab-onetake/film.mp4 (15s, with sound); 1080p60 web copy film-1080p60.mp4 (https://yf6yczb3tgbjmvqq.byagent.dev/). The store takes a YouTube URL only: upload the 4K master (unlisted) after Anup confirms, then paste the link.

## Links
- Homepage: https://anup-a.github.io/stilltab/
- Support: https://github.com/anup-a/stilltab/issues
- Privacy policy: https://anup-a.github.io/stilltab/privacy.html

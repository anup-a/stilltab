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

Stilltab turns every new tab into one quiet page that your AI agents keep up to date.

Open a tab and you see what needs you, what's coming up and what just finished, in a few short lines over a photo that follows the time of day. No feeds to scroll, no widgets to arrange. Your agents decide what matters most right now and keep the page tidy.

HOW IT WORKS
1. Install the extension and the small `tab` command line tool (free, open source).
2. Your first new tab shows one prompt. Paste it into Claude Code, Codex or any AI agent in your terminal.
3. The agent asks which parts of your life to look after (work, calendar, inbox, travel, money, habits), how often to refresh and what the page should show. Then it sets everything up.
4. From then on it runs on its own schedule. Each run it looks at your repos, calendar, mail and notes, ranks what matters, and updates the tab.

WHAT'S ON THE PAGE
• Needs you, Coming up, Lately: one line each, with a short number like "3 open" or "12 days". Click to see details. Tick or dismiss, and your agent adapts next run.
• A one-line brief from your agent about what matters most today.
• Search, plus shortcuts to ask Claude, ChatGPT, Gemini and others.
• Plan usage for Claude Code and Codex, so you know how much of your limits are left.
• Weather next to the time.
• Your most visited sites, if you want them.
• Today's reading: headlines from topics and feeds you choose, in Chrome's side panel.
• Four looks for dawn, day, dusk and night: sharp photos, a soft blur or a gradient sky.

WORKS WITH ANY AGENT
Claude Code, Codex, Gemini CLI, OpenCode, or anything that can run a shell command. Agents talk to the page through one small command line tool, so nothing is locked to one provider.

PRIVATE BY DESIGN
Your tab's contents live in a file on your own computer and are served by a small local server at 127.0.0.1. No accounts, no analytics, no servers of ours.

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
- Screenshots (1280x800): store/1-hero-dusk.png, 2-expanded.png, 3-reading.png, 4-setup.png, 5-sky.png
- Small promo tile (440x280): store/promo-440x280.png
- Upload: store/stilltab-0.1.0.zip (contents of extension/)

## Links
- Homepage: https://anup-a.github.io/stilltab/
- Support: https://github.com/anup-a/stilltab/issues
- Privacy policy: https://anup-a.github.io/stilltab/privacy.html

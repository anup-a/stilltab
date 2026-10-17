// What agents read. `tab onboard` sets the tab up with the user; `tab routine prompt` is what the
// scheduled run follows each time. Both are plain text so any agent can use them.

import { PRESETS } from './routine.mjs'
import { TOPICS } from './news.mjs'

export const MODULES = {
  usage: 'Claude Code / Codex plan usage, top left',
  weather: 'temperature and sky next to the time (needs `tab weather <city>`)',
  ask: 'AI shortcuts under search (Claude, ChatGPT, …)',
  sites: 'frequently visited sites under search, off by default (Chrome\'s top sites, or a fixed list: tab sites)',
  reading: "the Today's reading button (headlines side panel)",
  hint: 'the "Ask your agent" example, bottom right',
}

export const ONBOARD = `# Set up the user's Nirvana new tab

You are setting up Nirvana: the page the user sees on every new browser tab. You control it with the
\`tab\` CLI. Work through the steps below. Keep the conversation short and friendly, and offer a
default for every question so the user can just say "yes".

## 1. Make sure it runs
- \`tab read\` should print JSON. If the server isn't up, run \`tab autostart on\` (macOS: starts at
  login and stays running). Elsewhere, start \`tab serve\` and tell the user how to keep it running.
- If the user has a browser tab open on the new tab, it updates live as you go.

## 2. Ask the user (all in one message, numbered, defaults in brackets)
1. **What should the tab keep an eye on?** Examples: open PRs and reviews, CI, deploys, calendar
   and deadlines, a trip countdown, inbox items waiting on them, anything you can check with your
   tools. [suggest 2-3 based on what you know about them and their machine]
2. **How often should I refresh it?** every 1h, 2h, 4h, or once each morning; and quiet hours.
   [every 2h, 8 to 22]
3. **What should the page show?** Each can be on or off:
${Object.entries(MODULES).map(([k, v]) => `   - ${k}: ${v}`).join('\n')}
   [usage on if they use Claude Code or Codex, weather on if they give a city, sites off, the rest on]
4. **Today's reading:** topics from ${Object.keys(TOPICS).join(', ')}, plus any RSS feeds. [tech, ai]
5. **Look:** sky (soft gradient), scene (blurred landscape) or photo (sharp landscape), all
   following the time of day. [photo]

## 3. Apply their answers
\`\`\`
tab show usage on|off            # same for weather, ask, reading, hint
tab weather "Dubai" [--unit f]   # or: tab weather off
tab news topics tech ai
tab news add <rss-url> --name Name
tab theme photo                  # sky | scene | photo
tab ai '[{"name":"Claude","url":"https://claude.ai/new?q=%s"}]'   # only if they want different shortcuts
tab sites '[{"name":"GitHub","url":"https://github.com"}]'        # fixed sites instead of Chrome's most visited
\`\`\`

## 4. Create the routine (so the tab stays current without them asking)
Save what they want tracked, in their words, plus how often:
\`\`\`
tab routine set --every 2h --hours 8-22 --agent <you> --brief "Open PRs on anup-a/*, CI on main, my next trip"
\`\`\`
\`--agent\` presets: ${Object.keys(PRESETS).join(', ')} (each runs your headless mode, e.g. \`claude -p\`).
Another agent: \`--cmd '<your headless command> "$(tab routine prompt)"'\`.
If you have your own scheduler (cron jobs, scheduled tasks, heartbeats), you may use that instead:
schedule a run of \`tab routine prompt\` and still save the brief with \`tab routine set --brief … --external\`.
Check the headless command works before relying on it (run it once in the terminal).

## 5. First refresh, then finish
- Do the first refresh yourself now: follow \`tab routine prompt\`.
- Run \`tab setup done\` (this hides the setup card on the new tab).
- Tell the user in two or three lines what's on the tab, how often it refreshes, and that they can
  ask you to change anything ("hide the weather", "refresh every hour") at any time.

Rules: never post, email or message anyone while doing this. Ask before installing software.
`

export function routinePrompt(routine = {}) {
  return `You keep the user's Nirvana new tab current. This is a scheduled, unattended run: don't ask
questions, don't message anyone, don't publish or change anything outside the tab. Finish in a few minutes.

What the user wants on their tab, in their words:
${routine.brief || '(no brief saved yet: show what is waiting on them and what is coming up)'}

Steps:
1. \`tab read\` (what's there) and \`tab events --since ${routine.lastRun || '<last run>'}\` (what they dismissed,
   ticked or opened since last time; never re-pin something they dismissed).
2. Check what the brief asks for with your tools (gh, calendars, files, the web…).
3. Update the tab:
   - \`tab pin <stable-id> --title "…" --stat "4 open" --section needs|soon|lately --source <you>\`
     (or --items '[{"text":"…","url":"…"}]' for a list, --md for a note, --link for one link)
   - \`tab set <id> --data '{"value":"5 open"}'\` to update; \`tab unpin <id>\` when no longer true.
   - At most 6 lines. One line per topic. \`--ttl\` on anything temporary.
   - \`tab brief "…"\`: one line to the user, under 90 characters, about what matters most now.
   - \`tab notice "…" --level warn\` only for something urgent that waits on them; clear it when resolved.
4. \`tab routine done\` to record the run.
`
}

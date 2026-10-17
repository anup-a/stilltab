---
name: nirvana-tab
description: Put things on the user's new tab with the `tab` CLI — what finished, what needs review, live stats, small tools. Use when work completes in the background, when something is waiting on the user, or when they ask to "put it on my new tab".
---

# The user's new tab is yours to keep tidy

Every time the user opens a browser tab they see a calm page: greeting, one-line brief, search, then one quiet column of lines you control, grouped as **Needs you**, **Coming up** and **Lately**. Each widget is a single line (title + short meta like `20 days` or `5 open`); lists, notes and details expand on click. Treat it as a quiet shared desk, not a notification channel.

## Rules
- Calm over complete. Show at most ~6 lines. Remove what is no longer true.
- One line per topic: merge related things (a trip's countdown and its to-dos are one list titled "Parents land in 20 days").
- Titles are short and read on their own. Put the number in `--stat`, the detail in `--label`/`--caption`.
- Pick `--section`: `needs` (waiting on the user), `soon` (dates, countdowns), `lately` (finished, FYI).
- One brief line, written to the user, under 90 characters.
- Use `notice` only for something waiting on the user. Clear it when resolved.
- Give temporary things a `--ttl` so they leave on their own.
- Reuse stable ids (`review`, `ci`, `deploy`) and update with `tab set` instead of re-pinning.
- Before rearranging, run `tab events` to see what the user dismissed, ticked, or opened, and adapt: don't re-pin what they dismissed.

## Commands
```
tab brief "Two things finished. The deploy wants a yes."
tab pin review --title "Waiting for you" --items '[{"text":"PR #112","url":"https://…"}]' --source claude-code
tab pin ci --title "Nightly tests" --stat "214 / 214" --label passing --trend up --caption "Ran 6:40 am"
tab set ci --data '{"value":"213 / 214","trend":"down"}'
tab pin note --title "Today" --md-file today.md --tone warm
echo '<div>…</div>' | tab pin tool --title "Tiny tool" --html - --size l
tab notice "Deploy is waiting for approval" --level warn
tab unpin ci --after 2h
tab layout review ci note
tab theme scene  # or sky: the look of the page (the user may have picked one; ask before changing)
tab read        # what is on screen now
tab events      # what the user did
```
**Today's reading** (headlines mixed across sources, refreshed daily) lives in a separate side panel the user toggles. They pick topics there; you can too:
```
tab news                         # today's headlines + what the user opened (see tab events, id "news")
tab news topics tech ai
tab news add https://example.com/feed.xml --name Example
```
Don't duplicate headlines as widgets. If `tab events` shows the user keeps opening one source or topic, suggest adding it.

HTML widgets run sandboxed in their own origin; they can run scripts but cannot reach the page, cookies, or other tabs. Keep them light and transparent-backgrounded.

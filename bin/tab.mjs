#!/usr/bin/env node
import fs from 'node:fs'
import { PORT, STATE_FILE, duration, event, load, prune, update } from '../lib/state.mjs'

const HELP = `tab: a new tab your agents run

  tab serve [--port 7777]                 start the local server the new tab reads
  tab brief "text" | --clear              one calm line under the greeting
  tab ai '[{"name":"Claude","url":"https://claude.ai/new?q=%s"}]' | --reset
                                          AI shortcuts under search (%s = typed question)
  tab pin <id> [content] [options]        add or replace a widget
      content (pick one):
        --md "text" | --md-file f.md      markdown note
        --text "text"                     plain note
        --html-file f.html | --html "…"   agent-made HTML, sandboxed
        --stat "92%" [--label L] [--trend up|down|flat] [--caption C]
        --items '[{"text":"…","url":"…"}]' checklist the user can tick
        --link https://… [--caption C]    a single link card
      options:
        --title T  --section needs|soon|lately  --ttl 2h  --source agent-name
      each widget shows as one line; lists, notes and details expand on click.
      default section: list → needs, stat/link → soon, everything else → lately
  tab set <id> --data '{"value":"94%"}'   merge fields into a widget (live update)
  tab unpin <id> [--after 2h]             remove now or later
  tab notice "text" [--level info|done|warn] [--ttl 1h] | --clear
  tab layout <id> <id> …                  set widget order (unlisted ones follow)
  tab read                                current state as JSON (what the user sees)
  tab events [--since ISO] [--clear]      what the user did: dismiss, check, open, reorder
  tab clear                               remove everything
  tab demo                                fill the tab with sample widgets

  Any value of "-" is read from stdin.  State: ${STATE_FILE}
`

const [cmd, ...rest] = process.argv.slice(2)
const { pos, flags } = parse(rest)

async function run() {
  switch (cmd) {
    case 'serve': {
      const { serve } = await import('../lib/server.mjs')
      return serve(Number(flags.port || PORT))
    }
    case 'brief':
      update((s) => { s.brief = flags.clear ? null : need(pos[0], 'brief text') })
      return ok()
    case 'ai': {
      const list = flags.reset ? null : JSON.parse(need(pos[0], 'AI list JSON'))
      if (list && !list.every((a) => a.name && /^https:\/\//.test(a.url))) throw new Error('Each AI needs a name and an https url')
      update((s) => { s.ai = list })
      return ok()
    }
    case 'pin': {
      const id = slug(need(pos[0], 'widget id'))
      const w = widgetFromFlags(id)
      update((s) => { s.widgets[id] = w })
      return ok(id)
    }
    case 'set': {
      const id = need(pos[0], 'widget id')
      const data = JSON.parse(need(flags.data, '--data JSON'))
      update((s) => {
        if (!s.widgets[id]) throw new Error(`No widget "${id}"`)
        Object.assign(s.widgets[id], data, { updatedAt: now() })
      })
      return ok(id)
    }
    case 'unpin': {
      const id = need(pos[0], 'widget id')
      update((s) => {
        if (!s.widgets[id]) throw new Error(`No widget "${id}"`)
        if (flags.after) s.widgets[id].expiresAt = later(flags.after)
        else delete s.widgets[id]
      })
      return ok(id)
    }
    case 'notice':
      update((s) => {
        s.notice = flags.clear ? null : { text: need(pos[0], 'notice text'), level: flags.level || 'info', at: now(), expiresAt: flags.ttl ? later(flags.ttl) : null }
      })
      return ok()
    case 'layout':
      update((s) => { s.order = [...pos, ...s.order.filter((id) => !pos.includes(id))] })
      return ok()
    case 'read': {
      const s = load(); prune(s)
      const { events, ...visible } = s
      return print(visible)
    }
    case 'events': {
      if (flags.clear) { update((s) => { s.events = [] }); return ok() }
      const since = flags.since ? Date.parse(flags.since) : 0
      return print(load().events.filter((e) => Date.parse(e.at) > since))
    }
    case 'clear':
      update((s) => { s.brief = null; s.notice = null; s.widgets = {}; s.order = [] })
      return ok()
    case 'demo':
      return demo()
    case undefined: case 'help': case '--help': case '-h':
      return process.stdout.write(HELP)
    default:
      throw new Error(`Unknown command "${cmd}". Run "tab help".`)
  }
}

function widgetFromFlags(id) {
  const base = {
    id,
    title: flags.title ?? null,
    section: flags.section ?? null,
    size: flags.size || 'm',
    tone: flags.tone || 'calm',
    source: flags.source || process.env.NIRVANA_AGENT || null,
    updatedAt: now(),
    expiresAt: flags.ttl ? later(flags.ttl) : null,
  }
  if (flags['md-file']) return { ...base, kind: 'md', md: fs.readFileSync(flags['md-file'], 'utf8') }
  if (flags.md) return { ...base, kind: 'md', md: val(flags.md) }
  if (flags.text) return { ...base, kind: 'text', text: val(flags.text) }
  if (flags['html-file']) return { ...base, kind: 'html', html: fs.readFileSync(flags['html-file'], 'utf8') }
  if (flags.html) return { ...base, kind: 'html', html: val(flags.html) }
  if (flags.stat) return { ...base, kind: 'stat', value: val(flags.stat), label: flags.label ?? null, trend: flags.trend ?? null, caption: flags.caption ?? null }
  if (flags.items) return { ...base, kind: 'list', items: JSON.parse(val(flags.items)).map((i) => (typeof i === 'string' ? { text: i } : i)) }
  if (flags.link) return { ...base, kind: 'link', url: val(flags.link), caption: flags.caption ?? null }
  throw new Error('Give content: --md, --text, --html(-file), --stat, --items or --link')
}

function demo() {
  update((s) => {
    s.brief = 'Three things finished while you were away. One wants a look.'
    s.notice = { text: 'Deploy of byagent-web is waiting for your approval.', level: 'warn', at: now(), expiresAt: null }
    s.widgets = {}
    const add = (w) => { s.widgets[w.id] = { size: 'm', tone: 'calm', updatedAt: now(), expiresAt: null, source: null, title: null, ...w } }
    add({ id: 'review', kind: 'list', title: 'Waiting for you', source: 'claude-code', items: [
      { text: 'PR #112 · tab CLI: add --ttl', url: 'https://github.com' },
      { text: 'Report: AI new tab market scan', url: 'https://byagent.dev' },
      { text: 'Copy draft for the launch post' },
    ] })
    add({ id: 'ci', kind: 'stat', title: 'Nightly tests', value: '214 / 214', label: 'passing', trend: 'up', caption: 'Ran 6:40 am · 3m 12s', source: 'codex', tone: 'cool' })
    add({ id: 'focus', kind: 'md', title: 'Today, gently', source: 'chief-of-staff', size: 'm', tone: 'warm', md:
      '1. Review the market scan\n2. Approve the deploy\n3. **Walk at 5**\n\n_Nothing else is urgent._' })
    add({ id: 'breath', kind: 'html', title: 'Breathe', size: 'm', source: 'claude-code', tone: 'calm', html:
      `<style>.c{display:grid;place-items:center;height:150px}.o{width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#c9bdf0 60%,#a99be0);box-shadow:0 0 40px #c9bdf080;animation:b 8s ease-in-out infinite}@keyframes b{0%,100%{transform:scale(.8)}50%{transform:scale(1.25)}}.t{margin-top:14px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.55}@media (prefers-reduced-motion:reduce){.o{animation:none}}</style><div class="c"><div style="text-align:center"><div class="o"></div><div class="t" id="t">breathe in</div></div></div><script>let i=0;setInterval(()=>{i^=1;document.getElementById('t').textContent=i?'breathe out':'breathe in'},4000)</script>` })
    add({ id: 'watch', kind: 'link', title: 'Watching', url: 'https://byagent.dev', caption: 'byagent.dev is up · checked 2 min ago', source: 'watcher', tone: 'cool', size: 's' })
    s.order = ['review', 'ci', 'focus', 'breath', 'watch']
    event(s, 'demo')
  })
  return ok('demo')
}

// --- helpers -------------------------------------------------------------

function parse(args) {
  const pos = [], flags = {}
  const bool = new Set(['clear', 'json', 'reset'])
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split(/=(.*)/s)
      if (inline !== undefined) flags[k] = inline
      else if (bool.has(k) || i + 1 >= args.length) flags[k] = true
      else flags[k] = args[++i]
    } else pos.push(a)
  }
  return { pos, flags }
}

let stdinCache
function val(v) {
  if (v !== '-') return v
  stdinCache ??= fs.readFileSync(0, 'utf8')
  return stdinCache
}
function need(v, what) {
  if (v === undefined || v === true || v === '') throw new Error(`Missing ${what}`)
  return val(v)
}
const slug = (s) => String(s).toLowerCase().replace(/[^\w.-]+/g, '-').slice(0, 64)
const now = () => new Date().toISOString()
const later = (d) => new Date(Date.now() + duration(d)).toISOString()
const print = (x) => process.stdout.write(JSON.stringify(x, null, 2) + '\n')
const ok = (id) => process.stdout.write(id ? `ok ${id}\n` : 'ok\n')

try {
  await run()
} catch (e) {
  console.error(`tab: ${e.message}`)
  process.exit(1)
}

// Nirvana new tab: renders whatever the agents put in state, live.

const API = location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:7777'
const $ = (id) => document.getElementById(id)
const column = $('column')
const rows = new Map() // id -> { el, sig }
const openIds = new Set()
let firstPaint = true

// --- sky + greeting ------------------------------------------------------

function phase(h) {
  if (h >= 5 && h < 10) return 'dawn'
  if (h >= 10 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'dusk'
  return 'night'
}
const dark = matchMedia('(prefers-color-scheme: dark)')

function tick() {
  const d = new Date()
  const h = d.getHours()
  const p = phase(h)
  document.body.dataset.phase = p === 'night' ? 'dusk' : p
  document.body.dataset.theme = p === 'night' || dark.matches ? 'dark' : 'light'
  $('time').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  $('greet').textContent = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night'
}
tick()
setInterval(tick, 10e3)
dark.addEventListener('change', tick)

// --- search: always the user's own search engine -------------------------

$('search').addEventListener('submit', (e) => {
  e.preventDefault()
  const text = $('q').value.trim()
  if (!text) return
  if (globalThis.chrome?.search?.query) chrome.search.query({ text, disposition: 'CURRENT_TAB' })
  else location.href = `https://www.google.com/search?q=${encodeURIComponent(text)}`
})

// --- ask an AI: type, then pick who answers ------------------------------

// %s marks where the question goes. Sites without a query param get it on the clipboard.
const DEFAULT_AIS = [
  { name: 'Claude', url: 'https://claude.ai/new?q=%s' },
  { name: 'ChatGPT', url: 'https://chatgpt.com/?q=%s' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com/' },
  { name: 'Grok', url: 'https://grok.com/?q=%s' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai/search?q=%s' },
]
let ais = []

function renderAsk(list) {
  const sig = JSON.stringify(list)
  if (sig === JSON.stringify(ais)) return
  ais = list
  $('ask').replaceChildren(...list.map((ai, i) => {
    const a = h('a', { class: 'ai', 'data-i': i, title: `Ask ${ai.name}` },
      h('img', { src: `https://www.google.com/s2/favicons?domain=${host(ai.url)}&sz=64`, alt: '', width: 16, height: 16 }),
      h('span', {}, ai.name))
    a.addEventListener('click', (e) => {
      const text = $('q').value.trim()
      if (text && !ai.url.includes('%s')) {
        navigator.clipboard?.writeText(text)
        toast(`Question copied. Paste it into ${ai.name}.`)
      }
    })
    return a
  }))
  syncAsk()
}

// Keep hrefs current so ⌘-click and middle-click open a new tab naturally.
function syncAsk() {
  const text = $('q').value.trim()
  for (const a of $('ask').children) {
    const ai = ais[a.dataset.i]
    a.href = ai.url.includes('%s')
      ? (text ? ai.url.replace('%s', encodeURIComponent(text)) : `https://${host(ai.url)}`)
      : ai.url
  }
  $('ask').classList.toggle('has-text', Boolean(text))
}
$('q').addEventListener('input', syncAsk)
renderAsk(DEFAULT_AIS)

let toastTimer
function toast(msg) {
  const t = $('toast')
  t.textContent = msg
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { t.hidden = true }, 2600)
}

// --- live state ----------------------------------------------------------

function connect() {
  const es = new EventSource(`${API}/api/events`)
  es.onmessage = (e) => {
    setStatus('live', 'agents connected')
    render(JSON.parse(e.data))
  }
  es.addEventListener('news', (e) => renderNews(JSON.parse(e.data)))
  es.onerror = () => {
    setStatus('off', 'agents resting')
    resting(true)
  }
}
connect()

function setStatus(state, text) {
  $('status').dataset.state = state
  $('status-text').textContent = text
}

function resting(on, empty = false) {
  $('resting').hidden = !on
  $('resting-sub').innerHTML = empty
    ? 'Nothing needs you. Agents can add things here with <code>tab pin</code>.'
    : 'Run <code>tab serve</code> to let them in.'
  if (on && !empty) { column.replaceChildren(); rows.clear() }
}

// Every widget becomes one quiet line, grouped by what it asks of you.
const SECTIONS = [
  ['needs', 'Needs you'],
  ['soon', 'Coming up'],
  ['lately', 'Lately'],
]
const DEFAULT_SECTION = { list: 'needs', stat: 'soon', link: 'soon' }
const sectionOf = (w) => {
  const s = w.section === 'done' ? 'lately' : w.section
  return SECTIONS.some(([k]) => k === s) ? s : DEFAULT_SECTION[w.kind] || 'lately'
}

function render(state) {
  renderAsk(Array.isArray(state.ai) && state.ai.length ? state.ai : DEFAULT_AIS)
  const brief = $('brief')
  if (brief.textContent !== (state.brief || '')) {
    brief.textContent = state.brief || ''
    brief.hidden = !state.brief
    brief.style.animation = 'none'; brief.offsetWidth; brief.style.animation = ''
  }

  const notice = $('notice')
  notice.hidden = !state.notice
  if (state.notice) {
    notice.dataset.level = state.notice.level || 'info'
    $('notice-text').textContent = state.notice.text
  }

  const ids = state.order.filter((id) => state.widgets[id])
  for (const [id, r] of rows) if (!state.widgets[id]) { leave(r.el); rows.delete(id) }

  let i = 0
  for (const [key, label] of SECTIONS) {
    const members = ids.filter((id) => sectionOf(state.widgets[id]) === key)
    let sec = column.querySelector(`[data-section="${key}"]`)
    if (!members.length) { sec?.remove(); continue }
    if (!sec) {
      sec = h('section', { class: 'group', 'data-section': key }, h('h2', { class: 'group-label' }, label), h('div', { class: 'group-rows' }))
    }
    column.append(sec) // keeps sections in a fixed order
    const box = sec.querySelector('.group-rows')
    members.forEach((id) => {
      const w = state.widgets[id]
      const sig = JSON.stringify(w)
      const have = rows.get(id)
      let el = have?.el
      if (have?.sig !== sig) {
        el = row(w)
        el.style.setProperty('--i', firstPaint ? i : 0)
        if (have) { el.style.animation = 'none'; have.el.replaceWith(el) }
        rows.set(id, { el, sig })
      }
      if (el.parentNode !== box || box.children[members.indexOf(id)] !== el) box.append(el)
      i++
    })
  }

  resting(ids.length === 0 && !state.notice, true)
  firstPaint = false
}

function leave(el) {
  el.classList.add('leaving')
  el.addEventListener('animationend', () => el.remove(), { once: true })
  setTimeout(() => el.remove(), 600)
}

// --- rows ----------------------------------------------------------------

function row(w) {
  const el = h('div', { class: 'row', 'data-id': w.id, 'data-kind': w.kind })
  const title = w.title || firstLine(w) || w.id
  const meta = metaFor(w)
  const more = details(w)

  const main = w.kind === 'link'
    ? h('a', { class: 'row-main', href: safeUrl(w.url) })
    : h('button', { class: 'row-main', type: 'button', 'aria-expanded': 'false' })
  main.append(...[
    h('span', { class: 'row-title' }, title),
    meta ? h('span', { class: 'row-meta' }, meta) : null,
    more ? chevron() : null,
  ].filter(Boolean))
  if (w.kind === 'link') main.addEventListener('click', () => act({ type: 'open', id: w.id, value: w.url }))
  el.append(main, closeButton(() => act({ type: 'dismiss', id: w.id })))

  if (more) {
    const wrap = h('div', { class: 'row-more' }, h('div', { class: 'row-more-inner' }))
    el.append(wrap)
    const toggle = (open) => {
      el.dataset.open = open ? 'true' : ''
      main.setAttribute('aria-expanded', String(open))
      if (open && !wrap.firstChild.childElementCount) wrap.firstChild.append(more()) // build lazily
      open ? openIds.add(w.id) : openIds.delete(w.id)
    }
    main.addEventListener('click', () => toggle(!el.dataset.open))
    if (openIds.has(w.id)) toggle(true)
  }
  return el
}

function metaFor(w) {
  switch (w.kind) {
    case 'stat': return w.value
    case 'list': {
      const items = w.items || []
      const open = items.filter((x) => !x.done).length
      return open ? `${open} open` : 'all done'
    }
    case 'link': return w.title ? host(w.url) : null
    default: return null
  }
}

// Returns a builder for the expanded part, or null when there is nothing more to show.
function details(w) {
  switch (w.kind) {
    case 'stat': {
      const parts = [w.label, w.caption].filter(Boolean)
      return parts.length ? () => h('p', { class: 'detail' }, parts.join(' · ')) : null
    }
    case 'list': return () => h('ul', { class: 'list' }, ...(w.items || []).map((it, i) => listItem(w, it, i)))
    case 'md': return () => mdBlock(w.md)
    case 'text': return () => h('div', { class: 'md' }, ...String(w.text).split(/\n{2,}/).map((p) => h('p', {}, p)))
    case 'html': return () => frame(w)
    case 'link': return null
    default: return null
  }
}

function firstLine(w) {
  const src = w.kind === 'md' ? w.md : w.kind === 'text' ? w.text : ''
  return String(src || '').split('\n').find((l) => l.trim())?.replace(/^[#>*\-\d.\s]+/, '').slice(0, 80)
}

function chevron() {
  const s = h('span', { class: 'chev', 'aria-hidden': 'true' })
  s.innerHTML = '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>'
  return s
}

function listItem(w, it, i) {
  const li = h('li', { class: it.done ? 'done' : '' })
  const btn = h('button', { class: 'check', 'aria-label': it.done ? 'Mark not done' : 'Mark done', 'aria-pressed': String(Boolean(it.done)) })
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7.5"/></svg>'
  btn.addEventListener('click', () => {
    const done = !li.classList.contains('done')
    li.classList.toggle('done', done)
    act({ type: 'check', id: w.id, item: i, value: done })
  })
  let text
  if (it.url) {
    text = h('a', { class: 'item-text', href: safeUrl(it.url) }, it.text)
    text.addEventListener('click', () => act({ type: 'open', id: w.id, value: it.url }))
  } else text = h('span', { class: 'item-text' }, it.text)
  li.append(btn, text)
  return li
}

function frame(w) {
  return h('iframe', {
    class: 'frame',
    src: `${API}/w/${encodeURIComponent(w.id)}?theme=${document.body.dataset.theme}&v=${encodeURIComponent(w.updatedAt || '')}`,
    sandbox: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
    title: w.title || w.id,
  })
}

addEventListener('message', (e) => {
  if (e.data?.nirvana !== 'height') return
  for (const f of document.querySelectorAll('iframe.frame')) {
    if (f.contentWindow === e.source) f.style.height = `${Math.min(Math.max(e.data.h, 40), 640)}px`
  }
})

// --- today's reading -----------------------------------------------------

const TOPIC_NAMES = { tech: 'Tech', ai: 'AI', science: 'Science', design: 'Design', business: 'Business', world: 'World', sports: 'Sports' }
const topicName = (t) => TOPIC_NAMES[t] || t[0].toUpperCase() + t.slice(1)
const SHOWN = 5
let newsSig = ''
let newsExpanded = false
let news = null

function renderNews(n) {
  const sig = JSON.stringify(n)
  if (sig === newsSig) return
  newsSig = sig
  news = n
  const box = $('news')
  box.hidden = !n.enabled
  if (!n.enabled) return

  const label = [...n.topics.map(topicName), ...(n.feeds.length ? [`${n.feeds.length} feed${n.feeds.length > 1 ? 's' : ''}`] : [])].join(' · ') || 'Pick topics'
  $('news-edit').replaceChildren(h('span', {}, label), chevron())

  $('news-topics').replaceChildren(...n.topicsAvailable.map((t) => {
    const on = n.topics.includes(t)
    const b = h('button', { class: 'topic', type: 'button', 'aria-pressed': String(on) }, topicName(t))
    b.addEventListener('click', () => {
      const next = on ? n.topics.filter((x) => x !== t) : [...n.topics, t]
      if (!next.length && !n.feeds.length) return toast('Keep at least one topic.')
      act({ type: 'news-topics', value: next })
    })
    return b
  }))

  const list = $('news-list')
  if (!n.items.length) {
    list.replaceChildren(h('li', { class: 'news-empty' }, n.refreshing ? 'Gathering today\'s reading…' : 'Nothing new from these sources yet.'))
  } else {
    list.replaceChildren(...n.items.map((it, i) => {
      const a = h('a', { class: 'story', href: safeUrl(it.url) },
        h('span', { class: 'story-title' }, it.title),
        h('span', { class: 'story-meta' },
          h('img', { src: `https://www.google.com/s2/favicons?domain=${host(it.url)}&sz=32`, alt: '', width: 14, height: 14 }),
          h('span', {}, [it.source, ago(it.publishedAt)].filter(Boolean).join(' · '))))
      a.addEventListener('click', () => act({ type: 'open', id: 'news', value: it.url }))
      const li = h('li', { class: 'story-row' }, a)
      li.hidden = !newsExpanded && i >= SHOWN
      li.style.setProperty('--i', i)
      return li
    }))
  }
  const more = $('news-more')
  more.hidden = n.items.length <= SHOWN
  more.textContent = newsExpanded ? 'Show less' : `${n.items.length - SHOWN} more`
  $('news-when').textContent = n.refreshing ? 'Refreshing…' : n.fetchedAt ? `Updated ${when(n.fetchedAt)}` : ''
}

$('news-edit').addEventListener('click', () => {
  const box = $('news')
  const open = box.dataset.editing !== 'true'
  box.dataset.editing = String(open)
  $('news-edit').setAttribute('aria-expanded', String(open))
})
$('news-more').addEventListener('click', () => {
  newsExpanded = !newsExpanded
  newsSig = ''
  if (news) renderNews(news)
})

function ago(iso) {
  if (!iso) return ''
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 6e4))
  if (m < 60) return `${m}m`
  const hrs = Math.round(m / 60)
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`
}
function when(iso) {
  const d = new Date(iso)
  const today = d.toDateString() === new Date().toDateString()
  return (today ? '' : d.toLocaleDateString([], { weekday: 'short' }) + ' ') + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function act(body) {
  fetch(`${API}/api/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {})
}

$('notice-x').addEventListener('click', () => {
  $('notice').hidden = true
  act({ type: 'notice-dismiss' })
})

// --- tiny helpers --------------------------------------------------------

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== '') el.setAttribute(k, v)
  for (const k of kids) if (k !== null && k !== undefined) el.append(k)
  return el
}

function closeButton(onClick) {
  const b = h('button', { class: 'x', 'aria-label': 'Dismiss' })
  b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg>'
  b.addEventListener('click', onClick)
  return b
}

function safeUrl(u) {
  try { const url = new URL(u); return /^https?:$/.test(url.protocol) ? url.href : '#' } catch { return '#' }
}
function host(u) {
  try { return new URL(u).host.replace(/^www\./, '') } catch { return u }
}

// Minimal markdown: headings, lists, code, paragraphs, bold/italic/code/links.
function mdBlock(src) {
  const div = h('div', { class: 'md' })
  div.innerHTML = md(String(src || ''))
  for (const a of div.querySelectorAll('a')) a.addEventListener('click', () => act({ type: 'open', value: a.href }))
  return div
}

function md(src) {
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])[_*]([^_*]+)[_*](?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${esc(safeUrl(u.replace(/&amp;/g, '&')))}">${t}</a>`)
  const out = []
  const lines = src.replace(/\r/g, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^```/.test(line)) {
      const code = []
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i])
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
    } else if (/^#{1,3}\s/.test(line)) {
      const n = line.match(/^#+/)[0].length
      out.push(`<h${n}>${inline(line.replace(/^#+\s/, ''))}</h${n}>`)
    } else if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\s*([-*]|\d+\.)\s/, ''))}</li>`)
      i--
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`)
    } else if (line.trim()) {
      const para = [line]
      while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#|```|\s*([-*]|\d+\.)\s)/.test(lines[i + 1])) para.push(lines[++i])
      out.push(`<p>${inline(para.join(' '))}</p>`)
    }
  }
  return out.join('')
}

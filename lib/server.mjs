import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOME, STATE_FILE, load, prune, save, update, event } from './state.mjs'
import { TOPICS, isStale, loadNews, newsConfig, refreshNews } from './news.mjs'
import { readUsage } from './usage.mjs'

const UI_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'extension')
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }

// Only the extension (or the page served from here) may read state or act on it.
// Ordinary websites must not be able to read your tab through localhost.
function allowedOrigin(req, port) {
  const origin = req.headers.origin
  if (!origin) return null
  if (origin.startsWith('chrome-extension://')) return origin
  if (origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`) return origin
  return false
}

// Injected into every agent-made HTML widget: inherit the theme, report height.
const WIDGET_SHIM = (theme) => `<style>
:root{color-scheme:${theme === 'dark' ? 'dark' : 'light'}}
html,body{margin:0;background:transparent;font:14px/1.5 ui-sans-serif,-apple-system,system-ui,sans-serif;color:${theme === 'dark' ? '#ece9f6' : '#2b2838'}}
a{color:inherit}
</style><script>
(()=>{const post=()=>parent.postMessage({nirvana:'height',h:document.documentElement.scrollHeight},'*');
addEventListener('load',post);new ResizeObserver(post).observe(document.documentElement);})()
</script>`

export function serve(port) {
  const clients = new Set()
  const broadcast = () => {
    const state = load()
    const payload = `data: ${JSON.stringify(publicState(state))}\n\n`
    for (const res of clients) res.write(payload)
    if (!ensureNews(state)) broadcastNews() // topics may have changed
  }

  // --- daily news ---
  let refreshing = null
  const newsPayload = (state = load()) => {
    const cfg = newsConfig(state)
    const news = loadNews()
    return { ...cfg, topicsAvailable: Object.keys(TOPICS), items: news?.items || [], fetchedAt: news?.fetchedAt || null, refreshing: Boolean(refreshing) }
  }
  const sendNews = (res, state) => res.write(`event: news\ndata: ${JSON.stringify(newsPayload(state))}\n\n`)
  const broadcastNews = () => { for (const res of clients) sendNews(res) }
  function ensureNews(state = load(), force = false) {
    const cfg = newsConfig(state)
    if (!cfg.enabled || refreshing) return refreshing
    if (!force && !isStale(loadNews(), cfg)) return null
    refreshing = refreshNews(cfg)
      .catch((e) => console.error('nirvana: news refresh failed', e.message))
      .finally(() => { refreshing = null; broadcastNews(); ensureNews() }) // catch config edits made mid-refresh
    broadcastNews()
    return refreshing
  }
  ensureNews()
  setInterval(() => ensureNews(), 36e5)

  // --- agent plan usage: polled only while a page is open, never more than every 5 min ---
  let usage = null
  let usageAt = 0
  let usageBusy = false
  const sendUsage = (res) => usage && res.write(`event: usage\ndata: ${JSON.stringify(usage)}\n\n`)
  async function pollUsage() {
    if (usageBusy || !clients.size || Date.now() - usageAt < 5 * 6e4) return
    usageBusy = true
    try { usage = await readUsage(); usageAt = Date.now(); for (const res of clients) sendUsage(res) }
    catch (e) { console.error('nirvana: usage failed', e.message) }
    finally { usageBusy = false }
  }
  setInterval(pollUsage, 6e4)

  fs.mkdirSync(HOME, { recursive: true })
  if (!fs.existsSync(STATE_FILE)) save(load())

  let timer
  fs.watch(HOME, (_, file) => {
    if (file !== path.basename(STATE_FILE)) return
    clearTimeout(timer)
    timer = setTimeout(broadcast, 40)
  })

  // Expire widgets even when nobody runs the CLI.
  setInterval(() => {
    const state = load()
    if (prune(state)) save(state)
  }, 15e3)

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    const origin = allowedOrigin(req, port)
    if (origin === false) return send(res, 403, 'Forbidden origin')
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
    }
    if (req.method === 'OPTIONS') return send(res, 204, '')

    if (url.pathname === '/api/state') return json(res, publicState(load()))
    if (url.pathname === '/api/news') return json(res, newsPayload())
    if (url.pathname === '/api/usage') return json(res, usage || { tools: [] })

    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      res.write(`data: ${JSON.stringify(publicState(load()))}\n\n`)
      sendNews(res)
      sendUsage(res)
      clients.add(res)
      pollUsage()
      const ping = setInterval(() => res.write(': ping\n\n'), 25e3)
      req.on('close', () => { clearInterval(ping); clients.delete(res) })
      return
    }

    if (url.pathname === '/api/action' && req.method === 'POST') {
      if (!(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, 'JSON only')
      const body = JSON.parse((await readBody(req)) || '{}')
      if (body.type === 'news-refresh') { ensureNews(load(), true); return json(res, { ok: true }) }
      update((s) => applyAction(s, body))
      return json(res, { ok: true })
    }

    const widget = /^\/w\/([\w.-]+)$/.exec(url.pathname)
    if (widget) {
      const w = load().widgets[widget[1]]
      if (!w || w.kind !== 'html') return send(res, 404, 'No such widget')
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        // Opaque origin even if opened directly: agent HTML can't touch anything of ours.
        'content-security-policy': 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox',
        'cache-control': 'no-store',
      })
      return res.end(WIDGET_SHIM(url.searchParams.get('theme')) + w.html)
    }

    // Homepage mode: serve the same UI the extension uses.
    const file = path.join(UI_DIR, url.pathname === '/' ? 'newtab.html' : path.normalize(url.pathname))
    if (!file.startsWith(UI_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found')
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' })
    fs.createReadStream(file).pipe(res)
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`nirvana: serving on http://127.0.0.1:${port}  (state: ${STATE_FILE})`)
  })
}

function applyAction(state, { type, id, item, value }) {
  const w = id && state.widgets[id]
  switch (type) {
    case 'dismiss':
      if (w) { delete state.widgets[id]; event(state, 'dismiss', { id, title: w.title }) }
      break
    case 'notice-dismiss':
      if (state.notice) { event(state, 'notice-dismiss', { text: state.notice.text }); state.notice = null }
      break
    case 'check':
      if (w?.items?.[item]) {
        w.items[item].done = Boolean(value)
        event(state, value ? 'check' : 'uncheck', { id, item, text: w.items[item].text })
      }
      break
    case 'open':
      event(state, 'open', { id, url: String(value || '') })
      break
    case 'news-topics':
      if (Array.isArray(value)) {
        state.news = { ...(state.news || {}), topics: value.filter((t) => t in TOPICS) }
        event(state, 'news-topics', { topics: state.news.topics })
      }
      break
    case 'reorder':
      if (Array.isArray(value)) { state.order = value.filter((x) => state.widgets[x]); event(state, 'reorder', { order: state.order }) }
      break
  }
}

// Events are for agents; the page doesn't need them.
const publicState = ({ events, ...rest }) => rest

const json = (res, data) => send(res, 200, JSON.stringify(data), 'application/json')
function send(res, code, body, type = 'text/plain') {
  res.writeHead(code, { 'content-type': type })
  res.end(body)
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy() })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

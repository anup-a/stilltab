import fs from 'node:fs'
import path from 'node:path'
import { HOME } from './state.mjs'

export const NEWS_FILE = path.join(HOME, 'news.json')

// Topic presets. Every source is a plain RSS/Atom feed; users can add their own.
export const TOPICS = {
  tech: [
    ['Hacker News', 'https://hnrss.org/frontpage'],
    ['The Verge', 'https://www.theverge.com/rss/index.xml'],
    ['Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index'],
    ['TechCrunch', 'https://techcrunch.com/feed/'],
    ['Wired', 'https://www.wired.com/feed/rss'],
    ['MIT Technology Review', 'https://www.technologyreview.com/feed/'],
    ['Engadget', 'https://www.engadget.com/rss.xml'],
  ],
  ai: [
    ['Simon Willison', 'https://simonwillison.net/atom/everything/'],
    ['Hugging Face', 'https://huggingface.co/blog/feed.xml'],
    ['OpenAI', 'https://openai.com/news/rss.xml'],
  ],
  science: [
    ['Quanta', 'https://www.quantamagazine.org/feed/'],
    ['ScienceDaily', 'https://www.sciencedaily.com/rss/all.xml'],
    ['Nature', 'https://www.nature.com/nature.rss'],
    ['Guardian Science', 'https://www.theguardian.com/science/rss'],
  ],
  design: [
    ['Sidebar', 'https://sidebar.io/feed.xml'],
    ['Smashing Magazine', 'https://www.smashingmagazine.com/feed/'],
  ],
  business: [
    ['BBC Business', 'https://feeds.bbci.co.uk/news/business/rss.xml'],
    ['CNBC', 'https://www.cnbc.com/id/10001147/device/rss/rss.html'],
    ['Guardian Business', 'https://www.theguardian.com/business/rss'],
  ],
  world: [
    ['BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
    ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
    ['NPR', 'https://feeds.npr.org/1004/rss.xml'],
    ['Guardian World', 'https://www.theguardian.com/world/rss'],
  ],
  // No official feed; this mirror of github.com/trending updates daily. Items are undated
  // repos, so take the top few and lead with the repo's one-line description.
  github: [
    ['GitHub Trending', 'https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml', { take: 4, describe: true }],
  ],
  sports: [
    ['BBC Sport', 'https://feeds.bbci.co.uk/sport/rss.xml'],
    ['ESPN', 'https://www.espn.com/espn/rss/news'],
  ],
}

export const DEFAULT_NEWS = { enabled: true, topics: ['tech'], feeds: [], count: 10 }

export const newsConfig = (state) => ({ ...DEFAULT_NEWS, ...(state.news || {}) })

export function sourcesFor(cfg) {
  const seen = new Set()
  const out = []
  for (const t of cfg.topics) for (const [name, url, opts] of TOPICS[t] || []) if (!seen.has(url)) { seen.add(url); out.push({ name, url, topic: t, ...opts }) }
  for (const f of cfg.feeds) if (!seen.has(f.url)) { seen.add(f.url); out.push({ name: f.name || hostOf(f.url), url: f.url, topic: 'custom' }) }
  return out
}

export function loadNews() {
  try { return JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')) } catch { return null }
}

// Refresh once a day: the first time we look after the local date changes.
export function isStale(news, cfg) {
  if (!news?.fetchedAt) return true
  if (news.configKey !== configKey(cfg)) return true
  return new Date(news.fetchedAt).toDateString() !== new Date().toDateString()
}

const configKey = (cfg) => JSON.stringify([cfg.topics, cfg.feeds.map((f) => f.url), cfg.count])

export async function refreshNews(cfg) {
  const sources = sourcesFor(cfg)
  const results = await Promise.all(sources.map(async (src) => {
    try {
      const res = await fetch(src.url, { headers: { 'user-agent': 'Mozilla/5.0 (nirvana-tab)' }, signal: AbortSignal.timeout(10e3) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return { src, items: parseFeed(await res.text()) }
    } catch (e) {
      return { src, items: [], error: e.message }
    }
  }))

  // Prefer the last ~36h from each source; fall back to its newest two.
  const now = Date.now()
  const pools = results.map(({ src, items }) => {
    const sorted = items.filter((i) => i.title && i.url).sort((a, b) => (b.at || 0) - (a.at || 0))
    const fresh = sorted.filter((i) => i.at && now - i.at < 36 * 36e5)
    return (fresh.length ? fresh : sorted.slice(0, src.take || 2)).slice(0, 4).map((i) => ({
      ...i,
      title: src.describe && i.summary ? `${i.title.split('/').pop()}: ${i.summary}` : i.title,
      source: src.name,
      topic: src.topic,
    }))
  }).filter((p) => p.length)

  // Interleave twice: sources within a topic, then topics, so every topic gets its share
  // even when one topic has many more sources. Rotate the starting point daily for variety.
  const day = Math.floor(now / 864e5)
  const rotate = (arr) => arr.map((_, k) => arr[(k + day) % arr.length])
  const weave = (lists) => {
    const out = []
    for (let round = 0; lists.some((l) => l[round]); round++) for (const l of lists) if (l[round]) out.push(l[round])
    return out
  }
  const byTopic = new Map()
  for (const p of pools) byTopic.set(p[0].topic, [...(byTopic.get(p[0].topic) || []), p])
  const queue = weave(rotate([...byTopic.values()].map((ps) => weave(rotate(ps)))))

  const mixed = []
  const seen = new Set()
  for (const item of queue) {
    const key = item.title.toLowerCase().replace(/\W+/g, ' ').trim()
    if (seen.has(item.url) || seen.has(key)) continue
    seen.add(item.url); seen.add(key)
    mixed.push({ title: item.title, url: item.url, source: item.source, topic: item.topic, publishedAt: item.at ? new Date(item.at).toISOString() : null })
    if (mixed.length >= cfg.count) break
  }

  const news = {
    fetchedAt: new Date().toISOString(),
    configKey: configKey(cfg),
    items: mixed,
    errors: results.filter((r) => r.error).map((r) => ({ source: r.src.name, error: r.error })),
  }
  fs.mkdirSync(HOME, { recursive: true })
  fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2))
  return news
}

// --- tiny RSS/Atom reader ----------------------------------------------

export function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/g) || []
  return blocks.slice(0, 60).map((b) => ({
    title: clean(tag(b, 'title')),
    url: link(b),
    summary: summary(tag(b, 'description') || tag(b, 'summary')),
    at: Date.parse(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date') || '') || null,
  }))
}

// First sentence-ish of an item's description (often entity-encoded HTML).
function summary(raw) {
  const html = decode(String(raw).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
  const first = /<p>([\s\S]*?)<\/p>/i.exec(html)
  const text = clean(first ? first[1] : html)
  return text.length > 110 ? text.slice(0, 107).replace(/\s+\S*$/, '') + '…' : text
}

function tag(block, name) {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return m ? m[1] : ''
}

function link(block) {
  const alt = /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(block) || /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i.exec(block)
  if (alt) return decode(alt[1])
  const href = /<link\b[^>]*href=["']([^"']+)["']/i.exec(block)
  if (href) return decode(href[1])
  const text = clean(tag(block, 'link'))
  if (/^https?:\/\//.test(text)) return text
  const guid = clean(tag(block, 'guid'))
  return /^https?:\/\//.test(guid) ? guid : ''
}

function clean(s) {
  return decode(String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[e])
}

function hostOf(u) {
  try { return new URL(u).host.replace(/^www\./, '') } catch { return u }
}

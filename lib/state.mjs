import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_HOME = path.join(os.homedir(), '.stilltab')
const OLD_HOME = path.join(os.homedir(), '.nirvana') // the project's working name; move it over once
if (!process.env.STILLTAB_HOME && !fs.existsSync(DEFAULT_HOME) && fs.existsSync(OLD_HOME)) {
  try { fs.renameSync(OLD_HOME, DEFAULT_HOME) } catch {}
}
export const HOME = process.env.STILLTAB_HOME || DEFAULT_HOME
export const STATE_FILE = path.join(HOME, 'state.json')
export const PORT = Number(process.env.STILLTAB_PORT || 7777)

const EMPTY = { brief: null, notice: null, order: [], widgets: {}, events: [] }

export function load() {
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
  } catch {
    return structuredClone(EMPTY)
  }
}

export function save(state) {
  fs.mkdirSync(HOME, { recursive: true })
  const tmp = `${STATE_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, STATE_FILE)
}

export function update(fn) {
  const state = load()
  fn(state)
  prune(state)
  save(state)
  return state
}

// Drop expired widgets and keep `order` in sync with what exists.
export function prune(state, now = Date.now()) {
  let changed = false
  for (const [id, w] of Object.entries(state.widgets)) {
    if (w.expiresAt && Date.parse(w.expiresAt) <= now) {
      delete state.widgets[id]
      changed = true
    }
  }
  const order = state.order.filter((id) => state.widgets[id])
  for (const id of Object.keys(state.widgets)) if (!order.includes(id)) order.push(id)
  if (order.join() !== state.order.join()) changed = true
  state.order = order
  if (state.notice?.expiresAt && Date.parse(state.notice.expiresAt) <= now) {
    state.notice = null
    changed = true
  }
  state.events = state.events.slice(-500)
  return changed
}

export function duration(str) {
  const m = /^(\d+(?:\.\d+)?)(s|m|h|d)$/.exec(String(str).trim())
  if (!m) throw new Error(`Bad duration "${str}". Use e.g. 30s, 10m, 2h, 1d.`)
  return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]]
}

export function event(state, type, data = {}) {
  state.events.push({ at: new Date().toISOString(), type, ...data })
}

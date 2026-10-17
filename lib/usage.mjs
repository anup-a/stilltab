// Plan usage for the coding agents on this Mac: how much of each rate-limit window is used.
//   Claude Code: the same endpoint `/usage` reads, with Claude Code's own login from the keychain.
//   Codex:       the newest rate_limits Codex wrote into its session logs, else ChatGPT's usage endpoint.
// Read only: we never refresh or rewrite anyone's login. A stale login just shows as "signed out".

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')

const pct = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null)
const win = (label, used, resetsAt) => (used == null ? null : { label, used: pct(used), resetsAt: resetsAt || null })

function keychain(service) {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') return resolve(null)
    execFile('security', ['find-generic-password', '-s', service, '-w'], { timeout: 5e3 }, (err, out) => resolve(err ? null : out.trim()))
  })
}

async function claude() {
  const base = { id: 'claude', name: 'Claude Code' }
  let creds = null
  try { creds = JSON.parse(await keychain('Claude Code-credentials'))?.claudeAiOauth } catch {}
  if (!creds) {
    try { creds = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), 'utf8')).claudeAiOauth } catch {}
  }
  if (!creds?.accessToken) return null // not installed or never signed in: leave it out
  if (creds.expiresAt && creds.expiresAt < Date.now()) return { ...base, state: 'stale' } // Claude Code refreshes it next time it runs
  const r = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: { authorization: `Bearer ${creds.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
    signal: AbortSignal.timeout(10e3),
  })
  if (r.status === 401) return { ...base, state: 'stale' }
  if (!r.ok) throw new Error(`claude usage ${r.status}`)
  const u = await r.json()
  return {
    ...base, state: 'ok', plan: creds.subscriptionType || null,
    windows: [win('5h', u.five_hour?.utilization, u.five_hour?.resets_at), win('week', u.seven_day?.utilization, u.seven_day?.resets_at)].filter(Boolean),
  }
}

// Codex logs every turn's rate limits into ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl.
function codexFromLogs() {
  const root = path.join(CODEX_HOME, 'sessions')
  const newest = (dir) => { try { return fs.readdirSync(dir).sort().reverse() } catch { return [] } }
  const files = []
  for (const y of newest(root)) for (const m of newest(path.join(root, y))) for (const d of newest(path.join(root, y, m))) {
    for (const f of newest(path.join(root, y, m, d))) if (f.endsWith('.jsonl')) files.push(path.join(root, y, m, d, f))
    if (files.length >= 5) break
  }
  let best = null
  for (const file of files.slice(0, 5)) {
    const lines = fs.readFileSync(file, 'utf8').trimEnd().split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('"rate_limits"')) continue
      try {
        const e = JSON.parse(lines[i])
        const rl = e.payload?.rate_limits || e.rate_limits
        const at = Date.parse(e.timestamp) || fs.statSync(file).mtimeMs
        if (rl && (!best || at > best.at)) best = { at, rl }
      } catch {}
      break
    }
  }
  if (!best) return null
  const reset = (w) => (w?.resets_at ? new Date(w.resets_at * 1000).toISOString() : w?.resets_in_seconds != null ? new Date(best.at + w.resets_in_seconds * 1000).toISOString() : null)
  const windows = [best.rl.primary, best.rl.secondary].filter(Boolean)
    .map((w) => win(w.window_minutes >= 1440 ? 'week' : `${Math.round((w.window_minutes || 300) / 60)}h`, w.used_percent, reset(w)))
    // a window that has reset since the log was written is back to zero
    .map((w) => (w && w.resetsAt && Date.parse(w.resetsAt) < Date.now() ? { ...w, used: 0, resetsAt: null } : w))
  return windows.length ? { windows, at: new Date(best.at).toISOString() } : null
}

async function codex() {
  const base = { id: 'codex', name: 'Codex' }
  let auth = null
  try { auth = JSON.parse(fs.readFileSync(path.join(CODEX_HOME, 'auth.json'), 'utf8')) } catch {}
  const logged = codexFromLogs()
  if (!auth && !logged) return null
  const tokens = auth?.tokens
  if (tokens?.access_token) {
    const r = await fetch('https://chatgpt.com/backend-api/wham/usage', {
      headers: { authorization: `Bearer ${tokens.access_token}`, 'chatgpt-account-id': tokens.account_id || '', 'user-agent': 'codex_cli_rs' },
      signal: AbortSignal.timeout(10e3),
    }).catch(() => null)
    if (r?.ok) {
      const u = await r.json()
      const rl = u.rate_limit || {}
      const w = (x) => x && win(x.limit_window_seconds >= 86400 ? 'week' : `${Math.round((x.limit_window_seconds || 18000) / 3600)}h`, x.used_percent,
        x.reset_at ? new Date(x.reset_at * 1000).toISOString() : null)
      const windows = [w(rl.primary_window), w(rl.secondary_window)].filter(Boolean)
      if (windows.length) return { ...base, state: 'ok', plan: u.plan_type || null, windows }
    }
  }
  if (logged) return { ...base, state: 'ok', windows: logged.windows, asOf: logged.at }
  return { ...base, state: 'stale' }
}

export async function readUsage() {
  const tools = await Promise.all([claude(), codex()].map((p) => p.catch((e) => (console.error('stilltab: usage', e.message), null))))
  return { at: new Date().toISOString(), tools: tools.filter(Boolean) }
}

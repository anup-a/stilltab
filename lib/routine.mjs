// Background jobs on the user's machine:
//   the server, kept running (autostart), and the routine: their agent, run headless on a schedule,
//   refreshing the tab. macOS uses launchd; elsewhere we print the crontab line to add.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOME, duration } from './state.mjs'

const TAB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'tab.mjs')
const AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')
const LABEL = { serve: 'dev.stilltab.serve', routine: 'dev.stilltab.routine' }
const OLD_LABEL = { serve: 'dev.nirvana.serve', routine: 'dev.nirvana.routine' } // working name; removed on install
const MAC = process.platform === 'darwin'

// How each agent runs one turn headless. The prompt comes from `tab routine prompt` at run time,
// so editing the brief never needs a reinstall.
const PROMPT = '"$(tab routine prompt)"'
export const PRESETS = {
  claude: `claude -p ${PROMPT} --allowedTools "Bash Read Grep Glob WebFetch WebSearch"`,
  codex: `codex exec --full-auto --skip-git-repo-check ${PROMPT}`,
  gemini: `gemini --yolo -p ${PROMPT}`,
  opencode: `opencode run ${PROMPT}`,
}

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export function plist(label, args, extra = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array>${args.map((a) => `<string>${xml(a)}</string>`).join('')}</array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(pathWithTab())}</string></dict>
  <key>WorkingDirectory</key><string>${xml(HOME)}</string>
${extra}</dict></plist>
`
}
// launchd starts with a bare PATH; give jobs the one this shell has, plus node and tab.
const pathWithTab = () => [...new Set([path.dirname(process.execPath), ...(process.env.PATH || '').split(':')])].join(':')

function load(name, body) {
  fs.mkdirSync(AGENTS_DIR, { recursive: true })
  fs.mkdirSync(HOME, { recursive: true })
  const file = path.join(AGENTS_DIR, `${LABEL[name]}.plist`)
  unload(name)
  fs.writeFileSync(file, body)
  execFileSync('launchctl', ['load', '-w', file])
  return file
}
function unload(name) {
  const old = path.join(AGENTS_DIR, `${OLD_LABEL[name]}.plist`)
  if (fs.existsSync(old)) { try { execFileSync('launchctl', ['unload', '-w', old], { stdio: 'ignore' }) } catch {} fs.rmSync(old) }
  const file = path.join(AGENTS_DIR, `${LABEL[name]}.plist`)
  if (!fs.existsSync(file)) return false
  try { execFileSync('launchctl', ['unload', '-w', file], { stdio: 'ignore' }) } catch {}
  fs.rmSync(file)
  return true
}
export const installed = (name) => MAC && fs.existsSync(path.join(AGENTS_DIR, `${LABEL[name]}.plist`))

export function autostart(on) {
  if (!MAC) return on ? `Add to your login items or crontab:\n@reboot ${process.execPath} ${TAB} serve` : 'Nothing to remove.'
  if (!on) return unload('serve') ? 'Autostart off.' : 'Autostart was already off.'
  const log = path.join(HOME, 'serve.log')
  load('serve', plist(LABEL.serve, [process.execPath, TAB, 'serve'],
    `  <key>RunAtLoad</key><true/>\n  <key>KeepAlive</key><true/>\n  <key>StandardOutPath</key><string>${xml(log)}</string>\n  <key>StandardErrorPath</key><string>${xml(log)}</string>\n`))
  return `The server now starts at login and restarts if it stops (log: ${log}).`
}

// The shell line the schedule runs: quiet hours first, then the agent.
export function routineCommand({ agent, cmd, hours }) {
  const run = cmd || PRESETS[agent]
  if (!run) throw new Error(`No preset for "${agent}". Use --agent ${Object.keys(PRESETS).join('|')} or pass --cmd '<your agent> "$(tab routine prompt)"'`)
  const [from, to] = hours ? hours.split('-').map(Number) : []
  const gate = hours ? `h=$(date +%H); h=\${h#0}; [ "$h" -ge ${from} ] && [ "$h" -lt ${to} ] || exit 0; ` : ''
  return `${gate}echo "--- $(date)"; ${run}`
}

export function installRoutine(routine) {
  const seconds = Math.round(duration(routine.every) / 1e3)
  if (seconds < 900) throw new Error('Refresh at most every 15 minutes (--every 15m or longer)')
  const line = routineCommand(routine)
  if (!MAC) {
    const mins = Math.max(15, Math.round(seconds / 60))
    const when = mins < 60 ? `*/${mins} * * * *` : mins < 1440 ? `0 */${Math.round(mins / 60)} * * *` : '0 8 * * *'
    return `Add this to your crontab (crontab -e):\n${when} STILLTAB_AGENT=${routine.agent || 'agent'} sh -c '${line.replace(/'/g, `'\\''`)}' >> ${HOME}/routine.log 2>&1`
  }
  const log = path.join(HOME, 'routine.log')
  load('routine', plist(LABEL.routine, ['/bin/sh', '-c', `export STILLTAB_AGENT=${routine.agent || 'agent'}; ${line}`],
    `  <key>StartInterval</key><integer>${seconds}</integer>\n  <key>StandardOutPath</key><string>${xml(log)}</string>\n  <key>StandardErrorPath</key><string>${xml(log)}</string>\n`))
  return `Routine on: every ${routine.every}${routine.hours ? `, between ${routine.hours}h` : ''} (log: ${log}).`
}
export const removeRoutine = () => (MAC ? (unload('routine') ? 'Routine off.' : 'No routine was installed.') : 'Remove the stilltab line from your crontab (crontab -e).')
export function runRoutineNow(routine) {
  if (MAC && installed('routine')) { execFileSync('launchctl', ['start', LABEL.routine]); return `Started. Watch ${path.join(HOME, 'routine.log')}` }
  return null
}

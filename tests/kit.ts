// Il mondo sotto la mod, condiviso dai test: ogni hook qui sta per il motore.
import { mock } from 'claude-code/testing'
import type { On } from 'claude-code'

export const ORA = Date.parse('2026-11-02T10:00:00Z')
export const RESET = '2026-11-02T12:00:00Z'

export const PANE = {
  plugin: 'afc',
  component: 'Pane',
  requestId: 'afc',
  props: {
    title: 'AFC · Away from Claude',
    isFocused: true,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 80 },
    view: {},
  },
} as const

export const utente = (text: string) => ({ text, wait: false, origin: { kind: 'composer' as const } })

/** Clock, store, uso con il limite 5h esaurito, prompt e push registrati, impostazioni del motore. */
export function motore(on: On, pct = 100) {
  const clock = mock.clock(on, { now: ORA })
  mock.store(on)
  const inviati: string[] = []
  on('command.register', () => ({ value: { command: 'afc' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('classic.StopFailure', () => ({}))
  on('session.usage', () => ({
    value: {
      startedAt: ORA,
      context: { tokens: 68000, window: 200000, percent: 34 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: pct, resetsAt: RESET },
        { kind: 'seven_day', percentUsed: 58, resetsAt: '2026-11-05T09:00:00Z' },
      ],
      cost: { usd: 3.42 },
    },
  }))
  on('prompt.submit', (_, e) => {
    inviati.push(e.text)
    return { text: e.text }
  })
  const push: string[] = []
  const cfg: Record<string, unknown> = { remoteControl: 'default', agentPushNotifEnabled: false }
  const comandi: string[] = []
  on('classic.Notification', () => ({}))
  on('tool.call', { tool: 'PushNotification' }, (_, e) => {
    push.push((e as unknown as { message: string }).message)
    return { result: { message: '', pushSent: true } }
  })
  on('tool.call', () => ({ result: {} }))
  on('config.list', () => ({
    value: Object.entries(cfg).map(([key, value]) => ({ key, label: key, kind: typeof value === 'boolean' ? 'boolean' : 'choice', value, provider: { plugin: 'engine', tier: 'core' }, isLocked: false })) as never,
  }))
  on('config.set', (_, e) => {
    cfg[e.key] = e.value
    return { key: e.key, value: e.value }
  })
  on('command.list', () => ({ value: [{ name: 'remote-control', description: 'Remote Control' }] as never }))
  on('command.run', (_, e) => {
    comandi.push(e.command)
    return { text: 'ok' }
  })
  return { clock, inviati, push, cfg, comandi }
}

/** In più: file in memoria, verdetto di base "ask", radice del progetto, Windows, sveglia finta. */
export function motoreAfk(on: On) {
  const m = motore(on)
  const file: Record<string, string> = {}
  const svegli: string[][] = []
  on('fs.read', (_, e) => {
    // Il motore può passare il percorso già reso assoluto: si cerca per suffisso.
    const p = (e as unknown as { path: string }).path.replace(/\\/g, '/')
    const k = Object.keys(file).find(x => p === x || p.endsWith('/' + x))
    if (k === undefined) throw new Error(`ENOENT ${p}`)
    return { value: file[k] as string }
  })
  on('tool.check', () => ({ decision: 'ask' as const }))
  on('turn.complete', () => ({ text: '' }))
  on('session.root', () => ({ value: 'C:/prj' }))
  on('env.get', () => ({ value: 'Windows_NT' }))
  on('process.spawn', async function* (_: unknown, e: unknown) {
    svegli.push([...(e as unknown as { argv: string[] }).argv])
    await new Promise(() => undefined)
    return { code: 0, signal: null }
  } as never)
  return { ...m, file, svegli }
}

export const fine = (answer: string, durationMs = 1000) => ({ answer, durationMs, isAborted: false, turnId: 't', reason: 'answer' as const })

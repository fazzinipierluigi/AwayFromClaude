import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { calcolaReset, prossimaLingua, rilevaLingua } from '../hooks/logica'

const ORA = Date.parse('2026-11-02T10:00:00Z')
const RESET = '2026-11-02T12:00:00Z'

const PANE = {
  plugin: 'afc',
  component: 'Pane',
  requestId: 'afc',
  props: {
    title: 'AFC · Away from Claude',
    isFocused: true,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const utente = (text: string) => ({ text, wait: false, origin: { kind: 'composer' as const } })

/** Il mondo sotto la mod: clock, store, uso con il limite 5h esaurito, prompt registrati. */
function motore(on: On, pct = 100) {
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
  // Notifiche: lo strumento PushNotification e le impostazioni del motore che la mod tocca.
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

test('rileva le lingue principali', () => {
  expect(rilevaLingua('Rendiamo la dashboard più completa, includiamo anche le barre')).toBe('it')
  expect(rilevaLingua('Please fix the bug and then add a test for it')).toBe('en')
  expect(rilevaLingua('Est-ce que tu peux corriger le bug dans les fichiers, merci')).toBe('fr')
  expect(rilevaLingua('Kannst du bitte den Fehler beheben und auch einen Test schreiben')).toBe('de')
  expect(rilevaLingua('¿Puedes arreglar el error y también añadir una prueba?')).toBe('es')
  expect(rilevaLingua('Você pode corrigir o erro e também adicionar um teste? Obrigado')).toBe('pt')
  expect(rilevaLingua('Kun je alsjeblieft de fout oplossen en ook een test maken')).toBe('nl')
  expect(rilevaLingua('Czy możesz proszę naprawić błąd i też dodać test')).toBe('pl')
  expect(rilevaLingua('ok')).toBe(null)
  expect(rilevaLingua('npm run build src/index.ts')).toBe(null)
})

test('il ciclo delle lingue torna ad auto', () => {
  expect(prossimaLingua('auto')).toBe('it')
  expect(prossimaLingua('it')).toBe('en')
  expect(prossimaLingua('pl')).toBe('auto')
})

test('il reset vale per la finestra esaurita più lontana', () => {
  const t = ORA
  const r = calcolaReset([
    { kind: 'five_hour', pct: 100, resetAt: t + 3600000 },
    { kind: 'seven_day', pct: 100, resetAt: t + 86400000 },
  ], t)
  expect(r).toEqual({ limite: 'seven_day', resetAt: t + 86400000, stimato: false })
  expect(calcolaReset([], t).stimato).toBe(true)
  expect(calcolaReset([{ kind: 'five_hour', pct: 20, resetAt: t + 1000 }], t).stimato).toBe(true)
})

test('al limite attende il reset più il margine e invia "Riprendi"', async ($, on) => {
  const { clock, inviati } = motore(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit(utente('Fai partire i test e poi correggi gli errori che trovi, grazie'))
  inviati.length = 0

  await $.classic.StopFailure({ error: 'rate_limit' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Bloccato/ }))?.text).toContain('5 ore')
  await ui.unmount()

  // Due ore al reset, più un minuto di margine.
  await clock.advance(2 * 3600000)
  expect(inviati).toEqual([])
  await clock.advance(60000)
  expect(inviati).toEqual(['Riprendi'])
})

test('in inglese invia "Resume"', async ($, on) => {
  const { clock, inviati } = motore(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit(utente('Please run the tests and fix what you find'))
  inviati.length = 0
  await $.classic.StopFailure({ error: 'rate_limit' })
  await clock.advance(3 * 3600000)
  expect(inviati).toEqual(['Resume'])
})

test('se l\'utente scrive durante l\'attesa il timer si annulla', async ($, on) => {
  const { clock, inviati } = motore(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.classic.StopFailure({ error: 'rate_limit' })
  await $.prompt.submit(utente('lascia stare, ci penso io adesso'))
  inviati.length = 0
  await clock.advance(3 * 3600000)
  expect(inviati).toEqual([])
})

test('spenta non riprende, e il pannello lo dice su ogni surface', async ($, on) => {
  const { clock, inviati } = motore(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') await ui.press({ key: 'toggle' })
    expect((await ui.find({ type: 'Text', text: /Ripresa automatica spenta/ }))?.text).toContain('spenta')
    await ui.unmount()
  }
  await $.classic.StopFailure({ error: 'rate_limit' })
  await clock.advance(3 * 3600000)
  expect(inviati).toEqual([])
})

test('un errore che non è un limite non arma il timer', async ($, on) => {
  const { clock, inviati } = motore(on, 40)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.classic.StopFailure({ error: 'server_error' })
  await clock.advance(3 * 3600000)
  expect(inviati).toEqual([])
})

test('il toggle accende Remote Control e push, e allo spegnimento rimette tutto', async ($, on) => {
  const { cfg, comandi } = motore(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'remoto' })
  expect(comandi).toEqual(['remote-control'])
  expect(cfg).toEqual({ remoteControl: 'true', agentPushNotifEnabled: true })
  await ui.press({ key: 'remoto' })
  expect(cfg).toEqual({ remoteControl: 'default', agentPushNotifEnabled: false })
  await ui.unmount()
})

test('con il remoto acceso avvisa per domanda e permesso, nella lingua della conversazione', async ($, on) => {
  const { push, clock } = motore(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit(utente('Fai partire i test e poi correggi gli errori che trovi, grazie'))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'remoto' })
  await ui.unmount()

  await $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Quale database usiamo?', header: 'DB', options: [], multiSelect: false }] } as never)
  await clock.settle()
  expect(push).toEqual(['Claude ti fa una domanda: Quale database usiamo?'])

  // La stessa domanda dal dialogo, subito dopo, non si ripete.
  await $.classic.Notification({ message: 'Claude needs your input', notification_type: 'elicitation_dialog' })
  await clock.settle()
  expect(push.length).toBe(1)

  await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' })
  await clock.settle()
  expect(push[1]).toBe('Claude chiede un permesso: Claude needs your permission to use Bash')
})

test('un avviso tolto dalla lista non manda la push; col remoto spento nessuna push', async ($, on) => {
  const { push, clock } = motore(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'ExitPlanMode' } as never)
  await clock.settle()
  expect(push).toEqual([])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'remoto' })
  await ui.press({ key: 'avviso-piano' })
  await ui.unmount()
  await $.tool.call({ tool: 'ExitPlanMode' } as never)
  await clock.settle()
  expect(push).toEqual([])
})

test('al limite avvisa con l\'orario di ripresa', async ($, on) => {
  const { push, clock } = motore(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'remoto' })
  await ui.unmount()
  await $.classic.StopFailure({ error: 'rate_limit' })
  await clock.settle()
  expect(push.length).toBe(1)
  expect(push[0]).toContain('5 ore')
})

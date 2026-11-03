import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, Timer } from 'claude-code'

import type { Attesa, Config, Evento, Lingua, Remoto, StatoRemoto, Statistiche, TipoAvviso, UltimaPush, Uso } from '../types'
import {
  CONFIG_BASE, NOME_LINGUA, PAROLA, STATS_VUOTE, attesaMedia, blocchiSettimana, calcolaReset, clampMargine,
  conBlocco, conRipresa, configValida, daMotore, durataBreve, giorno, hms, linguaEffettiva, nomeLimite,
  orario, prossimaLingua, quandoReset, rilevaLingua, riprendiAlle, statsValide, token,
} from './logica'
import { LAVORO_LUNGO_MS, MOTIVO, REMOTO_BASE, TIPI, domandaDa, eRipetizione, remotoValido, testoPush } from './avvisi'

const PANE = 'afc'
const TITOLO = 'AFC · Away from Claude'
const OGNI_MS = 15000
/** Riprese consecutive senza orario di reset prima di arrendersi. */
const MAX_TENTATIVI = 12

// Cambia il tag quando cambia la forma: rifiuta i valori salvati da una versione precedente.
const config = atom({ plugin: 'afc', key: 'config' } as const, CONFIG_BASE as Config, { shape: 'config-1' })
const linguaRilevata = atom({ plugin: 'afc', key: 'linguaRilevata' } as const, 'en' as Lingua, { shape: 'lingua-1' })
const uso = atom({ plugin: 'afc', key: 'uso' } as const, { limiti: [], ctxFinestra: 0 } as Uso, { shape: 'uso-1' })
const attesa = atom({ plugin: 'afc', key: 'attesa' } as const, null as Attesa | null, { shape: 'attesa-1' })
const evento = atom({ plugin: 'afc', key: 'evento' } as const, null as Evento | null, { shape: 'evento-1' })
const stats = atom({ plugin: 'afc', key: 'stats' } as const, STATS_VUOTE as Statistiche, { shape: 'stats-2' })
const ora = atom({ plugin: 'afc', key: 'ora' } as const, 0, { shape: 'ora-1' })
const remoto = atom({ plugin: 'afc', key: 'remoto' } as const, REMOTO_BASE as Remoto, { shape: 'remoto-1' })
const ultimaPush = atom({ plugin: 'afc', key: 'ultimaPush' } as const, null as UltimaPush | null, { shape: 'push-1' })
const statoRemoto = atom({ plugin: 'afc', key: 'statoRemoto' } as const, null as StatoRemoto | null, { shape: 'stato-remoto-1' })

// In $.store: valgono anche nelle sessioni dopo. Gli atom ne sono la copia che ridisegna.
const K_CONFIG = 'config'
const K_STATS = 'stats'
const K_LINGUA = 'linguaRilevata'
const K_REMOTO = 'remoto'

// Impostazioni del motore che la mod tocca per il controllo remoto.
const CFG_RC = 'remoteControl'
const CFG_PUSH = 'agentPushNotifEnabled'

// Colori del tema dell'utente: seguono chiaro, scuro e daltonici.
const C = {
  accento: 'claude',
  ok: 'success',
  attenzione: 'warning',
  errore: 'error',
  info: 'suggestion',
  viola: 'merged',
  dim: 'inactive',
  tenue: 'subtle',
  testo: 'text',
}

const colorePct = (p: number) => (p >= 90 ? C.errore : p >= 70 ? C.attenzione : C.ok)

// Il timer vive nel modulo: a ogni ricarica si riprogramma da `attesa`, che sta in $.state.
let timer: Timer | undefined
let tentativi = 0

async function caricaDalloStore($: EngineInterface) {
  const c = configValida(await $.store.get(K_CONFIG).catch(() => undefined))
  const s = statsValide(await $.store.get(K_STATS).catch(() => undefined))
  const r = remotoValido(await $.store.get(K_REMOTO).catch(() => undefined))
  const l = await $.store.get(K_LINGUA).catch(() => undefined)
  await update($, config, () => c)
  await update($, stats, () => s)
  await update($, remoto, () => r)
  if (typeof l === 'string' && l in PAROLA) await update($, linguaRilevata, () => l as Lingua)
}

async function impostaConfig($: EngineInterface, fn: (c: Config) => Config) {
  const c = fn(await read($, config))
  await update($, config, () => c)
  await $.store.set(K_CONFIG, c)
  await programma($)
}

async function impostaStats($: EngineInterface, fn: (s: Statistiche) => Statistiche) {
  const s = fn(await read($, stats))
  await update($, stats, () => s)
  await $.store.set(K_STATS, s)
}

async function impostaRemoto($: EngineInterface, fn: (r: Remoto) => Remoto) {
  const r = fn(await read($, remoto))
  await update($, remoto, () => r)
  await $.store.set(K_REMOTO, r)
}

async function lingua($: EngineInterface): Promise<Lingua> {
  return linguaEffettiva(await read($, config), await read($, linguaRilevata))
}

async function leggiUso($: EngineInterface) {
  try {
    const u = await $.session.usage()
    await registraUso($, u)
  } catch { /* nessuna lettura: si tiene l'ultima */ }
}

async function registraUso($: EngineInterface, u: { rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]; context: { tokens?: number; window: number; percent?: number }; cost?: { usd: number } }) {
  const nuovo: Uso = {
    limiti: daMotore(u.rateLimits),
    ctxFinestra: u.context.window,
    ...(u.context.tokens !== undefined ? { ctxToken: u.context.tokens } : {}),
    ...(u.context.percent !== undefined ? { ctxPct: u.context.percent } : {}),
    ...(u.cost ? { costoUsd: u.cost.usd } : {}),
  }
  await update($, uso, () => nuovo)
}

// ── Notifiche push ──────────────────────────────────────────────────────

/** Manda la push del tipo dato, se il controllo remoto è acceso e l'utente vuole quell'avviso. */
async function avvisa($: EngineInterface, tipo: TipoAvviso, dettaglio = '') {
  try {
    const r = await read($, remoto)
    if (!r.attivo || !r.avvisi[tipo]) return
    const adesso = await $.clock.now()
    if (eRipetizione(await read($, ultimaPush), tipo, adesso)) return
    const testo = testoPush(tipo, await lingua($), dettaglio)
    // Il segno si mette prima dell'invio: due eventi quasi insieme non mandano due push.
    await update($, ultimaPush, () => ({ quando: adesso, tipo, testo, esito: 'saltata' as const, motivo: 'invio…' }))
    const res = await $.tool.call({ tool: 'PushNotification', message: testo, status: 'proactive' })
    const out = (res as { result?: { pushSent?: boolean; localSent?: boolean; disabledReason?: string }; isError?: boolean; text?: string })
    const v = out.result ?? {}
    const esito: UltimaPush['esito'] = v.pushSent ? 'inviata' : v.localSent ? 'locale' : 'saltata'
    const motivo = out.isError ? (out.text ?? 'errore') : v.disabledReason ? (MOTIVO[v.disabledReason] ?? v.disabledReason) : undefined
    await update($, ultimaPush, () => ({ quando: adesso, tipo, testo, esito, ...(motivo ? { motivo } : {}) }))
    if (esito === 'inviata') await impostaStats($, s => ({ ...s, pushInviate: s.pushInviate + 1 }))
  } catch (err) {
    const adesso = await $.clock.now()
    await update($, ultimaPush, u => ({ quando: adesso, tipo, testo: u?.testo ?? tipo, esito: 'saltata' as const, motivo: String(err) }))
  }
}

/** Una riga di impostazioni del motore, se c'è. */
async function rigaConfig($: EngineInterface, key: string) {
  const righe = await $.config.list().catch(() => [])
  return righe.find(r => r.key === key)
}

/** Imposta una riga del motore se non è bloccata; dice com'era prima. */
async function cambiaConfig($: EngineInterface, key: string, valore: string | boolean): Promise<{ ok: boolean; prima?: unknown; motivo?: string }> {
  const riga = await rigaConfig($, key)
  if (!riga) return { ok: false, motivo: 'impostazione assente' }
  if (riga.isLocked) return { ok: false, prima: riga.value, motivo: 'impostazione bloccata' }
  if (riga.value === valore) return { ok: true, prima: riga.value }
  try {
    const r = await $.config.set({ key, value: valore as never })
    if ((r as { deny?: string }).deny) return { ok: false, prima: riga.value, motivo: (r as { deny?: string }).deny }
    return { ok: true, prima: riga.value }
  } catch (err) {
    return { ok: false, prima: riga.value, motivo: String(err) }
  }
}

/** Accende Remote Control (sessione corrente e impostazione) e le push dello strumento. */
async function accendiRemoto($: EngineInterface) {
  const adesso = await $.clock.now()
  const note: string[] = []
  let ok = false
  // La sessione si collega subito col comando, dove c'è; l'impostazione vale per le sessioni dopo.
  const comandi = await $.command.list().catch(() => [])
  if (comandi.some(c => c.name === 'remote-control')) {
    try {
      await $.command.run({ command: 'remote-control', args: '' })
      ok = true
      note.push('sessione collegata')
    } catch (err) {
      note.push(`collegamento non riuscito: ${String(err)}`)
    }
  }
  const rc = await cambiaConfig($, CFG_RC, 'true')
  if (rc.ok) ok = true
  else if (!ok) note.push(`Remote Control: ${rc.motivo}`)
  const push = await cambiaConfig($, CFG_PUSH, true)
  if (!push.ok) note.push(`push: ${push.motivo}`)
  await impostaRemoto($, r => ({
    ...r,
    attivo: true,
    ...(rc.ok && rc.prima !== 'true' && typeof rc.prima === 'string' ? { rcPrima: rc.prima } : {}),
    ...(push.ok && push.prima !== true && typeof push.prima === 'boolean' ? { pushPrima: push.prima } : {}),
  }))
  await update($, statoRemoto, () => ({ quando: adesso, ok, testo: ok ? `acceso${note.length ? ' · ' + note.join(' · ') : ''}` : note.join(' · ') || 'Remote Control non disponibile' }))
  $.ui.toast(ok ? 'AFC: Remote Control e notifiche accesi.' : 'AFC: notifiche accese, Remote Control non disponibile qui.')
}

/** Spegne le push e rimette le impostazioni del motore come le aveva l'utente. */
async function spegniRemoto($: EngineInterface) {
  const adesso = await $.clock.now()
  const r = await read($, remoto)
  if (r.rcPrima !== undefined) await cambiaConfig($, CFG_RC, r.rcPrima)
  if (r.pushPrima !== undefined) await cambiaConfig($, CFG_PUSH, r.pushPrima)
  await impostaRemoto($, x => ({ attivo: false, avvisi: x.avvisi }))
  await update($, statoRemoto, () => ({ quando: adesso, ok: true, testo: 'spento · un collegamento già aperto si chiude dal telefono o con /remote-control' }))
  $.ui.toast('AFC: notifiche spente.')
}

// ── Auto-Resume ─────────────────────────────────────────────────────────

/** Riprogramma (o cancella) il timer di ripresa secondo `attesa` e `config`. */
async function programma($: EngineInterface) {
  timer?.cancel()
  timer = undefined
  const a = await read($, attesa)
  const c = await read($, config)
  if (!a || !c.attivo) {
    $.ui.status(undefined)
    return
  }
  const quando = riprendiAlle(a, c)
  const adesso = await $.clock.now()
  timer = $.clock.after(Math.max(0, quando - adesso), () => void riprendi($))
  $.ui.status(`⟳ ripresa alle ${orario(quando)}`)
}

/** La sessione si è bloccata per un limite: si annota e si programma la ripresa. */
async function blocco($: EngineInterface) {
  await leggiUso($)
  const adesso = await $.clock.now()
  const prima = await read($, attesa)
  const r = calcolaReset((await read($, uso)).limiti, adesso)
  if (r.stimato) tentativi += 1
  if (r.stimato && tentativi > MAX_TENTATIVI) {
    await update($, attesa, () => null)
    await update($, evento, () => ({ quando: adesso, tipo: 'rifiutata' as const, testo: `nessun orario di reset dopo ${MAX_TENTATIVI} tentativi: ripresa sospesa` }))
    await programma($)
    return
  }
  // Un nuovo blocco mentre si attende già (o subito dopo una ripresa fallita) conta una volta.
  if (!prima) await impostaStats($, s => conBlocco(s, adesso))
  await update($, attesa, () => ({ ...r, da: prima?.da ?? adesso }))
  await update($, ora, () => adesso)
  await programma($)
  const c = await read($, config)
  const a = await read($, attesa)
  if (a) {
    $.ui.toast(c.attivo
      ? `Limite ${nomeLimite(a.limite)} raggiunto: riprendo alle ${orario(riprendiAlle(a, c))}.`
      : `Limite ${nomeLimite(a.limite)} raggiunto. Ripresa automatica disattivata.`)
    if (!prima) void avvisa($, 'limite', c.attivo ? `${nomeLimite(a.limite)} → ${orario(riprendiAlle(a, c))}` : nomeLimite(a.limite))
  }
}

/** Il momento è arrivato: si invia il messaggio di ripresa nella lingua della conversazione. */
async function riprendi($: EngineInterface) {
  timer = undefined
  const a = await read($, attesa)
  const c = await read($, config)
  if (!a || !c.attivo) return
  const testo = PAROLA[await lingua($)]
  const adesso = await $.clock.now()
  await update($, attesa, () => null)
  $.ui.status(undefined)
  try {
    const r = await $.prompt.submit({ text: testo, asUser: true })
    if (r.drop !== undefined) {
      await update($, evento, () => ({ quando: adesso, tipo: 'rifiutata' as const, testo: `"${testo}" non inviato: ${r.drop}` }))
      return
    }
    await impostaStats($, s => conRipresa(s, adesso, adesso - a.da))
    await update($, evento, () => ({ quando: adesso, tipo: 'ripresa' as const, testo: `inviato "${testo}"` }))
    $.ui.toast(`AFC: inviato "${testo}".`)
    void avvisa($, 'ripresa')
  } catch (err) {
    await update($, evento, () => ({ quando: adesso, tipo: 'rifiutata' as const, testo: `"${testo}" non inviato: ${String(err)}` }))
  }
}

async function annulla($: EngineInterface, motivo: string) {
  if (!(await read($, attesa))) return
  await update($, attesa, () => null)
  const t = await $.clock.now()
  await update($, evento, () => ({ quando: t, tipo: 'annullata' as const, testo: motivo }))
  await programma($)
}

async function segnaOra($: EngineInterface) {
  const t = await $.clock.now()
  await update($, ora, () => t)
}

const daUtente = (o: { kind: string } | undefined) => o === undefined || o.kind === 'composer' || o.kind === 'bridge'

/** La prima frase di una risposta, per la push "lavoro finito". */
const primaFrase = (s: string) => s.replace(/[#*`>_]/g, '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] ?? ''

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'afc', description: 'Apre il pannello AFC · Away from Claude: auto-resume, controllo remoto, notifiche, limiti e statistiche' })
    void $.ui.open({ id: PANE, title: TITOLO })
    await caricaDalloStore($)
    await leggiUso($)
    // Un'attesa scaduta mentre il modulo non c'era si riprende subito; una ricarica riprogramma il timer.
    await programma($)
    await segnaOra($)
    $.clock.every(OGNI_MS, () => void segnaOra($))
    return next(e)
  })

  on('command.run', { command: 'afc' }, async $ => {
    await leggiUso($)
    await $.ui.open({ id: PANE, title: TITOLO, focus: true })
    return { text: 'Pannello AFC aperto.' }
  })

  // Il motore classifica l'errore che ha fermato il turno: `rate_limit` è il limite d'uso.
  on('classic.StopFailure', async ($, e, next) => {
    if (!e.agent_id) {
      if (e.error === 'rate_limit') await blocco($)
      else void avvisa($, 'errore', e.error_details || e.error)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Le notifiche del motore: un permesso da dare, Claude che aspetta, un dialogo di domanda.
  on('classic.Notification', async ($, e, next) => {
    if (!e.agent_id) {
      if (e.notification_type === 'permission_prompt') void avvisa($, 'permesso', e.message)
      else if (e.notification_type === 'idle_prompt') void avvisa($, 'attesa', e.message)
      else if (e.notification_type === 'elicitation_dialog') void avvisa($, 'domanda', e.message)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    void avvisa($, 'domanda', domandaDa(e))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'ExitPlanMode' }, async ($, e, next) => {
    void avvisa($, 'piano')
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      if (e.reason === 'answer') {
        tentativi = 0
        if (e.durationMs >= LAVORO_LUNGO_MS) void avvisa($, 'finito', primaFrase(e.answer))
      }
      // Rete di sicurezza: turno morto su errore con una finestra esaurita.
      if (e.reason === 'error' && !(await read($, attesa))) {
        await leggiUso($)
        if ((await read($, uso)).limiti.some(l => l.pct >= 100)) await blocco($)
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // I messaggi dell'utente dicono la lingua; se scrive durante l'attesa, ci pensa lui.
  on('prompt.submit', async ($, e, next) => {
    if (daUtente(e.origin as { kind: string } | undefined)) {
      const l = rilevaLingua(e.text)
      if (l && l !== (await read($, linguaRilevata))) {
        await update($, linguaRilevata, () => l)
        await $.store.set(K_LINGUA, l)
      }
      await annulla($, 'annullata: hai scritto tu')
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    await registraUso($, e)
    return next(e)
  }).catch(($, e, next) => next(e))

  // Se un modulo animato va in errore su un surface, lì lo si disegna statico.
  const guasti = new Set<string>()
  on('ui.fault', async ($, e, next) => {
    const k = `${e.surface}:${e.module}`
    if (e.requestId === PANE && !guasti.has(k)) {
      guasti.add(k)
      $.ui.log(`afc: ${e.module} in errore su ${e.surface} (${e.phase}: ${e.reason}); lo disegno senza animazione`)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const hasClient = 'Client' in els
    const hasBar = hasClient && !guasti.has(`${e.surface}:bar.tsx`)
    const hasCd = hasClient && !guasti.has(`${e.surface}:countdown.tsx`)

    const c = await read($, config)
    const rilevata = await read($, linguaRilevata)
    const u = await read($, uso)
    const a = await read($, attesa)
    const ev = await read($, evento)
    const s = await read($, stats)
    const rm = await read($, remoto)
    const up = await read($, ultimaPush)
    const sr = await read($, statoRemoto)
    const adesso = (await read($, ora)) || (await $.clock.now())
    const lin = linguaEffettiva(c, rilevata)

    const W = Math.max(28, e.props.bodyColumns)
    const dentro = W - 4

    const riga = (sinistra: RenderChildren, destra: RenderChildren | null, width = dentro) => (
      <Box width={width} justifyContent="space-between" columnGap={1}>
        <Box flexShrink={1} overflow="hidden">{sinistra}</Box>
        {destra !== null && <Box flexShrink={0}>{destra}</Box>}
      </Box>
    )

    const card = (titolo: RenderChildren, colore: string, figli: RenderChildren, acceso = true) => (
      <Box flexDirection="column" borderStyle="round" borderColor={colore} borderDimColor={!acceso} paddingX={1} width={W}>
        {typeof titolo === 'string' ? <Text color={colore} bold>{titolo}</Text> : titolo}
        {figli}
      </Box>
    )

    const spia = (acceso: boolean) => (acceso ? <Text color={C.ok} bold>● ON</Text> : <Text color={C.dim} bold>○ OFF</Text>)

    const barra = (key: string, pct: number, width: number, color: string, active: boolean) => {
      const w = Math.max(4, width)
      if (hasBar) {
        return (
          <els.Client key={key} module="./bar.tsx" width={w} height={1}
            props={{ pct: Math.min(100, pct), width: w, color, dim: C.tenue, shine: C.testo, active }} />
        )
      }
      const n = Math.max(0, Math.min(w, Math.round((Math.min(100, pct) / 100) * w)))
      return (
        <Text mono>
          <Text color={color}>{'━'.repeat(n)}</Text>
          <Text color={C.tenue}>{'─'.repeat(w - n)}</Text>
        </Text>
      )
    }

    const countdown = (key: string, fine: number) =>
      hasCd
        ? <els.Client key={key} module="./countdown.tsx" props={{ endAt: fine, now: adesso, color: C.attenzione, doneColor: C.ok, done: '⟳ ripresa in corso…', bold: true }} />
        : <Text color={C.attenzione} bold>{fine > adesso ? `⏱ ${hms(fine - adesso)}` : '⟳ ripresa in corso…'}</Text>

    // ── Intestazione ──
    const testata = riga(<Text color={C.accento} bold>✈ AFC · Away from Claude</Text>, null, W)

    // ── Auto-Resume ──
    const statoFigli: RenderChildren[] = []
    if (a) {
      const quando = riprendiAlle(a, c)
      statoFigli.push(<Text color={C.attenzione}>⏸ Bloccato: limite {nomeLimite(a.limite)}</Text>)
      if (c.attivo) {
        statoFigli.push(riga(<Text>Ripresa alle <Text bold>{orario(quando)}</Text></Text>, countdown('cd', quando)))
        statoFigli.push(
          <Text color={C.dim} wrap="truncate">
            {a.stimato ? 'orario di reset non noto: nuovo tentativo' : `reset ${quandoReset(a.resetAt, adesso)} + margine ${c.margineMin} min`}
          </Text>,
        )
      } else {
        statoFigli.push(<Text color={C.dim}>reset {quandoReset(a.resetAt, adesso)} · ripresa automatica spenta</Text>)
      }
      statoFigli.push(<Text>Messaggio: <Text color={C.info}>"{PAROLA[lin]}"</Text> <Text color={C.dim}>({lin} · {c.lingua === 'auto' ? 'auto' : 'manuale'})</Text></Text>)
    } else {
      statoFigli.push(c.attivo
        ? <Text color={C.ok}>✓ Al lavoro: nessun limite raggiunto</Text>
        : <Text color={C.dim}>Ripresa automatica spenta</Text>)
      statoFigli.push(<Text color={C.dim}>Al blocco invierò <Text color={C.info}>"{PAROLA[lin]}"</Text></Text>)
      if (ev) {
        const col = ev.tipo === 'ripresa' ? C.ok : ev.tipo === 'annullata' ? C.dim : C.errore
        statoFigli.push(<Text color={col} wrap="truncate">{orario(ev.quando)} · {ev.testo}</Text>)
      }
    }
    const coloreStato = a ? C.attenzione : c.attivo ? C.ok : C.tenue

    // ── Remoto e notifiche ──
    const remotoFigli: RenderChildren[] = [
      riga(
        <Button key="remoto" plain hotkey="t" label={`[${rm.attivo ? '✓' : ' '}] Remote Control e notifiche`}
          onPress={() => void (rm.attivo ? spegniRemoto($) : accendiRemoto($))} />,
        null,
      ),
    ]
    if (sr) remotoFigli.push(<Text color={sr.ok ? C.dim : C.errore} wrap="truncate">{orario(sr.quando)} · {sr.testo}</Text>)
    remotoFigli.push(<Text color={C.dim}>Avvisami sul telefono per:</Text>)
    // Due colonne quando c'è spazio, una sola su un pannello stretto.
    const colonne = dentro >= 52 ? 2 : 1
    const voce = (i: number) => {
      const t = TIPI[i]
      if (!t) return null
      const scelto = rm.avvisi[t.tipo]
      return (
        <Box width={Math.floor(dentro / colonne)} flexShrink={0}>
          <Button key={`avviso-${t.tipo}`} plain dimColor={!rm.attivo} hotkey={String(i + 1)}
            label={`[${scelto ? '✓' : ' '}] ${t.etichetta}`}
            onPress={() => void impostaRemoto($, x => ({ ...x, avvisi: { ...x.avvisi, [t.tipo]: !x.avvisi[t.tipo] } }))} />
        </Box>
      )
    }
    for (let i = 0; i < TIPI.length; i += colonne) {
      remotoFigli.push(<Box width={dentro}>{voce(i)}{colonne === 2 ? voce(i + 1) : null}</Box>)
    }
    if (up) {
      const col = up.esito === 'inviata' ? C.ok : up.esito === 'locale' ? C.info : C.dim
      const etichetta = TIPI.find(t => t.tipo === up.tipo)?.etichetta ?? up.tipo
      remotoFigli.push(
        <Text color={col} wrap="truncate">
          Ultima: {orario(up.quando)} · {etichetta} · {up.esito === 'inviata' ? 'inviata' : up.esito === 'locale' ? 'solo sul PC' : 'non inviata'}{up.motivo ? ` (${up.motivo})` : ''}
        </Text>,
      )
    }

    // ── Limiti ──
    const larghezzaEtichetta = 11
    const larghezzaBarra = Math.max(6, dentro - larghezzaEtichetta - 6)
    const rigaBarra = (key: string, nome: string, pct: number | undefined, sotto: string, colore?: string) => (
      <Box flexDirection="column" width={dentro}>
        <Box width={dentro} columnGap={1}>
          <Box width={larghezzaEtichetta - 1} flexShrink={0}><Text wrap="truncate">{nome}</Text></Box>
          {pct === undefined
            ? <Text color={C.dim}>—</Text>
            : barra(key, pct, larghezzaBarra, colore ?? colorePct(pct), !!a && pct >= 100)}
          <Box flexShrink={0} width={5} justifyContent="flex-end">
            <Text color={pct === undefined ? C.dim : colore ?? colorePct(pct)}>{pct === undefined ? '' : `${Math.round(pct)}%`}</Text>
          </Box>
        </Box>
        {sotto !== '' && <Box paddingLeft={larghezzaEtichetta}><Text color={C.dim} wrap="truncate">{sotto}</Text></Box>}
      </Box>
    )
    const limitiFigli: RenderChildren[] = u.limiti.length
      ? u.limiti.map(l => rigaBarra(`bar-${l.kind}`, nomeLimite(l.kind), l.pct, l.resetAt ? `reset ${quandoReset(l.resetAt, adesso)}` : ''))
      : [<Text color={C.dim}>Nessuna lettura dei limiti (arriva con la prima risposta, solo in abbonamento)</Text>]
    const ctxPct = u.ctxPct ?? (u.ctxToken !== undefined && u.ctxFinestra ? (u.ctxToken / u.ctxFinestra) * 100 : undefined)
    limitiFigli.push(rigaBarra('bar-ctx', 'Contesto', ctxPct,
      u.ctxToken !== undefined ? `${token(u.ctxToken)} / ${token(u.ctxFinestra)} token` : u.ctxFinestra ? `finestra ${token(u.ctxFinestra)} token` : '', C.info))

    // ── Statistiche ──
    const media = attesaMedia(s)
    const stat = (nome: string, valore: string) => riga(<Text color={C.dim}>{nome}</Text>, <Text>{valore}</Text>)
    const statFigli = [
      stat('Riprese automatiche', `oggi ${s.ripreseGiorno[giorno(adesso)] ?? 0} · tot ${s.ripreseTotali}`),
      stat('Limiti raggiunti', `sett. ${blocchiSettimana(s, adesso)}`),
      stat('Attesa media reset', media === undefined ? '—' : durataBreve(media)),
      stat('Notifiche inviate', String(s.pushInviate)),
      stat('Costo sessione', u.costoUsd === undefined ? '—' : `$${u.costoUsd.toFixed(2)}`),
    ]

    // ── Impostazioni di Auto-Resume ──
    const nomeLingua = c.lingua === 'auto' ? `Auto: ${NOME_LINGUA[rilevata]}` : NOME_LINGUA[c.lingua]
    const impFigli: RenderChildren[] = [
      riga(
        <Button key="toggle" plain hotkey="a" label={`[${c.attivo ? '✓' : ' '}] Ripresa automatica`}
          onPress={() => void impostaConfig($, x => ({ ...x, attivo: !x.attivo }))} />,
        null,
      ),
      riga(
        <Box columnGap={1}>
          <Text>Lingua</Text>
          <Button key="lingua" plain hotkey="l" label={`‹ ${nomeLingua} ›`}
            onPress={() => void impostaConfig($, x => ({ ...x, lingua: prossimaLingua(x.lingua) }))} />
        </Box>,
        null,
      ),
      riga(
        <Box columnGap={1}>
          <Text>Margine</Text>
          <Button key="meno" plain hotkey="m" label="−" onPress={() => void impostaConfig($, x => ({ ...x, margineMin: clampMargine(x.margineMin - 1) }))} />
          <Text bold>{c.margineMin} min</Text>
          <Button key="piu" plain hotkey="p" label="+" onPress={() => void impostaConfig($, x => ({ ...x, margineMin: clampMargine(x.margineMin + 1) }))} />
        </Box>,
        null,
      ),
    ]
    if (a && c.attivo) {
      impFigli.push(riga(
        <Button key="ora" plain dimColor hotkey="r" label="⟳ riprendi ora" onPress={() => void riprendi($)} />,
        <Button key="annulla" plain dimColor hotkey="x" label="✕ annulla attesa" onPress={() => void annulla($, 'annullata dal pannello')} />,
      ))
    }

    return (
      <Box flexDirection="column" width={W}>
        {testata}
        {card(riga(<Text color={coloreStato} bold>Auto-Resume</Text>, spia(c.attivo)), coloreStato, statoFigli)}
        {card(riga(<Text color={rm.attivo ? C.info : C.tenue} bold>Remoto e notifiche</Text>, spia(rm.attivo)), rm.attivo ? C.info : C.tenue, remotoFigli, rm.attivo)}
        {card('Limiti', C.tenue, limitiFigli, false)}
        {card('Statistiche', C.tenue, statFigli, false)}
        {card('Impostazioni Auto-Resume', C.accento, impFigli, false)}
      </Box>
    )
  })
}

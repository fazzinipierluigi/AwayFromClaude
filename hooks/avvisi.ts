// Notifiche push sul telefono: tipi di avviso, impostazioni e testi nelle lingue supportate.
import type { Lingua, Remoto, TipoAvviso } from '../types'

/** Ordine nel pannello: il tasto del tipo è la sua posizione (1–9). */
export const TIPI: { tipo: TipoAvviso; etichetta: string; base: boolean }[] = [
  { tipo: 'permesso', etichetta: 'Permesso richiesto', base: true },
  { tipo: 'domanda', etichetta: 'Domanda di Claude', base: true },
  { tipo: 'piano', etichetta: 'Piano da approvare', base: true },
  { tipo: 'attesa', etichetta: 'Claude ti aspetta', base: false },
  { tipo: 'finito', etichetta: 'Lavoro lungo finito', base: true },
  { tipo: 'limite', etichetta: 'Limite raggiunto', base: true },
  { tipo: 'ripresa', etichetta: 'Sessione ripresa', base: false },
  { tipo: 'errore', etichetta: 'Errore che ferma', base: true },
  { tipo: 'coda', etichetta: 'Coda completata', base: true },
]

/** Un turno conta come "lavoro lungo" da questa durata. */
export const LAVORO_LUNGO_MS = 2 * 60 * 1000

/** La stessa notifica entro questo tempo non si ripete. */
export const RIPETIZIONE_MS = 30 * 1000

/** I sistemi mobili troncano oltre questa lunghezza. */
export const MAX_PUSH = 180

export const REMOTO_BASE: Remoto = {
  attivo: false,
  avvisi: Object.fromEntries(TIPI.map(t => [t.tipo, t.base])) as Record<TipoAvviso, boolean>,
}

export function remotoValido(v: unknown): Remoto {
  if (!v || typeof v !== 'object') return REMOTO_BASE
  const o = v as Partial<Remoto>
  const av = o.avvisi && typeof o.avvisi === 'object' ? o.avvisi : {}
  return {
    attivo: typeof o.attivo === 'boolean' ? o.attivo : false,
    avvisi: Object.fromEntries(TIPI.map(t => {
      const x = (av as Record<string, unknown>)[t.tipo]
      return [t.tipo, typeof x === 'boolean' ? x : t.base]
    })) as Record<TipoAvviso, boolean>,
    ...(typeof o.rcPrima === 'string' ? { rcPrima: o.rcPrima } : {}),
    ...(typeof o.pushPrima === 'boolean' ? { pushPrima: o.pushPrima } : {}),
  }
}

/** Perché il motore non ha mandato la push al telefono, in parole. */
export const MOTIVO: Record<string, string> = {
  config_off: 'push spente nelle impostazioni',
  user_present: 'sei al PC',
  no_transport: 'telefono non collegato',
}

type Testi = Record<TipoAvviso, string>

// `{x}` è il dettaglio: la domanda, il permesso, il limite, l'errore, la risposta.
const TESTI: Record<Lingua, Testi> = {
  it: {
    permesso: 'Claude chiede un permesso: {x}',
    domanda: 'Claude ti fa una domanda: {x}',
    piano: 'Claude ha un piano da approvare',
    attesa: 'Claude ti aspetta: {x}',
    finito: 'Claude ha finito: {x}',
    limite: 'Limite raggiunto: {x}',
    ripresa: 'Sessione ripresa dopo il limite',
    errore: 'Lavoro fermato da un errore: {x}',
    coda: 'Coda di lavoro finita: {x}',
  },
  en: {
    permesso: 'Claude needs a permission: {x}',
    domanda: 'Claude has a question: {x}',
    piano: 'Claude has a plan for you to approve',
    attesa: 'Claude is waiting for you: {x}',
    finito: 'Claude is done: {x}',
    limite: 'Usage limit reached: {x}',
    ripresa: 'Session resumed after the limit',
    errore: 'Work stopped by an error: {x}',
    coda: 'Work queue finished: {x}',
  },
  fr: {
    permesso: 'Claude demande une autorisation : {x}',
    domanda: 'Claude a une question : {x}',
    piano: 'Claude a un plan à approuver',
    attesa: 'Claude vous attend : {x}',
    finito: 'Claude a terminé : {x}',
    limite: 'Limite atteinte : {x}',
    ripresa: 'Session reprise après la limite',
    errore: 'Travail arrêté par une erreur : {x}',
    coda: 'File de travail terminée : {x}',
  },
  de: {
    permesso: 'Claude braucht eine Berechtigung: {x}',
    domanda: 'Claude hat eine Frage: {x}',
    piano: 'Claude hat einen Plan zur Freigabe',
    attesa: 'Claude wartet auf dich: {x}',
    finito: 'Claude ist fertig: {x}',
    limite: 'Limit erreicht: {x}',
    ripresa: 'Sitzung nach dem Limit fortgesetzt',
    errore: 'Arbeit durch einen Fehler gestoppt: {x}',
    coda: 'Arbeitswarteschlange fertig: {x}',
  },
  es: {
    permesso: 'Claude necesita un permiso: {x}',
    domanda: 'Claude tiene una pregunta: {x}',
    piano: 'Claude tiene un plan para aprobar',
    attesa: 'Claude te espera: {x}',
    finito: 'Claude ha terminado: {x}',
    limite: 'Límite alcanzado: {x}',
    ripresa: 'Sesión reanudada tras el límite',
    errore: 'Trabajo detenido por un error: {x}',
    coda: 'Cola de trabajo terminada: {x}',
  },
  pt: {
    permesso: 'Claude precisa de uma permissão: {x}',
    domanda: 'Claude tem uma pergunta: {x}',
    piano: 'Claude tem um plano para aprovar',
    attesa: 'Claude está à sua espera: {x}',
    finito: 'Claude terminou: {x}',
    limite: 'Limite atingido: {x}',
    ripresa: 'Sessão retomada após o limite',
    errore: 'Trabalho parado por um erro: {x}',
    coda: 'Fila de trabalho concluída: {x}',
  },
  nl: {
    permesso: 'Claude vraagt toestemming: {x}',
    domanda: 'Claude heeft een vraag: {x}',
    piano: 'Claude heeft een plan om goed te keuren',
    attesa: 'Claude wacht op je: {x}',
    finito: 'Claude is klaar: {x}',
    limite: 'Limiet bereikt: {x}',
    ripresa: 'Sessie hervat na de limiet',
    errore: 'Werk gestopt door een fout: {x}',
    coda: 'Werkwachtrij klaar: {x}',
  },
  pl: {
    permesso: 'Claude prosi o zgodę: {x}',
    domanda: 'Claude ma pytanie: {x}',
    piano: 'Claude ma plan do zatwierdzenia',
    attesa: 'Claude czeka na ciebie: {x}',
    finito: 'Claude skończył: {x}',
    limite: 'Osiągnięto limit: {x}',
    ripresa: 'Sesja wznowiona po limicie',
    errore: 'Praca zatrzymana przez błąd: {x}',
    coda: 'Kolejka zadań zakończona: {x}',
  },
}

const unaRiga = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Il testo della push, nella lingua data e entro la lunghezza che il telefono mostra. */
export function testoPush(tipo: TipoAvviso, lingua: Lingua, dettaglio = ''): string {
  const modello = TESTI[lingua][tipo]
  const d = unaRiga(dettaglio)
  const pieno = d ? modello.replace('{x}', d) : modello.replace(/\s*[:：]\s*\{x\}$/, '').replace('{x}', '')
  return pieno.length > MAX_PUSH ? pieno.slice(0, MAX_PUSH - 1).trimEnd() + '…' : pieno
}

/** La prima domanda di un AskUserQuestion, se c'è. */
export function domandaDa(input: unknown): string {
  const qs = (input as { questions?: unknown })?.questions
  if (!Array.isArray(qs)) return ''
  const q = qs[0] as { question?: unknown } | undefined
  return typeof q?.question === 'string' ? q.question : ''
}

/**
 * Lo stesso tipo di avviso arrivato poco fa: non si ripete. Una domanda, per esempio,
 * arriva sia dalla chiamata ad AskUserQuestion sia dalla notifica del dialogo.
 */
export function eRipetizione(ultima: { tipo: TipoAvviso; quando: number } | null, tipo: TipoAvviso, adesso: number) {
  return !!ultima && ultima.tipo === tipo && adesso - ultima.quando < RIPETIZIONE_MS
}

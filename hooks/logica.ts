// Logica pura: lingua, reset, statistiche, formati. Nessuna chiamata al motore: si testa da sola.
import type { Attesa, Config, Limite, Lingua, Statistiche } from '../types'

export const LINGUE: Lingua[] = ['it', 'en', 'fr', 'de', 'es', 'pt', 'nl', 'pl']

export const NOME_LINGUA: Record<Lingua, string> = {
  it: 'Italiano', en: 'English', fr: 'Français', de: 'Deutsch',
  es: 'Español', pt: 'Português', nl: 'Nederlands', pl: 'Polski',
}

/** Il messaggio di ripresa per lingua. */
export const PAROLA: Record<Lingua, string> = {
  it: 'Riprendi', en: 'Resume', fr: 'Reprendre', de: 'Fortsetzen',
  es: 'Reanudar', pt: 'Retomar', nl: 'Hervatten', pl: 'Wznów',
}

// Parole frequenti e brevi, tipiche di ciascuna lingua (evitate quelle condivise tra lingue vicine).
const PAROLE: Record<Lingua, string[]> = {
  it: ['il', 'che', 'non', 'per', 'una', 'sono', 'questo', 'della', 'anche', 'come', 'gli', 'nel', 'perché', 'cosa', 'fai', 'puoi', 'voglio', 'deve', 'quando', 'ciao', 'grazie', 'già', 'più', 'è', 'sì', 'adesso', 'ancora', 'dove', 'dei', 'alla'],
  en: ['the', 'and', 'is', 'you', 'that', 'this', 'with', 'for', 'are', 'what', 'can', 'should', 'please', 'it', 'have', 'not', 'from', 'how', 'why', 'make', 'want', 'need', 'add', 'fix', 'use', 'then', 'there', 'which', 'would', 'into'],
  fr: ['le', 'les', 'est', 'et', 'des', 'une', 'pour', 'pas', 'que', 'vous', 'avec', 'dans', 'sur', 'ce', 'qui', 'mais', 'je', 'fais', 'peux', 'merci', 'aussi', 'très', 'où', 'ça', 'nous', 'leur', 'faire', 'être', 'au', 'du'],
  de: ['der', 'die', 'und', 'ist', 'nicht', 'das', 'ich', 'mit', 'ein', 'eine', 'auch', 'auf', 'für', 'wie', 'bitte', 'kannst', 'wir', 'noch', 'dass', 'sind', 'wenn', 'aber', 'oder', 'mach', 'jetzt', 'danke', 'zu', 'den', 'dem', 'haben'],
  es: ['el', 'los', 'las', 'y', 'es', 'que', 'por', 'una', 'con', 'para', 'del', 'como', 'pero', 'esto', 'puedes', 'hacer', 'gracias', 'también', 'muy', 'está', 'qué', 'cómo', 'porque', 'ahora', 'quiero', 'hay', 'más', 'eso', 'usted', 'tiene'],
  pt: ['os', 'é', 'que', 'são', 'então', 'aqui', 'não', 'uma', 'com', 'para', 'do', 'da', 'como', 'mas', 'isso', 'você', 'pode', 'fazer', 'obrigado', 'também', 'muito', 'está', 'porque', 'agora', 'quero', 'tem', 'seu', 'ao', 'mais', 'em'],
  nl: ['het', 'een', 'niet', 'ik', 'met', 'jij', 'heb', 'wordt', 'moet', 'graag', 'voor', 'op', 'ook', 'van', 'zijn', 'maar', 'wat', 'kun', 'kunt', 'alsjeblieft', 'dank', 'nog', 'wel', 'naar', 'deze', 'hoe', 'waarom', 'maak', 'nu', 'er'],
  pl: ['nie', 'się', 'jest', 'że', 'jak', 'ale', 'czy', 'tak', 'proszę', 'dziękuję', 'możesz', 'zrób', 'teraz', 'już', 'tylko', 'jestem', 'mam', 'dla', 'też', 'jeszcze', 'bardzo', 'można', 'tego', 'jego', 'które', 'mnie', 'tutaj', 'gdzie', 'dlaczego', 'zrobić'],
}

// Lettere che da sole indicano la lingua.
const SEGNI: [RegExp, Lingua, number][] = [
  [/[ąćęłńśźż]/g, 'pl', 3],
  [/[ßäöü]/g, 'de', 2],
  [/[ñ¿¡]/g, 'es', 3],
  [/[ãõç]/g, 'pt', 2],
  [/[àèìòù]/g, 'it', 1],
  [/[âêîôûëœ]/g, 'fr', 2],
  [/ij/g, 'nl', 1],
]

/**
 * Lingua di un testo dell'utente; null se il testo dice troppo poco
 * (un comando, un percorso, una parola sola).
 */
export function rilevaLingua(testo: string): Lingua | null {
  const pulito = testo
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\w.-]*[\\/][\w.\\/-]*/g, ' ')
    .toLowerCase()
  const parole = pulito.split(/[^\p{L}']+/u).filter(Boolean)
  if (parole.length < 2) return null
  const punti = Object.fromEntries(LINGUE.map(l => [l, 0])) as Record<Lingua, number>
  for (const l of LINGUE) {
    const set = new Set(PAROLE[l])
    for (const p of parole) if (set.has(p)) punti[l] += 1
  }
  for (const [re, l, peso] of SEGNI) punti[l] += (pulito.match(re)?.length ?? 0) * peso
  const ordinate = LINGUE.slice().sort((a, b) => punti[b] - punti[a])
  const prima = ordinate[0] as Lingua
  const seconda = ordinate[1] as Lingua
  if (punti[prima] < 2 || punti[prima] === punti[seconda]) return null
  return prima
}

export const linguaEffettiva = (c: Config, rilevata: Lingua): Lingua => (c.lingua === 'auto' ? rilevata : c.lingua)

/** La lingua dopo questa nel ciclo: auto → it → en → … → pl → auto. */
export function prossimaLingua(l: Config['lingua']): Config['lingua'] {
  if (l === 'auto') return 'it'
  return LINGUE[LINGUE.indexOf(l) + 1] ?? 'auto'
}

export const MARGINE_MIN = 0
export const MARGINE_MAX = 30
export const clampMargine = (m: number) => Math.max(MARGINE_MIN, Math.min(MARGINE_MAX, Math.round(m)))

/** Quando il motore non dà l'orario di reset si riprova dopo questo tempo. */
export const RIPROVA_MS = 5 * 60 * 1000

/**
 * Da quali finestre dipende il blocco e quando si resetta.
 *
 * Le finestre esaurite (≥ 100%) bloccano tutte: vale il reset più tardi.
 * Nessuna esaurita ma qualcuna con orario: la più piena. Nessun orario: stima.
 */
export function calcolaReset(limiti: Limite[], adesso: number): Pick<Attesa, 'limite' | 'resetAt' | 'stimato'> {
  const futuri = limiti.filter(l => l.resetAt !== undefined && l.resetAt > adesso)
  const esauriti = futuri.filter(l => l.pct >= 100)
  if (esauriti.length) {
    const l = esauriti.reduce((a, b) => ((b.resetAt ?? 0) > (a.resetAt ?? 0) ? b : a))
    return { limite: l.kind, resetAt: l.resetAt as number, stimato: false }
  }
  if (futuri.length) {
    const l = futuri.reduce((a, b) => (b.pct > a.pct ? b : a))
    // Una finestra lontana dal pieno non spiega il blocco: meglio riprovare presto.
    if (l.pct >= 90) return { limite: l.kind, resetAt: l.resetAt as number, stimato: false }
  }
  return { limite: 'sconosciuto', resetAt: adesso + RIPROVA_MS, stimato: true }
}

export const riprendiAlle = (a: Attesa, c: Config) => a.resetAt + (a.stimato ? 0 : c.margineMin * 60000)

/** Finestre di limite dal formato del motore. */
export const daMotore = (rl: { kind: string; percentUsed: number; resetsAt?: string }[]): Limite[] =>
  rl.map(r => {
    const t = r.resetsAt ? Date.parse(r.resetsAt) : NaN
    return { kind: r.kind, pct: r.percentUsed, ...(Number.isFinite(t) ? { resetAt: t } : {}) }
  })

export const STATS_VUOTE: Statistiche = { ripreseTotali: 0, ripreseGiorno: {}, blocchi: [], attese: [], pushInviate: 0 }

export const giorno = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function conBlocco(s: Statistiche, t: number): Statistiche {
  return { ...s, blocchi: [...s.blocchi, t].slice(-100) }
}

export function conRipresa(s: Statistiche, t: number, attesaMs: number): Statistiche {
  const g = giorno(t)
  const limite = giorno(t - 30 * 86400000)
  const ripreseGiorno = Object.fromEntries(Object.entries({ ...s.ripreseGiorno, [g]: (s.ripreseGiorno[g] ?? 0) + 1 }).filter(([k]) => k >= limite))
  return { ...s, ripreseTotali: s.ripreseTotali + 1, ripreseGiorno, attese: [...s.attese, attesaMs].slice(-50) }
}

export const blocchiSettimana = (s: Statistiche, adesso: number) => s.blocchi.filter(t => t > adesso - 7 * 86400000).length

export const attesaMedia = (s: Statistiche) => (s.attese.length ? s.attese.reduce((a, b) => a + b, 0) / s.attese.length : undefined)

/** Statistiche lette da $.store: si tiene solo ciò che ha la forma giusta. */
export function statsValide(v: unknown): Statistiche {
  if (!v || typeof v !== 'object') return STATS_VUOTE
  const o = v as Partial<Statistiche>
  const numeri = (x: unknown) => (Array.isArray(x) ? x.filter((n): n is number => typeof n === 'number') : [])
  const rg = o.ripreseGiorno && typeof o.ripreseGiorno === 'object' ? o.ripreseGiorno : {}
  return {
    ripreseTotali: typeof o.ripreseTotali === 'number' ? o.ripreseTotali : 0,
    ripreseGiorno: Object.fromEntries(Object.entries(rg).filter(([, n]) => typeof n === 'number')) as Record<string, number>,
    blocchi: numeri(o.blocchi),
    attese: numeri(o.attese),
    pushInviate: typeof o.pushInviate === 'number' ? o.pushInviate : 0,
  }
}

export const CONFIG_BASE: Config = { attivo: true, lingua: 'auto', margineMin: 1 }

export function configValida(v: unknown): Config {
  if (!v || typeof v !== 'object') return CONFIG_BASE
  const o = v as Partial<Config>
  return {
    attivo: typeof o.attivo === 'boolean' ? o.attivo : CONFIG_BASE.attivo,
    lingua: o.lingua === 'auto' || LINGUE.includes(o.lingua as Lingua) ? (o.lingua as Config['lingua']) : 'auto',
    margineMin: typeof o.margineMin === 'number' ? clampMargine(o.margineMin) : CONFIG_BASE.margineMin,
  }
}

// ── Formati ─────────────────────────────────────────────────────────────

export const NOME_LIMITE: Record<string, string> = {
  five_hour: '5 ore',
  seven_day: '7 giorni',
  seven_day_opus: '7 gg Opus',
  seven_day_sonnet: '7 gg Sonnet',
  spend_limit: 'spesa',
  sconosciuto: 'sconosciuto',
}

export const nomeLimite = (k: string) => NOME_LIMITE[k] ?? k.replace(/_/g, ' ')

export const orario = (t: number) => {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

/** Orario del reset: solo l'ora se oggi, altrimenti il giorno della settimana. */
export function quandoReset(t: number, adesso: number) {
  if (giorno(t) === giorno(adesso)) return orario(t)
  if (t - adesso < 6 * 86400000) return `${GIORNI[new Date(t).getDay()]} ${orario(t)}`
  const d = new Date(t)
  return `${d.getDate()}/${d.getMonth() + 1} ${orario(t)}`
}

/** Durata come h:mm:ss (o m:ss sotto l'ora). */
export function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Durata breve: 45 s, 12 min, 2h 14. */
export function durataBreve(ms: number) {
  const m = Math.round(ms / 60000)
  if (m < 1) return `${Math.max(0, Math.round(ms / 1000))} s`
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`
}

export const token = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

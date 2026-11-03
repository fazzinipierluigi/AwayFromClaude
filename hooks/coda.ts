// Coda di lavoro: pianificazione in presenza, esecuzione in assenza. Prompt, marcatori e piani.
import type { VoceCoda } from '../types'

export type Via = VoceCoda['via']

/** Skill superpowers che servono al flusso completo: scrittura del piano ed esecuzione. */
export function superpowersDisponibile(comandi: string[]): boolean {
  const ha = (n: string) => comandi.some(c => c === `superpowers:${n}`)
  return ha('writing-plans') && (ha('subagent-driven-development') || ha('executing-plans'))
}

export const slug = (testo: string) =>
  testo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-') || 'piano'

const data = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dove il flusso interno scrive il piano: lo stesso posto che superpowers-status segue. */
export const percorsoPiano = (obiettivo: string, adesso: number) => `docs/plans/${data(adesso)}-${slug(obiettivo)}.md`

export const MARCA_PIANO = 'AFC-PIANO:'
export const MARCA_FATTO = 'AFC-FATTO'
export const MARCA_BLOCCATO = 'AFC-BLOCCATO:'

export function promptPianifica(via: Via, obiettivo: string, percorso: string): string {
  const passi = via === 'superpowers'
    ? [
        '1. superpowers:brainstorming: chiarisci requisiti e design con me adesso, facendo le domande che servono. Sono presente ora, non lo sarò durante l\'esecuzione.',
        '2. superpowers:writing-plans: scrivi il piano con un `### Task N: titolo` per task e i passi come checkbox `- [ ]`.',
      ]
    : [
        '1. Esplora il codice quanto basta per capire dove intervenire e fammi adesso le domande che servono: sono presente ora, non lo sarò durante l\'esecuzione.',
        `2. Scrivi il piano in \`${percorso}\`: un titolo \`# ...\`, poi per ogni task \`### Task N: titolo\` seguito dai passi come checkbox \`- [ ] ...\`, piccoli e verificabili.`,
      ]
  return [
    'Nuovo compito per la coda di lavoro di AFC (Away from Claude).',
    '',
    'Obiettivo:',
    obiettivo,
    '',
    'Adesso serve solo il piano:',
    ...passi,
    '3. NON eseguire il piano: verrà eseguito più tardi dalla coda, mentre sarò via. Se il pannello Superpowers status è installato, il piano comparirà lì.',
    `4. Quando il piano è salvato, chiudi la risposta con una riga \`${MARCA_PIANO} <percorso del file>\`.`,
  ].join('\n')
}

export function promptEsegui(via: Via, piano: string, obiettivo: string): string {
  const come = via === 'superpowers'
    ? `Esegui il piano \`${piano}\` con superpowers:subagent-driven-development (registro in .superpowers/sdd); se i subagenti non sono disponibili, con superpowers:executing-plans.`
    : `Esegui il piano \`${piano}\` task per task. Appena completi un passo, spunta la sua checkbox nel file (\`- [x]\`). Alla fine di ogni task verifica con test, build o un controllo equivalente; se qualcosa fallisce, correggi prima di proseguire.`
  return [
    'Coda di lavoro di AFC (Away from Claude): è il turno di questo compito.',
    '',
    `Obiettivo: ${obiettivo}`,
    '',
    come,
    '',
    'Sono via dal PC: non fare domande. Dove serve una decisione prendi quella più ragionevole e annotala nel piano, in una sezione `## Decisioni prese in autonomia`.',
    'Alcuni comandi (git push, cancellazioni ricorsive, deploy) sono bloccati finché non torno: trova un\'altra strada o lasciali per dopo, annotandoli.',
    `Quando tutto il piano è completato e verificato, chiudi la risposta con una riga \`${MARCA_FATTO}\`. Se non puoi andare avanti, chiudi con \`${MARCA_BLOCCATO} <motivo>\`.`,
  ].join('\n')
}

export function promptContinua(piano: string): string {
  return [
    `Coda di lavoro di AFC: il piano \`${piano}\` non risulta completato.`,
    'Continua l\'esecuzione dal punto in cui eri, senza fare domande.',
    `Chiudi con \`${MARCA_FATTO}\` quando è tutto fatto e verificato, o con \`${MARCA_BLOCCATO} <motivo>\` se non puoi proseguire.`,
  ].join('\n')
}

/** I marcatori di AFC nella risposta di Claude. */
export function marcatori(risposta: string): { piano?: string; fatto: boolean; bloccato?: string } {
  const righe = risposta.split(/\r?\n/).map(r => r.replace(/[`*_]/g, '').trim())
  const piano = righe.find(r => r.startsWith(MARCA_PIANO))?.slice(MARCA_PIANO.length).trim()
  const bloccato = righe.find(r => r.startsWith(MARCA_BLOCCATO))?.slice(MARCA_BLOCCATO.length).trim()
  const fatto = righe.some(r => r === MARCA_FATTO || r.startsWith(MARCA_FATTO + ' '))
  return { ...(piano ? { piano } : {}), fatto, ...(bloccato !== undefined ? { bloccato: bloccato || 'bloccato' } : {}) }
}

/** Le checkbox di un piano: quante spuntate su quante. */
export function checkbox(testo: string): { fatte: number; totali: number } {
  const tutte = testo.match(/^\s*[-*]\s+\[[ xX]\]/gm) ?? []
  const fatte = tutte.filter(c => /\[[xX]\]/.test(c)).length
  return { fatte, totali: tutte.length }
}

/** Un file markdown che ha l'aria di un piano: checkbox o task. */
export const sembraPiano = (percorso: string, testo: string) =>
  /\.md$/i.test(percorso) && (checkbox(testo).totali > 0 || /^###\s+Task\s+\d+/m.test(testo))

/** Massimo di solleciti a continuare prima di dare il compito per interrotto. */
export const MAX_SOLLECITI = 3

export const nuovoId = (adesso: number, n: number) => `${adesso.toString(36)}-${n}`

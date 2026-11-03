// Stato del pannello "AFC · Away from Claude".

/** Lingue dei messaggi (ripresa e notifiche). */
export type Lingua = 'it' | 'en' | 'fr' | 'de' | 'es' | 'pt' | 'nl' | 'pl'

/** Impostazioni di Auto-Resume, copia di $.store. */
export type Config = {
  attivo: boolean
  /** 'auto': quella rilevata dai messaggi dell'utente. */
  lingua: Lingua | 'auto'
  /** Minuti di attesa dopo il reset prima di riprendere. */
  margineMin: number
}

/** Una finestra di limite come il motore la legge. */
export type Limite = { kind: string; pct: number; resetAt?: number }

/** Uso corrente: finestre di limite, contesto, costo. */
export type Uso = {
  limiti: Limite[]
  ctxToken?: number
  ctxFinestra: number
  ctxPct?: number
  costoUsd?: number
}

/** Sessione bloccata da un limite, in attesa del reset. */
export type Attesa = {
  /** Finestra che ha bloccato ('five_hour', 'seven_day', … o 'sconosciuto'). */
  limite: string
  /** Quando è stato rilevato il blocco. */
  da: number
  /** Reset del limite; stimato quando il motore non lo dice. */
  resetAt: number
  /** Il reset è stimato (nessun orario dal motore): si riprova. */
  stimato: boolean
}

/** Ultimo evento mostrato nella card Stato. */
export type Evento = { quando: number; tipo: 'ripresa' | 'annullata' | 'rifiutata'; testo: string }

/** Statistiche tenute tra le sessioni in $.store. */
export type Statistiche = {
  ripreseTotali: number
  /** 'YYYY-MM-DD' → riprese di quel giorno (ultimi 30 giorni). */
  ripreseGiorno: Record<string, number>
  /** Istanti in cui un limite ha bloccato una sessione (ultimi 100). */
  blocchi: number[]
  /** Attese misurate dal blocco alla ripresa, in ms (ultime 50). */
  attese: number[]
  /** Notifiche push inviate al telefono. */
  pushInviate: number
}

/** Ciò su cui si può essere avvisati sul telefono. */
export type TipoAvviso = 'permesso' | 'domanda' | 'piano' | 'attesa' | 'finito' | 'limite' | 'ripresa' | 'errore' | 'coda'

/** Impostazioni del controllo remoto, copia di $.store. */
export type Remoto = {
  /** Remote Control e notifiche push accesi. */
  attivo: boolean
  /** Per ogni tipo di avviso: se mandare la push. */
  avvisi: Record<TipoAvviso, boolean>
  /** Valore di `remoteControl` prima che la mod lo cambiasse: allo spegnimento si rimette. */
  rcPrima?: string
  /** Valore di `agentPushNotifEnabled` prima che la mod lo cambiasse. */
  pushPrima?: boolean
}

/** L'ultima notifica tentata, per la card Remoto. */
export type UltimaPush = {
  quando: number
  tipo: TipoAvviso
  testo: string
  /** 'inviata' al telefono, 'locale' solo sul PC, 'saltata' con il motivo. */
  esito: 'inviata' | 'locale' | 'saltata'
  motivo?: string
}

/** Esito dell'ultimo comando dato al Remote Control. */
export type StatoRemoto = { quando: number; ok: boolean; testo: string }

/** Modalità AFK: sveglia del PC e permessi AFK. Solo per la sessione. */
export type Afk = { attivo: boolean; da?: number }

/** Il processo che tiene sveglio il PC. */
export type Sveglia = { stato: 'spenta' | 'attiva' | 'errore' | 'non supportata'; testo?: string; da?: number }

/** Un compito della coda di lavoro. */
export type VoceCoda = {
  id: string
  obiettivo: string
  stato: 'pianificazione' | 'pronto' | 'esecuzione' | 'fatto' | 'interrotto'
  /** Flusso con cui è stato pianificato e verrà eseguito. */
  via: 'superpowers' | 'interno'
  /** Il file del piano, appena c'è. */
  piano?: string
  aggiunta: number
  inizio?: number
  fine?: number
  /** Solleciti a continuare già mandati durante l'esecuzione. */
  solleciti: number
  nota?: string
}

/** La coda del progetto, copia di $.store. */
export type Coda = { voci: VoceCoda[]; inCorso: boolean }

/** Ciò che è successo da quando l'utente è via: la base del rapporto di rientro. */
export type Diario = {
  da: number
  strumenti: number
  file: string[]
  negati: { quando: number; cosa: string; motivo: string }[]
  errori: { quando: number; testo: string }[]
  limiti: number
  riprese: number
  push: number
  completati: string[]
  interrotti: string[]
  costoInizio?: number
}

/** Il rapporto di rientro: in preparazione, pronto (in chat) o fallito. */
export type Rapporto = { stato: 'preparazione' | 'pronto' | 'errore'; quando: number; testo?: string }

declare module 'claude-code' {
  interface PluginState {
    'afc': {
      config: Shaped<Config>
      linguaRilevata: Shaped<Lingua>
      uso: Shaped<Uso>
      attesa: Shaped<Attesa | null>
      evento: Shaped<Evento | null>
      stats: Shaped<Statistiche>
      ora: Shaped<number>
      remoto: Shaped<Remoto>
      ultimaPush: Shaped<UltimaPush | null>
      statoRemoto: Shaped<StatoRemoto | null>
      afk: Shaped<Afk>
      sveglia: Shaped<Sveglia>
      coda: Shaped<Coda>
      diario: Shaped<Diario>
      rapporto: Shaped<Rapporto | null>
      /** Un turno della sessione principale è in corso. */
      inTurno: Shaped<boolean>
      /** Ultima attività vista (turno, strumento): misura l'inattività per la sveglia. */
      ultimaAttivita: Shaped<number>
    }
  }
}

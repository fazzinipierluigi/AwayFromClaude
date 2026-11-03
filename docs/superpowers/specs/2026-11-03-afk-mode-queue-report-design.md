# AFC 0.3: Modalità AFK, coda di lavoro, rapporto di rientro

## Intento

Chi usa AFC parte, lascia Claude al lavoro per ore e torna. Servono tre cose: che il lavoro non si fermi per motivi banali (PC in sospensione, permessi da dare), che Claude abbia una lista di compiti già pianificati da eseguire in ordine, e che al rientro si possa chiedere, quando serve, un resoconto di cosa è successo.

## Funzioni

### 1. Modalità AFK (tasto `k`)

Un interruttore che accende insieme:

- **Sveglia**: impedisce la sospensione del sistema (lo schermo può spegnersi) con un processo figlio tenuto vivo dalla mod:
  - Windows: PowerShell con `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)`;
  - macOS: `caffeinate -i`;
  - Linux: `systemd-inhibit --what=idle:sleep … sleep infinity`.
  Il processo muore con la mod, allo spegnimento della modalità o dopo `afkSpegniDopoMin` minuti (default 30) di inattività: coda ferma, nessun turno in corso, nessuna attesa di Auto-Resume. Allo spegnimento automatico resta accesa la politica dei permessi, si ferma solo la sveglia.
- **Permessi AFK** (hook `tool.check`, vale anche per i subagenti):
  - *sempre negati*, con il motivo a Claude perché trovi un'altra strada: `git push`, `git reset --hard`, `git clean -f`, cancellazioni ricorsive (`rm -r`, `rmdir /s`, `del /s`, `Remove-Item -Recurse`), pubblicazioni e deploy (`npm publish`, `docker push`, `kubectl apply|delete`, `terraform apply|destroy`, `vercel`, `gh release`, `gh pr merge`, …), `sudo`, spegnimento, `curl … | sh`; scrittura di file fuori dalla cartella del progetto;
  - *ammessi senza chiedere*: strumenti di sola lettura, modifica di file dentro il progetto, test/build/lint dei principali ecosistemi, `git` locale (status, diff, log, add, commit, branch, switch, stash);
  - *il resto*: verdetto normale del motore.
  Un comando composto (`&&`, `||`, `;`, `|`) è ammesso solo se ogni parte lo è, negato se una parte lo è.
  Estendibili da `/config` con due campi `userConfig`: `afkAmmessi` e `afkNegati`, prefissi di comando separati da virgola.
- Ogni verdetto `ask` che arriva all'utente manda la push "permesso richiesto". Questo sostituisce come rilevazione principale l'evento `Notification`, che un plugin di policy può intercettare prima della mod.

### 2. Coda di lavoro (card "Coda")

- Un campo di testo aggiunge un obiettivo. **La pianificazione avviene subito, con l'utente presente** (scelta B): la mod invia a Claude il prompt di pianificazione e Claude fa le domande che servono.
  - con le skill superpowers (`superpowers:writing-plans` e `subagent-driven-development` o `executing-plans`): `superpowers:brainstorming`, poi `superpowers:writing-plans`, **senza eseguire**;
  - altrimenti: piano interno in `docs/plans/AAAA-MM-GG-<slug>.md` con `### Task N: titolo` e passi `- [ ]`, il formato che superpowers-status segue;
  - Claude chiude con la riga `AFC-PIANO: <percorso>`; in mancanza vale l'ultimo `.md` con checkbox scritto durante la pianificazione.
- Stati: `pianificazione` → `pronto` → `esecuzione` → `fatto` | `interrotto`.
- **▶ Avvia** (tasto `v`) esegue i piani pronti in ordine; **⏸ Ferma** finisce il compito in corso e non avvia il successivo.
  - superpowers: `superpowers:subagent-driven-development` (o `executing-plans`) sul piano, registro in `.superpowers/sdd` che superpowers-status mostra;
  - interno: task per task, spuntando le checkbox, verificando test/build a fine task.
  Il prompt di esecuzione dice a Claude che l'utente è assente: niente domande, decisioni ragionevoli annotate, chiusura con `AFC-FATTO` o `AFC-BLOCCATO: <motivo>`.
- Fine di un turno con un compito in esecuzione: `AFC-FATTO`, o tutte le checkbox spuntate → `fatto`; `AFC-BLOCCATO` → `interrotto`; altrimenti si chiede di continuare, al massimo 3 volte, poi `interrotto`. Un turno finito per un limite non conta: lo riprende Auto-Resume.
- Coda finita: push "coda completata" (nuovo tipo di avviso, tasto `9`).
- Per ogni voce: ✕ toglie, ↑ sposta in su. La coda sta in `$.store` per progetto.

### 3. Rapporto di rientro (tasto `g`)

Su richiesta, mai da solo. Raccoglie dal momento in cui la modalità AFK è stata accesa (o dall'avvio della sessione): compiti completati e interrotti, file modificati, comandi negati, errori, limiti e riprese, push inviate, costo. Chiede a `$.model.fork` un riassunto nella lingua della conversazione (fatto, decisioni, problemi aperti, prossimi passi). Mostra il rapporto in chat come avviso di sistema (`$.session.append`, tipo `system`: l'utente lo legge, il modello no).

## Non obiettivi

- Nessuna esecuzione della coda senza piano approvato in presenza.
- Nessuna modifica alle regole di permesso salvate dall'utente: la politica AFK vive solo nella mod, mentre è accesa.
- superpowers-status non è richiesta: la coda produce piani nel formato che segue, e se è installata li mostra.

## Scelte lasciate al costruttore (prese)

- Pannello in italiano, prompt a Claude in italiano (Claude risponde nella lingua della conversazione).
- Limite di 3 solleciti per compito; spegnimento della sveglia dopo 30 minuti di inattività.

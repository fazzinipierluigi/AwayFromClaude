// Permessi in modalità AFK: cosa Claude può fare senza chiedere mentre l'utente è via, cosa mai.
// Logica pura: decide su nome dello strumento, input e cartella del progetto.

export type Verdetto = { decisione: 'allow' | 'deny' | 'pass'; motivo?: string }

const PASSA: Verdetto = { decisione: 'pass' }

// Sempre negati: lasciano tracce fuori dal PC o non si possono annullare.
const NEGATI: [RegExp, string][] = [
  [/^git\s+push\b/i, 'git push: pubblicare sul remoto aspetta il rientro dell\'utente'],
  [/^git\s+reset\b.*--hard\b/i, 'git reset --hard: perderebbe lavoro non salvato'],
  [/^git\s+clean\b.*\s-[a-z]*f/i, 'git clean -f: cancella file non tracciati'],
  [/^git\s+branch\b.*\s-D\b/, 'git branch -D: cancella un ramo'],
  [/^git\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/i, 'scarta tutte le modifiche locali'],
  [/^rm\s+(-[a-z]*r|-[a-z]*R|--recursive)/, 'cancellazione ricorsiva'],
  [/^rm\s+-[a-z]*f[a-z]*r/i, 'cancellazione ricorsiva'],
  [/^rmdir\b.*\s\/s\b/i, 'cancellazione ricorsiva'],
  [/^(del|erase)\b.*\s\/s\b/i, 'cancellazione ricorsiva'],
  [/^remove-item\b.*-recurse/i, 'cancellazione ricorsiva'],
  [/^(npm|pnpm|yarn|bun)\s+publish\b/i, 'pubblicazione di un pacchetto'],
  [/^cargo\s+publish\b/i, 'pubblicazione di un pacchetto'],
  [/^(twine\s+upload|gem\s+push|dotnet\s+nuget\s+push|flutter\s+pub\s+publish|dart\s+pub\s+publish)\b/i, 'pubblicazione di un pacchetto'],
  [/^docker\s+(push|login)\b/i, 'push di un\'immagine'],
  [/^kubectl\s+(apply|delete|create|replace|rollout|scale|patch)\b/i, 'modifica di un cluster'],
  [/^terraform\s+(apply|destroy|import)\b/i, 'modifica di infrastruttura'],
  [/^helm\s+(install|upgrade|uninstall|delete|rollback)\b/i, 'modifica di un cluster'],
  [/^(vercel|netlify|firebase|fly|flyctl|heroku|wrangler|serverless|sls|eb|amplify)\b.*\b(deploy|publish|--prod)\b/i, 'deploy'],
  [/^gh\s+(release|pr\s+merge|repo\s+(delete|create|edit)|secret|workflow\s+run)\b/i, 'azione su GitHub'],
  [/^sudo\b/i, 'comando con privilegi di amministratore'],
  [/^(shutdown|reboot|halt|poweroff|stop-computer|restart-computer)\b/i, 'spegnimento del computer'],
  [/^(mkfs|format|diskpart)\b/i, 'formattazione'],
]

// Lo scarica-ed-esegui si guarda sul comando intero: sta a cavallo di una pipe.
const SCARICA_ESEGUI = /\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^|]*\|\s*(sh|bash|zsh|iex|invoke-expression|python|node)\b/i

// Ammessi senza chiedere: lettura, test, build, lint, git locale.
const AMMESSI: RegExp[] = [
  /^(cd|ls|dir|pwd|echo|cat|type|head|tail|wc|grep|egrep|rg|which|where|sort|uniq|diff|tree|file|stat|du|df|date|whoami|env|printenv|true|false)\b/i,
  /^(get-childitem|get-content|select-string|test-path|get-location|get-item|measure-object|select-object|where-object|format-table|write-output|write-host)\b/i,
  /^find\b(?!.*\s-(delete|exec|execdir|ok)\b)/i,
  /^(npm|pnpm|yarn|bun)\s+(test|t|run\s+(test|build|lint|typecheck|type-check|check|format|fmt)[\w:-]*|build|lint|install|i|ci|ls|list|outdated|audit)\b/i,
  /^(npx|pnpx|bunx)\s+(tsc|eslint|prettier|vitest|jest|playwright\s+test|biome|stylelint|vue-tsc|svelte-check)\b/i,
  /^(tsc|eslint|prettier|vitest|jest|biome|ruff|mypy|pyright|black|isort|flake8|pylint|pytest|phpunit|phpstan|rubocop|rspec|golangci-lint|shellcheck)\b/i,
  /^python3?\s+-m\s+(pytest|unittest|mypy|ruff|black|pip\s+(install|list|show))\b/i,
  /^(pip3?|uv|poetry)\s+(install|list|show|sync|run\s+(pytest|ruff|mypy))\b/i,
  /^cargo\s+(test|build|check|clippy|fmt|run|bench|doc)\b/i,
  /^go\s+(test|build|vet|fmt|run|mod\s+(tidy|download))\b/i,
  /^(mvn|mvnw|\.\/mvnw)\s+.*\b(test|package|verify|compile|install)\b/i,
  /^(gradle|gradlew|\.\/gradlew)\s+.*\b(test|build|check|assemble|lint)\b/i,
  /^dotnet\s+(test|build|restore|format|run)\b/i,
  /^(make|cmake|ctest|ninja)\b(?!.*\b(install|deploy|publish|release)\b)/i,
  /^(composer\s+(install|test|run|dump-autoload)|php\s+artisan\s+test)\b/i,
  /^flutter\s+(test|analyze|pub\s+get|build)\b/i,
  /^dart\s+(test|analyze|format|pub\s+get)\b/i,
  /^git\s+(status|diff|log|show|add|commit|branch|switch|stash|rev-parse|ls-files|blame|describe|tag\s+-l|fetch|remote\s+-v|config\s+--get|merge-base|shortlog|checkout\s+-b|worktree\s+list)\b/i,
]

/** Le parti di un comando composto: `&&`, `||`, `;`, `|`, a capo. */
export function parti(comando: string): string[] {
  return comando
    .split(/&&|\|\||;|\||\r?\n/)
    .map(p => p.trim().replace(/^(\w+=("[^"]*"|'[^']*'|\S*)\s+)+/, '').replace(/^[({]\s*/, ''))
    .filter(Boolean)
}

const prefissi = (s: string) => s.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)

/** Regole aggiunte dall'utente in /config: prefissi di comando separati da virgola. */
export type Extra = { ammessi: string; negati: string }

export function valutaComando(comando: string, extra: Extra = { ammessi: '', negati: '' }): Verdetto {
  if (SCARICA_ESEGUI.test(comando)) return { decisione: 'deny', motivo: 'scarica-ed-esegui da internet' }
  const negatiUtente = prefissi(extra.negati)
  const ammessiUtente = prefissi(extra.ammessi)
  const ps = parti(comando)
  if (ps.length === 0) return PASSA
  let tutteAmmesse = true
  for (const p of ps) {
    const basso = p.toLowerCase()
    const neg = NEGATI.find(([re]) => re.test(p))
    if (neg) return { decisione: 'deny', motivo: neg[1] }
    if (negatiUtente.some(x => basso.startsWith(x))) return { decisione: 'deny', motivo: 'vietato dalle regole AFK dell\'utente' }
    if (!(AMMESSI.some(re => re.test(p)) || ammessiUtente.some(x => basso.startsWith(x)))) tutteAmmesse = false
  }
  return tutteAmmesse ? { decisione: 'allow', motivo: 'comando ammesso in modalità AFK' } : PASSA
}

const normale = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

/** Un percorso dentro la cartella del progetto (relativo senza `..`, o assoluto sotto la radice). */
export function dentro(percorso: string, radice: string): boolean {
  const p = normale(percorso)
  const r = normale(radice)
  const assoluto = /^([a-z]:)?\//.test(p)
  if (!assoluto) return !p.split('/').includes('..')
  if (p.split('/').includes('..')) return false
  return p === r || p.startsWith(r + '/')
}

// Fuori dal progetto ma del lavoro di Claude: memoria e impostazioni in ~/.claude, cartelle temporanee.
const FUORI_AMMESSI = /\/\.claude\/|\/(te?mp)\/|\/appdata\/local\/temp\//i

const STRUMENTI_FILE = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const STRUMENTI_SHELL = new Set(['Bash', 'PowerShell'])

/** Il verdetto AFK per una chiamata: `pass` lascia la decisione al motore. */
export function valuta(strumento: string, input: unknown, radice: string, sola: boolean, extra?: Extra): Verdetto {
  const i = (input ?? {}) as { command?: unknown; file_path?: unknown; notebook_path?: unknown }
  if (STRUMENTI_SHELL.has(strumento) && typeof i.command === 'string') {
    const v = valutaComando(i.command, extra)
    if (v.decisione === 'pass' && sola) return { decisione: 'allow', motivo: 'comando di sola lettura' }
    return v
  }
  if (STRUMENTI_FILE.has(strumento)) {
    const f = typeof i.file_path === 'string' ? i.file_path : typeof i.notebook_path === 'string' ? i.notebook_path : ''
    if (!f) return PASSA
    if (dentro(f, radice)) return { decisione: 'allow', motivo: 'modifica dentro il progetto' }
    if (FUORI_AMMESSI.test(normale(f) + '/')) return PASSA
    return { decisione: 'deny', motivo: 'scrittura fuori dalla cartella del progetto' }
  }
  if (sola) return { decisione: 'allow', motivo: 'sola lettura' }
  return PASSA
}

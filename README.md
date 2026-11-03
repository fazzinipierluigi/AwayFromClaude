# AFC · Away from Claude

A [Claude Code](https://claude.com/claude-code) mod with the tools to keep developing while you are away from the PC and Claude works on its own.

- **AFK mode**: one switch keeps the PC awake and lets Claude run safe commands (tests, builds, local git) without asking, while pushes, deploys and recursive deletes stay blocked until you are back.
- **Work queue**: add goals before leaving; each one is planned right away *with you* (superpowers brainstorming + writing-plans, or a plain checklist plan), then the queue runs the plans one after another while you are away.
- **Auto-Resume**: when a usage limit stops the work, AFC waits for the reset (plus a configurable margin) and resumes the session in the language of the conversation: *Riprendi*, *Resume*, *Reprendre*, *Fortsetzen*, *Reanudar*, *Retomar*, *Hervatten* or *Wznów*.
- **Remote Control and push notifications**: one toggle turns on Remote Control and push notifications to your phone; you choose which events notify you.
- **Return report**: when you are back, one key writes in the chat what happened while you were away, with a summary by Claude.

> **Note:** the panel's interface is in Italian; push notifications and the return report follow the language of the conversation (8 European languages).

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install afc --marketplace fazzinipierluigi/AwayFromClaude
```

Answer `y` to add the marketplace, then pick a scope (user scope is first; Enter takes it).

From a shell:

```
claude plugin install afc --marketplace fazzinipierluigi/AwayFromClaude
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `fazzinipierluigi/AwayFromClaude`, then **Add plugin**.

The panel opens when a session starts. It needs a Claude Code version that runs mods (plugins with a hooks module). Push notifications need the Claude app on your phone and Remote Control available on your account. The work queue works best with the [superpowers](https://github.com/obra/superpowers) skills and the [superpowers-status](https://github.com/fazzinipierluigi/superpowers-status) panel, but needs neither.

## A typical session

1. Add the goals for the next hours in the **Coda di lavoro** card and answer Claude's questions: each goal becomes a plan, marked *pronto*.
2. Turn on **Modalità AFK** (`k`) and, if you want notifications, **Remote Control e notifiche** (`t`).
3. Press **▶ avvia coda** (`v`) and leave.
4. While you are away: the plans run one after another, the PC stays awake, safe commands run without asking, a usage limit is waited out and resumed, and your phone tells you about the events you picked.
5. Back at the PC, press **📋 Rapporto di rientro** (`g`) to read what happened.

## The side panel

The panel opens when a session starts (`/afc` opens it again) and has these cards:

| Card | What it shows |
|---|---|
| **Modalità AFK** | the AFK switch, whether the PC is being kept awake, the permission policy in force, denied commands, the return report button |
| **Coda di lavoro** | a field to add a goal, the goals with their state (✎ planning, ● ready, ▶ running, ✓ done, ✕ stopped), start / stop |
| **Auto-Resume** | on / off, the limit that blocked the session, resume time, live countdown, the message that will be sent, the last event |
| **Remoto e notifiche** | the Remote Control + notifications toggle, its last outcome, the events to be notified about, the last push and whether it reached the phone |
| **Limiti** | animated bars with the percentage used of each rate-limit window (`5 ore`, `7 giorni`, …) and its reset, plus the context window fill in tokens |
| **Statistiche** | automatic resumes today and in total, limits hit this week, average wait until reset, push notifications sent, session cost |
| **Impostazioni Auto-Resume** | on/off, resume language (auto-detected or picked by hand), margin after reset |

### Events you can be notified about

| Key | Event | Default |
|---|---|---|
| `1` | Claude asks for a permission | on |
| `2` | Claude asks you a question | on |
| `3` | Claude has a plan for you to approve | on |
| `4` | Claude has been waiting for you a while | off |
| `5` | a long piece of work (over 2 minutes) is done | on |
| `6` | a usage limit was reached (with the resume time) | on |
| `7` | the session was resumed after a limit | off |
| `8` | an error stopped the work | on |
| `9` | the work queue is finished | on |

### Keys

| Key | What it does |
|---|---|
| `k` | AFK mode on / off |
| `v` | start the work queue / stop it after the running goal |
| `g` | write the return report in the chat |
| `t` | Remote Control and push notifications on / off |
| `1`–`9` | toggle each event above |
| `a` | automatic resume on / off |
| `l` | cycle the language: auto → it → en → fr → de → es → pt → nl → pl → auto |
| `p` / `m` | margin after reset plus / minus one minute (0–30, default 1) |
| `r` | resume now (while waiting) |
| `x` | cancel the wait |

Keys work while the panel has the focus (click it, or `ctrl+x tab`).

## How it works

### AFK mode

- **Keeping the PC awake**: a child process holds off system sleep (the screen may still turn off): `SetThreadExecutionState` on Windows, `caffeinate -i` on macOS, `systemd-inhibit` on Linux. It ends with AFK mode, with the session, or after 30 minutes with nothing to do (no turn running, queue stopped, no auto-resume wait).
- **AFK permissions**, for the main session and subagents alike:
  - *always denied*, with the reason told to Claude so it finds another way or leaves the step for you: `git push`, `git reset --hard`, `git clean -f`, `git branch -D`, recursive deletes, package publishing, image pushes, cluster and infrastructure changes, deploys, GitHub releases and merges, `sudo`, shutdown, download-and-run from the internet, writing files outside the project folder;
  - *allowed without asking*: read-only tools, editing files inside the project, tests / builds / linters of the main ecosystems (npm, pnpm, yarn, bun, pytest, ruff, cargo, go, maven, gradle, dotnet, make, flutter, …), local git (status, diff, log, add, commit, branch, switch, stash);
  - *anything else*: Claude Code's normal decision.
  A compound command (`&&`, `||`, `;`, `|`) is allowed only if every part is, and denied if any part is.
- Whenever a permission prompt does reach you, the *permission* notification goes to your phone.

### Work queue

- **Planning happens when you add a goal, while you are there.** With the superpowers skills installed, Claude runs `superpowers:brainstorming` (asking you what it needs) and `superpowers:writing-plans`; otherwise it writes a checklist plan in `docs/plans/YYYY-MM-DD-<slug>.md` (`### Task N:` headings, `- [ ]` steps), the format superpowers-status tracks. Claude does not execute the plan yet.
- **Running happens while you are away.** Each ready plan is executed with `superpowers:subagent-driven-development` (or `executing-plans`), or task by task ticking the checkboxes and verifying with tests / build. Claude is told you are away: no questions, sensible decisions written down in the plan, blocked commands left for later.
- A goal is done when Claude ends with `AFC-FATTO` (or, for checklist plans, when every box is ticked); `AFC-BLOCCATO: <reason>` stops it; otherwise Claude is asked to continue, up to 3 times. A turn cut by a usage limit does not count: Auto-Resume picks it up.
- The queue is saved per project.

### Return report

On demand only. It collects, since AFK mode was turned on (or since the session started): goals done and stopped, goals still queued, files changed, commands denied, errors, limits and resumes, notifications, tool calls and cost; then Claude writes a short summary of the conversation in that time (what was done, decisions taken, open problems, what to check). The report appears in the chat as a notice: you read it, Claude does not.

### Auto-Resume

- **Detection**: the engine classifies the error that stopped a turn; `rate_limit` on the main thread means a usage limit. As a safety net, a turn that ends on an error while a window reads 100% counts too.
- **Reset time**: from the rate-limit windows the engine reports. If several are exhausted, the latest reset wins. If no reset time is known, it retries every 5 minutes, up to 12 times.
- **Language**: detected from your own messages (not from Claude's) with a small word-frequency check; you can force one from the panel.
- **You come back first**: if you type something while the countdown runs, the wait is cancelled; if the limit blocks again, it re-arms by itself.

### Remote Control and notifications

- **Turning it on** connects the current session with `/remote-control` (where the command exists) and sets Claude Code's *Enable Remote Control for all sessions* and *Push when Claude decides* settings. Settings an organization has locked are left alone, and the panel says so.
- **Turning it off** stops the notifications and puts those two settings back as they were before AFC changed them. A connection already open is closed from the phone or with `/remote-control`.
- **Notifications** go through Claude Code's own `PushNotification` tool, so they reach the Claude app on your phone. Claude Code itself skips the push while you are at the PC; the panel shows why a push was not sent (*sei al PC*, *telefono non collegato*, *push spente nelle impostazioni*).
- The same kind of event is not notified twice within 30 seconds (a question, for example, arrives both as a tool call and as a dialog).

## Settings

In `/config`, under the plugin:

| Field | What it does |
|---|---|
| *AFK: extra allowed commands* | command prefixes Claude may run without asking in AFK mode, comma-separated (e.g. `docker compose up, ./scripts/check.sh`) |
| *AFK: extra denied commands* | command prefixes always denied in AFK mode, comma-separated (e.g. `npm run release, ./deploy.sh`) |
| *AFK: keep-awake idle timeout* | minutes of inactivity after which the PC is no longer kept awake (default 30) |

### Stored data

Claude Code's per-plugin store keeps the settings, the last detected language, the statistics and the work queue of each project. Nothing leaves your machine except the push notifications you turn on.

## Development

```
claude --plugin-dir ./afc
```

`claude plugin validate .` checks the manifest and hooks; once the mod has loaded, `tsc -p .` type-checks it and `claude plugin test .` runs the tests.

| File | Role |
|---|---|
| `hooks/register.tsx` | hooks, timers, AFK mode, queue, report, Remote Control toggle and the panel |
| `hooks/politica.ts` | AFK permission policy |
| `hooks/coda.ts` | work queue prompts, markers and plan parsing |
| `hooks/sveglia.ts` | keep-awake command per operating system |
| `hooks/logica.ts` | language detection, reset computation, statistics, formats |
| `hooks/avvisi.ts` | notification events, settings and texts in 8 languages |
| `hooks/bar.tsx`, `hooks/countdown.tsx` | animated surface modules |
| `types/index.d.ts` | the mod's state contract |
| `tests/` | tests (`kit.ts` holds the mocked engine they share) |
| `docs/superpowers/specs/` | design documents |

The visual style follows [superpowers-status](https://github.com/fazzinipierluigi/superpowers-status).

## License

MIT © Fazzini Pierluigi

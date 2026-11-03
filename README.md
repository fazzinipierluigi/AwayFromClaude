# AFC · Away from Claude

A [Claude Code](https://claude.com/claude-code) mod with the tools to keep developing while you are away from the PC and Claude works on its own.

- **Auto-Resume**: when a usage limit stops the work, AFC reads when the limit resets, waits, and at reset (plus a configurable margin) sends the resume message in the language of the conversation: *Riprendi*, *Resume*, *Reprendre*, *Fortsetzen*, *Reanudar*, *Retomar*, *Hervatten* or *Wznów*.
- **Remote Control and push notifications**: one toggle turns on Remote Control and push notifications to your phone; you choose which events notify you.

> **Note:** the panel's interface is in Italian; push notifications follow the language of the conversation (8 European languages).

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

The panel opens when a session starts. It needs a Claude Code version that runs mods (plugins with a hooks module). Push notifications need the Claude app on your phone and Remote Control available on your account.

## The side panel

The panel opens when a session starts (`/afc` opens it again) and has five cards:

| Card | What it shows |
|---|---|
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

### Keys

| Key | What it does |
|---|---|
| `t` | Remote Control and push notifications on / off |
| `1`–`8` | toggle each event above |
| `a` | automatic resume on / off |
| `l` | cycle the language: auto → it → en → fr → de → es → pt → nl → pl → auto |
| `p` / `m` | margin after reset plus / minus one minute (0–30, default 1) |
| `r` | resume now (while waiting) |
| `x` | cancel the wait |

Keys work while the panel has the focus (click it, or `ctrl+x tab`).

## How it works

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

### Stored data

Claude Code's per-plugin store keeps the settings, the last detected language and the statistics. Nothing leaves your machine except the push notifications you turn on.

## Development

```
claude --plugin-dir ./afc
```

`claude plugin validate .` checks the manifest and hooks; once the mod has loaded, `tsc -p .` type-checks it and `claude plugin test .` runs the tests.

| File | Role |
|---|---|
| `hooks/register.tsx` | hooks, timer, Remote Control toggle and the panel |
| `hooks/logica.ts` | language detection, reset computation, statistics, formats |
| `hooks/avvisi.ts` | notification events, settings and texts in 8 languages |
| `hooks/bar.tsx`, `hooks/countdown.tsx` | animated surface modules |
| `types/index.d.ts` | the mod's state contract |
| `tests/afc.test.tsx` | tests |

The visual style follows [superpowers-status](https://github.com/fazzinipierluigi/superpowers-status).

## License

MIT © Fazzini Pierluigi

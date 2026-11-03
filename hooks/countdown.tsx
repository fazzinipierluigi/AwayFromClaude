// Conto alla rovescia verso `endAt` sul clock del surface: il pannello non si ridisegna ogni secondo.
// `now` arriva dal modulo degli hook; tra un ridisegno e l'altro conta da solo. A zero mostra `done`.
import type { ClientModule } from 'claude-code'

type Props = { endAt: number; now: number; color: string; doneColor: string; done: string; bold?: boolean }
type Ref = { base: number; ticks: number; lastNow: number }
type State = { ref: Ref }

const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const Countdown: ClientModule<Props, State> = (props, surface) => {
  const { Text } = surface.elements
  const ref = surface.state?.ref ?? { base: 0, ticks: 0, lastNow: -1 }
  if (props.now !== ref.lastNow) {
    ref.lastNow = props.now
    ref.base = props.endAt - props.now
    ref.ticks = 0
  }
  if (surface.state === undefined) {
    surface.setState({ ref })
    surface.every(1000, () => {
      ref.ticks += 1
      surface.setState({ ref })
    })
  }
  const resto = ref.base - ref.ticks * 1000
  return resto > 0 ? (
    <Text color={props.color} bold={props.bold}>⏱ {hms(resto)}</Text>
  ) : (
    <Text color={props.doneColor} bold={props.bold}>{props.done}</Text>
  )
}

export default Countdown

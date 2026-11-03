// Tenere sveglio il PC: il comando che impedisce la sospensione del sistema, per sistema operativo.
// Il processo resta vivo finché la mod lo tiene; alla sua fine il sistema torna a dormire da sé.

export type Sistema = 'windows' | 'mac' | 'linux' | 'altro'

// Windows: ES_CONTINUOUS | ES_SYSTEM_REQUIRED (2147483649) ogni 50 s; il sistema resta sveglio, lo schermo può spegnersi.
// Lo script va come -EncodedCommand (UTF-16LE in base64): le virgolette non sopravvivono alla riga di comando di Windows.
//   $s = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
//   $t = Add-Type -MemberDefinition $s -Name Sveglia -Namespace AFC -PassThru
//   while ($true) { [void]$t::SetThreadExecutionState([uint32]2147483649); Start-Sleep -Seconds 50 }
const PS_SVEGLIA_B64 =
  'JABzACAAPQAgACcAWwBEAGwAbABJAG0AcABvAHIAdAAoACIAawBlAHIAbgBlAGwAMwAyAC4AZABsAGwAIgApAF0AIABwAHUAYgBsAGkAYwAgAHMAdABhAHQAaQBjACAAZQB4AHQAZQByAG4AIAB1AGkAbgB0ACAAUwBlAHQAVABoAHIAZQBhAGQARQB4AGUAYwB1AHQAaQBvAG4AUwB0AGEAdABlACgAdQBpAG4AdAAgAGYAKQA7ACcAOwAgACQAdAAgAD0AIABBAGQAZAAtAFQAeQBwAGUAIAAtAE0AZQBtAGIAZQByAEQAZQBmAGkAbgBpAHQAaQBvAG4AIAAkAHMAIAAtAE4AYQBtAGUAIABTAHYAZQBnAGwAaQBhACAALQBOAGEAbQBlAHMAcABhAGMAZQAgAEEARgBDACAALQBQAGEAcwBzAFQAaAByAHUAOwAgAHcAaABpAGwAZQAgACgAJAB0AHIAdQBlACkAIAB7ACAAWwB2AG8AaQBkAF0AJAB0ADoAOgBTAGUAdABUAGgAcgBlAGEAZABFAHgAZQBjAHUAdABpAG8AbgBTAHQAYQB0AGUAKABbAHUAaQBuAHQAMwAyAF0AMgAxADQANwA0ADgAMwA2ADQAOQApADsAIABTAHQAYQByAHQALQBTAGwAZQBlAHAAIAAtAFMAZQBjAG8AbgBkAHMAIAA1ADAAIAB9AA=='

export function argvSveglia(s: Sistema): string[] | null {
  switch (s) {
    case 'windows':
      return ['powershell', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', PS_SVEGLIA_B64]
    case 'mac':
      return ['caffeinate', '-i']
    case 'linux':
      return ['systemd-inhibit', '--what=idle:sleep', '--who=AFC', '--why=Claude al lavoro mentre sei via', 'sleep', 'infinity']
    default:
      return null
  }
}

export const NOME_SISTEMA: Record<Sistema, string> = { windows: 'Windows', mac: 'macOS', linux: 'Linux', altro: 'sistema sconosciuto' }

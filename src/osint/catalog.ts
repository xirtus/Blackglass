import type { OsintSource, OsintSourceKind, OsintSourceMode } from '@/sim/types'

export interface OsintAdapterDescriptor {
  kind: OsintSourceKind
  label: string
  defaultMode: OsintSourceMode
  ingestModel: 'mcp' | 'rest' | 'local-file' | 'manual-pack' | 'blocked'
}

export const OSINT_ADAPTERS: OsintAdapterDescriptor[] = [
  {
    kind: 'worldMonitor',
    label: 'World Monitor',
    defaultMode: 'offline',
    ingestModel: 'mcp',
  },
  {
    kind: 'caseGraph',
    label: 'GHOST Case Graph',
    defaultMode: 'offline',
    ingestModel: 'rest',
  },
  {
    kind: 'radioSpectrum',
    label: 'WireTapper RF',
    defaultMode: 'offline',
    ingestModel: 'local-file',
  },
  {
    kind: 'publicCamera',
    label: 'Authorized Camera Pack',
    defaultMode: 'offline',
    ingestModel: 'manual-pack',
  },
  {
    kind: 'press',
    label: 'Public Press Index',
    defaultMode: 'offline',
    ingestModel: 'rest',
  },
]

export function osintKindLabel(kind: OsintSourceKind): string {
  return OSINT_ADAPTERS.find((a) => a.kind === kind)?.label ?? kind
}

export function sourceModeLabel(mode: OsintSource['mode']): string {
  return {
    offline: 'OFFLINE PACK',
    configured: 'CONFIGURED',
    blocked: 'BLOCKED',
  }[mode]
}

export function sourceHealth(source: OsintSource): 'ok' | 'warn' | 'crit' {
  if (!source.enabled || source.mode === 'blocked') return 'crit'
  if (source.mode === 'offline' || source.reliability < 0.55) return 'warn'
  return 'ok'
}

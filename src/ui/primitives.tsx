/** Shared HUD primitives — semantic DOM, CSS-chart styling, a11y. */
import type { ReactNode } from 'react'
import { useUIStore, type PanelId } from '@/store/ui'

export function Panel({
  id,
  title,
  badge,
  children,
  className = '',
}: {
  id: PanelId
  title: string
  badge?: string
  children: ReactNode
  className?: string
}) {
  const collapsed = useUIStore((s) => s.collapsed[id])
  const toggle = useUIStore((s) => s.toggleCollapse)
  return (
    <section className={`panel ${collapsed ? 'collapsed' : ''} ${className}`} data-panel={id} data-testid={`panel-${id}`}>
      <header className="panel-head" onClick={() => toggle(id)} role="button" tabIndex={0} aria-expanded={!collapsed}>
        <h2>{title}</h2>
        {badge && <span className="panel-badge">{badge}</span>}
        <span className="panel-caret" aria-hidden>
          {collapsed ? '+' : '−'}
        </span>
      </header>
      {!collapsed && <div className="panel-body">{children}</div>}
    </section>
  )
}

export function Bar({ value, max = 1, tone = 'cyan', label }: { value: number; max?: number; tone?: 'cyan' | 'amber' | 'red' | 'green'; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="bar" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`bar-fill tone-${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stat({ label, value, tone = 'info', title }: { label: string; value: ReactNode; tone?: 'info' | 'warn' | 'crit' | 'ok'; title?: string }) {
  return (
    <div className="stat" title={title}>
      <span className="stat-label">{label}</span>
      <span className={`stat-value tone-${tone}`}>{value}</span>
    </div>
  )
}

export function Badge({ children, tone = 'cyan' }: { children: ReactNode; tone?: 'cyan' | 'amber' | 'red' | 'green' | 'dim' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function EntityLink({ id, label, tone = 'cyan' }: { id: string; label: string; tone?: 'cyan' | 'amber' | 'red' | 'green' | 'dim' }) {
  const select = useUIStore((s) => s.select)
  return (
    <button type="button" className={`entity-link link-${tone}`} onClick={() => select(id)} title={id}>
      {label}
    </button>
  )
}

export function formatSimTime(simTime: number): string {
  const totalMin = Math.floor(simTime / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const s = Math.floor(simTime % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

export function formatAge(simTime: number, now: number): string {
  if (simTime < 0) return 'never'
  const d = Math.max(0, now - simTime)
  if (d < 60) return `${Math.round(d)}s ago`
  if (d < 3600) return `${Math.round(d / 60)}m ago`
  return `${(d / 3600).toFixed(1)}h ago`
}

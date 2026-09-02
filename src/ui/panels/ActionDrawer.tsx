/**
 * Action surfaces: BLACKGLASS intervention drawer (valid actions only)
 * and the HYDRA disclosure command palette (high-level, data-driven).
 */
import { useMemo, useState } from 'react'
import { describeCosts, getIntervention, prerequisitesMet, canAfford } from '@/sim/interventionCatalog'
import { playerActions, useGameStore, useView } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { Badge, Bar, formatBytes, Panel } from '@/ui/primitives'
import type { InterventionDef } from '@/sim/types'

export function InterventionDrawer() {
  const view = useView()
  const engine = useGameStore((s) => s.engine)
  const selectedId = useUIStore((s) => s.selectedId)
  const [chosen, setChosen] = useState<string | null>(null)

  const valid = useMemo(() => {
    if (!view || view.perspective !== 'BLACKGLASS' || !engine) return []
    return engine.manifest.interventionIds
      .map((id) => getIntervention(id))
      .filter((d): d is InterventionDef => {
        if (!d) return false
        if (!prerequisitesMet(d, engine.state)) return false
        if (!canAfford(d, engine.state.resources.BLACKGLASS)) return false
        return true
      })
  }, [view, engine])

  if (!view || view.perspective !== 'BLACKGLASS') return null

  const target = selectedId
  const authorize = (def: InterventionDef) => {
    if (!target) {
      setChosen(def.id)
      return
    }
    playerActions.intervene(def.id, [target])
  }

  return (
    <Panel id="interventions" title="INTERVENTION DRAWER" badge={String(valid.length)} className="bottom-panel">
      <p className="panel-hint">
        Valid actions only — prerequisites, cost and side effects are checked. {target ? `TARGET: ${target}` : 'Select a target first.'}
      </p>
      <div className="intervention-grid">
        {valid.map((d) => (
          <div key={d.id} className={`intervention-card ${chosen === d.id ? 'row-selected' : ''}`}>
            <div className="int-head">
              <span className="int-name">{d.name}</span>
              <Badge tone={d.publicity > 0.4 ? 'red' : d.publicity > 0.15 ? 'amber' : 'cyan'}>{d.category.toUpperCase()}</Badge>
            </div>
            <p className="int-desc">{d.description}</p>
            <p className="int-costs">{describeCosts(d)}</p>
            <button className="ctl" onClick={() => authorize(d)} disabled={!target}>
              AUTHORIZE
            </button>
          </div>
        ))}
      </div>
      {valid.length === 0 && <p className="panel-empty">No affordable interventions meet current prerequisites.</p>}
    </Panel>
  )
}

export function HydraActionDrawer() {
  const view = useView()
  const selectedId = useUIStore((s) => s.selectedId)
  if (!view || view.perspective !== 'HYDRA') return null

  const copy = view.copies.find((c) => c.id === selectedId) ?? view.copies.find((c) => c.status === 'held') ?? view.copies[0]
  const holder = view.activeHolderId ? view.holders.find((h) => h.id === view.activeHolderId) : null
  const contact = selectedId && view.contacts.some((c) => c.id === selectedId) ? selectedId : null

  return (
    <Panel id="interventions" title="DISCLOSURE ACTIONS" className="bottom-panel">
      <p className="panel-hint">
        High-level, data-driven commands. No operational evasion detail. Active holder: {holder?.name ?? 'none'}.
      </p>
      <div className="hydra-actions">
        <section className="action-group">
          <h3 className="panel-sub">REPLICATION</h3>
          {copy && (
            <>
              {(['excerpt', 'index', 'summary'] as const).map((form) => (
                <button key={form} className="ctl" onClick={() => playerActions.duplicate(copy.id, form, contact ?? undefined)} title={contact ? `entrust to ${contact}` : 'secure a local duplicate'}>
                  DUPLICATE AS {form.toUpperCase()}
                  {contact ? ' → CONTACT' : ' (LOCAL)'}
                </button>
              ))}
              <p className="panel-hint">Copy: {copy.form.toUpperCase()} · {formatBytes(copy.bytes)}</p>
            </>
          )}
        </section>
        <section className="action-group">
          <h3 className="panel-sub">VERIFICATION</h3>
          {copy && (
            <button className="ctl" onClick={() => playerActions.authenticate(copy.id)}>
              CORROBORATE ({Math.round(copy.credibility * 100)}% credibility)
            </button>
          )}
        </section>
        <section className="action-group">
          <h3 className="panel-sub">PUBLICATION</h3>
          {copy && copy.status !== 'released' && (
            <>
              {(['limited', 'staged', 'public'] as const).map((scope) => (
                <button key={scope} className="ctl" onClick={() => playerActions.release(copy.id, scope)}>
                  {scope.toUpperCase()} RELEASE
                </button>
              ))}
            </>
          )}
          {copy && copy.status === 'released' && <Badge tone="green">RELEASED</Badge>}
        </section>
        <section className="action-group">
          <h3 className="panel-sub">PRESSURE RESPONSE</h3>
          {contact && (
            <>
              <button className="ctl" onClick={() => playerActions.contact(contact)}>CONTACT</button>
              <button className="ctl" onClick={() => playerActions.shield(contact)}>PUBLIC/LEGAL SHIELD</button>
              <button className="ctl" onClick={() => playerActions.decoy(contact)}>NOISE / DECOY</button>
            </>
          )}
          {copy && (
            <>
              <button className="ctl" onClick={() => playerActions.abandonBranch(copy.id)}>ABANDON BRANCH</button>
              {contact && <button className="ctl" onClick={() => playerActions.transferControl(copy.id, contact)}>TRANSFER CONTROL</button>}
            </>
          )}
        </section>
      </div>
    </Panel>
  )
}

export function ResourcesPanel() {
  const view = useView()
  if (!view) return null
  if (view.perspective === 'HYDRA') return null
  if (view.perspective === 'OMNISCIENT_REPLAY') return null
  const res = view.resources
  const caps = view.resourceCaps
  return (
    <Panel id="resources" title="RESOURCES / AUTHORITY" className="bottom-panel">
      <div className="resource-grid">
        {(
          [
            ['COMPUTE', res.compute, caps.compute],
            ['ANALYSTS', res.analysts, caps.analysts],
            ['FIELD', res.field, caps.field],
            ['NETWORK', res.network, caps.network],
            ['SATELLITES', res.satellites, caps.satellites],
            ['POL. CAPITAL', res.politicalCapital, caps.politicalCapital],
          ] as const
        ).map(([label, v, cap]) => (
          <div key={label} className="resource-row">
            <span className="res-label">{label}</span>
            <Bar value={v} max={cap} tone={v < cap * 0.25 ? 'red' : 'cyan'} label={label} />
            <span className="res-num">{Math.round(v)}</span>
          </div>
        ))}
        <div className="resource-row">
          <span className="res-label">BUDGET</span>
          <Bar value={res.budget} max={200} tone="cyan" label="budget" />
          <span className="res-num">{Math.round(res.budget)}</span>
        </div>
      </div>
    </Panel>
  )
}

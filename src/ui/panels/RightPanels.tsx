/** Target dossier (BLACKGLASS) / Archive & proof (HYDRA). */
import { playerActions, useEvents, useView } from '@/store/game'
import { useUIStore } from '@/store/ui'
import { Badge, EntityLink, formatAge, formatBytes, Panel, Stat } from '@/ui/primitives'
import { useSimTime } from '@/store/game'

export function DossierPanel() {
  const view = useView()
  const selectedId = useUIStore((s) => s.selectedId)
  const pinnedIds = useUIStore((s) => s.pinnedIds)
  const now = useSimTime()
  const events = useEvents(200)
  if (!view || view.perspective !== 'BLACKGLASS') return null

  const person = view.people.find((p) => p.id === selectedId)
  const relatedEvents = selectedId ? events.filter((e) => e.subjects.includes(selectedId)).slice(0, 6) : []

  if (!person) {
    return (
      <Panel id="dossier" title="TARGET DOSSIER" className="right-panel">
        <p className="panel-empty">Select a subject on the map, timeline or Watch Index.</p>
        {pinnedIds.length > 0 && (
          <div>
            <h3 className="panel-sub">PINNED</h3>
            {pinnedIds.map((id) => {
              const p = view.people.find((x) => x.id === id)
              return p ? <div key={id}><EntityLink id={id} label={p.name} /></div> : null
            })}
          </div>
        )}
      </Panel>
    )
  }

  const pinned = pinnedIds.includes(person.id)

  return (
    <Panel id="dossier" title="TARGET DOSSIER" badge={person.roleTags.join(',') || undefined} className="right-panel">
      <div className="dossier-head">
        <h3 className="dossier-name">{person.name}</h3>
        <button className={pinned ? 'ctl active' : 'ctl'} onClick={() => useUIStore.getState().togglePin(person.id)} title="Pin (P)">
          {pinned ? '★' : '☆'}
        </button>
      </div>
      <div className="stat-grid">
        <Stat label="OCCUPATION" value={person.occupation} />
        <Stat label="STATUS" value={person.status.toUpperCase()} tone={person.status !== 'free' ? 'crit' : 'ok'} />
        <Stat label="LAST SEEN" value={formatAge(person.lastSeen, now)} tone={person.posAge > 600 ? 'warn' : 'info'} />
        <Stat label="CONFIDENCE" value={`${Math.round(person.confidence * 100)}%`} />
      </div>
      <div className="tag-row">
        {person.circles.map((c) => (
          <Badge key={c} tone="dim">{c.toUpperCase()}</Badge>
        ))}
      </div>
      <h3 className="panel-sub">HYPOTHESIS</h3>
      <div className="hypothesis-form">
        {(['carrier', 'recipient', 'path', 'source', 'other'] as const).map((rel) => (
          <button key={rel} className="ctl" onClick={() => playerActions.hypothesize(person.id, rel, `${person.name} as ${rel}`)}>
            {rel.toUpperCase()}
          </button>
        ))}
      </div>
      <h3 className="panel-sub">RECENT EVENTS</h3>
      <ul className="event-mini">
        {relatedEvents.map((e) => (
          <li key={e.id} title={`${e.provenance.source} · ${e.provenance.reason}`}>
            <span className={`tone-${e.severity === 'critical' ? 'crit' : e.severity === 'warning' ? 'warn' : 'info'}`}>▸</span> {e.message}
          </li>
        ))}
        {relatedEvents.length === 0 && <li className="panel-empty">No events yet.</li>}
      </ul>
    </Panel>
  )
}

export function ArchivePanel() {
  const view = useView()
  const selectedId = useUIStore((s) => s.selectedId)
  if (!view || view.perspective !== 'HYDRA') return null

  const copy = view.copies.find((c) => c.id === selectedId) ?? view.copies[0]

  return (
    <Panel id="genealogy" title="ARCHIVE / PROOF" badge={String(view.copies.length)} className="right-panel">
      {copy ? (
        <>
          <div className="dossier-head">
            <h3 className="dossier-name">{copy.form.toUpperCase()} COPY</h3>
            <Badge tone={copy.status === 'released' ? 'green' : copy.status === 'held' ? 'cyan' : 'red'}>{copy.status.toUpperCase()}</Badge>
          </div>
          <div className="stat-grid">
            <Stat label="SIZE" value={formatBytes(copy.bytes)} />
            <Stat label="INTEGRITY" value={`${Math.round(copy.integrity * 100)}%`} />
            <Stat label="CREDIBILITY" value={`${Math.round(copy.credibility * 100)}%`} tone={copy.credibility < 0.3 ? 'crit' : copy.credibility < 0.55 ? 'warn' : 'ok'} />
            <Stat label="EXPOSURE" value={`${Math.round(copy.exposure * 100)}%`} />
            <Stat label="LEVEL" value={`${copy.level} · ${['ORIGINAL','COMPROMISED','DUPLICATED','NETWORKED','DIGITAL','MIRRORED','VIRAL','CULTURAL'][copy.level]}`} />
          </div>
          <h3 className="panel-sub">GENEALOGY</h3>
          <CopyTree />
        </>
      ) : (
        <p className="panel-empty">No controlled copies.</p>
      )}
    </Panel>
  )
}

export function CopyTree() {
  const view = useView()
  if (!view) return null
  const copies = view.perspective === 'HYDRA' ? view.copies : view.perspective === 'OMNISCIENT_REPLAY' ? view.copies.map((c) => ({ ...c, id: c.id, parentId: c.parentId, form: c.form, status: c.status })) : view.copies.map((c) => ({ ...c, id: c.id, parentId: c.parentId, form: c.form, status: c.status }))
  const roots = copies.filter((c) => c.parentId === null || !copies.some((x) => x.id === c.parentId))

  const renderNode = (c: (typeof copies)[number], depth: number) => {
    const children = copies.filter((x) => x.parentId === c.id)
    return (
      <div key={c.id} className="copy-node" style={{ marginLeft: depth * 14 }}>
        <EntityLink id={c.id} label={`${c.form.toUpperCase()} · ${c.status.toUpperCase()}`} tone={c.status === 'released' ? 'green' : c.status === 'destroyed' ? 'red' : 'cyan'} />
        {children.map((x) => renderNode(x, depth + 1))}
      </div>
    )
  }

  return <div className="copy-tree">{roots.map((r) => renderNode(r, 0))}</div>
}

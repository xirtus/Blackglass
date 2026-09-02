/**
 * Authoritative simulation systems. Pure logic over SimulationState —
 * no rendering, no Three.js. Runs identically in main thread, Web Worker
 * or replay harness. All randomness comes from named RNG streams.
 */
import { makeEvent, EventLog, EventQueue } from '@/core/events'
import { hashString, RngStreams } from '@/core/rng'
import { findRoute, nearestNode, type ScenarioManifest } from './scenario'
import { getIntervention } from './interventionCatalog'
import { INFOS_LEVELS_BY_FORM, COPY_FORM_BYTES } from './copyForms'
import type {
  AnalysisModel,
  AnomalyReport,
  Baseline,
  InfoCopy,
  Observation,
  OsintSignal,
  OsintSource,
  Person,
  SimulationState,
  SocialEdge,
  SourceCategory,
  Vec2,
} from './types'

export const SCENARIO_START_HOUR = 8
export const ANOMALY_PERIOD = 120 // sim-seconds between model sweeps

export interface SimContext {
  state: SimulationState
  manifest: ScenarioManifest
  streams: RngStreams
  log: EventLog
  queue: EventQueue
}

export function hourOfDay(simTime: number): number {
  return (SCENARIO_START_HOUR + simTime / 3600) % 24
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/* ------------------------------------------------------------------ */
/* Schedule + movement (LOD1)                                          */
/* ------------------------------------------------------------------ */

export function scheduleSystem(ctx: SimContext, _dt: number): void {
  const { state, manifest, streams } = ctx
  const hour = hourOfDay(state.simTime)
  const errand = streams.stream('sim.errand')
  const graph = manifest.graph.nodes
  const locs = state.entities.locations

  for (const p of state.entities.people.all()) {
    if (p.status !== 'free' || p.moving || p.route) continue
    const home = locs.get(p.homeId)
    const work = locs.get(p.workId)
    if (!home || !work) continue

    const working = hour >= p.schedule.workStartHour && hour < p.schedule.workEndHour
    let destId: string | null = null

    if (working && dist(p.pos, work.pos) > work.radius * 0.4) destId = p.workId
    else if (!working && dist(p.pos, home.pos) > home.radius * 0.4) destId = p.homeId
    else if (errand.chance(0.0008)) {
      // Occasional benign errand — the false-positive fuel.
      const candidates = locs.all().filter((l) => l.kind === 'store' || l.kind === 'cafe' || l.kind === 'park' || l.kind === 'transit')
      if (candidates.length > 0) destId = errand.pick(candidates).id
    }

    if (destId) {
      const dest = locs.get(destId)!
      const route = findRoute(graph, manifest.graph.roads, nearestNode(graph, p.pos).id, nearestNode(graph, dest.pos).id)
      if (route && route.length > 1) {
        p.route = route.slice(1) // first entry is current node
        p.moving = true
      }
    }
  }
}

const MODE_SPEED: Record<Person['schedule']['commuteMode'], number> = { walk: 1.4, transit: 5, drive: 11 }

export function movementSystem(ctx: SimContext, dt: number): void {
  const { state, manifest } = ctx
  const graph = manifest.graph.nodes
  const nodeById = new Map(graph.map((n) => [n.id, n]))
  const speedFactor = state.infrastructure.grid === 'up' ? 1 : 0.7
  const trafficFactor = 1 - state.infrastructure.traffic * 0.4

  for (const p of state.entities.people.all()) {
    if (p.status !== 'free' || !p.moving || !p.route) continue
    const speed = MODE_SPEED[p.schedule.commuteMode] * speedFactor * trafficFactor
    const step = speed * dt
    const target = nodeById.get(p.route[0])
    if (!target) {
      p.route = p.route.slice(1)
      continue
    }
    const d = Math.hypot(target.pos.x - p.pos.x, target.pos.z - p.pos.z)
    if (d <= step) {
      p.pos = { ...target.pos }
      p.route = p.route.slice(1)
      if (p.route.length === 0) {
        p.moving = false
        p.route = null
      }
    } else {
      p.pos.x += ((target.pos.x - p.pos.x) / d) * step
      p.pos.z += ((target.pos.z - p.pos.z) / d) * step
    }
  }

  for (const v of state.entities.vehicles.all()) {
    if (!v.moving || !v.route) continue
    const speed = 9 * speedFactor * trafficFactor
    const target = nodeById.get(v.route[0])
    if (!target) {
      v.route = v.route.slice(1)
      continue
    }
    const d = Math.hypot(target.pos.x - v.pos.x, target.pos.z - v.pos.z)
    if (d <= speed * dt) {
      v.pos = { ...target.pos }
      v.route = v.route.slice(1)
      if (v.route.length === 0) {
        v.moving = false
        v.route = null
      }
    } else {
      v.pos.x += ((target.pos.x - v.pos.x) / d) * speed * dt
      v.pos.z += ((target.pos.z - v.pos.z) / d) * speed * dt
    }
  }
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

const CONTACT_RADIUS = 14

export interface Meeting {
  a: string
  b: string
}

/** Contact events are the handoff opportunity windows: one roll per
 *  meeting, never a per-tick continuous chance (that goes supercritical). */
export function contactSystem(ctx: SimContext, _dt: number): Meeting[] {
  const { state, log } = ctx
  const people = state.entities.people.all().filter((p) => p.status === 'free')
  const meetings: Meeting[] = []
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i]
      const b = people[j]
      if (dist(a.pos, b.pos) > CONTACT_RADIUS) continue
      const edge = edgeBetween(state, a.id, b.id)
      if (!edge) continue
      // Throttle: one contact event per pair per 5 minutes.
      if (state.simTime - edge.lastActivated < 300) continue
      edge.lastActivated = state.simTime
      a.traits.stress = clamp01(a.traits.stress + 0.01)
      b.traits.stress = clamp01(b.traits.stress + 0.01)
      meetings.push({ a: a.id, b: b.id })
      log.push(
        makeEvent(state.simTime, 'CONTACT', `${a.name} and ${b.name} co-located near the same location.`, {
          severity: 'info',
          subjects: [a.id, b.id],
          payload: { kind: edge.kind, trust: Math.round(edge.trust * 100) },
          provenance: { source: 'social_graph', reason: 'co_location' },
        }),
      )
    }
  }
  return meetings
}

export function edgeBetween(state: SimulationState, a: string, b: string): SocialEdge | null {
  for (const e of state.entities.edges.all()) {
    if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Handoffs — every successful transfer creates a descendant copy      */
/* ------------------------------------------------------------------ */

/** Hard cap on explicit copies. Beyond it the simulation aggregates
 *  low-value descendants (LOD3 transition) instead of creating more
 *  explicit copies — see docs/03-hydra.md. */
export const MAX_EXPLICIT_COPIES = 200

/** Transfers happen on contact events (opportunity windows), one roll per
 *  meeting per side. Continuous per-tick chances go supercritical and are
 *  deliberately not part of the propagation model. */
export function handoffSystem(ctx: SimContext, _dt: number, meetings: Meeting[]): void {
  const { state, log, streams } = ctx
  if (meetings.length === 0) return
  const handoff = streams.stream('sim.handoff')
  const now = state.simTime

  for (const m of meetings) {
    tryTransfer(ctx, handoff, m.a, m.b, now)
    tryTransfer(ctx, handoff, m.b, m.a, now)
  }
  void log
}

function intentFactorOf(holder: Person): number {
  switch (holder.traits.intent) {
    case 'deliberate':
    case 'publisher':
      return 0.35
    case 'sympathetic':
    case 'archivist':
      return 0.25
    case 'opportunist':
    case 'curious':
      return 0.12
    default:
      return 0.03
  }
}

function tryTransfer(
  ctx: SimContext,
  handoff: ReturnType<RngStreams['stream']>,
  holderId: string,
  recipientId: string,
  now: number,
): void {
  const { state, log } = ctx
  const holder = state.entities.people.get(holderId)
  const recipient = state.entities.people.get(recipientId)
  if (!holder || !recipient || holder.status !== 'free' || recipient.status !== 'free') return

  const own = state.entities.copies
    .all()
    .filter((c) => c.holderType === 'person' && c.holderId === holder.id && (c.status === 'active' || c.status === 'held'))
  if (own.length === 0) return

  const edge = edgeBetween(state, holder.id, recipient.id)
  if (!edge || edge.trust < 0.35) return

  // Aggregate overflow: once explicit copies hit the cap, transfers raise
  // public demand instead of spawning new explicit branches.
  if (state.entities.copies.size >= MAX_EXPLICIT_COPIES) {
    state.public.searchDemand = clamp01(state.public.searchDemand + 0.004)
    state.public.mediaAttention = clamp01(state.public.mediaAttention + 0.002)
    return
  }

  // One roll per meeting — pick the most credible copy the holder has.
  const copy = own.reduce((best, c) => (c.credibility > best.credibility ? c : best), own[0])
  const intentFactor = intentFactorOf(holder)
  const pressure = state.public.suspicion * 0.3 + state.hydra.heat * 0.2
  // P(transfer) = f(intent, trust, opportunity, credibility, pressure)
  const p = clamp01(intentFactor + edge.trust * 0.25 + copy.credibility * 0.15 + pressure + 0.05)
  if (!handoff.chance(p)) return

  const form = handoff.pickWeighted<InfoCopy['form']>([
    ['full', 0.3],
    ['excerpt', 0.35],
    ['index', 0.2],
    ['summary', 0.15],
  ])
  createDescendantCopy(ctx, copy, recipient, form)
  edge.lastActivated = now
  recipient.traits.stress = clamp01(recipient.traits.stress + 0.15)
  holder.traits.stress = clamp01(holder.traits.stress - 0.05)
  log.push(
    makeEvent(state.simTime, 'COPY_CREATED', `A ${form} copy reached ${recipient.name}.`, {
      severity: 'critical',
      subjects: [copy.id, recipient.id],
      payload: { parent: copy.id, form, bytes: COPY_FORM_BYTES(copy, form) },
      provenance: { source: 'handoff', reason: 'transfer' },
    }),
  )
}

export function createDescendantCopy(ctx: SimContext, parent: InfoCopy, holder: Person, form: InfoCopy['form']): InfoCopy {
  const { state, streams } = ctx
  const ids = streams.stream('sim.ids')
  const child: InfoCopy = {
    id: `copy_${ids.int(1000, 999999).toString(36)}`,
    archiveId: parent.archiveId,
    parentId: parent.id,
    holderType: 'person',
    holderId: holder.id,
    form,
    bytes: COPY_FORM_BYTES(parent, form),
    integrity: parent.integrity * 0.92,
    credibility: parent.credibility * 0.95,
    exposure: 0,
    replicationPotential: clamp01(holder.traits.reach * 0.8 + holder.traits.intent !== 'unaware' ? 0.3 : 0.05),
    level: INFOS_LEVELS_BY_FORM[form],
    createdAt: state.simTime,
    lastObservedAt: -1,
    descendants: [],
    status: 'held',
    observedBy: parent.observedBy.includes('HYDRA') ? ['HYDRA'] : [],
  }
  parent.descendants.push(child.id)
  holder.knowledge.copyIds.push(child.id)
  holder.knowledge.awareness = 1
  state.entities.copies.add(child)
  state.hydra.controlledCopyIds.push(child.id)
  state.hydra.branchIndependence = clamp01(state.hydra.branchIndependence + 0.05)
  state.hydra.networkHealth = clamp01(state.hydra.networkHealth - 2)
  return child
}

/* ------------------------------------------------------------------ */
/* Observations                                                        */
/* ------------------------------------------------------------------ */

const SENSOR_PERIODS: Record<SourceCategory, number> = {
  road: 12,
  access: 20,
  device: 30,
  social: 60,
  financial: 180,
  aerial: 900,
  human: 240,
}

export function observationSystem(ctx: SimContext, _dt: number): void {
  const { state, manifest, log, streams } = ctx
  const obsRng = streams.stream('sim.observation')
  const now = state.simTime
  const sensorNodes = manifest.graph.nodes.filter((_, i) => i % 2 === 0)
  const controlled = state.entities.locations.all().filter((l) => l.access === 'controlled')

  const emit = (source: SourceCategory, name: string, o: Partial<Observation> & { subjectIds: string[]; pos: Vec2 }) => {
    if (o.subjectIds.length === 0) return
    const conf = clamp01(o.confidence ?? 0.5)
    const entry: Observation = {
      id: `obs_${now.toFixed(0)}_${obsRng.int(1000, 99999).toString(36)}`,
      simTime: now,
      sourceCategory: source,
      sourceName: name,
      kind: o.kind ?? 'presence',
      subjectIds: o.subjectIds,
      vehicleId: o.vehicleId ?? null,
      deviceId: o.deviceId ?? null,
      locationId: o.locationId ?? null,
      pos: o.pos,
      confidence: conf,
      payload: o.payload ?? '',
      decay: 0.0006,
    }
    state.entities.observations.add(entry)
    for (const id of o.subjectIds) {
      const p = state.entities.people.get(id)
      if (p) {
        p.lastSeen = now
        p.confidence = Math.max(p.confidence, conf)
      }
    }
    if (o.vehicleId) {
      const v = state.entities.vehicles.get(o.vehicleId)
      if (v) v.lastSeen = now
    }
    const watched = state.watchCircles.some((c) => o.subjectIds.includes(c.subjectId))
    const critical = o.subjectIds.some((id) => {
      const p = state.entities.people.get(id)
      return p !== undefined && p.knowledge.copyIds.length > 0
    })
    if (watched || critical || conf >= 0.75) {
      log.push(
        makeEvent(now, 'OBSERVATION', `${name}: ${o.payload || 'presence'} (${Math.round(conf * 100)}%)`, {
          severity: critical ? 'warning' : 'info',
          subjects: o.subjectIds,
          payload: { source: source, confidence: Math.round(conf * 100) },
          provenance: { source: `sensor.${source}`, reason: 'generated' },
        }),
      )
    }
  }

  for (const source of ['road', 'access', 'device', 'social', 'financial', 'aerial', 'human'] as SourceCategory[]) {
    const period = SENSOR_PERIODS[source]
    if ((state.tick + hashString(source)) % Math.max(1, Math.round(period / 0.25)) !== 0) continue
    if (source === 'road') {
      for (const node of sensorNodes) {
        for (const v of state.entities.vehicles.all()) {
          const d = dist(v.pos, node.pos)
          if (d < 45) {
            const conf = 0.8 * (1 - d / 60)
            emit('road', `CAM-${node.id.toUpperCase()}`, { kind: 'identification', subjectIds: v.ownerId ? [v.ownerId] : [], vehicleId: v.id, pos: v.pos, confidence: conf, payload: `vehicle ${v.label} at ${node.id}` })
          }
        }
        for (const p of state.entities.people.all()) {
          const d = dist(p.pos, node.pos)
          if (d < 35) {
            // Seeing a person near a camera is association, not identification.
            const conf = 0.4 * (1 - d / 50)
            emit('road', `CAM-${node.id.toUpperCase()}`, { kind: 'association', subjectIds: [p.id], pos: p.pos, confidence: conf, payload: `pedestrian near ${node.id}` })
          }
        }
      }
    } else if (source === 'access') {
      for (const loc of controlled) {
        for (const p of state.entities.people.all()) {
          if (dist(p.pos, loc.pos) <= loc.radius) {
            emit('access', `BADGE-${loc.id.toUpperCase()}`, { kind: 'identification', subjectIds: [p.id], locationId: loc.id, pos: p.pos, confidence: 0.9, payload: `access event at ${loc.name}` })
          }
        }
      }
    } else if (source === 'device') {
      if (state.infrastructure.telecom === 'down') continue
      for (const d of state.entities.devices.all()) {
        if (!d.online) continue
        const owner = d.ownerCandidates[0]
        if (!owner) continue
        const p = state.entities.people.get(owner.personId)
        if (!p) continue
        d.lastPing = now
        emit('device', `NET-${d.kind.toUpperCase()}`, { kind: 'association', subjectIds: [owner.personId], deviceId: d.id, pos: p.pos, confidence: owner.confidence * 0.7, payload: `network ping (ownership ${Math.round(owner.confidence * 100)}%)` })
      }
    } else if (source === 'social') {
      for (const e of state.entities.edges.all()) {
        if (now - e.lastActivated < 180 && now - e.lastActivated >= 0) {
          emit('social', 'SOCIAL-GRAPH', { kind: 'association', subjectIds: [e.a, e.b], pos: state.entities.people.get(e.a)?.pos ?? { x: 0, z: 0 }, confidence: 0.35, payload: `metadata surge on ${e.kind} edge` })
        }
      }
    } else if (source === 'financial') {
      const people = state.entities.people.all()
      const p = people[obsRng.int(0, people.length - 1)]
      if (p && p.status === 'free' && obsRng.chance(0.5)) {
        emit('financial', 'FIN-SYNTH', { kind: 'association', subjectIds: [p.id], pos: p.pos, confidence: 0.55, payload: 'synthetic purchase anomaly candidate' })
      }
    } else if (source === 'aerial') {
      const node = obsRng.pick(manifest.graph.nodes)
      for (const p of state.entities.people.all()) {
        if (dist(p.pos, node.pos) < 250) {
          emit('aerial', 'AERIAL-WINDOW', { kind: 'identification', subjectIds: [p.id], pos: p.pos, confidence: 0.45, payload: `strategic observation window near ${node.id}` })
        }
      }
    } else if (source === 'human') {
      for (const c of state.watchCircles) {
        if (c.coverage < 0.5) continue
        const p = state.entities.people.get(c.subjectId)
        if (p) {
          emit('human', 'FIELD-REPORT', { kind: 'association', subjectIds: [p.id], pos: p.pos, confidence: 0.5 + c.coverage * 0.3, payload: `field observation on ${p.name}` })
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* OSINT feeds                                                         */
/* ------------------------------------------------------------------ */

const OSINT_PERIODS: Record<OsintSource['kind'], number> = {
  worldMonitor: 95,
  caseGraph: 70,
  radioSpectrum: 55,
  publicCamera: 35,
  press: 120,
}

const OSINT_SIGNAL_LIMIT = 80

export function osintSystem(ctx: SimContext, _dt: number): void {
  const { state, manifest, log, streams } = ctx
  const now = state.simTime
  const rng = streams.stream('sim.osint')
  if (state.osint.sources.length === 0) return

  const anchors = new Map<string, Vec2>()
  for (const node of manifest.graph.nodes) anchors.set(node.id, node.pos)
  for (const loc of state.entities.locations.all()) anchors.set(loc.id, loc.pos)

  const emit = (source: OsintSource, partial: Omit<OsintSignal, 'id' | 'simTime' | 'sourceId' | 'sourceKind'>): void => {
    const signal: OsintSignal = {
      id: `sig_${Math.floor(now)}_${source.id}_${rng.int(100, 9999).toString(36)}`,
      simTime: now,
      sourceId: source.id,
      sourceKind: source.kind,
      ...partial,
    }
    state.osint.signals.push(signal)
    if (state.osint.signals.length > OSINT_SIGNAL_LIMIT) {
      state.osint.signals.splice(0, state.osint.signals.length - OSINT_SIGNAL_LIMIT)
    }
    if (signal.severity === 'warning' || signal.severity === 'critical' || signal.public) {
      log.push(
        makeEvent(now, signal.public ? 'PUBLIC_EVENT' : 'OBSERVATION', `${source.name}: ${signal.title}`, {
          severity: signal.severity,
          subjects: signal.subjectIds,
          payload: { sourceId: source.id, confidence: Math.round(signal.confidence * 100), tags: signal.tags.join(',') },
          provenance: { source: `osint.${source.kind}`, reason: signal.verification },
        }),
      )
    }
  }

  for (const source of state.osint.sources) {
    if (!source.enabled || source.mode === 'blocked') continue
    const period = OSINT_PERIODS[source.kind]
    if ((state.tick + hashString(source.id)) % Math.max(1, Math.round(period / 0.25)) !== 0) continue
    if (source.kind === 'radioSpectrum' && state.infrastructure.telecom === 'down') continue

    const anchorId = source.anchorLocationIds.length > 0 ? rng.pick(source.anchorLocationIds) : rng.pick(manifest.graph.nodes).id
    const pos = anchors.get(anchorId) ?? { x: 0, z: 0 }
    const nearby = state.entities.people
      .all()
      .filter((p) => p.status === 'free' && dist(p.pos, pos) < 260)
      .sort((a, b) => dist(a.pos, pos) - dist(b.pos, pos))
    const subject = nearby[0] ?? rng.pick(state.entities.people.all())
    const pressure = clamp01(state.public.suspicion * 0.35 + state.public.mediaAttention * 0.35 + state.public.searchDemand * 0.3)
    const confidence = clamp01(source.reliability * 0.55 + source.coverage * 0.25 + rng.next() * 0.2)

    if (source.kind === 'worldMonitor') {
      const publicCopy = state.entities.copies.all().some((c) => c.status === 'released')
      emit(source, {
        title: publicCopy || pressure > 0.16 ? 'cross-platform archive query spike' : 'low-grade policy chatter',
        summary: publicCopy || pressure > 0.16 ? 'Open-source chatter is converging on registry, archive and witness-transfer terms.' : 'Public channels show routine civic-policy discussion.',
        subjectIds: [],
        locationId: anchorId.startsWith('bld_') ? anchorId : null,
        pos,
        confidence,
        severity: publicCopy || pressure > 0.16 ? 'warning' : 'info',
        tags: ['news', 'risk', 'trend'],
        public: true,
        verification: confidence > 0.7 ? 'corroborated' : 'single-source',
      })
      state.public.searchDemand = clamp01(state.public.searchDemand + confidence * 0.002)
    } else if (source.kind === 'caseGraph') {
      const recent = state.entities.observations
        .all()
        .filter((o) => now - o.simTime < 900 && o.confidence > 0.25)
        .at(-1)
      const subjects = recent?.subjectIds ?? (subject ? [subject.id] : [])
      emit(source, {
        title: 'entity cluster needs analyst review',
        summary: 'A case-graph source linked recent observations to an unresolved social cluster.',
        subjectIds: subjects,
        locationId: recent?.locationId ?? (anchorId.startsWith('bld_') ? anchorId : null),
        pos: recent?.pos ?? pos,
        confidence,
        severity: confidence > 0.72 ? 'warning' : 'notice',
        tags: ['case-graph', 'entity-resolution'],
        public: false,
        verification: recent ? 'corroborated' : 'single-source',
      })
    } else if (source.kind === 'radioSpectrum') {
      const device = subject?.devices.length ? state.entities.devices.get(rng.pick(subject.devices)) : undefined
      emit(source, {
        title: device ? `${device.kind} emission matched local trace` : 'unattributed local emission',
        summary: 'A synthetic RF trace intersected a known movement corridor.',
        subjectIds: subject ? [subject.id] : [],
        locationId: anchorId.startsWith('bld_') ? anchorId : null,
        pos: subject?.pos ?? pos,
        confidence: clamp01(confidence * 0.85),
        severity: confidence > 0.68 ? 'warning' : 'notice',
        tags: ['rf', 'device', 'local'],
        public: false,
        verification: 'single-source',
      })
    } else if (source.kind === 'publicCamera') {
      const cameraSubject = nearby.find((p) => p.moving) ?? subject
      if (!cameraSubject) continue
      const obs: Observation = {
        id: `obs_osint_${Math.floor(now)}_${rng.int(100, 9999).toString(36)}`,
        simTime: now,
        sourceCategory: 'road',
        sourceName: `OPEN-CAM-${anchorId.toUpperCase()}`,
        kind: 'association',
        subjectIds: [cameraSubject.id],
        vehicleId: null,
        deviceId: null,
        locationId: anchorId.startsWith('bld_') ? anchorId : null,
        pos: cameraSubject.pos,
        confidence: clamp01(confidence * 0.75),
        payload: `authorized camera pack movement near ${anchorId}`,
        decay: 0.0008,
      }
      state.entities.observations.add(obs)
      cameraSubject.lastSeen = now
      cameraSubject.confidence = Math.max(cameraSubject.confidence, obs.confidence)
      emit(source, {
        title: `authorized camera hit near ${anchorId}`,
        summary: 'Scenario camera pack produced a low-confidence movement association.',
        subjectIds: [cameraSubject.id],
        locationId: obs.locationId,
        pos: cameraSubject.pos,
        confidence: obs.confidence,
        severity: obs.confidence > 0.48 ? 'warning' : 'notice',
        tags: ['camera', 'authorized', 'association'],
        public: false,
        verification: 'fictionalized',
      })
    } else if (source.kind === 'press') {
      emit(source, {
        title: 'regional outlet requests archive context',
        summary: 'A public press index surfaced fresh queries around records access and transfer logs.',
        subjectIds: [],
        locationId: anchorId.startsWith('bld_') ? anchorId : null,
        pos,
        confidence,
        severity: pressure > 0.25 ? 'warning' : 'notice',
        tags: ['press', 'queries'],
        public: true,
        verification: 'single-source',
      })
    }
  }
}

export function confidenceDecaySystem(ctx: SimContext, dt: number): void {
  const { state } = ctx
  for (const p of state.entities.people.all()) {
    p.confidence = clamp01(p.confidence - 0.0004 * dt)
  }
  // Observation effective confidence decays via stored per-observation decay.
  for (const o of state.entities.observations.all()) {
    if (state.simTime - o.simTime > 3600 && o.confidence < 0.05) {
      // Old, fully decayed observations stay for provenance but stop mattering.
    }
  }
}

export function effectiveConfidence(o: Observation, now: number): number {
  return clamp01(o.confidence - Math.max(0, now - o.simTime) * o.decay)
}

/* ------------------------------------------------------------------ */
/* Anomaly models — ATHENA / ORACLE / JANUS                            */
/* ------------------------------------------------------------------ */

export function anomalySystem(ctx: SimContext, _dt: number): void {
  const { state, manifest, log } = ctx
  const now = state.simTime
  if (state.tick % Math.round(ANOMALY_PERIOD / 0.25) !== 0) return
  const hour = hourOfDay(now)

  for (const p of state.entities.people.all()) {
    if (p.status !== 'free') continue
    const baseline: Baseline | undefined = state.baselines[p.id]
    if (!baseline) continue
    const home = state.entities.locations.get(p.homeId)
    const work = state.entities.locations.get(p.workId)
    const watched = state.watchCircles.some((c) => c.subjectId === p.id && c.coverage > 0.3)

    const features: Record<AnalysisModel, string[]> = { ATHENA: [], ORACLE: [], JANUS: [] }

    // ATHENA — routine and movement.
    let athenaScore = 0.1
    if (work && home) {
      const working = hour >= p.schedule.workStartHour && hour < p.schedule.workEndHour
      if (working && dist(p.pos, work.pos) > work.radius * 1.5 && dist(p.pos, home.pos) < home.radius * 1.2) {
        features.ATHENA.push('left work early')
        athenaScore += 0.45
      }
      if (!working && dist(p.pos, work.pos) < work.radius) {
        features.ATHENA.push('at workplace outside work window')
        athenaScore += 0.3
      }
      if (p.moving && dist(p.pos, work.pos) > 700 && dist(p.pos, home.pos) > 700) {
        features.ATHENA.push('far from routine anchors')
        athenaScore += 0.25
      }
    }
    const lastObs = state.entities.observations.all().filter((o) => o.subjectIds.includes(p.id)).at(-1)
    if (lastObs && now - lastObs.simTime > 2400) {
      features.ATHENA.push('observation gap')
      athenaScore += 0.2
    }
    athenaScore = clamp01(athenaScore)

    // ORACLE — social graph and trust.
    let oracleScore = 0.1
    for (const e of state.entities.edges.all()) {
      const touches = e.a === p.id || e.b === p.id
      if (!touches) continue
      if (e.lastActivated >= 0 && now - e.lastActivated < 600 && e.freq < 0.1) {
        features.ORACLE.push('activated dormant relationship')
        oracleScore += 0.4
      }
      if (e.kind === 'unknown' && e.lastActivated >= 0 && now - e.lastActivated < 600) {
        features.ORACLE.push('unknown-circle contact')
        oracleScore += 0.35
      }
    }
    oracleScore = clamp01(oracleScore)

    // JANUS — conservative, unknown-focused.
    let janusScore = 0.05
    const unknownEdges = state.entities.edges.all().filter((e) => (e.a === p.id || e.b === p.id) && e.kind === 'unknown').length
    if (unknownEdges > 0) {
      features.JANUS.push(`missing explanations around ${unknownEdges} unknown contact(s)`)
      janusScore += Math.min(0.4, unknownEdges * 0.15)
    }
    if (p.devices.length > 0 && p.devices.every((did) => !state.entities.devices.get(did)?.online)) {
      features.JANUS.push('device went silent')
      janusScore += 0.3
    }
    janusScore = clamp01(janusScore)

    for (const model of ['ATHENA', 'ORACLE', 'JANUS'] as AnalysisModel[]) {
      const score = model === 'ATHENA' ? athenaScore : model === 'ORACLE' ? oracleScore : janusScore
      const fs = features[model]
      const verdict: AnomalyReport['verdict'] =
        score >= 0.55 ? 'suspicious' : score >= 0.35 ? 'benign-anomaly' : model === 'JANUS' && unknownEdges > 0 ? 'unknown' : 'routine'
      const report: AnomalyReport = {
        id: `anom_${now}_${model}_${p.id}`,
        personId: p.id,
        simTime: now,
        model,
        features: fs,
        score,
        confidence: 0.3 + (watched ? 0.5 : 0.1),
        verdict,
      }
      state.anomalies.push(report)
      const notable = watched || p.knowledge.copyIds.length > 0 || verdict === 'suspicious'
      if (notable && score >= 0.35) {
        log.push(
          makeEvent(now, 'ANOMALY', `${model} flags ${p.name}: ${fs.join('; ') || 'elevated deviation'} (${Math.round(score * 100)})`, {
            severity: score >= 0.55 ? 'warning' : 'info',
            subjects: [p.id],
            payload: { model, score: Math.round(score * 100) },
            provenance: { source: `model.${model}`, reason: 'baseline_deviation' },
          }),
        )
      }
    }
  }
  void manifest
}

/* ------------------------------------------------------------------ */
/* Hydra aggregation + Streisand feedback                              */
/* ------------------------------------------------------------------ */

export function hydraSystem(ctx: SimContext, dt: number): void {
  const { state } = ctx
  const now = state.simTime

  const active = state.entities.copies.all().filter((c) => c.status === 'active' || c.status === 'held' || c.status === 'released')

  // Exposure grows for released copies; demand accelerates it.
  for (const c of state.entities.copies.all()) {
    if (c.status === 'released') {
      const demand = state.public.searchDemand
      c.exposure = clamp01(c.exposure + (0.0008 + demand * 0.002) * dt)
      if (c.exposure > 0.4) c.level = Math.max(c.level, 5) as InfoCopy['level']
      if (c.exposure > 0.7) c.level = Math.max(c.level, 6) as InfoCopy['level']
    }
  }

  // Aggregate descendants for viral copies (LOD3/4 transition).
  const viral = active.filter((c) => c.level >= 4 && c.status === 'released')
  const estimatedAggregate = viral.reduce((s, c) => s + c.exposure * 120, 0)

  // Public state: Streisand feedback — suspicion decays slowly, attention follows.
  state.public.suspicion = clamp01(state.public.suspicion - 0.00002 * dt)
  state.public.mediaAttention = clamp01(state.public.mediaAttention + (state.public.suspicion - state.public.mediaAttention) * 0.0004 * dt)
  state.public.searchDemand = clamp01(state.public.searchDemand + (state.public.mediaAttention * 0.6 - state.public.searchDemand) * 0.0003 * dt)

  // HYDRA fuzzy heat: driven by BLACKGLASS watch spend + interventions,
  // decays slowly; exposed to the player only in coarse buckets.
  const watchPressure = state.watchCircles.reduce((s, c) => s + c.coverage, 0) / Math.max(1, state.watchCircles.length)
  state.hydra.heat = clamp01(state.hydra.heat + (watchPressure * 0.5 - state.hydra.heat * 0.05) * 0.001 * dt)

  state.hydra.reach = clamp01(active.reduce((s, c) => s + c.exposure * 0.3, 0) + state.hydra.controlledCopyIds.length * 0.01)
  void estimatedAggregate
  void now
}

/* ------------------------------------------------------------------ */
/* Interventions                                                       */
/* ------------------------------------------------------------------ */

export function interventionSystem(ctx: SimContext, dt: number): void {
  const { state, log, streams } = ctx
  const roll = streams.stream('sim.intervention')
  const now = state.simTime
  const people = state.entities.people

  for (const inst of state.entities.interventions.all()) {
    const def = getIntervention(inst.defId)
    if (!def) continue

    if (inst.success === null && now >= inst.readyAt) {
      inst.success = roll.next() < def.successProbability
      applyInterventionEffects(ctx, def, inst, inst.success)
      log.push(
        makeEvent(now, 'INTERVENTION_STARTED', `${def.name} activated on ${inst.targetIds.map((t) => people.get(t)?.name ?? t).join(', ')}.`, {
          severity: 'warning',
          subjects: inst.targetIds,
          payload: { success: inst.success },
          provenance: { source: 'blackglass.command', reason: 'authorized' },
        }),
      )
      // Streisand: visible interventions feed public suspicion immediately.
      if (def.publicity > 0) {
        state.public.suspicion = clamp01(state.public.suspicion + def.publicity * 0.35 + Math.abs(def.suspicionDelta) * 0.3)
        state.public.mediaAttention = clamp01(state.public.mediaAttention + def.publicity * 0.25)
        log.push(
          makeEvent(now, 'PUBLIC_EVENT', `Public curiosity rises after ${def.name.toLowerCase()}.`, {
            severity: def.publicity > 0.4 ? 'critical' : 'notice',
            subjects: [],
            payload: { suspicion: Math.round(state.public.suspicion * 100) },
            provenance: { source: 'streisand', reason: 'visible_suppression' },
          }),
        )
      }
    }

    if (inst.success !== null && now >= inst.resolvesAt) {
      resolveInterventionEffects(ctx, def, inst)
      log.push(
        makeEvent(now, 'INTERVENTION_RESOLVED', `${def.name} window closed. ${inst.effects.join(' ')}`, {
          severity: 'notice',
          subjects: inst.targetIds,
          payload: {},
          provenance: { source: 'blackglass.command', reason: 'resolution' },
        }),
      )
      state.entities.interventions.remove(inst.id)
    }
  }
  void dt
}

function applyInterventionEffects(ctx: SimContext, def: { id: string; category: string }, inst: { targetIds: string[]; effects: string[] }, success: boolean): void {
  const { state } = ctx
  const people = state.entities.people
  const effects = inst.effects
  const t0 = inst.targetIds[0]

  switch (def.id) {
    case 'account_hold': {
      const d = state.entities.devices.get(t0) ?? (people.get(t0) ? state.entities.devices.get(people.get(t0)!.devices[0]) : undefined)
      if (d) {
        d.online = false
        effects.push(success ? 'Accounts frozen.' : 'Partial freeze; subject may be alerted.')
      }
      break
    }
    case 'travel_restriction': {
      const p = people.get(t0)
      if (p) {
        if (success) {
          p.route = null
          p.moving = false
          effects.push('Movement restricted.')
        } else effects.push('Restriction contested.')
      }
      break
    }
    case 'takedown_request': {
      const c = state.entities.copies.get(t0)
      if (c) {
        if (success) {
          c.status = 'destroyed'
          effects.push('Copy removed.')
        } else {
          c.exposure = clamp01(c.exposure + 0.05)
          effects.push('Removal failed; attention increased.')
        }
      }
      break
    }
    case 'credibility_challenge': {
      const c = state.entities.copies.get(t0)
      if (c) {
        if (success) {
          c.credibility = clamp01(c.credibility - 0.3)
          effects.push('Credibility damaged.')
        } else {
          c.credibility = clamp01(c.credibility + 0.05)
          effects.push('Backlash strengthened the copy.')
        }
      }
      break
    }
    case 'service_disruption': {
      state.infrastructure.telecom = 'degraded'
      state.infrastructure.traffic = clamp01(state.infrastructure.traffic + 0.2)
      effects.push('Regional connectivity degraded.')
      break
    }
    case 'server_isolation': {
      effects.push('Node isolated.')
      if (success) {
        for (const d of state.entities.devices.all()) {
          if (d.kind === 'workMachine' || d.kind === 'laptop') {
            for (const cid of d.copyIds) {
              const c = state.entities.copies.get(cid)
              if (c) {
                c.status = 'destroyed'
                effects.push('Server copy removed.')
              }
            }
          }
        }
        // backup_risk: isolation reveals a backup
        const anyCopy = state.entities.copies.all().find((c) => c.status === 'active' || c.status === 'held')
        if (anyCopy) effects.push('Backup relationship surfaced.')
      }
      break
    }
    case 'traffic_control': {
      state.infrastructure.traffic = clamp01(state.infrastructure.traffic - 0.15)
      effects.push('Traffic redirected.')
      break
    }
    case 'cordon': {
      for (const p of people.all()) {
        const c = state.entities.locations.get('bld_archive')
        if (c && dist(p.pos, c.pos) < 500) {
          p.route = null
          p.moving = false
        }
      }
      effects.push('Sector access controlled.')
      break
    }
    case 'surveillance_team': {
      for (const wc of state.watchCircles) {
        if (wc.subjectId === t0) wc.coverage = clamp01(wc.coverage + 0.4)
      }
      effects.push('Field asset assigned.')
      break
    }
    case 'detention': {
      const p = people.get(t0)
      if (p && success) {
        p.status = 'detained'
        state.hydra.heat = clamp01(state.hydra.heat + 0.1)
        effects.push('Subject detained.')
      } else if (p) effects.push('Detention attempt failed.')
      break
    }
    case 'grid_blackout': {
      state.infrastructure.grid = 'down'
      state.infrastructure.telecom = 'degraded'
      state.infrastructure.traffic = clamp01(state.infrastructure.traffic + 0.3)
      effects.push('Sector power disrupted.')
      break
    }
    case 'signal_eclipse': {
      for (const d of state.entities.devices.all()) d.online = false
      state.infrastructure.telecom = 'down'
      effects.push('Spectrum eclipse in effect (fictional system).')
      break
    }
    default:
      effects.push('Action applied.')
  }
}

function resolveInterventionEffects(ctx: SimContext, def: { id: string; category: string }, inst: { targetIds: string[]; effects: string[] }): void {
  const { state } = ctx
  switch (def.id) {
    case 'service_disruption':
    case 'grid_blackout':
      state.infrastructure.grid = 'up'
      state.infrastructure.telecom = 'up'
      state.infrastructure.traffic = clamp01(state.infrastructure.traffic - 0.2)
      inst.effects.push('Infrastructure restored.')
      break
    case 'signal_eclipse':
      state.infrastructure.telecom = 'up'
      inst.effects.push('Spectrum restored.')
      break
    case 'surveillance_team': {
      for (const wc of state.watchCircles) {
        if (wc.subjectId === inst.targetIds[0]) wc.coverage = clamp01(wc.coverage - 0.4)
      }
      inst.effects.push('Field asset released.')
      break
    }
    default:
      break
  }
}

/* ------------------------------------------------------------------ */
/* End states                                                          */
/* ------------------------------------------------------------------ */

export function endStateSystem(ctx: SimContext, _dt: number): void {
  const { state, manifest, log } = ctx
  if (state.endState && state.endState.kind !== 'none') return

  const now = state.simTime
  const copies = state.entities.copies.all().filter((c) => c.status === 'active' || c.status === 'held' || c.status === 'released')

  const finish = (kind: Exclude<import('./types').EndState['kind'], 'none'>, summary: string) => {
    state.endState = { kind, at: now, summary }
    log.push(
      makeEvent(now, 'END_STATE', summary, {
        severity: 'critical',
        subjects: [],
        payload: { kind },
        provenance: { source: 'end_state', reason: 'threshold' },
      }),
    )
  }

  if (now >= manifest.durationMinutes * 60) {
    finish('timeExpired', `Mission window expired. Containment ${copies.length === 0 ? 'held' : 'incomplete'}.`)
    return
  }
  if (copies.length === 0 && state.simTime > 60) {
    finish('contained', 'No active copies remain. Practical containment achieved.')
    return
  }
  const H = computeReplicationNumber(state)
  if (H > 1 && manifest.lossRules.practicalHydra && state.public.suspicion > 0.15) {
    // Sustained supercritical H — a one-tick spike is not enough.
    if (state.hydra.heat > 0.25 || copies.some((c) => c.status === 'released' && c.exposure > 0.35)) {
      finish('practicalFailure', 'The information reproduction number exceeds 1 across independent branches. Practical containment is no longer possible.')
      return
    }
  }
  if (copies.some((c) => c.status === 'released' && c.exposure > 0.55 && c.credibility > 0.5)) {
    finish('released', 'A credible released copy has reached wide exposure. Containment has failed socially.')
  }
}

export function computeReplicationNumber(state: SimulationState): number {
  const active = state.entities.copies.all().filter((c) => c.status === 'active' || c.status === 'held' || c.status === 'released')
  if (active.length === 0) return 0
  let total = 0
  for (const c of active) {
    const holder = c.holderType === 'person' ? state.entities.people.get(c.holderId) : undefined
    const reach = holder?.traits.reach ?? 0.3
    total += c.replicationPotential * (0.3 + reach * 0.7) * (1 + state.public.searchDemand)
  }
  return total / active.length
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * Dual-perspective contract (16-prompt): ONE authoritative simulation,
 * three perspectives. `selectVisibleState` is the ONLY gateway between
 * simulation truth and UI/AI consumers. View models are built field by
 * field — hidden state can never leak through a spread operator.
 *
 *   BLACKGLASS: observations, confidence, hypotheses, modeled
 *                surveillance layers — never hidden ground truth.
 *   HYDRA:       controlled holders/copies, perceived relationships,
 *                own commands, public events, coarse fuzzy heat —
 *                never the Watch Index, sensors or queued actions.
 *   OMNISCIENT:  replay-only full truth + both belief states.
 */
import { effectiveConfidence } from './systems'
import type {
  AnomalyReport,
  Hypothesis,
  InfoCopy,
  Observation,
  OsintSignal,
  OsintSource,
  Person,
  SimulationState,
  SocialEdge,
  WatchCircle,
} from './types'

export type Perspective = 'BLACKGLASS' | 'HYDRA' | 'OMNISCIENT_REPLAY'

export interface PersonView {
  id: string
  name: string
  occupation: string
  homeId: string
  workId: string
  circles: Person['circles']
  status: Person['status']
  /** Last known position (may be stale / unknown). */
  pos: { x: number; z: number } | null
  posAge: number
  lastSeen: number
  confidence: number
  moving: boolean
  roleTags: string[]
}

export interface CopyView {
  id: string
  parentId: string | null
  holderId: string
  holderName: string | null
  form: InfoCopy['form']
  bytes: number
  integrity: number
  credibility: number
  exposure: number
  level: InfoCopy['level']
  status: InfoCopy['status']
  createdAt: number
  descendants: string[]
  /** BLACKGLASS sees copies only as hypotheses from observations. */
  confidence: number
}

export type ObservationView = Observation

export interface BlackglassView {
  perspective: 'BLACKGLASS'
  simTime: number
  scenarioTitle: string
  people: PersonView[]
  vehicles: { id: string; label: string; ownerId: string | null; pos: { x: number; z: number } | null; lastSeen: number }[]
  observations: ObservationView[]
  anomalies: AnomalyReport[]
  hypotheses: Hypothesis[]
  watchCircles: WatchCircle[]
  osintSources: OsintSource[]
  osintSignals: OsintSignal[]
  copies: CopyView[]
  resources: SimulationState['resources']['BLACKGLASS']
  resourceCaps: SimulationState['resourceCaps']
  public: SimulationState['public']
  infrastructure: SimulationState['infrastructure']
  interventions: { id: string; defId: string; targetIds: string[]; readyAt: number; resolvesAt: number; success: boolean | null }[]
  endState: SimulationState['endState']
  metrics: { knownCopies: number; estimatedCopies: number; replicationNumberH: number; containmentProbability: number }
  alerts: { id: string; simTime: number; message: string; severity: string }[]
}

export interface HydraView {
  perspective: 'HYDRA'
  simTime: number
  scenarioTitle: string
  /** Controlled holders + known contacts with perceived trust. */
  activeHolderId: string | null
  holders: { id: string; name: string; pos: { x: number; z: number } | null; status: Person['status'] }[]
  contacts: { id: string; name: string; trust: number; kind: SocialEdge['kind']; status: Person['status'] }[]
  copies: {
    id: string
    parentId: string | null
    form: InfoCopy['form']
    bytes: number
    integrity: number
    credibility: number
    status: InfoCopy['status']
    level: InfoCopy['level']
    exposure: number
    createdAt: number
  }[]
  /** Coarse fuzzy pressure — deliberately bucketed, no sensor truth. */
  heat: { level: 'cold' | 'warm' | 'hot' | 'critical'; value: number }
  trustCapital: number
  credibility: number
  branchIndependence: number
  reach: number
  networkHealth: number
  public: SimulationState['public']
  /** Publicly observable world state (outages are visible to everyone). */
  infrastructure: SimulationState['infrastructure']
  osintSignals: OsintSignal[]
  publicEvents: { id: string; simTime: number; message: string; severity: string }[]
  commitments: { personId: string; dueAt: number; what: string }[]
  endState: SimulationState['endState']
}

export interface OmniscientView {
  perspective: 'OMNISCIENT_REPLAY'
  simTime: number
  people: Person[]
  copies: InfoCopy[]
  observations: Observation[]
  osintSources: OsintSource[]
  osintSignals: OsintSignal[]
  watchCircles: WatchCircle[]
  interventions: { id: string; defId: string; targetIds: string[]; success: boolean | null }[]
  blackglassBeliefs: { knownCopyCount: number; observedHolderHits: number; suspicion: number }
  hydraBeliefs: { knownCopyCount: number; heat: number }
}

export type ViewModel = BlackglassView | HydraView | OmniscientView

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

function personViewForBg(state: SimulationState, p: Person): PersonView {
  const now = state.simTime
  // Position is only "known" if recently observed; otherwise last known
  // position with an age marker. Unknown people have no position at all.
  const seen = p.lastSeen >= 0
  const fresh = seen && now - p.lastSeen < 600
  return {
    id: p.id,
    name: p.name,
    occupation: p.occupation,
    homeId: p.homeId,
    workId: p.workId,
    circles: [...p.circles],
    status: p.status,
    pos: fresh ? { ...p.pos } : seen ? { ...p.pos } : null,
    posAge: seen ? now - p.lastSeen : -1,
    lastSeen: p.lastSeen,
    confidence: clamp01(p.confidence),
    moving: fresh ? p.moving : false,
    roleTags: [...p.roleTags],
  }
}

export function selectVisibleState(state: SimulationState, perspective: Perspective, scenarioTitle: string, alerts: { id: string; simTime: number; message: string; severity: string }[] = []): ViewModel {
  if (perspective === 'OMNISCIENT_REPLAY') {
    return buildOmniscient(state)
  }
  if (perspective === 'BLACKGLASS') {
    return buildBlackglass(state, scenarioTitle, alerts)
  }
  return buildHydra(state, scenarioTitle)
}

function buildBlackglass(state: SimulationState, scenarioTitle: string, alerts: { id: string; simTime: number; message: string; severity: string }[]): BlackglassView {
  const now = state.simTime

  // People: BLACKGLASS sees identity metadata + observation state only.
  const people = state.entities.people.all().map((p) => personViewForBg(state, p))

  // Vehicles: visible only through road/plate-reader observations.
  const vehicles = state.entities.vehicles.all().map((v) => ({
    id: v.id,
    label: v.label,
    ownerId: v.ownerId,
    pos: v.lastSeen >= 0 && now - v.lastSeen < 900 ? { ...v.pos } : null,
    lastSeen: v.lastSeen,
  }))

  // Observations: only sensor observations (the BG workstation
  // never reads ground-truth copy holders directly).
  const observations = state.entities.observations
    .all()
    .map((o) => ({ ...o, confidence: effectiveConfidence(o, now) }))

  // Copies: what BLACKGLASS "knows" is derived from observations.
  // A copy becomes visible only through an explicit observation chain.
  const copies: CopyView[] = []
  for (const c of state.entities.copies.all()) {
    const obsHit = observations.filter((o) => o.simTime >= c.createdAt && o.subjectIds.includes(c.holderId) && o.confidence >= 0.3)
    const inferred = obsHit.length > 0
    if (!inferred && c.status === 'destroyed') continue // dead copies can fade
    copies.push({
      id: c.id,
      parentId: c.parentId,
      holderId: c.holderId,
      holderName: inferred ? state.entities.people.get(c.holderId)?.name ?? null : null,
      form: c.form,
      bytes: c.bytes,
      integrity: inferred ? c.integrity : 0,
      credibility: inferred ? c.credibility : 0,
      exposure: inferred ? c.exposure : 0,
      level: inferred ? c.level : 0,
      status: inferred ? c.status : 'lost',
      createdAt: c.createdAt,
      descendants: inferred ? [...c.descendants] : [],
      confidence: obsHit.length > 0 ? Math.max(...obsHit.map((o) => o.confidence)) : 0,
    })
  }

  return {
    perspective: 'BLACKGLASS',
    simTime: now,
    scenarioTitle,
    people,
    vehicles,
    observations,
    anomalies: state.anomalies.slice(-200),
    hypotheses: state.hypotheses.filter((h) => h.faction === 'BLACKGLASS'),
    watchCircles: state.watchCircles,
    osintSources: state.osint.sources.map((s) => ({ ...s, anchorLocationIds: [...s.anchorLocationIds], tags: [...s.tags] })),
    osintSignals: state.osint.signals.slice(-80).map((s) => ({ ...s, subjectIds: [...s.subjectIds], tags: [...s.tags], pos: { ...s.pos } })),
    copies,
    resources: state.resources.BLACKGLASS,
    resourceCaps: state.resourceCaps,
    public: state.public,
    infrastructure: state.infrastructure,
    interventions: state.entities.interventions
      .all()
      .map((i) => ({ id: i.id, defId: i.defId, targetIds: [...i.targetIds], readyAt: i.readyAt, resolvesAt: i.resolvesAt, success: i.success })),
    endState: state.endState,
    metrics: (() => {
      // The player's OWN estimate, computed from the player's OWN visible
      // data — deliberately allowed to diverge from hidden ground truth.
      const visible = copies.filter((c) => c.status === 'active' || c.status === 'held' || c.status === 'released' || c.status === 'lost')
      const known = visible.filter((c) => c.status !== 'lost')
      const estimated = known.length + Math.round(state.public.searchDemand * 40)
      const hEstimate =
        known.length === 0
          ? 0
          : known.reduce((s, c) => s + c.confidence * (0.4 + state.public.searchDemand), 0) / known.length
      return {
        knownCopies: known.length,
        estimatedCopies: estimated,
        replicationNumberH: Math.round(hEstimate * 100) / 100,
        containmentProbability: clamp01(1 - hEstimate * 0.55 - state.public.suspicion * 0.3),
      }
    })(),
    alerts: alerts.map((a) => ({ ...a })),
  }
}

function buildHydra(state: SimulationState, scenarioTitle: string): HydraView {
  const now = state.simTime
  const active = state.hydra.activeHolderId ? state.entities.people.get(state.hydra.activeHolderId) : undefined

  // Holders: controlled holders only (positions are own knowledge).
  const holders = state.entities.people
    .all()
    .filter((p) => p.knowledge.copyIds.some((cid) => state.hydra.controlledCopyIds.includes(cid)) || p.id === state.hydra.activeHolderId)
    .map((p) => ({ id: p.id, name: p.name, pos: { ...p.pos }, status: p.status }))

  // Contacts: only people the holder has edges to — perceived trust only.
  const contacts: HydraView['contacts'] = []
  if (active) {
    for (const e of state.entities.edges.all()) {
      if (e.a !== active.id && e.b !== active.id) continue
      const otherId = e.a === active.id ? e.b : e.a
      const other = state.entities.people.get(otherId)
      if (!other) continue
      contacts.push({ id: other.id, name: other.name, trust: e.trust, kind: e.kind, status: other.status })
    }
  }

  // Copies: own controlled genealogy only — with deliberately coarse
  // exposure (the player senses reach, not the BLACKGLASS model's number).
  const copies: HydraView['copies'] = []
  for (const c of state.entities.copies.all()) {
    const controlled = state.hydra.controlledCopyIds.includes(c.id) || (active !== undefined && active.knowledge.copyIds.includes(c.id))
    if (!controlled) continue
    copies.push({
      id: c.id,
      parentId: c.parentId,
      form: c.form,
      bytes: c.bytes,
      integrity: c.integrity,
      credibility: c.credibility,
      status: c.status,
      level: c.level,
      exposure: Math.round(c.exposure * 4) / 4, // quarter buckets
      createdAt: c.createdAt,
    })
  }

  // Heat: coarse buckets only — never a sensor map.
  const heatValue = Math.round(state.hydra.heat * 4) / 4
  const heatLevel = heatValue >= 0.75 ? 'critical' : heatValue >= 0.5 ? 'hot' : heatValue >= 0.25 ? 'warm' : 'cold'

  return {
    perspective: 'HYDRA',
    simTime: now,
    scenarioTitle,
    activeHolderId: state.hydra.activeHolderId,
    holders,
    contacts,
    copies,
    heat: { level: heatLevel, value: heatValue },
    trustCapital: state.hydra.trustCapital,
    credibility: state.hydra.credibility,
    branchIndependence: state.hydra.branchIndependence,
    reach: state.hydra.reach,
    networkHealth: state.hydra.networkHealth,
    public: state.public,
    infrastructure: state.infrastructure,
    osintSignals: state.osint.signals
      .filter((s) => s.public)
      .slice(-24)
      .map((s) => ({ ...s, subjectIds: [], tags: [...s.tags], pos: { ...s.pos } })),
    publicEvents: [], // filled by the store from the shared event log's public events
    commitments: state.hydra.commitments.map((c) => ({ ...c })),
    endState: state.endState,
  }
}

function buildOmniscient(state: SimulationState): OmniscientView {
  const observedCopies = state.entities.copies.all().filter((c) => c.observedBy.includes('BLACKGLASS'))
  const bgKnown = observedCopies.filter((c) => c.status === 'active' || c.status === 'held' || c.status === 'released').length
  const hydraKnown = state.hydra.controlledCopyIds.length

  return {
    perspective: 'OMNISCIENT_REPLAY',
    simTime: state.simTime,
    people: state.entities.people.all(),
    copies: state.entities.copies.all(),
    observations: state.entities.observations.all(),
    osintSources: state.osint.sources,
    osintSignals: state.osint.signals,
    watchCircles: state.watchCircles,
    interventions: state.entities.interventions.all().map((i) => ({ id: i.id, defId: i.defId, targetIds: [...i.targetIds], success: i.success })),
    blackglassBeliefs: {
      knownCopyCount: bgKnown,
      observedHolderHits: state.entities.observations.all().filter((o) => o.simTime >= 0 && o.confidence > 0.4).length,
      suspicion: state.public.suspicion,
    },
    hydraBeliefs: { knownCopyCount: hydraKnown, heat: state.hydra.heat },
  }
}

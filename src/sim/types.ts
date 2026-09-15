/**
 * Authoritative simulation data model (16-prompt "DATA MODEL").
 *
 * Every entity is plain serializable data. Three.js Object3Ds are derived
 * views — never authoritative records. The simulation runs identically in
 * the main thread, a Web Worker, or a replay harness.
 */

export type FactionId = 'BLACKGLASS' | 'HYDRA'

export interface Vec2 {
  x: number
  z: number
}

export type CircleKind = 'family' | 'work' | 'oldFriends' | 'media' | 'online' | 'organization' | 'unknown'
export const CIRCLE_KINDS: CircleKind[] = ['family', 'work', 'oldFriends', 'media', 'online', 'organization', 'unknown']

export type PersonStatus = 'free' | 'detained' | 'unreachable' | 'inactive'
export type LeakIntent = 'unaware' | 'curious' | 'sympathetic' | 'deliberate' | 'publisher' | 'archivist' | 'opportunist'

export type SourceCategory = 'road' | 'access' | 'device' | 'social' | 'financial' | 'aerial' | 'human'
export const SOURCE_CATEGORIES: SourceCategory[] = ['road', 'access', 'device', 'social', 'financial', 'aerial', 'human']

export type OsintSourceKind = 'worldMonitor' | 'caseGraph' | 'radioSpectrum' | 'publicCamera' | 'press'
export type OsintSourceMode = 'offline' | 'configured' | 'blocked'

export type CopyForm = 'original' | 'full' | 'excerpt' | 'index' | 'screenshot' | 'summary'
export const COPY_FORMS: CopyForm[] = ['original', 'full', 'excerpt', 'index', 'screenshot', 'summary']

export type CopyStatus = 'active' | 'held' | 'released' | 'destroyed' | 'discredited' | 'lost'

/** Information levels 0..7 from 06-hydra. */
export type InfoLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export const INFO_LEVEL_NAMES: Record<InfoLevel, string> = {
  0: 'Original',
  1: 'Compromised',
  2: 'Duplicated',
  3: 'Networked',
  4: 'Digital',
  5: 'Mirrored',
  6: 'Viral',
  7: 'Cultural Knowledge',
}

/** Simulation LOD 04-simulation. */
export type LodLevel = 0 | 1 | 2 | 3 | 4

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

export interface Person {
  id: string
  name: string
  ageBand: string
  occupation: string
  roleTags: string[]
  /** Anchor location ids. */
  homeId: string
  workId: string
  circles: CircleKind[]
  status: PersonStatus
  traits: {
    caution: number // 0..1
    loyalty: number
    curiosity: number
    privacy: number
    mediaTrust: number
    stress: number
    riskTolerance: number
    reach: number // amplification potential 0..1
    intent: LeakIntent
  }
  devices: string[]
  knowledge: {
    copyIds: string[]
    awareness: number // 0..1
    credibility: number // 0..1
  }
  schedule: {
    workStartHour: number
    workEndHour: number
    commuteMode: 'walk' | 'transit' | 'drive'
    sleepWindow: [number, number]
  }
  /** Current movement state (LOD1 explicit). */
  pos: Vec2
  moving: boolean
  /** Route node ids remaining (first entry is the next waypoint). */
  route: string[] | null
  lastSeen: number // simTime of last observation (-1 = never)
  confidence: number // last observation confidence 0..1
}

export interface Device {
  id: string
  kind: 'phone' | 'laptop' | 'workMachine' | 'tablet' | 'account'
  ownerCandidates: { personId: string; confidence: number }[]
  online: boolean
  copyIds: string[]
  lastPing: number
}

export interface Vehicle {
  id: string
  label: string
  ownerId: string | null
  pos: Vec2
  moving: boolean
  route: string[] | null
  lastSeen: number
}

export interface Location {
  id: string
  name: string
  kind: 'home' | 'workplace' | 'store' | 'cafe' | 'park' | 'transit' | 'archive' | 'public'
  pos: Vec2
  radius: number
  access: 'public' | 'controlled' | 'private'
}

export interface SocialEdge {
  id: string
  a: string
  b: string
  kind: CircleKind
  trust: number // 0..1
  freq: number // contacts per day
  sharedHistory: number // 0..1
  lastActivated: number // simTime
}

export interface Observation {
  id: string
  simTime: number
  sourceCategory: SourceCategory
  sourceName: string
  kind: 'identification' | 'association' | 'presence'
  /** Best-guess subject ids — may be wrong on association observations. */
  subjectIds: string[]
  vehicleId: string | null
  deviceId: string | null
  locationId: string | null
  pos: Vec2
  confidence: number // 0..1
  payload: string
  decay: number // confidence lost per sim-second
}

export interface OsintSource {
  id: string
  name: string
  kind: OsintSourceKind
  providerUrl: string
  license: string
  mode: OsintSourceMode
  enabled: boolean
  reliability: number // 0..1
  latency: number // expected sim-seconds from event to ingest
  coverage: number // 0..1 scenario-local usefulness
  public: boolean
  anchorLocationIds: string[]
  tags: string[]
  notes: string
}

export interface OsintSignal {
  id: string
  simTime: number
  sourceId: string
  sourceKind: OsintSourceKind
  title: string
  summary: string
  subjectIds: string[]
  locationId: string | null
  pos: Vec2
  confidence: number // 0..1
  severity: 'info' | 'notice' | 'warning' | 'critical'
  tags: string[]
  public: boolean
  verification: 'single-source' | 'corroborated' | 'modeled'
}

export interface Baseline {
  personId: string
  /** Typical schedule numbers (deviations drive anomaly features). */
  workStartHour: number
  workEndHour: number
  commuteMode: Person['schedule']['commuteMode']
  avgContactsPerDay: number
  deviceOnlineRatio: number
  /** Number of baseline observations generated pre-incident. */
  historyDepth: number
}

export type AnalysisModel = 'ATHENA' | 'ORACLE' | 'JANUS'

export interface AnomalyReport {
  id: string
  personId: string
  simTime: number
  model: AnalysisModel
  features: string[]
  score: number // 0..1
  confidence: number // 0..1
  verdict: 'routine' | 'benign-anomaly' | 'suspicious' | 'unknown'
}

export interface Hypothesis {
  id: string
  simTime: number
  faction: FactionId
  subjectId: string
  relation: 'carrier' | 'recipient' | 'path' | 'source' | 'other'
  note: string
  modelScores: { model: AnalysisModel; score: number }[]
}

export interface WatchCircle {
  id: string
  subjectId: string
  kind: CircleKind
  /** Model-computed risk 0..1. */
  risk: number
  /** Player surveillance spend 0..1. */
  coverage: number
  unknownNodes: number
}

export type InterventionCategory =
  | 'administrative'
  | 'information'
  | 'network'
  | 'mobility'
  | 'field'
  | 'infrastructure'
  | 'kinetic'
  | 'blackProgram'
  | 'strategic'

export type TargetKind = 'person' | 'vehicle' | 'device' | 'location' | 'copy' | 'network' | 'area'

export interface InterventionDef {
  id: string
  name: string
  tier: number // 0..100 escalation intensity (07-interventions)
  category: InterventionCategory
  validTargets: TargetKind[]
  prerequisites: string[]
  activationDelay: number // sim-seconds
  effectWindow: number // sim-seconds
  successProbability: number
  reversibility: boolean
  publicity: number // 0..1
  suspicionDelta: number // signed
  infrastructureImpact: number // 0..1
  authorityCost: number
  budgetCost: number
  attributionRisk: number // 0..1
  hydraDelta: number // signed — effect on replication pressure
  cooldown: number
  narrativeTags: string[]
  description: string
}

export interface InterventionInstance {
  id: string
  defId: string
  issuedAt: number
  readyAt: number
  resolvesAt: number
  targetIds: string[]
  success: boolean | null
  effects: string[]
}

export interface FactionResources {
  compute: number
  analysts: number
  field: number
  network: number
  satellites: number
  /** Legal/administrative authority to act. */
  authority: number
  politicalCapital: number
  budget: number
}

export interface ResourceCaps {
  compute: number
  analysts: number
  field: number
  network: number
  satellites: number
  authority: number
  politicalCapital: number
}

export interface PublicState {
  suspicion: number // 0..1
  mediaAttention: number // 0..1
  searchDemand: number // 0..1
}

export interface InfrastructureState {
  grid: 'up' | 'degraded' | 'down'
  telecom: 'up' | 'degraded' | 'down'
  traffic: number // congestion 0..1
}

/** HYDRA player systems (16-prompt): trust capital, credibility, branches… */
export interface HydraFactionState {
  activeHolderId: string | null
  controlledCopyIds: string[]
  trustCapital: number
  credibility: number
  branchIndependence: number
  reach: number
  /** Fuzzy heat 0..1 — deliberately coarse for the player. */
  heat: number
  networkHealth: number
  commitments: { personId: string; dueAt: number; what: string }[]
}

export interface EndState {
  kind: 'none' | 'contained' | 'practicalFailure' | 'released' | 'discredited' | 'timeExpired'
  at: number
  summary: string
}

/* ------------------------------------------------------------------ */
/* Tables + state                                                      */
/* ------------------------------------------------------------------ */

/** Minimal data-oriented table: stable order + O(1) id lookup. */
export class Table<T extends { id: string }> {
  private map = new Map<string, T>()
  private order: string[] = []

  add(t: T): void {
    if (!this.map.has(t.id)) this.order.push(t.id)
    this.map.set(t.id, t)
  }

  get(id: string): T | undefined {
    return this.map.get(id)
  }

  has(id: string): boolean {
    return this.map.has(id)
  }

  all(): T[] {
    return this.order.map((id) => this.map.get(id)!)
  }

  get size(): number {
    return this.order.length
  }

  remove(id: string): void {
    this.map.delete(id)
    this.order = this.order.filter((x) => x !== id)
  }

  exportState(): T[] {
    return this.all()
  }

  static from<T extends { id: string }>(items: T[]): Table<T> {
    const t = new Table<T>()
    for (const it of items) t.add(it)
    return t
  }
}

export interface SimulationState {
  scenarioId: string
  seed: number
  simTime: number
  tick: number
  entities: {
    people: Table<Person>
    devices: Table<Device>
    vehicles: Table<Vehicle>
    locations: Table<Location>
    edges: Table<SocialEdge>
    copies: Table<InfoCopy>
    observations: Table<Observation>
    interventions: Table<InterventionInstance>
  }
  baselines: Record<string, Baseline>
  anomalies: AnomalyReport[]
  hypotheses: Hypothesis[]
  watchCircles: WatchCircle[]
  osint: {
    sources: OsintSource[]
    signals: OsintSignal[]
  }
  resources: Record<FactionId, FactionResources>
  resourceCaps: ResourceCaps
  public: PublicState
  infrastructure: InfrastructureState
  hydra: HydraFactionState
  endState: EndState | null
}

export interface InfoCopy {
  id: string
  archiveId: string
  parentId: string | null
  holderType: 'person' | 'device' | 'server' | 'cache'
  holderId: string
  form: CopyForm
  bytes: number
  integrity: number // 0..1
  credibility: number // 0..1
  exposure: number // 0..1
  replicationPotential: number // 0..1
  level: InfoLevel
  createdAt: number
  lastObservedAt: number
  descendants: string[]
  status: CopyStatus
  /** Which factions have observed this copy (perspective gate). */
  observedBy: FactionId[]
}

export function defaultResources(): FactionResources {
  return { compute: 80, analysts: 60, field: 40, network: 50, satellites: 20, authority: 90, politicalCapital: 70, budget: 100 }
}

export function defaultCaps(): ResourceCaps {
  return { compute: 100, analysts: 100, field: 100, network: 100, satellites: 100, authority: 100, politicalCapital: 100 }
}

export function emptyState(scenarioId: string, seed: number): SimulationState {
  return {
    scenarioId,
    seed,
    simTime: 0,
    tick: 0,
    entities: {
      people: new Table(),
      devices: new Table(),
      vehicles: new Table(),
      locations: new Table(),
      edges: new Table(),
      copies: new Table(),
      observations: new Table(),
      interventions: new Table(),
    },
    baselines: {},
    anomalies: [],
    hypotheses: [],
    watchCircles: [],
    osint: { sources: [], signals: [] },
    resources: { BLACKGLASS: defaultResources(), HYDRA: defaultResources() },
    resourceCaps: defaultCaps(),
    public: { suspicion: 0.05, mediaAttention: 0.02, searchDemand: 0.01 },
    infrastructure: { grid: 'up', telecom: 'up', traffic: 0.2 },
    hydra: {
      activeHolderId: null,
      controlledCopyIds: [],
      trustCapital: 50,
      credibility: 0.5,
      branchIndependence: 0.3,
      reach: 0.1,
      heat: 0.1,
      networkHealth: 80,
      commitments: [],
    },
    endState: null,
  }
}

/** Deterministic structural hash for replay equivalence checks. */
export function stateFingerprint(state: SimulationState): string {
  const pick = {
    t: state.simTime,
    k: state.tick,
    people: state.entities.people.all().map((p) => [p.id, Math.round(p.pos.x * 100) / 100, Math.round(p.pos.z * 100) / 100, p.status, p.knowledge.copyIds.length, p.moving]),
    copies: state.entities.copies.all().map((c) => [c.id, c.parentId, c.holderId, c.form, c.status, c.level, c.descendants.length]),
    obs: state.entities.observations.all().map((o) => [o.subjectIds.join(','), o.simTime, o.confidence]),
    osint: state.osint.signals.map((s) => [s.id, s.sourceId, s.simTime, s.confidence, s.public]),
    hydra: [state.hydra.activeHolderId, state.hydra.controlledCopyIds.length],
    pub: [state.public.suspicion, state.public.mediaAttention, state.public.searchDemand],
    end: state.endState?.kind ?? 'none',
  }
  return JSON.stringify(pick)
}

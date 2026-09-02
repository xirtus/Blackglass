/**
 * GameEngine — authoritative simulation host.
 *
 * - Commands are the only mutation path (replayable decision log).
 * - Systems tick at a fixed step; rendering subscribes to derived views.
 * - Deterministic: seed + command log + versioned rules reproduce a run.
 */
import { GameClock } from '@/core/clock'
import type { Command, Difficulty, FactionId, Perspective } from '@/core/commands'
import { EventLog, EventQueue, makeEvent } from '@/core/events'
import { hashString, RngStreams } from '@/core/rng'
import { parseSave, SAVE_SCHEMA_VERSION, type CampaignState, type SaveGamePayload, type SaveSettings, serializeSave } from '@/core/save'
import { generateSyntheticLives, locationsFromManifest } from './life'
import { getIntervention, prerequisitesMet, canAfford, cooldownRemaining } from './interventionCatalog'
import { selectVisibleState, type ViewModel } from './perspective'
import { validateScenario, type ScenarioManifest } from './scenario'
import {
  dist,
  anomalySystem,
  confidenceDecaySystem,
  contactSystem,
  createDescendantCopy,
  endStateSystem,
  handoffSystem,
  hydraSystem,
  interventionSystem,
  movementSystem,
  observationSystem,
  osintSystem,
  scheduleSystem,
  type SimContext,
} from './systems'
import { computeBlackglassScore, computeHydraMetrics, computeHydraScore } from './metrics'
import { BoundedBlackglassAI, HydraAgentAI, type FactionController } from './controllers'
import { defaultCampaignState, defaultSettings } from '@/core/save'
import { INFOS_LEVELS_BY_FORM } from './copyForms'
import { emptyState, stateFingerprint, type SimulationState, type WatchCircle } from './types'
import { leakDossierForScenario } from '@/data/leakDossiers'

export interface EngineOptions {
  perspective: Perspective
  humanFaction: FactionId | 'SPECTATOR'
  difficulty: Difficulty
  settings?: SaveSettings
  campaignState?: CampaignState
}

export class GameEngine {
  readonly manifest: ScenarioManifest
  readonly streams: RngStreams
  readonly clock = new GameClock()
  readonly log = new EventLog()
  readonly queue = new EventQueue()
  readonly options: EngineOptions
  state: SimulationState
  campaignState: CampaignState
  settings: SaveSettings

  /** Commands not yet applied (issued for the future). */
  private pending: Command[] = []
  /** Every command ever applied — the replay spine. */
  commandLog: Command[] = []
  /** Deliberately rejected commands (UI feedback + QA). */
  rejections: { cmd: Command; error: string }[] = []

  private controllers: Map<FactionId, FactionController> = new Map()
  private version = 0
  private listeners = new Set<(engine: GameEngine) => void>()

  private constructor(manifest: ScenarioManifest, options: EngineOptions, campaignState?: CampaignState, settings?: SaveSettings) {
    const errors = validateScenario(manifest)
    if (errors.length > 0) throw new Error(`Invalid scenario "${manifest.id}": ${errors.join('; ')}`)

    this.manifest = manifest
    this.streams = new RngStreams(manifest.seed)
    this.options = options
    this.campaignState = campaignState ?? defaultCampaignState()
    this.settings = settings ?? defaultSettings()
    this.state = this.initializeState()

    // Controllers: human side is driven through issueCommand();
    // the opposing side gets a bounded AI controller.
    if (options.humanFaction === 'SPECTATOR') {
      this.controllers.set('BLACKGLASS', new BoundedBlackglassAI())
      this.controllers.set('HYDRA', new HydraAgentAI())
    } else {
      const aiFaction: FactionId = options.humanFaction === 'BLACKGLASS' ? 'HYDRA' : 'BLACKGLASS'
      this.controllers.set(
        aiFaction,
        aiFaction === 'HYDRA' ? new HydraAgentAI() : new BoundedBlackglassAI(),
      )
    }
  }

  static create(manifest: ScenarioManifest, options: EngineOptions, campaignState?: CampaignState, settings?: SaveSettings): GameEngine {
    return new GameEngine(manifest, options, campaignState, settings)
  }

  /* ---------------------------------------------------------------- */
  /* Scenario bootstrap                                                */
  /* ---------------------------------------------------------------- */

  private initializeState(): SimulationState {
    const ctx = this.context()
    const state = ctx.state

    // Locations from the manifest (public/controlled/private fiction).
    const locations = locationsFromManifest(this.manifest)
    for (const l of locations) state.entities.locations.add(l)
    state.osint.sources = structuredClone(this.manifest.osintSources ?? [])

    // Synthetic lives: identity, routines, social circles, devices.
    const lives = generateSyntheticLives(this.streams, this.manifest, locations)
    for (const p of lives.people) state.entities.people.add(p)
    for (const d of lives.devices) state.entities.devices.add(d)
    for (const v of lives.vehicles) state.entities.vehicles.add(v)
    for (const e of lives.edges) state.entities.edges.add(e)
    state.baselines = lives.baselines

    // Authored beat: the original archive leaves the controlled location
    // in the hands of the scenario's carrier.
    const carrier = lives.people.find((p) => p.roleTags.includes('carrier_a')) ?? lives.people[0]
    const origin = state.entities.locations.get(this.manifest.origin.locationId)
    if (origin) {
      carrier.pos = { x: origin.pos.x + 10, z: origin.pos.z + 10 }
    }
    carrier.traits.intent = 'deliberate'
    carrier.knowledge.awareness = 1
    carrier.knowledge.credibility = this.manifest.archive.credibility

    const original = {
      id: `copy_original`,
      archiveId: this.manifest.archive.id,
      parentId: null,
      holderType: 'person' as const,
      holderId: carrier.id,
      form: 'original' as const,
      bytes: this.manifest.archive.bytes,
      integrity: 1,
      credibility: this.manifest.archive.credibility,
      exposure: 0,
      replicationPotential: carrier.traits.reach,
      level: INFOS_LEVELS_BY_FORM.original,
      createdAt: 0,
      lastObservedAt: -1,
      descendants: [],
      status: 'held' as const,
      observedBy: ['HYDRA'] as FactionId[],
    }
    state.entities.copies.add(original)
    carrier.knowledge.copyIds.push(original.id)
    state.hydra.activeHolderId = carrier.id
    state.hydra.controlledCopyIds.push(original.id)
    state.hydra.credibility = this.manifest.archive.credibility
    const dossier = leakDossierForScenario(this.manifest)

    // Watch Index: one circle per circle-kind around the carrier.
    const watchKinds: WatchCircle['kind'][] = ['family', 'work', 'media', 'oldFriends', 'online', 'unknown']
    for (const kind of watchKinds) {
      state.watchCircles.push({
        id: `wc_${carrier.id}_${kind}`,
        subjectId: carrier.id,
        kind,
        risk: 0.2 + (kind === 'media' || kind === 'unknown' ? 0.35 : 0),
        coverage: 0,
        unknownNodes: kind === 'unknown' ? 3 : kind === 'online' ? 2 : 0,
      })
    }

    this.log.push(
      makeEvent(0, 'ALERT', `${dossier.codename}: ${dossier.archiveType} is unaccounted for at ${origin?.name ?? 'origin'}.`, {
        severity: 'critical',
        subjects: [carrier.id],
        payload: { archiveId: this.manifest.archive.id, bytes: this.manifest.archive.bytes, dossier: dossier.codename },
        provenance: { source: 'scenario.beat', reason: 'missing_copy' },
      }),
      makeEvent(0, 'SIM_INFO', `Scenario ${this.manifest.id} initialized with ${lives.people.length} explicit synthetic lives.`, {
        severity: 'info',
        subjects: [],
        payload: { seed: this.manifest.seed },
        provenance: { source: 'scenario', reason: 'init' },
      }),
    )
    return state
  }

  private context(): SimContext {
    // Rebuild lightweight ctx; state is swapped in by initializeState.
    if (!this.state) {
      this.state = this.freshState()
    }
    return {
      state: this.state,
      manifest: this.manifest,
      streams: this.streams,
      log: this.log,
      queue: this.queue,
    }
  }

  private freshState(): SimulationState {
    return emptyState(this.manifest.id, this.manifest.seed)
  }

  /* ---------------------------------------------------------------- */
  /* Commands                                                          */
  /* ---------------------------------------------------------------- */

  /** UI/AI entry point. Commands queue and apply at their simTime. */
  issueCommand(cmd: Command): { ok: boolean; error?: string } {
    const error = this.validate(cmd)
    if (error) {
      this.rejections.push({ cmd, error })
      return { ok: false, error }
    }
    this.pending.push(cmd)
    this.pending.sort((a, b) => a.simTime - b.simTime)
    return { ok: true }
  }

  validate(cmd: Command): string | undefined {
    const now = this.state.simTime
    if (cmd.simTime < now) return 'Command timestamp is in the past'
    if (cmd.kind.startsWith('bg.') && cmd.faction !== 'BLACKGLASS') return 'BLACKGLASS command from wrong faction'
    if (cmd.kind.startsWith('hydra.') && cmd.faction !== 'HYDRA') return 'HYDRA command from wrong faction'
    if (cmd.kind === 'bg.watchCircle') {
      const c = this.state.watchCircles.find((w) => w.id === cmd.circleId)
      if (!c) return 'Unknown watch circle'
      if (cmd.level < 0 || cmd.level > 1) return 'Watch level out of range'
      const cost = Math.round(cmd.level * 20)
      if (this.state.resources.BLACKGLASS.compute < cost) return 'Insufficient compute'
    }
    if (cmd.kind === 'bg.intervene') {
      const def = getIntervention(cmd.interventionId)
      if (!def) return 'Unknown intervention'
      if (!this.manifest.interventionIds.includes(def.id)) return 'Intervention not available in this scenario'
      if (!prerequisitesMet(def, this.state)) return 'Prerequisites not met'
      if (!canAfford(def, this.state.resources.BLACKGLASS)) return 'Insufficient authority or budget'
      const last = this.state.entities.interventions.all().find((i) => i.defId === def.id)
      if (cooldownRemaining(last, def, now) > 0) return 'On cooldown'
      // Scenario-validation contract: interventions cannot target invalid
      // entity categories (14-performance-qa).
      const targetKinds = new Set(cmd.targetIds.map((t) => this.kindOf(t)))
      if (targetKinds.size === 0 || [...targetKinds].some((k) => k !== 'unknown' && !def.validTargets.includes(k))) {
        return 'Target does not match valid target categories'
      }
    }
    if (cmd.kind === 'hydra.duplicate' || cmd.kind === 'hydra.release' || cmd.kind === 'hydra.authenticate' || cmd.kind === 'hydra.abandonBranch') {
      const copy = this.state.entities.copies.get(cmd.copyId)
      if (!copy) return 'Unknown copy'
      if (!this.state.hydra.controlledCopyIds.includes(copy.id)) return 'Copy not under HYDRA control'
      if (cmd.kind === 'hydra.duplicate') {
        if (cmd.targetPersonId) {
          const target = this.state.entities.people.get(cmd.targetPersonId)
          if (!target) return 'Unknown contact'
          const holder = copy.holderType === 'person' ? this.state.entities.people.get(copy.holderId) : undefined
          if (!holder) return 'Copy holder unavailable'
          if (dist(holder.pos, target.pos) > 400) return 'Contact too far for this form of transfer'
        }
      }
      if (cmd.kind === 'hydra.release' && copy.credibility < 0.3) return 'Copy credibility too low to release'
    }
    if (cmd.kind === 'hydra.contact') {
      const p = this.state.entities.people.get(cmd.personId)
      if (!p) return 'Unknown person'
    }
    if (cmd.kind === 'hydra.transferControl') {
      const copy = this.state.entities.copies.get(cmd.copyId)
      const p = this.state.entities.people.get(cmd.personId)
      if (!copy || !p) return 'Unknown copy or holder'
      if (p.status !== 'free') return 'Holder unavailable'
    }
    return undefined
  }

  /** Apply a command's effects immediately (at its simTime). */
  private apply(cmd: Command): void {
    const { state, log, streams } = this.context()
    const now = this.state.simTime

    switch (cmd.kind) {
      case 'clock.setSpeed':
        this.clock.speed = cmd.speed
        break
      case 'clock.pause':
        this.clock.paused = cmd.paused
        break
      case 'bg.watchCircle': {
        const c = state.watchCircles.find((w) => w.id === cmd.circleId)
        if (!c) break
        const delta = cmd.level - c.coverage
        const cost = Math.round(Math.abs(delta) * 20)
        if (delta > 0) state.resources.BLACKGLASS.compute = Math.max(0, state.resources.BLACKGLASS.compute - cost)
        c.coverage = cmd.level
        break
      }
      case 'bg.unwatchCircle': {
        const c = state.watchCircles.find((w) => w.id === cmd.circleId)
        if (c) c.coverage = 0
        break
      }
      case 'bg.pin': {
        log.push(
          makeEvent(now, 'SIM_INFO', `Analyst pinned subject ${cmd.subjectId}.`, {
            severity: 'info',
            subjects: [cmd.subjectId],
            provenance: { source: 'analyst', reason: 'pin' },
          }),
        )
        break
      }
      case 'bg.hypothesize': {
        state.hypotheses.push({
          id: `hyp_${state.hypotheses.length}_${cmd.subjectId}`,
          simTime: now,
          faction: 'BLACKGLASS',
          subjectId: cmd.subjectId,
          relation: cmd.relation,
          note: cmd.note,
          modelScores: [
            { model: 'ATHENA', score: Math.round(streams.stream('model.ATHENA').next() * 100) / 100 },
            { model: 'ORACLE', score: Math.round(streams.stream('model.ORACLE').next() * 100) / 100 },
            { model: 'JANUS', score: Math.round(streams.stream('model.JANUS').next() * 100) / 100 },
          ],
        })
        log.push(
          makeEvent(now, 'SIM_INFO', `Hypothesis filed: ${cmd.subjectId} as ${cmd.relation}.`, {
            severity: 'info',
            subjects: [cmd.subjectId],
            provenance: { source: 'analyst', reason: 'hypothesis' },
          }),
        )
        break
      }
      case 'bg.intervene': {
        const def = getIntervention(cmd.interventionId)
        if (!def) break
        state.resources.BLACKGLASS.authority = Math.max(0, state.resources.BLACKGLASS.authority - def.authorityCost)
        state.resources.BLACKGLASS.budget = Math.max(0, state.resources.BLACKGLASS.budget - def.budgetCost)
        state.resources.BLACKGLASS.politicalCapital = Math.max(0, state.resources.BLACKGLASS.politicalCapital - def.attributionRisk * 10)
        state.entities.interventions.add({
          id: `int_${state.entities.interventions.size}_${def.id}`,
          defId: def.id,
          issuedAt: now,
          readyAt: now + def.activationDelay,
          resolvesAt: now + def.activationDelay + def.effectWindow,
          targetIds: [...cmd.targetIds],
          success: null,
          effects: [],
        })
        log.push(
          makeEvent(now, 'SIM_INFO', `${def.name} authorized against ${cmd.targetIds.join(', ')}. Activation in ${Math.round(def.activationDelay)}s.`, {
            severity: 'warning',
            subjects: cmd.targetIds,
            payload: { interventionId: def.id },
            provenance: { source: 'blackglass.command', reason: 'authorized' },
          }),
        )
        break
      }
      case 'hydra.contact': {
        const p = state.entities.people.get(cmd.personId)
        const holder = state.hydra.activeHolderId ? state.entities.people.get(state.hydra.activeHolderId) : undefined
        if (p && holder) {
          state.hydra.trustCapital = Math.max(0, state.hydra.trustCapital - 2)
          state.hydra.commitments.push({ personId: p.id, dueAt: now + 600, what: `meeting requested by ${holder.name}` })
          log.push(
            makeEvent(now, 'SIM_INFO', `${holder.name} reached out to ${p.name}.`, {
              severity: 'notice',
              subjects: [p.id, holder.id],
              provenance: { source: 'hydra.command', reason: 'contact' },
            }),
          )
        }
        break
      }
      case 'hydra.duplicate': {
        const copy = state.entities.copies.get(cmd.copyId)
        if (!copy) break
        const target = cmd.targetPersonId ? state.entities.people.get(cmd.targetPersonId) : undefined
        // Player-directed duplication: commitment + delay, then resolve.
        state.hydra.trustCapital = Math.max(0, state.hydra.trustCapital - 5)
        if (target) {
          const child = createDescendantCopy(this.context(), copy, target, cmd.form)
          state.hydra.controlledCopyIds.push(child.id)
          state.hydra.branchIndependence = Math.min(1, state.hydra.branchIndependence + 0.08)
          log.push(
            makeEvent(now, 'COPY_CREATED', `${cmd.form.toUpperCase()} copy entrusted to ${target.name}.`, {
              severity: 'critical',
              subjects: [child.id, target.id],
              payload: { parent: copy.id, form: cmd.form },
              provenance: { source: 'hydra.command', reason: 'duplicate' },
            }),
          )
        } else {
          // Local duplication (device/cache form).
          const holder = state.entities.people.get(copy.holderId)
          if (holder) {
            const child = createDescendantCopy(this.context(), copy, holder, cmd.form)
            child.holderType = 'cache'
            state.hydra.controlledCopyIds.push(child.id)
            log.push(
              makeEvent(now, 'COPY_CREATED', `Local ${cmd.form.toUpperCase()} duplicate secured.`, {
                severity: 'notice',
                subjects: [child.id, holder.id],
                payload: { parent: copy.id, form: cmd.form },
                provenance: { source: 'hydra.command', reason: 'duplicate' },
              }),
            )
          }
        }
        break
      }
      case 'hydra.authenticate': {
        const copy = state.entities.copies.get(cmd.copyId)
        if (copy) {
          copy.credibility = Math.min(1, copy.credibility + 0.12)
          state.hydra.credibility = copy.credibility
          state.hydra.trustCapital = Math.max(0, state.hydra.trustCapital - 3)
          log.push(
            makeEvent(now, 'SIM_INFO', `Independent review of ${copy.id} raised its credibility.`, {
              severity: 'notice',
              subjects: [copy.id],
              provenance: { source: 'hydra.command', reason: 'authenticate' },
            }),
          )
        }
        break
      }
      case 'hydra.release': {
        const copy = state.entities.copies.get(cmd.copyId)
        if (copy) {
          copy.status = 'released'
          copy.exposure = Math.max(copy.exposure, cmd.scope === 'public' ? 0.35 : cmd.scope === 'staged' ? 0.2 : 0.08)
          state.public.searchDemand = Math.min(1, state.public.searchDemand + (cmd.scope === 'public' ? 0.3 : 0.12))
          state.public.mediaAttention = Math.min(1, state.public.mediaAttention + 0.15)
          state.hydra.heat = Math.min(1, state.hydra.heat + 0.15)
          copy.observedBy = Array.from(new Set<FactionId>([...copy.observedBy, 'BLACKGLASS']))
          log.push(
            makeEvent(now, 'COPY_RELEASED', `${cmd.scope.toUpperCase()} release of ${copy.id} is live.`, {
              severity: 'critical',
              subjects: [copy.id],
              payload: { scope: cmd.scope, exposure: Math.round(copy.exposure * 100) },
              provenance: { source: 'hydra.command', reason: 'release' },
            }),
          )
        }
        break
      }
      case 'hydra.abandonBranch': {
        const copy = state.entities.copies.get(cmd.copyId)
        if (copy) {
          copy.status = 'lost'
          state.hydra.controlledCopyIds = state.hydra.controlledCopyIds.filter((id) => id !== copy.id)
          state.hydra.networkHealth = Math.max(0, state.hydra.networkHealth - 5)
          log.push(
            makeEvent(now, 'SIM_INFO', `Branch ${copy.id} abandoned.`, {
              severity: 'notice',
              subjects: [copy.id],
              provenance: { source: 'hydra.command', reason: 'abandon' },
            }),
          )
        }
        break
      }
      case 'hydra.transferControl': {
        const copy = state.entities.copies.get(cmd.copyId)
        const p = state.entities.people.get(cmd.personId)
        if (copy && p) {
          state.hydra.activeHolderId = p.id
          copy.holderId = p.id
          copy.holderType = 'person'
          p.knowledge.copyIds.push(copy.id)
          state.hydra.controlledCopyIds = [...new Set([...state.hydra.controlledCopyIds, copy.id])]
          log.push(
            makeEvent(now, 'SIM_INFO', `Control transferred to ${p.name}.`, {
              severity: 'notice',
              subjects: [p.id, copy.id],
              provenance: { source: 'hydra.command', reason: 'transfer' },
            }),
          )
        }
        break
      }
      case 'hydra.shield': {
        const p = state.entities.people.get(cmd.personId)
        if (p) {
          state.hydra.heat = Math.min(1, state.hydra.heat + 0.05)
          state.hydra.trustCapital = Math.max(0, state.hydra.trustCapital - 4)
          log.push(
            makeEvent(now, 'PUBLIC_EVENT', `${p.name} is now under public attention as a shield.`, {
              severity: 'notice',
              subjects: [p.id],
              provenance: { source: 'hydra.command', reason: 'shield' },
            }),
          )
        }
        break
      }
      case 'hydra.decoy': {
        const p = state.entities.people.get(cmd.personId)
        if (p) {
          state.hydra.heat = Math.max(0, state.hydra.heat - 0.08)
          state.hydra.trustCapital = Math.max(0, state.hydra.trustCapital - 2)
          log.push(
            makeEvent(now, 'SIM_INFO', `Noise action committed around ${p.name}.`, {
              severity: 'info',
              subjects: [p.id],
              provenance: { source: 'hydra.command', reason: 'decoy' },
            }),
          )
        }
        break
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Tick                                                              */
  /* ---------------------------------------------------------------- */

  /** Run one fixed simulation step. */
  step(): void {
    const now = this.state.simTime

    // Apply due commands.
    let applied = 0
    while (this.pending.length > 0 && this.pending[0].simTime <= now) {
      const cmd = this.pending.shift()!
      this.apply(cmd)
      this.commandLog.push(cmd)
      applied++
    }

    // Run systems in a fixed order.
    const ctx = this.context()
    const dt = this.clock.stepSize
    scheduleSystem(ctx, dt)
    movementSystem(ctx, dt)
    const meetings = contactSystem(ctx, dt)
    handoffSystem(ctx, dt, meetings)
    observationSystem(ctx, dt)
    osintSystem(ctx, dt)
    confidenceDecaySystem(ctx, dt)
    anomalySystem(ctx, dt)
    hydraSystem(ctx, dt)
    interventionSystem(ctx, dt)
    endStateSystem(ctx, dt)

    // Opposing AI controllers reason from perspective-filtered views.
    if (!this.clock.paused) {
      for (const [faction, ai] of this.controllers) {
        const view = selectVisibleState(this.state, faction, this.manifest.title, this.recentAlerts())
        if (view.perspective === 'OMNISCIENT_REPLAY') continue
        const host = {
          streams: this.streams,
          difficulty: this.options.difficulty,
          validate: (cmd: Command) => this.validate(cmd) === undefined,
        }
        for (const cmd of ai.onTick(host, view, now)) {
          // AI commands are validated against the same rules as human ones.
          const res = this.issueCommand(cmd)
          if (!res.ok) this.rejections.push({ cmd, error: res.error ?? 'rejected' })
        }
      }
    }
    if (applied === 0 && this.pending.length === 0) void 0

    this.state.simTime = now + dt
    this.state.tick++
    this.clock.simTime = this.state.simTime

    this.version++
    for (const l of this.listeners) l(this)
  }

  /** Advance by real seconds; returns steps executed. */
  advance(realDt: number): number {
    let steps = this.clock.advance(realDt)
    let guard = 0
    while (steps > 0 && guard < 4000) {
      this.step()
      steps--
      guard++
    }
    return guard
  }

  /** Entity category of an id (for intervention target validation). */
  private kindOf(id: string): 'person' | 'vehicle' | 'device' | 'location' | 'copy' | 'network' | 'area' | 'unknown' {
    if (this.state.entities.people.has(id)) return 'person'
    if (this.state.entities.vehicles.has(id)) return 'vehicle'
    if (this.state.entities.devices.has(id)) return 'device'
    if (this.state.entities.locations.has(id)) return 'location'
    if (this.state.entities.copies.has(id)) return 'copy'
    return 'unknown'
  }

  aiFaction(): FactionId {
    if (this.options.humanFaction === 'SPECTATOR') return 'BLACKGLASS'
    return this.options.humanFaction === 'BLACKGLASS' ? 'HYDRA' : 'BLACKGLASS'
  }

  /** Advance until the next critical event or end state (analyst tool). */
  advanceToNextEvent(): number {
    const targetTypes = new Set(['ALERT', 'ANOMALY', 'COPY_CREATED', 'COPY_RELEASED', 'INTERVENTION_STARTED', 'INTERVENTION_RESOLVED', 'END_STATE'])
    const lastSeen = this.log.all().length
    let steps = 0
    while (steps < 1200) {
      this.step()
      steps++
      const fresh = this.log.all().slice(lastSeen)
      if (fresh.some((e) => targetTypes.has(e.type))) break
    }
    return steps
  }

  recentAlerts(): { id: string; simTime: number; message: string; severity: string }[] {
    return this.log
      .all()
      .filter((e) => e.type === 'ALERT' || e.type === 'ANOMALY' || e.type === 'COPY_CREATED' || e.type === 'COPY_RELEASED' || e.type === 'INTERVENTION_STARTED')
      .slice(-12)
      .map((e) => ({ id: e.id, simTime: e.simTime, message: e.message, severity: e.severity }))
  }

  viewModel(perspective: Perspective = this.options.perspective): ViewModel {
    return selectVisibleState(this.state, perspective, this.manifest.title, this.recentAlerts())
  }

  get versionCount(): number {
    return this.version
  }

  subscribe(listener: (engine: GameEngine) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Deterministic fingerprint of the run (replay equivalence). */
  fingerprint(): string {
    return hashString(stateFingerprint(this.state) + '|' + this.commandLog.map((c) => `${c.kind}:${c.simTime}:${c.faction}:${c.controller}`).join(',')).toString(16)
  }

  metrics() {
    return computeHydraMetrics(this.state)
  }

  blackglassScore(initialAuthority = 100, initialBudget = 100) {
    return computeBlackglassScore(this.state, initialAuthority, initialBudget)
  }

  hydraScore() {
    return computeHydraScore(this.state)
  }

  /* ---------------------------------------------------------------- */
  /* Save / load / replay                                              */
  /* ---------------------------------------------------------------- */

  toSaveJson(): string {
    const payload: SaveGamePayload = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      campaignVersion: 'rev1.1',
      scenarioId: this.manifest.id,
      scenarioSeed: this.manifest.seed,
      simTime: this.state.simTime,
      commands: this.commandLog,
      snapshot: {
        rngStreams: this.streams.exportState(),
        clock: this.clock.exportState(),
        entities: {
          people: this.state.entities.people.exportState(),
          devices: this.state.entities.devices.exportState(),
          vehicles: this.state.entities.vehicles.exportState(),
          locations: this.state.entities.locations.exportState(),
          edges: this.state.entities.edges.exportState(),
          copies: this.state.entities.copies.exportState(),
          observations: this.state.entities.observations.exportState(),
          interventions: this.state.entities.interventions.exportState(),
        },
        baselines: this.state.baselines,
        anomalies: this.state.anomalies,
        hypotheses: this.state.hypotheses,
        watchCircles: this.state.watchCircles,
        osint: this.state.osint,
        resources: this.state.resources,
        public: this.state.public,
        infrastructure: this.state.infrastructure,
        hydra: this.state.hydra,
        endState: this.state.endState,
        tick: this.state.tick,
      },
      campaignState: this.campaignState,
      settings: this.settings,
    }
    return serializeSave(payload)
  }

  static fromSaveJson(json: string, manifest: ScenarioManifest, options: EngineOptions): GameEngine {
    const save = parseSave(json)
    if (save.scenarioId !== manifest.id) throw new Error('Save belongs to a different scenario')
    const engine = GameEngine.create(manifest, options, save.campaignState, save.settings)
    // Replay the command log deterministically up to the saved simTime.
    for (const cmd of save.commands) engine.issueCommand(cmd)
    const target = save.simTime
    let guard = 0
    while (engine.state.simTime < target && guard < 200000) {
      engine.step()
      guard++
    }
    return engine
  }

  /** Seed + command log reproduce the run — replay without rendering. */
  static replay(manifest: ScenarioManifest, options: EngineOptions, commands: Command[], until?: number): GameEngine {
    const engine = GameEngine.create(manifest, options)
    for (const cmd of commands) engine.issueCommand(cmd)
    const target = until ?? Number.POSITIVE_INFINITY
    let guard = 0
    while (engine.state.simTime < target && guard < 500000 && (!engine.state.endState || engine.state.endState.kind === 'none')) {
      engine.step()
      guard++
    }
    return engine
  }
}

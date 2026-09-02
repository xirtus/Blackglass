/** Append-only event log + future event queue. Every event has provenance. */

export type EventType =
  | 'SIM_INFO'
  | 'ALERT'
  | 'OBSERVATION'
  | 'ANOMALY'
  | 'CONTACT'
  | 'COPY_CREATED'
  | 'COPY_DESTROYED'
  | 'COPY_RELEASED'
  | 'INTERVENTION_STARTED'
  | 'INTERVENTION_RESOLVED'
  | 'PUBLIC_EVENT'
  | 'INFRASTRUCTURE'
  | 'END_STATE'

export interface GameEvent {
  id: string
  simTime: number
  type: EventType
  message: string
  severity: 'info' | 'notice' | 'warning' | 'critical'
  /** Related entity ids for cross-highlighting. */
  subjects: string[]
  payload: Record<string, string | number | boolean>
  provenance: { source: string; reason: string }
}

let eventCounter = 0

export function makeEvent(
  simTime: number,
  type: EventType,
  message: string,
  opts: Partial<Pick<GameEvent, 'severity' | 'subjects' | 'payload' | 'provenance'>> = {},
): GameEvent {
  eventCounter++
  return {
    id: `ev_${eventCounter.toString(36)}`,
    simTime,
    type,
    message,
    severity: opts.severity ?? 'info',
    subjects: opts.subjects ?? [],
    payload: opts.payload ?? {},
    provenance: opts.provenance ?? { source: 'simulation', reason: 'system' },
  }
}

export class EventLog {
  /** In-memory ring cap — long runs never grow memory without bound.
   *  Saves carry the snapshot, not the full log; replays rebuild it. */
  static readonly MAX_IN_MEMORY = 5000
  private events: GameEvent[] = []
  private total = 0

  push(...evs: GameEvent[]): void {
    this.total += evs.length
    this.events.push(...evs)
    if (this.events.length > EventLog.MAX_IN_MEMORY) {
      this.events.splice(0, this.events.length - EventLog.MAX_IN_MEMORY)
    }
  }

  get totalCount(): number {
    return this.total
  }

  all(): readonly GameEvent[] {
    return this.events
  }

  since(simTime: number, types?: EventType[]): GameEvent[] {
    return this.events.filter((e) => e.simTime >= simTime && (!types || types.includes(e.type)))
  }

  latest(n: number): GameEvent[] {
    return this.events.slice(-n).reverse()
  }

  bySubject(subjectId: string): GameEvent[] {
    return this.events.filter((e) => e.subjects.includes(subjectId))
  }

  clear(): void {
    this.events = []
  }

  exportState(): GameEvent[] {
    return [...this.events]
  }

  restoreState(events: GameEvent[]): void {
    this.events = [...events]
  }
}

/** Min-ordered future-event queue (intervention resolutions, aerial windows…). */
export class EventQueue {
  private queue: GameEvent[] = []

  schedule(ev: GameEvent): void {
    this.queue.push(ev)
    this.queue.sort((a, b) => a.simTime - b.simTime)
  }

  /** Pop all events due at or before `simTime` in time order. */
  due(simTime: number): GameEvent[] {
    const out: GameEvent[] = []
    while (this.queue.length > 0 && this.queue[0].simTime <= simTime) {
      out.push(this.queue.shift()!)
    }
    return out
  }

  get length(): number {
    return this.queue.length
  }

  exportState(): GameEvent[] {
    return [...this.queue]
  }

  restoreState(events: GameEvent[]): void {
    this.queue = [...events]
    this.queue.sort((a, b) => a.simTime - b.simTime)
  }
}

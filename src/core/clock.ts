/** Time control: pause + 1x/2x/5x per 02-core-loop. Fixed-step sim clock. */
export type Speed = 0 | 1 | 2 | 5

export const SPEEDS: Speed[] = [0, 1, 2, 5]

export interface ClockState {
  simTime: number
  speed: Speed
  paused: boolean
}

export class GameClock {
  /** One sim step in sim-seconds. 4 Hz keeps the flat-map slice smooth
   *  while remaining cheap enough for a full-city explicit population. */
  readonly stepSize = 0.25

  simTime = 0
  speed: Speed = 1
  paused = false

  /** Wall-clock anchor for displaying a mission wall-time. */
  readonly scenarioStartEpochMs: number

  constructor(scenarioStartEpochMs = Date.now()) {
    this.scenarioStartEpochMs = scenarioStartEpochMs
  }

  private acc = 0

  /**
   * Advance by a real-time delta. Returns the number of fixed sim steps
   * the engine should run this frame (0 while paused).
   */
  advance(realDtSeconds: number): number {
    if (this.paused || this.speed === 0) {
      this.acc = 0
      return 0
    }
    const scaled = Math.min(realDtSeconds, 1.0) * this.speed
    this.acc += scaled
    let steps = 0
    while (this.acc >= this.stepSize) {
      this.acc -= this.stepSize
      steps++
    }
    return steps
  }

  step(): void {
    this.simTime += this.stepSize
  }

  togglePause(): void {
    this.paused = !this.paused
    this.acc = 0
  }

  wallTime(): Date {
    return new Date(this.scenarioStartEpochMs + this.simTime * 1000)
  }

  exportState(): ClockState {
    return { simTime: this.simTime, speed: this.speed, paused: this.paused }
  }

  restoreState(s: ClockState): void {
    this.simTime = s.simTime
    this.speed = s.speed
    this.paused = s.paused
    this.acc = 0
  }
}

/**
 * Versioned save format (14-performance-qa):
 *
 *   SaveGame { schemaVersion, campaignVersion, scenarioId, scenarioSeed,
 *              simTime, commands[], snapshot?, campaignState, settings, checksum }
 *
 * Saves are replay inputs first and snapshots second: loading re-runs the
 * command log against the seed, and the optional snapshot accelerates load.
 */
import { deserializeCommands, serializeCommands, type Command } from './commands'
import { hashString } from './rng'

export const SAVE_SCHEMA_VERSION = 1
export const CAMPAIGN_VERSION = 'rev1.1'

export type QualityTier = 'low' | 'medium' | 'high'

export interface CampaignState {
  authority: number
  budget: number
  publicTrust: number
  attribution: number
  /** Advanced tech unlocks (black-program systems). */
  technology: Record<string, number>
  /** Persistent cross-scenario awareness. */
  awareness: number
}

export interface SaveSettings {
  quality: QualityTier
  reducedMotion: boolean
}

export interface SaveGame {
  schemaVersion: number
  campaignVersion: string
  scenarioId: string
  scenarioSeed: number
  simTime: number
  commands: Command[]
  snapshot?: Record<string, unknown>
  campaignState: CampaignState
  settings: SaveSettings
  checksum: string
}

export type SaveGamePayload = Omit<SaveGame, 'checksum'>

export function defaultCampaignState(): CampaignState {
  return { authority: 60, budget: 100, publicTrust: 70, attribution: 0, technology: {}, awareness: 0 }
}

export function defaultSettings(): SaveSettings {
  return { quality: 'high', reducedMotion: false }
}

/** FNV-1a over canonical JSON — tamper-evidence, not cryptography. */
export function computeChecksum(payload: Omit<SaveGame, 'checksum'>): string {
  return hashString(JSON.stringify(payload)).toString(16).padStart(8, '0')
}

/**
 * Migration registry keyed by *from* schema version. Add entries when the
 * save schema changes; unit tests cover every migration.
 */
export type SaveMigration = (raw: Record<string, unknown>) => Record<string, unknown>

export const saveMigrations: Record<number, SaveMigration> = {}

export function serializeSave(payload: SaveGamePayload): string {
  const save: SaveGame = { ...payload, checksum: computeChecksum(payload) }
  return JSON.stringify(save)
}

export function parseSave(json: string): SaveGame {
  const raw: unknown = JSON.parse(json)
  if (typeof raw !== 'object' || raw === null) throw new Error('Save must be a JSON object')
  let doc = raw as Record<string, unknown>

  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0
  if (version < 1) throw new Error('Save is missing schemaVersion')
  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = saveMigrations[version]
    if (!migrate) throw new Error(`No migration from save schema v${version}`)
    doc = migrate(doc)
    version = doc.schemaVersion as number
  }
  if (version !== SAVE_SCHEMA_VERSION) throw new Error(`Unknown save schema v${version}`)

  const save = doc as unknown as SaveGame
  const checksum = save.checksum
  const { checksum: _drop, ...payload } = save
  if (computeChecksum(payload as SaveGamePayload) !== checksum) {
    throw new Error('Save checksum mismatch (corrupted save)')
  }
  // Command log is the replay spine — validate it eagerly.
  deserializeCommands(serializeCommands(save.commands))
  return save
}

export function payloadFromSave(save: SaveGame): SaveGamePayload {
  const { checksum: _c, ...payload } = save
  return payload
}

/* ------------------------------------------------------------------ */
/* Adapters                                                            */
/* ------------------------------------------------------------------ */

export interface SaveAdapter {
  save(json: string): Promise<void>
  load(): Promise<string | null>
  clear(): Promise<void>
}

/** In-memory adapter (tests + SSR-free fallback). */
export function memorySaveAdapter(): SaveAdapter & { current(): string | null } {
  let current: string | null = null
  return {
    save: async (json) => {
      current = json
    },
    load: async () => current,
    clear: async () => {
      current = null
    },
    current: () => current,
  }
}

/** Minimal hand-rolled IndexedDB wrapper (no extra dependency). */
export function indexedDbSaveAdapter(
  dbName = 'blackglass-hydra',
  storeName = 'saves',
  key = 'active',
): SaveAdapter {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

  return {
    save: (json) =>
      new Promise<void>((resolve, reject) => {
        void open().then((db) => {
          const tx = db.transaction(storeName, 'readwrite')
          tx.objectStore(storeName).put(json, key)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }, reject)
      }),
    load: () =>
      new Promise<string | null>((resolve, reject) => {
        void open().then((db) => {
          const tx = db.transaction(storeName, 'readonly')
          const req = tx.objectStore(storeName).get(key)
          req.onsuccess = () => {
            db.close()
            resolve((req.result as string | undefined) ?? null)
          }
          req.onerror = () => reject(req.error)
        }, reject)
      }),
    clear: () =>
      new Promise<void>((resolve, reject) => {
        void open().then((db) => {
          const tx = db.transaction(storeName, 'readwrite')
          tx.objectStore(storeName).delete(key)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }, reject)
      }),
  }
}

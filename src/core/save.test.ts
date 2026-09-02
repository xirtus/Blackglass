import { describe, expect, it } from 'vitest'
import { deserializeCommands, makeCommand, serializeCommands } from './commands'
import {
  computeChecksum,
  defaultCampaignState,
  defaultSettings,
  memorySaveAdapter,
  parseSave,
  saveMigrations,
  SAVE_SCHEMA_VERSION,
  serializeSave,
  type SaveGamePayload,
} from './save'

function payload(): SaveGamePayload {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    campaignVersion: 'rev1.1',
    scenarioId: 'dc_archive_01',
    scenarioSeed: 184203,
    simTime: 123.5,
    commands: [makeCommand(10, 'human', 'BLACKGLASS', { kind: 'bg.pin', subjectId: 'p_1' })],
    snapshot: { tick: 4 },
    campaignState: defaultCampaignState(),
    settings: defaultSettings(),
  }
}

describe('versioned save format', () => {
  it('round-trips and validates checksum', () => {
    const json = serializeSave(payload())
    const save = parseSave(json)
    expect(save.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(save.scenarioSeed).toBe(184203)
    expect(save.commands).toHaveLength(1)
  })

  it('detects tampering', () => {
    const json = serializeSave(payload())
    const tampered = json.replace('"simTime":123.5', '"simTime":999')
    expect(() => parseSave(tampered)).toThrow(/checksum/i)
  })

  it('rejects unknown schema versions', () => {
    const p = payload()
    p.schemaVersion = 99
    const { checksum: _c, ...rest } = { ...p, checksum: computeChecksum(p) }
    const json = JSON.stringify({ ...rest, checksum: computeChecksum(p) })
    expect(() => parseSave(json)).toThrow(/schema/i)
  })

  it('runs registered migrations in order', () => {
    // Simulate v1→v2 adding a field.
    saveMigrations[1] = (raw) => ({ ...raw, schemaVersion: 2, campaignState: { ...(raw.campaignState as object), technology: {} } })
    const v1 = { ...payload(), schemaVersion: 1 }
    const json = JSON.stringify({ ...v1, checksum: computeChecksum({ ...v1 } as SaveGamePayload) })
    const save = parseSave(json)
    expect(save.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(save.campaignState.technology).toEqual({})
    delete saveMigrations[1]
  })

  it('command log round-trips through JSON', () => {
    const cmds = [
      makeCommand(1, 'human', 'HYDRA', { kind: 'hydra.contact', personId: 'p_2' }),
      makeCommand(2, 'ai', 'BLACKGLASS', { kind: 'bg.watchCircle', circleId: 'wc_x', level: 0.5 }),
    ]
    const back = deserializeCommands(serializeCommands(cmds))
    expect(back).toEqual(cmds)
  })

  it('rejects malformed command logs', () => {
    expect(() => deserializeCommands('{"nope":true}')).toThrow()
    expect(() => deserializeCommands('[{"kind":"x"}]')).toThrow()
  })

  it('memory adapter stores and loads', async () => {
    const a = memorySaveAdapter()
    await a.save('hello')
    expect(await a.load()).toBe('hello')
    await a.clear()
    expect(await a.load()).toBeNull()
  })
})

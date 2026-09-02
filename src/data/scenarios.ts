/** Scenario manifest registry — data-driven, validated at import. */
import dcArchive01 from './scenarios/dc_archive_01.json'
import { validateScenario, type ScenarioManifest } from '@/sim/scenario'

export const manifests: ScenarioManifest[] = [dcArchive01 as unknown as ScenarioManifest]

export const manifest = manifests[0]

// Fail fast at load time if a manifest is broken (also covered by tests).
for (const m of manifests) {
  const errors = validateScenario(m)
  if (errors.length > 0) {
    console.error(`Invalid scenario manifest "${m.id}":`, errors)
  }
}

export function getManifest(id: string): ScenarioManifest | undefined {
  return manifests.find((m) => m.id === id)
}

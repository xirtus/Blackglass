#!/usr/bin/env node
/**
 * License gate (Phase 0): validates ASSET_REGISTRY.json before build/CI.
 * - Every entry needs creator, source, license, attribution, permissions.
 * - NC/ND licenses fail unless an explicit reviewed exception exists.
 * Exit 1 on violations.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const registry = JSON.parse(readFileSync(join(root, 'ASSET_REGISTRY.json'), 'utf8'))

if (!Array.isArray(registry.entries)) {
  console.error('asset-gate: ASSET_REGISTRY.json entries must be an array')
  process.exit(1)
}

const required = ['id', 'creator', 'source', 'license', 'attribution', 'commercialAllowed', 'modificationAllowed']
const problems = []

for (const entry of registry.entries) {
  for (const field of required) {
    if (entry[field] === undefined || entry[field] === '') {
      problems.push(`entry ${entry.id ?? '(no id)'} missing "${field}"`)
    }
  }
  const license = String(entry.license ?? '').toUpperCase()
  const restricted = /^(CC BY-NC|CC BY-ND|CC BY-NC-ND|UNLICENSED|UNKNOWN)/.test(license) && entry.licenseException !== true
  if (restricted) {
    problems.push(`entry ${entry.id}: license "${entry.license}" is NC/ND/ambiguous without reviewed exception`)
  }
}

if (problems.length > 0) {
  console.error('asset-gate: FAILED')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`asset-gate: OK (${registry.entries.length} registered assets, all licensed)`)

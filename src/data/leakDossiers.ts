import type { ScenarioManifest } from '@/sim/scenario'

export interface LeakDossier {
  codename: string
  classification: string
  hook: string
  archiveType: string
  evidenceChain: string[]
  implicatedNetwork: string
  publicMyth: string
  danger: string
}

const CODENAMES = ['ORPHEUS VAULT', 'BLUE LANTERN', 'CROWN STATIC', 'NIGHT MARKET', 'JANUS ROOM', 'MIRRORFALL']

const ARCHIVE_TYPES = [
  'crash-retrieval and nonhuman materials appendix',
  'sealed assassination-era continuity files',
  'deep-cover identity registry for foreign networks',
  'black-budget time-displacement experiment ledger',
  'private-island trafficking evidence chain tied to protected elites',
  'offshore influence and kompromat exchange index',
]

const EVIDENCE = [
  ['chain-of-custody scans', 'redacted lab photos', 'procurement orders', 'burn-after-reading memo fragments'],
  ['witness statements', 'ballistics exception notes', 'motorcade timing deltas', 'sealed committee addenda'],
  ['alias passports', 'dead-drop receipts', 'handler payroll hashes', 'safehouse utility records'],
  ['clock-drift logs', 'subject debriefs', 'causality waivers', 'failed return manifests'],
  ['travel manifests', 'payment ledgers', 'victim-protection affidavits', 'encrypted guest calendars'],
  ['shell-company ledgers', 'press-placement invoices', 'encrypted contact maps', 'asset-retirement notices'],
]

const NETWORKS = [
  'a committee-within-a-committee that officially does not exist',
  'contractors laundering state secrets through philanthropy cutouts',
  'a private security ring built from retired officials and boutique crisis firms',
  'a diplomatic courier network with too many missing pouches',
  'an influence marketplace where scandal, money and favors clear like trades',
  'a research directorate whose budget lines only appear in duplicate audits',
]

const MYTHS = [
  'the old Roswell rumor was a cover story for something stranger',
  'the public assassination narrative has a classified errata sheet',
  'half the “conspiracy board” was planted to hide the one true thread',
  'the meme version of the scandal is wrong, but the boring paperwork is worse',
  'time travel was never the project name; it was the accounting problem',
  'everyone laughed at the rumor until the metadata started agreeing',
]

const DANGERS = [
  'burns sources faster than they can be extracted',
  'could expose undercover networks across multiple countries',
  'turns every denial into a search-demand spike',
  'contains enough corroboration to survive partial takedowns',
  'makes containment politically more damaging than publication',
  'creates a copy genealogy no single actor can fully recall',
]

function pick<T>(items: readonly T[], seed: number, salt: number): T {
  return items[Math.abs((seed * 1103515245 + salt * 2654435761) | 0) % items.length]
}

export function leakDossierForScenario(manifest: ScenarioManifest): LeakDossier {
  const seed = manifest.seed
  const archiveIndex = Math.abs(seed) % ARCHIVE_TYPES.length
  return {
    codename: pick(CODENAMES, seed, 1),
    classification: pick(['COSMIC/NOFORN', 'UMBRA/ORCON', 'MAJESTIC/ORCON', 'EYES-ONLY/COMPARTMENTED'], seed, 2),
    hook: `A missing ${ARCHIVE_TYPES[archiveIndex]} surfaced inside ${manifest.origin.name}.`,
    archiveType: ARCHIVE_TYPES[archiveIndex],
    evidenceChain: EVIDENCE[archiveIndex],
    implicatedNetwork: pick(NETWORKS, seed, 3),
    publicMyth: pick(MYTHS, seed, 4),
    danger: pick(DANGERS, seed, 5),
  }
}

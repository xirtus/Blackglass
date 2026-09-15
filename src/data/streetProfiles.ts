import type { AtlasHotspot, AtlasLocation } from './atlasLocations'

export interface StreetMessage {
  channel: string
  time: string
  direction: 'IN' | 'OUT'
  body: string
}

export interface StreetPerson {
  id: string
  seed: number
  name: string
  age: number
  occupation: string
  employer: string
  address: string
  handle: string
  phone: string
  device: string
  affiliations: string[]
  knowledge: string
  confidence: number
  risk: 'LOW' | 'ELEVATED' | 'HIGH'
  position: [number, number, number]
  route: [number, number, number][]
  messages: StreetMessage[]
}

const FIRST_NAMES = ['Mara', 'Jonas', 'Leila', 'David', 'Nadia', 'Elias', 'Sofia', 'Arun', 'Mei', 'Noah', 'Zain', 'Clara']
const LAST_NAMES = ['Voss', 'Mercer', 'Haddad', 'Park', 'Petrov', 'Okafor', 'Chen', 'Silva', 'Rossi', 'Khan', 'Reyes', 'Dubois']
const OCCUPATIONS = [
  ['records contractor', 'Civic Systems Group'],
  ['freelance photojournalist', 'Wire Desk'],
  ['consular courier', 'Diplomatic Services'],
  ['network engineer', 'Metro Data Cooperative'],
  ['investigative producer', 'Public Affairs Unit'],
  ['legal researcher', 'Accountability Project'],
  ['rail operations planner', 'Transit Authority'],
  ['archivist', 'Municipal Records Office'],
] as const

const KNOWLEDGE = [
  'Saw the archive index copied onto a maintenance laptop during the shift change.',
  'Knows which press contact received the first encrypted preview and when it was opened.',
  'Can identify the courier who moved the sealed drive through the service entrance.',
  'Mapped the temporary relay used to split the document cache across three accounts.',
  'Heard that one page set carries an authentication mark absent from the public scans.',
  'Has the meeting location for the next handoff but not the identity of the source.',
  'Recognized a vehicle that appeared at both the records annex and the newsroom loading bay.',
  'Knows the internal catalog code connecting the released pages to a larger unreleased box.',
]

const MESSAGE_LINES = [
  ['Signal', 'Do not use the office account. The copied minutes leave on the 19:10 service.'],
  ['SMS', 'The west entrance camera resets for ninety seconds after the maintenance check.'],
  ['Matrix', 'I verified the stamp. Page 47 belongs to the same accession as the contact sheet.'],
  ['Email', 'Move the interview forward. Two desks are already asking about the courier.'],
  ['Signal', 'The mirror is live, but the second key is still with the archive contact.'],
  ['SMS', 'Blue coat, platform end, no bag. If followed, continue through the public concourse.'],
  ['Email', 'The travel ledger and call sheet overlap on four dates. Keep the originals apart.'],
  ['Matrix', 'Someone searched the catalog code this morning. Assume the index is monitored.'],
] as const

export function streetPeopleFor(city: AtlasLocation, hotspot: AtlasHotspot): StreetPerson[] {
  const base = stableHash(`${city.id}:${hotspot.id}`)
  return Array.from({ length: 8 }, (_, index) => {
    const seed = base + index * 7919
    const first = FIRST_NAMES[(seed + index * 3) % FIRST_NAMES.length]
    const last = LAST_NAMES[(seed * 5 + index) % LAST_NAMES.length]
    const job = OCCUPATIONS[index % OCCUPATIONS.length]
    const msgA = MESSAGE_LINES[index % MESSAGE_LINES.length]
    const msgB = MESSAGE_LINES[(index + 3) % MESSAGE_LINES.length]
    const x = ((index % 4) - 1.5) * 11 + ((seed % 5) - 2)
    const z = (Math.floor(index / 4) - 0.5) * 21 + (((seed >> 2) % 7) - 3)
    const direction = index % 2 === 0 ? 1 : -1

    return {
      id: `street-${city.id}-${index + 1}`,
      seed,
      name: `${first} ${last}`,
      age: 24 + (seed % 39),
      occupation: job[0],
      employer: job[1],
      address: `${110 + (seed % 780)} ${hotspot.label} sector, ${city.label}`,
      handle: `@${first.toLowerCase()}.${last.toLowerCase()}${seed % 90}`,
      phone: `+${10 + (seed % 80)} ${200 + (seed % 700)} ${1000 + (seed % 9000)}`,
      device: index % 3 === 0 ? 'Pixel 10 / GrapheneOS' : index % 3 === 1 ? 'iPhone / current iOS' : 'ThinkPad / Fedora',
      affiliations: [job[1], index % 2 === 0 ? 'Metro commuter network' : 'Local press contact ring'],
      knowledge: KNOWLEDGE[index % KNOWLEDGE.length],
      confidence: 62 + ((seed + index * 11) % 36),
      risk: index % 4 === 0 ? 'HIGH' : index % 3 === 0 ? 'ELEVATED' : 'LOW',
      position: [x, 0, z],
      route: [
        [x, 0, z],
        [x + direction * (8 + (seed % 7)), 0, z + 4],
        [x + direction * (5 + (seed % 4)), 0, z - 9],
        [x - direction * 4, 0, z - 5],
      ],
      messages: [
        { channel: msgA[0], time: `${18 + (index % 4)}:${String(7 + index * 5).padStart(2, '0')}`, direction: index % 2 ? 'IN' : 'OUT', body: msgA[1] },
        { channel: msgB[0], time: `${19 + (index % 3)}:${String(12 + index * 4).padStart(2, '0')}`, direction: index % 2 ? 'OUT' : 'IN', body: msgB[1] },
      ],
    }
  })
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

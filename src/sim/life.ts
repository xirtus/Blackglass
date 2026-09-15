/**
 * Scenario life generator.
 * Coherent modeled lives exist before the incident begins: identity,
 * anchors, routine, social circles, weighted trust, devices, behavior
 * traits, reach, and baseline history deep enough to detect deviations.
 *
 * Seeded records keep campaign runs reproducible.
 */
import { IdGen } from '@/core/ids'
import { RngStreams } from '@/core/rng'
import type { ScenarioManifest } from './scenario'
import type { Baseline, CircleKind, Device, Location, Person, SocialEdge, Vehicle } from './types'

const FIRST_NAMES = ['Maya', 'Theo', 'Ruth', 'Omar', 'Elin', 'Dev', 'Priya', 'Jonas', 'Amara', 'Caleb', 'Sana', 'Marek', 'Inez', 'Victor', 'Lena', 'Tomas', 'Aisha', 'Gideon', 'Noor', 'Felix', 'Rosa', 'Hugo', 'Kasia', 'Adrian']
const LAST_NAMES = ['Voss', 'Okafor', 'Hirano', 'Kovacs', 'Lindqvist', 'Navarro', 'Bhat', 'Stern', 'Almeida', 'Pryce', 'Duarte', 'Moreau', 'Ito', 'Brandt', 'Soler', 'Winters', 'Faro', 'Klein', 'Marchetti', 'Ogden']
const OCCUPATIONS = ['records clerk', 'legal assistant', 'metro operator', 'night depot driver', 'journalist', 'archivist', 'courier', 'café manager', 'market vendor', 'station attendant', 'press bureau editor', 'civil engineer', 'librarian', 'transit inspector', 'shopkeeper', 'researcher']
const CIRCLE_POOL: CircleKind[] = ['family', 'work', 'oldFriends', 'media', 'online', 'organization', 'unknown']

const NAME_BY_TAG: Record<string, { first: string; last: string; occupation: string; intent: Person['traits']['intent'] }> = {
  carrier_a: { first: 'Maya', last: 'Voss', occupation: 'records clerk', intent: 'deliberate' },
  journalist_b: { first: 'Theo', last: 'Okafor', occupation: 'journalist', intent: 'publisher' },
  archivist_c: { first: 'Ruth', last: 'Hirano', occupation: 'archivist', intent: 'sympathetic' },
}

export interface GeneratedLives {
  people: Person[]
  devices: Device[]
  vehicles: Vehicle[]
  edges: SocialEdge[]
  baselines: Record<string, Baseline>
}

export function generateScenarioLives(
  streams: RngStreams,
  manifest: ScenarioManifest,
  locations: Location[],
): GeneratedLives {
  const ids = new IdGen(`scn_${manifest.id}`, streams.stream('life.ids'))
  const identity = streams.stream('life.identity')
  const social = streams.stream('life.social')
  const devicesRng = streams.stream('life.devices')
  const vehiclesRng = streams.stream('life.vehicles')
  const schedule = streams.stream('life.schedule')

  const homes = locations.filter((l) => l.kind === 'home')
  const workplaces = locations.filter((l) => l.kind === 'workplace' || l.kind === 'archive')

  const people: Person[] = []
  const devices: Device[] = []
  const vehicles: Vehicle[] = []
  const edges: SocialEdge[] = []
  const baselines: Record<string, Baseline> = {}

  const roleIndex = new Map<string, number>()
  const tagsToAssign = [...manifest.heroActors]
  const shuffledTags = identity.shuffle(tagsToAssign)

  const n = manifest.population.explicit
  for (let i = 0; i < n; i++) {
    const tag = i < shuffledTags.length ? shuffledTags[i] : null
    const authored = tag ? NAME_BY_TAG[tag] : null
    const first = authored?.first ?? identity.pick(FIRST_NAMES)
    const last = authored?.last ?? identity.pick(LAST_NAMES)
    const occupation = authored?.occupation ?? identity.pick(OCCUPATIONS)
    const home = homes[i % homes.length]
    const work = workplaces[(i * 3 + 1) % workplaces.length]

    if (tag) roleIndex.set(tag, i)

    const personId = ids.next('p')
    const person: Person = {
      id: personId,
      name: `${first} ${last}`,
      ageBand: identity.pick(['20s', '30s', '40s', '50s', '60s']),
      occupation,
      roleTags: tag ? [tag] : [],
      homeId: home.id,
      workId: work.id,
      circles: pickCircles(social),
      status: 'free',
      traits: {
        caution: social.float(0.1, 0.9),
        loyalty: social.float(0.2, 0.95),
        curiosity: social.float(0.1, 0.9),
        privacy: social.float(0.1, 0.9),
        mediaTrust: social.float(0.1, 0.8),
        stress: social.float(0.05, 0.6),
        riskTolerance: social.float(0.05, 0.8),
        reach: social.float(0.01, 0.7),
        intent: authored?.intent ?? social.pickWeighted<Person['traits']['intent']>([
          ['unaware', 0.5],
          ['curious', 0.15],
          ['sympathetic', 0.1],
          ['deliberate', 0.05],
          ['publisher', 0.08],
          ['archivist', 0.07],
          ['opportunist', 0.05],
        ]),
      },
      devices: [],
      knowledge: { copyIds: [], awareness: 0, credibility: 0.4 + social.float(0, 0.3) },
      schedule: {
        workStartHour: schedule.int(7, 10),
        workEndHour: schedule.int(15, 19),
        commuteMode: schedule.pickWeighted([['walk', 0.45], ['transit', 0.4], ['drive', 0.15]]),
        sleepWindow: [22, 6],
      },
      pos: { x: home.pos.x, z: home.pos.z },
      moving: false,
      route: null,
      lastSeen: -1,
      confidence: 0,
    }

    // Devices with ownership probabilities (shared devices are the point).
    const deviceCount = devicesRng.pickWeighted([
      [1, 0.45],
      [2, 0.4],
      [3, 0.15],
    ])
    for (let d = 0; d < deviceCount; d++) {
      const deviceId = ids.next('d')
      const ownerConf = 0.55 + devicesRng.float(0, 0.45)
      const device: Device = {
        id: deviceId,
        kind: devicesRng.pickWeighted<Device['kind']>([
          ['phone', 0.5],
          ['laptop', 0.2],
          ['workMachine', 0.15],
          ['tablet', 0.1],
          ['account', 0.05],
        ]),
        ownerCandidates: [{ personId, confidence: ownerConf }],
        online: devicesRng.chance(0.75),
        copyIds: [],
        lastPing: -1,
      }
      // Shared-device ambiguity: sometimes a second candidate shares it.
      if (devicesRng.chance(0.25)) {
        const other = people[devicesRng.int(0, people.length - 1)]
        if (other && other.id !== personId) {
          device.ownerCandidates.push({ personId: other.id, confidence: 1 - ownerConf + 0.1 })
        }
      }
      person.devices.push(deviceId)
      devices.push(device)
    }

    people.push(person)
    baselines[personId] = {
      personId,
      workStartHour: person.schedule.workStartHour,
      workEndHour: person.schedule.workEndHour,
      commuteMode: person.schedule.commuteMode,
      avgContactsPerDay: social.float(2, 12),
      deviceOnlineRatio: devicesRng.float(0.4, 0.95),
      historyDepth: 48, // hours of baseline
    }
  }

  // Social edges: circles as edge clusters — each person connects to a
  // few same-circle members with weighted trust.
  for (let i = 0; i < people.length; i++) {
    const a = people[i]
    const targets = social.shuffle(people.filter((p) => p.id !== a.id)).slice(0, social.int(1, 4))
    for (const b of targets) {
      const shared = a.circles.filter((c) => b.circles.includes(c))
      const kind: CircleKind = shared.length > 0 ? social.pick(shared) : 'unknown'
      const already = edges.some((e) => (e.a === a.id && e.b === b.id) || (e.a === b.id && e.b === a.id))
      if (already) continue
      edges.push({
        id: ids.next('e'),
        a: a.id,
        b: b.id,
        kind,
        trust: social.float(0.1, 0.95),
        freq: social.float(0.05, 2),
        sharedHistory: social.float(0, 1),
        lastActivated: -1,
      })
    }
  }

  // Vehicles: a small authored fleet for the flat slice.
  for (let v = 0; v < 4; v++) {
    const owner = people[vehiclesRng.int(0, people.length - 1)]
    vehicles.push({
      id: ids.next('v'),
      label: vehiclesRng.pick(['sedan', 'van', 'service van', 'delivery scooter']),
      ownerId: owner.id,
      pos: { x: owner.pos.x, z: owner.pos.z },
      moving: false,
      route: null,
      lastSeen: -1,
    })
  }

  return { people, devices, vehicles, edges, baselines }
}

function pickCircles(rng: ReturnType<RngStreams['stream']>): CircleKind[] {
  const count = rng.int(1, 4)
  return rng.shuffle(CIRCLE_POOL).slice(0, count)
}

/** Authoring helper: build a location set from the manifest buildings. */
export function locationsFromManifest(manifest: ScenarioManifest): Location[] {
  const locs: Location[] = manifest.buildings.map((b) => ({
    id: b.id,
    name: b.name,
    kind: buildingToLocationKind(b.kind),
    pos: { ...b.pos },
    radius: Math.max(b.w, b.d) * 0.55,
    access: b.kind === 'archive' || b.kind === 'government' ? 'controlled' : b.kind === 'residential' ? 'private' : 'public',
  }))
  // Additional POIs not in the buildings list (parks, stands).
  locs.push(
    { id: 'poi_park', name: 'Signal Green', kind: 'park', pos: { x: -60, z: 60 }, radius: 90, access: 'public' },
    { id: 'poi_stand', name: 'Ferry Row kiosk', kind: 'store', pos: { x: -355, z: -165 }, radius: 15, access: 'public' },
    { id: 'poi_station', name: 'Waterside Station concourse', kind: 'transit', pos: { x: 680, z: 340 }, radius: 60, access: 'public' },
  )
  return locs
}

function buildingToLocationKind(kind: string): Location['kind'] {
  switch (kind) {
    case 'archive':
      return 'archive'
    case 'residential':
      return 'home'
    case 'government':
    case 'office':
      return 'workplace'
    case 'transit':
      return 'transit'
    default:
      return 'public'
  }
}

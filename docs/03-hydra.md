# 03 — Hydra Information Model

Implementation of [`site/06-hydra.html`](../site/06-hydra.html).

## Information levels

`0 Original → 1 Compromised → 2 Duplicated → 3 Networked → 4 Digital →
5 Mirrored → 6 Viral → 7 Cultural Knowledge`
(`src/sim/types.ts` `INFO_LEVEL_NAMES`, `INFOS_LEVELS_BY_FORM`).

## Copy entity

`InfoCopy { id, archiveId, parentId, holderType, holderId, form, bytes,
integrity, credibility, exposure, replicationPotential, level, createdAt,
lastObservedAt, descendants[], status, observedBy }`

- `observedBy` records which faction has perceived the copy — the
  perspective gate for the omniscient replay reconciliation table.
- No-orphan and parent-precedes-child invariants are unit-tested.

## Propagation

Person-scale transfer probability:
`P(transfer) = clamp(intentFactor + trust*0.25 + credibility*0.15 +
pressure + 0.05)` drawn on the `sim.handoff` stream, gated by co-location
(opportunity) and trust ≥ 0.35.

Aggregate transition (LOD3/4): released copies with level ≥ 4 accumulate
aggregate descendants proportional to exposure — the `estimatedCopies`
term in metrics.

## Metrics (src/sim/metrics.ts)

`knownCopies, estimatedCopies, copyConfidence, exposure, credibility,
replicationNumberH, publicSuspicion, containmentProbability, demand`.

The **practical-containment threshold** is the same on both sides:
reproduction number H above 1 across independent branches with no
affordable intervention set able to reduce it ⇒ practical containment
failure (HYDRA victory condition when durable + credible).

## Streisand system

Heavy interventions add publicity → suspicion/attention/demand → more
mirrors. Encoded as immediate `suspicionDelta` on activation plus the
feedback terms in `hydraSystem`. Nothing is a clean win button: the
`takedown_request` failure path *raises* exposure, the `credibility_challenge`
failure path *strengthens* the copy.

# 04 — Surveillance & Watch Index

Implementation of [`site/05-surveillance.html`](../site/05-surveillance.html).

## Synthetic feeds (all generated; no real systems)

| Category | Game abstraction | Reveals |
| --- | --- | --- |
| road | `CAM-<node>` plate/pedestrian hits | vehicle route fragments; association not identity |
| access | `BADGE-<location>` events | presence in controlled places |
| device | `NET-<kind>` pings | ownership-probability association |
| social | `SOCIAL-GRAPH` metadata surges | relationship activation |
| financial | `FIN-SYNTH` candidates | intent clues, false positives |
| aerial | `AERIAL-WINDOW` windows | costly spatial confirmation |
| human | `FIELD-REPORT` | context-rich but fallible |

Identification ≠ association: a camera seeing a pedestrian is an
association observation at ~0.4 confidence; a badge event is an
identification at 0.9. Ownership ambiguity lives in
`Device.ownerCandidates[]` (shared devices, stale registrations).

## Watch Index

Circles around the initial subject (family, work, media, old friends,
online, unknown) with `risk`, `coverage` (player spend), `unknownNodes`.
Coverage costs compute and raises observation rate + anomaly confidence.
The HYDRA player receives none of this — only coarse heat buckets.

## Anomaly engine

Three disagreeing models over synthetic baselines:
- **ATHENA** — movement/routine ("left work early", "far from anchors").
- **ORACLE** — social/trust ("activated dormant relationship").
- **JANUS** — conservative/unknowns ("device went silent", unknown edges).

Reports land in `state.anomalies` for the analyst board; the event log
only receives notable reports. Scores are hints with provenance, never
truth labels — false positives are generated, not accidental.

## OSINT source layer

The Phase 2-style OSINT layer is represented by `state.osint.sources` and
`state.osint.signals`. Scenario manifests can declare source adapters for
real tools, but the shipped harness runs deterministic offline stand-ins:

| Adapter kind | Upstream inspiration | Game output |
| --- | --- | --- |
| worldMonitor | `koala73/worldmonitor` | public chatter and risk-trend signals |
| caseGraph | `elm1nst3r/GHOST-osint-crm` | analyst case-graph/entity-resolution leads |
| radioSpectrum | WireTapper-style local RF tooling | synthetic RF trace intersections |
| publicCamera | authorized camera packs | low-confidence street-node associations |

BLACKGLASS sees source status, reliability, mode and private signals.
HYDRA sees only public OSINT pressure with subject ids redacted. Blocked
camera directories can be listed in the manifest for design awareness, but
validation rejects them if enabled. The game does not scrape, embed or
proxy live unsecured public-camera feeds.

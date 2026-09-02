# 05 — Intervention System

Implementation of [`site/07-interventions.html`](../site/07-interventions.html).

## Universal schema

`InterventionDef { id, tier, category, validTargets[], prerequisites[],
activationDelay, effectWindow, successProbability, reversibility,
publicity, suspicionDelta, infrastructureImpact, authorityCost,
budgetCost, attributionRisk, hydraDelta, cooldown, narrativeTags[] }`

Catalog lives in `src/data/interventions.json` (data-driven; validated at
load and in tests). Vertical-slice catalog: `account_hold`,
`travel_restriction`, `takedown_request`, `credibility_challenge`,
`service_disruption`, `server_isolation`, `traffic_control`, `cordon`,
`surveillance_team`, `detention`, `grid_blackout`, `signal_eclipse`
(fictional black-program).

## Validation gates

- Prerequisites (grid/telecom state), affordability, cooldown, target
  category, scenario allow-list — enforced in `GameEngine.validate`.
- Only valid actions are offered in the drawer; rejected commands are
  recorded for QA (`engine.rejections`).

## Opportunity + side effects

Every action has delay + success roll + reversible/irreversible effects
and secondary consequences: blackouts kill sensors, detentions raise heat
and frighten contacts, server isolation surfaces backups. HYDRA
counterplay is a separate data-driven catalog (contact, duplicate,
authenticate, release, abandon, transfer, shield, decoy) resolving
through trust, credibility and opportunity windows — deliberately no
operational evasion detail.

## Design rule

No "click target → problem deleted". Each intervention is tested for a
*new decision* it creates: public suspicion, an observation gap, a
backup, a frightened circle.

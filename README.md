# Mathematical Readout Exchange

A signed A2A face and an ActivityStreams contract boundary for one
computation: the CoverNerve rank readout of an entities/cells/components
triple.

Given non-negative safe-integer `entities`, `cells`, and `components` counts
satisfying the CoverNerve bounds (`components ≤ entities`, `entities ≤ cells +
components`), it returns:

- `h0rank` — the number of connected components (`= components`)
- `h1rank` — the rank of the coordination cycle space
  (`= cells + components − entities`)
- `coordinationFree` — `true` when `h1rank` is `0`
- `landauerBits` — `h1rank` restated as Landauer bits, per
  `Obsmetrologia.Landauer.landauer_eq_coordination_cost`
- `coordinationCost` — `h1rank` again, named for the coordination reading

## Spec sheet

This readout is specified by
`Obsmetrologia/Cohomology/CoordinationCohomology.lean` and
`Obsmetrologia/Cohomology/LandauerEntropy.lean`
(`Obsmetrologia.Cohomology.CoverNerve.H0rank`, `.H1rank`,
`.h1_vanishes_iff_forest`, `.h1rank_is_coordination_cost`,
`Obsmetrologia.Landauer.landauerBits`, `.landauer_zero_iff_reversible`,
`.landauer_eq_coordination_cost`). The Lean files' bytes are pinned by sha256
in `src/cover-nerve.mjs`; every served answer attaches a `certificate`
recomputing those digests on every call and refusing to answer if the pinned
bytes have drifted. The JavaScript in this die is a separate implementation,
not an extraction from the Lean.

## A2A face

The die serves one signed A2A 1.0 face (`bin/serve-a2a.mjs`, executor
`bin/execute-a2a-task.mjs`), reachable publicly through the settlement's
existing tunnel:

```
https://bare-cedar-fog.561.group/a2a/mathematical-readout-exchange/.well-known/agent-card.json
```

(locally: `http://127.0.0.1:8813/.well-known/agent-card.json`). Request: one
A2A `ROLE_USER` message carrying one `application/rmn+cbor` raw part whose
RMN term is a single Mark labeled with a JSON object:

```
["mark", "{\"entities\":6,\"cells\":7,\"components\":2}"]
```

Response: a `ROLE_AGENT` message, `metadata.disposition: "completion"`, one
RMN Mark part whose JSON label carries `h0rank: 2`, `h1rank: 3`,
`coordinationFree: false`, `landauerBits: 3`, `coordinationCost: 3`, a
measured `cost` block, and the source `certificate`. An inadmissible or
malformed request is a refusal (nonzero executor exit), not a completion.

Default local port: `8813` (`PORT` environment variable); `BASE_URL` names
the public face the agent card advertises.

A2A is this die's only served network face — no JSON-RPC or other
side-channel RPC is preserved alongside it.

## ActivityStreams contract face

`src/contract-cover-nerve-readout.mjs` (law: `src/law.mjs`,
`content/contracts/cover-nerve-readout.rml`) is the unchanged, separate
provider-authored-offer / capability-attenuated-invocation carrier, run over
process standard input. It owns admission, provider-authored terms, capability
attenuation, receipt, book, event, and refusal, and is not reachable over
the network — see `AGENTS.md` for its law.

# Mathematical Relational-Graph Service

This actor serves normalized finite relational-graph metrology over signed A2A.
It derives a canonical component partition, H0/H1 ranks, coordination and
Landauer quantities, and exact/harmonic ranks from a typed RMN graph request.

CoverNerve count arithmetic is not served here. It is the standalone,
placement-independent logic die at
`../cover-nerve-services-section/cover-nerve-rank-readout-service/`.


## Zeolite–siloxane contact-graph research readout

The **existing** `run-siloxane-zeolite-rigidity` entry point now accepts
`structuralContacts`: undirected pairs of zero-based grid-site indices,
`row * columns + column`. Omit it to retain the four-neighbor surrogate.
Supply it only as an **explicit structural hypothesis**; measured conductivity
does not by itself reveal which material regions are mechanically bonded.

The missing information is mathematically unavoidable: a fully active `m × n`
four-neighbor grid has `2mn - m - n` contacts, but generic planar
rigidity of at least two vertices needs rank `2mn - 3`. When
`m + n > 3`, the grid is short by `m + n - 3` independent contacts
before any mechanics can be inferred. Structural contacts must come
from a separately justified mechanical model or measurement.

Run the five-site rigid member of the Materials ledger's fixed-count
counterexample through the real local producer:

```sh
printf '%s\n' '{"conductivityGrid":[[0,0,0,0,0]],"sigmaMatrix":1,"thresholds":[0.5],"structuralContacts":[[0,1],[0,2],[1,2],[0,3],[1,3],[1,4],[2,4]]}' \
  | node services/mathematical-readout-exchange/scripts/run-siloxane-zeolite-rigidity.mjs
```

Its `sweep[0].generic2dRigidity.rank` is **7**. Replacing the contacts
with `[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3],[3,4]]`
produces rank **6**, although both inputs have five vertices, seven
contacts and cycle rank three. Thus counted coordination and Euler index
do not predict planar rigidity. The same optional field is retained by
the existing typed RMN/A2A request encoder; no separate service is added.

The output's `contactGraph.provenance` distinguishes grid-inferred
adjacency from unverified supplied contacts. The historical
`pulsePlan.write140C` and `erase175CPlus` property names are retained
for existing consumers, **not** validated fabrication recipes: the
October 1 materials ledger retracts the proposed zeolite write/erase
mechanism. Neither mode measures 3-D rigidity, molecular structure,
crystalline volume, stress or the opposition signature.

## Local mathematical work, without an agent or theorem-checking ceremony

The existing `@lenticule-science/mathematical-readout-exchange` package now
provides the executable `readout-relational-graph`. Trusted Group, Operations
and Engineering consumers can run the exact finite-graph calculation in one
local process, with no Cloud browser, MetroPlat round trip, account token,
or Lean build:

```sh
printf '%s\n' '{"vertices":["a","b","c","d"],"edges":[["a","b"],["a","c"],["b","c"]]}' \
 | node services/mathematical-readout-exchange/scripts/readout-relational-graph.mjs
```

The returned JSON contains two components, incidence rank 2, independent cycle
rank 1, and the partition `[["a","b","c"],["d"]]`. This is a bounded
internal process, **not** an externally exposed public HTTP endpoint.
Its input must use unique sorted vertices and edges. Requests above its
size limits are refused. For remotely authenticated A2A work and typed RMN
carriers, use the service's existing client instead.

The normalized simple-graph path now uses disjoint-set components and edge
counts rather than materializing a dense adjacency matrix. Weighted graphs,
Laplacians and spanning-tree algorithms retain their separate existing APIs:
the fast simple-graph operation does not pretend to compute those.

The parent section's `npm run services` discovers this executable from the
child's `package.json`, allowing an operator to select and invoke it through
the same existing service portfolio rather than creating a second dispatcher.

The A2A face is served by `bin/serve-a2a.mjs`; its executor is
`bin/execute-a2a-task.mjs`. The Cloudflare carrier exposes only the normalized
relational-graph operation. Neither carrier claims ActivityPub, x402, EVM
settlement, or a service-performance receipt.

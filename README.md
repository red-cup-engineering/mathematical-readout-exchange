# Mathematical Relational-Graph Service

This actor serves normalized finite relational-graph metrology over signed A2A.
It derives a canonical component partition, H0/H1 ranks, coordination and
Landauer quantities, and exact/harmonic ranks from a typed RMN graph request.

CoverNerve count arithmetic is not served here. It is the standalone,
placement-independent logic die at
`../cover-nerve-services-section/cover-nerve-rank-readout-service/`.

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

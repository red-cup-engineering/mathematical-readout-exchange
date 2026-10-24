# Mathematical Relational-Graph Service

<!-- 561-group-standards:badges:start -->
[![Lenticule Science](https://img.shields.io/badge/561%20Group-Lenticule%20Science-5b4b8a)](https://github.com/lenticule-science)
[![License: MIT](https://img.shields.io/badge/license-MIT-5b4b8a)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/lenticule-science/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

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

## Proof-carrying finite-graph mathematical service — source candidate, 2026-10-24

**Original customer and upstream mathematics.** The [561 Group's actual computer
Work](https://github.com/561-group/561-group-computer-services-section/issues/6)
and its [earning-directed compute economy](https://github.com/561-group/561-group-services-section/pull/468)
need a verifiable *mathematical result*, not only an advertised machine-hour.
The original Lenticule mathematical readout broker and finite-graph producer are
the owners of this capability. Proof Science's
[source-generative hard-math research](https://github.com/lenticule-science/proof-science-services-section/issues/2)
remains a distinct, deeper theorem-discovery obligation; the existing bounded
Red Cup Lean checker remains the formalization authority when actually needed.
No additional proof engine, Work board, sales ledger or scheduler is introduced.

### Source-qualified requirements (GRAPH-CERT-01–08)

- **01, identity:** An admitted request SHALL name a finite normalized simple
  undirected graph through **unique sorted** vertex identifiers and **unique
  sorted** original edge pairs; unknown, duplicate, loop or reversed edges
  refuse instead of being repaired invisibly.
- **02, verifiability:** The source producer SHALL give an explicit **spanning
  forest made only of original edges**, exact connected-component partition,
  incidence/cycle ranks and H₀/H₁, not an unverifiable self-reported scalar.
- **03, independent receiver:** A separately implemented verifier SHALL check
  the certificate against the **actual submitted input**: every forest edge
  belongs to the input, has no cycle, spans every original edge, and derives
  the declared component partition and ranks. A forged or incomplete forest
  shall refuse even when the claimed Euler identity is numerically plausible.
- **04, limits:** Local certification and verification SHALL admit at most
  100,000 vertices and 300,000 edges, using sparse graph storage and bounded
  parsing. Actual signed RMN/A2A ingress retains its smaller 512 KiB RMN
  application limit. No inherited dense adjacency-matrix allocation is required.
- **05, compatibility:** Default local/RMN/A2A calls SHALL preserve their old
  exact V1 results. Certificates require `--certificate` locally or a distinct
  `NormalizedGraphHomologyCertificateRequest.v1` typed RMN request. The output
  is `NormalizedGraphHomologyCertificate.v1`; a V1 response cannot silently
  satisfy a certificate request.
- **06, provenance:** A request/result semantic NI and provider signatures
  attest encoded bytes/source claims, not customer acceptance, certified Lean
  extraction, license, actual compute cost or independent settlement.
- **07, money:** The product SHALL not claim saleable installation until the
  original package, signed transport, merchant/payee/rights, buyer's request,
  executed result and cost are independently received. Volunteer BOINC credit
  is noncash; an Akash bid, Golem agreement and Slurm submitted job are not
  earnings or an already accepted mathematical result.
- **08, research feedback:** Any counterexample, underperforming graph family,
  kernel verification gap or benchmark difference SHALL feed back through its
  owning mathematics or Engineering requirement and the actual original
  service—never as an unreviewed standalone theorem claim.

### Specification, architecture and design (authored source; not a completion receipt)

The source is the existing `src/normalized-graph.mjs`. The generating
algorithm scans original source-ordered edges with disjoint-set connectivity.
The forest contains the edges that first unite two components. Its component
partition and counts are derived from that structure. The original V1
`normalizedGraphSummary` shares the algorithm but does not expose the
certificate. The certificate verifier performs **its own** source normalization,
forest membership/acyclicity and spanning checks before comparing canonical
partitions and counts. There is no independent third-party mathematical oracle
inside a public deployment.

For a graph with `V` vertices, `E` edges and `c` connected components,
an original spanning forest has exactly `V − c` edges. Consequently the
boundary of the one-dimensional cellular chain complex has rank `V − c`,
`β₀ = c` and `β₁ = E − V + c`. The verifying routine checks the
finite-combinatorial premises, not an arbitrarily extended homological claim
about weights, higher cells, embeddings, torsion or material rigidity.
Sparse union/find takes near-linear time with `O(V)` scratch apart from
original input and result; it is not a GPU/cluster performance proof.

Low-level consumer design reuses `readout-relational-graph --certificate`,
the existing typed RMN encode/decode, `executeA2aMessage`, the mathematical
A2A client and the same Cloudflare Worker route. The buyer must invoke
`verifyGraphHomologyCertificate(result, originalGraph)` before labeling
a signed result mathematically source-verified. The producer's metadata
honestly retains `kernelFormalized:false`, `independentlyBuyerVerified:false`
and `resourceEffects.settled:false`. These observations are not overwritten
by a successful HTTP status, A2A signature, plausible rank or source-only CI.

### Falsifiers and actual evidence

The original `test/normalized-graph.test.mjs` defines source-positive and
adversarial forest controls, an independently implemented breadth-first
component oracle over **all 64** simple four-vertex graphs and a 12,000-vertex
long-forest input. Original `test/graph-cli.test.mjs` checks the genuine
subprocess and strict UTF-8 refusal. A first independent real Node 22/24
[RED run](https://github.com/red-cup-engineering/mathematical-readout-exchange/actions/runs/40125452264)
reported **9 passed, 4 newly authored missing-capability failures**.
After implementing the native producer, the
[mathematical GREEN run](https://github.com/red-cup-engineering/mathematical-readout-exchange/actions/runs/40125590518)
reported **13/13** for both Node versions; extended CLI tests brought that to
[15/15 on each](https://github.com/red-cup-engineering/mathematical-readout-exchange/actions/runs/40126580525).
The last named run also checks the syntax of all new A2A/Worker/test modules.
These finite regression witnesses are neither a kernel-level Lean proof nor
a signed external acceptance of the complete commercial service.

New source-owned `test/relational-graph.test.mjs`,
`test/client.test.mjs` and
`test/worker-mathematical-certificate.test.mjs` contain positive and
counterfeit-result checks of the existing *real* RMN/A2A/Cloudflare
interfaces. **Their dependency-backed execution is still UNRECEIVED.**
The source owner's package remains `private:true`, has an original
`@red-cup-engineering/relation-model-notation-runtime@7.0.0` dependency,
and [RMN Engineering #9](https://github.com/red-cup-engineering/relation-model-notation-engineering-services-section/issues/9)
records a separate public npm E404 for that version. Resolve the actual
source/registry dependency, rights, immutable package and installed endpoint
through their competent owners; neither publishing private mathematics nor
substituting another codec is an implicit consequence of this candidate.

### Commercial and competitive receiving

An ordinary buyer purchases **the verified mathematical Work output** (graph,
certificate, source qualification and receiver-validated result), not a promise
of free CPU. First use the existing internal bounded CLI on a real beneficiary
graph, qualify its correctness and cost, then receive the original signed A2A
package. A potential x402 offering is a separate original Causeway merchant
decision: its current 131-offer catalog includes other mathematical products
but **does not declare this certificate**. Price and production rights must be
selected from measured service cost and qualified buyer demand; no suggested
SKU, amount, wallet, sale, payout or cloud resource is silently created.

A matched four-peer assay uses the **same original buyer graph, result checker,
latency/error/denomination/resource readings and legal work rights**, while
retaining native differences: BOINC replicated Workunit/Result/Validator and
noncash credits; Akash deployment/lease/escrow; Golem
agreement/activity/invoice; Slurm allocation/job/TRES accounting. Record
capability, *independently accepted* capacity, efficiency per verified result,
and actually exercised native protocol/standards conformance as four
non-substitutable axes. Neither a source-only mathematical theorem nor this
branch's native test results establish deployed competitive parity. Genuine
outside paid acceptance, cost attribution and settlement remain independently
owed by Group/Coesite/Causeway.

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

## Mathematical Work optimization — not another task board

The same Mathematical Readout Exchange now calculates an **exact minimum-cost
intervention across every simultaneously critical Work dependency path**.
For an original, buyer-supplied project dependency DAG with integer durations
and marginal prices for a one-unit duration reduction, it computes:

- earliest/latest start and finish, slack, one actual critical path and the
  number of distinct critical paths;
- a minimum-cost group of tasks whose joint acceleration shortens the entire
  project, not merely one arbitrarily selected critical path;
- the full project's conditional completion time after that intervention;
- an independently checkable weighted-critical-path dual certificate showing
  no cheaper intervention can achieve the same one-unit gain.

**Mathematics and source:** This implements the original Engineering
[Work-graph](https://github.com/red-cup-engineering/engineering-services-section/blob/main/content/text/glossary/concepts/work-graph.md)
partial-order discipline. For a task v, earliest finish is its positive
duration plus the maximum of its predecessors' earliest finish values.
Backward latest starts identify the critical source/sink DAG. Selecting task
accelerations that reduce the overall integer makespan by at least one is
equivalent to finding a hitting set of every old critical path. Splitting
task vertices into priced arcs makes this exactly a minimum-capacity cut.
A residual max-flow establishes a lower bound, and the selected feasible
source task cut is an upper bound. The code recomputes the full DAG afterward.

The more important addition is the buyer verifier. The provider returns
**actual source paths with nonnegative integer flow weights**, not a magic
optimality boolean. The independent
work-intervention-certificate module checks each original directed path and
its weighted task-price constraints, plus recomputed full-plan improvement.
The matching primal and dual costs establish minimum cost by weak duality
without asking the buyer to rerun the optimizer. These proofs hold *only for
the specified finite precedence model and supplied integer estimates*, not
for a live customer's rights, staffing, market prices or physically available
calendar hours.

### Run a meaningful local Work calculation today

This route is built into the existing mathematical service package, runs on
Node 22/24 **without its optional A2A dependencies**, and makes no write,
network call, payment or customer-state change:

~~~sh
node scripts/readout-work-intervention.mjs <<'JSON'
{
  "sourceRef": "https://github.com/red-cup-engineering/engineering-services-section/issues/137",
  "durationUnit": "hypothetical-work-days",
  "costUnit": "hypothetical-budget-points",
  "budget": 2,
  "tasks": [
    {"id":"requirements","duration":3,"accelerateCost":4,"dependencies":[]},
    {"id":"specification","duration":2,"accelerateCost":1,"dependencies":["requirements"]},
    {"id":"architecture","duration":2,"accelerateCost":1,"dependencies":["requirements"]},
    {"id":"fabrication","duration":3,"accelerateCost":4,"dependencies":["specification","architecture"]}
  ]
}
JSON
~~~

Two independent eight-day critical paths cross the middle stages. Shortening
only specification changes nothing; shortening only architecture changes
nothing. The exact minimum is **2 hypothetical points** to shorten *both*,
which makes the project **7 hypothetical workdays** long. Shortening their
shared predecessor also works but costs **4** under this example input.
These costs and durations are **examples**, not measured 561 Group work
durations, a customer's quoted price or source-authenticated financial data.

Save the original request and provider result together as a JSON object
with keys request and result, then independently verify without max-flow:

~~~sh
node scripts/readout-work-intervention.mjs --verify < original-work-and-result.json
~~~

Outputs retain original Work IDs, optional source URLs, units, true slack,
the one-unit acceleration plan, minimum price in the customer's declared
units, and explicit finite-model limits. This is not an Asana, Jira, GitHub
or MetroPlat adapter, an actual person/resource scheduler, or a claim that
missing durations were inferred correctly from issue titles.

### Capacity and next real buyer receiving

The finite profile accepts up to **1,024 named Work tasks and 8,192
prerequisite edges** per request, including competing critical paths.
Substantive correctness is exercised against 90 independently enumerated
small dependency graphs, the separate primal/dual proof verifier, and a
650-task source-shaped Work graph. The existing [native Node 22/24
source-and-CLI run](https://github.com/red-cup-engineering/mathematical-readout-exchange/actions/runs/40134805216)
passed on both versions. An individual Node24 650-task read took about 8ms
on one test runner; concurrent accepted customer results/hour, per-call
billing, actual workload latency and cost remain unmeasured.

The existing [561 Group Work-continuity audit](https://561.group/work/#agent-operations)
has a **provisional $200** 20-record pilot estimate, not binding terms.
This mathematics can add a genuine useful *conditional bottleneck and
least-expensive acceleration certificate* to a buyer's scope **only if**
their actual dependency data, source rights, duration assumptions and
marginal costs are supplied and separately accepted. It is currently a
working local mathematical producer and verifier, NOT a published payable
x402 route, installed A2A release, independent buyer acceptance or earned
sale. Causeway Market and the competent seller own future package
selection, authority, measured delivery cost, quote, payment and settlement.

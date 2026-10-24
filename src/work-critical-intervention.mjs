/**
 * Exact critical-work intervention readout in the existing mathematical exchange.
 *
 * A task is an original named work vertex with nonnegative INTEGER duration.
 * Its dependency edges form a finite DAG. There are unlimited parallel lanes
 * in THIS mathematical profile: calendar/agent/resource constraints are the
 * separately existing finite-capacity production scheduling service, not
 * fabricated observations here.
 *
 * For every positive-duration task, accelerateCost prices reducing its
 * duration by one unit. Cost units and duration units are caller-declared;
 * an absent cost means that work cannot be accelerated in this contract.
 *
 * Claim: one-unit project shortening is possible iff every critical path
 * intersects some acceleratable task. Minimum extra spend equals the
 * minimum-weight VERTEX CUT of the critical-path DAG. Node-splitting turns
 * this into max-flow/min-cut; return a primal intervention and dual flow
 * value, then independently recompute the revised longest path.
 *
 * Source: the Group's original Work-graph mathematical discipline
 * (Lorentzian causal precedence, DAG work dependencies, distinction between
 * independent work and actual resource-feasible dispatch). Not a Lean
 * theorem receipt, authorized staffing change, cost quotation or sale.
 */

const LIMIT_TASKS = 256;
const LIMIT_EDGES = 4096;
const COST_MAX = 1_000_000_000;
const DURATION_MAX = 1_000_000_000;

function requireInput(yes, message) {
  if (!yes) throw new TypeError("work-critical-intervention: " + message);
}
const natural = (n, bound) => Number.isSafeInteger(n) && n >= 0 && n <= bound;
function compile(request) {
  requireInput(request && typeof request === "object" && !Array.isArray(request)
    && Array.isArray(request.tasks) && request.tasks.length >= 1
    && request.tasks.length <= LIMIT_TASKS, "requires 1–256 actual source tasks");
  for (const label of ["durationUnit", "costUnit"]) requireInput(
    typeof request[label] === "string" && request[label].length >= 1
      && request[label].length <= 80 && !/[\r\n\u0000]/u.test(request[label]),
    "must declare a bounded " + label);
  requireInput(request.budget === undefined ||
    natural(request.budget, Number.MAX_SAFE_INTEGER),
    "budget must be an optional nonnegative safe integer in original cost units");
  const tasks = request.tasks.map(task => {
    requireInput(task && typeof task === "object" && !Array.isArray(task)
      && typeof task.id === "string" && task.id.length >= 1
      && task.id.length <= 400, "each task needs one source-owned id");
    requireInput(natural(task.duration, DURATION_MAX),
      "every task duration must be a bounded nonnegative integer");
    requireInput(task.accelerateCost === null ||
      task.accelerateCost === undefined ||
      (natural(task.accelerateCost, COST_MAX) && task.accelerateCost > 0),
      "acceleration requires a positive integer price or null if unavailable");
    requireInput(Array.isArray(task.dependencies),
      "each task must declare its original prerequisite IDs");
    requireInput(task.sourceRef === undefined ||
      (typeof task.sourceRef === "string" && task.sourceRef.length >= 1
        && task.sourceRef.length <= 1024), "sourceRef must be a bounded source locator");
    return {
      id: task.id, duration: task.duration,
      accelerateCost: task.accelerateCost ?? null,
      dependencies: [...task.dependencies],
      ...(task.sourceRef === undefined ? {} : { sourceRef: task.sourceRef }),
    };
  }).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const byId = new Map(tasks.map((t,i)=>[t.id,i]));
  requireInput(byId.size === tasks.length, "duplicate source work identity");
  const pred = tasks.map(() => []), succ = tasks.map(() => []);
  let edges = 0;
  for (const [i, task] of tasks.entries()) {
    const seen = new Set();
    for (const key of task.dependencies) {
      requireInput(typeof key === "string" && byId.has(key)
        && key !== task.id && !seen.has(key),
        "unknown, duplicate or self-referential prerequisite for " + task.id);
      seen.add(key);
      const j = byId.get(key);
      pred[i].push(j);
      succ[j].push(i);
      edges++;
    }
    requireInput(edges <= LIMIT_EDGES, "too many dependency edges");
    pred[i].sort((a,b)=>a-b);
  }
  for (const successors of succ) successors.sort((a,b)=>a-b);
  const degrees = pred.map(x=>x.length);
  const queue = [];
  for(let i=0;i<tasks.length;i++) if(degrees[i]===0)queue.push(i);
  const topo = [];
  for(let cursor=0;cursor<queue.length;cursor++){
    const i=queue[cursor];topo.push(i);
    for(const next of succ[i]) if(--degrees[next]===0)queue.push(next);
  }
  requireInput(topo.length===tasks.length, "cyclic dependency chain");
  return {tasks,pred,succ,topo,edges};
}
function schedule(compiled,durations) {
  const {tasks,pred,succ,topo}=compiled;
  const start=new Array(tasks.length).fill(0);
  const finish=new Array(tasks.length).fill(0);
  for(const i of topo) {
    for(const preceding of pred[i])
      start[i]=Math.max(start[i],finish[preceding]);
    finish[i]=start[i]+durations[i];
    requireInput(Number.isSafeInteger(finish[i]),
      "total forecast duration exceeds exact integer units");
  }
  const makespan=Math.max(...finish);
  const latestFinish=new Array(tasks.length).fill(makespan);
  const latestStart=new Array(tasks.length).fill(0);
  for(let pos=topo.length-1;pos>=0;pos--){
    const i=topo[pos];
    if(succ[i].length)latestFinish[i]=Math.min(...succ[i].map(j=>latestStart[j]));
    latestStart[i]=latestFinish[i]-durations[i];
  }
  return {start,finish,latestStart,latestFinish,makespan};
}

// Each directed arc retains its residual reverse arc. BigInt makes min-cut
// cost exact without accepting floating-point financial coordinates.
function minimumVertexCut(compiled,analysis,critical,criticalPre,criticalSucc) {
  const n=compiled.tasks.length,source=2*n,target=2*n+1;
  const graph=Array.from({length:2*n+2},()=>[]);
  const add=(from,to,capacity)=>{
    const f={to,cap:capacity,rev:graph[to].length};
    const b={to:from,cap:0n,rev:graph[from].length};
    graph[from].push(f);graph[to].push(b);
  };
  const potential=critical.reduce((sum,i)=>{
    const task=compiled.tasks[i];
    return sum+(task.duration>0&&task.accelerateCost!==null
      ? BigInt(task.accelerateCost):0n);
  },0n);
  const unlimited=potential+1n;
  for (const i of critical) {
    const task=compiled.tasks[i];
    add(2*i,2*i+1,task.duration>0&&task.accelerateCost!==null
      ? BigInt(task.accelerateCost):unlimited);
    if(criticalPre[i].length===0)add(source,2*i,unlimited);
    if(criticalSucc[i].length===0)add(2*i+1,target,unlimited);
    for(const next of criticalSucc[i])add(2*i+1,2*next,unlimited);
  }
  const levels=new Array(graph.length);
  const pointers=new Array(graph.length);
  function bfs(){
    levels.fill(-1);levels[source]=0;
    const q=[source];
    for(let p=0;p<q.length;p++)
      for(const e of graph[q[p]])if(e.cap>0n&&levels[e.to]<0){
        levels[e.to]=levels[q[p]]+1;q.push(e.to);
      }
    return levels[target]>=0;
  }
  function dfs(v,allow){
    if(v===target)return allow;
    for(;pointers[v]<graph[v].length;pointers[v]++){
      const e=graph[v][pointers[v]];
      if(e.cap===0n||levels[e.to]!==levels[v]+1)continue;
      const f=dfs(e.to,allow<e.cap?allow:e.cap);
      if(f===0n)continue;
      e.cap-=f;
      graph[e.to][e.rev].cap+=f;
      return f;
    }
    return 0n;
  }
  let flow=0n;
  while(bfs()){
    pointers.fill(0);
    while(true){
      const delta=dfs(source,unlimited);
      if(delta===0n)break;
      flow+=delta;
      if(flow>=unlimited)break;
    }
    if(flow>=unlimited)break;
  }
  if(flow>=unlimited)return {possible:false,minCost:null,cut:[],flow};
  const reach=new Set([source]),pending=[source];
  for(let cursor=0;cursor<pending.length;cursor++)
    for(const e of graph[pending[cursor]])if(e.cap>0n&&!reach.has(e.to)){
      reach.add(e.to);pending.push(e.to);
    }
  const cut=critical.filter(i=>reach.has(2*i)&&!reach.has(2*i+1));
  const cost=cut.reduce((s,i)=>s+BigInt(compiled.tasks[i].accelerateCost),0n);
  if(cost!==flow)throw new Error("work-critical-intervention: min cut and max flow disagree");
  return {possible:true,minCost:cost,cut,flow};
}

/** Minimum-cost set of one-unit task accelerations that shortens the whole
 *  dependency DAG, not merely one selected critical path.
 *
 *  This is the precedence-only lower bound. Original staff calendars and
 *  authorization are separate sources and must still be qualified.
 */
export function optimizeWorkCriticalIntervention(request) {
  const compiled=compile(request);
  const {tasks,pred,succ,topo}=compiled;
  const reading=schedule(compiled,tasks.map(t=>t.duration));
  const {makespan,start,finish,latestStart,latestFinish}=reading;
  const isCritical=i=>latestStart[i]===start[i];
  const critical=topo.filter(isCritical);
  const cpre=tasks.map(()=>[]),csucc=tasks.map(()=>[]);
  for(const i of critical)for(const j of succ[i]){
    if(isCritical(j)&&finish[i]===start[j]){
      csucc[i].push(j);cpre[j].push(i);
    }
  }
  // Exact number of distinct maximum-duration directed paths, not an
  // inferred probability or a numerical duration observation.
  const ways=new Array(tasks.length).fill(0n);
  for(const i of critical){
    ways[i]=cpre[i].length===0?1n:
      cpre[i].reduce((sum,j)=>sum+ways[j],0n);
  }
  const pathCount=critical.reduce((sum,i)=>
    sum+(csucc[i].length===0?ways[i]:0n),0n);
  let criticalWitness=[];
  if(makespan>0){
    // Construct one maximum-duration original dependency path explicitly.
    const last=topo.filter(i=>finish[i]===makespan)
      .sort((a,b)=>a-b)[0];
    let at=last;
    while(at!==undefined){
      criticalWitness.unshift(tasks[at].id);
      const prior=pred[at].filter(j=>finish[j]===start[at])
        .sort((a,b)=>a-b)[0];
      at=prior;
    }
  }
  const n=tasks.length;
  const rows=tasks.map((t,i)=>Object.freeze({
    id:t.id,
    ...(t.sourceRef===undefined?{}:{sourceRef:t.sourceRef}),
    duration:t.duration,accelerateCost:t.accelerateCost,
    earliestStart:start[i],earliestFinish:finish[i],
    latestStart:latestStart[i],latestFinish:latestFinish[i],
    slack:latestStart[i]-start[i],critical:isCritical(i),
  }));
  const base={
    kind:"obsmetrologia.work-critical-intervention/v1",
    durationUnit:request.durationUnit,costUnit:request.costUnit,
    sourceRef:request.sourceRef??null,
    taskCount:n,dependencyCount:compiled.edges,
    makespan,criticalPathCount:pathCount.toString(),
    oneCriticalPath:criticalWitness,
    tasks:rows,
    limitation:"Finite precedence-only conditional forecast, not an observed duration, staff/compute calendar, authority, real purchase or beneficiary acceptance."
  };
  if(makespan===0)return Object.freeze({...base,
    status:"NO_POSITIVE_DURATION",minimumSpend:null,accelerate:[],
    forecastMakespan:makespan,conditionalReduction:0,proof:null});
  const solved=minimumVertexCut(compiled,reading,critical,cpre,csucc);
  if(!solved.possible)return Object.freeze({...base,
    status:"NO_ONE_UNIT_ACCELERATION_AVAILABLE",minimumSpend:null,
    accelerate:[],forecastMakespan:null,conditionalReduction:0,proof:null});
  const selected=new Set(solved.cut);
  const revised=schedule(compiled,tasks.map((t,i)=>t.duration-(selected.has(i)?1:0)));
  if(revised.makespan>=makespan)throw new Error(
    "work-critical-intervention: proposed cut did not shorten the original work graph");
  const accelerate=solved.cut.map(i=>Object.freeze({
    id:tasks[i].id,
    ...(tasks[i].sourceRef===undefined?{}:{sourceRef:tasks[i].sourceRef}),
    unitReduction:1,cost:tasks[i].accelerateCost,
  }));
  const budget=request.budget===undefined?null:BigInt(request.budget);
  return Object.freeze({
    ...base,status:"OPTIMAL_ONE_UNIT_CRITICAL_PATH_INTERVENTION",
    minimumSpend:solved.minCost.toString(),
    ...(budget===null?{}:{withinBudget:solved.minCost<=budget,
      budgetShortfall:solved.minCost>budget?(solved.minCost-budget).toString():"0"}),
    accelerate,forecastMakespan:revised.makespan,
    conditionalReduction:makespan-revised.makespan,
    proof:Object.freeze({
      claim:"finite vertex-split max-flow/min-cut dual for all original critical paths",
      maxFlow:solved.flow.toString(),minCut:solved.minCost.toString(),
      witness:"the selected one-unit task reductions were independently re-evaluated on the original full DAG",
      formalKernelChecked:false,
    }),
  });
}

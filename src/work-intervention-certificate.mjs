/**
 * Independently verify a proposed minimum-cost critical-work intervention.
 *
 * This consumer does NOT invoke maxflow, inspect residual graphs or call
 * optimizeWorkCriticalIntervention. It checks one feasible task acceleration
 * (an upper bound) and a fractional/weighted packing of real original
 * full-duration source→sink paths (a lower bound). Matching integer costs
 * prove global cost-optimality by weak duality. It checks mathematics only:
 * supplied task durations, prices, provenance and account rights remain
 * customer claims until separately received.
 */
const requireProof=(ok,why)=>{
  if(!ok)throw new TypeError("work-intervention-certificate: "+why);
};
const nat=value=>Number.isSafeInteger(value)&&value>=0;

function durationOf(tasks,order,changed) {
  const finish=new Map();
  for(const task of order){
    const max=task.dependencies.reduce((m,dep)=>Math.max(m,finish.get(dep)),0);
    const value=max+task.duration-(changed.has(task.id)?1:0);
    requireProof(Number.isSafeInteger(value),"duration overflow");
    finish.set(task.id,value);
  }
  return Math.max(...finish.values());
}

export function verifyOptimalWorkIntervention(request,answer) {
  requireProof(request&&Array.isArray(request.tasks)&&request.tasks.length>=1&&
    request.tasks.length<=1024,"source must contain 1–1024 tasks");
  requireProof(answer?.kind==="obsmetrologia.work-critical-intervention/v1"&&
    answer.status==="OPTIMAL_ONE_UNIT_CRITICAL_PATH_INTERVENTION",
    "a complete candidate optimal intervention is required");
  const tasks=new Map(),successors=new Map(),indegree=new Map();
  for(const task of request.tasks){
    requireProof(typeof task?.id==="string"&&task.id.length>0&&
      !tasks.has(task.id)&&nat(task.duration)&&
      Array.isArray(task.dependencies),"invalid original source task");
    tasks.set(task.id,task);successors.set(task.id,[]);indegree.set(task.id,0);
  }
  for(const task of request.tasks) {
    const predecessors=new Set();
    for(const dep of task.dependencies){
      requireProof(typeof dep==="string"&&tasks.has(dep)&&dep!==task.id&&
        !predecessors.has(dep),"invalid original dependency relation");
      predecessors.add(dep);
      successors.get(dep).push(task.id);
      indegree.set(task.id,indegree.get(task.id)+1);
    }
  }
  const queue=[...tasks.keys()].filter(id=>indegree.get(id)===0);
  const topological=[];
  for(let cursor=0;cursor<queue.length;cursor++){
    const task=tasks.get(queue[cursor]);topological.push(task);
    for(const next of successors.get(task.id)){
      indegree.set(next,indegree.get(next)-1);
      if(indegree.get(next)===0)queue.push(next);
    }
  }
  requireProof(topological.length===tasks.size,"source dependencies are cyclic");
  requireProof(Array.isArray(answer.accelerate)&&answer.accelerate.length>0,
    "intervention must identify original source tasks");
  const selected=new Set();let selectedCost=0n;
  for(const item of answer.accelerate){
    const original=tasks.get(item.id);
    requireProof(original&& !selected.has(item.id)&&
      original.duration>=1&&item.unitReduction===1&&
      nat(original.accelerateCost)&&original.accelerateCost>0&&
      item.cost===original.accelerateCost,
      "invalid paid one-unit original Work acceleration");
    selected.add(item.id);
    selectedCost+=BigInt(original.accelerateCost);
  }
  const prior=durationOf(tasks,topological,new Set());
  const after=durationOf(tasks,topological,selected);
  requireProof(prior>0&&after<prior&&answer.makespan===prior&&
    answer.forecastMakespan===after&&answer.conditionalReduction===prior-after,
    "reported optimal intervention did not shorten the original full Work graph");
  requireProof(answer.minimumSpend===selectedCost.toString(),
    "reported spend does not equal source prices of selected Work");
  const paths=answer.proof?.dualCriticalPaths;
  requireProof(Array.isArray(paths)&&paths.length>0&&
    paths.length<=1024+8192,"need a bounded independent critical-path flow witness");
  const consumed=new Map();let dual=0n;
  for(const path of paths){
    const ids=path?.taskIds;
    requireProof(Array.isArray(ids)&&ids.length>0&&ids.length<=tasks.size&&
      typeof path.weight==="string"&&/^[1-9][0-9]*$/u.test(path.weight),
      "dual path requires source task IDs and exact positive integer flow");
    const weight=BigInt(path.weight);
    requireProof(weight<=selectedCost,"dual path weight exceeds original intervention");
    requireProof(tasks.has(ids[0])&&tasks.get(ids[0]).dependencies.length===0,
      "dual path must start at a true original source");
    requireProof(tasks.has(ids.at(-1))&&successors.get(ids.at(-1)).length===0,
      "dual path must reach an original terminal Work task");
    const once=new Set();let length=0;
    for(const [index,id] of ids.entries()){
      const task=tasks.get(id);
      requireProof(task&&!once.has(id),"dual path contains unknown/repeated Work");
      once.add(id);length+=task.duration;
      if(index>0)requireProof(task.dependencies.includes(ids[index-1]),
        "dual path uses a nonexistent original precedence edge");
      if(task.duration>0&&task.accelerateCost!==null&&task.accelerateCost!==undefined) {
        requireProof(nat(task.accelerateCost)&&task.accelerateCost>0,
          "invalid declared task-cut price");
        consumed.set(id,(consumed.get(id)??0n)+weight);
      }
    }
    requireProof(length===prior,"dual flow path is not a whole critical path");
    dual+=weight;
  }
  requireProof(dual===selectedCost&&
    answer.proof.maxFlow===dual.toString()&&
    answer.proof.minCut===selectedCost.toString(),
    "dual path packing and proposed cut costs must match");
  for(const [id,weight] of consumed)
    requireProof(weight<=BigInt(tasks.get(id).accelerateCost),
      "dual weighted path packing exceeds a paid vertex capacity");
  if(request.budget!==undefined) {
    requireProof(nat(request.budget)&&
      answer.withinBudget===(selectedCost<=BigInt(request.budget)),
      "claimed budget fit differs from the original source");
  }
  return Object.freeze({
    valid:true,
    sourceWorkCount:tasks.size,
    sourceMakespan:prior,
    revisedMakespan:after,
    minimumSpend:dual.toString(),
    criticalPathWitnesses:paths.length,
    checked:"exact feasible cut and independent source-path lower-bound packing",
    independentCustomerAcceptance:false,
    formalKernelChecked:false,
  });
}

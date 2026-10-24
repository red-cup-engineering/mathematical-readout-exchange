import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { optimizeWorkCriticalIntervention } from "../src/work-critical-intervention.mjs";

function forkedPortfolio() {
  return {
    sourceRef:"https://github.com/red-cup-engineering/engineering-services-section/issues/137",
    durationUnit:"working-days",
    costUnit:"hypothetical-budget-points",
    budget:2,
    tasks:[
      {id:"requirements",duration:3,accelerateCost:4,dependencies:[]},
      {id:"specification",duration:2,accelerateCost:1,dependencies:["requirements"]},
      {id:"architecture",duration:2,accelerateCost:1,dependencies:["requirements"]},
      {id:"fabrication",duration:3,accelerateCost:4,dependencies:["specification","architecture"]},
    ],
  };
}
test("one independently valuable all-critical-path decision saves less than accelerating a shared bottleneck",()=>{
  const result=optimizeWorkCriticalIntervention(forkedPortfolio());
  assert.equal(result.kind,"obsmetrologia.work-critical-intervention/v1");
  assert.equal(result.makespan,8);
  assert.equal(result.criticalPathCount,"2");
  assert.deepEqual(result.tasks.filter(t=>t.critical).map(t=>t.id),
    ["architecture","fabrication","requirements","specification"]);
  assert.deepEqual(result.accelerate.map(x=>x.id),["architecture","specification"]);
  assert.equal(result.minimumSpend,"2");
  assert.equal(result.withinBudget,true);
  assert.equal(result.forecastMakespan,7);
  assert.equal(result.conditionalReduction,1);
  assert.equal(result.proof.maxFlow,result.proof.minCut);
  const onlyOne=structuredClone(forkedPortfolio());
  onlyOne.tasks.find(t=>t.id==="specification").duration-=1;
  assert.equal(optimizeWorkCriticalIntervention(onlyOne).makespan,8,
    "accelerating one critical branch leaves the other eight-day path");
  const central=structuredClone(forkedPortfolio());
  central.tasks.find(t=>t.id==="requirements").accelerateCost=1;
  const alternative=optimizeWorkCriticalIntervention(central);
  assert.deepEqual(alternative.accelerate.map(x=>x.id),["requirements"]);
  assert.equal(alternative.minimumSpend,"1");
  assert.equal(alternative.forecastMakespan,7);
});

test("independent noncritical work does not become an accelerator budget target",()=>{
  const req=forkedPortfolio();
  req.tasks.push({id:"unrelated-low-slack",duration:1,accelerateCost:1,dependencies:[]});
  const result=optimizeWorkCriticalIntervention(req);
  assert.equal(result.makespan,8);
  assert.equal(result.tasks.find(x=>x.id==="unrelated-low-slack").slack,7);
  assert.deepEqual(result.accelerate.map(x=>x.id),["architecture","specification"]);
});

test("zero-duration source gates and locked steps preserve the correct min cut",()=>{
  const req={
    durationUnit:"days",costUnit:"cents",tasks:[
      {id:"g0",duration:0,accelerateCost:null,dependencies:[]},
      {id:"a",duration:2,accelerateCost:null,dependencies:["g0"]},
      {id:"b",duration:2,accelerateCost:3,dependencies:["g0"]},
      {id:"final",duration:2,accelerateCost:5,dependencies:["a","b"]},
    ]
  };
  const result=optimizeWorkCriticalIntervention(req);
  assert.deepEqual(result.accelerate.map(x=>x.id),["final"]);
  assert.equal(result.minimumSpend,"5");
  assert.equal(result.forecastMakespan,3);
  req.tasks.find(t=>t.id==="final").accelerateCost=null;
  assert.equal(optimizeWorkCriticalIntervention(req).status,
    "NO_ONE_UNIT_ACCELERATION_AVAILABLE");
});

test("minimum cost matches an independent exhaustive dependency-subset oracle",()=>{
  // This brute-force oracle enumerates every subset, without using the
  // mincut solver or the latter's critical graph decomposition.
  function makespan(tasks,selected) {
    const time=new Map();
    let unvisited=new Set(tasks.map(t=>t.id));
    while(unvisited.size){
      let progressed=false;
      for(const t of tasks)if(unvisited.has(t.id)&&t.dependencies.every(d=>time.has(d))){
        const start=t.dependencies.reduce((m,d)=>Math.max(m,time.get(d)),0);
        time.set(t.id,start+t.duration-(selected.has(t.id)?1:0));
        unvisited.delete(t.id);progressed=true;
      }
      if(!progressed)throw Error("bad brute-force fixture");
    }
    return Math.max(...time.values());
  }
  let seed=27182818;const rnd=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;
  };
  for(let fixture=0;fixture<90;fixture++){
    const n=3+(fixture%5);
    const tasks=Array.from({length:n},(_,i)=>({
      id:"n"+i,duration:1+Math.floor(rnd()*5),
      accelerateCost:rnd()<0.18?null:1+Math.floor(rnd()*11),
      dependencies:Array.from({length:i},(_,j)=>j)
        .filter(()=>rnd()<0.42).map(j=>"n"+j),
    }));
    const base=makespan(tasks,new Set());
    let best=null;
    for(let mask=0;mask<(1<<n);mask++){
      const selected=new Set(),index=new Set();
      let cost=0,allowed=true;
      for(let i=0;i<n;i++)if(mask&(1<<i)){
        if(tasks[i].accelerateCost===null){allowed=false;break;}
        cost+=tasks[i].accelerateCost;
        selected.add(tasks[i].id);
      }
      if(allowed&&makespan(tasks,selected)<base
        &&(best===null||cost<best))best=cost;
    }
    const actual=optimizeWorkCriticalIntervention({
      durationUnit:"days",costUnit:"points",tasks,
    });
    assert.equal(actual.makespan,base,"source forecast failed fixture "+fixture);
    if(best===null){
      assert.equal(actual.status,"NO_ONE_UNIT_ACCELERATION_AVAILABLE",
        "unsolved source fixture "+fixture);
    }else{
      assert.equal(actual.minimumSpend,String(best),
        "not minimum-cost intervention in fixture "+fixture);
      const chosen=new Set(actual.accelerate.map(x=>x.id));
      assert.ok(makespan(tasks,chosen)<base);
      assert.equal(actual.proof.maxFlow,String(best));
    }
  }
});

test("650 simultaneous Work vertices are admitted and the end-to-end math remains bounded",()=>{
  const n=650;
  const tasks=Array.from({length:n},(_,i)=>({
    id:"work-"+String(i).padStart(4,"0"),
    duration:1,accelerateCost:i%17===0?2:5,
    dependencies:i===0?[]:["work-"+String(i-1).padStart(4,"0")],
  }));
  const started=performance.now();
  const result=optimizeWorkCriticalIntervention({
    durationUnit:"days",costUnit:"points",tasks,
  });
  const elapsed=performance.now()-started;
  assert.equal(result.taskCount,650);
  assert.equal(result.makespan,650);
  assert.equal(result.criticalPathCount,"1");
  assert.equal(result.minimumSpend,"2");
  assert.deepEqual(result.accelerate.map(x=>x.id),["work-0000"]);
  assert.equal(result.forecastMakespan,649);
  console.log("Work bottleneck math: 650-node exact critical path and mincut, "+
    Math.round(elapsed)+"ms Node runtime; not accepted users or host capacity");
});

test("real local graph readout CLI produces the same optimizer output",()=>{
  const script=new URL("../scripts/readout-work-intervention.mjs",import.meta.url);
  const result=spawnSync(process.execPath,[script],{
    input:JSON.stringify(forkedPortfolio()),encoding:"utf8",timeout:15000
  });
  assert.equal(result.status,0,result.stderr);
  const actual=JSON.parse(result.stdout);
  assert.deepEqual(actual,optimizeWorkCriticalIntervention(forkedPortfolio()));
  assert.equal(actual.minimumSpend,"2");
});

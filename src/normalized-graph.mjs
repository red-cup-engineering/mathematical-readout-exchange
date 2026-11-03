// Fast, exact finite-graph invariants for the existing typed readout service.
// Unlike the general weighted-matrix carrier, this normalized simple-graph
// route uses O(vertices + edges) time and O(vertices) auxiliary memory.
// It does not replace the independent weighted, Laplacian or spanning-tree APIs.

function summarizeGraph(vertices,edges,withForest=false){
  if(!Array.isArray(vertices)||!Array.isArray(edges))
    throw new TypeError("vertices and edges must be arrays");
  if(vertices.length===0)
    throw new TypeError("a normalized relational graph requires at least one vertex");
  if(vertices.some(vertex=>typeof vertex!=="string"||vertex.length===0))
    throw new TypeError("vertices must be nonempty strings");
  if(vertices.some((vertex,i)=>i>0&&vertices[i-1]>=vertex))
    throw new TypeError("vertices must be unique and sorted");
  const index=new Map(vertices.map((vertex,i)=>[vertex,i]));
  const parent=Array.from({length:vertices.length},(_,i)=>i);
  const sizes=new Array(vertices.length).fill(1);
  const find=(i)=>{
    while(parent[i]!==i){
      parent[i]=parent[parent[i]];
      i=parent[i];
    }
    return i;
  };
  let components=vertices.length;
  const forestEdges=withForest?[]:null;
  const unite=(a,b)=>{
    let left=find(a),right=find(b);
    if(left===right)return false;
    if(sizes[left]<sizes[right])[left,right]=[right,left];
    parent[right]=left;
    sizes[left]+=sizes[right];
    components-=1;
    return true;
  };
  let previous=null;
  for(const edge of edges){
    if(!Array.isArray(edge)||edge.length!==2||edge.some(vertex=>typeof vertex!=="string"))
      throw new TypeError("each edge must be a two-vertex string pair");
    const [left,right]=edge;
    if(!index.has(left)||!index.has(right))
      throw new TypeError("edge contains an unknown vertex");
    if(left>=right)
      throw new TypeError("edge endpoints must be distinct and sorted");
    if(previous!==null&&(previous[0]>left||(previous[0]===left&&previous[1]>=right)))
      throw new TypeError("edges must be unique and sorted");
    previous=edge;
    if(unite(index.get(left),index.get(right))&&forestEdges!==null)
      forestEdges.push(Object.freeze([left,right]));
  }
  const partition=new Map();
  for(let i=0;i<vertices.length;i++){
    const root=find(i);
    if(!partition.has(root))partition.set(root,[]);
    partition.get(root).push(vertices[i]);
  }
  // Iterating the already sorted vertices inserts groups by first vertex.
  const componentPartition=[...partition.values()].map(group=>Object.freeze(group));
  const exactRank=vertices.length-components;
  const harmonicRank=edges.length-exactRank;
  return Object.freeze({
    entities:vertices.length,
    cells:edges.length,
    components,
    exactRank,
    harmonicRank,
    componentPartition:Object.freeze(componentPartition),
    ...(forestEdges===null?{}:{forestEdges:Object.freeze(forestEdges)})
  });
}


/** Incumbent normalized V1 result remains unchanged for existing clients. */
export function normalizedGraphSummary(vertices,edges){
  return summarizeGraph(vertices,edges,false);
}

/**
 * A finite, separately checkable witness for H₀ and H₁ of one canonical simple
 * undirected graph. Only selected *actual source edges* become forest edges.
 * Since F is a spanning forest, rank(d₁)=|F| and β₁=|E|-|F|.
 *
 * This is elementary graph-homology mathematics, not a Lean theorem, provider
 * authentication, source ownership, right to sell, or remote Work settlement.
 */
export function certifiedGraphHomology(vertices,edges){
  // The independent certificate/verification profile has a finite resource
  // boundary consistent with the existing source-owning local CLI.
  if(!Array.isArray(vertices)||!Array.isArray(edges)||
      vertices.length>100_000||edges.length>300_000)
    throw new RangeError("graph certificate source exceeds bounded profile");
  const summary=summarizeGraph(vertices,edges,true);
  return Object.freeze({
    kind:"NormalizedGraphHomologyCertificate.v1",
    ...summary,
    h0rank:summary.components,
    h1rank:summary.harmonicRank
  });
}

function edgeOrder(a,b){
  return a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0;
}
function certificateRefusal(detail){
  throw new TypeError("graph certificate: "+detail);
}

/**
 * Independence from the producer's union-by-size construction:
 * - Source admission is performed again, without invoking the producer.
 * - The submitted forest must be an acyclic subset of exactly the input edges.
 * - Every original edge must lie within one forest component (spanning).
 * - The certificate's sorted component partition and H₀/H₁ counts must follow.
 * Checking is O(V+E) up to inverse-Ackermann union cost, with O(V) scratch
 * beyond the input/certificate. No dense matrix, remote account or model.
 */
export function verifyGraphHomologyCertificate(value,originalGraph){
  if(!value||typeof value!=="object"||Array.isArray(value)||
      value.kind!=="NormalizedGraphHomologyCertificate.v1"||
      Object.keys(value).sort().join(",")!==
      "cells,componentPartition,components,entities,exactRank,forestEdges,h0rank,h1rank,harmonicRank,kind")
    certificateRefusal("wrong typed witness or unsupported extra claim");
  const vertices=originalGraph?.vertices,edges=originalGraph?.edges;
  if(!Array.isArray(vertices)||!Array.isArray(edges)||
      vertices.length===0||vertices.length>100_000||edges.length>300_000)
    certificateRefusal("source graph is absent or outside the bounded profile");
  const index=new Map();
  for(let i=0;i<vertices.length;i++){
    const v=vertices[i];
    if(typeof v!=="string"||v.length===0||
        (i>0&&vertices[i-1]>=v))certificateRefusal("source vertices are not normalized");
    index.set(v,i);
  }
  let prev=null;
  for(const e of edges){
    if(!Array.isArray(e)||e.length!==2||typeof e[0]!=="string"||
        typeof e[1]!=="string"||!index.has(e[0])||!index.has(e[1])||
        e[0]>=e[1]||(prev!==null&&edgeOrder(prev,e)>=0))
      certificateRefusal("source edges are not canonical, unique and valid");
    prev=e;
  }

  if(!Array.isArray(value.forestEdges)||
      value.forestEdges.length>Math.min(edges.length,vertices.length-1))
    certificateRefusal("forest has invalid size");
  const parent=vertices.map((_v,i)=>i);
  const size=vertices.map(()=>1);
  const find=start=>{
    let i=start;
    while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}
    return i;
  };
  const unite=(a,b)=>{
    let x=find(a),y=find(b);
    if(x===y)return false;
    if(size[x]<size[y])[x,y]=[y,x];
    parent[y]=x;size[x]+=size[y];
    return true;
  };
  let ptr=0,previousForest=null;
  for(const e of value.forestEdges){
    if(!Array.isArray(e)||e.length!==2||typeof e[0]!=="string"||
        typeof e[1]!=="string"||!index.has(e[0])||!index.has(e[1])||
        e[0]>=e[1]||(previousForest!==null&&edgeOrder(previousForest,e)>=0))
      certificateRefusal("forest witness is not a normalized sorted edge set");
    while(ptr<edges.length&&edgeOrder(edges[ptr],e)<0)ptr++;
    if(ptr===edges.length||edgeOrder(edges[ptr],e)!==0)
      certificateRefusal("forest witness includes a non-source edge");
    if(!unite(index.get(e[0]),index.get(e[1])))
      certificateRefusal("forest witness has a cycle");
    ptr++;previousForest=e;
  }
  for(const [a,b] of edges)
    if(find(index.get(a))!==find(index.get(b)))
      certificateRefusal("forest witness does not span the input graph");

  const groups=new Map();
  for(let i=0;i<vertices.length;i++){
    const root=find(i);
    if(!groups.has(root))groups.set(root,[]);
    groups.get(root).push(vertices[i]);
  }
  const partition=[...groups.values()];
  const components=partition.length;
  const exactRank=value.forestEdges.length;
  const harmonicRank=edges.length-exactRank;
  if(value.entities!==vertices.length||value.cells!==edges.length||
      value.components!==components||value.h0rank!==components||
      value.exactRank!==exactRank||exactRank!==vertices.length-components||
      value.h1rank!==harmonicRank||value.harmonicRank!==harmonicRank)
    certificateRefusal("ranks disagree with the source-attested spanning forest");
  if(!Array.isArray(value.componentPartition)||
      value.componentPartition.length!==partition.length||
      partition.some((group,i)=>!Array.isArray(value.componentPartition[i])||
        value.componentPartition[i].length!==group.length||
        group.some((vertex,j)=>value.componentPartition[i][j]!==vertex)))
    certificateRefusal("canonical component partition disagrees with the forest");
  return value;
}



/** The minimal independently checkable numerical and partition contract for
 * a normalized simple graph's remote readout. This refuses mathematically
 * impossible output even when its CBOR syntax and signature are valid.
 * It does not certify the correspondence to the caller's original graph. */
export function assertNormalizedGraphResult(value, originalGraph) {
  const fields = ["entities", "cells", "components", "h0rank", "h1rank", "exactRank", "harmonicRank"];
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      fields.some(field => !Number.isSafeInteger(value[field]) || value[field] < 0))
    throw new TypeError("relational-graph output has invalid nonnegative integer ranks");
  const { entities, cells, components, h0rank, h1rank, exactRank, harmonicRank, componentPartition } = value;
  if (entities === 0 || components === 0 || components > entities ||
      exactRank !== entities - components ||
      harmonicRank !== cells - exactRank ||
      h0rank !== components || h1rank !== harmonicRank)
    throw new TypeError("relational-graph output violates exact graph homology ranks");

  const canonical = Array.isArray(componentPartition)
    && componentPartition.length === components
    && componentPartition.every(group => Array.isArray(group) && group.length > 0
      && group.every((vertex, index) => typeof vertex === "string" && vertex.length > 0
        && (index === 0 || group[index-1] < vertex)))
    && componentPartition.every((group, index) => index === 0 || componentPartition[index-1][0] < group[0]);
  const flat = canonical ? componentPartition.flat() : [];
  if (!canonical || flat.length !== entities || new Set(flat).size !== flat.length)
    throw new TypeError("relational-graph output omits its canonical component partition");
  if (originalGraph !== undefined) {
    const expected = normalizedGraphSummary(originalGraph.vertices, originalGraph.edges);
    if (["entities", "cells", "components", "exactRank", "harmonicRank"]
      .some(field => value[field] !== expected[field]) ||
      componentPartition.length !== expected.componentPartition.length ||
      componentPartition.some((group,index) =>
        group.length !== expected.componentPartition[index].length ||
        group.some((vertex,j) => vertex !== expected.componentPartition[index][j])))
      throw new TypeError("relational-graph output disagrees with the submitted graph");
  }
  return value;
}

// Fast, exact finite-graph invariants for the existing typed readout service.
// Unlike the general weighted-matrix carrier, this normalized simple-graph
// route uses O(vertices + edges) time and O(vertices) auxiliary memory.
// It does not replace the independent weighted, Laplacian or spanning-tree APIs.

export function normalizedGraphSummary(vertices,edges){
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
  const unite=(a,b)=>{
    let left=find(a),right=find(b);
    if(left===right)return;
    if(sizes[left]<sizes[right])[left,right]=[right,left];
    parent[right]=left;
    sizes[left]+=sizes[right];
    components-=1;
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
    unite(index.get(left),index.get(right));
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
    componentPartition:Object.freeze(componentPartition)
  });
}

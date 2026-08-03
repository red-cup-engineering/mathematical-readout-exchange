import { jsonId } from "./semantic-identity.mjs";

function refuse(message) {
  const error = new RangeError(message);
  error.code = "relational-graph-profile-refusal";
  throw error;
}

function safe(value, where) {
  if (!Number.isSafeInteger(value) || value < 0) refuse(`${where} exceeds the bounded safe-integer profile`);
  return value;
}

function square(weights) {
  if (!Array.isArray(weights) || weights.some((row) => !Array.isArray(row) || row.length !== weights.length)) {
    throw new TypeError("weights must be a square matrix");
  }
  return weights.map((row, i) => row.map((value, j) => {
    safe(value, `weights[${i}][${j}]`);
    if (value !== weights[j]?.[i]) throw new TypeError("weights must be symmetric");
    if (i === j && value !== 0) throw new TypeError("relation-graph diagonal must be zero");
    return value;
  }));
}

export function relationGraphOfCells(cells) {
  if (!Array.isArray(cells)) throw new TypeError("cells must be an array");
  if (cells.length === 0) throw new TypeError("an empty cell family presents no relation graph");
  const terms = [];
  const index = new Map();
  const at = (value) => {
    const id = jsonId(value, "lenticule.mathematical-readout.relation-cell-endpoint");
    if (!index.has(id)) { index.set(id, terms.length); terms.push(id); }
    return index.get(id);
  };
  const pairs = [];
  for (const cell of cells) {
    if (!cell || typeof cell !== "object" || !("subject" in cell) || !("object" in cell)) {
      throw new TypeError("each relation cell requires subject and object RMN carriers");
    }
    const left = at(cell.subject), right = at(cell.object);
    if (left !== right) pairs.push([left, right]);
  }
  const weights = Array.from({ length: terms.length }, () => Array(terms.length).fill(0));
  for (const [left, right] of pairs) {
    weights[left][right] = safe(weights[left][right] + 1, "edge multiplicity");
    weights[right][left] = weights[left][right];
  }
  return Object.freeze({
    profile: "org.emsenn.obsmetrologia.finite-relational-graph.v1",
    terms: Object.freeze(terms),
    weights: Object.freeze(weights.map((row) => Object.freeze(row))),
  });
}

export function relationGraphOfNormalizedEdges(vertices, edges) {
  if (!Array.isArray(vertices) || !Array.isArray(edges)) throw new TypeError("vertices and edges must be arrays");
  if (vertices.length === 0) throw new TypeError("a normalized relational graph requires at least one vertex");
  if (vertices.some((vertex) => typeof vertex !== "string" || vertex.length === 0)) {
    throw new TypeError("vertices must be nonempty strings");
  }
  if (vertices.some((vertex, index) => index > 0 && vertices[index - 1] >= vertex)) {
    throw new TypeError("vertices must be unique and sorted");
  }
  const vertexSet = new Set(vertices);
  let previous = null;
  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 2 || edge.some((vertex) => typeof vertex !== "string")) {
      throw new TypeError("each edge must be a two-vertex string pair");
    }
    const [left, right] = edge;
    if (!vertexSet.has(left) || !vertexSet.has(right)) throw new TypeError("edge contains an unknown vertex");
    if (left >= right) throw new TypeError("edge endpoints must be distinct and sorted");
    if (previous !== null && (
      previous[0] > left
      || (previous[0] === left && previous[1] >= right)
    )) throw new TypeError("edges must be unique and sorted");
    previous = edge;
  }
  return relationGraphOfCells([
    ...vertices.map((vertex) => ({ subject: vertex, object: vertex })),
    ...edges.map(([subject, object]) => ({ subject, object })),
  ]);
}

export function laplacianOf(graph) {
  const weights = square(graph?.weights);
  return Object.freeze(weights.map((row, i) => Object.freeze(row.map((weight, j) =>
    i === j ? safe(row.reduce((sum, value) => safe(sum + value, "weighted degree"), 0), "weighted degree") : -weight))));
}

export function componentIndices(graph) {
  const weights = square(graph?.weights), parent = weights.map((_row, i) => i);
  const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < weights.length; i += 1) for (let j = i + 1; j < weights.length; j += 1) {
    if (weights[i][j] > 0) { const a = find(i), b = find(j); if (a !== b) parent[a] = b; }
  }
  const members = new Map();
  for (let index = 0; index < parent.length; index += 1) {
    const root = find(index);
    if (!members.has(root)) members.set(root, []);
    members.get(root).push(index);
  }
  return Object.freeze([...members.values()].map((component) => Object.freeze(component)));
}

export function componentCount(graph) {
  return componentIndices(graph).length;
}

function determinant(source) {
  const matrix = source.map((row) => row.map(BigInt));
  if (matrix.length === 0) return 1n;
  let sign = 1n, divisor = 1n;
  for (let pivot = 0; pivot < matrix.length - 1; pivot += 1) {
    let row = pivot;
    while (row < matrix.length && matrix[row][pivot] === 0n) row += 1;
    if (row === matrix.length) return 0n;
    if (row !== pivot) { [matrix[pivot], matrix[row]] = [matrix[row], matrix[pivot]]; sign = -sign; }
    const value = matrix[pivot][pivot];
    for (let i = pivot + 1; i < matrix.length; i += 1) for (let j = pivot + 1; j < matrix.length; j += 1) {
      matrix[i][j] = (matrix[i][j] * value - matrix[i][pivot] * matrix[pivot][j]) / divisor;
    }
    divisor = value;
  }
  return sign * matrix.at(-1).at(-1);
}

export function treeCount(graph) {
  const laplacian = laplacianOf(graph);
  return laplacian.length <= 1 ? 1n : determinant(laplacian.slice(1).map((row) => row.slice(1)));
}

export function safeCount(value, where = "count") {
  if (typeof value === "number") return safe(value, where);
  if (typeof value !== "bigint" || value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) refuse(`${where} exceeds the bounded safe-integer profile`);
  return Number(value);
}

export function hodgeDecomposition(graph, components = componentCount(graph)) {
  const weights = square(graph?.weights);
  const vertices = weights.length;
  let edges = 0;
  for (let i = 0; i < vertices; i += 1) for (let j = i + 1; j < vertices; j += 1) edges = safe(edges + weights[i][j], "edge count");
  const exact = vertices - components;
  return Object.freeze({ edges, exact, harmonic: edges - exact });
}

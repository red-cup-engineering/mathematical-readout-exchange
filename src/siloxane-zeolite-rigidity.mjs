/**
 * Deterministic, dependency-free 2-D surrogate for thresholded conductivity
 * images.  It is deliberately not a molecular-dynamics, DFT, or 3-D model.
 */

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const MAX_GRID_SITES = 16_384;
const MAX_SWEEP_EVALUATIONS = 262_144;
const MAX_CONTACT_VERTICES = 65_536;
const MAX_CONTACT_EDGES = 262_144;

function requireFiniteNumber(value, name, { positive = false, nonnegative = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)
    || (positive && value <= 0) || (nonnegative && value < 0)) {
    throw new TypeError(`${name} must be a finite${positive ? ' positive' : nonnegative ? ' non-negative' : ''} number`);
  }
  return value;
}

/** Validate and normalize the public assay input without changing sweep order. */
export function validateSiloxaneZeoliteRigidityInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  const { conductivityGrid, sigmaMatrix, thresholds } = input;
  if (!Array.isArray(conductivityGrid) || conductivityGrid.length === 0) {
    throw new TypeError('conductivityGrid must be a non-empty rectangular array');
  }
  if (!Array.isArray(conductivityGrid[0]) || conductivityGrid[0].length === 0) {
    throw new TypeError('conductivityGrid must have at least one column');
  }
  const columns = conductivityGrid[0].length;
  if (conductivityGrid.length * columns > MAX_GRID_SITES)
    throw new RangeError("conductivityGrid exceeds 16384 sites in the bounded assay");
  const grid = conductivityGrid.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== columns) {
      throw new TypeError('conductivityGrid must be rectangular');
    }
    return row.map((sigma, columnIndex) => requireFiniteNumber(
      sigma, `conductivityGrid[${rowIndex}][${columnIndex}]`, { nonnegative: true },
    ));
  });
  requireFiniteNumber(sigmaMatrix, 'sigmaMatrix', { positive: true });
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    throw new TypeError('thresholds must be a non-empty array of values in [0, 1]');
  }
  if (thresholds.length * grid.length * columns > MAX_SWEEP_EVALUATIONS)
    throw new RangeError("threshold sweep exceeds the bounded assay workload");
  const normalizedThresholds = thresholds.map((threshold, index) => {
    requireFiniteNumber(threshold, `thresholds[${index}]`);
    if (threshold < 0 || threshold > 1) throw new RangeError(`thresholds[${index}] must be in [0, 1]`);
    return threshold;
  });
  return { grid, sigmaMatrix, thresholds: normalizedThresholds, rows: grid.length, columns };
}

function connectedComponents(vertices, edges) {
  const adjacent = new Map(vertices.map((vertex) => [vertex, []]));
  for (const [left, right] of edges) {
    adjacent.get(left).push(right);
    adjacent.get(right).push(left);
  }
  const componentOf = new Map();
  const components = [];
  for (const root of vertices) {
    if (componentOf.has(root)) continue;
    const members = [];
    const stack = [root];
    componentOf.set(root, components.length);
    while (stack.length) {
      const vertex = stack.pop();
      members.push(vertex);
      for (const neighbor of adjacent.get(vertex)) {
        if (!componentOf.has(neighbor)) {
          componentOf.set(neighbor, components.length);
          stack.push(neighbor);
        }
      }
    }
    components.push(members.sort((a, b) => a - b));
  }
  return { components, componentOf };
}

/*
 * The (2,3)-pebble game accepts precisely the independent edges of the
 * generic planar rigidity (Laman) matroid.  Traversal and orientation are
 * deterministic, so the selected basis and rejected-edge list are stable.
 */
export function generic2dRigidityRank(vertexCount, edges) {
  if (!Number.isSafeInteger(vertexCount) || vertexCount < 1 || vertexCount > MAX_CONTACT_VERTICES)
    throw new RangeError("pebble game requires 1..65536 finite contact vertices");
  if (!Array.isArray(edges) || edges.length > MAX_CONTACT_EDGES)
    throw new RangeError("pebble game exceeds 262144 contact edges");
  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 2 ||
      edge.some(v => !Number.isSafeInteger(v) || v < 0 || v >= vertexCount) ||
      edge[0] === edge[1])
      throw new TypeError("pebble game edges must join distinct indexed vertices");
  }
  const free = Array(vertexCount).fill(2);
  const directed = edges.map(([left, right]) => ({ tail: left, head: right }));
  const outgoing = Array.from({ length: vertexCount }, () => []);
  const accepted = [];
  const rejected = [];

  // Iterative depth-first pebble transfer. Preserve the same deterministic
  // adjacency traversal and forbid crossing the opposite endpoint, but reverse
  // a discovered augmenting path from its free leaf without JS recursion.
  function moveFreePebble(start, forbidden) {
    const visited = new Set([start]);
    const incoming = new Map(); // vertex -> { parent, edgeIndex }
    const stack = [{ vertex: start, next: 0 }];
    let terminal = null;
    while (stack.length) {
      const frame = stack.at(-1);
      const candidates = outgoing[frame.vertex];
      if (frame.next === candidates.length) { stack.pop(); continue; }
      const edgeIndex = candidates[frame.next++];
      const next = directed[edgeIndex].head;
      if (next === forbidden || visited.has(next)) continue;
      visited.add(next);
      incoming.set(next, { parent: frame.vertex, edgeIndex });
      if (free[next] > 0) { terminal = next; break; }
      stack.push({ vertex: next, next: 0 });
    }
    if (terminal === null) return false;
    for (let vertex = terminal; vertex !== start;) {
      const { parent, edgeIndex } = incoming.get(vertex);
      const out = outgoing[parent];
      const position = out.indexOf(edgeIndex);
      if (position < 0) throw new Error("pebble orientation and adjacency disagree");
      out.splice(position, 1);
      outgoing[vertex].push(edgeIndex);
      directed[edgeIndex].tail = vertex;
      directed[edgeIndex].head = parent;
      free[vertex] -= 1;
      free[parent] += 1;
      vertex = parent;
    }
    return true;
  }

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    const [left, right] = edges[edgeIndex];
    let found = true;
    // A (2,3)-game needs l + 1 = 4 endpoint pebbles before a new edge may
    // consume one; this enforces the global m <= 2n - 3 Laman bound as well.
    while (free[left] + free[right] < 4 && found) {
      found = moveFreePebble(left, right);
      if (free[left] + free[right] < 4 && !found) found = moveFreePebble(right, left);
    }
    if (free[left] + free[right] < 4) {
      rejected.push(edgeIndex);
      continue;
    }
    directed[edgeIndex].tail = left;
    directed[edgeIndex].head = right;
    outgoing[left].push(edgeIndex);
    free[left] -= 1;
    accepted.push(edgeIndex);
  }
  return { rank: accepted.length, accepted, rejected };
}

function assayThreshold(phiGrid, threshold) {
  const rows = phiGrid.length;
  const columns = phiGrid[0].length;
  const active = [];
  const activeSet = new Set();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const vertex = row * columns + column;
      if (phiGrid[row][column] >= threshold) {
        active.push(vertex);
        activeSet.add(vertex);
      }
    }
  }
  const edges = [];
  for (const vertex of active) {
    const row = Math.floor(vertex / columns);
    const column = vertex % columns;
    for (const [nextRow, nextColumn] of [[row, column + 1], [row + 1, column]]) {
      const neighbor = nextRow * columns + nextColumn;
      if (nextRow < rows && nextColumn < columns && activeSet.has(neighbor)) edges.push([vertex, neighbor]);
    }
  }
  const { components, componentOf } = connectedComponents(active, edges);
  const rigidity = generic2dRigidityRank(rows * columns, edges);
  const componentEdges = components.map(() => []);
  edges.forEach((edge, edgeIndex) => componentEdges[componentOf.get(edge[0])].push(edgeIndex));
  const componentReadouts = components.map((members, componentIndex) => {
    const localIndex = new Map(members.map((vertex, index) => [vertex, index]));
    const localEdges = componentEdges[componentIndex].map((edgeIndex) => edges[edgeIndex].map((vertex) => localIndex.get(vertex)));
    const local = generic2dRigidityRank(members.length, localEdges);
    const maxRank = Math.max(0, 2 * members.length - 3);
    const left = members.some((vertex) => vertex % columns === 0);
    const right = members.some((vertex) => vertex % columns === columns - 1);
    const top = members.some((vertex) => Math.floor(vertex / columns) === 0);
    const bottom = members.some((vertex) => Math.floor(vertex / columns) === rows - 1);
    return {
      vertices: members.length,
      edges: localEdges.length,
      generic2dRank: local.rank,
      maximumGeneric2dRank: maxRank,
      rigid: members.length >= 2 && local.rank === maxRank,
      spansLeftRight: left && right,
      spansTopBottom: top && bottom,
      memberVertexIds: members,
    };
  });
  const nonRigid = new Set(componentReadouts.flatMap((component) => component.rigid ? [] : component.memberVertexIds));
  const redundantVertices = new Set(rigidity.rejected.flatMap((edgeIndex) => edges[edgeIndex]));
  const site = (vertex) => ({ row: Math.floor(vertex / columns), column: vertex % columns, phi: phiGrid[Math.floor(vertex / columns)][vertex % columns] });
  const compactComponents = componentReadouts.map(({ memberVertexIds, ...component }) => component);
  return {
    threshold,
    activeVertexCount: active.length,
    contactGraph: {
      vertices: active.length,
      edges: edges.length,
      components: components.length,
      cycleRank: edges.length - active.length + components.length,
      spansLeftRight: compactComponents.some((component) => component.spansLeftRight),
      spansTopBottom: compactComponents.some((component) => component.spansTopBottom),
    },
    generic2dRigidity: {
      rank: rigidity.rank,
      maximumComponentRank: componentReadouts.reduce((total, component) => total + component.maximumGeneric2dRank, 0),
      rigidComponentCount: compactComponents.filter((component) => component.rigid).length,
      components: compactComponents,
    },
    pulsePlan: {
      conservative: true,
      write140C: active.filter((vertex) => nonRigid.has(vertex)).map((vertex) => ({ ...site(vertex), reason: 'active high-phi site belongs to a non-rigid 2-D generic component' })),
      erase175CPlus: [...redundantVertices].sort((a, b) => a - b).map((vertex) => ({ ...site(vertex), reason: 'incident to a pebble-game-rejected redundant 2-D contact edge' })),
    },
  };
}

export function runSiloxaneZeoliteRigidity(input) {
  const { grid, sigmaMatrix, thresholds, rows, columns } = validateSiloxaneZeoliteRigidityInput(input);
  // Saturated conductivity is exactly zero phi; short-circuit before
  // potentially overflowing sigma/sigmaMatrix at extreme finite scales.
  const phiGrid = grid.map((row) => row.map((sigma) =>
    sigma >= sigmaMatrix ? 0 : clamp01(1 - (sigma / sigmaMatrix) ** 1.5)));
  return {
    model: 'surrogate2d',
    scope: 'thresholded 4-neighbor planar conductivity-grid contact graph with generic 2-D rigidity rank',
    limitations: [
      'This is a surrogate2d assay; it does not model 3-D structure, molecular dynamics, or DFT.',
      'It does not estimate or claim a numeric universal phic.',
      'Pulse suggestions are conservative graph-derived candidates, not experimental operating instructions.',
    ],
    input: { rows, columns, sigmaMatrix, thresholds },
    phiGrid,
    sweep: thresholds.map((threshold) => assayThreshold(phiGrid, threshold)),
  };
}

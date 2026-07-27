export interface RelationCell { readonly subject: unknown; readonly object: unknown }
export interface RelationGraph {
  readonly profile: "org.emsenn.obsmetrologia.finite-relational-graph.v1";
  readonly terms: readonly string[];
  readonly weights: readonly (readonly number[])[];
}
export interface HodgeDecomposition { readonly edges: number; readonly exact: number; readonly harmonic: number }
export function relationGraphOfCells(cells: readonly RelationCell[]): RelationGraph;
export function relationGraphOfNormalizedEdges(vertices: readonly string[], edges: readonly (readonly [string, string])[]): RelationGraph;
export function laplacianOf(graph: RelationGraph): readonly (readonly number[])[];
export function componentCount(graph: RelationGraph): number;
export function componentIndices(graph: RelationGraph): readonly (readonly number[])[];
export function treeCount(graph: RelationGraph): bigint;
export function safeCount(value: number | bigint, where?: string): number;
export function hodgeDecomposition(graph: RelationGraph, components?: number): HodgeDecomposition;

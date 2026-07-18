import Obsmetrologia.Cohomology.LandauerEntropy

namespace MathematicalReadoutExchange.Conformance

open Obsmetrologia.Cohomology
open Obsmetrologia.Landauer

def isolatedVertex : CoverNerve where
  entities := 1
  cells := 0
  components := 1
  components_le_entities := by omega
  entities_le_cells_add_components := by omega

def triangle : CoverNerve where
  entities := 3
  cells := 3
  components := 1
  components_le_entities := by omega
  entities_le_cells_add_components := by omega

def disconnectedCycles : CoverNerve where
  entities := 6
  cells := 7
  components := 2
  components_le_entities := by omega
  entities_le_cells_add_components := by omega

example : isolatedVertex.H0rank = 1 := by native_decide
example : isolatedVertex.H1rank = 0 := by native_decide
example : landauerBits isolatedVertex = 0 := by native_decide

example : triangle.H0rank = 1 := by native_decide
example : triangle.H1rank = 1 := by native_decide
example : landauerBits triangle = 1 := by native_decide

example : disconnectedCycles.H0rank = 2 := by native_decide
example : disconnectedCycles.H1rank = 3 := by native_decide
example : landauerBits disconnectedCycles = 3 := by native_decide

end MathematicalReadoutExchange.Conformance

import { readFileSync } from "node:fs";

import { compileRmlLaw } from "@emsenn/rmn-semantic-conformance-die/law";

export const COVER_NERVE_READOUT_LAW = compileRmlLaw(
  readFileSync(new URL("../content/contracts/cover-nerve-readout.rml", import.meta.url), "utf8"),
);

export const COVER_NERVE_READOUT_CONTRACT = COVER_NERVE_READOUT_LAW.id;

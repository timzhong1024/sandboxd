import type { SystemdUnitRecord } from "@sandboxd/core";

export interface SystemdRuntimePort {
  listUnits(): Promise<SystemdUnitRecord[]>;
}

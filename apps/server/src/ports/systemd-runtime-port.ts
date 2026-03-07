import type { SystemdUnitDetailRecord, SystemdUnitRecord } from "@sandboxd/core";

export interface SystemdRuntimePort {
  listUnits(): Promise<SystemdUnitRecord[]>;
  getUnit(unitName: string): Promise<SystemdUnitDetailRecord | null>;
  startUnit(unitName: string): Promise<void>;
  stopUnit(unitName: string): Promise<void>;
  restartUnit(unitName: string): Promise<void>;
}

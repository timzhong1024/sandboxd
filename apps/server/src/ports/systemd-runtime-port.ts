import type {
  CreateSandboxServiceInput,
  SystemdUnitDetailRecord,
  SystemdUnitRecord,
} from "@sandboxd/core";

export interface SystemdRuntimePort {
  createSandboxService(unitName: string, input: CreateSandboxServiceInput): Promise<void>;
  listUnits(): Promise<SystemdUnitRecord[]>;
  getUnit(unitName: string): Promise<SystemdUnitDetailRecord | null>;
  startUnit(unitName: string): Promise<void>;
  stopUnit(unitName: string): Promise<void>;
  restartUnit(unitName: string): Promise<void>;
}

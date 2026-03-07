import { z } from "zod";

export const managedEntityKindSchema = z.enum([
  "systemd-unit",
  "sandbox-service",
  "container",
  "vm",
]);

export const managedEntityOriginSchema = z.enum(["external", "sandboxd"]);

export const managedEntityCapabilitiesSchema = z.object({
  canInspect: z.boolean(),
  canStart: z.boolean(),
  canStop: z.boolean(),
  canRestart: z.boolean(),
});

export const managedEntitySummarySchema = z.object({
  kind: managedEntityKindSchema,
  origin: managedEntityOriginSchema,
  unitName: z.string(),
  unitType: z.string(),
  state: z.string(),
  subState: z.string().optional(),
  loadState: z.string().optional(),
  slice: z.string().optional(),
  description: z.string().optional(),
  sandboxProfile: z.string().optional(),
  labels: z.record(z.string(), z.string()),
  capabilities: managedEntityCapabilitiesSchema,
});

export const resourceControlsSchema = z.object({
  cpuWeight: z.string().optional(),
  memoryMax: z.string().optional(),
  tasksMax: z.string().optional(),
});

export const sandboxingSchema = z.object({
  noNewPrivileges: z.boolean().optional(),
  privateTmp: z.boolean().optional(),
  protectSystem: z.string().optional(),
  protectHome: z.boolean().optional(),
});

export const managedEntityStatusSchema = z.object({
  activeState: z.string(),
  subState: z.string(),
  loadState: z.string(),
});

export const managedEntityDetailSchema = managedEntitySummarySchema.extend({
  resourceControls: resourceControlsSchema,
  sandboxing: sandboxingSchema,
  status: managedEntityStatusSchema,
});

export const createSandboxServiceInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  execStart: z.string().min(1),
  workingDirectory: z.string().optional(),
  environment: z.record(z.string(), z.string()).optional(),
  slice: z.string().optional(),
  sandboxProfile: z.string().optional(),
  resourceControls: resourceControlsSchema.optional(),
  sandboxing: sandboxingSchema.optional(),
});

export const dangerousAdoptManagedEntityInputSchema = z.object({
  sandboxProfile: z.string().optional(),
});

export const managedEntitySummariesSchema = z.array(managedEntitySummarySchema);

export const systemdUnitRecordSchema = z.object({
  unitName: z.string(),
  loadState: z.string(),
  activeState: z.string(),
  subState: z.string(),
  description: z.string(),
  slice: z.string().optional(),
});

export const systemdUnitDetailRecordSchema = systemdUnitRecordSchema.extend({
  fragmentPath: z.string().optional(),
  unitFileState: z.string().optional(),
  resourceControls: resourceControlsSchema.optional(),
  sandboxing: sandboxingSchema.optional(),
});

export const systemdUnitRecordsSchema = z.array(systemdUnitRecordSchema);

export type ManagedEntityKind = z.infer<typeof managedEntityKindSchema>;
export type ManagedEntityOrigin = z.infer<typeof managedEntityOriginSchema>;
export type ManagedEntityCapabilities = z.infer<typeof managedEntityCapabilitiesSchema>;
export type ManagedEntitySummary = z.infer<typeof managedEntitySummarySchema>;
export type ManagedEntityDetail = z.infer<typeof managedEntityDetailSchema>;
export type ManagedEntityStatus = z.infer<typeof managedEntityStatusSchema>;
export type ResourceControls = z.infer<typeof resourceControlsSchema>;
export type Sandboxing = z.infer<typeof sandboxingSchema>;
export type CreateSandboxServiceInput = z.infer<typeof createSandboxServiceInputSchema>;
export type DangerousAdoptManagedEntityInput = z.infer<
  typeof dangerousAdoptManagedEntityInputSchema
>;
export type SystemdUnitRecord = z.infer<typeof systemdUnitRecordSchema>;
export type SystemdUnitDetailRecord = z.infer<typeof systemdUnitDetailRecordSchema>;

export function isSandboxdManaged(entity: ManagedEntitySummary | ManagedEntityDetail) {
  return entity.origin === "sandboxd";
}

export function getUnitType(unitName: string) {
  const separatorIndex = unitName.lastIndexOf(".");
  if (separatorIndex === -1 || separatorIndex === unitName.length - 1) {
    return "unknown";
  }

  return unitName.slice(separatorIndex + 1);
}

export function getManagedEntityCapabilities(
  entity: Pick<ManagedEntitySummary, "origin" | "state">,
): ManagedEntityCapabilities {
  const sandboxdManaged = entity.origin === "sandboxd";
  const active = entity.state === "active";

  return {
    canInspect: true,
    canStart: sandboxdManaged && !active,
    canStop: sandboxdManaged && active,
    canRestart: sandboxdManaged && active,
  };
}

export function mapSystemdUnitRecord(record: SystemdUnitRecord): ManagedEntitySummary {
  const summary: ManagedEntitySummary = {
    kind: "systemd-unit",
    origin: "external",
    unitName: record.unitName,
    unitType: getUnitType(record.unitName),
    state: record.activeState,
    subState: record.subState,
    loadState: record.loadState,
    slice: record.slice,
    description: record.description,
    labels: {},
    capabilities: getManagedEntityCapabilities({
      origin: "external",
      state: record.activeState,
    }),
  };

  return summary;
}

export function mapSystemdUnitDetailRecord(record: SystemdUnitDetailRecord): ManagedEntityDetail {
  const summary = mapSystemdUnitRecord(record);

  return {
    ...summary,
    resourceControls: record.resourceControls ?? {},
    sandboxing: record.sandboxing ?? {},
    status: {
      activeState: record.activeState,
      subState: record.subState,
      loadState: record.loadState,
    },
  };
}

export function parseManagedEntitySummaries(input: unknown): ManagedEntitySummary[] {
  return managedEntitySummariesSchema.parse(input);
}

export function parseManagedEntitySummary(input: unknown): ManagedEntitySummary {
  return managedEntitySummarySchema.parse(input);
}

export function parseManagedEntityDetail(input: unknown): ManagedEntityDetail {
  return managedEntityDetailSchema.parse(input);
}

export function parseCreateSandboxServiceInput(input: unknown): CreateSandboxServiceInput {
  return createSandboxServiceInputSchema.parse(input);
}

export function parseDangerousAdoptManagedEntityInput(
  input: unknown,
): DangerousAdoptManagedEntityInput {
  return dangerousAdoptManagedEntityInputSchema.parse(input);
}

import { z } from "zod";

export const managedEntityKindSchema = z.enum([
  "systemd-unit",
  "sandbox-service",
  "container",
  "vm",
]);

export const managedEntityOriginSchema = z.enum(["external", "sandboxd"]);

export const managedEntitySchema = z.object({
  kind: managedEntityKindSchema,
  origin: managedEntityOriginSchema,
  unitName: z.string(),
  unitType: z.string(),
  state: z.string(),
  slice: z.string().optional(),
  labels: z.record(z.string(), z.string()),
  sandboxProfile: z.string().optional(),
});

export const managedEntitiesSchema = z.array(managedEntitySchema);

export const systemdUnitRecordSchema = z.object({
  unitName: z.string(),
  loadState: z.string(),
  activeState: z.string(),
  subState: z.string(),
  description: z.string(),
});

export const systemdUnitRecordsSchema = z.array(systemdUnitRecordSchema);

export type ManagedEntityKind = z.infer<typeof managedEntityKindSchema>;
export type ManagedEntityOrigin = z.infer<typeof managedEntityOriginSchema>;
export type ManagedEntity = z.infer<typeof managedEntitySchema>;
export type SystemdUnitRecord = z.infer<typeof systemdUnitRecordSchema>;

export function isSandboxdManaged(entity: ManagedEntity) {
  return entity.origin === "sandboxd";
}

export function getUnitType(unitName: string) {
  const separatorIndex = unitName.lastIndexOf(".");
  if (separatorIndex === -1 || separatorIndex === unitName.length - 1) {
    return "unknown";
  }

  return unitName.slice(separatorIndex + 1);
}

export function mapSystemdUnitRecord(record: SystemdUnitRecord): ManagedEntity {
  const managedBySandboxd =
    record.unitName.startsWith("sandboxd-") ||
    record.unitName.startsWith("lab-") ||
    record.description.toLowerCase().includes("sandboxd");

  return {
    kind: managedBySandboxd ? "sandbox-service" : "systemd-unit",
    origin: managedBySandboxd ? "sandboxd" : "external",
    unitName: record.unitName,
    unitType: getUnitType(record.unitName),
    state: record.activeState,
    labels: {
      description: record.description,
      loadState: record.loadState,
      subState: record.subState,
    },
  };
}

export function parseManagedEntities(input: unknown): ManagedEntity[] {
  return managedEntitiesSchema.parse(input);
}

export function parseManagedEntity(input: unknown): ManagedEntity {
  return managedEntitySchema.parse(input);
}

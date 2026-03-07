export type ManagedEntityKind = "systemd-unit" | "sandbox-service" | "container" | "vm";

export type ManagedEntityOrigin = "external" | "sandboxd";

export interface ManagedEntity {
  kind: ManagedEntityKind;
  origin: ManagedEntityOrigin;
  unitName: string;
  unitType: "service" | "scope" | "slice" | "socket" | "target" | "timer" | string;
  state: string;
  slice?: string;
  labels: Record<string, string>;
  sandboxProfile?: string;
}

export interface SystemdUnitRecord {
  unitName: string;
  loadState: string;
  activeState: string;
  subState: string;
  description: string;
}

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
  if (!Array.isArray(input)) {
    throw new TypeError("Managed entities payload must be an array");
  }

  return input.map(parseManagedEntity);
}

export function parseManagedEntity(input: unknown): ManagedEntity {
  if (!isRecord(input)) {
    throw new TypeError("Managed entity must be an object");
  }

  const kind = expectString(input.kind, "kind");
  const origin = expectString(input.origin, "origin");
  const unitName = expectString(input.unitName, "unitName");
  const unitType = expectString(input.unitType, "unitType");
  const state = expectString(input.state, "state");
  const labels = parseLabels(input.labels);
  const slice = parseOptionalString(input.slice, "slice");
  const sandboxProfile = parseOptionalString(input.sandboxProfile, "sandboxProfile");

  if (!isManagedEntityKind(kind)) {
    throw new TypeError(`Unsupported managed entity kind: ${kind}`);
  }

  if (!isManagedEntityOrigin(origin)) {
    throw new TypeError(`Unsupported managed entity origin: ${origin}`);
  }

  return {
    kind,
    origin,
    unitName,
    unitType,
    state,
    labels,
    ...(slice === undefined ? {} : { slice }),
    ...(sandboxProfile === undefined ? {} : { sandboxProfile }),
  };
}

function isManagedEntityKind(value: string): value is ManagedEntityKind {
  return (
    value === "systemd-unit" ||
    value === "sandbox-service" ||
    value === "container" ||
    value === "vm"
  );
}

function isManagedEntityOrigin(value: string): value is ManagedEntityOrigin {
  return value === "external" || value === "sandboxd";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Managed entity field "${field}" must be a string`);
  }

  return value;
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectString(value, field);
}

function parseLabels(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    throw new TypeError('Managed entity field "labels" must be an object');
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (typeof entryValue !== "string") {
        throw new TypeError(`Managed entity label "${key}" must be a string`);
      }

      return [key, entryValue];
    }),
  );
}

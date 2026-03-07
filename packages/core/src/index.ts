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

export function isSandboxdManaged(entity: ManagedEntity) {
  return entity.origin === "sandboxd";
}

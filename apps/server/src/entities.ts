import type { ManagedEntity } from "@sandboxd/core";

export const sampleEntities: ManagedEntity[] = [
  {
    kind: "systemd-unit",
    origin: "external",
    unitName: "docker.service",
    unitType: "service",
    state: "active",
    slice: "system.slice",
    labels: {
      source: "host",
    },
  },
  {
    kind: "sandbox-service",
    origin: "sandboxd",
    unitName: "lab-api.service",
    unitType: "service",
    state: "active",
    slice: "sandboxd.slice",
    labels: {
      profile: "strict",
      source: "sandboxd",
    },
    sandboxProfile: "strict",
  },
];

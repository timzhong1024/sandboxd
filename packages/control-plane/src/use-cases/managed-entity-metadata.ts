import {
  getManagedEntityCapabilities,
  type ManagedEntityDetail,
  type ManagedEntitySummary,
} from "@sandboxd/core";
import type { ManagedEntityMetadataRecord } from "../ports/managed-entity-metadata-source-port";

export function mergeSummaryWithMetadata(
  summary: ManagedEntitySummary,
  metadata: ManagedEntityMetadataRecord | null,
): ManagedEntitySummary {
  if (!metadata) {
    return summary;
  }

  const merged: ManagedEntitySummary = {
    ...summary,
    kind: "sandbox-service",
    origin: "sandboxd",
    slice: metadata.slice ?? summary.slice,
    description: metadata.description ?? summary.description,
    sandboxProfile: metadata.sandboxProfile ?? summary.sandboxProfile,
    resourceControls: {
      ...summary.resourceControls,
      ...metadata.resourceControls,
    },
    sandboxing: {
      ...summary.sandboxing,
      ...metadata.sandboxing,
    },
    capabilities: getManagedEntityCapabilities({
      origin: "sandboxd",
      state: summary.state,
    }),
  };

  return merged;
}

export function mergeDetailWithMetadata(
  detail: ManagedEntityDetail,
  metadata: ManagedEntityMetadataRecord | null,
): ManagedEntityDetail {
  if (!metadata) {
    return detail;
  }

  return {
    ...mergeSummaryWithMetadata(detail, metadata),
    resourceControls: {
      ...detail.resourceControls,
      ...metadata.resourceControls,
    },
    sandboxing: {
      ...detail.sandboxing,
      ...metadata.sandboxing,
    },
    advancedProperties: {
      ...detail.advancedProperties,
      ...metadata.advancedProperties,
    },
    unknownSystemdDirectives: metadata.unknownSystemdDirectives ?? detail.unknownSystemdDirectives,
    status: detail.status,
  };
}

export function createSummaryFromMetadata(
  metadata: ManagedEntityMetadataRecord,
  options: {
    description?: string;
    loadState?: string;
    state?: string;
    subState?: string;
    unitType?: string;
  } = {},
): ManagedEntitySummary {
  const state = options.state ?? "inactive";

  return {
    kind: "sandbox-service",
    origin: "sandboxd",
    unitName: metadata.unitName,
    unitType: options.unitType ?? "service",
    state,
    subState: options.subState ?? (state === "active" ? "running" : "dead"),
    loadState: options.loadState ?? "loaded",
    slice: metadata.slice,
    description: metadata.description ?? options.description,
    sandboxProfile: metadata.sandboxProfile,
    resourceControls: { ...metadata.resourceControls },
    sandboxing: { ...metadata.sandboxing },
    labels: {},
    capabilities: getManagedEntityCapabilities({
      origin: "sandboxd",
      state,
    }),
  };
}

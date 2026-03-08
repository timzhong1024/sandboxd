import {
  enrichManagedEntityDetail,
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
    resourceControls: mergeObjectPreferringPrimary(
      summary.resourceControls,
      metadata.resourceControls,
    ),
    sandboxing: mergeObjectPreferringPrimary(summary.sandboxing, metadata.sandboxing),
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
    return enrichManagedEntityDetail(detail);
  }

  return enrichManagedEntityDetail({
    ...mergeSummaryWithMetadata(detail, metadata),
    resourceControls: mergeObjectPreferringPrimary(
      detail.resourceControls,
      metadata.resourceControls,
    ),
    sandboxing: mergeObjectPreferringPrimary(detail.sandboxing, metadata.sandboxing),
    advancedProperties: mergeObjectPreferringPrimary(
      detail.advancedProperties,
      metadata.advancedProperties,
    ),
    unknownSystemdDirectives: metadata.unknownSystemdDirectives ?? detail.unknownSystemdDirectives,
    status: detail.status,
  });
}

function mergeObjectPreferringPrimary<T extends Record<string, unknown>>(
  primary: T | undefined,
  secondary: T | undefined,
): T {
  if (!primary) {
    return (secondary ?? {}) as T;
  }

  if (!secondary) {
    return primary;
  }

  const merged: Record<string, unknown> = {
    ...primary,
  };

  for (const [key, value] of Object.entries(secondary)) {
    if (merged[key] === undefined) {
      merged[key] = value;
    }
  }

  return merged as T;
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

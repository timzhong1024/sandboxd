import type { ManagedEntitySummary } from "@sandboxd/core";
import { isSandboxdManaged } from "@sandboxd/core";
import { Activity, DatabaseZap, Layers2, ScanSearch } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Panel } from "../components/ui/panel";
import { Separator } from "../components/ui/separator";
import { TooltipProvider } from "../components/ui/tooltip";
import {
  AppShell,
  AlertStrip,
  EmptyState,
  FilterBar,
  HeroSection,
  InlineHint,
  OverviewRail,
  SectionHeader,
  StatCard,
  StatusBadge,
} from "./dashboard-primitives";

interface ManagedEntitiesScreenProps {
  entities: ManagedEntitySummary[];
  error: string | null;
}

type EntityBadgeState = "active" | "inactive" | "failed" | "unknown";

function getStateTone(state: string): EntityBadgeState {
  if (state === "active" || state === "running") {
    return "active";
  }

  if (state === "inactive") {
    return "inactive";
  }

  if (state === "failed" || state === "dead") {
    return "failed";
  }

  return "unknown";
}

function getEntityIcon(kind: ManagedEntitySummary["kind"]) {
  if (kind === "sandbox-service") {
    return Layers2;
  }

  if (kind === "container" || kind === "vm") {
    return DatabaseZap;
  }

  return ScanSearch;
}

function getFilterSummary(filter: string) {
  if (filter === "managed") {
    return {
      title: "Sandboxd managed units",
      description: "Units with first-class sandboxd ownership and profile metadata.",
    };
  }

  if (filter === "external") {
    return {
      title: "External units",
      description:
        "Observed systemd entities that are present in the inventory but not owned by sandboxd.",
    };
  }

  return {
    title: "Managed entity inventory",
    description:
      "Compact cards tuned for quick triage across service state, origin, slice, and sandbox profile.",
  };
}

export function ManagedEntitiesScreen({ entities, error }: ManagedEntitiesScreenProps) {
  const sandboxdManagedCount = entities.filter(isSandboxdManaged).length;
  const externalCount = entities.length - sandboxdManagedCount;
  const activeCount = entities.filter(
    (entity) => entity.state === "active" || entity.state === "running",
  ).length;
  const profilesCount = entities.filter((entity) => entity.sandboxProfile).length;
  const [filter, setFilter] = useState("all");

  const filteredEntities = useMemo(() => {
    if (filter === "managed") {
      return entities.filter(isSandboxdManaged);
    }

    if (filter === "external") {
      return entities.filter((entity) => !isSandboxdManaged(entity));
    }

    return entities;
  }, [entities, filter]);

  const filterSummary = getFilterSummary(filter);
  const filterCounts = {
    all: entities.length,
    managed: sandboxdManagedCount,
    external: externalCount,
  };

  return (
    <TooltipProvider>
      <AppShell>
        <HeroSection />
        <OverviewRail>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Total entities"
              value={entities.length}
              detail="Full inventory returned from the control plane."
              icon="entities"
            />
            <StatCard
              label="Sandboxd managed"
              value={sandboxdManagedCount}
              detail="Units with sandboxd lifecycle ownership."
              icon="managed"
            />
            <StatCard
              label="Running now"
              value={activeCount}
              detail="Entities currently reporting active state."
              icon="running"
            />
            <StatCard
              label="Profiles attached"
              value={profilesCount}
              detail="Sandbox profiles present in current inventory."
              icon="profiles"
            />
          </div>
          <Panel tone="muted" className="flex flex-col justify-between gap-5">
            <SectionHeader
              eyebrow="Shell notes"
              title="Industrial, not hostile."
              description="The surface uses equipment cues like vent grids, narrow status LEDs, and framed modules without drifting into loud cyberpunk styling."
              meta={<StatusBadge state="active">Online composition</StatusBadge>}
            />
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              <DesignNote
                icon={<Activity className="h-4 w-4" />}
                title="Status-first hierarchy"
                body="The strongest contrast is reserved for live state and key counts."
              />
              <DesignNote
                icon={<Layers2 className="h-4 w-4" />}
                title="Hardware-like modules"
                body="Cards feel like replaceable control modules, not generic SaaS tiles."
              />
            </div>
          </Panel>
        </OverviewRail>
        {error ? <AlertStrip message={error} /> : null}
        <Panel tone="elevated" className="space-y-5">
          <SectionHeader
            eyebrow="Inventory"
            title={filterSummary.title}
            description={filterSummary.description}
            meta={
              <StatusBadge state={filteredEntities.length > 0 ? "active" : "inactive"}>
                {filteredEntities.length} visible
              </StatusBadge>
            }
          />
          <FilterBar value={filter} onValueChange={setFilter} counts={filterCounts} />
          {filteredEntities.length === 0 ? (
            <EmptyState
              title="No entities in this view"
              description="The current filter returned no units. Adjust the inventory source or choose a broader view."
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {filteredEntities.map((entity) => (
                <EntityCard key={entity.unitName} entity={entity} />
              ))}
            </ul>
          )}
        </Panel>
      </AppShell>
    </TooltipProvider>
  );
}

function DesignNote({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--color-border)] bg-black/10 p-4">
      <div className="flex items-center gap-3 text-[color:var(--color-accent)]">
        {icon}
        <h3 className="text-sm font-medium text-white">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--color-text-muted)]">{body}</p>
    </div>
  );
}

function EntityCard({ entity }: { entity: ManagedEntitySummary }) {
  const Icon = getEntityIcon(entity.kind);
  const managed = isSandboxdManaged(entity);

  return (
    <li className="list-none">
      <Panel
        density="compact"
        className="h-full rounded-[22px] border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(27,31,32,0.95),rgba(15,18,18,0.97))] transition hover:border-[color:var(--color-border-strong)]"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="rounded-[14px] border border-[color:var(--color-border)] bg-white/5 p-2 text-[color:var(--color-accent)]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-mono text-base text-white sm:text-lg">
                    {entity.unitName}
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                    {entity.slice ?? "no slice"} / {entity.unitType}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <InlineHint
                label="Entity classification"
                description="Kind is a UI-facing grouping used for iconography and layout decisions."
              >
                <StatusBadge state="unknown" led={false}>
                  {entity.kind}
                </StatusBadge>
              </InlineHint>
              <InlineHint
                label={managed ? "Sandboxd origin" : "External origin"}
                description={
                  managed
                    ? "Owned and managed directly by sandboxd."
                    : "Observed from system inventory but not managed by sandboxd."
                }
              >
                <StatusBadge state={managed ? "active" : "inactive"}>{entity.origin}</StatusBadge>
              </InlineHint>
            </div>
          </div>
          <Separator />
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetaBlock
              label="State"
              value={<StatusBadge state={getStateTone(entity.state)}>{entity.state}</StatusBadge>}
            />
            <MetaBlock label="Unit type" value={entity.unitType} />
            <MetaBlock label="Slice" value={entity.slice ?? "n/a"} />
            <MetaBlock label="Sandbox profile" value={entity.sandboxProfile ?? "n/a"} />
          </dl>
          {Object.keys(entity.labels).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(entity.labels).map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-full border border-[color:var(--color-border)] bg-black/15 px-3 py-1.5 font-mono text-xs text-[color:var(--color-text-muted)]"
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>
    </li>
  );
}

function MetaBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--color-border)] bg-black/10 px-4 py-3">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-soft)]">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-[color:var(--color-text)]">{value}</dd>
    </div>
  );
}

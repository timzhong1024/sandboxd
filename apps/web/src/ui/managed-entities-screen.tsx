import type {
  AdvancedBooleanListMode,
  AdvancedListMode,
  AdvancedPropertyGroup,
  AdvancedPropertyGroupSpec,
  AdvancedPropertySpec,
  CreateSandboxServiceInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
  UnknownSystemdDirective,
} from "@sandboxd/core";
import {
  getSupportedAdvancedPropertyGroupSpec,
  isSandboxdManaged,
  supportedAdvancedPropertySpecs,
} from "@sandboxd/core";
import {
  Activity,
  Cpu,
  ChevronDown,
  ChevronRight,
  DatabaseZap,
  Layers2,
  MemoryStick,
  Plus,
  ScanSearch,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Panel } from "../components/ui/panel";
import { Separator } from "../components/ui/separator";
import { TooltipProvider } from "../components/ui/tooltip";
import {
  AppShell,
  AlertStrip,
  EmptyState,
  FilterBar,
  HeroSection,
  InfoHintIcon,
  InlineHint,
  OverviewRail,
  SectionHeader,
  StatCard,
  StatusBadge,
} from "./dashboard-primitives";

interface ManagedEntitiesScreenProps {
  createError: string | null;
  createManagedEntity: (input: CreateSandboxServiceInput) => Promise<boolean>;
  createPending: boolean;
  detail: ManagedEntityDetail | null;
  detailError: string | null;
  detailPending: boolean;
  entities: ManagedEntitySummary[];
  error: string | null;
  selectEntity: (unitName: string) => Promise<void>;
  selectedUnitName: string | null;
  triggerEntityAction: (action: "restart" | "start" | "stop") => Promise<void>;
  updateError: string | null;
  updatePending: boolean;
}

interface CreateSandboxServiceDraft {
  cpuWeight: string;
  description: string;
  execStart: string;
  memoryMax: string;
  name: string;
  noNewPrivileges: boolean;
  privateTmp: boolean;
  protectHome: boolean;
  protectSystem: string;
  sandboxProfile: string;
  slice: string;
  tasksMax: string;
  workingDirectory: string;
}

type EntityBadgeState = "active" | "inactive" | "failed" | "unknown";
type AdvancedPropertiesMap = NonNullable<ManagedEntityDetail["advancedProperties"]>;
type AdvancedPropertyValue = AdvancedPropertiesMap[keyof AdvancedPropertiesMap];

const initialCreateDraft: CreateSandboxServiceDraft = {
  name: "",
  execStart: "",
  description: "",
  workingDirectory: "",
  slice: "sandboxd.slice",
  sandboxProfile: "baseline",
  cpuWeight: "",
  memoryMax: "",
  tasksMax: "",
  noNewPrivileges: true,
  privateTmp: true,
  protectSystem: "full",
  protectHome: false,
};

const advancedGroupOrder: AdvancedPropertyGroup[] = [
  "filesystem",
  "privilege",
  "isolation",
  "syscall",
  "network",
  "resource",
  "process",
];

const advancedGroupSpecs = advancedGroupOrder.reduce<
  Record<AdvancedPropertyGroup, AdvancedPropertyGroupSpec>
>(
  (result, group) => {
    const spec = getSupportedAdvancedPropertyGroupSpec(group);
    if (!spec) {
      throw new TypeError(`Missing advanced property group spec for ${group}`);
    }

    result[group] = spec;
    return result;
  },
  {} as Record<AdvancedPropertyGroup, AdvancedPropertyGroupSpec>,
);

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

function getEntityIdentityCopy(entity: ManagedEntitySummary) {
  const managed = isSandboxdManaged(entity);

  if (managed && entity.kind === "sandbox-service") {
    return {
      label: "Sandboxd managed service",
      description: "Managed directly by sandboxd and backed by a systemd service unit on the host.",
    };
  }

  if (managed) {
    return {
      label: "Sandboxd managed entity",
      description:
        "Owned by sandboxd. The current runtime still surfaces it through the systemd control plane.",
    };
  }

  return {
    label: "External systemd unit",
    description: "Observed from host systemd inventory but not managed by sandboxd.",
  };
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

export function ManagedEntitiesScreen({
  createError,
  createManagedEntity,
  createPending,
  detail,
  detailError,
  detailPending,
  entities,
  error,
  selectEntity,
  selectedUnitName,
  triggerEntityAction,
  updateError,
  updatePending,
}: ManagedEntitiesScreenProps) {
  const sandboxdManagedCount = entities.filter(isSandboxdManaged).length;
  const externalCount = entities.length - sandboxdManagedCount;
  const activeCount = entities.filter(
    (entity) => entity.state === "active" || entity.state === "running",
  ).length;
  const profilesCount = entities.filter((entity) => entity.sandboxProfile).length;
  const [filter, setFilter] = useState("all");
  const [createDraft, setCreateDraft] = useState<CreateSandboxServiceDraft>(initialCreateDraft);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createManagedEntity(createInputFromDraft(createDraft));
    if (created) {
      setIsCreateOpen(false);
      setCreateDraft(initialCreateDraft);
    }
  }

  function handleDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const target = event.target;
    setCreateDraft((currentDraft) => ({
      ...currentDraft,
      [target.name]:
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target.value,
    }));
  }

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
        <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
          <Panel tone="elevated" className="flex h-full flex-col gap-5">
            <div className="grid gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
                  Inventory
                </p>
                <h2 className="mt-2 max-w-[14ch] text-2xl font-semibold tracking-[-0.03em] text-white">
                  {filterSummary.title}
                </h2>
                <p className="mt-2 max-w-[30ch] text-sm leading-7 text-[color:var(--color-text-muted)]">
                  {filterSummary.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge state={filteredEntities.length > 0 ? "active" : "inactive"}>
                  {filteredEntities.length} visible
                </StatusBadge>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:border-[color:var(--color-border-strong)]"
                  onClick={() => {
                    setIsCreateOpen((currentValue) => !currentValue);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create service
                </button>
              </div>
            </div>
            <FilterBar value={filter} onValueChange={setFilter} counts={filterCounts} />
            <div className="flex grow flex-col">
              {filteredEntities.length === 0 ? (
                <EmptyState
                  title="No entities in this view"
                  description="The current filter returned no units. Adjust the inventory source or choose a broader view."
                />
              ) : (
                <ul className="grid content-start gap-3">
                  {filteredEntities.map((entity) => (
                    <EntityCard
                      key={entity.unitName}
                      entity={entity}
                      selected={entity.unitName === selectedUnitName}
                      onSelect={selectEntity}
                    />
                  ))}
                </ul>
              )}
              <div
                aria-hidden="true"
                className="mt-4 hidden grow rounded-[20px] border border-dashed border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0.005))] xl:block"
              />
            </div>
          </Panel>
          <div className="space-y-4">
            <Panel tone="elevated" className="space-y-5">
              <SectionHeader
                eyebrow="Inspect"
                title={detail ? detail.unitName : "Entity detail"}
                description="Inspect live state, sandbox posture, and action availability without leaving the inventory page."
                meta={
                  detail ? (
                    <StatusBadge state={getStateTone(detail.state)}>{detail.state}</StatusBadge>
                  ) : null
                }
              />
              {detailError ? <AlertStrip message={detailError} /> : null}
              {updateError ? <AlertStrip message={updateError} /> : null}
              {detailPending ? (
                <p className="text-sm text-[color:var(--color-text-muted)]">Loading detail…</p>
              ) : detail ? (
                <>
                  <DetailGrid detail={detail} />
                  <AdvancedModeSection
                    detail={detail}
                    enabled={isAdvancedMode}
                    onToggle={() => {
                      setIsAdvancedMode((currentValue) => !currentValue);
                    }}
                  />
                  <ActionRow
                    detail={detail}
                    pending={updatePending}
                    onTrigger={triggerEntityAction}
                  />
                </>
              ) : (
                <EmptyState
                  title="Select an entity"
                  description="Choose a unit from the inventory to inspect its runtime state and available lifecycle actions."
                />
              )}
            </Panel>
            {isCreateOpen ? (
              <Panel tone="elevated" className="space-y-5">
                <SectionHeader
                  eyebrow="Create"
                  title="New sandboxed service"
                  description="Define the minimum sandboxd-managed unit payload and create it directly from the control surface."
                  meta={<Wrench className="h-5 w-5 text-[color:var(--color-accent)]" />}
                />
                {createError ? <AlertStrip message={createError} /> : null}
                <form className="grid gap-3" onSubmit={handleCreateSubmit}>
                  <FormField
                    label="Name"
                    name="name"
                    value={createDraft.name}
                    onChange={handleDraftChange}
                  />
                  <FormField
                    label="ExecStart"
                    name="execStart"
                    value={createDraft.execStart}
                    onChange={handleDraftChange}
                  />
                  <FormField
                    label="Description"
                    name="description"
                    value={createDraft.description}
                    onChange={handleDraftChange}
                  />
                  <FormField
                    label="Working directory"
                    name="workingDirectory"
                    value={createDraft.workingDirectory}
                    onChange={handleDraftChange}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      label="Slice"
                      name="slice"
                      value={createDraft.slice}
                      onChange={handleDraftChange}
                    />
                    <SelectField
                      label="Sandbox profile"
                      name="sandboxProfile"
                      value={createDraft.sandboxProfile}
                      onChange={handleDraftChange}
                      options={[
                        { label: "baseline", value: "baseline" },
                        { label: "strict", value: "strict" },
                      ]}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField
                      label="CPUWeight"
                      name="cpuWeight"
                      value={createDraft.cpuWeight}
                      onChange={handleDraftChange}
                    />
                    <FormField
                      label="MemoryMax"
                      name="memoryMax"
                      value={createDraft.memoryMax}
                      onChange={handleDraftChange}
                    />
                    <FormField
                      label="TasksMax"
                      name="tasksMax"
                      value={createDraft.tasksMax}
                      onChange={handleDraftChange}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CheckboxField
                      checked={createDraft.noNewPrivileges}
                      label="NoNewPrivileges"
                      name="noNewPrivileges"
                      onChange={handleDraftChange}
                    />
                    <CheckboxField
                      checked={createDraft.privateTmp}
                      label="PrivateTmp"
                      name="privateTmp"
                      onChange={handleDraftChange}
                    />
                    <CheckboxField
                      checked={createDraft.protectHome}
                      label="ProtectHome"
                      name="protectHome"
                      onChange={handleDraftChange}
                    />
                    <SelectField
                      label="ProtectSystem"
                      name="protectSystem"
                      value={createDraft.protectSystem}
                      onChange={handleDraftChange}
                      options={[
                        { label: "no", value: "no" },
                        { label: "full", value: "full" },
                        { label: "strict", value: "strict" },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm text-[color:var(--color-text-muted)]"
                      onClick={() => {
                        setIsCreateOpen(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                      disabled={createPending}
                    >
                      {createPending ? "Creating…" : "Create service"}
                    </button>
                  </div>
                </form>
              </Panel>
            ) : null}
          </div>
        </section>
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

function EntityCard({
  entity,
  onSelect,
  selected,
}: {
  entity: ManagedEntitySummary;
  onSelect: (unitName: string) => Promise<void>;
  selected: boolean;
}) {
  const Icon = getEntityIcon(entity.kind);
  const identity = getEntityIdentityCopy(entity);
  const permissionToken = getEntityPermissionToken(entity);
  const resourceTokens = getEntityResourceTokens(entity);

  return (
    <li className="list-none">
      <button
        type="button"
        className="group w-full text-left"
        onClick={() => {
          void onSelect(entity.unitName);
        }}
      >
        <div className="relative rounded-[24px]">
          {selected ? (
            <>
              <div className="pointer-events-none absolute -inset-[3px] rounded-[26px] bg-[radial-gradient(circle_at_88%_14%,rgba(210,252,162,0.42),rgba(210,252,162,0.12)_18%,rgba(210,252,162,0.02)_36%,transparent_56%),radial-gradient(circle_at_86%_16%,rgba(210,252,162,0.18),transparent_38%)] opacity-95 blur-[14px]" />
              <div className="pointer-events-none absolute -inset-[1px] rounded-[25px] bg-[linear-gradient(180deg,rgba(210,252,162,0.02),rgba(210,252,162,0.01))]" />
              <div className="pointer-events-none absolute -inset-[1px] rounded-[25px] bg-[linear-gradient(135deg,rgba(210,252,162,0.16),rgba(210,252,162,0.04)_18%,rgba(210,252,162,0.01)_34%,transparent_52%)] opacity-70" />
            </>
          ) : null}
          <Panel
            density="compact"
            className="relative h-full rounded-[22px] border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(27,31,32,0.95),rgba(15,18,18,0.97))] transition hover:border-[color:var(--color-border-strong)]"
          >
            <div className="grid gap-2">
              <div className="flex items-center gap-2.5">
                <InlineHint label={identity.label} description={identity.description}>
                  <span className="rounded-[11px] border border-[color:var(--color-border)] bg-white/5 p-1.5 text-[color:var(--color-accent)] transition hover:border-[color:var(--color-border-strong)]">
                    <Icon className="h-[1.05rem] w-[1.05rem]" />
                  </span>
                </InlineHint>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-mono text-[1.05rem] leading-none text-white">
                        {entity.unitName}
                      </h3>
                    </div>
                    <InventoryStateBadge selected={selected} state={entity.state} />
                  </div>
                </div>
              </div>
              <div className="border-t border-[color:var(--color-border)]/45 pt-2">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <PermissionToken token={permissionToken} />
                  {resourceTokens.map((token) => (
                    <ResourceToken
                      key={`${entity.unitName}-${token.label}`}
                      icon={token.icon}
                      label={token.label}
                      value={token.value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </button>
    </li>
  );
}

function DetailGrid({ detail }: { detail: ManagedEntityDetail }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetaBlock
          label="State"
          value={`${detail.status.activeState} / ${detail.status.subState}`}
        />
        <MetaBlock label="Load state" value={detail.status.loadState} />
        <MetaBlock label="Unit type" value={detail.unitType} />
        <MetaBlock label="Slice" value={detail.slice ?? "n/a"} />
        <MetaBlock label="Sandbox profile" value={detail.sandboxProfile ?? "n/a"} />
        <MetaBlock label="Origin" value={detail.origin} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel density="compact" className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <ShieldCheck className="h-4 w-4 text-[color:var(--color-accent)]" />
            Sandboxing
          </div>
          <DefinitionLine
            label="NoNewPrivileges"
            value={formatBoolean(detail.sandboxing.noNewPrivileges)}
          />
          <DefinitionLine label="PrivateTmp" value={formatBoolean(detail.sandboxing.privateTmp)} />
          <DefinitionLine label="ProtectSystem" value={detail.sandboxing.protectSystem ?? "n/a"} />
          <DefinitionLine
            label="ProtectHome"
            value={formatBoolean(detail.sandboxing.protectHome)}
          />
        </Panel>
        <Panel density="compact" className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Wrench className="h-4 w-4 text-[color:var(--color-accent)]" />
            Resource controls
          </div>
          <DefinitionLine label="CPUWeight" value={detail.resourceControls.cpuWeight ?? "n/a"} />
          <DefinitionLine label="MemoryMax" value={detail.resourceControls.memoryMax ?? "n/a"} />
          <DefinitionLine label="TasksMax" value={detail.resourceControls.tasksMax ?? "n/a"} />
        </Panel>
      </div>
    </div>
  );
}

function AdvancedModeSection({
  detail,
  enabled,
  onToggle,
}: {
  detail: ManagedEntityDetail;
  enabled: boolean;
  onToggle: () => void;
}) {
  const groupedSpecs = useMemo(
    () =>
      advancedGroupOrder
        .map((group) => ({
          group,
          specs: supportedAdvancedPropertySpecs.filter((spec) => spec.group === group),
        }))
        .filter((section) => section.specs.length > 0),
    [],
  );

  return (
    <Panel density="compact" className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <ShieldCheck className="h-4 w-4 text-[color:var(--color-accent)]" />
            Advanced mode
          </div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-muted)]">
            Structured systemd property inspection driven by the shared registry. Editing stays
            disabled until validation and write-path support land.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={enabled}
          className="inline-flex items-center gap-2 self-start rounded-full border border-[color:var(--color-border)] bg-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:border-[color:var(--color-border-strong)]"
          onClick={onToggle}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition ${enabled ? "rotate-180" : ""}`} />
          {enabled ? "Hide advanced" : "Advanced mode"}
        </button>
      </div>
      {enabled ? (
        <div className="space-y-4">
          {groupedSpecs.map((section) => (
            <AdvancedGroupSection
              key={section.group}
              detail={detail}
              group={section.group}
              specs={section.specs}
            />
          ))}
          <UnknownDirectivesSection directives={detail.unknownSystemdDirectives ?? []} />
          <div className="flex flex-col gap-3 rounded-[16px] border border-[color:var(--color-border)] bg-black/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-white">Advanced changes</div>
              <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                Save and Reset stay disabled until advanced validation and write support are ready.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm text-[color:var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45"
                disabled
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function AdvancedGroupSection({
  detail,
  group,
  specs,
}: {
  detail: ManagedEntityDetail;
  group: AdvancedPropertyGroup;
  specs: AdvancedPropertySpec[];
}) {
  const openByDefault = specs.some((spec) => spec.level === "recommended");

  return (
    <details
      open={openByDefault}
      className="group relative overflow-hidden rounded-[22px] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(9,12,13,0.88),rgba(7,10,11,0.94))]"
    >
      <div className="pointer-events-none absolute inset-0 z-0 rounded-[22px] opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 rounded-[22px] bg-[linear-gradient(135deg,rgba(210,252,162,0.22),rgba(210,252,162,0.06)_18%,transparent_42%,transparent_58%,rgba(210,252,162,0.05)_82%,rgba(210,252,162,0.18))]" />
        <div className="absolute inset-px rounded-[21px] bg-[linear-gradient(180deg,rgba(9,12,13,0.96),rgba(7,10,11,0.98))]" />
      </div>
      <summary className="relative z-10 flex cursor-pointer list-none items-start justify-between gap-3 px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold tracking-[-0.03em] text-white">
              {advancedGroupSpecs[group].title}
            </div>
            <InfoHintIcon
              label={advancedGroupSpecs[group].title}
              description={advancedGroupSpecs[group].description}
            />
          </div>
          <div className="mt-2 text-sm text-[color:var(--color-text-muted)] group-open:hidden">
            {specs.length} structured properties
          </div>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[color:var(--color-text-soft)]/65 transition group-open:rotate-180" />
      </summary>
      <div className="relative z-10 grid grid-cols-1 gap-x-8 border-t border-[color:var(--color-border)] px-6 py-2 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {specs.map((spec) => (
          <AdvancedPropertyField
            key={spec.key}
            propertyValue={detail.advancedProperties?.[spec.key]}
            spec={spec}
          />
        ))}
      </div>
    </details>
  );
}

function AdvancedPropertyField({
  propertyValue,
  spec,
}: {
  propertyValue: AdvancedPropertyValue | undefined;
  spec: AdvancedPropertySpec;
}) {
  const entries = normalizePropertyEntries(propertyValue);
  const parsedEntries = entries.filter((entry) => entry.parsed !== undefined);
  const rawEntries = entries.filter((entry) => entry.raw !== undefined);
  const supportsExpandedDetail =
    spec.valueType === "path-list" ||
    spec.valueType === "environment" ||
    spec.valueType === "mode-list" ||
    rawEntries.length > 0;

  if (!supportsExpandedDetail) {
    return (
      <div className="group border-b border-[color:var(--color-border)]/60 py-3 last:border-b-0">
        <div className="-mx-2 grid grid-cols-[minmax(0,1fr)_minmax(160px,280px)] items-center gap-3 rounded-[12px] px-2 py-1.5 transition hover:bg-white/[0.025]">
          <div className="min-w-0">
            <div className="inline-flex max-w-full items-center gap-2 align-middle">
              <span
                className={`text-sm leading-tight font-medium text-white transition ${getPropertyLevelHoverTextClass(spec.level)}`}
              >
                {spec.title}
              </span>
              <InfoHintIcon
                subtle
                label={`${spec.title} · ${getPropertyLevelLabel(spec.level)}`}
                description={`${spec.description} ${getPropertyLevelDescription(spec.level)}`}
                tone={getPropertyLevelTone(spec.level)}
              />
            </div>
          </div>
          <div className="min-w-0">
            <ReadonlyPreviewSurface
              expandable={false}
              value={formatCollapsedPropertyPreview(parsedEntries, spec) || "n/a"}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <details className="group border-b border-[color:var(--color-border)]/60 py-3 last:border-b-0">
      <summary className="-mx-2 grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_minmax(160px,280px)] items-center gap-3 rounded-[12px] px-2 py-1.5 transition hover:bg-white/[0.025]">
        <div className="min-w-0">
          <div className="inline-flex max-w-full items-center gap-2 align-middle">
            <span
              className={`text-sm leading-tight font-medium text-white transition ${getPropertyLevelHoverTextClass(spec.level)}`}
            >
              {spec.title}
            </span>
            <InfoHintIcon
              subtle
              label={`${spec.title} · ${getPropertyLevelLabel(spec.level)}`}
              description={`${spec.description} ${getPropertyLevelDescription(spec.level)}`}
              tone={getPropertyLevelTone(spec.level)}
            />
            {rawEntries.length > 0 ? (
              <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-[color:var(--color-state-failed)]/85">
                raw
              </span>
            ) : null}
          </div>
        </div>
        <div className="min-w-0">
          <ReadonlyPreviewSurface expandable value={formatPropertyPreview(parsedEntries, spec)} />
        </div>
      </summary>
      <div className="mt-3 grid gap-2 border-t border-[color:var(--color-border)]/60 pt-3">
        <div className="rounded-[14px] border border-[color:var(--color-border)]/80 bg-white/[0.025] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <StructuredPropertyControl
            id={`advanced-${spec.key}`}
            parsedEntries={parsedEntries}
            spec={spec}
          />
        </div>
        {rawEntries.length > 0 ? (
          <details className="rounded-[12px] border border-amber-300/20 bg-amber-300/8 px-3 py-2">
            <summary className="cursor-pointer list-none text-xs font-medium text-[color:var(--color-state-failed)]">
              {rawEntries.length} raw entr{rawEntries.length === 1 ? "y" : "ies"}
            </summary>
            <div className="mt-2 grid gap-2">
              {rawEntries.map((entry, index) => (
                <label key={`${spec.key}-raw-${index}`} className="grid gap-1 text-sm">
                  <span className="text-xs text-[color:var(--color-text-soft)]">
                    Raw value {index + 1}
                  </span>
                  <textarea
                    className="min-h-14 rounded-[12px] border border-amber-300/25 bg-black/10 px-3 py-2 font-mono text-sm text-white outline-none"
                    disabled
                    rows={2}
                    value={entry.raw ?? ""}
                  />
                </label>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function StructuredPropertyControl({
  id,
  parsedEntries,
  spec,
}: {
  id: string;
  parsedEntries: Array<{ parsed?: unknown; raw?: string }>;
  spec: AdvancedPropertySpec;
}) {
  function wrapWithInspectOnly(control: ReactNode) {
    return <div className="min-w-0">{control}</div>;
  }

  if (spec.valueType === "boolean") {
    return wrapWithInspectOnly(
      <CheckboxField
        checked={Boolean(parsedEntries[0]?.parsed)}
        disabled
        hideLabel
        label={`${spec.title} value`}
        name={id}
        onChange={() => {}}
      />,
    );
  }

  if (spec.valueType === "enum") {
    return wrapWithInspectOnly(
      <SelectField
        compact
        disabled
        hideLabel
        label={spec.title}
        name={id}
        onChange={() => {}}
        options={buildEnumOptions(spec)}
        value={formatScalarParsedValue(parsedEntries[0]?.parsed, spec) ?? ""}
      />,
    );
  }

  if (spec.valueType === "path") {
    return wrapWithInspectOnly(
      <FormField
        compact
        disabled
        hideLabel
        label={spec.title}
        name={id}
        onChange={() => {}}
        value={formatScalarParsedValue(parsedEntries[0]?.parsed, spec) ?? ""}
      />,
    );
  }

  if (
    spec.valueType === "cpu-weight" ||
    spec.valueType === "size-limit" ||
    spec.valueType === "count-limit"
  ) {
    return wrapWithInspectOnly(
      <CompactValue value={formatScalarParsedValue(parsedEntries[0]?.parsed, spec) || "n/a"} />,
    );
  }

  if (spec.valueType === "path-list") {
    const values = parsedEntries.flatMap((entry) =>
      Array.isArray(entry.parsed) ? entry.parsed : [],
    );
    return wrapWithInspectOnly(
      <TextareaField compact disabled hideLabel label={spec.title} value={values.join("\n")} />,
    );
  }

  if (spec.valueType === "environment") {
    const mergedEnvironment = parsedEntries.reduce<Record<string, string>>((result, entry) => {
      if (entry.parsed && typeof entry.parsed === "object" && !Array.isArray(entry.parsed)) {
        Object.assign(result, entry.parsed as Record<string, string>);
      }

      return result;
    }, {});
    return wrapWithInspectOnly(
      <TextareaField
        compact
        disabled
        hideLabel
        label={spec.title}
        value={Object.entries(mergedEnvironment)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n")}
      />,
    );
  }

  if (spec.valueType === "mode-list") {
    return wrapWithInspectOnly(
      <div className="grid gap-3">
        {parsedEntries.length > 0 ? (
          parsedEntries.map((entry, index) => (
            <div
              key={`${spec.key}-mode-${index}`}
              className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]"
            >
              <SelectField
                compact
                disabled
                hideLabel
                label={`${spec.title} mode ${index + 1}`}
                name={`${id}-mode-${index}`}
                onChange={() => {}}
                options={buildModeOptions(spec)}
                value={formatModeValue(entry.parsed)}
              />
              <TextareaField
                compact
                disabled
                hideLabel
                label={`${spec.title} values ${index + 1}`}
                value={formatModeTokens(entry.parsed)}
              />
            </div>
          ))
        ) : (
          <TextareaField compact disabled hideLabel label={spec.title} value="" />
        )}
      </div>,
    );
  }

  return wrapWithInspectOnly(
    <TextareaField compact disabled hideLabel label={spec.title} value="" />,
  );
}

function CompactValue({ subdued = false, value }: { subdued?: boolean; value: string }) {
  return (
    <div
      className={`truncate rounded-[12px] border border-[color:var(--color-border)] px-3 py-1.5 text-sm ${
        subdued ? "bg-black/5 text-[color:var(--color-text)]/80" : "bg-black/10 text-white"
      }`}
    >
      {value}
    </div>
  );
}

function ReadonlyPreviewSurface({ expandable, value }: { expandable: boolean; value: string }) {
  return (
    <div className="group-open:opacity-60">
      <div
        className={`flex min-w-0 items-center justify-end gap-3 px-0 py-0.5 text-right transition ${
          expandable ? "group-hover:text-white" : ""
        }`}
      >
        <span className="min-w-0 max-w-[240px] truncate text-sm text-white/92">{value}</span>
        <ReadonlyInlineMeta />
        {expandable ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--color-text-soft)]/65 transition group-open:rotate-90" />
        ) : null}
      </div>
    </div>
  );
}

function ReadonlyInlineMeta() {
  return (
    <InlineHint
      label="Inspect only"
      description="sandboxd can inspect this property. Expandable properties open a detailed read-only view below."
    >
      <span className="cursor-help whitespace-nowrap text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-soft)]/58">
        read-only
      </span>
    </InlineHint>
  );
}

function UnknownDirectivesSection({ directives }: { directives: UnknownSystemdDirective[] }) {
  return (
    <details className="rounded-[18px] border border-[color:var(--color-border)] bg-black/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-white">Unsupported / raw directives</div>
          <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            Detected in unit files, not yet available for structured editing.
          </div>
        </div>
        <StatusBadge state={directives.length > 0 ? "failed" : "inactive"} led={false}>
          {directives.length}
        </StatusBadge>
      </summary>
      <div className="border-t border-[color:var(--color-border)] px-4 py-4">
        <p className="text-sm leading-6 text-[color:var(--color-text-muted)]">
          Detected directives stay visible here until sandboxd can structure and validate them. This
          means sandboxd has not fully taken over interactive editing for these settings yet.
        </p>
        {directives.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--color-text-soft)]">
            No unsupported directives detected.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {directives.map((directive, index) => (
              <div
                key={`${directive.key}-${directive.source}-${index}`}
                className="rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-panel-muted)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-white">{directive.key}</span>
                  <StatusBadge state="failed" led={false}>
                    {directive.source}
                  </StatusBadge>
                </div>
                <p className="mt-2 font-mono text-sm text-[color:var(--color-text-muted)]">
                  {directive.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function ActionRow({
  detail,
  onTrigger,
  pending,
}: {
  detail: ManagedEntityDetail;
  onTrigger: (action: "restart" | "start" | "stop") => Promise<void>;
  pending: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ActionButton
        disabled={!detail.capabilities.canStart || pending}
        label="Start"
        onClick={() => {
          void onTrigger("start");
        }}
      />
      <ActionButton
        disabled={!detail.capabilities.canStop || pending}
        label="Stop"
        onClick={() => {
          void onTrigger("stop");
        }}
      />
      <ActionButton
        disabled={!detail.capabilities.canRestart || pending}
        label="Restart"
        onClick={() => {
          void onTrigger("restart");
        }}
      />
    </div>
  );
}

function ActionButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-[18px] border border-[color:var(--color-border)] bg-black/10 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
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

function InventoryStateBadge({ selected, state }: { selected?: boolean; state: string }) {
  return (
    <InlineHint label="State" description={state}>
      <span
        className={`inline-flex rounded-full ${
          selected
            ? "bg-[radial-gradient(circle_at_34%_34%,rgba(210,252,162,0.24),rgba(210,252,162,0.13)_24%,rgba(210,252,162,0.05)_50%,transparent_76%)] p-[1px] shadow-[0_0_18px_rgba(210,252,162,0.16)]"
            : "p-[1px] group-hover:bg-[radial-gradient(circle_at_34%_34%,rgba(210,252,162,0.12),rgba(210,252,162,0.06)_28%,rgba(210,252,162,0.02)_54%,transparent_78%)] group-hover:shadow-[0_0_12px_rgba(210,252,162,0.08)]"
        }`}
        style={{
          transition:
            "background-image 220ms ease, box-shadow 220ms ease, opacity 220ms ease, filter 220ms ease",
        }}
      >
        <StatusBadge
          state={getStateTone(state)}
          className={`min-w-0 justify-center px-1.5 ${
            selected
              ? "opacity-100 shadow-[inset_0_1px_0_rgba(210,252,162,0.12)]"
              : "opacity-70 group-hover:opacity-90 group-hover:shadow-[inset_0_1px_0_rgba(210,252,162,0.08)]"
          }`}
          style={{
            transition: "opacity 220ms ease, box-shadow 220ms ease, filter 220ms ease",
          }}
        >
          <span className="sr-only">{state}</span>
        </StatusBadge>
      </span>
    </InlineHint>
  );
}

function PermissionToken({
  token,
}: {
  token: {
    description: string;
    label: string;
    tone: "active" | "inactive" | "unknown";
  };
}) {
  return (
    <InlineHint label="Sandbox posture" description={token.description}>
      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.035] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-white/70">
        <ShieldCheck
          className={`h-3 w-3 ${
            token.tone === "active"
              ? "text-[#a9c18f]/74"
              : token.tone === "unknown"
                ? "text-[#93a8c0]/66"
                : "text-[#8f99a3]/58"
          }`}
        />
        {token.label}
      </span>
    </InlineHint>
  );
}

function ResourceToken({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <InlineHint label={label} description={value}>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium leading-none text-white/72">
        <span className="flex h-3 w-3 shrink-0 items-center justify-center">
          <Icon
            className={`h-2.5 w-2.5 text-white/50 ${
              label === "MemoryMax"
                ? "translate-y-px"
                : label === "CPUWeight"
                  ? "h-[9px] w-[9px] translate-y-[0.5px]"
                  : ""
            }`}
          />
        </span>
        <span className="translate-y-[0.5px] tabular-nums tracking-[0.01em]">{value}</span>
      </span>
    </InlineHint>
  );
}

function getEntityPermissionToken(entity: ManagedEntitySummary) {
  if (entity.sandboxProfile) {
    return {
      label: entity.sandboxProfile,
      tone: "active" as const,
      description: `Sandbox profile mode. Current profile: ${entity.sandboxProfile}.`,
    };
  }

  const sandboxing = entity.sandboxing ?? {};
  let score = 0;

  if (sandboxing.noNewPrivileges) {
    score += 1;
  }
  if (sandboxing.privateTmp) {
    score += 1;
  }
  if (
    sandboxing.protectSystem === "full" ||
    sandboxing.protectSystem === "strict" ||
    sandboxing.protectSystem === "yes"
  ) {
    score += 1;
  }
  if (sandboxing.protectHome) {
    score += 1;
  }

  if (score >= 4) {
    return {
      label: "strong",
      tone: "active" as const,
      description:
        "Lightweight systemd sandbox posture estimate based on NoNewPrivileges, PrivateTmp, ProtectSystem, and ProtectHome.",
    };
  }

  if (score >= 2) {
    return {
      label: "moderate",
      tone: "unknown" as const,
      description:
        "Lightweight systemd sandbox posture estimate based on NoNewPrivileges, PrivateTmp, ProtectSystem, and ProtectHome.",
    };
  }

  return {
    label: "weak",
    tone: "inactive" as const,
    description: "Lightweight systemd sandbox posture estimate. This is not a full security audit.",
  };
}

function getEntityResourceTokens(entity: ManagedEntitySummary) {
  const tokens: Array<{ icon: LucideIcon; label: string; value: string }> = [];
  const resourceControls = entity.resourceControls ?? {};

  if (resourceControls.cpuWeight) {
    tokens.push({
      icon: Cpu,
      label: "CPUWeight",
      value: formatCpuWeightSummary(resourceControls.cpuWeight),
    });
  }

  if (resourceControls.memoryMax) {
    tokens.push({
      icon: MemoryStick,
      label: "MemoryMax",
      value: resourceControls.memoryMax,
    });
  }

  return tokens.slice(0, 2);
}

function formatCpuWeightSummary(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return value;
  }

  const normalized = parsed / 100;
  return `${Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(1).replace(/\\.0$/, "")}c`;
}

function DefinitionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[color:var(--color-text-soft)]">{label}</span>
      <span className="font-mono text-white">{value}</span>
    </div>
  );
}

function FormField({
  compact = false,
  disabled = false,
  hideLabel = false,
  label,
  name,
  onChange,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  label: string;
  name: string;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      {hideLabel ? null : <span className="text-[color:var(--color-text-soft)]">{label}</span>}
      <input
        aria-label={label}
        className={`rounded-[12px] border border-[color:var(--color-border)] bg-black/10 px-3 text-white outline-none focus:border-[color:var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "py-1.5 text-sm" : "py-2"}`}
        disabled={disabled}
        name={name}
        value={value}
        onChange={onChange}
      />
    </label>
  );
}

function SelectField({
  compact = false,
  disabled = false,
  hideLabel = false,
  label,
  name,
  onChange,
  options,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  label: string;
  name: string;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      {hideLabel ? null : <span className="text-[color:var(--color-text-soft)]">{label}</span>}
      <select
        aria-label={label}
        className={`rounded-[12px] border border-[color:var(--color-border)] bg-black/10 px-3 text-white outline-none focus:border-[color:var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "py-1.5 text-sm" : "py-2"}`}
        disabled={disabled}
        name={name}
        value={value}
        onChange={onChange}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  checked,
  compact = false,
  disabled = false,
  hideLabel = false,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  compact?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  label: string;
  name: string;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-[12px] border border-[color:var(--color-border)] bg-black/10 px-3 text-sm text-white disabled:opacity-60 ${compact ? "py-1.5" : "py-2"}`}
    >
      <input
        aria-label={label}
        checked={checked}
        disabled={disabled}
        name={name}
        type="checkbox"
        onChange={onChange}
      />
      {hideLabel ? null : label}
    </label>
  );
}

function TextareaField({
  compact = false,
  disabled = false,
  hideLabel = false,
  label,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  label: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      {hideLabel ? null : <span className="text-[color:var(--color-text-soft)]">{label}</span>}
      <textarea
        aria-label={label}
        className={`rounded-[12px] border border-[color:var(--color-border)] bg-black/10 px-3 py-2 font-mono text-sm text-white outline-none focus:border-[color:var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "min-h-14" : "min-h-24"}`}
        disabled={disabled}
        rows={compact ? 2 : 4}
        value={value}
        readOnly
      />
    </label>
  );
}

function getPropertyLevelLabel(level: AdvancedPropertySpec["level"]) {
  if (level === "recommended") {
    return "recommended";
  }

  if (level === "advanced") {
    return "advanced";
  }

  return "expert";
}

function getPropertyLevelDescription(level: AdvancedPropertySpec["level"]) {
  if (level === "recommended") {
    return "Recommended for most managed services.";
  }

  if (level === "advanced") {
    return "Useful for tighter hardening when the service behavior is well understood.";
  }

  return "Expert-level setting that usually needs careful validation before enabling.";
}

function getPropertyLevelTone(level: AdvancedPropertySpec["level"]) {
  if (level === "recommended") {
    return "active" as const;
  }

  if (level === "advanced") {
    return "unknown" as const;
  }

  return "failed" as const;
}

function getPropertyLevelHoverTextClass(level: AdvancedPropertySpec["level"]) {
  if (level === "recommended") {
    return "group-hover:text-[color:var(--color-state-active)]/92";
  }

  if (level === "advanced") {
    return "group-hover:text-[color:var(--color-state-unknown)]/92";
  }

  return "group-hover:text-[color:var(--color-state-failed)]/92";
}

function createInputFromDraft(draft: CreateSandboxServiceDraft): CreateSandboxServiceInput {
  return {
    name: draft.name,
    execStart: draft.execStart,
    description: draft.description || undefined,
    workingDirectory: draft.workingDirectory || undefined,
    slice: draft.slice || undefined,
    sandboxProfile: draft.sandboxProfile || undefined,
    resourceControls: {
      cpuWeight: draft.cpuWeight || undefined,
      memoryMax: draft.memoryMax || undefined,
      tasksMax: draft.tasksMax || undefined,
    },
    sandboxing: {
      noNewPrivileges: draft.noNewPrivileges,
      privateTmp: draft.privateTmp,
      protectSystem: draft.protectSystem || undefined,
      protectHome: draft.protectHome,
    },
  };
}

function formatBoolean(value: boolean | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  return value ? "yes" : "no";
}

function buildEnumOptions(spec: AdvancedPropertySpec) {
  if (spec.key === "ProtectSystem") {
    return [
      { label: "yes", value: "yes" },
      { label: "full", value: "full" },
      { label: "strict", value: "strict" },
      { label: "no", value: "no" },
    ];
  }

  if (spec.key === "ProtectHome") {
    return [
      { label: "yes", value: "yes" },
      { label: "read-only", value: "read-only" },
      { label: "tmpfs", value: "tmpfs" },
      { label: "no", value: "no" },
    ];
  }

  if (spec.key === "PrivateTmp") {
    return [
      { label: "yes", value: "yes" },
      { label: "disconnected", value: "disconnected" },
      { label: "no", value: "no" },
    ];
  }

  return [{ label: "n/a", value: "" }];
}

function buildModeOptions(spec: AdvancedPropertySpec) {
  return (spec.supportedModes ?? ["allow", "deny", "reset"]).map((mode) => ({
    label: mode,
    value: mode,
  }));
}

function normalizePropertyEntries(
  propertyValue: AdvancedPropertyValue | undefined,
): Array<{ parsed?: unknown; raw?: string }> {
  if (!propertyValue) {
    return [];
  }

  if (Array.isArray(propertyValue)) {
    return propertyValue as Array<{ parsed?: unknown; raw?: string }>;
  }

  return [propertyValue as { parsed?: unknown; raw?: string }];
}

function formatScalarParsedValue(parsed: unknown, spec: AdvancedPropertySpec) {
  if (parsed === undefined) {
    return "";
  }

  if (typeof parsed === "boolean") {
    return parsed ? "yes" : "no";
  }

  if (typeof parsed === "string") {
    return parsed;
  }

  if (spec.valueType === "cpu-weight" && parsed && typeof parsed === "object") {
    const value = parsed as { kind?: string; value?: number };
    return value.kind === "idle" ? "idle" : value.value !== undefined ? String(value.value) : "";
  }

  if (
    (spec.valueType === "size-limit" || spec.valueType === "count-limit") &&
    parsed &&
    typeof parsed === "object"
  ) {
    const value = parsed as { kind?: string; value?: string | number };
    if (value.kind === "infinity") {
      return "infinity";
    }

    if (value.kind === "percentage") {
      return `${value.value ?? ""}%`;
    }

    return value.value !== undefined ? String(value.value) : "";
  }

  return "";
}

function formatModeValue(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") {
    return "";
  }

  return (parsed as { mode?: string }).mode ?? "";
}

function formatModeTokens(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") {
    return "";
  }

  const modeValue = parsed as AdvancedListMode | AdvancedBooleanListMode;
  if (modeValue.mode === "reset") {
    return "";
  }

  if (modeValue.mode === "boolean") {
    return modeValue.value ? "yes" : "no";
  }

  return modeValue.values.join("\n");
}

function formatModeSummary(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") {
    return "";
  }

  const modeValue = parsed as AdvancedListMode | AdvancedBooleanListMode;
  if (modeValue.mode === "reset") {
    return "reset";
  }

  if (modeValue.mode === "boolean") {
    return modeValue.value ? "boolean · yes" : "boolean · no";
  }

  return `${modeValue.mode} · ${modeValue.values.length} values`;
}

function formatPropertyPreview(
  parsedEntries: Array<{ parsed?: unknown; raw?: string }>,
  spec: AdvancedPropertySpec,
) {
  if (spec.valueType === "path-list") {
    const values = parsedEntries.flatMap((entry) =>
      Array.isArray(entry.parsed) ? entry.parsed : [],
    );
    return values.length > 0 ? values.join(", ") : "n/a";
  }

  if (spec.valueType === "environment") {
    const mergedEnvironment = parsedEntries.reduce<Record<string, string>>((result, entry) => {
      if (entry.parsed && typeof entry.parsed === "object" && !Array.isArray(entry.parsed)) {
        Object.assign(result, entry.parsed as Record<string, string>);
      }
      return result;
    }, {});

    const pairs = Object.entries(mergedEnvironment).map(([key, value]) => `${key}=${value}`);
    return pairs.length > 0 ? pairs.join(", ") : "n/a";
  }

  if (spec.valueType === "mode-list") {
    const summaries = parsedEntries.map((entry) => formatModeSummary(entry.parsed)).filter(Boolean);
    return summaries.length > 0 ? summaries.join(" | ") : "n/a";
  }

  return "n/a";
}

function formatCollapsedPropertyPreview(
  parsedEntries: Array<{ parsed?: unknown; raw?: string }>,
  spec: AdvancedPropertySpec,
) {
  if (spec.valueType === "boolean") {
    return formatBoolean(parsedEntries[0]?.parsed as boolean | undefined);
  }

  if (
    spec.valueType === "enum" ||
    spec.valueType === "path" ||
    spec.valueType === "cpu-weight" ||
    spec.valueType === "size-limit" ||
    spec.valueType === "count-limit"
  ) {
    return formatScalarParsedValue(parsedEntries[0]?.parsed, spec) || "n/a";
  }

  return formatPropertyPreview(parsedEntries, spec);
}

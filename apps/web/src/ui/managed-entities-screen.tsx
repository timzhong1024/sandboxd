import type {
  CreateSandboxServiceInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
} from "@sandboxd/core";
import { isSandboxdManaged } from "@sandboxd/core";
import {
  Activity,
  DatabaseZap,
  Layers2,
  Plus,
  ScanSearch,
  ShieldCheck,
  Wrench,
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
        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Panel tone="elevated" className="space-y-5">
            <SectionHeader
              eyebrow="Inventory"
              title={filterSummary.title}
              description={filterSummary.description}
              meta={
                <div className="flex items-center gap-3">
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
                  <EntityCard
                    key={entity.unitName}
                    entity={entity}
                    selected={entity.unitName === selectedUnitName}
                    onSelect={selectEntity}
                  />
                ))}
              </ul>
            )}
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
  const managed = isSandboxdManaged(entity);

  return (
    <li className="list-none">
      <button
        type="button"
        className={`w-full text-left ${selected ? "ring-1 ring-[color:var(--color-accent)]" : ""}`}
        onClick={() => {
          void onSelect(entity.unitName);
        }}
      >
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
          </div>
        </Panel>
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

function DefinitionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[color:var(--color-text-soft)]">{label}</span>
      <span className="font-mono text-white">{value}</span>
    </div>
  );
}

function FormField({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: string;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-[color:var(--color-text-soft)]">{label}</span>
      <input
        className="rounded-[14px] border border-[color:var(--color-border)] bg-black/10 px-3 py-2 text-white outline-none focus:border-[color:var(--color-border-strong)]"
        name={name}
        value={value}
        onChange={onChange}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  onChange,
  options,
  value,
}: {
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
      <span className="text-[color:var(--color-text-soft)]">{label}</span>
      <select
        className="rounded-[14px] border border-[color:var(--color-border)] bg-black/10 px-3 py-2 text-white outline-none focus:border-[color:var(--color-border-strong)]"
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
  label,
  name,
  onChange,
}: {
  checked: boolean;
  label: string;
  name: string;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-[14px] border border-[color:var(--color-border)] bg-black/10 px-3 py-2 text-sm text-white">
      <input checked={checked} name={name} type="checkbox" onChange={onChange} />
      {label}
    </label>
  );
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

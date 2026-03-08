import { cva, type VariantProps } from "class-variance-authority";
import { Activity, Box, BoxSelect, Cpu, Gauge, ShieldCheck, Siren } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { Panel } from "../components/ui/panel";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em]",
  {
    variants: {
      state: {
        active: "border-emerald-400/20 bg-emerald-400/10 text-[color:var(--color-state-active)]",
        inactive: "border-white/10 bg-white/5 text-[color:var(--color-state-inactive)]",
        failed: "border-amber-300/20 bg-amber-300/10 text-[color:var(--color-state-failed)]",
        unknown: "border-sky-300/20 bg-sky-300/10 text-[color:var(--color-state-unknown)]",
      },
    },
    defaultVariants: {
      state: "unknown",
    },
  },
);

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    led?: boolean;
  };

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="app-bg min-h-screen px-4 py-6 text-[color:var(--color-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:gap-6">{children}</div>
    </main>
  );
}

export function HeroSection() {
  return (
    <Panel
      tone="elevated"
      className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]"
    >
      <div className="relative z-10">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--color-accent)]">
          Sandboxd Console
        </p>
        <h1 className="max-w-3xl text-4xl leading-none font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
          A homelab control surface with the feel of a compact appliance.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-text-muted)] sm:text-base">
          Matte black shells, disciplined status color, and quiet hardware details for a
          systemd-first dashboard.
        </p>
      </div>
      <div className="relative min-h-56 overflow-hidden rounded-[22px] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(24,28,29,0.94),rgba(13,15,16,0.98))] p-5">
        <div className="vent-pattern absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="bezel absolute inset-x-5 top-5 h-10 rounded-full" aria-hidden="true" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--color-text-soft)]">
              Device-grade shell
            </span>
            <span className="power-button">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HeroSpec label="Material language" value="Graphite, vented, low-gloss" />
            <HeroSpec label="Interaction style" value="Compact, tactile, legible" />
            <HeroSpec label="UI posture" value="Operations-first console" />
            <HeroSpec label="Accent discipline" value="Acid green + warm amber" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function HeroSpec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--color-border)] bg-black/10 p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-soft)]">
        {label}
      </div>
      <div className="mt-2 text-sm leading-5 text-[color:var(--color-text)]">{value}</div>
    </div>
  );
}

export function OverviewRail({ children }: { children: ReactNode }) {
  return <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">{children}</section>;
}

export function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: "entities" | "managed" | "running" | "profiles";
}) {
  const Icon = {
    entities: Box,
    managed: ShieldCheck,
    running: Gauge,
    profiles: BoxSelect,
  }[icon];

  return (
    <Panel density="compact" className="metric-screen">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-soft)]">
            {label}
          </div>
          <div className="mt-3 font-mono text-3xl tracking-[-0.04em] text-white sm:text-4xl">
            {value}
          </div>
          <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">{detail}</p>
        </div>
        <span className="rounded-[14px] border border-[color:var(--color-border)] bg-white/5 p-3 text-[color:var(--color-accent)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Panel>
  );
}

export function StatusBadge({
  className,
  children,
  state,
  led = true,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ state }), className)} {...props}>
      {led ? <span className="status-led" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--color-text-muted)]">
          {description}
        </p>
      </div>
      {meta ? <div className="flex items-center gap-3">{meta}</div> : null}
    </div>
  );
}

export function FilterBar({
  value,
  onValueChange,
  counts,
}: {
  value: string;
  onValueChange: (value: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="w-full">
      <TabsList aria-label="Entity filters">
        <TabsTrigger value="all">All [{counts.all}]</TabsTrigger>
        <TabsTrigger value="managed">Managed [{counts.managed}]</TabsTrigger>
        <TabsTrigger value="external">External [{counts.external}]</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-panel-muted)] px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-black/10 text-[color:var(--color-accent)]">
        <Cpu className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--color-text-muted)]">
        {description}
      </p>
    </div>
  );
}

export function InlineHint({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium text-white">{label}</div>
        <div className="mt-1 text-[color:var(--color-text-muted)]">{description}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export function InfoHintIcon({
  label,
  description,
  tone,
  subtle = false,
}: {
  label: string;
  description: string;
  tone?: "active" | "failed" | "inactive" | "unknown";
  subtle?: boolean;
}) {
  return (
    <InlineHint label={label} description={description}>
      <span
        className={`inline-flex items-center justify-center rounded-full border font-medium transition ${
          subtle
            ? tone === "active"
              ? "h-4 w-4 border-emerald-300/18 bg-emerald-300/[0.06] text-[9px] text-[color:var(--color-state-active)]/82 hover:border-emerald-300/28 hover:bg-emerald-300/[0.1] hover:text-[color:var(--color-state-active)]"
              : tone === "unknown"
                ? "h-4 w-4 border-sky-300/18 bg-sky-300/[0.06] text-[9px] text-[color:var(--color-state-unknown)]/82 hover:border-sky-300/28 hover:bg-sky-300/[0.1] hover:text-[color:var(--color-state-unknown)]"
                : tone === "failed"
                  ? "h-4 w-4 border-amber-300/18 bg-amber-300/[0.06] text-[9px] text-[color:var(--color-state-failed)]/82 hover:border-amber-300/28 hover:bg-amber-300/[0.1] hover:text-[color:var(--color-state-failed)]"
                  : "h-4 w-4 border-white/10 bg-white/[0.03] text-[9px] text-[color:var(--color-text-soft)]/72 hover:border-white/18 hover:bg-white/[0.05] hover:text-white/82"
            : tone === "active"
              ? "h-[1.2rem] w-[1.2rem] border-emerald-300/22 bg-emerald-300/[0.08] text-[10px] text-[color:var(--color-state-active)]/88 hover:border-emerald-300/32 hover:bg-emerald-300/[0.12] hover:text-[color:var(--color-state-active)]"
              : tone === "unknown"
                ? "h-[1.2rem] w-[1.2rem] border-sky-300/22 bg-sky-300/[0.08] text-[10px] text-[color:var(--color-state-unknown)]/88 hover:border-sky-300/32 hover:bg-sky-300/[0.12] hover:text-[color:var(--color-state-unknown)]"
                : tone === "failed"
                  ? "h-[1.2rem] w-[1.2rem] border-amber-300/22 bg-amber-300/[0.08] text-[10px] text-[color:var(--color-state-failed)]/88 hover:border-amber-300/32 hover:bg-amber-300/[0.12] hover:text-[color:var(--color-state-failed)]"
                  : "h-[1.2rem] w-[1.2rem] border-white/18 bg-white/[0.05] text-[10px] text-[color:var(--color-text-soft)]/88 hover:border-white/28 hover:bg-white/[0.075] hover:text-white/95"
        }`}
      >
        i
      </span>
    </InlineHint>
  );
}

export function AlertStrip({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[18px] border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm text-[color:var(--color-state-failed)]"
    >
      <Siren className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Tabs(props: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-panel-muted)] p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-w-24 items-center justify-center rounded-[12px] px-3 py-2 text-sm font-medium tracking-[0.02em] text-[color:var(--color-text-muted)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/70 data-[state=active]:bg-[linear-gradient(180deg,rgba(65,74,76,0.92),rgba(35,40,41,0.92))] data-[state=active]:text-[color:var(--color-text)] data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgba(0,0,0,0.28)]",
        className,
      )}
      {...props}
    />
  );
}

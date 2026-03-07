import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const panelVariants = cva(
  "relative overflow-hidden rounded-[24px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-panel)] shadow-[var(--shadow-panel)]",
  {
    variants: {
      tone: {
        default: "",
        muted: "bg-[color:var(--color-panel-muted)]",
        elevated:
          "bg-[linear-gradient(180deg,rgba(34,39,40,0.96),rgba(18,21,22,0.96))] shadow-[var(--shadow-elevated)]",
      },
      density: {
        comfortable: "p-5 sm:p-6",
        compact: "p-4",
      },
    },
    defaultVariants: {
      tone: "default",
      density: "comfortable",
    },
  },
);

type PanelProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof panelVariants>;

export function Panel({ className, tone, density, ...props }: PanelProps) {
  return <section className={cn(panelVariants({ tone, density }), className)} {...props} />;
}

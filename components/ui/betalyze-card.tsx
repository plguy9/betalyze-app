// components/ui/betalyze-card.tsx
import { cn } from "../../lib/utils";

type BetalyzeCardProps = React.HTMLAttributes<HTMLDivElement>;

export function BetalyzeCard({ className, ...props }: BetalyzeCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/70 p-5 shadow-[0_0_25px_rgba(0,0,0,0.35)] backdrop-blur transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/50",
        className
      )}
      {...props}
    />
  );
}
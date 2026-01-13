// components/ui/section-title.tsx
import { cn } from "../../lib/utils";

type SectionTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export function SectionTitle({ className, ...props }: SectionTitleProps) {
  return (
    <h2
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

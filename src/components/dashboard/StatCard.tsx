import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

const variantStyles = {
  default: "border-border",
  primary: "border-primary/20 stat-glow",
  success: "border-success/20",
  warning: "border-warning/20",
  destructive: "border-destructive/20",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({ title, value, subtitle, icon: Icon, variant = "default" }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 animate-fade-in", variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5", iconStyles[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

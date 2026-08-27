import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: ReactNode;
    className?: string;
}

export default function StatCard({ icon: Icon, label, value, className = "" }: StatCardProps) {
    return (
        <div className={`admin-card flex items-center gap-3 rounded-xl p-4 shadow-sm sm:gap-4 sm:p-6 ${className}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent sm:h-12 sm:w-12">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-sub sm:text-sm">{label}</p>
                <h3 className="break-words text-lg font-bold tabular-nums text-main sm:text-2xl">{value}</h3>
            </div>
        </div>
    );
}

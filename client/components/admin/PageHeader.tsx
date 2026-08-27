import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    className?: string;
}

export default function PageHeader({ title, subtitle, action, className = "" }: PageHeaderProps) {
    return (
        <div className={`mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between ${className}`}>
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-main sm:text-3xl">{title}</h1>
                {subtitle ? <p className="mt-1 text-xs text-sub sm:text-sm">{subtitle}</p> : null}
            </div>
            {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
    );
}

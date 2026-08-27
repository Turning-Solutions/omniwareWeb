import type { ReactNode } from "react";

interface ToggleProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    label?: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    /** "row": label+description on the left, switch on the right (settings-style). "inline": switch first, label beside it (form-field style). */
    layout?: "row" | "inline";
    className?: string;
}

function Switch({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
    return (
        <div
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                checked ? "bg-accent" : "bg-panel border border-border-soft"
            } ${disabled ? "opacity-60" : ""}`}
        >
            <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    checked ? "translate-x-5" : "translate-x-0"
                }`}
            />
        </div>
    );
}

export default function Toggle({
    checked,
    onChange,
    label,
    description,
    disabled = false,
    layout = "row",
    className = "",
}: ToggleProps) {
    if (layout === "inline") {
        return (
            <label className={`flex cursor-pointer select-none items-center gap-3 ${disabled ? "cursor-not-allowed" : ""} ${className}`}>
                <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={disabled}
                    onClick={() => onChange(!checked)}
                    className="shrink-0"
                >
                    <Switch checked={checked} disabled={disabled} />
                </button>
                {label ? (
                    <div>
                        <span className="block text-sm text-main">{label}</span>
                        {description ? <span className="block text-[10px] text-sub">{description}</span> : null}
                    </div>
                ) : null}
            </label>
        );
    }

    return (
        <div className={`flex items-center justify-between gap-4 ${className}`}>
            {label ? (
                <div>
                    <p className="text-sm font-medium text-main">{label}</p>
                    {description ? <p className="mt-0.5 text-sm text-sub">{description}</p> : null}
                </div>
            ) : null}
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                aria-label={typeof label === "string" ? label : undefined}
            >
                <Switch checked={checked} disabled={disabled} />
            </button>
        </div>
    );
}

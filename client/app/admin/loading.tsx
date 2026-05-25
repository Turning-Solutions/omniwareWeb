import { Loader2 } from "lucide-react";

export default function AdminLoading() {
    return (
        <div
            className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-4 py-16 sm:px-8"
            role="status"
            aria-live="polite"
            aria-label="Loading"
        >
            <Loader2 className="h-10 w-10 animate-spin text-accent" strokeWidth={2.25} aria-hidden />
            <p className="text-sm font-medium text-sub">Loading...</p>
        </div>
    );
}

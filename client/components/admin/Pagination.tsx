import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    disabled?: boolean;
    mode?: "simple" | "numbered";
    className?: string;
}

const getVisiblePages = (page: number, totalPages: number) => {
    const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
    return Array.from(pages)
        .filter((p) => p >= 1 && p <= totalPages)
        .sort((a, b) => a - b);
};

export default function Pagination({
    page,
    totalPages,
    onPageChange,
    disabled = false,
    mode = "simple",
    className = "",
}: PaginationProps) {
    const safeTotalPages = Math.max(1, totalPages || 1);

    if (mode === "numbered") {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1 || disabled}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-soft px-3 py-2 text-sm text-main disabled:opacity-50"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                </button>
                {getVisiblePages(page, safeTotalPages).map((pageNum, index, arr) => (
                    <span key={pageNum} className="inline-flex items-center gap-2">
                        {index > 0 && pageNum - arr[index - 1] > 1 ? <span className="px-1 text-sub">...</span> : null}
                        <button
                            type="button"
                            onClick={() => onPageChange(pageNum)}
                            disabled={disabled || pageNum === page}
                            className={`min-w-9 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                pageNum === page
                                    ? "border-accent bg-accent/20 text-main"
                                    : "border-border-soft text-main hover:bg-base"
                            } disabled:opacity-60`}
                        >
                            {pageNum}
                        </button>
                    </span>
                ))}
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
                    disabled={page >= safeTotalPages || disabled}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-soft px-3 py-2 text-sm text-main disabled:opacity-50"
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
            <button
                type="button"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1 || disabled}
                className="rounded bg-base px-3 py-1 text-sm text-main hover:bg-base/80 disabled:opacity-50"
            >
                Prev
            </button>
            <span className="px-3 py-1 text-sm text-sub">
                Page {page} of {safeTotalPages}
            </span>
            <button
                type="button"
                onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
                disabled={page >= safeTotalPages || disabled}
                className="rounded bg-base px-3 py-1 text-sm text-main hover:bg-base/80 disabled:opacity-50"
            >
                Next
            </button>
        </div>
    );
}

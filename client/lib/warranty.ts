export interface ExtendedWarranty {
    duration?: string;
    description?: string;
}

function parseWarrantyMonths(value?: string | null): number {
    if (!value) return 0;
    const match = value.trim().match(/(\d+(?:\.\d+)?)\s*(month|year)/i);
    if (!match) return 0;
    const amount = parseFloat(match[1]);
    if (!Number.isFinite(amount)) return 0;
    return match[2].toLowerCase().startsWith("year") ? amount * 12 : amount;
}

function formatWarrantyMonths(totalMonths: number): string {
    if (!totalMonths || totalMonths <= 0) return "";
    if (totalMonths % 12 === 0) {
        const years = totalMonths / 12;
        return `${years} Year${years === 1 ? "" : "s"}`;
    }
    if (totalMonths < 12) {
        return `${totalMonths} Month${totalMonths === 1 ? "" : "s"}`;
    }
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return `${years} Year${years === 1 ? "" : "s"} ${months} Month${months === 1 ? "" : "s"}`;
}

export function hasExtendedWarranty(extendedWarranty?: ExtendedWarranty | null): boolean {
    return Boolean(extendedWarranty?.duration && extendedWarranty.duration.trim());
}

/** Combined total (e.g. "3 Years" standard + "2 Years" extended => "5 Years"). Empty string if neither parses. */
export function getCombinedWarrantyLabel(
    warranty?: string | null,
    extendedWarranty?: ExtendedWarranty | null
): string {
    const totalMonths = parseWarrantyMonths(warranty) + parseWarrantyMonths(extendedWarranty?.duration);
    return formatWarrantyMonths(totalMonths);
}

/** "3 Years Standard + 2 Years Extended Warranty" breakdown line for the product detail page. */
export function getWarrantyBreakdownLabel(
    warranty?: string | null,
    extendedWarranty?: ExtendedWarranty | null
): string {
    const standard = warranty?.trim();
    const extended = extendedWarranty?.duration?.trim();
    if (standard && extended) return `${standard} Standard + ${extended} Extended Warranty`;
    if (extended) return `${extended} Extended Warranty`;
    return standard || "";
}

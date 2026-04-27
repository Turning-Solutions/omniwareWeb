"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { ChevronDown, Search, X, SlidersHorizontal, Check } from "lucide-react";
import { Facets } from "@/hooks/useProducts";
import {
    CATEGORY_FILTER_LAYOUT,
    type CategoryLayoutNode,
    primaryCategorySlug,
    slugifyCategoryLabel,
} from "@/lib/categoryFilterLayout";
import { normalizeSpecKey } from "@/lib/normalizeSpecKey";

interface DynamicFilterSidebarProps {
    facets: Facets;
    filters: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    setFilters: (filters: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    isOpen: boolean;
    onClose: () => void;
    /** Prefetch shop list + facets when hovering a main category row (matches click outcome). */
    onCategoryPrefetchEnter?: (facetValue: string) => void;
    /** Prefetch when hovering a subcategory row (toggle outcome vs current selection). */
    onSubcategoryPrefetchEnter?: (facetValue: string) => void;
}

/** Count active filters (excluding search/sort/page) for badge and toolbar */
export function countActiveFilters(filters: Record<string, unknown>): number {
    let n = 0;
    if (filters.category) n += 1;
    if (filters.subcategories && String(filters.subcategories).trim()) {
        n += String(filters.subcategories).split(",").filter(Boolean).length;
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) n += 1;
    if (filters.brand && String(filters.brand).trim()) n += 1;
    if (filters.spec && typeof filters.spec === "object") {
        n += Object.keys(filters.spec).length;
    }
    return n;
}

function formatPriceLkr(value: number): string {
    return `LKR ${value.toLocaleString()}`;
}

function formatFilterLabel(value: string): string {
    return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function orderOptionsSelectedFirst<T extends { value: string }>(
    items: T[],
    isSelected: (value: string) => boolean
): T[] {
    const selected: T[] = [];
    const unselected: T[] = [];

    items.forEach((item) => {
        if (isSelected(item.value)) selected.push(item);
        else unselected.push(item);
    });

    return [...selected, ...unselected];
}

function compareFilterValues(a: string, b: string): number {
    const left = a.trim();
    const right = b.trim();

    const leftNum = Number.parseFloat(left);
    const rightNum = Number.parseFloat(right);
    const bothNumericPrefix = Number.isFinite(leftNum) && Number.isFinite(rightNum);

    // Handle "3200MHz" style values in natural numeric order.
    if (bothNumericPrefix) {
        if (leftNum !== rightNum) return leftNum - rightNum;
        return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    }

    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function sortFacetOptions<T extends { value: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => compareFilterValues(a.value, b.value));
}

// Smooth expand/collapse using CSS grid row trick
function FilterSection({
    id,
    title,
    badge,
    expanded,
    onToggle,
    children,
}: {
    id: string;
    title: string;
    badge?: number;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    const hasActive = badge != null && badge > 0;
    return (
        <div className={`border-b last:border-0 transition-colors ${hasActive ? "border-accent/20" : "border-white/[0.06]"}`}>
            <button
                type="button"
                id={`filter-header-${id}`}
                aria-expanded={expanded}
                aria-controls={`filter-panel-${id}`}
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-2 py-3.5 text-left group"
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span className={`text-sm font-semibold transition-colors ${hasActive ? "text-white" : "text-zinc-200 group-hover:text-white"}`}>
                        {title}
                    </span>
                    {hasActive ? (
                        <span className="flex h-4.5 min-w-4 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold tabular-nums text-white">
                            {badge}
                        </span>
                    ) : null}
                </div>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-all duration-200 ${
                        expanded ? "rotate-180 text-zinc-400" : "text-zinc-600 group-hover:text-zinc-400"
                    }`}
                    aria-hidden
                />
            </button>
            {/* Grid trick: animates height 0→1fr smoothly */}
            <div
                id={`filter-panel-${id}`}
                role="region"
                aria-labelledby={`filter-header-${id}`}
                className="grid transition-[grid-template-rows] duration-200"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="pb-4">{children}</div>
                </div>
            </div>
        </div>
    );
}

// Custom checkbox
function FilterCheckbox({
    checked,
    onChange,
    label,
    count,
    onPrefetchPointerEnter,
}: {
    checked: boolean;
    onChange: () => void;
    label: string;
    count?: number;
    onPrefetchPointerEnter?: () => void;
}) {
    return (
        <label
            onPointerEnter={onPrefetchPointerEnter}
            className={`group flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 px-2 transition-all duration-150 ${
            checked
                ? "bg-accent/10 ring-1 ring-accent/20"
                : "hover:bg-white/[0.05] ring-1 ring-transparent"
        }`}>
            <span className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2 transition-all duration-150 ${
                checked
                    ? "border-accent bg-accent"
                    : "border-zinc-600 bg-transparent group-hover:border-zinc-400"
            }`}>
                {checked ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} /> : null}
            </span>
            <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" tabIndex={-1} />
            <span className={`min-w-0 flex-1 truncate text-sm transition-colors ${
                checked ? "font-medium text-white" : "text-zinc-300 group-hover:text-zinc-100"
            }`}>
                {label}
            </span>
            {count != null ? (
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums font-medium transition-colors ${
                    checked ? "bg-accent/20 text-accent" : "text-zinc-500"
                }`}>
                    {count}
                </span>
            ) : null}
        </label>
    );
}

// Custom radio
function FilterRadio({
    checked,
    onChange,
    onClick,
    name,
    label,
    count,
    onPrefetchPointerEnter,
}: {
    checked: boolean;
    onChange: () => void;
    onClick?: () => void;
    name: string;
    label: string;
    count?: number;
    onPrefetchPointerEnter?: () => void;
}) {
    return (
        <label
            onPointerEnter={onPrefetchPointerEnter}
            className={`group flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 px-2 transition-all duration-150 ${
            checked
                ? "bg-accent/10 ring-1 ring-accent/25"
                : "hover:bg-white/[0.05] ring-1 ring-transparent"
        }`}>
            <span className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                checked
                    ? "border-accent"
                    : "border-zinc-600 group-hover:border-zinc-400"
            }`}>
                {checked ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                ) : null}
            </span>
            <input
                type="radio"
                name={name}
                checked={checked}
                onChange={onChange}
                onClick={onClick}
                className="sr-only"
                tabIndex={-1}
            />
            <span className={`min-w-0 flex-1 truncate text-sm transition-colors ${
                checked ? "font-medium text-white" : "text-zinc-300 group-hover:text-zinc-100"
            }`}>
                {label}
            </span>
            {count != null ? (
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums font-medium transition-colors ${
                    checked ? "bg-accent/20 text-accent" : "text-zinc-500"
                }`}>
                    {count}
                </span>
            ) : null}
        </label>
    );
}

const LIST_PREVIEW = 6;

type CategoryFacet = NonNullable<Facets["categories"]>[number];

type ResolvedCategoryNode =
    | { type: "group"; id: string; label: string; depth: number; hasChildren: boolean; collapsibleAncestors: string[] }
    | { type: "category"; id: string; facet: CategoryFacet; depth: number; hasChildren: boolean; collapsibleAncestors: string[] };

function normalizeCategoryToken(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function candidateCategoryKeys(node: CategoryLayoutNode): string[] {
    const aliases = node.valueAliases?.filter(Boolean) ?? [];
    const inferred = slugifyCategoryLabel(node.label);
    return Array.from(new Set([node.label, inferred, ...aliases]));
}

/** True when the shop is narrowed beyond the default “all products” view. */
function hasNarrowingFilters(filters: Record<string, unknown>): boolean {
    if (filters.category) return true;
    return hasNonCategoryNarrowingFilters(filters);
}

/**
 * Narrowing filters excluding category alone.
 * Choosing a category should still suppress empty layout / “More” rows (same as unfiltered),
 * otherwise the API often returns every category with count 0 and the sidebar floods with zeros.
 */
function hasNonCategoryNarrowingFilters(filters: Record<string, unknown>): boolean {
    const brand = filters.brand;
    if (typeof brand === "string" && brand.trim()) return true;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) return true;
    const spec = filters.spec;
    if (spec && typeof spec === "object" && Object.keys(spec as Record<string, unknown>).length > 0) {
        return true;
    }
    const search = filters.search;
    if (typeof search === "string" && search.trim()) return true;
    if (filters.availability) return true;
    if (filters.inStock === "true") return true;
    if (filters.isFeatured === "true" || filters.isFeatured === "false") return true;
    return false;
}

/**
 * Max catalog-wide count for this layout node, from an unfiltered facet snapshot.
 * `null` = unknown (no overlapping keys in baseline) — do not hide the bucket.
 */
function maxBaselineForNode(baseline: Map<string, number> | null, node: CategoryLayoutNode): number | null {
    if (!baseline || baseline.size === 0) return null;
    let max = 0;
    let hit = false;
    for (const k of candidateCategoryKeys(node).map(normalizeCategoryToken).filter(Boolean)) {
        if (baseline.has(k)) {
            hit = true;
            max = Math.max(max, baseline.get(k)!);
        }
    }
    return hit ? max : null;
}

function maxBaselineForFacet(baseline: Map<string, number> | null, facet: CategoryFacet): number | null {
    if (!baseline || baseline.size === 0) return null;
    const keys = [
        normalizeCategoryToken(facet.value),
        normalizeCategoryToken(facet.label),
        normalizeCategoryToken(slugifyCategoryLabel(facet.value)),
        normalizeCategoryToken(slugifyCategoryLabel(facet.label)),
    ];
    let max = 0;
    let hit = false;
    for (const k of keys) {
        if (baseline.has(k)) {
            hit = true;
            max = Math.max(max, baseline.get(k)!);
        }
    }
    return hit ? max : null;
}

function normalizeSlugForMatch(slug: string): string {
    return normalizeCategoryToken(slug.trim());
}

function sumCategoryCountsInNodes(nodes: ResolvedCategoryNode[]): number {
    let sum = 0;
    for (const n of nodes) {
        if (n.type === "category") sum += n.facet.count;
    }
    return sum;
}

function segmentContainsNormalizedSlug(
    nodes: ResolvedCategoryNode[],
    slugNorm: string
): boolean {
    for (const n of nodes) {
        if (n.type !== "category") continue;
        if (
            normalizeCategoryToken(n.facet.value) === slugNorm ||
            normalizeCategoryToken(n.facet.label) === slugNorm ||
            normalizeCategoryToken(slugifyCategoryLabel(n.facet.value)) === slugNorm ||
            normalizeCategoryToken(slugifyCategoryLabel(n.facet.label)) === slugNorm
        ) {
            return true;
        }
    }
    return false;
}

/** When suppressEmptyLayoutBuckets is true, parent departments may render as a group + children only (no category row with facet.value = audio). segmentContainsNormalizedSlug then misses the parent slug — use layout root aliases to still attach subcategories. */
function layoutRootMatchesNormalizedSlug(root: CategoryLayoutNode, slugNorm: string): boolean {
    if (root.valueAliases?.some((a) => normalizeCategoryToken(a) === slugNorm)) return true;
    if (normalizeCategoryToken(slugifyCategoryLabel(root.label)) === slugNorm) return true;
    if (normalizeCategoryToken(primaryCategorySlug(root)) === slugNorm) return true;
    return false;
}

function splitLayoutRootSegment(
    nodes: ResolvedCategoryNode[],
    layoutRoot: CategoryLayoutNode
): { main: ResolvedCategoryNode | null; sub: ResolvedCategoryNode[] } {
    if (nodes.length === 0) return { main: null, sub: [] };
    const first = nodes[0];
    if (first.type === "category" && first.depth === 0 && first.collapsibleAncestors.length === 0) {
        const main: ResolvedCategoryNode = {
            ...first,
            depth: 0,
            hasChildren: nodes.length > 1,
        };
        const sub = nodes.slice(1).map((n) => ({
            ...n,
            depth: Math.max(0, n.depth - 1),
        }));
        return { main, sub };
    }
    const slug = primaryCategorySlug(layoutRoot);
    const rolledUp = sumCategoryCountsInNodes(nodes);
    const main: ResolvedCategoryNode = {
        type: "category",
        id: `cat-${slug}`,
        facet: { value: slug, label: layoutRoot.label, count: rolledUp },
        depth: 0,
        hasChildren: nodes.length > 0,
        collapsibleAncestors: [],
    };
    const sub = nodes.map((n) => ({
        ...n,
        depth: Math.max(0, n.depth - 1),
    }));
    return { main, sub };
}

type CategoryMainEntry = {
    layoutIndex: number;
    node: ResolvedCategoryNode;
};

type CategorySidebarParts = {
    mainEntries: CategoryMainEntry[];
    subForest: ResolvedCategoryNode[];
    subMode: "layout" | "more" | "none";
    activeLayoutIndex: number | null;
};

function buildCategorySidebarParts(
    categories: CategoryFacet[],
    filters: Record<string, unknown>,
    baselineCounts: Map<string, number> | null
): CategorySidebarParts {
    const suppressEmptyLayoutBuckets = !hasNonCategoryNarrowingFilters(filters);
    const normalizedFacetKeys = categories.map((facet) => {
        const keys = new Set<string>();
        keys.add(normalizeCategoryToken(facet.value));
        keys.add(normalizeCategoryToken(facet.label));
        keys.add(normalizeCategoryToken(slugifyCategoryLabel(facet.value)));
        keys.add(normalizeCategoryToken(slugifyCategoryLabel(facet.label)));
        return keys;
    });
    const used = new Set<number>();

    /**
     * Recursively resolve a layout node.
     * `ancestors` is the list of collapsible parent IDs above this node —
     * used to hide children when a parent is collapsed.
     */
    const resolveNode = (
        node: CategoryLayoutNode,
        depth: number,
        ancestors: string[]
    ): ResolvedCategoryNode[] => {
        // Passthrough: flatten children at same depth without emitting a header.
        if (node.passthrough && node.children?.length) {
            const out: ResolvedCategoryNode[] = [];
            node.children.forEach((child) => {
                out.push(...resolveNode(child, depth + 1, ancestors));
            });
            return out;
        }

        // Structural group (Internal / External, etc.): emit a header then children.
        if (node.groupOnly && node.children?.length) {
            const groupId = `group-${slugifyCategoryLabel(node.label)}-${depth}`;
            const childResults: ResolvedCategoryNode[] = [];
            node.children.forEach((child) => {
                childResults.push(...resolveNode(child, depth + 1, [...ancestors, groupId]));
            });
            return [
                {
                    type: "group",
                    id: groupId,
                    label: node.label,
                    depth,
                    hasChildren: childResults.length > 0,
                    collapsibleAncestors: ancestors,
                },
                ...childResults,
            ];
        }

        // Hide a *leaf* layout bucket when the unfiltered snapshot had zero products for it.
        // Parents with layout children must not be dropped here: products may live only on child
        // slugs (e.g. headsets) while the parent slug (e.g. audio) is absent or zero in facets.
        if (!node.children?.length && maxBaselineForNode(baselineCounts, node) === 0) {
            return [];
        }

        // ── Try to match a DB category (normal leaf / parent with optional children) ──
        let matchedIndex = -1;
        let matchedIndices: number[] = [];
        const keys = candidateCategoryKeys(node).map(normalizeCategoryToken).filter(Boolean);
        if (keys.length > 0) {
            matchedIndices = categories
                .map((facet, idx) => ({ facet, idx }))
                .filter(({ idx }) => !used.has(idx) && keys.some((k) => normalizedFacetKeys[idx].has(k)))
                .map(({ idx }) => idx);
            matchedIndex = matchedIndices.length > 0 ? matchedIndices[0] : -1;
        }

        const results: ResolvedCategoryNode[] = [];

        if (matchedIndex >= 0) {
            const isLeafNode = !node.children?.length;
            if (isLeafNode && matchedIndices.length > 1) {
                matchedIndices.forEach((idx) => used.add(idx));
                const rolledCount = matchedIndices.reduce(
                    (sum, idx) => sum + (categories[idx]?.count ?? 0),
                    0
                );
                const slug = primaryCategorySlug(node);
                const syntheticFacet: CategoryFacet = {
                    value: slug,
                    label: node.label,
                    count: rolledCount,
                };
                results.push({
                    type: "category",
                    id: `cat-${slug}`,
                    facet: syntheticFacet,
                    depth,
                    hasChildren: false,
                    collapsibleAncestors: ancestors,
                });
                return results;
            }

            used.add(matchedIndex);
            const matchedFacet = categories[matchedIndex];
            const leafAliasMatched =
                isLeafNode &&
                normalizeCategoryToken(matchedFacet.value) !== normalizeCategoryToken(primaryCategorySlug(node));
            const isEmpty = matchedFacet.count === 0;
            const catId = `cat-${matchedFacet.value}`;
            const childAncestorIds =
                suppressEmptyLayoutBuckets && isEmpty ? ancestors : [...ancestors, catId];
            const childResults: ResolvedCategoryNode[] = [];
            node.children?.forEach((child) => {
                childResults.push(...resolveNode(child, depth + 1, childAncestorIds));
            });

            if (suppressEmptyLayoutBuckets && isEmpty && !node.children?.length) {
                return [];
            }
            // Always include the matched parent row (even when empty with children) so main/sub split can show the department on the main row.
            if (suppressEmptyLayoutBuckets && isEmpty && node.children?.length) {
                results.push({
                    type: "category",
                    id: catId,
                    facet: matchedFacet,
                    depth,
                    hasChildren: childResults.length > 0,
                    collapsibleAncestors: ancestors,
                });
                results.push(...childResults);
                return results;
            }

            results.push({
                type: "category",
                id: catId,
                facet: leafAliasMatched
                    ? {
                        value: primaryCategorySlug(node),
                        label: node.label,
                        count: matchedFacet.count,
                    }
                    : matchedFacet,
                depth,
                hasChildren: childResults.length > 0,
                collapsibleAncestors: ancestors,
            });
            results.push(...childResults);
        } else if (node.children?.length) {
            const slug = keys.length > 0 ? primaryCategorySlug(node) : "";
            const groupId = `group-${slugifyCategoryLabel(node.label)}-${depth}`;
            const mb = maxBaselineForNode(baselineCounts, node);
            const catalogHasStock = mb === null || mb > 0;
            const useSyntheticParent =
                keys.length > 0 && !suppressEmptyLayoutBuckets && catalogHasStock;
            const parentCollapsibleId = useSyntheticParent ? `cat-${slug}` : groupId;
            const childResults: ResolvedCategoryNode[] = [];
            node.children.forEach((child) => {
                childResults.push(...resolveNode(child, depth + 1, [...ancestors, parentCollapsibleId]));
            });

            if (useSyntheticParent) {
                results.push({
                    type: "category",
                    id: parentCollapsibleId,
                    facet: { value: slug, label: node.label, count: 0 },
                    depth,
                    hasChildren: childResults.length > 0,
                    collapsibleAncestors: ancestors,
                });
                results.push(...childResults);
            } else if (childResults.length > 0) {
                results.push({
                    type: "group",
                    id: groupId,
                    label: node.label,
                    depth,
                    hasChildren: true,
                    collapsibleAncestors: ancestors,
                });
                results.push(...childResults);
            }
        } else if (keys.length > 0 && !node.children?.length) {
            const mb = maxBaselineForNode(baselineCounts, node);
            // Layout leaf with no facet row: show synthetic when baseline says there is stock.
            // Unfiltered shop (suppressEmptyLayoutBuckets) used to block this entirely, so child
            // rows never appeared when the API omitted child slugs from facets but baseline
            // still had counts from the unfiltered snapshot.
            const allowSynthetic =
                !suppressEmptyLayoutBuckets
                    ? mb === null || mb > 0
                    : mb !== null && mb > 0;
            if (allowSynthetic) {
                const slug = primaryCategorySlug(node);
                const count = typeof mb === "number" ? mb : 0;
                results.push({
                    type: "category",
                    id: `cat-${slug}`,
                    facet: { value: slug, label: node.label, count },
                    depth,
                    hasChildren: false,
                    collapsibleAncestors: ancestors,
                });
            }
        }

        return results;
    };

    const layoutSegments: { root: CategoryLayoutNode; nodes: ResolvedCategoryNode[] }[] = [];
    CATEGORY_FILTER_LAYOUT.forEach((node) => {
        layoutSegments.push({ root: node, nodes: resolveNode(node, 0, []) });
    });

    const mainEntries: CategoryMainEntry[] = [];
    const subsByLayoutIndex: ResolvedCategoryNode[][] = [];
    layoutSegments.forEach(({ root, nodes }, layoutIndex) => {
        const { main, sub } = splitLayoutRootSegment(nodes, root);
        if (main) {
            const summedTopLevelSubCount = sub
                .filter((n): n is Extract<ResolvedCategoryNode, { type: "category" }> => n.type === "category" && n.depth === 0)
                .reduce((sum, n) => sum + n.facet.count, 0);
            const normalizedMain =
                main.type === "category"
                    ? {
                        ...main,
                        facet: {
                            ...main.facet,
                            count: summedTopLevelSubCount > 0 ? summedTopLevelSubCount : main.facet.count,
                        },
                    }
                    : main;
            mainEntries.push({
                layoutIndex,
                node: {
                    ...normalizedMain,
                    hasChildren: sub.length > 0,
                },
            });
            subsByLayoutIndex.push(sub);
        } else {
            subsByLayoutIndex.push([]);
        }
    });

    // Anything the layout didn't claim → facets for "More" sub-mode only (not on main row).
    const unmatched = categories
        .map((facet, idx) => ({ facet, idx }))
        .filter(({ idx, facet }) => {
            if (used.has(idx)) return false;
            if (suppressEmptyLayoutBuckets && facet.count === 0) return false;
            if (baselineCounts && maxBaselineForFacet(baselineCounts, facet) === 0) return false;
            return true;
        })
        .sort((a, b) => a.facet.label.localeCompare(b.facet.label, undefined, { sensitivity: "base" }));

    const categorySlug =
        typeof filters.category === "string" && filters.category.trim()
            ? filters.category.trim()
            : "";
    const slugNorm = categorySlug ? normalizeSlugForMatch(categorySlug) : "";

    let subForest: ResolvedCategoryNode[] = [];
    let subMode: "layout" | "more" | "none" = "none";
    let activeLayoutIndex: number | null = null;

    if (slugNorm) {
        let layoutHit = -1;
        for (let i = 0; i < layoutSegments.length; i++) {
            if (
                segmentContainsNormalizedSlug(layoutSegments[i].nodes, slugNorm) ||
                layoutRootMatchesNormalizedSlug(layoutSegments[i].root, slugNorm)
            ) {
                layoutHit = i;
                break;
            }
        }
        if (layoutHit >= 0) {
            subForest = subsByLayoutIndex[layoutHit] ?? [];
            subMode = "layout";
            activeLayoutIndex = layoutHit;
        } else if (
            unmatched.some(
                ({ facet }) =>
                    normalizeSlugForMatch(facet.value) === slugNorm ||
                    normalizeSlugForMatch(facet.label) === slugNorm
            )
        ) {
            subForest = [
                {
                    type: "group",
                    id: "group-more-categories",
                    label: "More Categories",
                    depth: 0,
                    hasChildren: true,
                    collapsibleAncestors: [],
                },
                ...unmatched.map(({ facet }) => ({
                    type: "category" as const,
                    id: `cat-${facet.value}`,
                    facet,
                    depth: 1,
                    hasChildren: false,
                    collapsibleAncestors: ["group-more-categories"] as string[],
                })),
            ];
            subMode = "more";
            activeLayoutIndex = null;
        }
    }
    // No category filter: keep subMode "none" and subForest empty — subcategories only after a main row is selected.

    return { mainEntries, subForest, subMode, activeLayoutIndex };
}

export default function DynamicFilterSidebar({
    facets,
    filters,
    setFilters,
    isOpen,
    onClose,
    onCategoryPrefetchEnter,
    onSubcategoryPrefetchEnter,
}: DynamicFilterSidebarProps) {
    const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
    const [sectionSearch, setSectionSearch] = useState<Record<string, string>>({});
    const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
    /** Snapshot of category facet counts from the last unfiltered shop view (used to hide always-empty categories even under filters). */
    const [categoryBaselineCounts, setCategoryBaselineCounts] = useState<Map<string, number> | null>(null);
    const [mainCategoryBaselineByLayout, setMainCategoryBaselineByLayout] = useState<Map<number, number> | null>(null);

    useEffect(() => {
        if (hasNarrowingFilters(filters as Record<string, unknown>)) return;
        const m = new Map<string, number>();
        for (const c of facets.categories ?? []) {
            m.set(normalizeCategoryToken(c.value), c.count);
            m.set(normalizeCategoryToken(c.label), c.count);
            m.set(normalizeCategoryToken(slugifyCategoryLabel(c.value)), c.count);
            m.set(normalizeCategoryToken(slugifyCategoryLabel(c.label)), c.count);
        }
        setCategoryBaselineCounts(m);
    }, [facets.categories, filters]);

    const isCatNodeExpanded = (id: string) => !collapsedCategories[id];
    const toggleCatNode = (id: string) =>
        setCollapsedCategories((prev) => ({ ...prev, [id]: !prev[id] }));

    const activeCount = countActiveFilters(filters);

    const isSectionOpen = (key: string) => !closedSections[key];
    const toggleSection = (key: string) =>
        setClosedSections((prev) => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        if (facets.price && filters.minPrice === undefined && filters.maxPrice === undefined) {
            setPriceRange({ min: facets.price.min, max: facets.price.max });
        }
    }, [facets.price, filters.minPrice, filters.maxPrice]);

    const applyPriceFilter = () =>
        setFilters({ ...filters, minPrice: priceRange.min, maxPrice: priceRange.max });

    const resetPriceFilter = () => {
        if (!facets.price) return;
        setPriceRange({ min: facets.price.min, max: facets.price.max });
        const next = { ...filters };
        delete next.minPrice;
        delete next.maxPrice;
        setFilters(next);
    };

    const handleBrandChange = (slug: string) => {
        const brandStr = typeof filters.brand === "string" ? filters.brand : "";
        const current = brandStr ? brandStr.split(",") : [];
        const next = current.includes(slug)
            ? current.filter((b: string) => b !== slug)
            : [...current, slug];
        const updated = { ...filters, brand: next.join(",") };
        if (next.length === 0) delete updated.brand;
        setFilters(updated);
    };

    const handleSpecChange = (key: string, value: string) => {
        const currentSpec = filters.spec || {};
        const current = currentSpec[key] ? (currentSpec[key] as string).split(",") : [];
        const next = current.includes(value)
            ? current.filter((v: string) => v !== value)
            : [...current, value];
        const newSpec = { ...currentSpec };
        if (next.length > 0) newSpec[key] = next.join(",");
        else delete newSpec[key];
        const updated = { ...filters, spec: newSpec };
        if (Object.keys(newSpec).length === 0) delete updated.spec;
        setFilters(updated);
    };

    const handleCategoryChange = (value: string) => {
        const next = { ...filters, page: 1 };
        if (filters.category === value) {
            delete next.category;
            delete next.subcategories;
            delete next.brand;
            delete next.spec;
        } else {
            next.category = value;
            delete next.subcategories;
            delete next.brand;
            delete next.spec;
        }
        setFilters(next);
    };

    const selectedSubcategories = () => {
        const raw = typeof filters.subcategories === "string" ? filters.subcategories : "";
        return raw.split(",").filter(Boolean);
    };

    const isSubcategorySelected = (value: string) => selectedSubcategories().includes(value);

    const handleSubcategoryToggle = (value: string) => {
        const current = selectedSubcategories();
        const nextList = current.includes(value)
            ? current.filter((v: string) => v !== value)
            : [...current, value];
        const next = { ...filters, page: 1, subcategories: nextList.join(",") };
        if (nextList.length === 0) delete next.subcategories;
        setFilters(next);
    };

    const clearAll = () => {
        setFilters({ search: filters.search, sort: filters.sort });
        onClose();
    };

    const brandSelected = (slug: string) => {
        const b = typeof filters.brand === "string" ? filters.brand : "";
        return b.split(",").filter(Boolean).includes(slug);
    };

    const filterFacetOptions = <T extends { value: string; label?: string }>(
        items: T[],
        key: string
    ) => {
        const q = sectionSearch[key]?.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) =>
            `${item.label ?? ""} ${item.value}`.toLowerCase().includes(q)
        );
    };

    const activeFilterPills = useMemo(() => {
        const pills: { id: string; label: string; onRemove: () => void }[] = [];

        if (typeof filters.category === "string" && filters.category) {
            const lbl =
                facets.categories?.find((c) => c.value === filters.category)?.label ??
                formatFilterLabel(filters.category);
            pills.push({
                id: `cat-${filters.category}`,
                label: lbl,
                onRemove: () => {
                    const next = { ...filters };
                    delete next.category;
                    delete next.subcategories;
                    delete next.brand;
                    delete next.spec;
                    setFilters(next);
                },
            });
        }

        if (typeof filters.subcategories === "string" && filters.subcategories.trim()) {
            filters.subcategories
                .split(",")
                .filter(Boolean)
                .forEach((v: string) => {
                    const lbl =
                        facets.categories?.find((c) => c.value === v)?.label ?? formatFilterLabel(v);
                    pills.push({
                        id: `subcat-${v}`,
                        label: lbl,
                        onRemove: () => handleSubcategoryToggle(v),
                    });
                });
        }

        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            pills.push({
                id: "price",
                label: `${formatPriceLkr(Number(filters.minPrice ?? facets.price?.min ?? 0))} – ${formatPriceLkr(Number(filters.maxPrice ?? facets.price?.max ?? 0))}`,
                onRemove: resetPriceFilter,
            });
        }

        if (typeof filters.brand === "string" && filters.brand.trim()) {
            filters.brand
                .split(",")
                .filter(Boolean)
                .forEach((v: string) => {
                    const lbl =
                        facets.brands?.find((b) => b.value === v)?.label ?? formatFilterLabel(v);
                    pills.push({
                        id: `brand-${v}`,
                        label: lbl,
                        onRemove: () => handleBrandChange(v),
                    });
                });
        }

        if (filters.spec && typeof filters.spec === "object") {
            Object.entries(filters.spec).forEach(([key, raw]) => {
                if (typeof raw !== "string") return;
                raw.split(",")
                    .filter(Boolean)
                    .forEach((v) =>
                        pills.push({
                            id: `spec-${key}-${v}`,
                            label: `${formatFilterLabel(key)}: ${v}`,
                            onRemove: () => handleSpecChange(key, v),
                        })
                    );
            });
        }

        return pills;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facets.brands, facets.categories, facets.price, filters]);

    const categorySidebarParts = useMemo(
        () =>
            buildCategorySidebarParts(
                facets.categories ?? [],
                filters as Record<string, unknown>,
                categoryBaselineCounts
            ),
        [facets.categories, filters, categoryBaselineCounts]
    );

    const { mainEntries, subForest, subMode, activeLayoutIndex } = categorySidebarParts;

    useEffect(() => {
        if (hasNarrowingFilters(filters as Record<string, unknown>)) return;
        const m = new Map<number, number>();
        for (const entry of mainEntries) {
            if (entry.node.type !== "category") continue;
            m.set(entry.layoutIndex, entry.node.facet.count);
        }
        setMainCategoryBaselineByLayout(m);
    }, [mainEntries, filters]);
    const stableMainCategoryEntries = useMemo(() => {
        const mainByLayout = new Map<number, CategoryMainEntry>();
        for (const entry of mainEntries) mainByLayout.set(entry.layoutIndex, entry);

        const out: CategoryMainEntry[] = [];
        CATEGORY_FILTER_LAYOUT.forEach((layoutNode, layoutIndex) => {
            const baselineCount = maxBaselineForNode(categoryBaselineCounts, layoutNode);
            const fallback = mainByLayout.get(layoutIndex);
            const baselineMainCount = mainCategoryBaselineByLayout?.get(layoutIndex);
            const fallbackCount =
                fallback?.node.type === "category" ? fallback.node.facet.count : 0;
            // Parent rows with layout children may roll up subcategory counts in `fallbackCount`
            // (sum of visible top-level subs). Baseline snapshot can still reflect only the parent
            // facet row (e.g. `storage` count), so take the max to avoid showing a smaller parent total.
            const stableCount = Math.max(
                baselineCount ?? 0,
                baselineMainCount ?? 0,
                fallbackCount
            );
            if (stableCount <= 0) return;

            const fallbackSlug =
                fallback?.node.type === "category"
                    ? fallback.node.facet.value
                    : primaryCategorySlug(layoutNode);
            const fallbackId =
                fallback?.node.type === "category"
                    ? fallback.node.id
                    : `cat-${primaryCategorySlug(layoutNode)}`;
            const hasChildren =
                fallback?.node.type === "category"
                    ? fallback.node.hasChildren
                    : (layoutNode.children?.length ?? 0) > 0;

            out.push({
                layoutIndex,
                node: {
                    type: "category",
                    id: fallbackId,
                    facet: {
                        value: fallbackSlug,
                        label: layoutNode.label,
                        count: stableCount,
                    },
                    depth: 0,
                    hasChildren,
                    collapsibleAncestors: [],
                },
            });
        });
        return out;
    }, [mainEntries, categoryBaselineCounts, mainCategoryBaselineByLayout]);

    // Only show sub-tree nodes whose every collapsible ancestor is currently expanded.
    const visibleSubForest = useMemo(
        () =>
            subForest.filter((node) =>
                node.collapsibleAncestors.every((aid) => isCatNodeExpanded(aid))
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [subForest, collapsedCategories]
    );

    /** Stable spec section order: admin `featuredSpecKeys`, then any extras alphabetically. */
    const orderedSpecFilterEntries = useMemo((): [string, { value: string; count: number }[]][] => {
        const specs = facets.specs ?? {};
        const keys = Object.keys(specs);
        if (keys.length === 0) return [];

        const order = facets.featuredSpecKeys ?? [];
        if (!order.length) {
            return keys.sort((a, b) => a.localeCompare(b)).map((k) => [k, specs[k]!]);
        }

        const out: [string, { value: string; count: number }[]][] = [];
        const seen = new Set<string>();
        for (const fk of order) {
            const nk = normalizeSpecKey(fk);
            if (nk in specs) {
                out.push([nk, specs[nk]!]);
                seen.add(nk);
            }
        }
        for (const k of keys.sort((a, b) => a.localeCompare(b))) {
            if (!seen.has(k)) out.push([k, specs[k]!]);
        }
        return out;
    }, [facets.specs, facets.featuredSpecKeys]);

    const specActiveCount = (key: string) => {
        const v = filters.spec?.[key];
        return typeof v === "string" ? v.split(",").filter(Boolean).length : 0;
    };

    const brandsActiveCount = () => {
        const b = typeof filters.brand === "string" ? filters.brand : "";
        return b.split(",").filter(Boolean).length;
    };

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={`fixed inset-0 z-40 bg-zinc-950/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
                    isOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={onClose}
                aria-hidden
            />

            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 flex h-full w-[min(360px,92vw)] flex-col
                    border-r border-white/[0.08] bg-zinc-900/98 shadow-2xl backdrop-blur-xl
                    transition-transform duration-300 ease-out
                    lg:static lg:z-0 lg:h-auto lg:w-[17rem] lg:shrink-0 lg:translate-x-0
                    lg:rounded-2xl lg:border lg:border-white/[0.08] lg:bg-zinc-900/50
                    lg:shadow-none lg:backdrop-blur-md lg:self-start
                    ${isOpen ? "translate-x-0" : "-translate-x-full"}
                `}
            >
                {/* ── Header ── */}
                <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                        </div>
                        <span className="text-sm font-semibold text-white">Filters</span>
                        {activeCount > 0 ? (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold tabular-nums text-white shadow-sm">
                                {activeCount}
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                        {activeCount > 0 ? (
                            <button
                                type="button"
                                onClick={clearAll}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
                            >
                                Clear all
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
                            aria-label="Close filters"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ── Scrollable body (mobile only scrolls inside, desktop expands freely) ── */}
                <div className="flex-1 overflow-y-auto overscroll-contain lg:flex-none lg:overflow-visible">
                    <div className="space-y-0 px-4 pb-6">

                        {/* Active pills */}
                        {activeFilterPills.length > 0 ? (
                            <div className="mb-3 mt-3 flex flex-wrap gap-1.5">
                                {activeFilterPills.map((pill) => (
                                    <button
                                        key={pill.id}
                                        type="button"
                                        onClick={pill.onRemove}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent transition-all hover:bg-accent/20 hover:border-accent/40"
                                    >
                                        <span className="max-w-[9rem] truncate">{pill.label}</span>
                                        <X className="h-2.5 w-2.5 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {/* ── Category (always visible; empty state when no facet rows) ── */}
                        <FilterSection
                            id="categories"
                            title="Category"
                            expanded={isSectionOpen("categories")}
                            onToggle={() => toggleSection("categories")}
                        >
                            {(facets.categories?.length ?? 0) === 0 ? (
                                <p className="py-2 text-sm text-zinc-500">
                                    No categories match these filters.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="space-y-0.5">
                                        <p className="pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                                            Category
                                        </p>
                                        {stableMainCategoryEntries.map(({ layoutIndex, node }) => {
                                            if (node.type !== "category") return null;
                                            const slugMatchesMain =
                                                typeof filters.category === "string" &&
                                                filters.category === node.facet.value;
                                            const branchActive =
                                                subMode === "layout" &&
                                                activeLayoutIndex != null &&
                                                activeLayoutIndex === layoutIndex;
                                            const isChecked = Boolean(slugMatchesMain || branchActive);
                                            return (
                                                <div key={node.id} className="flex items-center">
                                                    <div className="min-w-0 flex-1">
                                                        <FilterRadio
                                                            name="categoryFilterMain"
                                                            checked={isChecked}
                                                            onChange={() => handleCategoryChange(node.facet.value)}
                                                            onClick={() => {
                                                                if (!slugMatchesMain && branchActive) {
                                                                    handleCategoryChange(node.facet.value);
                                                                    return;
                                                                }
                                                                if (slugMatchesMain) handleCategoryChange(node.facet.value);
                                                            }}
                                                            label={node.facet.label}
                                                            count={node.facet.count}
                                                            onPrefetchPointerEnter={
                                                                onCategoryPrefetchEnter
                                                                    ? () => onCategoryPrefetchEnter(node.facet.value)
                                                                    : undefined
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="space-y-0.5 border-t border-white/[0.06] pt-3">
                                        <p className="pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                                            Subcategory
                                        </p>
                                        {subMode === "none" ? (
                                            <p className="py-1 text-sm text-zinc-500">
                                                Select a category above to refine.
                                            </p>
                                        ) : subMode === "layout" && visibleSubForest.length === 0 ? (
                                            <p className="py-1 text-sm text-zinc-500">
                                                No further subcategories for this selection.
                                            </p>
                                        ) : (
                                            visibleSubForest.map((node) => {
                                                const isExpanded = isCatNodeExpanded(node.id);

                                                if (node.type === "group") {
                                                    return (
                                                        <div
                                                            key={node.id}
                                                            style={{ paddingLeft: `${node.depth * 14}px` }}
                                                            className="flex items-center gap-2 pt-3 pb-1"
                                                        >
                                                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                                                                {node.label}
                                                            </span>
                                                            <div className="h-px flex-1 bg-zinc-800" />
                                                            {node.hasChildren ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleCatNode(node.id)}
                                                                    className="shrink-0 rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
                                                                    aria-label={isExpanded ? "Collapse" : "Expand"}
                                                                >
                                                                    <ChevronDown
                                                                        className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`}
                                                                    />
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    );
                                                }

                                                const isChecked = isSubcategorySelected(node.facet.value);
                                                return (
                                                    <div
                                                        key={node.id}
                                                        style={{ marginLeft: `${node.depth * 12}px` }}
                                                        className="relative flex items-center"
                                                    >
                                                        <span
                                                            className="pointer-events-none absolute left-0 top-0 h-full border-l border-zinc-800/90"
                                                            style={{ transform: `translateX(${node.depth * 12 - 8}px)` }}
                                                            aria-hidden
                                                        />
                                                        <span
                                                            className="pointer-events-none absolute left-0 top-1/2 w-3 border-t border-zinc-800/90"
                                                            style={{ transform: `translate(${node.depth * 12 - 8}px, -50%)` }}
                                                            aria-hidden
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <FilterCheckbox
                                                                checked={isChecked}
                                                                onChange={() => handleSubcategoryToggle(node.facet.value)}
                                                                label={node.facet.label}
                                                                count={node.facet.count}
                                                                onPrefetchPointerEnter={
                                                                    onSubcategoryPrefetchEnter
                                                                        ? () => onSubcategoryPrefetchEnter(node.facet.value)
                                                                        : undefined
                                                                }
                                                            />
                                                        </div>
                                                        {node.hasChildren ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleCatNode(node.id)}
                                                                className="ml-0.5 shrink-0 rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300"
                                                                aria-label={isExpanded ? "Collapse" : "Expand"}
                                                            >
                                                                <ChevronDown
                                                                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                                                />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </FilterSection>

                        {/* ── Price ── */}
                        {(!facets.allowedFilters || facets.allowedFilters.price) && facets.price ? (
                            <FilterSection
                                id="price"
                                title="Price"
                                badge={
                                    filters.minPrice !== undefined || filters.maxPrice !== undefined
                                        ? 1
                                        : undefined
                                }
                                expanded={isSectionOpen("price")}
                                onToggle={() => toggleSection("price")}
                            >
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <label className="min-w-0 flex-1">
                                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                                Min
                                            </span>
                                            <input
                                                type="number"
                                                value={priceRange.min}
                                                min={facets.price?.min || 0}
                                                max={priceRange.max - 1}
                                                onChange={(e) =>
                                                    setPriceRange((prev) => ({
                                                        ...prev,
                                                        min: Number(e.target.value),
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm tabular-nums text-zinc-100 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                                            />
                                        </label>
                                        <label className="min-w-0 flex-1">
                                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                                Max
                                            </span>
                                            <input
                                                type="number"
                                                value={priceRange.max}
                                                min={priceRange.min + 1}
                                                max={facets.price?.max || 1000000}
                                                onChange={(e) =>
                                                    setPriceRange((prev) => ({
                                                        ...prev,
                                                        max: Number(e.target.value),
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm tabular-nums text-zinc-100 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                                            />
                                        </label>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={applyPriceFilter}
                                            className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 active:scale-[0.98]"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetPriceFilter}
                                            className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </FilterSection>
                        ) : null}

                        {/* ── Brands ── */}
                        {(!facets.allowedFilters || facets.allowedFilters.brand) &&
                        facets.brands &&
                        facets.brands.length > 0 ? (
                            <FilterSection
                                id="brands"
                                title="Brand"
                                badge={brandsActiveCount() || undefined}
                                expanded={isSectionOpen("brands")}
                                onToggle={() => toggleSection("brands")}
                            >
                                {facets.brands.length > LIST_PREVIEW ? (
                                    <div className="relative mb-2">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                                        <input
                                            type="text"
                                            autoComplete="off"
                                            value={sectionSearch.brands ?? ""}
                                            onChange={(e) =>
                                                setSectionSearch((p) => ({
                                                    ...p,
                                                    brands: e.target.value,
                                                }))
                                            }
                                            placeholder="Search brands…"
                                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 py-2 pl-8 pr-3 text-sm text-zinc-100 caret-accent placeholder:text-zinc-600 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                                        />
                                    </div>
                                ) : null}
                                <BrandList
                                    brands={filterFacetOptions(facets.brands, "brands")}
                                    brandSelected={brandSelected}
                                    handleBrandChange={handleBrandChange}
                                />
                            </FilterSection>
                        ) : null}

                        {/* ── Spec filters ── */}
                        {filters.category &&
                            orderedSpecFilterEntries.map(([key, values]) => (
                                <FilterSection
                                    key={key}
                                    id={key}
                                    title={formatFilterLabel(key)}
                                    badge={specActiveCount(key) || undefined}
                                    expanded={isSectionOpen(key)}
                                    onToggle={() => toggleSection(key)}
                                >
                                    {values.length > LIST_PREVIEW ? (
                                        <div className="relative mb-2">
                                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                                            <input
                                                type="text"
                                                autoComplete="off"
                                                value={sectionSearch[key] ?? ""}
                                                onChange={(e) =>
                                                    setSectionSearch((p) => ({
                                                        ...p,
                                                        [key]: e.target.value,
                                                    }))
                                                }
                                                placeholder={`Filter ${formatFilterLabel(key).toLowerCase()}…`}
                                                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 py-2 pl-8 pr-3 text-sm text-zinc-100 caret-accent placeholder:text-zinc-600 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
                                            />
                                        </div>
                                    ) : null}
                                    <SpecList
                                        items={filterFacetOptions(
                                            values.map((v) => ({ ...v, label: v.value })),
                                            key
                                        )}
                                        filterKey={key}
                                        filters={filters}
                                        handleSpecChange={handleSpecChange}
                                    />
                                </FilterSection>
                            ))}
                    </div>
                </div>
            </aside>
        </>
    );
}

/* ── Sub-components for option lists ── */

function BrandList({
    brands,
    brandSelected,
    handleBrandChange,
}: {
    brands: { value: string; label: string; count: number }[];
    brandSelected: (v: string) => boolean;
    handleBrandChange: (v: string) => void;
}) {
    const sortedBrands = sortFacetOptions(brands);
    const visible = orderOptionsSelectedFirst(sortedBrands, brandSelected);

    return (
        <div className="space-y-0.5">
            {visible.map((brand) => (
                <FilterCheckbox
                    key={brand.value}
                    checked={brandSelected(brand.value)}
                    onChange={() => handleBrandChange(brand.value)}
                    label={brand.label}
                    count={brand.count}
                />
            ))}
            {brands.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">No brands match.</p>
            ) : null}
        </div>
    );
}

function SpecList({
    items,
    filterKey,
    filters,
    handleSpecChange,
}: {
    items: { value: string; label: string; count: number }[];
    filterKey: string;
    filters: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    handleSpecChange: (key: string, value: string) => void;
}) {
    const isSelected = (value: string) => {
        const specVal = filters.spec?.[filterKey];
        return typeof specVal === "string" && specVal.split(",").filter(Boolean).includes(value);
    };
    const sortedItems = sortFacetOptions(items);
    const visible = sortedItems;

    return (
        <div className="space-y-0.5">
            {visible.map((item) => {
                const checked = isSelected(item.value);
                return (
                    <FilterCheckbox
                        key={item.value}
                        checked={checked}
                        onChange={() => handleSpecChange(filterKey, item.value)}
                        label={item.value}
                        count={item.count}
                    />
                );
            })}
            {items.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">No options match.</p>
            ) : null}
        </div>
    );
}

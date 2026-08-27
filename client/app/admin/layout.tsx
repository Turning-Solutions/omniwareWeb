"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Package, Settings, Filter, Tag, ShieldCheck, ExternalLink, Menu, X, FileText, Star, Handshake, FolderTree, Eye } from "lucide-react";
import AdminAuthGuard from "@/components/AdminAuthGuard";

const navGroups = [
    {
        label: "Overview",
        items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
        label: "Catalog",
        items: [
            { href: "/admin/products", label: "Products", icon: Package },
            { href: "/admin/category-manager", label: "Category Manager", icon: FolderTree },
            { href: "/admin/categories/spec-features", label: "Featured Specs", icon: Filter },
        ],
    },
    {
        label: "Sales",
        items: [
            { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
            { href: "/admin/quotes", label: "Quotations", icon: FileText },
            { href: "/admin/product-views", label: "Product Views", icon: Eye },
        ],
    },
    {
        label: "Engagement",
        items: [
            { href: "/admin/reviews", label: "Reviews", icon: Star },
            { href: "/admin/promotions", label: "Promotions", icon: Tag },
            { href: "/admin/partners", label: "Partners", icon: Handshake },
        ],
    },
    {
        label: "System",
        items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
    },
];

const navItems = navGroups.flatMap((group) => group.items);

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const safePathname = pathname ?? "";
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const isActive = (href: string) => {
        if (href === "/admin") return safePathname === "/admin";
        return safePathname.startsWith(href);
    };

    const currentSection = navItems.find((item) => isActive(item.href))?.label ?? "Admin";

    useEffect(() => {
        setMobileNavOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!mobileNavOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileNavOpen]);

    return (
        <AdminAuthGuard>
        <div className="admin-theme flex min-h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-border-soft hidden lg:block">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-main">Admin Panel</h2>
                </div>
                <nav className="mt-6 px-4 space-y-5">
                    {navGroups.map((group) => (
                        <div key={group.label}>
                            <p className="mb-1.5 px-4 text-[10px] font-semibold uppercase tracking-wider text-sub/70">
                                {group.label}
                            </p>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                                                active
                                                    ? "bg-accent/15 text-main border border-accent/30"
                                                    : "text-sub hover:bg-white/5 hover:text-main border border-transparent"
                                            }`}
                                            aria-current={active ? "page" : undefined}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
                <header className="sticky top-0 z-30 border-b border-border-soft bg-surface pt-[env(safe-area-inset-top,0px)]">
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 lg:px-8 sm:py-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                            <button
                                type="button"
                                onClick={() => setMobileNavOpen(true)}
                                className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-soft text-sub transition-colors hover:bg-white/5 hover:text-main"
                                aria-label="Open admin navigation"
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent sm:h-10 sm:w-10">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-main sm:text-base">Admin Workspace</p>
                                <p className="truncate text-xs text-sub">{currentSection}</p>
                            </div>
                        </div>
                        <Link
                            href="/"
                            aria-label="View storefront"
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border-soft p-2.5 text-sm text-sub transition-colors hover:bg-white/5 hover:text-main sm:px-3 sm:py-2"
                        >
                            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="hidden sm:inline">View Store</span>
                        </Link>
                    </div>
                </header>
                {mobileNavOpen && (
                    <div
                        className="lg:hidden fixed inset-0 z-50 bg-black/55"
                        onClick={() => setMobileNavOpen(false)}
                        aria-hidden="true"
                    />
                )}
                <aside
                    className={`lg:hidden fixed inset-y-0 left-0 z-[60] flex w-[min(88vw,20rem)] max-w-full flex-col border-r border-border-soft bg-surface pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] shadow-[4px_0_24px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out ${
                        mobileNavOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                    aria-hidden={!mobileNavOpen}
                >
                    <div className="flex items-start justify-between gap-2 border-b border-border-soft px-4 py-4">
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-main">Admin</h2>
                            <p className="text-xs text-sub">Navigation</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(false)}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-soft text-sub transition-colors hover:bg-white/5 hover:text-main"
                            aria-label="Close admin navigation"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
                        {navGroups.map((group) => (
                            <div key={group.label}>
                                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-sub/70">
                                    {group.label}
                                </p>
                                <div className="space-y-1">
                                    {group.items.map((item) => {
                                        const Icon = item.icon;
                                        const active = isActive(item.href);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex min-h-[3rem] items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors active:scale-[0.99] ${
                                                    active
                                                        ? "border-accent/30 bg-accent/15 text-main"
                                                        : "border-transparent text-sub hover:border-border-soft hover:bg-white/5 hover:text-main"
                                                }`}
                                                aria-current={active ? "page" : undefined}
                                            >
                                                <Icon className="h-5 w-5 shrink-0 opacity-90" />
                                                <span className="font-medium">{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>
                </aside>
                {children}
            </main>
        </div>
        </AdminAuthGuard>
    );
}

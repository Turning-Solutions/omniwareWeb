 "use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Package, Settings, Filter, Tag, ShieldCheck, ExternalLink, Menu, X } from "lucide-react";
import AdminAuthGuard from "@/components/AdminAuthGuard";

const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/categories/spec-features", label: "Featured Specs", icon: Filter },
    { href: "/admin/promotions", label: "Promotions", icon: Tag },
    { href: "/admin/settings", label: "Settings", icon: Settings },
];

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
                <nav className="mt-6 px-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
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
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="sticky top-0 z-30 border-b border-border-soft bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
                    <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setMobileNavOpen(true)}
                                className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-soft text-sub hover:text-main hover:bg-white/5 transition-colors"
                                aria-label="Open admin navigation"
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                            <div className="h-9 w-9 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-main">Admin Workspace</p>
                                <p className="text-xs text-sub">{currentSection}</p>
                            </div>
                        </div>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 rounded-lg border border-border-soft px-3 py-2 text-sm text-sub hover:text-main hover:bg-white/5 transition-colors"
                        >
                            View Store
                            <ExternalLink className="h-4 w-4" />
                        </Link>
                    </div>
                </header>
                <div className="lg:hidden border-b border-border-soft bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sticky top-[61px] z-20">
                    <div className="px-4 py-2.5 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-wide text-sub">Section</p>
                        <p className="text-sm font-medium text-main">{currentSection}</p>
                    </div>
                </div>
                {mobileNavOpen && (
                    <div
                        className="lg:hidden fixed inset-0 z-50 bg-black/55"
                        onClick={() => setMobileNavOpen(false)}
                        aria-hidden="true"
                    />
                )}
                <aside
                    className={`lg:hidden fixed inset-y-0 left-0 z-[60] w-[84vw] max-w-xs bg-surface border-r border-border-soft transform transition-transform duration-200 ease-out ${
                        mobileNavOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                    aria-hidden={!mobileNavOpen}
                >
                    <div className="flex items-center justify-between px-4 py-4 border-b border-border-soft">
                        <div>
                            <h2 className="text-base font-bold text-main">Admin Navigation</h2>
                            <p className="text-xs text-sub">Manage your workspace</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(false)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-soft text-sub hover:text-main hover:bg-white/5 transition-colors"
                            aria-label="Close admin navigation"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <nav className="p-3 space-y-2 overflow-y-auto h-[calc(100vh-73px)]">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm border transition-colors ${
                                        active
                                            ? "bg-accent/15 text-main border-accent/30"
                                            : "text-sub border-border-soft hover:text-main hover:bg-white/5"
                                    }`}
                                    aria-current={active ? "page" : undefined}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>
                {children}
            </main>
        </div>
        </AdminAuthGuard>
    );
}

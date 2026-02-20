import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, ShoppingBag, Package, Settings, Filter } from 'lucide-react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="admin-theme flex min-h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-border-soft hidden lg:block">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-main">Admin Panel</h2>
                </div>
                <nav className="mt-6 px-4 space-y-2">
                    <Link href="/admin" className="flex items-center space-x-3 px-4 py-3 text-sub hover:bg-white/5 hover:text-main rounded-lg transition-colors">
                        <LayoutDashboard className="w-5 h-5" />
                        <span>Dashboard</span>
                    </Link>
                    <Link href="/admin/orders" className="flex items-center space-x-3 px-4 py-3 text-sub hover:bg-white/5 hover:text-main rounded-lg transition-colors">
                        <ShoppingBag className="w-5 h-5" />
                        <span>Orders</span>
                    </Link>
                    <Link href="/admin/products" className="flex items-center space-x-3 px-4 py-3 text-sub hover:bg-white/5 hover:text-main rounded-lg transition-colors">
                        <Package className="w-5 h-5" />
                        <span>Products</span>
                    </Link>
                    <Link href="/admin/categories/spec-features" className="flex items-center space-x-3 px-4 py-3 text-sub hover:bg-white/5 hover:text-main rounded-lg transition-colors">
                        <Filter className="w-5 h-5" />
                        <span>Featured Specs</span>
                    </Link>
                    <Link href="/admin/settings" className="flex items-center space-x-3 px-4 py-3 text-sub hover:bg-white/5 hover:text-main rounded-lg transition-colors">
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

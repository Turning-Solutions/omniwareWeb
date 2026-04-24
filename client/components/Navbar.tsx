"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ShoppingCart, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";

const mainNav = [
    { href: "/shop", label: "Shop" },
    { href: "/services", label: "Services" },
    //{ href: "/pc-builder", label: "PC Builder" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
] as const;

function linkActive(pathname: string, href: string) {
    if (href === "/shop") return pathname === "/shop" || pathname.startsWith("/shop/");
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
    const pathname = usePathname();
    const currentPath = pathname ?? "/";
    const [isOpen, setIsOpen] = useState(false);
    const { cartItems } = useCart();
    const cartCount = cartItems.reduce((acc, item) => acc + item.qty, 0);

    return (
        <nav className="fixed top-0 z-50 w-full border-b border-white/[0.07] bg-zinc-950/80 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-10">
                <Link
                    href="/"
                    className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1"
                    aria-label="Omniware home"
                >
                    <Image
                        src="/Logo White.png"
                        alt="Omniware logo"
                        width={28}
                        height={28}
                        className="h-7 w-7 object-contain"
                        priority
                    />
                    <span className="text-base font-semibold uppercase tracking-wide text-white sm:text-lg">Omniware</span>
                </Link>

                <div className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex">
                    {mainNav.map(({ href, label }) => {
                        const active = linkActive(currentPath, href);
                        return (
                            <Link
                                key={`${href}-${label}`}
                                href={href}
                                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    active
                                        ? "bg-white/[0.08] text-white"
                                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                                }`}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </div>

                <div className="hidden shrink-0 items-center gap-2 md:flex">
                    <div className="flex items-center rounded-full border border-white/[0.1] bg-white/[0.04] p-0.5">
                        <Link
                            href="/cart"
                            className="relative flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                            aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
                        >
                            <ShoppingCart className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                            {cartCount > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-zinc-950">
                                    {cartCount > 99 ? "99+" : cartCount}
                                </span>
                            )}
                        </Link>
                    </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">
                    <Link
                        href="/cart"
                        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                        aria-label="Cart"
                    >
                        <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
                        {cartCount > 0 && (
                            <span className="absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-zinc-950">
                                {cartCount > 9 ? "9+" : cartCount}
                            </span>
                        )}
                    </Link>
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? "Close menu" : "Open menu"}
                    >
                        {isOpen ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/[0.07] bg-zinc-950/95 backdrop-blur-xl md:hidden"
                    >
                        <div className="mx-auto max-w-[1440px] space-y-0.5 px-3 py-3 sm:px-6">
                            {mainNav.map(({ href, label }) => {
                                const active = linkActive(currentPath, href);
                                return (
                                    <Link
                                        key={`m-${href}-${label}`}
                                        href={href}
                                        className={`block rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                                            active
                                                ? "bg-white/[0.1] text-white"
                                                : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                                        }`}
                                        onClick={() => setIsOpen(false)}
                                    >
                                        {label}
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}

"use client";

import Link from "next/link";
import { ShoppingCart, User, Menu, X, Cpu } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const { cartItems } = useCart();
    const cartCount = cartItems.reduce((acc, item) => acc + item.qty, 0);

    return (
        <nav className="fixed w-full z-50 bg-surface/95 backdrop-blur-md border-b border-border-soft">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center space-x-2">
                        <Cpu className="h-8 w-8 text-accent" />
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-main to-sub">
                            Omniware
                        </span>
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-8">
                        <Link href="/shop" className="text-sub hover:text-main transition-colors font-medium">
                            Shop
                        </Link>
                        <Link href="/services" className="text-sub hover:text-main transition-colors font-medium">
                            Services
                        </Link>
                        <Link href="/build" className="text-sub hover:text-main transition-colors font-medium">
                            PC Builder
                        </Link>
                        <Link href="/about" className="text-sub hover:text-main transition-colors font-medium">
                            About
                        </Link>
                        <Link href="/contact" className="text-sub hover:text-main transition-colors font-medium">
                            Contact
                        </Link>
                        <div className="flex items-center space-x-4">
                            <Link href="/cart" className="p-2 hover:bg-white/5 rounded-full transition-colors relative">
                                <ShoppingCart className="h-5 w-5 text-sub hover:text-main" />
                                {cartCount > 0 && (
                                    <span className="absolute top-0 right-0 h-4 w-4 bg-accent text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                                        {cartCount}
                                    </span>
                                )}
                            </Link>
                            <Link href="/account" className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                <User className="h-5 w-5 text-sub hover:text-main" />
                            </Link>
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-sub hover:text-main focus:outline-none"
                        >
                            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-surface border-t border-border-soft"
                    >
                        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                            <Link
                                href="/shop"
                                className="block px-3 py-2 rounded-md text-base font-medium text-sub hover:text-main hover:bg-white/5"
                                onClick={() => setIsOpen(false)}
                            >
                                Shop
                            </Link>
                            <Link
                                href="/build"
                                className="block px-3 py-2 rounded-md text-base font-medium text-sub hover:text-main hover:bg-white/5"
                                onClick={() => setIsOpen(false)}
                            >
                                PC Builder
                            </Link>
                            <Link
                                href="/services"
                                className="block px-3 py-2 rounded-md text-base font-medium text-sub hover:text-main hover:bg-white/5"
                                onClick={() => setIsOpen(false)}
                            >
                                Services
                            </Link>
                            <Link
                                href="/about"
                                className="block px-3 py-2 rounded-md text-base font-medium text-sub hover:text-main hover:bg-white/5"
                                onClick={() => setIsOpen(false)}
                            >
                                About
                            </Link>
                            <Link
                                href="/contact"
                                className="block px-3 py-2 rounded-md text-base font-medium text-sub hover:text-main hover:bg-white/5"
                                onClick={() => setIsOpen(false)}
                            >
                                Contact
                            </Link>
                            <Link
                                href="/cart"
                                className="block px-3 py-2 rounded-md text-base font-medium text-sub hover:text-main hover:bg-white/5"
                                onClick={() => setIsOpen(false)}
                            >
                                Cart
                            </Link>
                            <Link
                                href="/account"
                                className="block px-3 py-2 rounded-md text-base font-medium text-sub hover:text-main hover:bg-white/5"
                                onClick={() => setIsOpen(false)}
                            >
                                Account
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}

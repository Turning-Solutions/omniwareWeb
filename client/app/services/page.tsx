"use client";

import { motion } from "framer-motion";
import { Wrench, Zap, MonitorPlay } from "lucide-react";
import Link from "next/link";

export default function ServicesPage() {
    return (
        <div className="min-h-screen py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Our Services</h1>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        At Omniware, we are ready to fulfill all your computer needs, from building and upgrading to maintenance and troubleshooting.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Custom PC Builds */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass p-8 rounded-2xl border border-white/10 hover:border-primary/50 transition-colors"
                    >
                        <div className="h-14 w-14 bg-primary/20 rounded-xl flex items-center justify-center mb-6 text-primary">
                            <MonitorPlay className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Custom PC Builds</h3>
                        <p className="text-gray-400 mb-6 leading-relaxed">
                            We do custom PC builds to meet your exact requirements. Whether it&apos;s for gaming, content creation, or professional workstation use, we select and assemble the perfect components for you.
                        </p>
                        <Link href="/build" className="text-primary font-medium hover:underline">
                            Start Your Build &rarr;
                        </Link>
                    </motion.div>

                    {/* Upgrades */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass p-8 rounded-2xl border border-white/10 hover:border-primary/50 transition-colors"
                    >
                        <div className="h-14 w-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 text-purple-400">
                            <Zap className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Upgrades</h3>
                        <p className="text-gray-400 mb-6 leading-relaxed">
                            If you&apos;re looking to do some upgrades to your PC, we are happy to assist you with that. From installing new graphics cards to expanding storage or memory, we ensure compatibility and performance.
                        </p>
                        <Link href="/contact" className="text-purple-400 font-medium hover:underline">
                            Inquire Now &rarr;
                        </Link>
                    </motion.div>

                    {/* Service & Troubleshoot */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass p-8 rounded-2xl border border-white/10 hover:border-primary/50 transition-colors"
                    >
                        <div className="h-14 w-14 bg-green-500/20 rounded-xl flex items-center justify-center mb-6 text-green-400">
                            <Wrench className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Service & Troubleshoot</h3>
                        <p className="text-gray-400 mb-6 leading-relaxed">
                            If you feel not to get your hands dirty, don&apos;t worry, we&apos;ve got you. If you get any kind of issue with your PC software or hardware, or you simply want to get your PC serviced, bring it down to Omniware.
                        </p>
                        <Link href="/contact" className="text-green-400 font-medium hover:underline">
                            Get Support &rarr;
                        </Link>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

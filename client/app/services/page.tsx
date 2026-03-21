"use client";

import { motion } from "framer-motion";
import {
    ArrowRight,
    CheckCircle2,
    Headphones,
    MonitorPlay,
    Sparkles,
    Wrench,
    Zap,
} from "lucide-react";
import Link from "next/link";

const fadeUp = {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
};

const services = [
    {
        icon: MonitorPlay,
        title: "Custom PC builds",
        description:
            "Purpose-built machines for gaming, content creation, or professional workloads. We help you balance budget, thermals, and longevity.",
        bullets: [
            "Parts list tuned to your use case",
            "Clean cable management & burn-in testing",
            "Warranty guidance on core components",
        ],
        href: "/shop",
        cta: "Browse components",
    },
    {
        icon: Zap,
        title: "Upgrades & installs",
        description:
            "Drop in a new GPU, expand RAM or storage, or refresh cooling. We verify fitment, power headroom, and BIOS settings before hand-off.",
        bullets: [
            "Compatibility and bottleneck checks",
            "Driver & firmware updates as needed",
            "Optional data migration for storage swaps",
        ],
        href: "/contact",
        cta: "Plan an upgrade",
    },
    {
        icon: Wrench,
        title: "Service & troubleshooting",
        description:
            "Hardware diagnostics, cleaning, thermal paste, OS issues, we handle the messy work so you can get back to using your machine.",
        bullets: [
            "Transparent diagnosis before major work",
            "Dust-out and thermal service available",
            "Software and driver cleanup",
        ],
        href: "/contact",
        cta: "Book support",
    },
] as const;

const steps = [
    { step: "01", title: "Tell us your goal", detail: "Share budget, timeline, and what you run today-games, apps, or both." },
    { step: "02", title: "We spec & quote", detail: "We propose a balanced build or upgrade path with clear pricing." },
    { step: "03", title: "Build or repair", detail: "We assemble, test, and walk you through anything you need to know." },
] as const;

export default function ServicesPage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#121212] text-[#F1F1F1]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,rgba(209,43,40,0.14),transparent)]" />
            <div className="pointer-events-none absolute right-0 top-1/3 h-[420px] w-[420px] translate-x-1/3 rounded-full bg-[#D12B28]/[0.06] blur-3xl" />

            <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-12 lg:px-8 lg:pb-28 lg:pt-14">
                {/* Hero */}
                <motion.header
                    initial={fadeUp.initial}
                    animate={fadeUp.animate}
                    transition={{ duration: 0.45 }}
                    className="mx-auto max-w-3xl text-center"
                >
                    <p className="inline-flex items-center gap-2 rounded-full border border-[#5E5E5E]/55 bg-[#1a1a1a]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8E8E]">
                        <Sparkles className="h-3.5 w-3.5 text-[#D12B28]" aria-hidden />
                        Lab & workshop
                    </p>
                    <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[#F1F1F1] sm:text-5xl">
                        Services built around
                        <span className="mt-1 block text-[#D12B28] sm:mt-0 sm:inline sm:before:content-['\00a0']">
                            your machine.
                        </span>
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#B0B0B0] sm:text-lg">
                        From scratch builds to careful upgrades and in-shop repair, we keep your PC fast, stable, and ready for what you do next.
                    </p>
                    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D12B28] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#D12B28]/25 transition hover:bg-[#b82523] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D12B28]"
                        >
                            Talk to us
                            <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                        <Link
                            href="/shop"
                            className="inline-flex items-center justify-center rounded-full border border-[#5E5E5E]/60 bg-[#1a1a1a]/60 px-6 py-3 text-sm font-medium text-[#F1F1F1] backdrop-blur-sm transition hover:border-[#D12B28]/45 hover:text-[#F1F1F1]"
                        >
                            View the shop
                        </Link>
                    </div>
                </motion.header>

                {/* Service cards */}
                <div className="mt-16 grid gap-6 lg:mt-20 lg:grid-cols-3 lg:gap-8">
                    {services.map((item, i) => (
                        <motion.article
                            key={item.title}
                            initial={{ opacity: 0, y: 22 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-40px" }}
                            transition={{ duration: 0.4, delay: i * 0.08 }}
                            className="group relative flex flex-col rounded-2xl border border-[#5E5E5E]/35 bg-gradient-to-b from-[#1c1c1c]/95 to-[#141414]/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:p-8"
                        >
                            <div
                                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D12B28]/35 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
                                aria-hidden
                            />
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D12B28]/25 bg-[#D12B28]/[0.12] text-[#D12B28] transition group-hover:border-[#D12B28]/40 group-hover:bg-[#D12B28]/[0.18]">
                                <item.icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                            </div>
                            <h2 className="mt-5 text-xl font-semibold tracking-tight text-[#F1F1F1] sm:text-2xl">{item.title}</h2>
                            <p className="mt-3 text-sm leading-relaxed text-[#8E8E8E] sm:text-[15px]">{item.description}</p>
                            <ul className="mt-5 flex flex-col gap-2.5 border-t border-[#5E5E5E]/25 pt-5">
                                {item.bullets.map((line) => (
                                    <li key={line} className="flex gap-2.5 text-sm text-[#B0B0B0]">
                                        <CheckCircle2
                                            className="mt-0.5 h-4 w-4 shrink-0 text-[#D12B28]/85"
                                            aria-hidden
                                        />
                                        <span>{line}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-8 flex flex-1 flex-col justify-end">
                                <Link
                                    href={item.href}
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#D12B28] transition hover:gap-2.5"
                                >
                                    {item.cta}
                                    <ArrowRight className="h-4 w-4" aria-hidden />
                                </Link>
                            </div>
                        </motion.article>
                    ))}
                </div>

                {/* Process */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.45 }}
                    className="mt-20 lg:mt-24"
                >
                    <div className="overflow-hidden rounded-[1.35rem] border border-[#5E5E5E]/35 bg-[#181818]/80 backdrop-blur-sm">
                        <div className="border-b border-[#5E5E5E]/25 px-6 py-5 sm:px-8 sm:py-6">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8E8E]">How it works</p>
                                    <h3 className="mt-2 text-xl font-semibold text-[#F1F1F1] sm:text-2xl">Simple, from first message to hand-off</h3>
                                </div>
                                <Headphones className="mt-3 h-8 w-8 text-[#5E5E5E] sm:mt-0" aria-hidden />
                            </div>
                        </div>
                        <div className="grid gap-0 sm:grid-cols-3 sm:divide-x sm:divide-[#5E5E5E]/25">
                            {steps.map((s, idx) => (
                                <div key={s.step} className="px-6 py-6 sm:px-8 sm:py-8">
                                    <span className="font-mono text-xs font-medium tabular-nums text-[#D12B28]">{s.step}</span>
                                    <h4 className="mt-2 text-base font-semibold text-[#F1F1F1]">{s.title}</h4>
                                    <p className="mt-2 text-sm leading-relaxed text-[#8E8E8E]">{s.detail}</p>
                                    {idx < steps.length - 1 && (
                                        <div className="mt-6 h-px bg-[#5E5E5E]/25 sm:hidden" aria-hidden />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.section>

                {/* Bottom CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="mt-14 flex flex-col items-center justify-between gap-6 rounded-2xl border border-[#D12B28]/25 bg-[#D12B28]/[0.08] px-6 py-10 text-center sm:mt-16 sm:flex-row sm:text-left lg:px-10"
                >
                    <div className="max-w-xl">
                        <h3 className="text-xl font-semibold text-[#F1F1F1] sm:text-2xl">Not sure where to start?</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#B0B0B0] sm:text-base">
                            Describe your setup and what you want to improve, we&apos;ll recommend the fastest path, whether that&apos;s new parts or a bench visit.
                        </p>
                    </div>
                    <Link
                        href="/contact"
                        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#F1F1F1] px-6 py-3 text-sm font-semibold text-[#121212] transition hover:bg-white"
                    >
                        Contact Omniware
                        <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}

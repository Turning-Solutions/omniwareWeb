"use client";

import { motion } from "framer-motion";
import { ArrowRight, Cpu, Handshake, ShieldCheck, Sparkles, Users } from "lucide-react";
import Link from "next/link";

const fadeUp = {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
};

const values = [
    {
        icon: Cpu,
        title: "Serious about hardware",
        text: "We stay current on platforms, thermals, and supply so recommendations stay practical not just on paper.",
    },
    {
        icon: Users,
        title: "Builders, not box-movers",
        text: "Our team lives this stuff: clean builds, honest bottlenecks, and setups you can actually live with every day.",
    },
    {
        icon: ShieldCheck,
        title: "After the sale",
        text: "Warranty guidance, upgrades, and troubleshooting—you are not on your own once the PC leaves the bench.",
    },
] as const;

const stats = [
    { value: "5+", label: "Years in the game" },
    { value: "1000+", label: "Builds & upgrades" },
    { value: "100%", label: "Commitment to support" },
] as const;

export default function AboutPage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#121212] text-[#F1F1F1]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,rgba(209,43,40,0.14),transparent)]" />
            <div className="pointer-events-none absolute left-0 top-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[#D12B28]/[0.05] blur-3xl" />

            <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-12 lg:px-8 lg:pb-28 lg:pt-14">
                <motion.header
                    initial={fadeUp.initial}
                    animate={fadeUp.animate}
                    transition={{ duration: 0.45 }}
                    className="text-center"
                >
                    <p className="inline-flex items-center gap-2 rounded-full border border-[#5E5E5E]/55 bg-[#1a1a1a]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8E8E]">
                        <Sparkles className="h-3.5 w-3.5 text-[#D12B28]" aria-hidden />
                        Our story
                    </p>
                    <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[#F1F1F1] sm:text-5xl">
                        About
                        <span className="mt-1 block text-[#D12B28] sm:mt-0 sm:inline sm:before:content-['\00a0']">
                            Omniware.
                        </span>
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#B0B0B0] sm:text-lg">
                        Sri Lanka&apos;s home for custom PCs and high-end components, where careful assembly meets straight answers.
                    </p>
                </motion.header>

                <motion.article
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 }}
                    className="mt-12 overflow-hidden rounded-[1.35rem] border border-[#5E5E5E]/35 bg-gradient-to-b from-[#1c1c1c]/95 to-[#141414]/90 shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:mt-14"
                >
                    <div className="border-b border-[#5E5E5E]/25 px-6 py-5 sm:px-10 sm:py-7">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D12B28]/25 bg-[#D12B28]/[0.12] text-[#D12B28]">
                                <Handshake className="h-5 w-5" aria-hidden />
                            </div>
                            <h2 className="text-lg font-semibold text-[#F1F1F1] sm:text-xl">Who we are</h2>
                        </div>
                    </div>
                    <div className="space-y-5 px-6 py-8 text-[15px] leading-relaxed text-[#B0B0B0] sm:px-10 sm:py-10 sm:text-base">
                        <p>
                            Welcome to <span className="font-semibold text-[#F1F1F1]">Omniware</span>, Sri Lanka&apos;s premier
                            destination for custom PC builds and high-end computer components.
                        </p>
                        <p>
                            We are passionate about technology and dedicated to giving you a clear, confident experience.
                            Whether you are a hardcore gamer, a creative professional, or someone who needs a dependable
                            machine for everyday work, we have the expertise to build the right system for you.
                        </p>
                        <p>
                            Our team is made of experienced technicians and hardware enthusiasts who follow the latest
                            platforms and best practices. We choose components for performance, reliability, and clean
                            aesthetics—so your build looks as good as it runs.
                        </p>
                        <p className="border-l-2 border-[#D12B28]/50 pl-4 text-[#8E8E8E]">
                            At Omniware, we don&apos;t just sell computers; we build relationships. Exceptional after-sales
                            support and warranty guidance are part of the deal so you always know where to turn.
                        </p>
                    </div>
                </motion.article>

                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.4 }}
                    className="mt-12 sm:mt-14"
                >
                    <h3 className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8E8E]">
                        What guides us
                    </h3>
                    <div className="mt-6 grid gap-5 sm:grid-cols-3">
                        {values.map((v, i) => (
                            <motion.div
                                key={v.title}
                                initial={{ opacity: 0, y: 14 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.06 }}
                                className="rounded-2xl border border-[#5E5E5E]/35 bg-[#181818]/80 p-5 backdrop-blur-sm sm:p-6"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#5E5E5E]/40 bg-[#242424]/80 text-[#D12B28]">
                                    <v.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                                </div>
                                <h4 className="mt-4 text-base font-semibold text-[#F1F1F1]">{v.title}</h4>
                                <p className="mt-2 text-sm leading-relaxed text-[#8E8E8E]">{v.text}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="mt-12 grid grid-cols-1 gap-4 rounded-2xl border border-[#5E5E5E]/35 bg-[#181818]/60 p-6 sm:mt-14 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[#5E5E5E]/25 sm:p-8"
                >
                    {stats.map((s) => (
                        <div key={s.label} className="text-center sm:px-4">
                            <p className="font-mono text-3xl font-semibold tabular-nums text-[#D12B28] sm:text-4xl">{s.value}</p>
                            <p className="mt-2 text-xs font-medium uppercase tracking-wider text-[#8E8E8E]">{s.label}</p>
                        </div>
                    ))}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-12 flex flex-col items-center justify-between gap-5 rounded-2xl border border-[#D12B28]/25 bg-[#D12B28]/[0.08] px-6 py-8 text-center sm:mt-14 sm:flex-row sm:text-left"
                >
                    <p className="max-w-md text-sm leading-relaxed text-[#B0B0B0] sm:text-base">
                        Ready to plan a build, upgrade, or repair? We&apos;re one message away.
                    </p>
                    <Link
                        href="/contact"
                        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#F1F1F1] px-6 py-3 text-sm font-semibold text-[#121212] transition hover:bg-white"
                    >
                        Contact us
                        <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}

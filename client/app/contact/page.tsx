"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, MapPin, MessageSquare, Phone, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { isAxiosError } from "axios";
import api from "@/lib/api";

const inputClass =
    "w-full rounded-xl border border-[#5E5E5E]/45 bg-[#121212]/90 px-4 py-3 text-sm text-[#F1F1F1] shadow-inner shadow-black/20 placeholder:text-[#8E8E8E]/80 transition focus:border-[#D12B28]/55 focus:outline-none focus:ring-2 focus:ring-[#D12B28]/35";

const labelClass = "mb-2 block text-xs font-medium uppercase tracking-wider text-[#8E8E8E]";

export default function ContactPage() {
    const [formState, setFormState] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setSubmitted(false);
        setSending(true);
        try {
            await api.post("/contact", {
                name: formState.name.trim(),
                email: formState.email.trim(),
                subject: formState.subject.trim(),
                message: formState.message.trim(),
            });
            setFormState({ name: "", email: "", subject: "", message: "" });
            setSubmitted(true);
            window.setTimeout(() => setSubmitted(false), 8000);
        } catch (err) {
            let msg = "Something went wrong. Please try again or email us directly.";
            if (isAxiosError(err)) {
                const apiMsg = err.response?.data?.error?.message;
                if (typeof apiMsg === "string" && apiMsg.trim()) msg = apiMsg;
            }
            setFormError(msg);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#121212] text-[#F1F1F1]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,rgba(209,43,40,0.14),transparent)]" />
            <div className="pointer-events-none absolute right-0 top-24 h-[400px] w-[400px] translate-x-1/3 rounded-full bg-[#D12B28]/[0.06] blur-3xl" />

            <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-12 lg:px-8 lg:pb-28 lg:pt-14">
                <motion.header
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="mx-auto max-w-2xl text-center"
                >
                    <p className="inline-flex items-center gap-2 rounded-full border border-[#5E5E5E]/55 bg-[#1a1a1a]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8E8E]">
                        <Sparkles className="h-3.5 w-3.5 text-[#D12B28]" aria-hidden />
                        Get in touch
                    </p>
                    <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[#F1F1F1] sm:text-5xl">
                        Contact
                        <span className="mt-1 block text-[#D12B28] sm:mt-0 sm:inline sm:before:content-['\00a0']">
                            Omniware.
                        </span>
                    </h1>
                    <p className="mt-4 text-base leading-relaxed text-[#B0B0B0] sm:text-lg">
                        Builds, upgrades, or bench service, send a note and we&apos;ll get back as soon as we can.
                    </p>
                </motion.header>

                <div className="mt-12 grid grid-cols-1 gap-8 lg:mt-16 lg:grid-cols-12 lg:gap-10">
                    {/* Sidebar: visit + hours + links */}
                    <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.45, delay: 0.05 }}
                        className="flex flex-col gap-6 lg:col-span-5"
                    >
                        <div className="overflow-hidden rounded-2xl border border-[#5E5E5E]/35 bg-gradient-to-b from-[#1c1c1c]/95 to-[#141414]/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] sm:p-8">
                            <div className="flex items-center gap-3 border-b border-[#5E5E5E]/25 pb-5">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D12B28]/25 bg-[#D12B28]/[0.12] text-[#D12B28]">
                                    <MapPin className="h-5 w-5" aria-hidden />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-[#F1F1F1]">Visit us</h2>
                                    <p className="text-xs text-[#8E8E8E]">Store & workshop</p>
                                </div>
                            </div>
                            <div className="mt-5 space-y-5">
                                <a
                                    href="tel:+94740523439"
                                    className="flex items-center gap-3 text-sm text-[#B0B0B0] transition hover:text-[#D12B28]"
                                >
                                    <Phone className="h-5 w-5 shrink-0 text-[#D12B28]/90" aria-hidden />
                                    +94 74 052 3439
                                </a>
                                <a
                                    href="mailto:support@omniware.lk"
                                    className="flex items-center gap-3 text-sm text-[#B0B0B0] transition hover:text-[#D12B28]"
                                >
                                    <Mail className="h-5 w-5 shrink-0 text-[#D12B28]/90" aria-hidden />
                                    support@omniware.lk
                                </a>
                                
                            </div>
                        </div>

                       

                        <a
                            href="https://wa.me/94740523439?text=Hi%20Omniware%2C%20I%20need%20help%20with%20a%20product."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 rounded-2xl border border-[#25D366]/55 bg-[#25D366]/10 px-6 py-4 text-sm font-semibold text-[#D8FFE6] transition hover:bg-[#25D366]/20 sm:px-8"
                        >
                            <Image src="/whatsapp-logo.svg" alt="WhatsApp" width={18} height={18} />
                            Contact on WhatsApp
                        </a>

                        <div className="rounded-2xl border border-[#5E5E5E]/35 bg-[#181818]/60 px-6 py-5 sm:px-8">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#8E8E8E]">Quick links</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Link
                                    href="/shop"
                                    className="rounded-full border border-[#5E5E5E]/50 bg-[#242424]/80 px-4 py-2 text-xs font-medium text-[#F1F1F1] transition hover:border-[#D12B28]/45"
                                >
                                    Shop
                                </Link>
                                <Link
                                    href="/services"
                                    className="rounded-full border border-[#5E5E5E]/50 bg-[#242424]/80 px-4 py-2 text-xs font-medium text-[#F1F1F1] transition hover:border-[#D12B28]/45"
                                >
                                    Services
                                </Link>
                            </div>
                        </div>
                    </motion.div>

                    {/* Form */}
                    <motion.div
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.45, delay: 0.08 }}
                        className="lg:col-span-7"
                    >
                        <div className="overflow-hidden rounded-2xl border border-[#5E5E5E]/35 bg-gradient-to-b from-[#1c1c1c]/95 to-[#141414]/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] sm:p-8 lg:p-10">
                            <div className="flex items-start gap-3 border-b border-[#5E5E5E]/25 pb-6">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D12B28]/25 bg-[#D12B28]/[0.12] text-[#D12B28]">
                                    <MessageSquare className="h-5 w-5" aria-hidden />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-[#F1F1F1] sm:text-xl">Send a message</h2>
                                    <p className="mt-1 text-sm text-[#8E8E8E]">
                                        Prefer email? You can also write directly to{" "}
                                        <a href="mailto:support@omniware.lk" className="text-[#D12B28] hover:underline">
                                        support@omniware.lk
                                        </a>
                                        .
                                    </p>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {formError && (
                                    <motion.div
                                        key="err"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-6 overflow-hidden rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200/95"
                                        role="alert"
                                    >
                                        {formError}
                                    </motion.div>
                                )}
                                {submitted && !formError && (
                                    <motion.div
                                        key="ok"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-6 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200/95"
                                    >
                                        Thanks,your message was sent. We&apos;ll get back to you as soon as we can.
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="contact-name" className={labelClass}>
                                            Name
                                        </label>
                                        <input
                                            id="contact-name"
                                            type="text"
                                            required
                                            autoComplete="name"
                                            value={formState.name}
                                            onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                                            className={inputClass}
                                            placeholder="Your name"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="contact-email" className={labelClass}>
                                            Email
                                        </label>
                                        <input
                                            id="contact-email"
                                            type="email"
                                            required
                                            autoComplete="email"
                                            value={formState.email}
                                            onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                                            className={inputClass}
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="contact-subject" className={labelClass}>
                                        Subject
                                    </label>
                                    <input
                                        id="contact-subject"
                                        type="text"
                                        required
                                        value={formState.subject}
                                        onChange={(e) => setFormState((s) => ({ ...s, subject: e.target.value }))}
                                        className={inputClass}
                                        placeholder="e.g. Custom gaming build budget"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="contact-message" className={labelClass}>
                                        Message
                                    </label>
                                    <textarea
                                        id="contact-message"
                                        required
                                        rows={5}
                                        value={formState.message}
                                        onChange={(e) => setFormState((s) => ({ ...s, message: e.target.value }))}
                                        className={`${inputClass} min-h-[120px] resize-y`}
                                        placeholder="Tell us what you need, timeline, budget, current hardware if any."
                                    />
                                </div>
                                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D12B28] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#D12B28]/20 transition hover:bg-[#b82523] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D12B28] enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-10"
                                    >
                                        {sending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                        ) : (
                                            <Send className="h-4 w-4" aria-hidden />
                                        )}
                                        {sending ? "Sending..." : "Send message"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

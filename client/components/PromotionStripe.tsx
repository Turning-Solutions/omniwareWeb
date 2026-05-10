"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight, Clock, X, Zap } from "lucide-react";
import api from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";

interface Promotion {
    _id: string;
    title: string;
    description: string;
    imageUrl: string;
    link: string;
    badgeText: string;
    validFrom: string;
    validTo: string;
}

function formatTimeLeft(validTo: string): string {
    const diff = new Date(validTo).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
}

const slide = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 1 }),
    center:               { x: 0,     opacity: 1 },
    exit:  (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 1 }),
};

const textSlide = {
    enter: (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
    center:               { x: 0,   opacity: 1 },
    exit:  (d: number) => ({ x: d > 0 ? -48 : 48, opacity: 0 }),
};

const transition = { duration: 0.62, ease: [0.22, 1, 0.36, 1] as const };

const PROMOTIONS_STALE_MS = 20 * 60 * 1000;

interface PromotionStripeProps {
    asHero?: boolean;
    promotions?: Promotion[];
    loading?: boolean;
}

export default function PromotionStripe({ asHero = false, promotions: promotionsOverride, loading: loadingOverride }: PromotionStripeProps) {
    const { data: fetchedPromotions = [], isPending: fetchedLoading } = useQuery({
        queryKey: ["promotions", "active"] as const,
        queryFn: async () => {
            try {
                const res = await api.get<Promotion[]>("/promotions/active");
                return Array.isArray(res.data) ? res.data : [];
            } catch {
                return [];
            }
        },
        staleTime: PROMOTIONS_STALE_MS,
        enabled: !Array.isArray(promotionsOverride),
    });
    const promotions = Array.isArray(promotionsOverride) ? promotionsOverride : fetchedPromotions;
    const loading = typeof loadingOverride === "boolean" ? loadingOverride : fetchedLoading;

    const [activeIndex, setActiveIndex] = useState(0);
    const [direction,   setDirection]   = useState(1);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const safeIndex = useMemo(() => {
        if (promotions.length === 0) return 0;
        return Math.min(activeIndex, promotions.length - 1);
    }, [activeIndex, promotions.length]);

    useEffect(() => {
        if (promotions.length <= 1) return;
        const t = setInterval(() => {
            setDirection(1);
            setActiveIndex(prev => (prev + 1) % promotions.length);
        }, 5500);
        return () => clearInterval(t);
    }, [promotions.length]);

    const navigate = (dir: number) => {
        setDirection(dir);
        setActiveIndex(prev =>
            dir > 0
                ? (prev + 1) % promotions.length
                : (prev - 1 + promotions.length) % promotions.length
        );
    };

    if (loading) {
        return null;
    }

    if (promotions.length === 0) return null;

    const promo    = promotions[safeIndex];
    const hasMulti = promotions.length > 1;

    const inner = (
        /* ── Cinematic full-bleed banner — image fills the whole card, text overlays ── */
        <div className={`relative overflow-hidden rounded-2xl border border-white/[0.06] ${asHero ? "min-h-[440px] sm:min-h-[540px] lg:min-h-[620px]" : "min-h-[300px] sm:min-h-[340px] lg:min-h-[360px]"}`}>

            {/* Full-bleed background image — slides in/out */}
            <AnimatePresence custom={direction}>
                <motion.div
                    key={promo._id + "-img"}
                    custom={direction}
                    variants={slide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={transition}
                    className="absolute inset-0 z-0"
                >
                    {promo.imageUrl ? (
                        <Image
                            src={promo.imageUrl}
                            alt={promo.title}
                            fill
                            sizes={asHero ? "100vw" : "(max-width: 1024px) 100vw, 80vw"}
                            quality={asHero ? 72 : 68}
                            className="h-full w-full object-cover object-center"
                            priority={safeIndex === 0}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-[#181818]" />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Gradient overlays — left fog for text legibility, bottom scrim for controls */}
            <div
                className={
                    asHero
                        ? "pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_top,rgba(8,8,8,0.32)_0%,rgba(8,8,8,0.05)_45%,transparent_100%)]"
                        : "pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_right,rgba(8,8,8,0.92)_0%,rgba(8,8,8,0.72)_38%,rgba(8,8,8,0.2)_65%,transparent_100%)]"
                }
            />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_top,rgba(8,8,8,0.75)_0%,transparent_45%)]" />

            {/* Content — layered over image */}
            <div className="relative z-10 flex h-full min-h-[inherit] flex-col justify-between p-6 sm:p-8 lg:p-10">

                {!asHero && (
                    <>
                        {/* Top row: badge + counter */}
                        <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 rounded-full border border-[#D12B28]/40 bg-[#D12B28]/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#F4C5C5] backdrop-blur-sm">
                                <Zap className="h-3 w-3 fill-[#D12B28] text-[#D12B28]" />
                                Limited Offer
                            </span>
                            {hasMulti && (
                                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono text-[11px] text-white/40 backdrop-blur-sm">
                                    {String(safeIndex + 1).padStart(2, "0")}&thinsp;/&thinsp;{String(promotions.length).padStart(2, "0")}
                                </span>
                            )}
                        </div>

                        {/* Middle: animated title + description — constrained to left ~55% */}
                        <AnimatePresence custom={direction}>
                            <motion.div
                                key={promo._id + "-text"}
                                custom={direction}
                                variants={textSlide}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={transition}
                                className="mt-6 max-w-[min(520px,60%)]"
                            >
                                {promo.badgeText && (
                                    <span className="mb-3 inline-block rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold text-white/75 backdrop-blur-sm">
                                        {promo.badgeText}
                                    </span>
                                )}
                                <h2 className="text-3xl font-black leading-[1.06] tracking-tight text-white sm:text-4xl lg:text-5xl">
                                    {promo.title}
                                </h2>
                                {promo.description && (
                                    <p className="mt-3 text-[14px] leading-6 text-white/55 sm:text-[15px]">
                                        {promo.description}
                                    </p>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </>
                )}

                {/* Bottom row: CTA + timer on left, dots + arrows on right */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    {!asHero ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-2 rounded-xl bg-[#D12B28] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(209,43,40,0.5)] transition-all hover:bg-[#E53A36]">
                                View Offer Details
                                <ArrowRight className="h-4 w-4" />
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white/65 backdrop-blur-sm">
                                <Clock className="h-4 w-4 text-[#D12B28]" />
                                {formatTimeLeft(promo.validTo)}
                            </span>
                        </div>
                    ) : (
                        <div />
                    )}

                    {hasMulti && (
                        <div className="flex items-center gap-3">
                            {!asHero && (
                                <>
                                    {/* dot indicators */}
                                    <div className="flex items-center gap-1.5">
                                        {promotions.map((_, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setDirection(idx > safeIndex ? 1 : -1);
                                                    setActiveIndex(idx);
                                                }}
                                                aria-label={`Promotion ${idx + 1}`}
                                                className={`rounded-full transition-all duration-300 ${idx === safeIndex ? "h-2 w-6 bg-white" : "h-2 w-2 bg-white/30 hover:bg-white/55"}`}
                                            />
                                        ))}
                                    </div>
                                    {/* arrow controls */}
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                navigate(-1);
                                            }}
                                            aria-label="Previous"
                                            type="button"
                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/50 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                navigate(1);
                                            }}
                                            aria-label="Next"
                                            type="button"
                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/50 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {asHero && hasMulti && (
                <>
                    <button
                        type="button"
                        aria-label="Previous"
                        onClick={(event) => {
                            event.stopPropagation();
                            navigate(-1);
                        }}
                        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/35 p-3 text-white/80 backdrop-blur-md transition hover:bg-black/55 hover:text-white sm:left-5 sm:p-3.5"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        aria-label="Next"
                        onClick={(event) => {
                            event.stopPropagation();
                            navigate(1);
                        }}
                        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/35 p-3 text-white/80 backdrop-blur-md transition hover:bg-black/55 hover:text-white sm:right-5 sm:p-3.5"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>

                    <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-2 backdrop-blur-md">
                        {promotions.map((_, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setDirection(idx > safeIndex ? 1 : -1);
                                    setActiveIndex(idx);
                                }}
                                aria-label={`Promotion ${idx + 1}`}
                                className={`rounded-full transition-all duration-300 ${idx === safeIndex ? "h-2 w-7 bg-white" : "h-2 w-2 bg-white/45 hover:bg-white/75"}`}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Progress bar along the bottom edge */}
            {hasMulti && (
                <div className="absolute bottom-0 left-0 right-0 z-10 h-[2px] overflow-hidden bg-white/8">
                    <motion.div
                        key={promo._id + "-bar"}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 5.5, ease: "linear" }}
                        className="h-full bg-[#D12B28]"
                    />
                </div>
            )}
        </div>
    );

    return (
        <section
            className={`relative overflow-hidden bg-[#080808] ${asHero ? "pb-5 pt-4 sm:pb-10 sm:pt-8 lg:pb-12 lg:pt-10" : "border-y border-[#D12B28]/20 py-10 sm:py-14"}`}
        >
            {/* ambient red glow — gives the section its own visual identity */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_50%,rgba(209,43,40,0.09),transparent)]" />
            <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-[#D12B28]/10 blur-[80px]" />
            <div className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-[#D12B28]/8 blur-[80px]" />

            {!asHero && (
                <div className="relative mx-auto mb-6 max-w-7xl px-4 sm:px-6 lg:px-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                        — Active Promotions
                    </p>
                </div>
            )}

            <div className={`relative mx-auto max-w-7xl sm:px-6 lg:px-8 ${asHero ? "px-3" : "px-4"}`}>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsDetailsOpen(true)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setIsDetailsOpen(true);
                        }
                    }}
                    className="block cursor-pointer"
                    aria-label={`Open details for ${promo.title}`}
                >
                    {inner}
                </div>
            </div>

            {isDetailsOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
                    <button
                        type="button"
                        onClick={() => setIsDetailsOpen(false)}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        aria-label="Close promotion details"
                    />
                    <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:p-8">
                        <button
                            type="button"
                            onClick={() => setIsDetailsOpen(false)}
                            aria-label="Close"
                            className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D12B28]">Promotion Details</p>
                        <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{promo.title}</h3>
                        {promo.badgeText && (
                            <p className="mt-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                                {promo.badgeText}
                            </p>
                        )}
                        {promo.description && (
                            <p className="mt-4 text-sm leading-7 text-white/75 sm:text-base">
                                {promo.description}
                            </p>
                        )}
                        <p className="mt-4 text-sm text-white/60">
                            Valid until: {new Date(promo.validTo).toLocaleString()}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            {promo.link && (
                                <Link
                                    href={promo.link}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#D12B28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#E53A36]"
                                >
                                    Go To Offer
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsDetailsOpen(false)}
                                className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

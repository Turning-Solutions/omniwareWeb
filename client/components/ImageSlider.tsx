"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageSliderProps {
    images: string[];
    autoPlayInterval?: number;
    /** Fills parent height; use in hero panels (no fixed viewport height, no outer radius). */
    variant?: "default" | "hero";
}

export default function ImageSlider({
    images,
    autoPlayInterval = 5000,
    variant = "default"
}: ImageSliderProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
        }, autoPlayInterval);

        return () => clearInterval(timer);
    }, [images.length, autoPlayInterval]);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const isHero = variant === "hero";

    return (
        <div
            className={
                isHero
                    ? "relative h-full min-h-[260px] w-full overflow-hidden group"
                    : "relative w-full h-[60vh] sm:h-[80vh] overflow-hidden rounded-3xl group"
            }
        >
            <AnimatePresence initial={false} mode="wait">
                <motion.img
                    key={currentIndex}
                    src={images[currentIndex]}
                    alt={`Slide ${currentIndex + 1}`}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.65 }}
                    className="absolute inset-0 h-full w-full object-cover"
                />
            </AnimatePresence>

            {/* Overlay — stronger read on default card; lighter on hero (page may add its own scrim). */}
            <div
                className={
                    isHero
                        ? "pointer-events-none absolute inset-0 bg-gradient-to-l from-black/20 via-black/30 to-black/55"
                        : "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
                }
            />

            {/* Navigation */}
            <button
                type="button"
                onClick={prevSlide}
                aria-label="Previous slide"
                className={
                    isHero
                        ? "absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-2.5 text-white opacity-80 backdrop-blur-sm transition hover:bg-black/65 hover:opacity-100"
                        : "absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                }
            >
                <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <button
                type="button"
                onClick={nextSlide}
                aria-label="Next slide"
                className={
                    isHero
                        ? "absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-2.5 text-white opacity-80 backdrop-blur-sm transition hover:bg-black/65 hover:opacity-100"
                        : "absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                }
            >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>

            {/* Indicators */}
            <div
                className={
                    isHero
                        ? "absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-black/40 px-3 py-2 backdrop-blur-sm"
                        : "absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 space-x-2"
                }
            >
                {images.map((_, idx) => (
                    <button
                        type="button"
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-2 rounded-full transition-all ${
                            idx === currentIndex
                                ? isHero
                                    ? "w-7 bg-[#D12B28]"
                                    : "w-6 bg-white"
                                : isHero
                                  ? "w-2 bg-white/40 hover:bg-white/60"
                                  : "w-2 bg-white/50"
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}

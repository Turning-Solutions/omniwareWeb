"use client";

import { useEffect, useState } from "react";

interface SectionNavItem {
    id: string;
    label: string;
}

interface ProductFormSectionNavProps {
    sections: SectionNavItem[];
}

export default function ProductFormSectionNav({ sections }: ProductFormSectionNavProps) {
    const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

    useEffect(() => {
        const elements = sections
            .map((section) => document.getElementById(section.id))
            .filter((el): el is HTMLElement => Boolean(el));

        if (elements.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) {
                    setActiveId(visible[0].target.id);
                }
            },
            { rootMargin: "-120px 0px -70% 0px", threshold: [0, 1] }
        );

        elements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClick = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        setActiveId(id);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="sticky top-[57px] z-20 mb-6 overflow-x-auto rounded-xl border border-border-soft bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sm:top-[65px]">
            <nav className="flex min-w-max gap-1 p-2">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => handleClick(section.id)}
                        aria-current={activeId === section.id ? "true" : undefined}
                        className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            activeId === section.id
                                ? "bg-accent/15 text-accent"
                                : "text-sub hover:bg-white/5 hover:text-main"
                        }`}
                    >
                        {section.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}

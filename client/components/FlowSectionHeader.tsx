type FlowSectionHeaderProps = {
    /** Large background word; omit on compact pages (e.g. product detail). */
    watermark?: string;
    eyebrow: string;
    title: string;
    description?: string;
    watermarkAlign?: "left" | "right";
    className?: string;
    titleId?: string;
    /** Use `h1` on pages where this is the primary title (e.g. product detail). */
    titleTag?: "h1" | "h2";
};

export default function FlowSectionHeader({
    watermark,
    eyebrow,
    title,
    description,
    watermarkAlign = "left",
    className,
    titleId,
    titleTag = "h2",
}: FlowSectionHeaderProps) {
    const Heading = titleTag === "h1" ? "h1" : "h2";

    return (
        <div className={`relative mb-8 sm:mb-10 lg:mb-12 ${className ?? ""}`}>
            {watermark ? (
                <p
                    className={`pointer-events-none absolute -top-2 select-none font-bold uppercase tracking-tight text-[#D12B28]/[0.075] sm:text-[#D12B28]/[0.10] ${watermarkAlign === "left" ? "-left-1 sm:-left-2" : "-right-1 sm:-right-2 text-right"} text-[clamp(2.75rem,11vw,8.5rem)] leading-[0.85] whitespace-nowrap`}
                    aria-hidden
                >
                    {watermark}
                </p>
            ) : null}
            <div className="relative">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                    {eyebrow}
                </span>
                <Heading
                    id={titleId}
                    className="mt-2 text-balance text-xl font-bold leading-snug tracking-tight text-[#F1F1F1] sm:text-3xl sm:leading-tight lg:text-4xl"
                >
                    {title}
                </Heading>
                {description ? (
                    <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#B0B0B0] sm:text-base">
                        {description}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

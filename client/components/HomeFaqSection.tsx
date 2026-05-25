"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import FlowSectionHeader from "@/components/FlowSectionHeader";

const POSTAL_ADDRESS = "150/18E, Bellanthara Lane, Dehiwala, Sri Lanka";
const TRACKING_URL = "https://www.fdedomestic.com/#track";

const FAQ_ITEMS = [
    {
        id: "purchase",
        question: "How do I make a purchase at Omniware?",
        answer: (
            <>
                <p>
                    Got questions or want to place an order? Reach out to us through social media, WhatsApp, or email!
                    Just let us know what you&apos;re interested in and any other details you think we should know. We
                    will check the availability of your desired item and provide you with any other personal assistance
                    to make your purchase.
                </p>
                <p className="mt-4">
                    When you&apos;re ready to make a purchase, you can pay through bank transfer or direct deposit and
                    send us a copy or a photograph as confirmation via WhatsApp. We&apos;ll provide you with all the
                    details you need to make the payment, including the total amount with any taxes or fees.
                </p>
                <p className="mt-4">
                    Your items will be on their way to you within 2–5 business days after we confirm your payment.
                    We&apos;ll share the tracking info with you so you can keep an eye on your delivery.
                </p>
            </>
        ),
    },
    {
        id: "warranty",
        question: "How do I claim my warranty?",
        answer: (
            <>
                <p>
                    You can send us the product you&apos;re having issues with along with the issued warranty card to
                    our postal address via a courier, and we&apos;ll take care of the rest for you. We will send a job
                    note stating the fault of the product and confirmation of the warranty claim as soon as we receive
                    your item.
                </p>
                <p className="mt-4">
                    All you have to do is sit back and relax while our team works their magic and makes sure that you
                    get your repaired or replaced product safe and sound, right back to your doorstep.
                </p>
                <p className="mt-4 rounded-xl border border-white/[0.08] bg-[#141414]/80 px-4 py-3 text-sm text-[#D0D0D0]">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-[#8E8E8E]">
                        Postal address
                    </span>
                    <span className="mt-1 block text-[#F1F1F1]">{POSTAL_ADDRESS}</span>
                </p>
            </>
        ),
    },
    {
        id: "address",
        question: "What is Omniware's address?",
        answer: (
            <>
                <p>
                    For the time being, Omniware is a purely digital e-store. We hope to expand into our own network of
                    showrooms, repair centers, service stations, and much more in the future.
                </p>
                <p className="mt-4">
                    But if you want to send us something via mail, here&apos;s our postal address:
                </p>
                <p className="mt-3 rounded-xl border border-white/[0.08] bg-[#141414]/80 px-4 py-3 text-sm font-medium text-[#F1F1F1]">
                    {POSTAL_ADDRESS}
                </p>
            </>
        ),
    },
    {
        id: "tracking",
        question: "How do I track my order?",
        answer: (
            <>
                <p>
                    Follow the link to the tracking site and enter your tracking details to track your order in
                    real-time.
                </p>
                <a
                    href={TRACKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#D12B28] px-5 py-3 text-sm font-bold text-[#F1F1F1] shadow-[0_0_24px_rgba(209,43,40,0.25)] transition hover:bg-[#E53A36] hover:shadow-[0_0_28px_rgba(209,43,40,0.4)]"
                >
                    Visit Tracking Site Now!
                    <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
            </>
        ),
    },
] as const;

function FaqItem({
    id,
    question,
    answer,
    expanded,
    onToggle,
}: {
    id: string;
    question: string;
    answer: ReactNode;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="border-b border-white/[0.07] last:border-0">
            <button
                type="button"
                id={`faq-header-${id}`}
                aria-expanded={expanded}
                aria-controls={`faq-panel-${id}`}
                onClick={onToggle}
                className="flex w-full items-start justify-between gap-4 py-5 text-left transition-colors hover:text-[#F1F1F1] sm:py-6"
            >
                <span className="text-base font-semibold leading-snug text-[#F1F1F1] sm:text-lg">{question}</span>
                <ChevronDown
                    className={`mt-0.5 h-5 w-5 shrink-0 text-[#8E8E8E] transition-transform duration-200 ${expanded ? "rotate-180 text-[#D12B28]" : ""}`}
                    aria-hidden
                />
            </button>
            <div
                id={`faq-panel-${id}`}
                role="region"
                aria-labelledby={`faq-header-${id}`}
                className="grid transition-[grid-template-rows] duration-200"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="pb-5 text-sm leading-relaxed text-[#B0B0B0] sm:pb-6 sm:text-base">{answer}</div>
                </div>
            </div>
        </div>
    );
}

export default function HomeFaqSection() {
    const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);

    return (
        <section id="faq" className="relative py-10 sm:py-16 lg:py-20" aria-labelledby="home-faq-heading">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
                <FlowSectionHeader
                    titleId="home-faq-heading"
                    watermark="FAQ"
                    watermarkAlign="right"
                    eyebrow="Support"
                    title="FAQ"
                    description="It's super simple and straightforward."
                />

                <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0c0c]/90 px-4 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:rounded-[1.75rem] sm:px-6 lg:px-8">
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]"
                        aria-hidden
                    />
                    {FAQ_ITEMS.map((item) => (
                        <FaqItem
                            key={item.id}
                            id={item.id}
                            question={item.question}
                            answer={item.answer}
                            expanded={openId === item.id}
                            onToggle={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

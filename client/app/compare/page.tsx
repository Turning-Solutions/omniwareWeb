import type { Metadata } from "next";
import ComparePageClient from "./ComparePageClient";

export const metadata: Metadata = {
    title: "Compare Products | Omniware.lk",
    description: "Compare product specifications side by side.",
    robots: { index: false, follow: true },
};

export default function ComparePage() {
    return <ComparePageClient />;
}

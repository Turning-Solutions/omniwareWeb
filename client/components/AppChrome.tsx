"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CompareTray from "@/components/CompareTray";

export default function AppChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdminRoute = (pathname ?? "").startsWith("/admin");

    return (
        <>
            {!isAdminRoute ? <Navbar /> : null}
            <main className={isAdminRoute ? "flex-grow" : "flex-grow pt-[6.25rem]"}>
                {children}
            </main>
            {!isAdminRoute ? <Footer /> : null}
            {!isAdminRoute ? <CompareTray /> : null}
        </>
    );
}

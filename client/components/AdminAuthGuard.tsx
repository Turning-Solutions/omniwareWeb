"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        let userInfo: { token?: string; role?: string } = {};
        try {
            userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
        } catch {
            router.replace(`/login?redirect=${encodeURIComponent(pathname || "/admin")}`);
            return;
        }

        if (!userInfo.token || userInfo.role !== "admin") {
            router.replace(`/login?redirect=${encodeURIComponent(pathname || "/admin")}`);
            return;
        }

        setAllowed(true);
    }, [router, pathname]);

    // Show nothing (or a spinner) until we've checked and either redirected or allowed
    if (!allowed) {
        return (
            <div className="admin-theme flex min-h-screen items-center justify-center bg-background">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
        );
    }

    return <>{children}</>;
}

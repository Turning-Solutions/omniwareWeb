import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import AppChrome from "@/components/AppChrome";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Omniware.lk | Premium PC Builds & Components",
    description: "Sri Lanka's premier destination for custom PC builds and high-end components.",
    icons: {
        icon: "/logo.svg",
        apple: "/logo.svg",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground`}>
                <Providers>
                    <AppChrome>{children}</AppChrome>
                </Providers>
            </body>
        </html>
    );
}

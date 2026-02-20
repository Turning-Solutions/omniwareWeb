import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Omniware.lk | Premium PC Builds & Components",
    description: "Sri Lanka's premier destination for custom PC builds and high-end components.",
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
                    <Navbar />
                    <main className="flex-grow pt-16">
                        {children}
                    </main>
                    <Footer />
                </Providers>
            </body>
        </html>
    );
}

import Link from "next/link";

const socialLinks = [
    {
        name: "Facebook",
        href: "https://www.facebook.com/OmniwareTechnologies/",
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12" />
            </svg>
        ),
    },
    {
        name: "Instagram",
        href: "https://www.instagram.com/omniwaretechnologies/",
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M12 2.16c3.2 0 3.58.01 4.84.07 1.17.05 1.8.25 2.22.41a4.5 4.5 0 0 1 1.62 1.06 4.5 4.5 0 0 1 1.06 1.62c.16.42.36 1.05.41 2.22.06 1.26.07 1.64.07 4.84s-.01 3.58-.07 4.84c-.05 1.17-.25 1.8-.41 2.22a4.5 4.5 0 0 1-1.06 1.62 4.5 4.5 0 0 1-1.62 1.06c-.42.16-1.05.36-2.22.41-1.26.06-1.64.07-4.84.07s-3.58-.01-4.84-.07c-1.17-.05-1.8-.25-2.22-.41a4.67 4.67 0 0 1-2.68-2.68c-.16-.42-.36-1.05-.41-2.22C2.17 15.74 2.16 15.36 2.16 12s.01-3.58.07-4.84c.05-1.17.25-1.8.41-2.22A4.5 4.5 0 0 1 3.7 3.32 4.5 4.5 0 0 1 5.32 2.26c.42-.16 1.05-.36 2.22-.41C8.8 1.79 9.18 1.78 12 1.78zm0 1.62c-2.79 0-3.14.01-4.36.06-1.13.05-1.74.24-2.15.4-.55.21-1 .5-1.43.93-.43.43-.72.88-.93 1.43-.16.41-.35 1.02-.4 2.15-.05 1.22-.06 1.57-.06 4.36s.01 3.14.06 4.36c.05 1.13.24 1.74.4 2.15.21.55.5 1 .93 1.43.43.43.88.72 1.43.93.41.16 1.02.35 2.15.4 1.22.05 1.57.06 4.36.06s3.14-.01 4.36-.06c1.13-.05 1.74-.24 2.15-.4.55-.21 1-.5 1.43-.93.43-.43.72-.88.93-1.43.16-.41.35-1.02.4-2.15.05-1.22.06-1.57.06-4.36s-.01-3.14-.06-4.36c-.05-1.13-.24-1.74-.4-2.15a3.05 3.05 0 0 0-.93-1.43 3.05 3.05 0 0 0-1.43-.93c-.41-.16-1.02-.35-2.15-.4-1.22-.05-1.57-.06-4.36-.06zm0 3.89A4.33 4.33 0 1 1 7.67 12 4.33 4.33 0 0 1 12 7.67zm0 7.15A2.82 2.82 0 1 0 9.18 12 2.82 2.82 0 0 0 12 14.82zm5.52-8.33a1.01 1.01 0 1 1-1.01-1.01 1.01 1.01 0 0 1 1.01 1.01z" />
            </svg>
        ),
    },
    {
        name: "TikTok",
        href: "https://www.tiktok.com/@omniware",
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M19.59 6.69A4.83 4.83 0 0 1 16.03 5V15.4A5.4 5.4 0 1 1 10.63 10v2.73a2.67 2.67 0 1 0 2.67 2.67V2h2.73a4.83 4.83 0 0 0 3.56 4.69v0z" />
            </svg>
        ),
    },
    {
        name: "X",
        href: "https://x.com/OmniwareTech",
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M18.9 2H22l-6.77 7.73L23 22h-6.12l-4.8-6.27L6.6 22H3.5l7.24-8.27L1 2h6.27l4.34 5.73L18.9 2zm-1.07 18.15h1.69L6.35 3.76H4.53l13.3 16.39z" />
            </svg>
        ),
    },
    {
        name: "Discord",
        href: "https://discord.gg/Q6yzJNBk",
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M20.32 4.37A19.8 19.8 0 0 0 15.42 3a13.69 13.69 0 0 0-.62 1.27 18.29 18.29 0 0 0-5.6 0A13.69 13.69 0 0 0 8.58 3a19.8 19.8 0 0 0-4.9 1.37C.65 8.97-.17 13.43.25 17.84A19.92 19.92 0 0 0 6.2 20.9c.48-.66.9-1.36 1.25-2.09-.69-.26-1.35-.58-1.97-.95.17-.12.34-.24.5-.37a14.2 14.2 0 0 0 12.04 0c.17.13.34.25.5.37-.62.37-1.28.69-1.97.95.35.73.77 1.43 1.25 2.09a19.92 19.92 0 0 0 5.95-3.06c.5-5.11-.85-9.53-3.43-13.47zM9.68 15.15c-1.17 0-2.13-1.08-2.13-2.4 0-1.33.95-2.4 2.13-2.4 1.18 0 2.14 1.08 2.13 2.4 0 1.33-.95 2.4-2.13 2.4zm4.64 0c-1.17 0-2.13-1.08-2.13-2.4 0-1.33.95-2.4 2.13-2.4 1.18 0 2.14 1.08 2.13 2.4 0 1.33-.95 2.4-2.13 2.4z" />
            </svg>
        ),
    },
    {
        name: "LinkedIn",
        href: "https://www.linkedin.com/company/omniwarelk/",
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.95v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.61 0 4.27 2.38 4.27 5.48v6.26zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77A1.76 1.76 0 0 0 0 1.74v20.52A1.76 1.76 0 0 0 1.77 24h20.46A1.77 1.77 0 0 0 24 22.26V1.74A1.77 1.77 0 0 0 22.23 0z" />
            </svg>
        ),
    },
];

export default function Footer() {
    return (
        <footer className="border-t border-white/10 bg-black/20 backdrop-blur-sm mt-auto">
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <span className="text-xl font-bold text-white">Omniware</span>
                        <p className="mt-2 text-sm text-gray-400">
                            Premium custom PC builds and components.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Pages</h3>
                        <ul className="mt-4 space-y-4">
                            <li>
                                <Link href="/" className="text-base text-gray-400 hover:text-white">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link href="/shop" className="text-base text-gray-400 hover:text-white">
                                    Shop
                                </Link>
                            </li>
                            <li>
                                <Link href="/about" className="text-base text-gray-400 hover:text-white">
                                    About
                                </Link>
                            </li>
                            <li>
                                <Link href="/services" className="text-base text-gray-400 hover:text-white">
                                    Services
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="text-base text-gray-400 hover:text-white">
                                    Contact
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Support</h3>
                        <ul className="mt-4 space-y-4">
                            <li>
                                <Link href="#" className="text-base text-gray-400 hover:text-white">
                                    Contact Us
                                </Link>
                            </li>
                            <li>
                                <Link href="/#faq" className="text-base text-gray-400 hover:text-white">
                                    FAQs
                                </Link>
                            </li>
                            <li>
                                <Link href="/pickup-and-delivery" className="text-base text-gray-400 hover:text-white">
                                    Pickup &amp; Delivery
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Legal</h3>
                        <ul className="mt-4 space-y-4">
                            <li>
                                <Link href="/privacy-policy" className="text-base text-gray-400 hover:text-white">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms-and-conditions" className="text-base text-gray-400 hover:text-white">
                                    Terms and Conditions
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="mt-8 border-t border-white/10 pt-8">
                    <div className="mb-5 flex justify-center gap-4">
                        {socialLinks.map((social) => (
                            <a
                                key={social.name}
                                href={social.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={social.name}
                                className="text-gray-400 transition-colors hover:text-white"
                            >
                                {social.icon}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-12 w-full border-t border-white/10 py-8">
                <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
                    <p className="order-2 text-sm font-light text-gray-400 md:order-1">
                        &copy; {new Date().getFullYear()} Omniware.lk. All Rights Reserved.
                    </p>

                    <div className="order-1 flex items-center gap-3 md:order-2">
                        <span className="text-[10px] uppercase tracking-widest text-gray-500">Created By</span>
                        <a
                            href="https://www.turingsolutions.lk/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition-all duration-300 hover:border-white/20 hover:bg-white/10"
                        >
                            <img
                                src="/tsl_logo.svg"
                                alt="Turing Solutions Ltd"
                                className="h-5 w-auto"
                            />
                            <span className="text-xs font-medium tracking-wide text-gray-300 transition-colors group-hover:text-gray-100">
                                Turing Solutions
                            </span>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}

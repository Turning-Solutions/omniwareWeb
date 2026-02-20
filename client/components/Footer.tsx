import Link from "next/link";

export default function Footer() {
    return (
        <footer className="border-t border-white/10 bg-black/20 backdrop-blur-sm mt-auto">
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <span className="text-xl font-bold text-white">Omniware</span>
                        <p className="mt-2 text-sm text-gray-400">
                            Premium custom PC builds and components.
                        </p>
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
                                <Link href="#" className="text-base text-gray-400 hover:text-white">
                                    FAQs
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 tracking-wider uppercase">Legal</h3>
                        <ul className="mt-4 space-y-4">
                            <li>
                                <Link href="#" className="text-base text-gray-400 hover:text-white">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="text-base text-gray-400 hover:text-white">
                                    Terms of Service
                                </Link>
                            </li>
                            {/* Only admin entry point */}
                            <li>
                                <Link href="/admin" className="text-base text-gray-400 hover:text-white">
                                    Admin Panel
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="mt-8 border-t border-white/10 pt-8">
                    <p className="text-base text-gray-400 text-center">
                        &copy; {new Date().getFullYear()} Omniware.lk. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}

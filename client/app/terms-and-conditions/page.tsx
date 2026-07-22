const sectionCardClass =
    "rounded-2xl border border-[#5E5E5E]/35 bg-gradient-to-b from-[#181818]/95 to-[#121212]/95 p-5 shadow-[0_16px_38px_rgba(0,0,0,0.35)] sm:p-6";

export default function TermsAndConditionsPage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-[#F1F1F1]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]" />
            <div className="pointer-events-none absolute -left-36 top-20 h-[26rem] w-[26rem] rounded-full bg-[#D12B28]/[0.08] blur-[120px]" />
            <div className="pointer-events-none absolute -right-36 bottom-20 h-[24rem] w-[24rem] rounded-full bg-[#D12B28]/[0.06] blur-[120px]" />

            <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
                <header className="overflow-hidden rounded-[1.5rem] border border-[#5E5E5E]/40 bg-[linear-gradient(180deg,#131313_0%,#101010_100%)] shadow-[0_28px_70px_rgba(0,0,0,0.45)]">
                    <div className="border-b border-[#5E5E5E]/25 px-6 py-4 sm:px-8">
                        <p className="inline-flex items-center rounded-full border border-[#D12B28]/30 bg-[#D12B28]/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D12B28]">
                            Legal
                        </p>
                    </div>
                    <div className="px-6 py-7 sm:px-8 sm:py-9">
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                            Terms and Conditions
                            <span className="text-[#D12B28]"> - Omniware</span>
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#B0B0B0] sm:text-base">
                            These Terms and Conditions govern your access to and use of our website and services. By
                            accessing our website or purchasing our products, you agree to be legally bound by these
                            Terms.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <p className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[#B0B0B0]">
                                Last Updated: April 24, 2026
                            </p>
                        </div>
                    </div>
                </header>

                <article className="mt-6 space-y-4 text-sm leading-7 text-[#D0D0D0] sm:text-base">
                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">01. Introduction</h2>
                        <p className="mt-3">
                            Welcome to Omniware. These Terms and Conditions govern your access to and use of our website
                            and services. By accessing our website or purchasing our products, you agree to be legally
                            bound by these Terms. If you do not agree with any part of these Terms, please discontinue
                            use of our website immediately.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">02. Definitions</h2>
                        <ul className="mt-3 list-disc space-y-1 pl-5">
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">&quot;Company,&quot; &quot;We,&quot; &quot;Us,&quot; &quot;Our&quot;</span> refers to
                                Omniware.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">&quot;User,&quot; &quot;You&quot;</span> refers to any individual or
                                entity accessing the website.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">&quot;Products&quot;</span> refers to computer components,
                                peripherals, and hardware sold by us.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">&quot;Services&quot;</span> refers to repairs, installations,
                                consultations, and other technical support provided by Omniware.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">03. Use of the Website</h2>
                        <p className="mt-3">You agree to use this website only for lawful purposes. Prohibited activities include:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Engaging in any activity that may damage, disable, or disrupt our services.</li>
                            <li>Attempting unauthorized access to our systems, servers, or user data.</li>
                            <li>Using the website for fraudulent, illegal, or malicious activities.</li>
                        </ul>
                        <p className="mt-2">
                            We reserve the right to restrict or terminate your access if these Terms are violated.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">04. Products and Services</h2>
                        <p className="mt-3">
                            Omniware specializes in the sale of computer hardware and the provision of technical services.
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Accuracy:</span> We strive for accuracy; however,
                                product descriptions, images, and specifications are subject to change without notice.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Availability:</span> Services are provided based on
                                availability and the specific scope agreed upon at the time of the request.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">05. Pricing and Availability</h2>
                        <ul className="mt-3 list-disc space-y-1 pl-5">
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Currency:</span> All prices are listed in Sri Lankan
                                Rupees (LKR), unless otherwise stated.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Adjustments:</span> Prices and stock levels are
                                subject to change without prior notice.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Cancellations:</span> We reserve the right to cancel
                                orders resulting from pricing errors or stock discrepancies.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">06. Orders and Payments</h2>
                        <ul className="mt-3 list-disc space-y-1 pl-5">
                            <li>Orders are considered confirmed only after successful payment verification.</li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Bank Transfers:</span> We currently accept payments
                                exclusively via bank transfer.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Verification:</span> You are required to provide
                                accurate payment details and valid proof of payment (e.g., transfer receipt or screenshot).
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Rights:</span> We reserve the right to reject any
                                order or request additional identity verification before processing.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">07. Delivery</h2>
                        <ul className="mt-3 list-disc space-y-1 pl-5">
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Timelines:</span> Delivery dates are estimates only
                                and are not guaranteed.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">External Factors:</span> Omniware is not liable for
                                delays caused by third-party couriers or factors beyond our control.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Risk:</span> The risk of loss or damage to products
                                passes to the customer upon successful delivery.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">08. Returns and Refunds</h2>
                        <ul className="mt-3 list-disc space-y-1 pl-5">
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Eligibility:</span> Returns are accepted only for
                                items that are defective upon arrival or if an incorrect item was delivered.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Condition:</span> Items must be returned in their
                                original, unopened packaging with all seals intact.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Inspection:</span> Refunds or replacements are
                                processed only after our technical team inspects the returned item.
                            </li>
                            <li>
                                <span className="font-semibold text-[#F1F1F1]">Non-returnable Items:</span> Opened hardware (unless
                                found defective), software, and special-order items are generally non-returnable.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">09. Warranty Policy</h2>
                        <p className="mt-3">
                            Many of our products carry manufacturer warranties. Claims must be made in accordance with the
                            manufacturer&apos;s specific guidelines.
                        </p>
                        <div className="mt-3 space-y-3">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <h3 className="font-semibold text-[#F1F1F1]">Exclusions</h3>
                                <p className="mt-1">
                                    Warranty does not cover damage caused by misuse, improper installation, physical damage,
                                    power surges, or unauthorized repairs.
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <h3 className="font-semibold text-[#F1F1F1]">Defined Warranty Periods</h3>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    <li>1 Year Warranty: Valid for 350 days from the date of purchase.</li>
                                    <li>2 Years Warranty: Valid for 700 days from the date of purchase.</li>
                                    <li>3 Years Warranty: Valid for 1,050 days from the date of purchase.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">10. User Accounts</h2>
                        <p className="mt-3">If you create an account on our website:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                            <li>You accept responsibility for all activities that occur under your account.</li>
                            <li>
                                We reserve the right to suspend or terminate accounts that violate these Terms or engage in
                                suspicious activity.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">11. Intellectual Property</h2>
                        <p className="mt-3">
                            All content on this website, including logos, graphics, text, product descriptions, and software, is
                            the exclusive property of Omniware. You may not copy, reproduce, or distribute any content without
                            our express written permission.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">12. Limitation of Liability</h2>
                        <p className="mt-3">To the maximum extent permitted by law, Omniware shall not be liable for:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Indirect, incidental, or consequential damages.</li>
                            <li>Loss of data, business interruption, or system failures.</li>
                            <li>Issues arising from improper installation or use of hardware purchased from us.</li>
                        </ul>
                        <p className="mt-2">Use of our products and services is at your own risk.</p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">13. Termination</h2>
                        <p className="mt-3">
                            We reserve the right to terminate your access to the website or cancel pending orders/services without
                            notice if we determine, at our sole discretion, that you have breached these Terms and Conditions.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">14. Governing Law</h2>
                        <p className="mt-3">
                            These Terms and Conditions are governed by and construed in accordance with the laws of Sri Lanka.
                            Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of
                            Sri Lanka.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-[#D12B28]/30 bg-[#D12B28]/[0.08] p-6 sm:p-7">
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">15. Contact Us</h2>
                        <p className="mt-3 text-[#D0D0D0]">For questions or clarifications regarding these Terms, contact us:</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-xs uppercase tracking-wider text-[#8E8E8E]">Email</p>
                                <a href="mailto:support@omniware.lk" className="mt-1 block text-[#F1F1F1] hover:text-[#D12B28]">
                                    support@omniware.lk
                                </a>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-xs uppercase tracking-wider text-[#8E8E8E]">Phone</p>
                                <p className="mt-1 text-[#F1F1F1]">+94 74 052 3439</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-xs uppercase tracking-wider text-[#8E8E8E]">Address</p>
                                <p className="mt-1 text-[#F1F1F1]">150/18E Bellanthara Lane, Dehiwala, Sri Lanka</p>
                            </div>
                        </div>
                    </section>
                </article>
            </div>
        </div>
    );
}

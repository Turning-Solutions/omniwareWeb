const sectionCardClass =
    "rounded-2xl border border-[#5E5E5E]/35 bg-gradient-to-b from-[#181818]/95 to-[#121212]/95 p-5 shadow-[0_16px_38px_rgba(0,0,0,0.35)] sm:p-6";

export default function PrivacyPolicyPage() {
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
                            Privacy Policy
                            <span className="text-[#D12B28]"> - Omniware</span>
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#B0B0B0] sm:text-base">
                            We value your trust and are committed to protecting your personal information when you browse our
                            website or place orders with Omniware.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <p className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[#B0B0B0]">
                                Effective Date: May 01, 2026
                            </p>
                            <p className="inline-flex rounded-full border border-[#D12B28]/30 bg-[#D12B28]/[0.12] px-3 py-1 text-xs text-[#D12B28]">
                                Last Updated Policy
                            </p>
                        </div>
                    </div>
                </header>

                <article className="mt-6 space-y-4 text-sm leading-7 text-[#D0D0D0] sm:text-base">
                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">01. Introduction</h2>
                        <p className="mt-3">
                            Welcome to Omniware. We value your trust and are committed to protecting your personal information.
                            This Privacy Policy outlines how Omniware (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) collects, uses, and safeguards
                            your data when you visit our website or purchase our products.
                        </p>
                        <p className="mt-2">By using our website, you agree to the practices described in this policy.</p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">02. Information We Collect</h2>
                        <p className="mt-3">To provide a seamless shopping experience, we collect the following types of information:</p>
                        <div className="mt-3 space-y-3">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <h3 className="font-semibold text-[#F1F1F1]">Personal Information</h3>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    <li>Identity &amp; Contact Data: Your full name, email address, and phone number.</li>
                                    <li>Shipping &amp; Billing Data: Your physical address for delivery and invoicing purposes.</li>
                                </ul>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <h3 className="font-semibold text-[#F1F1F1]">Payment Information</h3>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    <li>
                                        Transaction Records: Since we process payments via bank transfer, we collect proof of
                                        payment (such as transaction receipts, reference numbers, or screenshots) to verify your
                                        order.
                                    </li>
                                </ul>
                                <p className="mt-1 text-[#B0B0B0]">
                                    Note: We do not collect or store your private banking credentials or passwords.
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <h3 className="font-semibold text-[#F1F1F1]">Technical Data</h3>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    <li>
                                        Usage Information: Your IP address, browser type, device details, and data on how you
                                        interact with our website.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">03. How We Use Your Information</h2>
                        <p className="mt-3">We use the information we collect for the following purposes:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Order Fulfillment: To process, verify, and deliver your purchases.</li>
                            <li>Customer Support: To respond to your inquiries and resolve issues.</li>
                            <li>Communication: To send order confirmations, shipping updates, and essential service notices.</li>
                            <li>Security: To detect and prevent fraudulent transactions or unauthorized access.</li>
                            <li>Improvement: To analyze website performance and enhance our service offerings.</li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">04. Payment Verification (Bank Transfers)</h2>
                        <p className="mt-3">Omniware currently operates on a bank transfer payment model.</p>
                        <p className="mt-2">
                            Payments are made through your own banking platform; therefore, no sensitive financial data is
                            entered directly on our site.
                        </p>
                        <p className="mt-2">
                            Order processing begins only after we have manually verified the proof of payment you provide.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">05. Sharing Your Data</h2>
                        <p className="mt-3">
                            We do not sell, rent, or trade your personal information. We only share data with trusted third
                            parties necessary for our operations:
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Delivery Partners: To ship and deliver your orders.</li>
                            <li>Service Providers: For website hosting, analytics, and technical support.</li>
                            <li>
                                Legal Requirements: If required by law, we may disclose information to comply with legal
                                obligations or protect our rights and safety.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">06. Data Security</h2>
                        <p className="mt-3">
                            We implement a variety of security measures to maintain the safety of your personal information.
                            This includes secure server practices and restricted access to customer data. However, please be
                            aware that no method of electronic transmission or storage is 100% secure, and we cannot guarantee
                            absolute security.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">07. Cookies</h2>
                        <p className="mt-3">
                            Our website uses cookies to enhance your experience. Cookies help us remember your preferences and
                            understand website traffic. You can choose to disable cookies through your browser settings, though
                            this may limit your ability to use certain features of the site.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">08. Your Rights &amp; Choices</h2>
                        <p className="mt-3">You have the right to:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Access: Request a copy of the personal data we hold about you.</li>
                            <li>Correction: Request that we update or fix inaccurate information.</li>
                            <li>
                                Deletion: Request that we delete your personal data, provided it is no longer required for legal
                                or administrative purposes.
                            </li>
                        </ul>
                        <p className="mt-2">
                            To exercise these rights, please contact us at{" "}
                            <a href="mailto:support@omniware.lk" className="text-[#D12B28] hover:underline">
                                support@omniware.lk
                            </a>
                            .
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">09. Data Retention</h2>
                        <p className="mt-3">
                            We keep your personal information only for as long as is necessary to fulfill your orders, manage
                            your account, and comply with legal, accounting, or reporting requirements.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">10. Third-Party Links</h2>
                        <p className="mt-3">
                            Our website may contain links to external sites (such as social media or manufacturer websites). We
                            are not responsible for the privacy practices of these third parties. We encourage you to read their
                            policies before providing any personal data.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">11. Children&apos;s Privacy</h2>
                        <p className="mt-3">
                            Our services are intended for individuals who are at least 18 years old. We do not knowingly collect
                            personal information from children. If we become aware that a minor has provided us with data, we
                            will take steps to delete it immediately.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">12. Changes to This Policy</h2>
                        <p className="mt-3">
                            We may update this Privacy Policy from time to time to reflect changes in our services or legal
                            requirements. Any updates will be posted on this page with a revised &quot;Effective Date.&quot;
                        </p>
                    </section>

                    <section className="rounded-2xl border border-[#D12B28]/30 bg-[#D12B28]/[0.08] p-6 sm:p-7">
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">13. Contact Us</h2>
                        <p className="mt-3 text-[#D0D0D0]">
                            If you have any questions or concerns regarding this policy, please contact us:
                        </p>
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

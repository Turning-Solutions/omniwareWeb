const sectionCardClass =
    "rounded-2xl border border-[#5E5E5E]/35 bg-gradient-to-b from-[#181818]/95 to-[#121212]/95 p-5 shadow-[0_16px_38px_rgba(0,0,0,0.35)] sm:p-6";

export default function PickupAndDeliveryPage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-[#F1F1F1]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]" />
            <div className="pointer-events-none absolute -left-36 top-20 h-[26rem] w-[26rem] rounded-full bg-[#D12B28]/[0.08] blur-[120px]" />
            <div className="pointer-events-none absolute -right-36 bottom-20 h-[24rem] w-[24rem] rounded-full bg-[#D12B28]/[0.06] blur-[120px]" />

            <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
                <header className="overflow-hidden rounded-[1.5rem] border border-[#5E5E5E]/40 bg-[linear-gradient(180deg,#131313_0%,#101010_100%)] shadow-[0_28px_70px_rgba(0,0,0,0.45)]">
                    <div className="border-b border-[#5E5E5E]/25 px-6 py-4 sm:px-8">
                        <p className="inline-flex items-center rounded-full border border-[#D12B28]/30 bg-[#D12B28]/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D12B28]">
                            Support
                        </p>
                    </div>
                    <div className="px-6 py-7 sm:px-8 sm:py-9">
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                            Pickup &amp; Delivery
                            <span className="text-[#D12B28]"> - Omniware</span>
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#B0B0B0] sm:text-base">
                            At Omniware, we focus on ensuring every order runs smoothly from checkout to handover. Here&apos;s
                            how our delivery, tracking, and pickup process works.
                        </p>
                    </div>
                </header>

                <article className="mt-6 space-y-4 text-sm leading-7 text-[#D0D0D0] sm:text-base">
                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">How Orders Are Processed</h2>
                        <ul className="mt-3 list-disc space-y-1 pl-5">
                            <li>Orders are confirmed after full payment is completed.</li>
                            <li>In-stock items are typically processed and dispatched within the same day.</li>
                            <li>Every order is carefully packed to ensure safe delivery.</li>
                            <li>
                                Once your order is ready, it will either be shipped via courier or prepared for pickup, based on
                                your selection.
                            </li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Delivery Options</h2>
                        <h3 className="mt-3 font-semibold text-[#F1F1F1]">Islandwide Courier Delivery</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>We deliver across Sri Lanka using reliable courier services.</li>
                            <li>Delivery time: 1-3 working days</li>
                            <li>Available for all eligible items.</li>
                            <li>Tracking provided after dispatch</li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Pickup Option</h2>
                        <p className="mt-3">Prefer to collect your order yourself? We&apos;ve got you covered.</p>
                        <h3 className="mt-3 font-semibold text-[#F1F1F1]">How Pickup Works</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Place your order and complete payment.</li>
                            <li>Wait for confirmation from our team.</li>
                            <li>Visit our location to collect your item.</li>
                        </ul>
                        <h3 className="mt-4 font-semibold text-[#F1F1F1]">Important</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Pickup is only available after confirmation.</li>
                            <li>Bring your order details or confirmation message.</li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Delivery Charges</h2>
                        <ul className="mt-3 list-disc space-y-1 pl-5">
                            <li>Delivery fees depend on location and item size/weight.</li>
                            <li>Charges are clearly confirmed before dispatch.</li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Order Tracking</h2>
                        <p className="mt-3">
                            Once your order is shipped, you&apos;ll receive a tracking link via WhatsApp or SMS. With this, you can
                            monitor your delivery status.
                        </p>
                        <div className="mt-4 rounded-xl border border-[#D12B28]/45 bg-[#D12B28]/[0.12] p-4">
                            <p className="text-sm font-semibold text-[#F1F1F1]">Track Your Order</p>
                            <a
                                href="https://www.fdedomestic.com/#track"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center rounded-md bg-[#D12B28] px-3 py-1.5 font-semibold text-white transition hover:bg-[#E53A36]"
                            >
                                https://www.fdedomestic.com/#track
                            </a>
                        </div>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Important Delivery Notes</h2>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Make sure your contact number and address are accurate.</li>
                            <li>The courier may contact you before delivery.</li>
                        </ul>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Delays &amp; Support</h2>
                        <p className="mt-3">Delays are rare but can happen due to:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Courier issues</li>
                            <li>Weather conditions</li>
                            <li>High demand periods</li>
                        </ul>
                        <p className="mt-3">
                            If you need help with your order, feel free to reach out. We&apos;re here to assist.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-[#D12B28]/30 bg-[#D12B28]/[0.08] p-6 sm:p-7">
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Need Help?</h2>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-xs uppercase tracking-wider text-[#8E8E8E]">WhatsApp / Call</p>
                                <p className="mt-1 text-[#F1F1F1]">+94 74 052 3439</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-xs uppercase tracking-wider text-[#8E8E8E]">Email</p>
                                <a href="mailto:support@omniware.lk" className="mt-1 block text-[#F1F1F1] hover:text-[#D12B28]">
                                    support@omniware.lk
                                </a>
                            </div>
                        </div>
                        <p className="mt-4 text-[#D0D0D0]">
                            We&apos;ll make sure your experience with Omniware stays smooth from start to finish.
                        </p>
                    </section>
                </article>
            </div>
        </div>
    );
}

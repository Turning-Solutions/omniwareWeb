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
                            Shipping &amp; Pickup Information
                            <span className="text-[#D12B28]"> - Omniware</span>
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#B0B0B0] sm:text-base">
                            At Omniware Technologies, we provide flexible options for you to receive your order safely and
                            conveniently.
                        </p>
                    </div>
                </header>

                <article className="mt-6 space-y-4 text-sm leading-7 text-[#D0D0D0] sm:text-base">
                    <section className={sectionCardClass}>
                        <p>
                            Customers can choose store pickup, third-party pickup, or island-wide courier delivery depending on
                            their preference.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Pickup Options</h2>

                        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <h3 className="font-semibold text-[#F1F1F1]">In-Store Pickup</h3>
                            <p className="mt-2">
                                Customers can collect their order directly from our store. Once your order is placed through our
                                website or by bank transfer, we will prepare the item(s) for collection.
                            </p>
                            <p className="mt-2">
                                You will receive a confirmation message when the order is ready. Please wait for this
                                confirmation before visiting the store.
                            </p>
                        </div>

                        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <h3 className="font-semibold text-[#F1F1F1]">
                                Third-Party Pickup (PickMe / Uber / Other Services)
                            </h3>
                            <p className="mt-2">
                                If you need your order on the same day but cannot visit the store, you may arrange a third-party
                                delivery service such as PickMe or Uber.
                            </p>
                            <p className="mt-2">Before booking the delivery:</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                <li>Wait until we confirm your order is ready for pickup.</li>
                                <li>Book the delivery service.</li>
                                <li>Select the appropriate vehicle type depending on the product size.</li>
                            </ul>
                            <p className="mt-3 text-[#B0B0B0]">Note: Delivery charges must be paid by the customer.</p>
                        </div>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Delivery Options</h2>
                        <h3 className="mt-3 font-semibold text-[#F1F1F1]">Island-Wide Courier Delivery</h3>
                        <p className="mt-2">
                            We offer island-wide delivery through trusted courier partners to ensure your order arrives safely.
                        </p>
                        <p className="mt-2">Delivery charges may vary depending on:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Package weight</li>
                            <li>Number of items</li>
                            <li>Delivery location</li>
                        </ul>
                        <p className="mt-3 text-[#B0B0B0]">All courier charges must be paid by the customer.</p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Order Processing</h2>
                        <p className="mt-3">
                            Most orders are processed on the same day after payment confirmation. If the order cannot be
                            processed on the same day, it will be processed and dispatched on the next working day.
                        </p>
                    </section>

                    <section className={sectionCardClass}>
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Delivery Time</h2>
                        <p className="mt-3">Orders are typically delivered within 1-3 working days after dispatch.</p>
                        <p className="mt-2">Delivery times may vary due to unexpected situations such as:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                            <li>Weather conditions</li>
                            <li>Floods or natural disruptions</li>
                            <li>Courier service delays</li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-[#D12B28]/30 bg-[#D12B28]/[0.08] p-6 sm:p-7">
                        <h2 className="text-lg font-semibold text-[#F1F1F1]">Order Tracking</h2>
                        <p className="mt-3 text-[#D0D0D0]">
                            Once your order has been handed over to the courier, we will send the tracking details via WhatsApp.
                        </p>
                        <p className="mt-2 text-[#D0D0D0]">
                            Please ensure your delivery information is accurate to avoid delays and ensure your order reaches you
                            safely.
                        </p>
                    </section>
                </article>
            </div>
        </div>
    );
}

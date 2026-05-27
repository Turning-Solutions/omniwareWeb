export default function LoadingProductPage() {
    return (
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a] text-[#F1F1F1]">
            <div className="relative flex flex-1 flex-col bg-[linear-gradient(180deg,#080808_0%,#0c0c0c_18%,#101010_45%,#0d0d0d_72%,#0a0a0a_100%)] pt-24 pb-16">
                <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 animate-pulse">
                    <div className="mb-8 h-10 w-28 rounded-xl bg-white/[0.08]" />
                    <div className="mb-6 h-4 w-32 rounded-full bg-white/[0.08]" />
                    <div className="mb-12 h-10 w-2/3 rounded-xl bg-white/[0.08]" />
                    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:gap-14">
                        <div className="aspect-square rounded-2xl border border-white/[0.07] bg-white/[0.05]" />
                        <div className="space-y-4">
                            <div className="h-6 w-1/3 rounded-full bg-white/[0.08]" />
                            <div className="h-4 w-full rounded-full bg-white/[0.08]" />
                            <div className="h-4 w-5/6 rounded-full bg-white/[0.08]" />
                            <div className="h-12 w-full rounded-xl bg-white/[0.08]" />
                            <div className="h-12 w-full rounded-xl bg-white/[0.08]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

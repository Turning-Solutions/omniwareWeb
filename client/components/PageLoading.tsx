import LoadingAnimation from "@/components/LoadingAnimation";

interface PageLoadingProps {
    label?: string;
}

/** Full-page loading state for Next.js `loading.tsx` and other route transitions. */
export default function PageLoading({ label = "Loading page..." }: PageLoadingProps) {
    return (
        <div className="flex w-full min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center bg-[#121212] px-4 py-16">
            <LoadingAnimation size="lg" label={label} />
        </div>
    );
}

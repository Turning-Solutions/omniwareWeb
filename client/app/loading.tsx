import LoadingAnimation from "@/components/LoadingAnimation";

export default function Loading() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <LoadingAnimation size="lg" label="Loading page..." />
        </div>
    );
}

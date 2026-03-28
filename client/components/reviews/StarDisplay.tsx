import { Star } from "lucide-react";

export default function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <Star
                    key={n}
                    className={n <= rating ? "fill-amber-400 text-amber-400" : "text-[#3f3f3f]"}
                    size={size}
                    strokeWidth={n <= rating ? 0 : 1.5}
                    aria-hidden
                />
            ))}
        </div>
    );
}

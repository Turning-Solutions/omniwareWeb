import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import HomePageClient from "./HomePageClient";
import { prefetchHomeFeaturedProducts, prefetchHomePartners, prefetchHomePromotions } from "@/lib/homeInitialFetch";

export default async function HomePage() {
  const queryClient = new QueryClient();
    await Promise.all([
        prefetchHomePromotions(queryClient),
        prefetchHomeFeaturedProducts(queryClient),
        prefetchHomePartners(queryClient),
    ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePageClient />
    </HydrationBoundary>
  );
}

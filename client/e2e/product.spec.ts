import { test, expect } from "@playwright/test";

test.describe("Product page", () => {
    test.beforeEach(async ({ page }) => {
        // Mock product details endpoint used by `useProduct(slug)`
        await page.route(/\/api\/v1\/products\/alpha-gpu(\?|$)/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    _id: "p1",
                    slug: "alpha-gpu",
                    title: "Alpha GPU",
                    description: "Alpha GPU description",
                    price: 100000,
                    originalPrice: 100000,
                    discountedPrice: 100000,
                    effectiveDiscountPercent: 0,
                    discountPercent: 0,
                    images: ["/placeholder.svg"],
                    category: "gpu",
                    categoryIds: [{ _id: "c1", name: "GPU" }],
                    brand: "NVIDIA",
                    brandId: { _id: "b1", name: "NVIDIA" },
                    countInStock: 10,
                    stock: { qty: 10 },
                    rating: 4.5,
                    numReviews: 1,
                    availability: "in_stock",
                    warranty: "1 Year",
                    variants: [],
                    colorVariants: [],
                    specs: {},
                    attributes: [],
                    attributeGroups: [
                        {
                            category: "General",
                            attributes: [{ name: "Model", value: "Alpha" }],
                        },
                    ],
                }),
            });
        });

        // Mock product reviews endpoint used by `ProductReviewsSection`
        await page.route(/\/api\/v1\/reviews\/product\/p1(\?|$)/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    reviews: [],
                    total: 0,
                    page: 1,
                    pageSize: 5,
                }),
            });
        });
    });

    test("loads product details", async ({ page }) => {
        await page.goto("/product/alpha-gpu");

        await expect(page.getByRole("heading", { name: "Alpha GPU" })).toBeVisible();
        await expect(page.getByText("In Stock", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Add to Cart" })).toBeVisible();

        // Should not show the global loader; params+data loading should be handled inside the page.
        await expect(page.getByText("Loading page...")).toHaveCount(0);
    });
});


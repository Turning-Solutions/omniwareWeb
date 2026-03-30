import { test, expect } from '@playwright/test';

type Availability = 'in_stock' | 'out_of_stock' | 'pre_order' | 'coming_soon';

type ShopProduct = {
    _id: string;
    slug: string;
    title: string;
    price: number;
    images: string[];
    category: string;
    brand: string;
    countInStock: number;
    availability: Availability;
    stock?: { qty?: number };
};

type FacetOption = { value: string; label: string; count: number };

const SHOP_DATA = {
    gpu: {
        products: [
            {
                _id: 'p1',
                slug: 'alpha-gpu',
                title: 'Alpha GPU',
                price: 100000,
                images: ['/placeholder.svg'],
                category: 'gpu',
                brand: 'NVIDIA',
                countInStock: 10,
                availability: 'in_stock',
            },
            {
                _id: 'p2',
                slug: 'beta-gpu',
                title: 'Beta GPU',
                price: 200000,
                images: ['/placeholder.svg'],
                category: 'gpu',
                brand: 'AMD',
                countInStock: 5,
                availability: 'in_stock',
            },
        ] satisfies ShopProduct[],
        facets: {
            price: { min: 50000, max: 250000 },
            categories: [
                { value: 'gpu', label: 'GPU', count: 2 },
                { value: 'cpu', label: 'CPU', count: 2 },
            ],
            brands: [
                { value: 'nvidia', label: 'NVIDIA', count: 1 },
                { value: 'amd', label: 'AMD', count: 1 },
            ] satisfies FacetOption[],
            specs: {
                vram: [
                    { value: '16GB', count: 1 },
                    { value: '8GB', count: 1 },
                ],
            },
            allowedFilters: {
                price: true,
                availability: true,
                brand: true,
            },
        },
    },
    cpu: {
        products: [
            {
                _id: 'p3',
                slug: 'alpha-cpu',
                title: 'Alpha CPU',
                price: 50000,
                images: ['/placeholder.svg'],
                category: 'cpu',
                brand: 'INTEL',
                countInStock: 7,
                availability: 'in_stock',
            },
            {
                _id: 'p4',
                slug: 'beta-cpu',
                title: 'Beta CPU',
                price: 75000,
                images: ['/placeholder.svg'],
                category: 'cpu',
                brand: 'AMD',
                countInStock: 3,
                availability: 'in_stock',
            },
        ] satisfies ShopProduct[],
        facets: {
            price: { min: 20000, max: 120000 },
            categories: [
                { value: 'gpu', label: 'GPU', count: 2 },
                { value: 'cpu', label: 'CPU', count: 2 },
            ],
            brands: [
                { value: 'intel', label: 'INTEL', count: 1 },
                { value: 'amd', label: 'AMD', count: 1 },
            ] satisfies FacetOption[],
            specs: {
                socket: [
                    { value: 'LGA1700', count: 1 },
                    { value: 'AM4', count: 1 },
                ],
            },
            allowedFilters: {
                price: true,
                availability: true,
                brand: true,
            },
        },
    },
};

function parseRequestedCategory(url: string): 'gpu' | 'cpu' | null {
    const u = new URL(url);
    const category = u.searchParams.get('category')?.toLowerCase() ?? '';
    if (category === 'gpu') return 'gpu';
    if (category === 'cpu') return 'cpu';
    return null;
}

function parseRequestedBrands(url: string): string[] {
    const u = new URL(url);
    const brandParam = u.searchParams.get('brand') ?? '';
    if (!brandParam) return [];
    return brandParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function normalizeBrandSlugToBrandName(slug: string): string {
    const s = slug.trim().toLowerCase();
    if (s === 'nvidia') return 'NVIDIA';
    if (s === 'amd') return 'AMD';
    if (s === 'intel') return 'INTEL';
    return slug.toUpperCase();
}

function productsForCategoryAndBrands(category: 'gpu' | 'cpu', brands: string[]): ShopProduct[] {
    const all = SHOP_DATA[category].products;
    if (brands.length === 0) return all;
    const allowedBrandNames = new Set(brands.map(normalizeBrandSlugToBrandName));
    return all.filter((p) => allowedBrandNames.has(p.brand));
}

function facetsForCategory(category: 'gpu' | 'cpu'): unknown {
    return SHOP_DATA[category].facets;
}

async function mockProductsRoutes(page: any) {
    // Facets must be registered before products because both match `**/api/v1/products*`.
    await page.route(/\/api\/v1\/products\/facets(\?|$)/, async (route) => {
        const requestedCategory = parseRequestedCategory(route.request().url());
        const category = requestedCategory ?? 'gpu';
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ facets: facetsForCategory(category) }),
        });
    });

    await page.route(/\/api\/v1\/products\?/, async (route) => {
        const requestedCategory = parseRequestedCategory(route.request().url());
        const category = requestedCategory ?? 'gpu';
        const brands = parseRequestedBrands(route.request().url());

        const products = productsForCategoryAndBrands(category, brands);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                products,
                page: 1,
                pages: 1,
                total: products.length,
            }),
        });
    });
}

test.describe('Shop / Filters / Cart', () => {
    test.beforeEach(async ({ page }) => {
        // Clear cart exactly once per test, not on every navigation.
        // `addInitScript` runs for each new document, so we gate it via sessionStorage.
        await page.addInitScript(() => {
            try {
                if (!sessionStorage.getItem('e2e-cart-cleared')) {
                    window.localStorage.clear();
                    sessionStorage.setItem('e2e-cart-cleared', '1');
                }
            } catch {
                // ignore
            }
        });
        await mockProductsRoutes(page);
    });

    test('loads shop category products', async ({ page }) => {
        await page.goto('/shop/gpu');

        await expect(page.getByRole('button', { name: 'Add Alpha GPU to cart' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Beta GPU to cart' })).toBeVisible();
    });

    test('brand filter updates products and add-to-cart works', async ({ page }) => {
        await page.goto('/shop/gpu');

        // Both products exist initially.
        await expect(page.getByRole('button', { name: 'Add Alpha GPU to cart' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Beta GPU to cart' })).toBeVisible();

        // Apply brand filter via sidebar.
        await expect(page.locator('#filter-panel-brands').getByText('NVIDIA', { exact: true })).toBeVisible();
        await page.locator('#filter-panel-brands').getByText('NVIDIA', { exact: true }).click();

        // Ensure the filtered product set is rendered.
        await expect(page.getByRole('button', { name: 'Add Alpha GPU to cart' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Beta GPU to cart' })).toHaveCount(0);

        // Add the visible product to cart.
        await page.getByRole('button', { name: 'Add Alpha GPU to cart' }).click();

        // Cart should reflect the selected item (local storage based).
        await page.goto('/cart');
        await expect(page.getByRole('heading', { name: 'Shopping Cart' })).toBeVisible();
        await expect(page.getByText('Alpha GPU', { exact: true })).toBeVisible();
        await expect(page.getByText(/LKR\s*100,?000\s*x\s*1/)).toBeVisible();
    });

    test('category filter updates products', async ({ page }) => {
        await page.goto('/shop/gpu');

        await expect(page.getByRole('button', { name: 'Add Alpha GPU to cart' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Alpha CPU to cart' })).toHaveCount(0);

        // Switch category to CPU.
        await expect(page.locator('#filter-panel-categories').getByText('CPU', { exact: true })).toBeVisible();
        await page.locator('#filter-panel-categories').getByText('CPU', { exact: true }).click();

        await expect(page.getByRole('button', { name: 'Add Alpha CPU to cart' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Alpha GPU to cart' })).toHaveCount(0);
    });
});


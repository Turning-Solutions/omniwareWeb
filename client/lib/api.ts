import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Public product listing/facet GETs are CDN-cached (Cache-Control: public, s-maxage).
 * Sending an Authorization header would make shared caches skip them, so logged-in
 * users would lose the cache benefit on endpoints that never read the token anyway.
 * Note: admin endpoints live under /admin/products and do NOT match this pattern.
 */
const isPublicProductsUrl = (url: string): boolean => /^\/?products(\/|\?|$)/.test(url);

// Attach Bearer token from localStorage when present (for admin and authenticated requests)
api.interceptors.request.use((config) => {
    if (typeof window === 'undefined') return config;
    const method = config.method?.toLowerCase();
    const url = typeof config.url === 'string' ? config.url : '';
    const skipAuth = method === 'get' && isPublicProductsUrl(url);
    if (!skipAuth) {
        try {
            const raw = localStorage.getItem('userInfo');
            const data = raw ? JSON.parse(raw) : {};
            const token = data?.token;
            if (token) config.headers.Authorization = `Bearer ${token}`;
        } catch {
            // ignore
        }
    }
    // When sending FormData (e.g. file upload), do not set Content-Type so the browser sets multipart/form-data with boundary
    if (config.data && typeof FormData !== 'undefined' && config.data instanceof FormData) {
        const h = config.headers as { set?: (k: string, v: unknown) => void };
        if (typeof h?.set === 'function') {
            h.set('Content-Type', false);
        } else {
            delete (config.headers as Record<string, unknown>)['Content-Type'];
        }
    }
    return config;
});

export default api;

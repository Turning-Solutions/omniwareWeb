import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach Bearer token from localStorage when present (for admin and authenticated requests)
api.interceptors.request.use((config) => {
    if (typeof window === 'undefined') return config;
    // Avoid cached 304 responses on product listing/facets (browser may send If-None-Match; empty JSON breaks the shop grid).
    const method = config.method?.toLowerCase();
    const url = typeof config.url === 'string' ? config.url : '';
    if (method === 'get' && url.includes('products')) {
        const h = config.headers;
        if (typeof (h as { set?: (k: string, v: string) => void }).set === 'function') {
            (h as { set: (k: string, v: string) => void }).set('Cache-Control', 'no-cache');
            (h as { set: (k: string, v: string) => void }).set('Pragma', 'no-cache');
        } else {
            (h as Record<string, string>)['Cache-Control'] = 'no-cache';
            (h as Record<string, string>)['Pragma'] = 'no-cache';
        }
    }
    try {
        const raw = localStorage.getItem('userInfo');
        const data = raw ? JSON.parse(raw) : {};
        const token = data?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
        // ignore
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

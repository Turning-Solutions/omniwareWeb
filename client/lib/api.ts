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
    try {
        const raw = localStorage.getItem('userInfo');
        const data = raw ? JSON.parse(raw) : {};
        const token = data?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
        // ignore
    }
    return config;
});

export default api;

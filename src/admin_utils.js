import fallbackData from './data/products.json';

// ─────────────────────────────────────────────────────────
// 🔗  Replace this with your deployed Apps Script Web App URL
// Extensions → Apps Script → Deploy → New Deployment → Web App
// Execute as: Me  |  Access: Anyone
// ─────────────────────────────────────────────────────────
const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbygRcPiy6ExpGOpmS0n3pxkM6a-FDFnv3gOf_k6i0HPlW8roSNFTaLZjdORNws6wE4RIA/exec';

// In-memory cache (lives for the duration of the page session)
let _cache = null;

export const adminUtils = {

    /**
     * Fetch products from Google Sheets via Apps Script.
     * Results are cached so subsequent calls are instant.
     * Falls back to the local products.json if the API is unreachable.
     */
    getProducts: async () => {
        if (_cache) return _cache;

        // If no URL configured yet, use fallback immediately
        if (!SHEETS_API_URL || SHEETS_API_URL === 'https://script.google.com/macros/s/AKfycbygRcPiy6ExpGOpmS0n3pxkM6a-FDFnv3gOf_k6i0HPlW8roSNFTaLZjdORNws6wE4RIA/exec') {
            console.warn('[adminUtils] SHEETS_API_URL not set — using local products.json');
            _cache = [...fallbackData];
            return _cache;
        }

        try {
            const res = await fetch(SHEETS_API_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _cache = await res.json();
            console.info(`[adminUtils] Loaded ${_cache.length} products from Google Sheets`);
        } catch (err) {
            console.warn('[adminUtils] Sheets API failed, using local fallback:', err.message);
            _cache = [...fallbackData];
        }

        return _cache;
    },

    /** Force a fresh fetch on next call (e.g. after editing the sheet) */
    clearCache: () => { _cache = null; },

    /** Add or update a product in the in-memory cache only */
    upsertProduct: (product) => {
        if (!_cache) return;
        const i = _cache.findIndex(p => p.id === product.id);
        if (i > -1) _cache[i] = product;
        else _cache.push(product);
    },

    /** Remove a product from the in-memory cache only */
    deleteProduct: (id) => {
        if (!_cache) return;
        const i = _cache.findIndex(p => p.id === id);
        if (i > -1) _cache.splice(i, 1);
    },

    /** Export current (in-memory) products as a downloadable JSON string */
    exportJSON: () => {
        return JSON.stringify(_cache || fallbackData, null, 2);
    },

    /** Fetch orders (falls back to sessionStorage for recent orders) */
    fetchOrders: async (webhookUrl) => {
        try {
            const response = await fetch(webhookUrl);
            if (response.ok) return await response.json();
            return JSON.parse(sessionStorage.getItem('captured_orders') || '[]');
        } catch (e) {
            return JSON.parse(sessionStorage.getItem('captured_orders') || '[]');
        }
    }
};

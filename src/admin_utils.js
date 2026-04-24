import productsData from './data/products.json';

const STORAGE_KEY = 'admin_products';

export const adminUtils = {
    // Get products from storage or fallback to static json
    getProducts: () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : productsData;
    },

    // Save products to local storage
    saveProducts: (products) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    },

    // Add or Update a product
    upsertProduct: (product) => {
        const products = adminUtils.getProducts();
        const index = products.findIndex(p => p.id === product.id);
        if (index > -1) {
            products[index] = product;
        } else {
            products.push(product);
        }
        adminUtils.saveProducts(products);
    },

    // Delete a product
    deleteProduct: (id) => {
        const products = adminUtils.getProducts().filter(p => p.id !== id);
        adminUtils.saveProducts(products);
    },

    // Export products.json content
    exportJSON: () => {
        const products = adminUtils.getProducts();
        return JSON.stringify(products, null, 2);
    },

    // Fetch orders from Google Sheets (Mocking it for now if we don't have a GET endpoint)
    fetchOrders: async (webhookUrl) => {
        try {
            // If the user's Apps Script doesn't support GET, this will fail.
            // We fallback to session storage for "recent" orders on this machine.
            const response = await fetch(webhookUrl);
            if (response.ok) return await response.json();
            return JSON.parse(sessionStorage.getItem('captured_orders') || '[]');
        } catch (e) {
            return JSON.parse(sessionStorage.getItem('captured_orders') || '[]');
        }
    }
};

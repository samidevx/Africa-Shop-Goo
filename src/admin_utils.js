import productsData from './data/products.json';

export const adminUtils = {
    // Always read directly from static products.json (no localStorage)
    getProducts: () => {
        return productsData;
    },

    // No-op: editing is done via export + commit to products.json
    saveProducts: (_products) => { /* no-op: use exportJSON to save */ },

    // Add or Update a product (in-memory only, use exportJSON to persist)
    upsertProduct: (product) => {
        const index = productsData.findIndex(p => p.id === product.id);
        if (index > -1) {
            productsData[index] = product;
        } else {
            productsData.push(product);
        }
    },

    // Delete a product (in-memory only, use exportJSON to persist)
    deleteProduct: (id) => {
        const index = productsData.findIndex(p => p.id === id);
        if (index > -1) productsData.splice(index, 1);
    },

    // Export current products as a downloadable products.json
    exportJSON: () => {
        return JSON.stringify(productsData, null, 2);
    },

    // Fetch orders (falls back to sessionStorage for recent orders)
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

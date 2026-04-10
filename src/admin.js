const admin = {
    config: {
        token: '',
        repo: '', 
        path: 'src/data/products.json'
    },
    state: {
        products: [],
        currentSha: '',
        editingId: null,
        isNew: false
    },
    CONFIG_PASSWORD: '13081999islam@',

    init() {
        // Load saved repo
        const savedRepo = localStorage.getItem('gh_repo');
        const sessionActive = sessionStorage.getItem('admin_session') === 'true';

        if (savedRepo) {
            document.getElementById('repo-name').value = savedRepo;
        }

        // Auto-login if session is active and we have a token
        if (sessionActive && localStorage.getItem('gh_token') && savedRepo) {
            this.config.token = localStorage.getItem('gh_token');
            this.config.repo = savedRepo;
            this.fetchProducts().then(() => {
                document.getElementById('login-overlay').style.display = 'none';
            }).catch(() => {
                sessionStorage.removeItem('admin_session');
            });
        }
    },

    toggleSetup() {
        const setup = document.getElementById('token-setup');
        setup.style.display = setup.style.display === 'none' ? 'block' : 'none';
    },

    async login() {
        const passwordInput = document.getElementById('admin-password').value.trim();
        const repoInput = document.getElementById('repo-name').value.trim();
        const tokenInput = document.getElementById('gh-token').value.trim();

        // 1. Check Password
        if (passwordInput !== this.CONFIG_PASSWORD) {
            alert("❌ Mot de passe incorrect.");
            return;
        }

        // 2. Check Repo
        if (!repoInput || !repoInput.includes('/')) {
            alert("⚠️ Veuillez entrer un repository valide (ex: samidevx/Africa-Shop-Goo).");
            return;
        }

        // 3. Handle Token (Use provided or load saved)
        const savedToken = localStorage.getItem('gh_token');
        this.config.token = tokenInput || savedToken;
        this.config.repo = repoInput;

        if (!this.config.token) {
            alert("🔧 Master Key manquante. Cliquez sur 'Config GitHub' pour entrer votre Token GitHub une première fois.");
            document.getElementById('token-setup').style.display = 'block';
            return;
        }

        const btn = document.querySelector('.login-btn');
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Connexion...';
        btn.disabled = true;

        try {
            await this.fetchProducts();
            
            // Save settings for next time
            localStorage.setItem('gh_repo', this.config.repo);
            if (tokenInput) localStorage.setItem('gh_token', tokenInput);
            sessionStorage.setItem('admin_session', 'true');

            document.getElementById('login-overlay').style.display = 'none';
            this.showToast("🚀 Dashboard déverrouillé !");
        } catch (err) {
            console.error("Erreur:", err);
            alert("❌ Échec de connexion: " + err.message + "\n\nVérifiez votre Token GitHub dans 'Config GitHub'.");
            btn.innerText = "Accéder au Dashboard";
            btn.disabled = false;
        }
    },

    logout() {
        localStorage.removeItem('gh_token');
        localStorage.removeItem('gh_repo');
        location.reload();
    },

    async fetchProducts() {
        const url = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.path}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${this.config.token}` }
        });

        if (!res.ok) {
            const errorBody = await res.json();
            throw new Error(errorBody.message || ("Code " + res.status));
        }

        const data = await res.json();
        this.state.currentSha = data.sha;
        
        // Decode base64 content
        const content = atob(data.content.replace(/\n/g, ''));
        this.state.products = JSON.parse(decodeURIComponent(escape(content)));
        
        this.renderGrid();
    },

    renderGrid(filter = '') {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';

        const visibleProducts = this.state.products.filter(p => 
            p.title.toLowerCase().includes(filter.toLowerCase()) || 
            p.id.toLowerCase().includes(filter.toLowerCase())
        );

        visibleProducts.forEach(p => {
            const card = document.createElement('div');
            card.className = 'prod-card';
            const isLP = (p.isLandingPage || '').toUpperCase() === 'YES';

            card.innerHTML = `
                <img src="${p.featuredImage}" class="prod-thumb" onerror="this.src='https://placehold.co/400x400?text=No+Image'">
                <div class="prod-info">
                    <h3>${p.title}</h3>
                    <div class="prod-meta">
                        <span class="prod-price">${p.price} ${p.currency}</span>
                        <span class="prod-status ${isLP ? 'status-lp' : 'status-reg'}">
                            ${isLP ? 'Landing Page' : 'Standard'}
                        </span>
                    </div>
                    <div class="card-btns">
                        <button class="btn-sm" onclick="admin.openEditor('${p.id}')"><i class="fa fa-edit"></i> Edit</button>
                        <button class="btn-sm btn-del" onclick="admin.deleteProduct('${p.id}')"><i class="fa fa-trash"></i></button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    filterProducts(val) {
        this.renderGrid(val);
    },

    openEditor(id = null) {
        this.state.editingId = id;
        this.state.isNew = !id;
        const form = document.getElementById('product-form');
        const title = document.getElementById('editor-title');
        
        form.reset();
        document.getElementById('preview-img').style.display = 'none';
        document.getElementById('preview-placeholder').style.display = 'block';

        if (id) {
            title.innerText = "Modifier Produit";
            const p = this.state.products.find(x => x.id === id);
            if (p) {
                // Fill form
                Object.keys(p).forEach(key => {
                    const input = form.querySelector(`[name="${key}"]`);
                    if (input) {
                        if (key === 'variation_color' || key === 'variation_size') {
                            input.value = Array.isArray(p[key]) ? p[key].join(', ') : p[key];
                        } else {
                            input.value = p[key];
                        }
                    }
                });
                this.updatePreview(p.featuredImage);
            }
        } else {
            title.innerText = "Nouveau Produit";
            form.querySelector('[name="currency"]').value = "XOF";
        }

        document.getElementById('editor-modal').classList.add('open');
    },

    closeEditor() {
        document.getElementById('editor-modal').classList.remove('open');
    },

    updatePreview(url) {
        const img = document.getElementById('preview-img');
        const placeholder = document.getElementById('preview-placeholder');
        if (url && url.startsWith('http')) {
            img.src = url;
            img.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            img.style.display = 'none';
            placeholder.style.display = 'block';
        }
    },

    async saveProduct() {
        const form = document.getElementById('product-form');
        const formData = new FormData(form);
        const pData = {};

        formData.forEach((value, key) => {
            if (key === 'variation_color' || key === 'variation_size') {
                pData[key] = value.split(',').map(s => s.trim()).filter(s => s !== '');
            } else {
                pData[key] = value;
            }
        });

        // Ensure review logic fits our standard
        if (!pData.reviews) pData.reviews = [];
        if (!pData.gallery) pData.gallery = [pData.featuredImage];

        if (this.state.isNew) {
            this.state.products.push(pData);
        } else {
            const index = this.state.products.findIndex(x => x.id === this.state.editingId);
            this.state.products[index] = pData;
        }

        await this.syncToGitHub("Update product: " + pData.title);
        this.closeEditor();
        this.renderGrid();
        this.showToast("Produit sauvegardé !");
    },

    async deleteProduct(id) {
        if (!confirm("Voulez-vous vraiment supprimer ce produit ?")) return;
        
        this.state.products = this.state.products.filter(x => x.id !== id);
        await this.syncToGitHub("Delete product: " + id);
        this.renderGrid();
        this.showToast("Produit supprimé !");
    },

    async syncToGitHub(message) {
        const url = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.path}`;
        
        // 🔹 FORCE REFRESH THE SHA (Prevent "does not match" errors)
        const checkRes = await fetch(url, {
            headers: { 'Authorization': `Bearer ${this.config.token}` }
        });
        if (checkRes.ok) {
            const checkData = await checkRes.json();
            this.state.currentSha = checkData.sha;
        }

        // Encode content to Base64 (handling UTF-8 correctly)
        const jsonStr = JSON.stringify(this.state.products, null, 2);
        const content = btoa(unescape(encodeURIComponent(jsonStr)));

        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.config.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                content: content,
                sha: this.state.currentSha
            })
        });

        if (!res.ok) {
            const err = await res.json();
            alert("❌ Erreur de sauvegarde : " + err.message + "\n\nAstuce: Réessayez dans 5 secondes.");
        } else {
            const data = await res.json();
            this.state.currentSha = data.content.sha; // Update SHA for next save
        }
    },

    showToast(msg) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    }
};

// Initialize and Expose to Global Scope for Vite compatibility
window.admin = admin;
window.onload = () => admin.init();

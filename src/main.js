import './style.css';
import productsData from './data/products.json';
import { adminUtils } from './admin_utils.js';

// --- CONFIG ---
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxa8D0w65CcXso3TaKuugijiwLk826xSJVQ4Ay5lS-9CzH3r06Wc6t-Bw8D_TOMNLAjIA/exec";
const COUNTRY_MAP = {
    "CI": "Côte d'Ivoire", "SN": "Sénégal", "BF": "Burkina Faso", "TG": "Togo", "BJ": "Bénin",
    "ML": "Mali", "GA": "Gabon", "CM": "Cameroun", "NE": "Niger", "CG": "Congo Brazzaville",
    "CD": "Congo Kinshasa", "GN": "Guinée", "TD": "Chad"
};

// --- STATE ---
let state = {
    currentProduct: null,
    quantity: 1,
    price: 0,
    currency: 'CFA',
    isBundle: false,
    cartSessionId: "ORD-" + Date.now().toString().slice(-6) + "-" + Math.floor(Math.random() * 1000),
    isSubmitting: false,
    initiateCheckoutFired: false,
    lastAbandonedStr: "",
    igIndex: 0,
    isAdmin: sessionStorage.getItem('admin_auth') === 'true'
};

// --- UTILS ---
const fmtPrice = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const optimizeBloggerImg = (url, size = '600') => {
    if (!url || !url.includes('blogger.googleusercontent.com')) return url;
    return url.replace(/\/s\d+\//, `/w${size}/`).replace(/\/s\d+$/, `/w${size}`);
};

const getUTMParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    utms.forEach(p => { if (urlParams.has(p)) sessionStorage.setItem(p, urlParams.get(p)); });
    return {
        utm_source: sessionStorage.getItem('utm_source') || '',
        utm_medium: sessionStorage.getItem('utm_medium') || '',
        utm_campaign: sessionStorage.getItem('utm_campaign') || '',
        utm_term: sessionStorage.getItem('utm_term') || '',
        utm_content: sessionStorage.getItem('utm_content') || ''
    };
};

const firePixel = (event, data) => {
    if (typeof fbq === 'function') fbq('track', event, data);
};

const navigate = (path) => {
    window.history.pushState({}, '', path);
    router();
};

const updateMeta = (name, content, attr = 'property') => {
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
};

const updateSEO = (p = null) => {
    const brand = "Lina Nightwear";
    const baseUrl = "https://linanightwear.com";
    const oldSchema = document.getElementById('product-schema');
    if (oldSchema) oldSchema.remove();

    if (!p) {
        document.title = `${brand} - Boutique E-commerce & Mode`;
        updateMeta('og:title', `${brand} - Mode & Nightwear Premium`);
        updateMeta('og:description', "Découvrez notre collection exclusive.");
        updateMeta('og:image', "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=1200");
        updateMeta('og:url', baseUrl);
        return;
    }

    const title = `${p.title} - ${brand}`;
    const desc = p.description.replace(/<[^>]*>/g, '').slice(0, 160) + '...';
    const url = `${baseUrl}/product/${p.id}`;

    document.title = title;
    updateMeta('description', desc, 'name');
    updateMeta('og:title', title);
    updateMeta('og:description', desc);
    updateMeta('og:image', p.featuredImage);
    updateMeta('og:url', url);
    updateMeta('og:type', 'product');
    updateMeta('product:price:amount', p.price);
    updateMeta('product:price:currency', p.currency);

    updateMeta('twitter:title', title, 'name');
    updateMeta('twitter:description', desc, 'name');
    updateMeta('twitter:image', p.featuredImage, 'name');

    const schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": p.title,
        "image": [p.featuredImage],
        "description": desc,
        "sku": p.code || p.id,
        "brand": { "@type": "Brand", "name": brand },
        "offers": {
            "@type": "Offer",
            "url": url,
            "priceCurrency": p.currency === 'CFA' ? 'XOF' : p.currency,
            "price": p.price,
            "availability": "https://schema.org/InStock",
            "itemCondition": "https://schema.org/NewCondition"
        }
    };
    const script = document.createElement('script');
    script.id = 'product-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    firePixel('ViewContent', {
        content_name: p.title,
        content_category: p.category,
        content_ids: [p.id],
        content_type: 'product',
        value: p.price,
        currency: p.currency === 'CFA' ? 'XOF' : p.currency
    });
};

// --- ROUTER ---
const router = () => {
    const path = window.location.pathname;
    const app = document.getElementById('app');
    app.className = ''; // Reset classes
    document.body.classList.remove('lp-mode-active', 'is-merci-page');

    // --- ADMIN ROUTES ---
    if (path.startsWith('/admin')) {
        if (path === '/admin/login') {
            renderAdminLogin();
            return;
        }
        if (!state.isAdmin) {
            navigate('/admin/login');
            return;
        }
        renderAdmin();
        return;
    }

    // Handle base paths if deployed in a subdirectory (common for GitHub Pages)
    const segments = path.split('/').filter(s => s.length > 0);

    // Simple logic: if last segment is 'merci', show thank you page.
    // If it starts with 'product', find id.
    if (path.endsWith('/merci') || path.endsWith('/merci/')) {
        renderMerci();
        updateSEO();
    } else if (path.includes('/product/')) {
        const id = path.split('/product/').pop().replace(/\//g, '');
        const products = adminUtils.getProducts();
        const product = products.find(p => p.id === id);
        if (product) {
            renderProduct(product);
            updateSEO(product);
        } else {
            navigate('/');
        }
    } else {
        renderHome();
        updateSEO();
    }
    window.scrollTo(0, 0);
};

// --- VIEWS ---
const renderHome = () => {
    const app = document.getElementById('app');
    const products = adminUtils.getProducts();
    app.innerHTML = `
        <div class="topbar">
            <span><i class="fa fa-truck"></i> Livraison Gratuite</span>
            <span><i class="fa fa-rotate-left"></i> Retour 7 jours</span>
        </div>
        <header class="site-header">
            <div class="header-inner">
                <div class="header-spacer"></div>
                <a href="/" class="site-logo">
                    <div class="site-logo-icon">🛒</div>
                    Lina Night Wear
                </a>
                <div class="header-spacer" style="display:flex; justify-content:flex-end;">
                    <button class="mode-toggle" id="dark-mode-toggle" aria-label="Changer le thème"><i class="fa fa-moon"></i><i class="fa fa-sun"></i></button>
                </div>
            </div>
        </header>
        <section class="hero">
            <div class="hero-inner">
                <div class="hero-pill">🔥 Offre Limitée</div>
                <h1>Produits de Qualité<br/>Livrés Chez Vous</h1>
                <p>Paiement à la livraison · Retour gratuit · Livraison rapide</p>
                <a class="hero-btn" href="#catalogue"><i class="fa fa-bag-shopping"></i> Voir les Produits</a>
            </div>
        </section>
        <div class="trust-bar">
            <div class="trust-inner">
                <div class="trust-item ti-green"><div class="trust-icon"><i class="fa fa-check"></i></div> Livraison Gratuite</div>
                <div class="trust-item ti-blue"><div class="trust-icon"><i class="fa fa-lock"></i></div> Paiement Sécurisé</div>
                <div class="trust-item ti-orange"><div class="trust-icon"><i class="fa fa-headset"></i></div> Support 7j/7</div>
                <div class="trust-item ti-green"><div class="trust-icon"><i class="fa fa-rotate-left"></i></div> Retour 7 Jours</div>
            </div>
        </div>
        <div class="catalogue fade-in" id="catalogue">
            <div class="catalogue-hdr">
                <h2>🛒 Nos Produits</h2>
                <p>Livraison gratuite · Paiement à la livraison</p>
            </div>
            <div class="catalogue-grid">
                ${products.map(p => `
                    <a class="pcard ${p.modeBlack === 'yes' ? 'mode-nuit' : ''}" href="/product/${p.id}">
                        <div class="pcard-img">
                            <img src="${optimizeBloggerImg(p.featuredImage, 400)}" alt="${p.title}" loading="lazy">
                            <span class="pcard-badge">🔥 Offre</span>
                        </div>
                        <div class="pcard-body">
                            <div class="pcard-title">${p.title}</div>
                            <div class="pcard-price" style="font-size: 15px; margin-top: 5px;">Découvrir l'offre ➔</div>
                            <div class="pcard-stars">★★★★★</div>
                            <div class="pcard-cta"><i class="fa fa-bag-shopping"></i> Commander</div>
                        </div>
                    </a>
                `).join('')}
            </div>
        </div>
        <div class="sticky-bar">
            <a class="sticky-order" href="#catalogue" style="width: 100%;"><i class="fa fa-bag-shopping"></i> Voir Nos Produits</a>
        </div>
        ${renderFooter()}
    `;
    setupGlobalEvents();
};

const renderProduct = (p) => {
    state.currentProduct = p;
    state.price = p.price;
    state.quantity = 1;
    state.igIndex = 0;
    const isLP = p.isLandingPage && p.isLandingPage.toLowerCase() === 'yes';

    // LP Body Classes
    if (isLP) document.body.classList.add('lp-mode-active');
    else document.body.classList.remove('lp-mode-active');

    // Hide footer if LP
    if (isLP) document.body.classList.add('is-merci-page');
    else document.body.classList.remove('is-merci-page');

    if (p.modeBlack && p.modeBlack.toLowerCase() === 'yes') document.body.classList.add('mode-nuit');
    else document.body.classList.remove('mode-nuit');

    // --- LCP PRELOAD: inject <link rel="preload"> for featured image ASAP ---
    const lcpImg = optimizeBloggerImg((Array.isArray(p.gallery) && p.gallery.length > 0) ? p.gallery[0] : p.featuredImage, 800);
    const existingPreload = document.getElementById('lcp-preload');
    if (existingPreload) existingPreload.remove();
    const preloadLink = document.createElement('link');
    preloadLink.id = 'lcp-preload';
    preloadLink.rel = 'preload';
    preloadLink.as = 'image';
    preloadLink.href = lcpImg;
    preloadLink.setAttribute('fetchpriority', 'high');
    document.head.appendChild(preloadLink);

    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="topbar">
            <span><i class="fa fa-truck"></i> Livraison Gratuite</span>
            <span><i class="fa fa-rotate-left"></i> Retour 7 jours</span>
        </div>
        <header class="site-header" style="${isLP ? 'display:none' : ''}">
            <div class="header-inner">
                <div class="header-spacer"></div>
                <a href="/" class="site-logo">
                    <div class="site-logo-icon">🛒</div>
                    Lina NightWear
                </a>
                <div class="header-spacer" style="display:flex; justify-content:flex-end;">
                    <button class="mode-toggle" id="dark-mode-toggle" aria-label="Changer le thème"><i class="fa fa-moon"></i><i class="fa fa-sun"></i></button>
                </div>
            </div>
        </header>
        <main class="product-page">
            ${isLP ? `<div class="prod-desc landing-mode-desc" style="margin-top:0; margin-bottom: 24px;">
                <div id="d-desc-content">${(() => {
                let desc = p.description;
                // For LP, the first image is likely the LCP. Let's make it eager and optimized.
                let imgCount = 0;
                return desc.replace(/<img([^>]+)>/g, (match, attrs) => {
                    imgCount++;
                    if (imgCount === 1) {
                        // First image: eager, high priority
                        return `<img${attrs.replace(/loading=["']lazy["']/gi, '').replace(/fetchpriority=["'][^"']*["']/gi, '')} loading="eager" fetchpriority="high">`;
                    } else {
                        // Subsequent images: lazy
                        return `<img${attrs.replace(/loading=["']eager["']/gi, '').replace(/fetchpriority=["'][^"']*["']/gi, '')} loading="lazy">`;
                    }
                });
            })()}</div>
            </div>` : ''}

            <div class="product-card">
                ${!isLP ? `
                <div class="prod-gallery">
                    ${(Array.isArray(p.gallery) && p.gallery.length > 0) || (typeof p.gallery === 'string' && p.gallery.toLowerCase() === 'yes') ? `
                        <div id="interactive-gallery">
                            <div class="ig-main">
                                <button class="ig-btn ig-prev" id="prev-ig" aria-label="Image précédente"><i class="fa fa-chevron-left"></i></button>
                                <img src="${optimizeBloggerImg(Array.isArray(p.gallery) ? p.gallery[0] : (p.images ? p.images[0] : p.featuredImage), 800)}" id="ig-main-img" alt="${p.title}" fetchpriority="high" loading="eager">
                                <button class="ig-btn ig-next" id="next-ig" aria-label="Image suivante"><i class="fa fa-chevron-right"></i></button>
                            </div>
                            <div class="ig-thumbs" id="ig-thumbs">
                                ${[p.featuredImage, ...(Array.isArray(p.gallery) ? p.gallery : (p.images || []))].map((img, i) => `
                                    <div class="ig-thumb ${i === 0 ? 'active' : ''}" data-index="${i}"><img src="${optimizeBloggerImg(img, 200)}" loading="lazy"></div>
                                `).join('')}
                            </div>
                        </div>
                    ` : `
                        <img src="${p.featuredImage}" alt="${p.title}" fetchpriority="high" loading="eager">
                    `}
                    <div class="prod-badges">
                        <span class="badge badge-sale">🔥 Offre Spéciale</span>
                    </div>
                </div>
                ` : ''}
                <div class="prod-info">
                    <h1 class="prod-title">${p.title}</h1>
                    <div class="prod-rating">
                        <div class="stars">★★★★★</div>
                        <span class="rating-count">(${p.reviews} avis)</span>
                        <span class="rating-badge"><i class="fa fa-circle-check"></i> Vendeur Vérifié</span>
                    </div>
                    <div class="price-row" style="margin-bottom: 10px; align-items: center;">
                        <span class="price-now" id="d-price" style="font-size: 42px; color: var(--red);">${fmtPrice(p.price)} ${p.currency}</span>
                        ${p.priceOld ? `<span class="price-old" id="d-price-old" style="font-size: 21px; color: var(--gray-500);">${fmtPrice(p.priceOld)} ${p.currency}</span>` : ''}
                        ${p.priceOld ? `<span class="price-save" id="d-price-save" style="font-size: 13.5px; padding: 5px 12px; background: #fef08a; color: #92400e;">Économisez ${fmtPrice(p.priceOld - p.price)} ${p.currency} (-${Math.round((p.priceOld - p.price) / p.priceOld * 100)}%)</span>` : ''}
                    </div>
                    <p class="price-note" style="margin-bottom: 28px; font-size: 14.5px; color: var(--gray-500);"><span style="font-size: 15px;">💰</span> Paiement à la livraison — Zéro risque</p>
                    
                    <div class="stock-wrap" style="margin-bottom: 28px;">
                        <div class="stock-lbl" style="font-size: 15px; font-weight: 700; color: var(--gray-800); margin-bottom: 10px;">
                            <span>Stock disponible</span> 
                            <strong id="d-stock-lbl" style="color: var(--red);">⚠️ Plus que ${p.stock} unités !</strong>
                        </div>
                        <div class="stock-track" style="height: 10px; background: var(--gray-200); border-radius: 10px;">
                            <div class="stock-fill" style="width: 90%; height: 100%; border-radius: 10px; background: var(--orange); background: linear-gradient(90deg, var(--orange), #f97316); animation: none;"></div>
                        </div>
                    </div>

                    <ul class="feat-list" style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
                        <li class="feat-item" style="font-size: 15.5px; color: var(--gray-700); align-items: center;"><i class="fa fa-check-circle" style="color: var(--green); font-size: 19px; border-radius: 50%; fill: currentColor;"></i> Livraison gratuite partout</li>
                        <li class="feat-item" style="font-size: 15.5px; color: var(--gray-700); align-items: center;"><i class="fa fa-check-circle" style="color: var(--green); font-size: 19px; border-radius: 50%; fill: currentColor;"></i> Paiement uniquement à la réception</li>
                        <li class="feat-item" style="font-size: 15.5px; color: var(--gray-700); align-items: center;"><i class="fa fa-check-circle" style="color: var(--green); font-size: 19px; border-radius: 50%; fill: currentColor;"></i> Retour gratuit sous 7 jours</li>
                        <li class="feat-item" style="font-size: 15.5px; color: var(--gray-700); align-items: center;"><i class="fa fa-check-circle" style="color: var(--green); font-size: 19px; border-radius: 50%; fill: currentColor;"></i> Service client 7j/7</li>
                    </ul>
                </div>
            </div>

            <div class="order-col" id="orderFormBlock">
                <div class="order-card">
                    <div class="order-hdr">
                        <h2><i class="fa fa-shopping-cart"></i> Passer ma commande</h2>
                        <p>Remplissez le formulaire ci-dessous</p>
                    </div>
                    <div class="order-body">
                        <div id="countdown-container" style="${p.countdown && p.countdown.toLowerCase() === 'yes' ? '' : 'display:none'}">
                             <div class="countdown-wrap">
                                 <div class="countdown-title">🔥 Fin de l'offre dans :</div>
                                 <div class="countdown-timer">
                                     <div class="time-box"><span id="cd-min">15</span><small>MIN</small></div>
                                     <div class="time-sep">:</div>
                                     <div class="time-box"><span id="cd-sec">00</span><small>SEC</small></div>
                                 </div>
                             </div>
                        </div>

                        ${p.bundle && p.bundle.toLowerCase() === 'yes' ? `
                            <div class="bundle-wrap">
                                <div class="bundle-hdr">🎁 Sélectionnez votre Offre</div>
                                <div id="bundle-options">
                                    ${p.offres.map((o, i) => `
                                        <div class="bundle-opt ${i === 0 ? 'active' : ''}" data-qty="${o.qty}" data-price="${o.price}" data-title="${o.title}">
                                            <div class="bundle-radio"></div>
                                            <div class="bundle-opt-inner">
                                                <div>
                                                    <div class="bundle-title">${o.title}</div>
                                                    <div class="bundle-qty-pill">📦 x${o.qty}</div>
                                                </div>
                                                <div class="bundle-prices">
                                                    <span class="bundle-price-now">${fmtPrice(o.price)} ${p.currency}</span>
                                                    <span class="bundle-price-old">${fmtPrice(o.oldPrice)} ${p.currency}</span>
                                                    ${o.oldPrice > o.price ? `<span class="bundle-save-badge">-${Math.round((o.oldPrice - o.price) / o.oldPrice * 100)}%</span>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <div class="commit-msg" style="text-align: center; gap: 12px; margin-bottom: 24px; font-size: 13px; display: flex; align-items: center; justify-content: center; padding: 0 10px;">
                            <i class="fa fa-phone" style="color: var(--blue); transform: rotate(90deg); font-size: 18px;"></i>
                            <span style="color: var(--gray-500); line-height: 1.6;">Un agent vous appellera pour confirmer votre commande avant expédition. Merci de commander uniquement si vous êtes sûr de votre achat.</span>
                        </div>

                        <form id="orderForm">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label" for="pays"><i class="fa fa-globe" style="color: #60a5fa;"></i> Pays <span class="req">*</span></label>
                                    <select class="form-control" id="pays" required>
                                        <option value="">Choisir le pays</option>
                                        ${p.pays.split(',').map(c => `<option value="${c}">${COUNTRY_MAP[c] || c}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="tel"><i class="fa fa-mobile-screen-button" style="color: #a78bfa;"></i> Téléphone <span class="req">*</span></label>
                                    <input type="tel" class="form-control" id="tel" placeholder="XX XXX XX XX" required>
                                    <div class="error-msg" id="error-tel">Veuillez entrer un numéro valide (min 8 chiffres)</div>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label" for="nom"><i class="fa fa-user" style="color: #c084fc;"></i> Nom <span class="req">*</span></label>
                                    <input type="text" class="form-control" id="nom" placeholder="Votre nom complet" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="adr"><i class="fa fa-location-dot" style="color: #c084fc;"></i> Ville <span class="req">*</span></label>
                                    <input type="text" class="form-control" id="adr" placeholder="Ville, Quartier" required>
                                </div>
                            </div>

                            <div class="confirm-box">
                                <label>
                                    <input type="checkbox" checked required style="width: 18px; height: 18px; accent-color: var(--blue); margin: 0; flex-shrink: 0; border-radius: 4px;">
                                    <span>Je confirme que je suis prêt(e) à recevoir l'appel pour confirmer ma commande</span>
                                </label>
                            </div>

                            <div class="form-row">
                                ${p.couleur ? `
                                    <div class="form-group">
                                        <label class="form-label" for="var-couleur"><i class="fa fa-palette"></i> Couleur</label>
                                        <select class="form-control" id="var-couleur">
                                            ${p.couleur.split(',').map(c => `<option value="${c}">${c}</option>`).join('')}
                                        </select>
                                    </div>
                                ` : ''}

                                ${p.taille ? `
                                    <div class="form-group">
                                        <label class="form-label" for="var-taille"><i class="fa fa-ruler-combined"></i> Taille</label>
                                        <select class="form-control" id="var-taille">
                                            ${p.taille.split(',').map(s => `<option value="${s}">${s}</option>`).join('')}
                                        </select>
                                    </div>
                                ` : ''}
                            </div>

                            ${p.showQuantity && p.showQuantity.toLowerCase() === 'yes' && p.bundle && p.bundle.toLowerCase() !== 'yes' ? `
                                <div class="qty-action-wrap">
                                    <label class="qty-action-lbl" for="manual-qty">Quantité</label>
                                    <div class="qty-box">
                                        <button type="button" class="qty-btn" id="btn-qty-minus" aria-label="Diminuer la quantité">-</button>
                                        <input type="number" class="qty-val" id="manual-qty" value="1" readonly>
                                        <button type="button" class="qty-btn" id="btn-qty-plus" aria-label="Augmenter la quantité">+</button>
                                    </div>
                                </div>
                            ` : ''}

                            <div class="order-summary">
                                <div class="sum-row"><span>Prix du produit</span> <span>${fmtPrice(state.price)} ${p.currency}</span></div>
                                <div class="sum-row"><span>Quantité</span> <span id="sum-qty">${state.quantity}</span></div>
                                <div class="sum-row"><span>Prix de livraison</span> <span>Gratuit</span></div>
                                <div class="sum-total">
                                    <span>Total général</span>
                                    <span id="sum-total">${fmtPrice(state.price)} ${state.currency}</span>
                                </div>
                            </div>

                            <button type="submit" class="submit-btn ${p.animated && p.animated.toLowerCase() === 'yes' ? 'animated-yes' : ''}" id="submitBtn">
                                <i class="fa fa-lock"></i> Valider Ma Commande
                            </button>
                            <div class="pay-icons" style="margin-top: 15px; gap: 10px;">
                                <span class="trust-badge"><i class="fa fa-money-bill-1"></i> Cash</span>
                                <span class="trust-badge"><i class="fa fa-truck-fast"></i> COD</span>
                                <span class="trust-badge"><i class="fa fa-shield-check"></i> 100% Sécurisé</span>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="guar-card">
                    <div class="guar-icon"><i class="fa fa-shield-halved"></i></div>
                    <div class="guar-text">
                        <h4>Garantie Satisfaction</h4>
                        <p>Si vous n'êtes pas satisfait, nous vous remboursons dans les 7 jours.</p>
                    </div>
                </div>
            </div>

            ${!isLP ? `<div class="prod-desc">
                <h2 class="section-ttl"><i class="fa fa-file-lines"></i> Description</h2>
                <div id="d-desc-content"><div class="desc-placeholder" style="height:200px;background:var(--gray-100);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--gray-400)"><i class="fa fa-image" style="font-size:32px"></i></div></div>
            </div>` : ''}

        </main>
        
        <div class="sticky-bar">
            <a class="sticky-order" href="#orderFormBlock"><i class="fa fa-shopping-basket"></i> Commander</a>
            <a aria-label="WhatsApp" class="sticky-wa" href="https://wa.me/${p.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(`Bonjour, je souhaite commander : ${p.title}\nLien : ${window.location.origin + window.location.pathname}`)}" target="_blank"><i class="fab fa-whatsapp"></i></a>
        </div>

        <!-- Modals -->
        <div class="modal" id="modal-confirm">
            <div class="modal-bg"></div>
            <div class="modal-box">
                <div class="modal-ico green"><i class="fa fa-circle-check"></i></div>
                <h3 class="modal-ttl">Confirmer votre commande ?</h3>
                <p class="modal-body">Souhaitez-vous valider votre commande de <strong>${p.title}</strong> ?</p>
                <div class="order-summary" style="margin-bottom: 20px;">
                    <div class="sum-row"><span>Produit :</span> <span>${p.title} x ${state.quantity}</span></div>
                    <div class="sum-total"><span>Total :</span> <span>${fmtPrice(state.price * state.quantity)} CFA</span></div>
                </div>
                <div class="modal-btns">
                    <button class="modal-btn mbtn-cancel" id="m-cancel">Annuler</button>
                    <button class="modal-btn mbtn-confirm" id="m-ok">Oui, Confirmer</button>
                </div>
            </div>
        </div>

        <div class="modal remise-modal" id="modal-remise">
            <div class="modal-bg"></div>
            <div class="modal-box">
                <div class="remise-title">ATTENDEZ ! 🎁</div>
                <p class="remise-sub">Ne partez pas les mains vides. Profitez d'une remise immédiate !</p>
                <div class="remise-discount">5% OFF</div>
                <p class="remise-note">Valable uniquement pour les 15 prochaines minutes.</p>
                <button class="remise-btn" id="btn-apply-remise">APPLIQUER MA RÉDUCTION</button>
            </div>
        </div>

        ${renderFooter()}
    `;
    setupProductEvents(p);
    setupGlobalEvents();

    // Defer description HTML injection (only for non-LP mode; LP injects directly)
    if (!isLP) {
        const injectDesc = () => {
            const descEl = document.getElementById('d-desc-content');
            if (!descEl) return;
            // Strip competing fetchpriority=high from description images & ensure lazy loading
            const cleanDesc = p.description
                .replace(/fetchpriority="high"/gi, 'loading="lazy"')
                .replace(/<img(?!([^>]*loading=))/g, '<img loading="lazy" ');
            descEl.innerHTML = cleanDesc;
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(injectDesc, { timeout: 3000 });
        } else {
            setTimeout(injectDesc, 300);
        }
    }
};

const renderMerci = () => {
    document.body.classList.add('is-merci-page');
    const order = JSON.parse(sessionStorage.getItem('last_order') || '{}');
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="product-page fade-in" style="max-width: 500px; padding: 50px 20px;">
            <div class="product-card" style="text-align: center; padding: 40px 20px;">
                <div class="modal-ico green" style="margin-bottom: 20px;"><i class="fa fa-circle-check"></i></div>
                <h1 style="font-family:var(--fh); margin-bottom: 10px;">MERCI ${order.customer_name || '!'}</h1>
                <p style="color:var(--gray-600); margin-bottom: 30px;">Votre commande pour <strong>${order.product_name || 'votre produit'}</strong> a été reçue avec succès.</p>
                <div class="order-summary" style="margin-top: 20px;">
                    <div class="sum-row"><span>Produit :</span> <span>${order.product_name} x ${order.quantity}</span></div>
                    <div class="sum-row"><span>Total :</span> <span>${fmtPrice(order.total || 0)} CFA</span></div>
                    <div class="sum-total"><span>Statut :</span> <span style="color:var(--green)">En cours</span></div>
                </div>
                <p style="font-size: 13px; color: var(--gray-400); margin-bottom: 30px;">Un conseiller vous contactera dans les plus brefs délais pour confirmer la livraison.</p>
            </div>
        </div>
    `;
};

const renderFooter = () => `
    <footer class="site-footer">
        <div class="footer-grid">
            <div>
                <div class="footer-logo"><div class="footer-logo-icon">🛒</div> LP Africa</div>
                <p class="footer-desc">Votre boutique de confiance. Livraison rapide, paiement à la réception.</p>
            </div>
            <div class="footer-col">
                <h2>Liens</h2>
`;

// --- ADMIN VIEWS ---
const renderAdminLogin = () => {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="login-screen">
            <div class="login-card fade-in">
                <h1 style="font-family:var(--fh); text-align:center; margin-bottom:24px;">Admin Login</h1>
                <form id="loginForm">
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-control" id="adminPass" required placeholder="Enter password">
                    </div>
                    <button type="submit" class="btn-primary" style="width:100%; justify-content:center; padding:14px;">Login</button>
                    <div id="loginError" style="color:var(--red); font-size:13px; text-align:center; margin-top:12px; display:none;">Invalid password</div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('loginForm').onsubmit = (e) => {
        e.preventDefault();
        const pass = document.getElementById('adminPass').value;
        if (pass === 'admin123') { // Default password
            sessionStorage.setItem('admin_auth', 'true');
            state.isAdmin = true;
            navigate('/admin');
        } else {
            document.getElementById('loginError').style.display = 'block';
        }
    };
};

const renderAdmin = () => {
    const app = document.getElementById('app');
    const path = window.location.pathname;

    app.innerHTML = `
        <div class="admin-layout">
            <aside class="admin-sidebar">
                <div class="admin-logo">🛒 Admin Panel</div>
                <nav class="admin-nav">
                    <a href="/admin" class="admin-nav-item ${path === '/admin' ? 'active' : ''}"><i class="fa fa-chart-line"></i> Analytics</a>
                    <a href="/admin/products" class="admin-nav-item ${path === '/admin/products' ? 'active' : ''}"><i class="fa fa-box"></i> Products</a>
                    <a href="/admin/orders" class="admin-nav-item ${path === '/admin/orders' ? 'active' : ''}"><i class="fa fa-shopping-bag"></i> Orders</a>
                    <div style="flex:1"></div>
                    <a href="/" class="admin-nav-item"><i class="fa fa-globe"></i> View Site</a>
                    <button id="logoutBtn" class="admin-nav-item" style="background:transparent; border:none; width:100%; cursor:pointer;"><i class="fa fa-sign-out"></i> Logout</button>
                </nav>
            </aside>
            <main class="admin-content" id="adminMain">
                ${renderAdminSubView()}
            </main>
        </div>
    `;

    document.getElementById('logoutBtn').onclick = () => {
        sessionStorage.removeItem('admin_auth');
        state.isAdmin = false;
        navigate('/');
    };

    // Intercept clicks on admin nav
    app.querySelectorAll('.admin-nav-item').forEach(link => {
        if (link.tagName === 'A' && link.getAttribute('href').startsWith('/admin')) {
            link.onclick = (e) => {
                e.preventDefault();
                navigate(link.getAttribute('href'));
            };
        }
    });

    setupAdminEvents();
};

const renderAdminSubView = () => {
    const path = window.location.pathname;
    if (path === '/admin/products') return renderAdminProducts();
    if (path === '/admin/products/new') return renderProductForm();
    if (path.startsWith('/admin/products/edit/')) {
        const id = path.split('/').pop();
        const products = adminUtils.getProducts();
        const p = products.find(prod => prod.id === id);
        return renderProductForm(p);
    }
    if (path === '/admin/orders') return renderAdminOrders();
    return renderAdminAnalytics();
};

const renderProductForm = (p = null) => {
    const isEdit = !!p;
    return `
        <div class="admin-header">
            <h1>${isEdit ? 'Edit Product' : 'Add New Product'}</h1>
            <button class="btn-ghost" id="backBtn"><i class="fa fa-arrow-left"></i> Back</button>
        </div>
        <div class="admin-table-card" style="padding:32px;">
            <form id="productForm">
                <h3 style="margin-bottom:20px; font-family:var(--fh);">Core Information</h3>
                <div class="admin-form-grid">
                    <div class="form-group">
                        <label class="form-label">ID (slug)</label>
                        <input type="text" class="form-control" id="p-id" value="${p?.id || ''}" required ${isEdit ? 'readonly' : ''} placeholder="e.g. my-cool-product">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-control" id="p-title" value="${p?.title || ''}" required placeholder="Product Title">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Price</label>
                        <input type="number" class="form-control" id="p-price" value="${p?.price || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Old Price</label>
                        <input type="number" class="form-control" id="p-priceOld" value="${p?.priceOld || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Currency</label>
                        <input type="text" class="form-control" id="p-currency" value="${p?.currency || 'CFA'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <input type="text" class="form-control" id="p-category" value="${p?.category || 'Mode'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Stock</label>
                        <input type="number" class="form-control" id="p-stock" value="${p?.stock || '25'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Product Code (SKU)</label>
                        <input type="text" class="form-control" id="p-code" value="${p?.code || ''}">
                    </div>
                </div>

                <h3 style="margin-top:40px; margin-bottom:20px; font-family:var(--fh);">Logistics & Marketing</h3>
                <div class="admin-form-grid">
                    <div class="form-group">
                        <label class="form-label">WhatsApp Number</label>
                        <input type="text" class="form-control" id="p-whatsapp" value="${p?.whatsapp || '2250701825463'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Target Countries (ISO, comma-separated)</label>
                        <input type="text" class="form-control" id="p-pays" value="${p?.pays || 'CI,SN,BF,TG,BJ,ML,GA,CM,NE,CG,CD,GN,TD'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Bundle Offer?</label>
                        <select class="form-control" id="p-bundle">
                            <option value="no" ${p?.bundle === 'no' ? 'selected' : ''}>No</option>
                            <option value="yes" ${p?.bundle === 'yes' ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                    <div class="form-group" id="offres-group" style="${p?.bundle === 'yes' ? '' : 'display:none'}">
                        <label class="form-label">Bundle Offers (one per line: <code>qty,price,oldPrice,title</code>)</label>
                        <textarea class="form-control" id="p-offres" style="height:120px; font-family:monospace; font-size:13px;" placeholder="1,19900,29900,1 Exemplaire (Offre Découverte)&#10;2,34900,59800,2 Exemplaires (Offre Duo)&#10;3,49900,89700,3 Exemplaires (Offre Famille)">${(p?.offres || []).map(o => `${o.qty},${o.price},${o.oldPrice},${o.title}`).join('\n')}</textarea>
                        <small style="color:var(--gray-500); font-size:12px;">Format: <strong>quantity,price,old_price,title</strong> — one offer per line</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Show Countdown?</label>
                        <select class="form-control" id="p-countdown">
                            <option value="NO" ${p?.countdown === 'NO' ? 'selected' : ''}>No</option>
                            <option value="yes" ${p?.countdown === 'yes' ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Animated CTA?</label>
                        <select class="form-control" id="p-animated">
                            <option value="no" ${p?.animated === 'no' ? 'selected' : ''}>No</option>
                            <option value="yes" ${p?.animated === 'yes' ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Landing Page Mode?</label>
                        <select class="form-control" id="p-isLandingPage">
                            <option value="no" ${p?.isLandingPage === 'no' ? 'selected' : ''}>No</option>
                            <option value="yes" ${p?.isLandingPage === 'yes' ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Dark Mode?</label>
                        <select class="form-control" id="p-modeBlack">
                            <option value="no" ${p?.modeBlack === 'no' ? 'selected' : ''}>No</option>
                            <option value="yes" ${p?.modeBlack === 'yes' ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Show Quantity Picker?</label>
                        <select class="form-control" id="p-showQuantity">
                            <option value="NO" ${p?.showQuantity === 'NO' ? 'selected' : ''}>No</option>
                            <option value="yes" ${p?.showQuantity === 'yes' ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                </div>

                <h3 style="margin-top:40px; margin-bottom:20px; font-family:var(--fh);">Variants & Popups</h3>
                <div class="admin-form-grid">
                    <div class="form-group">
                        <label class="form-label">Colors (comma-separated)</label>
                        <input type="text" class="form-control" id="p-couleur" value="${p?.couleur || ''}" placeholder="Bleu, Noir, Rouge">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sizes (comma-separated)</label>
                        <input type="text" class="form-control" id="p-taille" value="${p?.taille || ''}" placeholder="S, M, L, XL">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Exit Intent Popup (enabled, percent)</label>
                        <input type="text" class="form-control" id="p-remisePopup" value="${p?.remisePopup || 'no, 10'}" placeholder="yes, 15">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Reviews Count</label>
                        <input type="text" class="form-control" id="p-reviews" value="${p?.reviews || '0'}">
                    </div>
                </div>

                <h3 style="margin-top:40px; margin-bottom:20px; font-family:var(--fh);">Images & Description</h3>
                <div class="form-group">
                    <label class="form-label">Featured Image URL</label>
                    <input type="text" class="form-control" id="p-img" value="${p?.featuredImage || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Gallery URLs (one per line)</label>
                    <textarea class="form-control" id="p-gallery" style="height:120px;" placeholder="URL 1&#10;URL 2">${(p?.gallery || []).join('\n')}</textarea>
                </div>
                <div class="form-group">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <label class="form-label" style="margin-bottom:0;">Description</label>
                        <div class="editor-tabs" style="display:flex; gap:2px;">
                            <button type="button" id="tab-visual" class="editor-tab active" style="padding:6px 12px; border:1px solid var(--gray-200); border-bottom:none; border-radius:6px 6px 0 0; background:white; font-size:12px; font-weight:600; cursor:pointer;">Visual</button>
                            <button type="button" id="tab-html" class="editor-tab" style="padding:6px 12px; border:1px solid var(--gray-200); border-bottom:none; border-radius:6px 6px 0 0; background:var(--gray-50); font-size:12px; font-weight:600; cursor:pointer;">HTML</button>
                        </div>
                    </div>
                    <div id="editor-container" style="border:1px solid var(--gray-200); border-radius:0 0 8px 8px; overflow:hidden;">
                        <div id="p-desc-editor" style="height:350px; background:white; font-family: var(--fb); border:none;">${p?.description || ''}</div>
                        <textarea id="p-desc-html" class="form-control" style="height:350px; display:none; font-family:monospace; font-size:13px; background:#1e1e1e; color:#d4d4d4; border:none; width:100%; resize:vertical; padding:15px; outline:none;">${p?.description || ''}</textarea>
                    </div>
                    <input type="hidden" id="p-desc" value="${(p?.description || '').replace(/"/g, '&quot;')}">
                </div>
                <div style="margin-top:32px; display:flex; gap:12px; justify-content:flex-end;">
                    <button type="button" class="btn-ghost" id="cancelForm">Cancel</button>
                    <button type="submit" class="btn-primary">${isEdit ? 'Update Product' : 'Create Product'}</button>
                </div>
            </form>
        </div>
    `;
};

const renderAdminAnalytics = () => {
    const orders = JSON.parse(sessionStorage.getItem('captured_orders') || '[]');
    const totalRev = orders.reduce((acc, o) => acc + (o.total || 0), 0);

    return `
        <div class="admin-header">
            <h1>Analytics Overview</h1>
            <div class="btn-ghost"><i class="fa fa-calendar"></i> Last 30 Days</div>
        </div>
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-lbl">Total Revenue</div>
                <div class="kpi-val">${totalRev.toLocaleString()} CFA</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-lbl">Total Orders</div>
                <div class="kpi-val">${orders.length}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-lbl">Conversion Rate</div>
                <div class="kpi-val">3.2%</div>
            </div>
        </div>
        <div class="admin-table-card">
            <div style="padding:20px; font-weight:800; border-bottom:1px solid var(--gray-200)">Recent Activity</div>
            <div style="padding:40px; text-align:center; color:var(--gray-400)">
                <i class="fa fa-chart-area" style="font-size:48px; margin-bottom:16px;"></i>
                <p>Activity charts will appear here as you gather more data.</p>
            </div>
        </div>
    `;
};

const renderAdminProducts = () => {
    const products = adminUtils.getProducts();
    return `
        <div class="admin-header">
            <h1>Manage Products</h1>
            <button class="btn-primary" id="addNewBtn"><i class="fa fa-plus"></i> Add Product</button>
        </div>
        <div class="admin-table-card">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Title</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td><img src="${p.featuredImage}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;"></td>
                            <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.title}</td>
                            <td>${p.price.toLocaleString()} ${p.currency}</td>
                            <td>${p.stock}</td>
                            <td>
                                <button class="btn-ghost edit-btn" data-id="${p.id}">Edit</button>
                                <button class="btn-ghost delete-btn" data-id="${p.id}" style="color:var(--red)">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div style="margin-top:24px; text-align:right;">
            <button class="btn-primary" id="exportBtn" style="background:var(--green)"><i class="fa fa-download"></i> Export products.json</button>
        </div>
    `;
};

const renderAdminOrders = () => {
    const orders = JSON.parse(sessionStorage.getItem('captured_orders') || '[]');
    return `
        <div class="admin-header">
            <h1>Orders</h1>
        </div>
        <div class="admin-table-card">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Total</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.reverse().map(o => `
                        <tr>
                            <td>${new Date().toLocaleDateString()}</td>
                            <td>${o.customer_name}<br><small style="color:var(--gray-400)">${o.telephone}</small></td>
                            <td>${o.product_name} x ${o.quantity}</td>
                            <td>${(o.total || 0).toLocaleString()} CFA</td>
                            <td><span style="padding:4px 8px; background:var(--green-l); color:var(--green); border-radius:4px; font-size:11px; font-weight:700;">COMPLETED</span></td>
                        </tr>
                    `).join('')}
                    ${orders.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--gray-400)">No orders found yet.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;
};

const setupAdminEvents = () => {
    // --- RICH TEXT EDITOR (Quill) ---
    const editorEl = document.getElementById('p-desc-editor');
    if (editorEl) {
        const quill = new Quill('#p-desc-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    [{ 'size': ['small', false, 'large', 'huge'] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'image', 'video'],
                    ['clean']
                ]
            }
        });

        // Sync Quill content to hidden input before form submit
        quill.on('text-change', () => {
            const html = quill.root.innerHTML;
            document.getElementById('p-desc').value = html;
        });

        // HTML Source Toggle (Tabs)
        const tabVisual = document.getElementById('tab-visual');
        const tabHtml = document.getElementById('tab-html');
        const htmlTextarea = document.getElementById('p-desc-html');
        const quillEditor = document.querySelector('.ql-container');
        const quillToolbar = document.querySelector('.ql-toolbar');

        const switchToVisual = () => {
            quill.root.innerHTML = htmlTextarea.value;
            htmlTextarea.style.display = 'none';
            quillEditor.style.display = 'block';
            quillToolbar.style.display = 'block';
            tabVisual.classList.add('active');
            tabVisual.style.background = 'white';
            tabHtml.classList.remove('active');
            tabHtml.style.background = 'var(--gray-50)';
        };

        const switchToHtml = () => {
            htmlTextarea.value = quill.root.innerHTML;
            htmlTextarea.style.display = 'block';
            quillEditor.style.display = 'none';
            quillToolbar.style.display = 'none';
            tabHtml.classList.add('active');
            tabHtml.style.background = 'white';
            tabVisual.classList.remove('active');
            tabVisual.style.background = 'var(--gray-50)';
        };

        tabVisual.onclick = switchToVisual;
        tabHtml.onclick = switchToHtml;

        // Sync HTML textarea changes to hidden input
        htmlTextarea.oninput = () => {
            document.getElementById('p-desc').value = htmlTextarea.value;
        };
    }

    // Show/hide offres textarea based on bundle selection
    const bundleSelect = document.getElementById('p-bundle');
    const offresGroup = document.getElementById('offres-group');
    if (bundleSelect && offresGroup) {
        bundleSelect.onchange = () => {
            offresGroup.style.display = bundleSelect.value === 'yes' ? '' : 'none';
        };
    }

    const addNewBtn = document.getElementById('addNewBtn');
    if (addNewBtn) {
        addNewBtn.onclick = () => {
            navigate('/admin/products/new');
        };
    }

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.onclick = () => navigate('/admin/products');
    }

    const cancelForm = document.getElementById('cancelForm');
    if (cancelForm) {
        cancelForm.onclick = () => navigate('/admin/products');
    }

    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.onsubmit = (e) => {
            e.preventDefault();
            const formData = {
                id: document.getElementById('p-id').value,
                title: document.getElementById('p-title').value,
                price: parseInt(document.getElementById('p-price').value),
                priceOld: parseInt(document.getElementById('p-priceOld').value) || null,
                currency: document.getElementById('p-currency').value,
                category: document.getElementById('p-category').value,
                stock: document.getElementById('p-stock').value,
                code: document.getElementById('p-code').value,
                whatsapp: document.getElementById('p-whatsapp').value,
                pays: document.getElementById('p-pays').value,
                bundle: document.getElementById('p-bundle').value,
                countdown: document.getElementById('p-countdown').value,
                animated: document.getElementById('p-animated').value,
                isLandingPage: document.getElementById('p-isLandingPage').value,
                modeBlack: document.getElementById('p-modeBlack').value,
                showQuantity: document.getElementById('p-showQuantity').value,
                couleur: document.getElementById('p-couleur').value,
                taille: document.getElementById('p-taille').value,
                remisePopup: document.getElementById('p-remisePopup').value,
                reviews: document.getElementById('p-reviews').value,
                featuredImage: document.getElementById('p-img').value,
                gallery: document.getElementById('p-gallery').value.split('\n').map(s => s.trim()).filter(s => s.length > 0),
                offres: (() => {
                    const raw = document.getElementById('p-offres').value.trim();
                    if (!raw) return [];
                    return raw.split('\n').map(line => {
                        const parts = line.split(',');
                        const qty = parseInt(parts[0]) || 1;
                        const price = parseInt(parts[1]) || 0;
                        const oldPrice = parseInt(parts[2]) || 0;
                        const title = parts.slice(3).join(',').trim();
                        return { qty, price, oldPrice, title };
                    }).filter(o => o.title);
                })(),
                description: document.getElementById('p-desc').value
            };
            adminUtils.upsertProduct(formData);
            navigate('/admin/products');
        };
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            const json = adminUtils.exportJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'products.json';
            a.click();
        };
    }

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => {
            navigate('/admin/products/edit/' + btn.dataset.id);
        };
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = () => {
            if (confirm('Are you sure you want to delete this product?')) {
                adminUtils.deleteProduct(btn.dataset.id);
                renderAdmin();
            }
        };
    });
};


// --- EVENT HANDLERS ---
const setupGlobalEvents = () => {
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) {
        toggle.onclick = () => {
            document.body.classList.toggle('mode-nuit');
        };
    }
};

const setupProductEvents = (p) => {
    // --- GALLERY ---
    if ((Array.isArray(p.gallery) && p.gallery.length > 0) || p.gallery === 'yes') {
        const images = [p.featuredImage, ...(Array.isArray(p.gallery) ? p.gallery : (p.images || []))];
        const mainImg = document.getElementById('ig-main-img');
        const thumbs = document.querySelectorAll('.ig-thumb');

        const changeIg = (idx) => {
            state.igIndex = idx;
            mainImg.src = images[idx];
            thumbs.forEach(t => t.classList.remove('active'));
            thumbs[idx].classList.add('active');
        };

        const prevBtn = document.getElementById('prev-ig');
        const nextBtn = document.getElementById('next-ig');

        if (prevBtn) {
            prevBtn.onclick = () => {
                let n = state.igIndex - 1;
                if (n < 0) n = images.length - 1;
                changeIg(n);
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                let n = state.igIndex + 1;
                if (n >= images.length) n = 0;
                changeIg(n);
            };
        }
        thumbs.forEach(t => {
            t.onclick = () => changeIg(parseInt(t.dataset.index));
        });
    }

    // --- BUNDLES ---
    if (p.bundle === 'yes') {
        const bundleOpts = document.querySelectorAll('.bundle-opt');
        // First option is active by default — set initial state
        state.isBundle = true;
        bundleOpts.forEach(opt => {
            opt.onclick = () => {
                bundleOpts.forEach(b => b.classList.remove('active'));
                opt.classList.add('active');
                state.quantity = parseInt(opt.dataset.qty);
                state.price = parseInt(opt.dataset.price);
                state.isBundle = true; // bundle price covers all qty
                updateOrderSummary();
            };
        });
    }

    // --- QUANTITY ---
    const btnM = document.getElementById('btn-qty-minus');
    const btnP = document.getElementById('btn-qty-plus');
    if (btnM && btnP) {
        btnM.onclick = () => { if (state.quantity > 1) { state.quantity--; state.isBundle = false; updateOrderSummary(); } };
        btnP.onclick = () => { state.quantity++; state.isBundle = false; updateOrderSummary(); };
    }

    const updateOrderSummary = () => {
        // For bundles: price already covers all units — don't multiply by qty
        const total = state.isBundle ? state.price : state.price * state.quantity;
        document.getElementById('sum-qty').innerText = state.quantity;
        document.getElementById('sum-total').innerText = fmtPrice(total) + ' ' + p.currency;
        // Also update the "Prix du produit" row to show the selected offer price
        const priceRow = document.querySelector('.order-summary .sum-row:first-child span:last-child');
        if (priceRow) priceRow.innerText = fmtPrice(state.price) + ' ' + p.currency;
        if (document.getElementById('manual-qty')) document.getElementById('manual-qty').value = state.quantity;
    };

    // --- COUNTDOWN ---
    if (p.countdown === 'yes') {
        let timer = 900; // 15 mins
        const minEl = document.getElementById('cd-min');
        const secEl = document.getElementById('cd-sec');
        setInterval(() => {
            if (timer > 0) {
                timer--;
                let m = Math.floor(timer / 60);
                let s = timer % 60;
                minEl.innerText = m < 10 ? '0' + m : m;
                secEl.innerText = s < 10 ? '0' + s : s;
            }
        }, 1000);
    }

    // --- FORM SUBMISSION ---
    const form = document.getElementById('orderForm');
    form.onsubmit = async (e) => {
        e.preventDefault();

        const telInput = document.getElementById('tel');
        const telVal = telInput.value.replace(/\D/g, '');
        if (telVal.length < 8) {
            telInput.parentElement.classList.add('error');
            telInput.classList.add('shake');
            setTimeout(() => telInput.classList.remove('shake'), 400);
            telInput.focus();
            return;
        } else {
            telInput.parentElement.classList.remove('error');
        }

        // Track the completion of the form
        firePixel('InitiateCheckout', {
            value: state.price * state.quantity,
            currency: p.currency === 'CFA' ? 'XOF' : p.currency,
            content_name: p.title
        });

        const ok = await new Promise(res => {
            const modal = document.getElementById('modal-confirm');
            modal.classList.add('open');
            document.getElementById('m-ok').onclick = () => { modal.classList.remove('open'); res(true); };
            document.getElementById('m-cancel').onclick = () => { modal.classList.remove('open'); res(false); };
        });
        if (!ok) return;

        state.isSubmitting = true;
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.innerHTML = 'Envoi... <span class="spinner"></span>';

        const formData = new FormData();
        formData.append("nom", document.getElementById('nom').value);
        formData.append("telephone", document.getElementById('tel').value);
        formData.append("pays", document.getElementById('pays').value);
        formData.append("adresse", document.getElementById('adr').value);
        formData.append("produit", p.title);
        formData.append("prix", (state.price * state.quantity) + " " + p.currency);
        formData.append("quantity", state.quantity);
        formData.append("platform", "GitHubPages");
        formData.append("order_id", state.cartSessionId);
        formData.append("code", p.code || "");
        formData.append("status", "COMPLETED");

        const vCouleur = document.getElementById('var-couleur');
        const vTaille = document.getElementById('var-taille');
        if (vCouleur) formData.append("couleur", vCouleur.value);
        if (vTaille) formData.append("taille", vTaille.value);

        const utms = getUTMParams();
        Object.entries(utms).forEach(([k, v]) => formData.append(k, v));

        try {
            // Use keepalive: true so the request completes even after navigation
            fetch(GOOGLE_SHEETS_WEBAPP_URL, { method: "POST", body: formData, mode: "no-cors", keepalive: true });

            firePixel('Purchase', {
                value: state.price * state.quantity,
                currency: p.currency === 'CFA' ? 'XOF' : p.currency,
                content_name: p.title,
                content_ids: [p.code || window.location.pathname],
                content_type: 'product',
                num_items: state.quantity
            });
            sessionStorage.setItem('last_order', JSON.stringify({
                customer_name: document.getElementById('nom').value,
                product_name: p.title,
                quantity: state.quantity,
                total: state.price * state.quantity
            }));

            // Redirect after a tiny delay to ensure everything is processed
            setTimeout(() => {
                window.location.pathname = '/merci';
            }, 200);
        } catch (err) {
            btn.innerHTML = '❌ ÉCHEC, RÉESSAYER';
            btn.style.background = '#c81e1e';
            btn.disabled = false;
        }
    };

    // --- ABANDONED CHECKOUT ---
    const logAbandoned = () => {
        if (state.isSubmitting) return;
        const form = document.getElementById('orderForm');
        if (!form) return;

        const requireds = Array.from(form.querySelectorAll('[required]'));
        const allValid = requireds.every(el => {
            if (el.type === 'checkbox') return el.checked;
            const val = el.value ? el.value.trim() : '';
            if (el.id === 'tel') return val.replace(/\D/g, '').length >= 8;
            return val.length >= 2;
        });

        if (allValid) {
            const tel = document.getElementById('tel').value;
            const nom = document.getElementById('nom').value;
            const adr = document.getElementById('adr').value;
            const pays = document.getElementById('pays').value;

            const currentStr = tel + nom + adr + pays;
            if (currentStr === state.lastAbandonedStr) return;
            state.lastAbandonedStr = currentStr;

            const formData = new FormData();
            formData.append("nom", nom);
            formData.append("telephone", tel);
            formData.append("pays", pays);
            formData.append("adresse", adr);
            formData.append("produit", p.title);
            formData.append("prix", (state.price * state.quantity) + " " + p.currency);
            formData.append("quantity", state.quantity);
            formData.append("status", "ABANDONED");
            formData.append("code", p.code || "");
            formData.append("order_id", state.cartSessionId);
            fetch(GOOGLE_SHEETS_WEBAPP_URL, { method: "POST", body: formData, mode: "no-cors" });
        }
    };

    const formEl = document.getElementById('orderForm');
    if (formEl) {
        formEl.querySelectorAll('input, select').forEach(el => {
            el.onblur = logAbandoned;
            el.onchange = logAbandoned;
            if (el.id === 'tel') {
                el.oninput = () => {
                    // Force only numbers, spaces and +
                    el.value = el.value.replace(/[^0-9+\s]/g, '');
                    if (el.value.replace(/\D/g, '').length >= 8) {
                        el.parentElement.classList.remove('error');
                    }
                };
            }
        });
    }

    // --- EXIT INTENT ---
    let remiseShown = false;
    const remiseConfig = (p.remisePopup || "no, 5").split(',').map(s => s.trim());
    const remiseEnabled = remiseConfig[0] === 'yes';
    const remisePercent = parseInt(remiseConfig[1]) || 5;

    const showRemise = () => {
        if (!remiseShown && remiseEnabled) {
            const modal = document.getElementById('modal-remise');
            if (modal) {
                modal.querySelector('.remise-discount').innerText = remisePercent + '% OFF';
                modal.classList.add('open');
                remiseShown = true;
            }
        }
    };
    document.addEventListener('mouseleave', (e) => { if (e.clientY < 50) showRemise(); });
    document.getElementById('btn-apply-remise').onclick = () => {
        state.price = Math.round(state.price * (1 - remisePercent / 100));
        updateOrderSummary();
        document.getElementById('d-price').innerText = fmtPrice(state.price) + ' ' + p.currency;
        document.getElementById('modal-remise').classList.remove('open');
        document.getElementById('orderFormBlock').scrollIntoView({ behavior: 'smooth' });
    };

    // --- STICKY ACTIONS TRACKING ---
    const stickyOrder = document.querySelector('.sticky-order');
    if (stickyOrder) {
        stickyOrder.onclick = () => {
            firePixel('AddToCart', {
                content_name: p.title,
                content_ids: [p.id],
                content_type: 'product',
                value: p.price,
                currency: p.currency === 'CFA' ? 'XOF' : p.currency
            });
        };
    }

    const stickyWa = document.querySelector('.sticky-wa');
    if (stickyWa) {
        stickyWa.onclick = () => {
            firePixel('Contact', {
                content_name: 'WhatsApp Support',
                content_category: 'Customer Service'
            });
        };
    }
};

// --- INIT ---
window.addEventListener('popstate', router);
window.addEventListener('DOMContentLoaded', () => {

    // Global link interceptor for SPA navigation
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href.startsWith(window.location.origin) && !link.target) {
            // Internal anchor links handler
            if (link.hash && link.pathname === window.location.pathname) {
                const targetId = link.hash.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                    window.history.pushState(null, null, link.hash);
                    return;
                }
            }

            e.preventDefault();
            navigate(link.pathname);
        }
    });

    router();
});

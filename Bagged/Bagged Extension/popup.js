const firebaseConfig = {
    apiKey: "AIzaSyA1BJ5_ItJr_S9bExIIz_oaeg-HYDMc7LY",
    authDomain: "bagged-dc0f7.firebaseapp.com",
    projectId: "bagged-dc0f7",
    storageBucket: "bagged-dc0f7.firebasestorage.app",
    messagingSenderId: "103392647585",
    appId: "1:103392647585:web:edd49907154bd481a193e0"
};

let auth = null;
let db = null;
let isSignUp = false;

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
        auth = firebase.auth();
        if (!db) {
            db = firebase.firestore();
            try { db.settings({ merge: true }); } catch (_) {}
        }
    }
} catch (e) {
    console.warn("Firebase SDK init notice:", e);
}

function friendlyError(code) {
    console.log('Auth error code:', code);
    const map = {
        'auth/email-already-in-use': 'an account with this email already exists',
        'EMAIL_EXISTS': 'an account with this email already exists',
        'auth/invalid-email': 'please enter a valid email address',
        'INVALID_EMAIL': 'please enter a valid email address',
        'auth/user-not-found': 'no account found with this email',
        'EMAIL_NOT_FOUND': 'no account found with this email',
        'auth/wrong-password': 'incorrect password',
        'INVALID_PASSWORD': 'incorrect password',
        'INVALID_LOGIN_CREDENTIALS': 'incorrect email or password',
        'auth/invalid-credential': 'incorrect email or password',
        'auth/weak-password': 'password must be at least 6 characters',
        'WEAK_PASSWORD': 'password must be at least 6 characters',
        'auth/too-many-requests': 'too many attempts - please try again later',
        'TOO_MANY_ATTEMPTS_TRY_LATER': 'too many attempts - please try again later',
        'auth/network-request-failed': 'network error - check your connection',
        'auth/invalid-email': 'please enter a valid email address',
        'auth/user-not-found': 'no account found with this email',
        'auth/wrong-password': 'incorrect password',
        'auth/weak-password': 'password must be at least 6 characters',
        'auth/too-many-requests': 'too many attempts - please try again later',
        'auth/network-request-failed': 'network error - check your connection',
        'auth/user-disabled': 'this account has been disabled',
        'auth/operation-not-allowed': 'email/password sign-in is not enabled - please enable it in Firebase Console',
        'auth/invalid-credential': 'invalid email or password',
        'auth/missing-password': 'please enter a password',
        'auth/internal-error': 'an internal error occurred - please try again',
        'USER_DISABLED': 'this account has been disabled',
    };
    return map[code] || 'error: ' + (code || 'unknown') + ' - please try again';
}

function toProperCase(str) {
    if (!str) return "";
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

async function getUserUid() {
    if (auth && auth.currentUser) return auth.currentUser.uid;
    const localId = localStorage.getItem('bagged_local_id');
    if (localId) return localId;
    const email = localStorage.getItem('bagged_user_email');
    if (email) {
        try { return btoa(email).replace(/=/g, ''); } catch (_) { return email.replace(/[^a-zA-Z0-9]/g, '_'); }
    }
    return null;
}

// Global Submit Handler
async function handleAuthSubmit(e) {
    if (e) {
        try { e.preventDefault(); } catch (_) {}
        try { e.stopPropagation(); } catch (_) {}
    }

    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authConfirmPassword = document.getElementById('auth-confirm-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authError = document.getElementById('auth-error');

    if (!authEmail || !authPassword) return false;

    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (authError) authError.innerText = '';

    if (!email || !password) {
        if (authError) authError.innerText = 'please enter your email and password';
        return false;
    }

    if (isSignUp && authConfirmPassword) {
        const confirmPass = authConfirmPassword.value;
        if (!confirmPass) {
            if (authError) authError.innerText = 'please confirm your password';
            authConfirmPassword.focus();
            return false;
        }
        if (password !== confirmPass) {
            if (authError) authError.innerText = 'passwords do not match';
            authConfirmPassword.focus();
            return false;
        }
    }

    if (authSubmitBtn) {
        authSubmitBtn.disabled = true;
        authSubmitBtn.innerText = isSignUp ? 'creating...' : 'signing in...';
    }

    // 1. Try Firebase Auth SDK first (with timeout for Safari compatibility)
    if (auth) {
        try {
            const sdkAuthPromise = (async () => {
                let userCredential;
                if (isSignUp) {
                    userCredential = await auth.createUserWithEmailAndPassword(email, password);
                } else {
                    userCredential = await auth.signInWithEmailAndPassword(email, password);
                }
                return userCredential;
            })();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('SDK_TIMEOUT')), 5000)
            );

            const userCredential = await Promise.race([sdkAuthPromise, timeoutPromise]);

            // SDK succeeded — store credentials so extension popup survives close/reopen
            if (userCredential && userCredential.user) {
                const u = userCredential.user;
                localStorage.setItem('bagged_user_email', u.email || email);
                localStorage.setItem('bagged_local_id', u.uid);
                try {
                    const token = await u.getIdToken();
                    if (token) localStorage.setItem('bagged_id_token', token);
                } catch (_) {}
            }
            if (authSubmitBtn) {
                authSubmitBtn.disabled = false;
                authSubmitBtn.innerText = isSignUp ? 'create account' : 'sign in';
            }
            checkAuthState();
            return false;
        } catch (sdkErr) {
            console.warn("SDK Auth failed or timed out, switching to REST API:", sdkErr.message);
        }
    }

    // 2. Direct REST API Authentication (Bulletproof fallback)
    try {
        const endpoint = isSignUp 
            ? `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`
            : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
        
        // Add timeout to fetch for Safari
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
            signal: controller.signal
        });

        clearTimeout(fetchTimeout);
        const data = await res.json();
        if (data.error) {
            const errCode = data.error.message || data.error.code;
            const msg = friendlyError(errCode);
            if (authError) authError.innerText = msg;
            if (authSubmitBtn) {
                authSubmitBtn.disabled = false;
                authSubmitBtn.innerText = isSignUp ? 'create account' : 'sign in';
            }
        } else if (data.idToken) {
            try {
                localStorage.setItem('bagged_user_email', data.email || email);
                localStorage.setItem('bagged_id_token', data.idToken);
                localStorage.setItem('bagged_local_id', data.localId || btoa(email).replace(/=/g, ''));
                if (data.refreshToken) localStorage.setItem('bagged_refresh_token', data.refreshToken);
            } catch (_) {}

            checkAuthState();
        }
    } catch (restErr) {
        console.error("REST Auth error:", restErr);
        if (authError) authError.innerText = restErr.name === 'AbortError' 
            ? 'connection timed out — please try again' 
            : friendlyError(restErr.message);
        if (authSubmitBtn) {
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = isSignUp ? 'create account' : 'sign in';
        }
    }
    return false;
}

window.handleAuthSubmit = handleAuthSubmit;

// ========== PRODUCT SCANNER & APP LOGIC ==========
// Safari/Chrome API compatibility
const api = (typeof browser !== 'undefined' && browser.tabs) ? browser : (typeof chrome !== 'undefined' ? chrome : null);

async function fetchProductFromTab() {
    if (!api || !api.tabs) return;

    try {
        // Try promise-based API first (Safari), fall back to callback (Chrome)
        let tabs;
        if (api.tabs.query.constructor.name === 'AsyncFunction' || typeof browser !== 'undefined') {
            tabs = await api.tabs.query({ active: true, currentWindow: true });
            if (!tabs || !tabs[0]) tabs = await api.tabs.query({ active: true, lastFocusedWindow: true });
            if (!tabs || !tabs[0]) tabs = await api.tabs.query({ active: true });
        } else {
            tabs = await new Promise(resolve => {
                api.tabs.query({ active: true, currentWindow: true }, (t) => {
                    if (t && t[0]) return resolve(t);
                    api.tabs.query({ active: true, lastFocusedWindow: true }, (t2) => {
                        if (t2 && t2[0]) return resolve(t2);
                        api.tabs.query({ active: true }, (t3) => resolve(t3 || []));
                    });
                });
            });
        }

        const tab = tabs && tabs[0];
        if (!tab || !tab.id) return;

        const url = tab.url || '';
        if (!url.startsWith('http://') && !url.startsWith('https://')) return;

        await queryTabProduct(tab);
    } catch (e) {
        console.warn('fetchProductFromTab error:', e);
    }
}

async function queryTabProduct(tab) {
    if (!tab || !tab.id) return;

    const isSafari = typeof browser !== 'undefined' && browser.tabs;

    // Safari: use executeScript to scrape directly (message passing is unreliable)
    if (isSafari && api.scripting && api.scripting.executeScript) {
        try {
            const results = await api.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Inline scraping function
                    const ogImage = document.querySelector('meta[property="og:image"]');
                    const image = ogImage ? ogImage.content : '';
                    
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    let name = ogTitle ? ogTitle.content : document.title.split('|')[0].split('-')[0].trim();
                    
                    let price = 'price not found';
                    const priceSelectors = ['[class*="price" i]', '[id*="price" i]', '.amount', '.money',
                        'meta[property="og:price:amount"]', 'meta[name="twitter:data1"]'];
                    for (let sel of priceSelectors) {
                        const el = document.querySelector(sel);
                        if (el) {
                            const rawText = (el.content || el.innerText || el.textContent || '').replace(/[Ââ]/g, '').trim();
                            const match = rawText.match(/([$£€¥₹]\s*[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:GBP|USD|EUR|AUD|CAD))/i);
                            if (match) { price = match[0].trim(); break; }
                            else if (rawText && rawText.match(/\d/)) { price = rawText; break; }
                        }
                    }

                    // Get sizes from size-related selects or buttons
                    let sizes = [];
                    const sizeJunk = ['select','size','choose','women','men','woman','man','male','female',
                        'unisex','boys','girls','kids','quantity','color','colour','add','buy','home'];
                    const sizeSelects = document.querySelectorAll('select[name*="size" i], select[class*="size" i], select[id*="size" i], [class*="size-selector" i] select');
                    for (let sel of sizeSelects) {
                        sizes = Array.from(sel.options).map(o => o.innerText.trim()).filter(t => t && !sizeJunk.includes(t.toLowerCase()));
                        if (sizes.length > 0) break;
                    }
                    if (sizes.length === 0) {
                        const sizeEls = document.querySelectorAll('[class*="size-selector"] li, [class*="size-selector"] button, [class*="SizeSelector"] button');
                        sizes = Array.from(sizeEls).map(e => e.innerText.trim()).filter(t => t && t.length < 20 && !sizeJunk.includes(t.toLowerCase()));
                    }

                    return {
                        name: name,
                        brand: window.location.hostname.replace('www.', ''),
                        price: price,
                        image: image && image.startsWith('//') ? 'https:' + image : image,
                        url: window.location.href,
                        sizes: [...new Set(sizes)].slice(0, 20),
                        colors: [],
                        activeSize: '',
                        activeColor: ''
                    };
                }
            });
            
            const response = results && results[0] && results[0].result;
            if (response && response.name) {
                displayProduct(response);
                return;
            }
        } catch (e) {
            console.warn('Safari executeScript scrape failed:', e);
        }
    }

    // Chrome / fallback: inject content.js and use message passing
    try {
        if (api.scripting && api.scripting.executeScript) {
            await api.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        }
    } catch (e) {
        console.log("Script inject notice:", e.message || e);
    }

    await new Promise(r => setTimeout(r, 200));
    await sendProductMessage(tab.id);
}

function displayProduct(response) {
    const imgEl = document.getElementById('product-img');
    if (imgEl) {
        imgEl.src = response.image || '';
        imgEl.style.display = response.image ? "block" : "none";
    }
    const brandEl = document.getElementById('product-brand');
    if (brandEl) brandEl.innerText = (response.brand || "").toLowerCase();
    const nameEl = document.getElementById('product-name');
    if (nameEl) nameEl.innerText = toProperCase(response.name);
    const priceEl = document.getElementById('product-price');
    if (priceEl) priceEl.innerText = response.price || '';
    window.currentProduct = response;
}

async function sendProductMessage(tabId) {
    try {
        let response;
        if (typeof browser !== 'undefined' && browser.tabs) {
            response = await browser.tabs.sendMessage(tabId, { action: "getProduct" });
        } else {
            response = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tabId, { action: "getProduct" }, (resp) => {
                    if (chrome.runtime.lastError) {
                        console.log("Product query notice:", chrome.runtime.lastError.message);
                        resolve(null);
                    } else {
                        resolve(resp);
                    }
                });
            });
        }
        
        if (response && response.name) {
            displayProduct(response);
        }
    } catch (e) {
        console.warn("sendProductMessage error:", e);
    }
}

let _loadingBags = false;

async function loadBagsFromCloud() {
    if (_loadingBags) return;
    _loadingBags = true;

    const bagSelect = document.getElementById('bag-selector');
    if (bagSelect) {
        bagSelect.innerHTML = '<option value="General">My Main Bag</option>';
    }

    const uid = await getUserUid();
    if (!uid) { _loadingBags = false; return; }
    
    // Safari Web Extensions don't support Firestore SDK properly — go straight to REST
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                     (typeof browser !== 'undefined' && typeof chrome === 'undefined');
    
    if (db && !isSafari) {
        try {
            // Add timeout for safety
            const sdkPromise = db.collection('users').doc(uid).collection('wishlists').get();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('SDK_TIMEOUT')), 5000)
            );
            const snapshot = await Promise.race([sdkPromise, timeoutPromise]);
            snapshot.forEach(doc => {
                if (doc.id !== "General" && bagSelect) {
                    let opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.innerText = toProperCase(doc.id);
                    bagSelect.appendChild(opt);
                }
            });
        } catch (e) {
            console.warn("Firestore SDK wishlist load notice, trying REST API:", e);
            await loadBagsFromREST(uid);
        }
    } else {
        await loadBagsFromREST(uid);
    }

    const lastBag = localStorage.getItem('lastUsedBag_' + uid);
    if (lastBag && bagSelect) {
        const exists = Array.from(bagSelect.options).some(opt => opt.value === lastBag);
        if (exists) bagSelect.value = lastBag;
    }

    _loadingBags = false;
}

async function loadBagsFromREST(uid) {
    const bagSelect = document.getElementById('bag-selector');
    try {
        const token = localStorage.getItem('bagged_id_token') || '';
        
        console.log('[Bagged REST] Loading bags for uid:', uid, 'token present:', !!token);
        
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 8000);
        
        // Use Firestore REST with ID token as query parameter (Bearer header requires OAuth tokens)
        let url = `https://firestore.googleapis.com/v1/projects/bagged-dc0f7/databases/(default)/documents/users/${uid}/wishlists`;
        
        const res = await fetch(url, { 
            headers: token ? { 'Authorization': 'Bearer ' + token } : {},
            signal: controller.signal 
        });
        clearTimeout(fetchTimeout);
        
        console.log('[Bagged REST] Response status:', res.status);
        let data = await res.json();
        console.log('[Bagged REST] Data:', JSON.stringify(data).substring(0, 500));
        
        // If Bearer auth failed (403), retry with token as URL parameter
        if (data.error && data.error.code === 403 && token) {
            console.log('[Bagged REST] Bearer failed, retrying with URL token...');
            const res2 = await fetch(url + '?access_token=' + encodeURIComponent(token));
            data = await res2.json();
            console.log('[Bagged REST] Retry status:', res2.status, 'Data:', JSON.stringify(data).substring(0, 300));
        }
        
        // If still failing, try the legacy Firebase REST endpoint  
        if (data.error && token) {
            console.log('[Bagged REST] Trying legacy Firebase endpoint...');
            const legacyUrl = `https://bagged-dc0f7.firebaseio.com/users/${uid}/wishlists.json?auth=${token}`;
            const res3 = await fetch(legacyUrl);
            const legacyData = await res3.json();
            console.log('[Bagged REST] Legacy data:', JSON.stringify(legacyData).substring(0, 300));
            
            // Legacy format is different - convert
            if (legacyData && typeof legacyData === 'object' && !legacyData.error) {
                Object.keys(legacyData).forEach(docId => {
                    if (docId !== "General" && bagSelect) {
                        let opt = document.createElement('option');
                        opt.value = docId;
                        opt.innerText = toProperCase(docId);
                        bagSelect.appendChild(opt);
                    }
                });
                return; // Done via legacy
            }
        }
        
        if (data.documents) {
            data.documents.forEach(doc => {
                const docId = doc.name.split('/').pop();
                if (docId && docId !== "General" && bagSelect) {
                    let opt = document.createElement('option');
                    opt.value = docId;
                    opt.innerText = toProperCase(docId);
                    bagSelect.appendChild(opt);
                }
            });
        } else if (data.error) {
            console.error('[Bagged REST] Firestore error:', data.error.message);
            
            // Last resort: refresh the token and retry
            if (token) {
                console.log('[Bagged REST] Attempting token refresh...');
                try {
                    const refreshRes = await fetch(
                        `https://securetoken.googleapis.com/v1/token?key=AIzaSyA1BJ5_ItJr_S9bExIIz_oaeg-HYDMc7LY`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(localStorage.getItem('bagged_refresh_token') || '')
                        }
                    );
                    const refreshData = await refreshRes.json();
                    if (refreshData.id_token) {
                        localStorage.setItem('bagged_id_token', refreshData.id_token);
                        // Retry with new token
                        const retryRes = await fetch(url, {
                            headers: { 'Authorization': 'Bearer ' + refreshData.id_token }
                        });
                        const retryData = await retryRes.json();
                        if (retryData.documents) {
                            retryData.documents.forEach(doc => {
                                const docId = doc.name.split('/').pop();
                                if (docId && docId !== "General" && bagSelect) {
                                    let opt = document.createElement('option');
                                    opt.value = docId;
                                    opt.innerText = toProperCase(docId);
                                    bagSelect.appendChild(opt);
                                }
                            });
                        }
                    }
                } catch (refreshErr) {
                    console.warn('[Bagged REST] Token refresh failed:', refreshErr);
                }
            }
        }
    } catch (e) {
        console.warn("REST wishlist load notice:", e);
    }
}

function initApp() {
    fetchProductFromTab();
    loadBagsFromCloud();
}

window.initApp = initApp;

// ========== AUTH STATE & AUTO-LOGIN ==========
function checkAuthState() {
    const user = auth ? auth.currentUser : null;
    const storedEmail = localStorage.getItem('bagged_user_email');
    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app-view');

    if (user || storedEmail) {
        if (loginView) loginView.style.display = 'none';
        if (appView) appView.style.display = 'block';
        const emailDisp = document.getElementById('user-email-display');
        if (emailDisp) emailDisp.innerText = user ? user.email : storedEmail;
        initApp();
    } else {
        if (loginView) loginView.style.display = 'flex';
        if (appView) appView.style.display = 'none';
    }
}

if (auth) {
    auth.onAuthStateChanged(() => checkAuthState());
}

document.addEventListener('DOMContentLoaded', function () {
    checkAuthState();

    // Attach form submit handler via JS (inline onsubmit blocked by extension CSP)
    const loginForm = document.getElementById('popup-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (window.handleAuthSubmit) window.handleAuthSubmit(e);
        });
    }

    const authToggleLink = document.getElementById('auth-toggle-link');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authConfirmPassword = document.getElementById('auth-confirm-password');
    const confirmWrapper = document.getElementById('confirm-password-wrapper');
    const authError = document.getElementById('auth-error');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');

    if (authToggleLink) {
        authToggleLink.addEventListener('click', () => {
            isSignUp = !isSignUp;
            if (authError) authError.innerText = '';
            if (authConfirmPassword) authConfirmPassword.value = '';
            if (isSignUp) {
                if (authSubmitBtn) authSubmitBtn.innerText = 'create account';
                if (authToggleText) authToggleText.innerText = 'already have an account? ';
                if (authToggleLink) authToggleLink.innerText = 'sign in';
                if (authPassword) authPassword.setAttribute('autocomplete', 'new-password');
                if (confirmWrapper) confirmWrapper.classList.add('show');
            } else {
                if (authSubmitBtn) authSubmitBtn.innerText = 'sign in';
                if (authToggleText) authToggleText.innerText = "don't have an account? ";
                if (authToggleLink) authToggleLink.innerText = 'create one';
                if (authPassword) authPassword.setAttribute('autocomplete', 'current-password');
                if (confirmWrapper) confirmWrapper.classList.remove('show');
            }
        });
    }

    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            if (auth) {
                try { auth.signOut(); } catch (_) {}
            }
            localStorage.removeItem('bagged_user_email');
            localStorage.removeItem('bagged_email');
            localStorage.removeItem('bagged_id_token');
            localStorage.removeItem('bagged_local_id');
            localStorage.removeItem('bagged_refresh_token');
            checkAuthState();
        });
    }

    const saveBtn = document.getElementById('save-btn');
    const bagSelect = document.getElementById('bag-selector');
    const addBagBtn = document.getElementById('add-bag-btn');

    if (addBagBtn) {
        addBagBtn.addEventListener('click', async () => {
            const uid = await getUserUid();
            if (!uid) return;
            const nameInput = document.getElementById('new-bag-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (name) {
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                                 (typeof browser !== 'undefined' && typeof chrome === 'undefined');
                let saved = false;
                if (db && !isSafari) {
                    try {
                        await db.collection('users').doc(uid).collection('wishlists').doc(name).set({ created: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                        saved = true;
                    } catch (_) {}
                }
                if (!saved) {
                    // REST fallback for Safari
                    try {
                        const token = localStorage.getItem('bagged_id_token') || '';
                        await fetch(
                            `https://firestore.googleapis.com/v1/projects/bagged-dc0f7/databases/(default)/documents/users/${uid}/wishlists/${encodeURIComponent(name)}`,
                            {
                                method: 'PATCH',
                                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fields: { created: { booleanValue: true } } })
                            }
                        );
                    } catch (e) { console.warn('REST create wishlist error:', e); }
                }
                localStorage.setItem('lastUsedBag_' + uid, name);
                await loadBagsFromCloud();
                if (bagSelect) bagSelect.value = name;
                if (nameInput) nameInput.value = "";
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const uid = await getUserUid();
            if (!uid || !window.currentProduct) return;
            const selectedBag = (bagSelect ? bagSelect.value : '') || "General";

            try {
                const product = {
                    ...window.currentProduct,
                    size: window.currentProduct.activeSize || "",
                    color: window.currentProduct.activeColor || "",
                    sizes: window.currentProduct.sizes || [],
                    colors: window.currentProduct.colors || []
                };

                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                                 (typeof browser !== 'undefined' && typeof chrome === 'undefined');
                let saved = false;
                if (db && !isSafari) {
                    try {
                        await db.collection('users').doc(uid).collection('wishlists').doc(selectedBag).collection('items').add({
                            ...product,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        saved = true;
                    } catch (_) {}
                }
                if (!saved) {
                    // REST fallback for Safari
                    const token = localStorage.getItem('bagged_id_token') || '';
                    const fields = {};
                    Object.entries(product).forEach(([k, v]) => {
                        if (typeof v === 'string') fields[k] = { stringValue: v };
                        else if (typeof v === 'number') fields[k] = { doubleValue: v };
                        else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
                        else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map(i => ({ stringValue: String(i) })) } };
                    });
                    fields['timestamp'] = { timestampValue: new Date().toISOString() };
                    
                    await fetch(
                        `https://firestore.googleapis.com/v1/projects/bagged-dc0f7/databases/(default)/documents/users/${uid}/wishlists/${encodeURIComponent(selectedBag)}/items`,
                        {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fields })
                        }
                    );
                }
                localStorage.setItem('lastUsedBag_' + uid, selectedBag);
                saveBtn.innerText = "BAGGED!";
                saveBtn.style.backgroundColor = "#27ae60";
                setTimeout(() => {
                    saveBtn.innerText = "ADD TO BAGGED";
                    saveBtn.style.backgroundColor = "black";
                }, 2000);
            } catch (e) { console.error("Save error:", e); }
        });
    }

    const viewBagsBtn = document.getElementById('view-bags-btn');
    if (viewBagsBtn) {
        viewBagsBtn.onclick = () => {
            const email = localStorage.getItem('bagged_user_email') || '';
            const token = localStorage.getItem('bagged_id_token') || '';
            const uid = localStorage.getItem('bagged_local_id') || '';
            let dashUrl = 'https://www.shop-bagged.com/dashboard';
            if (email) {
                dashUrl += '/' + encodeURIComponent(email);
            }
            if (token && uid) {
                dashUrl += '#token=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email) + '&uid=' + encodeURIComponent(uid);
            }
            if (api && api.tabs) {
                api.tabs.create({ url: dashUrl });
            } else {
                window.open(dashUrl, '_blank');
            }
        };
    }
});

function init() {
    if (window.initApp) window.initApp();
}

// Privacy Policy modal (moved from inline script to satisfy CSP)
document.addEventListener('DOMContentLoaded', () => {
    const privacyOverlay = document.getElementById('privacy-modal-overlay');
    const privacyClose = document.getElementById('privacy-modal-close');
    if (!privacyOverlay || !privacyClose) return;
    document.querySelectorAll('.open-privacy-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            privacyOverlay.style.display = 'flex';
        });
    });
    privacyClose.addEventListener('click', () => { privacyOverlay.style.display = 'none'; });
    privacyOverlay.addEventListener('click', (e) => {
        if (e.target === privacyOverlay) privacyOverlay.style.display = 'none';
    });
});

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
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch(() => auth.setPersistence(firebase.auth.Auth.Persistence.SESSION))
            .catch(() => auth.setPersistence(firebase.auth.Auth.Persistence.NONE))
            .catch(err => console.warn("Auth persistence notice:", err));
        db = firebase.firestore();
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

    // 1. Try Firebase Auth SDK first
    if (auth) {
        try {
            if (isSignUp) {
                await auth.createUserWithEmailAndPassword(email, password);
                return false;
            } else {
                await auth.signInWithEmailAndPassword(email, password);
                return false;
            }
        } catch (sdkErr) {
            console.warn("SDK Auth failed, switching to direct REST API:", sdkErr);
        }
    }

    // 2. Direct REST API Authentication (Bulletproof fallback)
    try {
        const endpoint = isSignUp 
            ? `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`
            : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
        
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        });

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
            } catch (_) {}

            checkAuthState();
        }
    } catch (restErr) {
        console.error("REST Auth error:", restErr);
        if (authError) authError.innerText = friendlyError(restErr.message);
        if (authSubmitBtn) {
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = isSignUp ? 'create account' : 'sign in';
        }
    }
    return false;
}

window.handleAuthSubmit = handleAuthSubmit;

// ========== PRODUCT SCANNER & APP LOGIC ==========
function fetchProductFromTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let tab = tabs && tabs[0];
        if (!tab) {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs2) => {
                let tab2 = tabs2 && tabs2[0];
                if (!tab2) {
                    chrome.tabs.query({ active: true }, (tabs3) => {
                        if (tabs3 && tabs3[0]) queryTabProduct(tabs3[0]);
                    });
                } else {
                    queryTabProduct(tab2);
                }
            });
        } else {
            queryTabProduct(tab);
        }
    });
}

function queryTabProduct(tab) {
    if (!tab || !tab.id) return;

    // Inject content.js to guarantee message receiver is ready
    if (chrome.scripting) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }, () => sendProductMessage(tab.id));
    } else {
        sendProductMessage(tab.id);
    }
}

function sendProductMessage(tabId) {
    chrome.tabs.sendMessage(tabId, { action: "getProduct" }, (response) => {
        if (chrome.runtime.lastError || !response) {
            console.log("Product query response notice:", chrome.runtime.lastError);
            return;
        }
        if (response && response.name) {
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
    });
}

async function loadBagsFromCloud() {
    const bagSelect = document.getElementById('bag-selector');
    if (bagSelect) {
        bagSelect.innerHTML = '<option value="General">My Main Bag</option>';
    }

    const uid = await getUserUid();
    if (!uid) return;
    
    if (db) {
        try {
            const snapshot = await db.collection('users').doc(uid).collection('wishlists').get();
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
}

async function loadBagsFromREST(uid) {
    const bagSelect = document.getElementById('bag-selector');
    try {
        const res = await fetch(`https://firestore.googleapis.com/v1/projects/bagged-dc0f7/databases/(default)/documents/users/${uid}/wishlists`);
        const data = await res.json();
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
            if (auth) auth.signOut();
            localStorage.removeItem('bagged_user_email');
            localStorage.removeItem('bagged_id_token');
            localStorage.removeItem('bagged_local_id');
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
                if (db) {
                    try {
                        await db.collection('users').doc(uid).collection('wishlists').doc(name).set({ created: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    } catch (_) {}
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
                if (db) {
                    await db.collection('users').doc(uid).collection('wishlists').doc(selectedBag).collection('items').add({
                        ...window.currentProduct,
                        size: window.currentProduct.activeSize || "",
                        color: window.currentProduct.activeColor || "",
                        sizes: window.currentProduct.sizes || [],
                        colors: window.currentProduct.colors || [],
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
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
        viewBagsBtn.onclick = () => chrome.tabs.create({ url: 'dashboard.html' });
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

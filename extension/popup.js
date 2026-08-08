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
        'auth/user-disabled': 'this account has been disabled',
        'USER_DISABLED': 'this account has been disabled',
    };
    return map[code] || 'error: ' + (code || 'unknown') + ' - please try again';
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

    // 1. Try Firebase Auth SDK first if available
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
            // Save token
            try {
                localStorage.setItem('bagged_user_email', data.email || email);
                localStorage.setItem('bagged_id_token', data.idToken);
                localStorage.setItem('bagged_local_id', data.localId);
            } catch (_) {}

            // Transition UI
            const loginView = document.getElementById('login-view');
            const appView = document.getElementById('app-view');
            if (loginView) loginView.style.display = 'none';
            if (appView) appView.style.display = 'block';
            
            const emailDisp = document.getElementById('user-email-display');
            if (emailDisp) emailDisp.innerText = data.email || email;

            if (window.initApp) window.initApp();
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

const popupLoginForm = document.getElementById('popup-login-form');
if (popupLoginForm) {
    popupLoginForm.addEventListener('submit', handleAuthSubmit);
}
if (authSubmitBtn) {
    authSubmitBtn.addEventListener('click', handleAuthSubmit);
}

// Enter key navigation
authEmail.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authPassword.focus();
});
authPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (isSignUp) {
            authConfirmPassword.focus();
        } else {
            authSubmitBtn.click();
        }
    }
});
authConfirmPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authSubmitBtn.click();
});

function friendlyError(code) {
    console.log('Auth error code:', code);
    const map = {
        'auth/email-already-in-use': 'an account with this email already exists',
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
    };
    return map[code] || 'error: ' + (code || 'unknown') + ' - please try again';
}

// ========== AUTH STATE ==========
auth.onAuthStateChanged((user) => {
    if (user) {
        loginView.style.display = 'none';
        appView.style.display = 'block';
        document.getElementById('user-email-display').innerText = user.email;
        init();
    } else {
        loginView.style.display = 'flex';
        appView.style.display = 'none';
    }
});

document.getElementById('sign-out-btn').addEventListener('click', () => {
    auth.signOut();
});

// ========== APP LOGIC ==========
// Trigger GitHub Actions deploy test 2
document.addEventListener('DOMContentLoaded', function () {
    const saveBtn = document.getElementById('save-btn');
    const bagSelect = document.getElementById('bag-selector');
    const addBagBtn = document.getElementById('add-bag-btn');

    function toProperCase(str) {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }

    async function initApp() {
        const user = auth.currentUser;
        if (!user) return;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Inject content script first to ensure it's available
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (e) {
            console.log("Script injection:", e.message);
        }

        // Small delay to ensure script is ready
        setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: "getProduct" }, (response) => {
                if (chrome.runtime.lastError) {
                    document.getElementById('product-name').innerText = "Could not read this page";
                    console.log(chrome.runtime.lastError.message);
                    return;
                }
                if (response) {
                    document.getElementById('product-img').src = response.image;
                    document.getElementById('product-img').style.display = response.image ? "block" : "none";
                    document.getElementById('product-brand').innerText = (response.brand || "").toLowerCase();
                    document.getElementById('product-name').innerText = toProperCase(response.name);
                    document.getElementById('product-price').innerText = response.price;
                    window.currentProduct = response;
                }
            });
        }, 300);

        loadBagsFromCloud();
    }

    async function loadBagsFromCloud() {
        const user = auth.currentUser;
        if (!user) return;
        const snapshot = await db.collection('users').doc(user.uid).collection('wishlists').get();
        bagSelect.innerHTML = '<option value="General">My Main Bag</option>';
        snapshot.forEach(doc => {
            if (doc.id !== "General") {
                let opt = document.createElement('option');
                opt.value = doc.id;
                opt.innerText = toProperCase(doc.id);
                bagSelect.appendChild(opt);
            }
        });

        // Default to the last bag the user saved to or created
        const lastBag = localStorage.getItem('lastUsedBag_' + user.uid);
        if (lastBag) {
            // Check the bag still exists in the dropdown
            const exists = Array.from(bagSelect.options).some(opt => opt.value === lastBag);
            if (exists) bagSelect.value = lastBag;
        }
    }

    addBagBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        const name = document.getElementById('new-bag-name').value.trim();
        if (name) {
            await db.collection('users').doc(user.uid).collection('wishlists').doc(name).set({ created: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            localStorage.setItem('lastUsedBag_' + user.uid, name);
            await loadBagsFromCloud();
            bagSelect.value = name;
            document.getElementById('new-bag-name').value = "";
        }
    });

    saveBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user || !window.currentProduct) return;
        const selectedBag = bagSelect.value || "General";

        try {
            await db.collection('users').doc(user.uid).collection('wishlists').doc(selectedBag).collection('items').add({
                ...window.currentProduct,
                size: window.currentProduct.activeSize || "",
                color: window.currentProduct.activeColor || "",
                sizes: window.currentProduct.sizes || [],
                colors: window.currentProduct.colors || [],
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            localStorage.setItem('lastUsedBag_' + user.uid, selectedBag);
            saveBtn.innerText = "BAGGED!";
            saveBtn.style.backgroundColor = "#27ae60";
            setTimeout(() => {
                saveBtn.innerText = "ADD TO BAGGED";
                saveBtn.style.backgroundColor = "black";
            }, 2000);
        } catch (e) { console.error("Save error:", e); }
    });

    document.getElementById('view-bags-btn').onclick = () => chrome.tabs.create({ url: 'dashboard.html' });

    // Expose initApp globally so auth state listener can call it
    window.initApp = initApp;
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

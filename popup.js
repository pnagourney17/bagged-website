const firebaseConfig = {
    apiKey: "AIzaSyA1BJ5_ItJr_S9bExIIz_oaeg-HYDMc7LY",
    authDomain: "bagged-dc0f7.firebaseapp.com",
    projectId: "bagged-dc0f7",
    storageBucket: "bagged-dc0f7.firebasestorage.app",
    messagingSenderId: "103392647585",
    appId: "1:103392647585:web:edd49907154bd481a193e0"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.firestore();

// ========== AUTH UI ==========
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authConfirmPassword = document.getElementById('auth-confirm-password');
const confirmWrapper = document.getElementById('confirm-password-wrapper');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authError = document.getElementById('auth-error');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');

let isSignUp = false;

// Toggle between sign in / create account
authToggleLink.addEventListener('click', () => {
    isSignUp = !isSignUp;
    authError.innerText = '';
    authConfirmPassword.value = '';
    if (isSignUp) {
        authSubmitBtn.innerText = 'create account';
        authToggleText.innerText = 'already have an account? ';
        authToggleLink.innerText = 'sign in';
        authPassword.setAttribute('autocomplete', 'new-password');
        confirmWrapper.classList.add('show');
    } else {
        authSubmitBtn.innerText = 'sign in';
        authToggleText.innerText = "don't have an account? ";
        authToggleLink.innerText = 'create one';
        authPassword.setAttribute('autocomplete', 'current-password');
        confirmWrapper.classList.remove('show');
    }
});

// Show/hide password toggles
function setupPasswordToggle(toggleBtn, inputField) {
    toggleBtn.addEventListener('click', () => {
        const isHidden = inputField.type === 'password';
        inputField.type = isHidden ? 'text' : 'password';
        toggleBtn.textContent = isHidden ? 'hide' : 'show';
        toggleBtn.classList.toggle('active', isHidden);
        toggleBtn.title = isHidden ? 'Hide password' : 'Show password';
    });
}

setupPasswordToggle(document.getElementById('toggle-auth-password'), authPassword);
setupPasswordToggle(document.getElementById('toggle-auth-confirm'), authConfirmPassword);

// Submit handler
authSubmitBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    authError.innerText = '';

    if (!email || !password) {
        authError.innerText = 'please enter your email and password';
        return;
    }

    if (isSignUp) {
        const confirmPass = authConfirmPassword.value;
        if (!confirmPass) {
            authError.innerText = 'please confirm your password';
            authConfirmPassword.focus();
            return;
        }
        if (password !== confirmPass) {
            authError.innerText = 'passwords do not match';
            authConfirmPassword.focus();
            return;
        }
    }

    authSubmitBtn.disabled = true;
    authSubmitBtn.innerText = isSignUp ? 'creating...' : 'signing in...';

    try {
        if (isSignUp) {
            await auth.createUserWithEmailAndPassword(email, password);
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (e) {
        const msg = friendlyError(e.code);
        authError.innerText = msg;
        authSubmitBtn.disabled = false;
        authSubmitBtn.innerText = isSignUp ? 'create account' : 'sign in';
    }
});

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
// Trigger GitHub Actions deploy test
document.addEventListener('DOMContentLoaded', function () {
    const saveBtn = document.getElementById('save-btn');
    const bagSelect = document.getElementById('bag-selector');
    const addBagBtn = document.getElementById('add-bag-btn');

    // Size & Colour selector elements
    const productOptions = document.getElementById('product-options');
    const sizeBlock = document.getElementById('size-block');
    const sizeSelector = document.getElementById('size-selector');
    const colourBlock = document.getElementById('colour-block');
    const colourSelector = document.getElementById('colour-selector');

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

                    // Populate sizes
                    let showSizes = false;
                    if (response.sizes && response.sizes.length > 0) {
                        sizeSelector.innerHTML = '<option value="">Select Size</option>' + 
                            response.sizes.map(s => `<option value="${s}">${s}</option>`).join('');
                        sizeBlock.style.display = 'flex';
                        showSizes = true;
                    } else {
                        sizeBlock.style.display = 'none';
                        sizeSelector.innerHTML = '';
                    }

                    // Populate colours
                    let showColours = false;
                    if (response.colors && response.colors.length > 0) {
                        colourSelector.innerHTML = '<option value="">Select Colour</option>' + 
                            response.colors.map(c => `<option value="${c}">${c}</option>`).join('');
                        colourBlock.style.display = 'flex';
                        showColours = true;
                    } else {
                        colourBlock.style.display = 'none';
                        colourSelector.innerHTML = '';
                    }

                    if (showSizes || showColours) {
                        productOptions.style.display = 'flex';
                    } else {
                        productOptions.style.display = 'none';
                    }
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

        // Get selected size & color values
        let finalSize = '';
        if (sizeBlock.style.display !== 'none') {
            finalSize = sizeSelector.value;
        }

        let finalColour = '';
        if (colourBlock.style.display !== 'none') {
            finalColour = colourSelector.value;
        }

        try {
            await db.collection('users').doc(user.uid).collection('wishlists').doc(selectedBag).collection('items').add({
                ...window.currentProduct,
                size: finalSize,
                color: finalColour,
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

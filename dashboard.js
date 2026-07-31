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

// ========== DASHBOARD AUTH GATE ==========
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');
const loginGate = document.getElementById('dashboard-login-gate');
const gateSubmit = document.getElementById('gate-submit');
const gateEmail = document.getElementById('gate-email');
const gatePassword = document.getElementById('gate-password');
const gateConfirmPassword = document.getElementById('gate-confirm-password');
const gateConfirmWrapper = document.getElementById('gate-confirm-wrapper');
const gateError = document.getElementById('dashboard-auth-error');
const gateToggleLink = document.getElementById('gate-toggle-link');
const gateToggleText = document.getElementById('gate-toggle-text');

let gateIsSignUp = false;

gateToggleLink.addEventListener('click', () => {
    gateIsSignUp = !gateIsSignUp;
    gateError.innerText = '';
    gateConfirmPassword.value = '';
    if (gateIsSignUp) {
        gateSubmit.innerText = 'create account';
        gateToggleText.innerText = 'already have an account? ';
        gateToggleLink.innerText = 'sign in';
        gateConfirmWrapper.classList.add('show');
    } else {
        gateSubmit.innerText = 'sign in';
        gateToggleText.innerText = "don't have an account? ";
        gateToggleLink.innerText = 'create one';
        gateConfirmWrapper.classList.remove('show');
    }
});

// Show/hide password toggles
function setupGatePasswordToggle(toggleBtn, inputField) {
    toggleBtn.addEventListener('click', () => {
        const isHidden = inputField.type === 'password';
        inputField.type = isHidden ? 'text' : 'password';
        toggleBtn.textContent = isHidden ? 'hide' : 'show';
        toggleBtn.classList.toggle('active', isHidden);
        toggleBtn.title = isHidden ? 'Hide password' : 'Show password';
    });
}

setupGatePasswordToggle(document.getElementById('toggle-gate-password'), gatePassword);
setupGatePasswordToggle(document.getElementById('toggle-gate-confirm'), gateConfirmPassword);

gateSubmit.addEventListener('click', async () => {
    const email = gateEmail.value.trim();
    const password = gatePassword.value;
    gateError.innerText = '';
    if (!email || !password) {
        gateError.innerText = 'please enter your email and password';
        return;
    }

    if (gateIsSignUp) {
        const confirmPass = gateConfirmPassword.value;
        if (!confirmPass) {
            gateError.innerText = 'please confirm your password';
            gateConfirmPassword.focus();
            return;
        }
        if (password !== confirmPass) {
            gateError.innerText = 'passwords do not match';
            gateConfirmPassword.focus();
            return;
        }
    }

    try {
        if (gateIsSignUp) {
            await auth.createUserWithEmailAndPassword(email, password);
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (e) {
        console.log('Auth error code:', e.code);
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
        gateError.innerText = map[e.code] || 'error: ' + (e.code || 'unknown') + ' - please try again';
    }
});

// Enter key navigation
gateEmail.addEventListener('keydown', (e) => { if (e.key === 'Enter') gatePassword.focus(); });
gatePassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (gateIsSignUp) gateConfirmPassword.focus();
        else gateSubmit.click();
    }
});
gateConfirmPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') gateSubmit.click(); });

// Sign out from sidebar (handled at bottom of file)

// Check if viewing a public shared bag URL
function getPublicSharedBagParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const u = urlParams.get('u');
    const b = urlParams.get('b');
    if (u && b) return { uid: u, bag: b };
    return null;
}

const publicSharedParams = getPublicSharedBagParams();

if (publicSharedParams) {
    // Viewer is checking a public link - bypass auth gate
    sidebar.style.display = 'none';
    loginGate.style.display = 'none';
    mainContent.style.display = '';
    loadPublicSharedDashboard(publicSharedParams.uid, publicSharedParams.bag);
} else {
    // Normal dashboard flow - require authentication
    auth.onAuthStateChanged((user) => {
        if (user) {
            sidebar.style.display = 'flex';
            mainContent.style.display = '';
            loginGate.style.display = 'none';
            document.getElementById('sidebar-email').innerText = user.email;
            loadCloudDashboard(user);
        } else {
            sidebar.style.display = 'none';
            mainContent.style.display = 'none';
            loginGate.style.display = 'flex';
        }
    });
}

// ========== CHECKOUT CART ==========
const checkoutCart = [];

function updateCartDropdown() {
    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const checkoutBtn = document.getElementById('checkout-all-btn');

    if (!cartItems) return;

    cartCount.textContent = checkoutCart.length;

    if (checkoutCart.length === 0) {
        cartItems.innerHTML = '<p style="color: #888; font-size: 12px; text-transform: lowercase; margin: 0;">no items in checkout</p>';
        checkoutBtn.style.opacity = '0.5';
    } else {
        cartItems.innerHTML = checkoutCart.map((item, index) => `
            <div style="display: flex; gap: 12px; align-items: center; padding: 10px 0; ${index > 0 ? 'border-top: 1px solid #eee;' : ''}">
                <img src="${item.image}" style="width: 50px; height: 50px; object-fit: cover; background: #f5f5f5;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 11px; color: #888; text-transform: lowercase;">${item.brand}</div>
                    <div style="font-size: 12px; font-weight: 500; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                    <div style="font-size: 12px; font-weight: bold; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span>${item.price}</span>
                        ${(item.size || item.color) ? `<span style="font-size: 9px; color: #777; font-weight: normal; text-transform: capitalize; background: #f5f5f5; padding: 1px 4px; border-radius: 3px;">${item.size ? `Size: ${item.size}` : ''}${item.size && item.color ? ' | ' : ''}${item.color ? `Col: ${item.color}` : ''}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        checkoutBtn.style.opacity = '1';
    }
}

function removeFromCart(itemId) {
    const index = checkoutCart.findIndex(item => item.id === itemId);
    if (index >= 0) {
        checkoutCart.splice(index, 1);
        updateCartDropdown();
        const btn = document.querySelector(`.add-checkout-btn[data-id="${itemId}"]`);
        if (btn) {
            btn.textContent = '+ add to checkout';
            btn.style.color = '#000';
        }
    }
}

// Check if viewing a shared bag internally via hash
function getSharedBagId() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#bag-')) {
        return decodeURIComponent(hash.replace('#bag-', ''));
    }
    return null;
}

// Function to load a strictly public dashboard view
async function loadPublicSharedDashboard(uid, bagName) {
    const container = document.getElementById('bags-container');
    try {
        console.log('Loading public shared bag:', bagName);
        const boardRef = db.collection('users').doc(uid).collection('wishlists').doc(bagName);
        const itemsSnapshot = await boardRef.collection('items').get();
        
        if (itemsSnapshot.empty) {
            container.innerHTML = "<p style='color: #888;'>bag not found or is empty</p>";
            return;
        }
        
        container.innerHTML = "";
        const items = [];
        itemsSnapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });

        // Sort items newest first (descending by timestamp)
        items.sort((a, b) => {
            const timeA = a.timestamp && typeof a.timestamp.toMillis === 'function' ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp && typeof b.timestamp.toMillis === 'function' ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });

        const board = { name: bagName, items: items };
        
        // Pass user object mock since it's anonymous
        renderBoardDetail(container, board, {uid: uid}, true);
    } catch (error) {
        console.error('Shared bag load error:', error);
        container.innerHTML = `<p style="color: #d63031; font-size: 13px;">Error loading bag. Are you sure you have access?</p><p style="color: #888; font-size: 10px; margin-top: 8px;">Ensure Firestore rules allow public reads for the owner's database collection.</p>`;
    }
}

async function loadCloudDashboard(user) {
    const container = document.getElementById('bags-container');
    const sharedBagId = getSharedBagId();

    try {
        console.log('Loading wishlists for user:', user.uid);
        const userWishlists = db.collection('users').doc(user.uid).collection('wishlists');
        const wishlistsSnapshot = await userWishlists.get();
        console.log('Wishlists found:', wishlistsSnapshot.size);
        if (wishlistsSnapshot.empty) {
            container.innerHTML = "<p style='text-transform: lowercase; color: #888;'>your bags are empty - save a product to get started</p>";
            return;
        }

        container.innerHTML = "";

        // Collect all bags with their items
        const boardsData = [];
        for (const wishlistDoc of wishlistsSnapshot.docs) {
            const itemsSnapshot = await userWishlists.doc(wishlistDoc.id).collection('items').get();
            const items = [];
            itemsSnapshot.forEach(itemDoc => {
                items.push({ id: itemDoc.id, ...itemDoc.data() });
            });

            // Sort items newest first (descending by timestamp)
            items.sort((a, b) => {
                const timeA = a.timestamp && typeof a.timestamp.toMillis === 'function' ? a.timestamp.toMillis() : 0;
                const timeB = b.timestamp && typeof b.timestamp.toMillis === 'function' ? b.timestamp.toMillis() : 0;
                return timeB - timeA;
            });

            boardsData.push({ name: wishlistDoc.id, items });
        }

        // Sort by saved order
        const savedOrder = JSON.parse(localStorage.getItem('bagOrder_' + user.uid) || '[]');
        if (savedOrder.length > 0) {
            boardsData.sort((a, b) => {
                const aIdx = savedOrder.indexOf(a.name);
                const bIdx = savedOrder.indexOf(b.name);
                if (aIdx === -1 && bIdx === -1) return 0;
                if (aIdx === -1) return 1;
                if (bIdx === -1) return -1;
                return aIdx - bIdx;
            });
        }

        // If viewing a specific bag (shared or clicked), show detail view
        if (sharedBagId) {
            const board = boardsData.find(b => b.name === sharedBagId);
            if (board) {
                renderBoardDetail(container, board, user, true);
            } else {
                container.innerHTML = "<p style='color: #888;'>bag not found</p>";
            }
            return;
        }

        // Render Pinterest-style board overview
        renderBoardsOverview(container, boardsData, user);

        // Setup cart toggle
        setupCartWidget();

    } catch (error) {
        console.error('Dashboard load error:', error);
        container.innerHTML = `<p style="color: #d63031; font-size: 13px;">Error loading bags: ${error.message}</p><p style="color: #888; font-size: 12px; margin-top: 8px;">Check Firestore rules and browser console for details.</p>`;
    }
}

function saveOrder(uid, boardsData) {
    const order = boardsData.map(b => b.name);
    localStorage.setItem('bagOrder_' + uid, JSON.stringify(order));
}

function renderBoardsOverview(container, boardsData, user) {
    // Search bar
    const searchWrapper = document.createElement('div');
    searchWrapper.style.cssText = 'margin-bottom: 28px; position: relative; max-width: 360px;';
    searchWrapper.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" style="position:absolute; left:14px; top:50%; transform:translateY(-50%); width:15px; height:15px; pointer-events:none;">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="bag-search" type="text" placeholder="search wishlists..." style="width:100%; padding:10px 14px 10px 38px; border:1px solid #eee; border-radius:8px; font-size:13px; font-family:inherit; outline:none; color:#111; background:#fafafa; transition:border-color 0.2s; box-sizing:border-box;">
    `;
    container.appendChild(searchWrapper);

    const searchInput = searchWrapper.querySelector('#bag-search');
    searchInput.addEventListener('focus', () => { searchInput.style.borderColor = '#000'; searchInput.style.background = '#fff'; });
    searchInput.addEventListener('blur', () => { searchInput.style.borderColor = '#eee'; searchInput.style.background = '#fafafa'; });

    const grid = document.createElement('div');
    grid.className = 'boards-grid';

    for (const board of boardsData) {
        const card = document.createElement('div');
        card.className = 'board-card';
        card.dataset.name = board.name.toLowerCase();

        const images = board.items
            .map(item => item.image)
            .filter(img => img && img.length > 0)
            .slice(0, 3);

        let collageHTML = '<div class="board-collage">';
        if (images.length >= 1) {
            collageHTML += `<div class="collage-main"><img src="${images[0]}" alt=""></div>`;
        } else {
            collageHTML += '<div class="collage-main collage-empty"></div>';
        }
        if (images.length >= 2) {
            collageHTML += `<div><img src="${images[1]}" alt=""></div>`;
        } else {
            collageHTML += '<div class="collage-empty"></div>';
        }
        if (images.length >= 3) {
            collageHTML += `<div><img src="${images[2]}" alt=""></div>`;
        } else {
            collageHTML += '<div class="collage-empty"></div>';
        }
        collageHTML += '</div>';

        card.innerHTML = `
            <div style="position:relative;">
                ${collageHTML}
                <button class="delete-board-btn" style="position:absolute; top:8px; right:8px; background:rgba(255,255,255,0.9); border:none; width:24px; height:24px; border-radius:12px; font-size:14px; cursor:pointer; color:#999; display:flex; align-items:center; justify-content:center; z-index:10; transition:all 0.2s;" title="Delete Wishlist">
                    &times;
                </button>
            </div>
            <div class="board-name">${board.name}</div>
            <div class="board-count">${board.items.length} item${board.items.length !== 1 ? 's' : ''}</div>
        `;

        const deleteBtn = card.querySelector('.delete-board-btn');
        deleteBtn.addEventListener('mouseenter', () => { deleteBtn.style.background = '#fff'; deleteBtn.style.color = '#d63031'; deleteBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)'; });
        deleteBtn.addEventListener('mouseleave', () => { deleteBtn.style.background = 'rgba(255,255,255,0.9)'; deleteBtn.style.color = '#999'; deleteBtn.style.boxShadow = 'none'; });

        card.addEventListener('click', (e) => {
            if (e.target.closest('.delete-board-btn')) return;
            container.innerHTML = '';
            renderBoardDetail(container, board, user, false);
        });

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete your "${board.name}" wishlist? This action cannot be undone.`)) {
                card.style.opacity = '0.5';
                deleteBtn.style.pointerEvents = 'none';
                try {
                    const boardRef = db.collection('users').doc(user.uid).collection('wishlists').doc(board.name);
                    const itemsSnap = await boardRef.collection('items').get();
                    const batch = db.batch();
                    itemsSnap.forEach(doc => { batch.delete(doc.ref); });
                    batch.delete(boardRef);
                    await batch.commit();
                    loadCloudDashboard(user);
                } catch (err) {
                    console.error("Error deleting wishlist:", err);
                    alert("Failed to delete wishlist. Please try again.");
                    card.style.opacity = '1';
                    deleteBtn.style.pointerEvents = 'auto';
                }
            }
        });

        grid.appendChild(card);
    }

    // Live search filtering
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        grid.querySelectorAll('.board-card').forEach(card => {
            card.style.display = card.dataset.name.includes(query) ? '' : 'none';
        });
    });

    container.appendChild(grid);
}


    const grid = document.createElement('div');

function renderBoardDetail(container, board, user, isShared) {
    // Header with back button
    const header = document.createElement('div');
    header.className = 'board-detail-header';
    header.innerHTML = `
        <button class="back-btn" id="back-to-boards">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            back
        </button>
        <span class="board-detail-title" style="display:flex; align-items:center; gap:8px;">
            ${board.name}
            <button class="share-btn" style="background:none; border:none; cursor:pointer; color:#999; padding:0; display:flex; align-items:center; gap: 4px; transition: color 0.2s;" title="Copy Share Link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                <span class="copied-text" style="font-size: 10px; font-weight: normal; opacity: 0; transition: opacity 0.2s;">copied!</span>
            </button>
        </span>
        <span class="board-detail-count">${board.items.length} item${board.items.length !== 1 ? 's' : ''}</span>
    `;
    container.appendChild(header);

    // Back button handler
    header.querySelector('#back-to-boards').addEventListener('click', () => {
        if (isShared) {
            window.location.href = 'dashboard.html';
        } else {
            loadCloudDashboard(user);
        }
    });

    // Share link handler
    const shareBtn = header.querySelector('.share-btn');
    if (shareBtn && !isShared && user) {
        shareBtn.addEventListener('click', () => {
            const shareUrl = `https://shop-bagged.com/dashboard.html?u=${user.uid}&b=${encodeURIComponent(board.name)}`;
            const copiedText = shareBtn.querySelector('.copied-text');
            navigator.clipboard.writeText(shareUrl).then(() => {
                shareBtn.style.color = '#27ae60';
                copiedText.style.opacity = '1';
                setTimeout(() => {
                    shareBtn.style.color = '#999';
                    copiedText.style.opacity = '0';
                }, 2000);
            }).catch(() => {
                prompt("Copy this link:", shareUrl);
            });
        });
    } else if (shareBtn) {
        shareBtn.style.display = 'none';
    }

    // Product grid
    const grid = document.createElement('div');
    grid.className = 'bags-grid';

    board.items.forEach(item => {
        const card = createCard(item, board.name, item.id, isShared, user);
        grid.appendChild(card);
    });

    container.appendChild(grid);

    // Setup cart toggle
    setupCartWidget();
}

function setupCartWidget() {
    const cartToggle = document.getElementById('cart-toggle');
    const cartDropdown = document.getElementById('cart-dropdown');
    if (cartToggle && cartDropdown) {
        cartToggle.onclick = () => {
            cartDropdown.style.display = cartDropdown.style.display === 'none' ? 'block' : 'none';
        };
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#cart-widget')) {
                cartDropdown.style.display = 'none';
            }
        });
    }

    const checkoutAllBtn = document.getElementById('checkout-all-btn');
    if (checkoutAllBtn) {
        checkoutAllBtn.onclick = () => {
            if (checkoutCart.length === 0) return;
            openUnifiedCheckoutModal();
        };
    }
}

// ========== UNIFIED CHECKOUT MODAL LOGIC ==========
let currentCheckoutStep = 1;

const unifiedCheckoutModal = document.getElementById('unified-checkout-modal');
const closeUnifiedCheckoutBtn = document.getElementById('close-unified-checkout');
const checkoutNextStepBtn = document.getElementById('checkout-next-step-btn');
const checkoutBackStepBtn = document.getElementById('checkout-back-step-btn');
const unifiedCartSummaryList = document.getElementById('unified-cart-summary-list');
const checkoutErrorMsg = document.getElementById('checkout-error-msg');
const sameBillingCheckbox = document.getElementById('same-billing-checkbox');
const billingAddressSection = document.getElementById('billing-address-section');
const successModal = document.getElementById('unified-order-success-modal');
const closeSuccessModalBtn = document.getElementById('close-success-modal-btn');
const successOrderIdEl = document.getElementById('success-order-id');

// Card number auto-formatting (adds space every 4 digits)
const cardNumberInput = document.getElementById('card-number');
if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        val = val.replace(/(.{4})/g, '$1 ').trim();
        e.target.value = val;
    });
}

// Expiry date auto-formatting (MM/YY)
const cardExpiryInput = document.getElementById('card-expiry');
if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length >= 2) {
            val = val.substring(0, 2) + '/' + val.substring(2, 4);
        }
        e.target.value = val;
    });
}

// Same Billing Checkbox listener
if (sameBillingCheckbox && billingAddressSection) {
    sameBillingCheckbox.addEventListener('change', () => {
        billingAddressSection.style.display = sameBillingCheckbox.checked ? 'none' : 'block';
    });
}

function openUnifiedCheckoutModal() {
    if (!unifiedCheckoutModal || checkoutCart.length === 0) return;

    // Ensure quantity property exists on cart items
    checkoutCart.forEach(item => {
        if (!item.quantity || item.quantity < 1) item.quantity = 1;
    });

    const user = auth.currentUser;
    if (user && user.email) {
        const emailInput = document.getElementById('checkout-email');
        if (emailInput && !emailInput.value) emailInput.value = user.email;
    }

    goToCheckoutStep(1);
    renderCheckoutCartItems();

    unifiedCheckoutModal.style.display = 'flex';
    setTimeout(() => { unifiedCheckoutModal.style.opacity = '1'; }, 10);
}

function closeUnifiedCheckoutModal() {
    if (!unifiedCheckoutModal) return;
    unifiedCheckoutModal.style.opacity = '0';
    setTimeout(() => { unifiedCheckoutModal.style.display = 'none'; }, 300);
}

if (closeUnifiedCheckoutBtn) {
    closeUnifiedCheckoutBtn.onclick = closeUnifiedCheckoutModal;
}

function renderCheckoutCartItems() {
    if (!unifiedCartSummaryList) return;

    if (checkoutCart.length === 0) {
        unifiedCartSummaryList.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 20px;">Your checkout cart is empty.</div>`;
        updateCheckoutTotals(0);
        return;
    }

    let subtotalNumeric = 0;

    unifiedCartSummaryList.innerHTML = checkoutCart.map((item, index) => {
        const numericMatch = (item.price || '').match(/[\d,.]+/);
        let unitPrice = 0;
        if (numericMatch) {
            unitPrice = parseFloat(numericMatch[0].replace(/,/g, ''));
        }
        const itemQty = item.quantity || 1;
        const lineTotal = unitPrice * itemQty;
        subtotalNumeric += lineTotal;

        const sizeOptionsHTML = (item.sizes && Array.isArray(item.sizes) && item.sizes.length > 0)
            ? `<select class="checkout-item-size-select" data-index="${index}" style="padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; background: #fff;">
                <option value="">Size</option>
                ${item.sizes.map(s => `<option value="${s}" ${s === item.size ? 'selected' : ''}>${s}</option>`).join('')}
              </select>`
            : (item.size ? `<span style="font-size: 10px; color: #666; background: #fff; padding: 2px 6px; border: 1px solid #eee; border-radius: 3px;">Size: ${item.size}</span>` : '');

        const colorOptionsHTML = (item.colors && Array.isArray(item.colors) && item.colors.length > 0)
            ? `<select class="checkout-item-color-select" data-index="${index}" style="padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 10px; background: #fff;">
                <option value="">Colour</option>
                ${item.colors.map(c => `<option value="${c}" ${c === item.color ? 'selected' : ''}>${c}</option>`).join('')}
              </select>`
            : (item.color ? `<span style="font-size: 10px; color: #666; background: #fff; padding: 2px 6px; border: 1px solid #eee; border-radius: 3px;">Col: ${item.color}</span>` : '');

        return `
            <div style="position: relative; display: flex; gap: 14px; align-items: center; padding: 14px; border: 1px solid #eee; border-radius: 10px; background: #fafafa;">
                <button class="checkout-item-remove-btn" data-index="${index}" title="Remove item" style="position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 16px; cursor: pointer; color: #aaa; padding: 0 4px; line-height: 1;">&times;</button>
                <img src="${item.image}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; background: #fff;">
                <div style="flex: 1; min-width: 0; padding-right: 14px;">
                    <div style="font-size: 10px; color: #888; font-weight: 700; text-transform: lowercase; letter-spacing: 0.5px;">${item.brand || ''}</div>
                    <div style="font-size: 12px; font-weight: 600; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #111; margin-bottom: 6px;">${item.name || ''}</div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px;">
                        ${sizeOptionsHTML}
                        ${colorOptionsHTML}
                    </div>

                    <!-- Quantity Control -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 10px; color: #777; font-weight: 600;">QTY:</span>
                        <div style="display: inline-flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; background: #fff; overflow: hidden;">
                            <button class="qty-btn qty-minus" data-index="${index}" style="background: none; border: none; width: 22px; height: 22px; cursor: pointer; font-weight: bold; color: #555;">-</button>
                            <span style="padding: 0 8px; font-size: 11px; font-weight: 700; color: #000;">${itemQty}</span>
                            <button class="qty-btn qty-plus" data-index="${index}" style="background: none; border: none; width: 22px; height: 22px; cursor: pointer; font-weight: bold; color: #555;">+</button>
                        </div>
                    </div>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #000; text-align: right;">
                    ${unitPrice > 0 ? `£${lineTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : item.price}
                </div>
            </div>
        `;
    }).join('');

    updateCheckoutTotals(subtotalNumeric);
    attachCheckoutCartEventListeners();
}

function updateCheckoutTotals(subtotalNumeric) {
    const formattedSubtotal = subtotalNumeric > 0 ? `£${subtotalNumeric.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : (checkoutCart[0]?.price || '£0.00');
    
    ['checkout-subtotal-step1', 'checkout-total-step1', 'checkout-subtotal-step3', 'checkout-total-step3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = formattedSubtotal;
    });

    const step1Tab = document.getElementById('step-tab-1');
    if (step1Tab) step1Tab.textContent = `1. Items (${checkoutCart.length})`;
}

function attachCheckoutCartEventListeners() {
    if (!unifiedCartSummaryList) return;

    // Quantity Plus
    unifiedCartSummaryList.querySelectorAll('.qty-plus').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.index);
            if (checkoutCart[idx]) {
                checkoutCart[idx].quantity = (checkoutCart[idx].quantity || 1) + 1;
                renderCheckoutCartItems();
            }
        };
    });

    // Quantity Minus
    unifiedCartSummaryList.querySelectorAll('.qty-minus').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.index);
            if (checkoutCart[idx] && checkoutCart[idx].quantity > 1) {
                checkoutCart[idx].quantity -= 1;
                renderCheckoutCartItems();
            }
        };
    });

    // Remove Item
    unifiedCartSummaryList.querySelectorAll('.checkout-item-remove-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.index);
            if (idx >= 0 && idx < checkoutCart.length) {
                checkoutCart.splice(idx, 1);
                renderCheckoutCartItems();
                updateCartDropdown();
            }
        };
    });

    // Size Selection Change
    unifiedCartSummaryList.querySelectorAll('.checkout-item-size-select').forEach(sel => {
        sel.onchange = () => {
            const idx = parseInt(sel.dataset.index);
            if (checkoutCart[idx]) {
                checkoutCart[idx].size = sel.value;
            }
        };
    });

    // Color Selection Change
    unifiedCartSummaryList.querySelectorAll('.checkout-item-color-select').forEach(sel => {
        sel.onchange = () => {
            const idx = parseInt(sel.dataset.index);
            if (checkoutCart[idx]) {
                checkoutCart[idx].color = sel.value;
            }
        };
    });
}

function goToCheckoutStep(step) {
    currentCheckoutStep = step;
    if (checkoutErrorMsg) checkoutErrorMsg.textContent = '';

    const step1Content = document.getElementById('checkout-step-1-content');
    const step2Content = document.getElementById('checkout-step-2-content');
    const step3Content = document.getElementById('checkout-step-3-content');
    const tab1 = document.getElementById('step-tab-1');
    const tab2 = document.getElementById('step-tab-2');
    const tab3 = document.getElementById('step-tab-3');

    if (step1Content) step1Content.style.display = step === 1 ? 'block' : 'none';
    if (step2Content) step2Content.style.display = step === 2 ? 'block' : 'none';
    if (step3Content) step3Content.style.display = step === 3 ? 'block' : 'none';

    [tab1, tab2, tab3].forEach((tab, index) => {
        if (!tab) return;
        const tabStep = index + 1;
        if (tabStep === step) {
            tab.style.color = '#000';
            tab.style.borderBottom = '2px solid #000';
            tab.style.marginBottom = '-2px';
        } else if (tabStep < step) {
            tab.style.color = '#27ae60';
            tab.style.borderBottom = 'none';
        } else {
            tab.style.color = '#aaa';
            tab.style.borderBottom = 'none';
        }
    });

    if (checkoutBackStepBtn) checkoutBackStepBtn.style.display = step > 1 ? 'block' : 'none';

    if (checkoutNextStepBtn) {
        if (step === 1) {
            checkoutNextStepBtn.textContent = 'PROCEED TO SHIPPING →';
            checkoutNextStepBtn.style.background = '#000';
        } else if (step === 2) {
            checkoutNextStepBtn.textContent = 'PROCEED TO PAYMENT →';
            checkoutNextStepBtn.style.background = '#000';
        } else if (step === 3) {
            const totalText = document.getElementById('checkout-total-step3')?.textContent || '';
            checkoutNextStepBtn.textContent = `PAY & PLACE UNIFIED ORDER (${totalText})`;
            checkoutNextStepBtn.style.background = '#000';
        }
    }
}

// Stepper Tab Click Listeners
['step-tab-1', 'step-tab-2', 'step-tab-3'].forEach((id, idx) => {
    const tab = document.getElementById(id);
    if (tab) {
        tab.onclick = () => {
            const targetStep = idx + 1;
            if (targetStep < currentCheckoutStep) {
                goToCheckoutStep(targetStep);
            } else if (targetStep > currentCheckoutStep) {
                if (validateStep(currentCheckoutStep)) {
                    goToCheckoutStep(targetStep);
                }
            }
        };
    }
});

if (checkoutBackStepBtn) {
    checkoutBackStepBtn.onclick = () => {
        if (currentCheckoutStep > 1) {
            goToCheckoutStep(currentCheckoutStep - 1);
        }
    };
}

if (checkoutNextStepBtn) {
    checkoutNextStepBtn.onclick = () => {
        if (!validateStep(currentCheckoutStep)) return;

        if (currentCheckoutStep < 3) {
            goToCheckoutStep(currentCheckoutStep + 1);
        } else if (currentCheckoutStep === 3) {
            processFinalUnifiedOrder();
        }
    };
}

function validateStep(step) {
    if (checkoutErrorMsg) checkoutErrorMsg.textContent = '';

    if (step === 1) {
        if (checkoutCart.length === 0) {
            if (checkoutErrorMsg) checkoutErrorMsg.textContent = 'Your cart is empty. Please add items before checking out.';
            return false;
        }
        return true;
    }

    if (step === 2) {
        const firstName = (document.getElementById('checkout-first-name')?.value || '').trim();
        const lastName = (document.getElementById('checkout-last-name')?.value || '').trim();
        const address = (document.getElementById('checkout-address')?.value || '').trim();
        const city = (document.getElementById('checkout-city')?.value || '').trim();
        const postcode = (document.getElementById('checkout-postcode')?.value || '').trim();
        const email = (document.getElementById('checkout-email')?.value || '').trim();

        if (!firstName || !lastName || !address || !city || !postcode || !email) {
            if (checkoutErrorMsg) checkoutErrorMsg.textContent = 'Please fill out all required shipping fields.';
            return false;
        }

        if (sameBillingCheckbox && !sameBillingCheckbox.checked) {
            const bFirst = (document.getElementById('billing-first-name')?.value || '').trim();
            const bLast = (document.getElementById('billing-last-name')?.value || '').trim();
            const bAddr = (document.getElementById('billing-address')?.value || '').trim();
            const bCity = (document.getElementById('billing-city')?.value || '').trim();
            const bPost = (document.getElementById('billing-postcode')?.value || '').trim();

            if (!bFirst || !bLast || !bAddr || !bCity || !bPost) {
                if (checkoutErrorMsg) checkoutErrorMsg.textContent = 'Please fill out all required billing address fields.';
                return false;
            }
        }
        return true;
    }

    if (step === 3) {
        const cardName = (document.getElementById('card-name')?.value || '').trim();
        const cardNumber = (document.getElementById('card-number')?.value || '').replace(/\s/g, '');
        const cardExpiry = (document.getElementById('card-expiry')?.value || '').trim();
        const cardCvc = (document.getElementById('card-cvc')?.value || '').trim();

        if (!cardName || cardNumber.length < 15 || !cardExpiry.includes('/') || cardCvc.length < 3) {
            if (checkoutErrorMsg) checkoutErrorMsg.textContent = 'Please enter valid credit card payment details.';
            return false;
        }
        return true;
    }

    return true;
}

async function processFinalUnifiedOrder() {
    if (!checkoutNextStepBtn) return;
    checkoutNextStepBtn.disabled = true;
    checkoutNextStepBtn.textContent = 'PROCESSING PAYMENT...';

    try {
        const firstName = document.getElementById('checkout-first-name').value.trim();
        const lastName = document.getElementById('checkout-last-name').value.trim();
        const address = document.getElementById('checkout-address').value.trim();
        const city = document.getElementById('checkout-city').value.trim();
        const postcode = document.getElementById('checkout-postcode').value.trim();
        const email = document.getElementById('checkout-email').value.trim();

        const isSameBilling = sameBillingCheckbox ? sameBillingCheckbox.checked : true;
        let billingDetails = {};
        if (isSameBilling) {
            billingDetails = { firstName, lastName, address, city, postcode };
        } else {
            billingDetails = {
                firstName: document.getElementById('billing-first-name').value.trim(),
                lastName: document.getElementById('billing-last-name').value.trim(),
                address: document.getElementById('billing-address').value.trim(),
                city: document.getElementById('billing-city').value.trim(),
                postcode: document.getElementById('billing-postcode').value.trim()
            };
        }

        const user = auth.currentUser;
        const orderRefId = 'BG-' + Math.floor(100000 + Math.random() * 900000);
        const totalText = document.getElementById('checkout-total-step3')?.textContent || '£0.00';

        const orderData = {
            orderId: orderRefId,
            items: checkoutCart,
            shippingAddress: { firstName, lastName, address, city, postcode, email },
            billingAddress: billingDetails,
            paymentStatus: 'paid',
            status: 'pending_fulfillment',
            totalAmount: totalText,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (user) {
            await db.collection('users').doc(user.uid).collection('orders').doc(orderRefId).set(orderData);
        }

        closeUnifiedCheckoutModal();

        checkoutCart = [];
        updateCartDropdown();

        if (successOrderIdEl) successOrderIdEl.textContent = '#' + orderRefId;
        if (successModal) {
            successModal.style.display = 'flex';
            setTimeout(() => { successModal.style.opacity = '1'; }, 10);
        }
    } catch (e) {
        console.error("Error creating order:", e);
        if (checkoutErrorMsg) checkoutErrorMsg.textContent = 'Payment failed. Please try again.';
    } finally {
        checkoutNextStepBtn.disabled = false;
        goToCheckoutStep(3);
    }
}

function createCard(item, wishlistId, itemId, isSharedView = false, user) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.textTransform = "capitalize";
    const productUrl = item.url || '#';
    const isSoldOut = Boolean(item.soldOut || item.isSoldOut || item.status === 'sold_out' || item.outOfStock || item.inStock === false);

    // Build size element
    const currentSize = item.size || item.activeSize || '';
    const currentSizes = (item.sizes && Array.isArray(item.sizes) && item.sizes.length > 0) 
        ? item.sizes 
        : (currentSize ? [currentSize] : []);

    let sizeElement = '';
    if (isSharedView) {
        sizeElement = currentSize ? `<span style="background: #fafafa; border: 1px solid #eee; padding: 3px 6px; border-radius: 4px; font-size: 10px; color: #666;">Size: ${currentSize}</span>` : '';
    } else {
        if (currentSizes.length > 0) {
            let options = ['<option value="">Size</option>'];
            currentSizes.forEach(s => {
                const selected = (currentSize === s) ? 'selected' : '';
                options.push(`<option value="${s}" ${selected}>${s}</option>`);
            });
            sizeElement = `
                <div class="size-edit-container" style="flex: 1; position: relative;">
                    <select class="dashboard-size-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none; background: #fff; box-sizing: border-box;">
                        ${options.join('')}
                    </select>
                </div>
            `;
        }
    }

    // Build color element (same look and function as size)
    const currentColor = item.color || item.activeColor || '';
    const currentColors = (item.colors && Array.isArray(item.colors) && item.colors.length > 0) 
        ? item.colors 
        : (currentColor ? [currentColor] : []);

    let colorElement = '';
    if (isSharedView) {
        colorElement = currentColor ? `<span style="background: #fafafa; border: 1px solid #eee; padding: 3px 6px; border-radius: 4px; font-size: 10px; color: #666;">Col: ${currentColor}</span>` : '';
    } else {
        if (currentColors.length > 0) {
            let options = ['<option value="">Colour</option>'];
            currentColors.forEach(c => {
                const selected = (currentColor === c) ? 'selected' : '';
                options.push(`<option value="${c}" ${selected}>${c}</option>`);
            });
            colorElement = `
                <div class="color-edit-container" style="flex: 1; position: relative;">
                    <select class="dashboard-color-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none; background: #fff; box-sizing: border-box;">
                        ${options.join('')}
                    </select>
                </div>
            `;
        }
    }

    const optionsHTML = (sizeElement || colorElement) ? `
        <div class="options-row" style="display: flex; gap: 8px; margin: 4px 0 10px 0; align-items: center; justify-content: flex-start;">
            ${sizeElement}
            ${colorElement}
        </div>
    ` : '';

    card.innerHTML = `
        <div class="image-container" style="position: relative; width: 100%; height: 280px; margin-bottom: 15px; overflow: hidden; border-radius: 12px; background: #f9f9f9;">
            <a href="${productUrl}" target="_blank" style="display: block; width: 100%; height: 100%;">
                <img src="${item.image}" style="width:100%; height:100%; object-fit:cover; cursor: pointer; transition: filter 0.3s; ${isSoldOut ? 'filter: grayscale(40%); opacity: 0.85;' : ''}">
            </a>
            ${isSoldOut ? `
                <div class="sold-out-badge" style="position: absolute; top: 12px; left: 12px; background: rgba(0, 0, 0, 0.85); color: #ffffff; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 5px 10px; border-radius: 4px; z-index: 2; backdrop-filter: blur(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                    SOLD OUT
                </div>
            ` : ''}
        </div>
        <div class="brand" style="font-size:10px; color:#888;">${(item.brand || '').toLowerCase()}</div>
        <div class="name" style="font-weight:bold; margin: 5px 0;">${item.name}</div>
        
        <div class="price-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div class="price" style="${isSoldOut ? 'text-decoration: line-through; opacity: 0.55; margin-bottom: 0;' : ''}">${item.price}</div>
            ${isSoldOut ? `
                <span class="sold-out-tag" style="font-size: 9px; font-weight: 700; color: #d32f2f; background: #ffebee; padding: 3px 8px; border-radius: 4px; letter-spacing: 1px; text-transform: uppercase;">
                    Sold Out
                </span>
            ` : ''}
        </div>

        ${optionsHTML}

        <div class="cta-row" style="display: flex; gap: 8px; margin-top: auto;">
            ${!isSharedView ? '<button class="remove-btn" style="background: #fff; color: #000; border: 1px solid #ddd; border-radius: 4px; height: 38px; cursor: pointer; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; flex: 1; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Remove</button>' : ''}
            ${isSoldOut ? `
                <button class="add-checkout-btn disabled" disabled style="background: #e5e5e5; color: #888; border: 1px solid #e5e5e5; border-radius: 4px; height: 38px; cursor: not-allowed; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; flex: 1; display: flex; align-items: center; justify-content: center; text-align: center;">Sold Out</button>
            ` : `
                <button class="add-checkout-btn" data-url="${productUrl}" data-id="${itemId}" data-name="${item.name}" data-brand="${item.brand || ''}" data-price="${item.price}" data-image="${item.image}" data-size="${item.size || ''}" data-color="${item.color || ''}" style="background: #000; color: #fff; border: 1px solid #000; border-radius: 4px; height: 38px; cursor: pointer; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; flex: 1; line-height: 1.2; display: flex; align-items: center; justify-content: center; text-align: center; transition: background 0.2s;">Add to Checkout</button>
            `}
        </div>
    `;

    // Hook up update function
    const updateItem = async (fields) => {
        try {
            await db.collection('users').doc(user.uid).collection('wishlists').doc(wishlistId).collection('items').doc(itemId).update(fields);
            
            // Also update the checkout button attributes so if added to checkout it gets the new value
            const checkoutBtn = card.querySelector('.add-checkout-btn');
            if (checkoutBtn) {
                if (fields.hasOwnProperty('size')) checkoutBtn.dataset.size = fields.size;
                if (fields.hasOwnProperty('color')) checkoutBtn.dataset.color = fields.color;
            }
        } catch (e) {
            console.error("Error updating item options:", e);
        }
    };

    if (!isSharedView) {
        // Size listener
        const sizeSelect = card.querySelector('.dashboard-size-select');
        if (sizeSelect) {
            sizeSelect.addEventListener('change', () => {
                sizeSelect.style.borderColor = '#ddd';
                sizeSelect.style.boxShadow = 'none';
                updateItem({ size: sizeSelect.value });
            });
        }

        // Color listener
        const colorSelect = card.querySelector('.dashboard-color-select');
        if (colorSelect) {
            colorSelect.addEventListener('change', () => {
                colorSelect.style.borderColor = '#ddd';
                colorSelect.style.boxShadow = 'none';
                updateItem({ color: colorSelect.value });
            });
        }

        const removeBtn = card.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('mouseenter', () => { removeBtn.style.background = '#fafafa'; removeBtn.style.borderColor = '#ccc'; });
            removeBtn.addEventListener('mouseleave', () => { removeBtn.style.background = '#fff'; removeBtn.style.borderColor = '#ddd'; });
            removeBtn.onclick = async () => {
                await db.collection('users').doc(user.uid).collection('wishlists').doc(wishlistId).collection('items').doc(itemId).delete();
                card.remove();
            };
        }
    }

    const checkoutBtn = card.querySelector('.add-checkout-btn:not(.disabled)');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('mouseenter', () => { 
            if (checkoutBtn.dataset.error !== 'true') checkoutBtn.style.background = '#222'; 
        });
        checkoutBtn.addEventListener('mouseleave', () => { 
            if (checkoutBtn.dataset.error !== 'true' && checkoutBtn.textContent !== 'Added!') checkoutBtn.style.background = '#000'; 
        });
        checkoutBtn.onclick = function () {
            const id = this.dataset.id;
            const existingIndex = checkoutCart.findIndex(cartItem => cartItem.id === id);

            if (existingIndex >= 0) {
                checkoutCart.splice(existingIndex, 1);
                this.textContent = 'Add to Checkout';
                this.style.background = '#000';
                this.dataset.error = 'false';
            } else {
                // Validate mandatory size selection if size dropdown exists
                const sizeSelect = card.querySelector('.dashboard-size-select');
                const selectedSize = sizeSelect ? sizeSelect.value : (this.dataset.size || item.size || '');

                if (sizeSelect && !selectedSize) {
                    sizeSelect.style.borderColor = '#d32f2f';
                    sizeSelect.style.boxShadow = '0 0 0 2px rgba(211, 47, 47, 0.25)';
                    sizeSelect.focus();

                    this.dataset.error = 'true';
                    this.textContent = 'Select Size First!';
                    this.style.background = '#d32f2f';

                    setTimeout(() => {
                        this.dataset.error = 'false';
                        if (this.textContent === 'Select Size First!') {
                            this.textContent = 'Add to Checkout';
                            this.style.background = '#000';
                        }
                    }, 2200);
                    return;
                }

                // Validate mandatory colour selection if colour dropdown exists
                const colorSelect = card.querySelector('.dashboard-color-select');
                const selectedColor = colorSelect ? colorSelect.value : (this.dataset.color || item.color || '');

                if (colorSelect && !selectedColor) {
                    colorSelect.style.borderColor = '#d32f2f';
                    colorSelect.style.boxShadow = '0 0 0 2px rgba(211, 47, 47, 0.25)';
                    colorSelect.focus();

                    this.dataset.error = 'true';
                    this.textContent = 'Select Colour First!';
                    this.style.background = '#d32f2f';

                    setTimeout(() => {
                        this.dataset.error = 'false';
                        if (this.textContent === 'Select Colour First!') {
                            this.textContent = 'Add to Checkout';
                            this.style.background = '#000';
                        }
                    }, 2200);
                    return;
                }

                checkoutCart.push({
                    id: id,
                    url: this.dataset.url,
                    name: this.dataset.name,
                    brand: this.dataset.brand,
                    price: this.dataset.price,
                    image: this.dataset.image,
                    size: selectedSize,
                    color: selectedColor
                });
                this.textContent = 'Added!';
                this.style.background = '#27ae60';
                this.dataset.error = 'false';
            }
            updateCartDropdown();
        };
    }

    return card;
}

// ========== SIDEBAR ACTIONS ==========
const createModal = document.getElementById('create-bag-modal');
const closeCreateModalBtn = document.getElementById('close-create-modal');
const submitCreateBtn = document.getElementById('submit-create-bag');
const bagModalInput = document.getElementById('bag-modal-input');

document.getElementById('nav-create-wishlist').addEventListener('click', (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    createModal.style.display = 'flex';
    setTimeout(() => { createModal.style.opacity = '1'; bagModalInput.focus(); }, 10);
});

function closeCreateModal() {
    createModal.style.opacity = '0';
    setTimeout(() => { 
        createModal.style.display = 'none'; 
        bagModalInput.value = '';
    }, 300);
}

closeCreateModalBtn.addEventListener('click', closeCreateModal);

submitCreateBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    const bagName = bagModalInput.value.trim();
    if (bagName) {
        const oldText = submitCreateBtn.innerText;
        submitCreateBtn.innerText = 'CREATING...';
        submitCreateBtn.disabled = true;
        try {
            await db.collection('users').doc(auth.currentUser.uid)
                .collection('wishlists').doc(bagName.toLowerCase()).set({
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            closeCreateModal();
            loadCloudDashboard(auth.currentUser);
        } catch (error) {
            console.error("Error creating bag:", error);
            alert("Failed to create bag. Please try again.");
        } finally {
            submitCreateBtn.innerText = oldText;
            submitCreateBtn.disabled = false;
        }
    }
});

bagModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitCreateBtn.click();
});

document.getElementById('sidebar-signout').addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().then(() => {
        // Smart redirect: if inside the Chrome Extension, go to landing.html
        // If on the live web, simply go back to the root domain.
        if (window.location.protocol.includes('chrome-extension')) {
            window.location.href = 'landing.html';
        } else {
            window.location.href = '/';
        }
    }).catch((error) => {
        console.error("Error signing out:", error);
    });
});

// ========== DISCOVER (AI RECOMMENDATIONS) ==========
const navHome = document.querySelector('.sidebar-nav a[href="dashboard.html"]'); 
const navDiscover = document.getElementById('nav-discover');
const bagsContainer = document.getElementById('bags-container');
const discoverContainer = document.getElementById('discover-container');

// Elements
const apiKeyInput = document.getElementById('discover-api-key');
const saveKeyBtn = document.getElementById('discover-save-key-btn');
const actionArea = document.getElementById('discover-action-area');
const generateBtn = document.getElementById('generate-discover-btn');
const loadingText = document.getElementById('discover-loading');
const resultsGrid = document.getElementById('discover-results-grid');

function switchTab(tab) {
    if (tab === 'home') {
        if(bagsContainer) bagsContainer.style.display = 'block';
        if(discoverContainer) discoverContainer.style.display = 'none';
        if(navHome) navHome.classList.add('active');
        if(navDiscover) navDiscover.classList.remove('active');
    } else {
        if(bagsContainer) bagsContainer.style.display = 'none';
        if(discoverContainer) discoverContainer.style.display = 'block';
        if(navHome) navHome.classList.remove('active');
        if(navDiscover) navDiscover.classList.add('active');
        checkApiSetup();
    }
}

if (navHome && navDiscover) {
    navHome.addEventListener('click', (e) => {
        e.preventDefault();
        window.history.replaceState(null, '', 'dashboard.html');
        switchTab('home');
    });

    navDiscover.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('discover');
    });
}

function checkApiSetup() {
    if(!apiKeyInput) return;
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        actionArea.style.display = 'block';
    }
}

if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            saveKeyBtn.innerText = 'Saved!';
            actionArea.style.display = 'block';
            setTimeout(() => saveKeyBtn.innerText = 'Save Key', 2000);
        }
    });
}

if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) return alert("Please save your API key first.");
        
        generateBtn.disabled = true;
        generateBtn.style.opacity = '0.5';
        loadingText.style.display = 'block';
        resultsGrid.innerHTML = '';
        
        try {
            await runAiDiscovery(apiKey, auth.currentUser.uid);
        } catch (e) {
            console.error("AI Error:", e);
            alert("Error generating recommendations: " + e.message);
        } finally {
            generateBtn.disabled = false;
            generateBtn.style.opacity = '1';
            loadingText.style.display = 'none';
        }
    });
}

async function runAiDiscovery(apiKey, uid) {
    const wishlistsSnapshot = await db.collection('users').doc(uid).collection('wishlists').get();
    
    let allItems = [];
    for (const doc of wishlistsSnapshot.docs) {
        const itemsSnap = await db.collection('users').doc(uid).collection('wishlists').doc(doc.id).collection('items').get();
        itemsSnap.forEach(itemDoc => {
            const data = itemDoc.data();
            if (data.name && data.brand) {
                allItems.push(`${data.brand} - ${data.name}`);
            }
        });
    }

    if (allItems.length === 0) {
        throw new Error("You don't have enough bagged items for the AI to analyze. Add some products to your wishlists first!");
    }

    const sampleItems = allItems.sort(() => 0.5 - Math.random()).slice(0, 30);
    
    const promptText = `
I am providing a list of luxury fashion items that a user has saved to their online wishlist.
Analyze their style, favored brands, and categories based on these items.

Your goal is to recommend exactly 24 SPECIFIC, new fashion items that this user would absolutely love to discover.
CRITICAL INSTRUCTIONS:
1. Do NOT strictly limit yourself to the exact brands provided in the user's list. Determine aesthetically adjacent brands that share a similar vibe (e.g. if they like The Row, explore Khaite, Toteme, or Jil Sander).
2. Provide a healthy mix of price points, ranging from contemporary luxury (e.g., Staud, Ganni) to high-end luxury, but ensure they fit the exact aesthetic profile of the user.
3. Ensure every recommendation is a specific, real product currently available in the market. Do not invent items.
4. For "url", provide the EXACT full product page URL on the brand's official e-commerce website (e.g. https://www.khaite.com/products/the-eda-long-sleeve-top). Use the brand's real URL structure. If you are unsure of the exact URL, leave "url" as an empty string.
5. For "domain", provide just the root domain of the brand website (e.g. khaite.com).

User's Saved Items:
${sampleItems.join('\n')}

Respond ONLY with a valid JSON array of 24 objects. Do not include markdown formatting or backticks.
Format:
[
  {
    "brand": "Brand Name",
    "name": "Specific Product Name",
    "price": "$XXX",
    "domain": "brandwebsite.com",
    "url": "https://www.brandwebsite.com/products/specific-product-name",
    "query": "Brand Name Specific Product Name"
  }
]
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
                temperature: 0.8
            }
        })
    });

    if (!response.ok) {
        const errJson = await response.json().catch(()=>({}));
        throw new Error(errJson.error?.message || "Failed to contact Gemini API. Please check your API key.");
    }

    const data = await response.json();
    let aiText = data.candidates[0].content.parts[0].text.trim();
    
    if (aiText.startsWith('```json')) aiText = aiText.substring(7);
    else if (aiText.startsWith('```')) aiText = aiText.substring(3);
    if (aiText.endsWith('```')) aiText = aiText.substring(0, aiText.length - 3);

    const recommendations = JSON.parse(aiText.trim());

    if (!Array.isArray(recommendations)) throw new Error("Invalid response format from AI.");
    
    recommendations.forEach(rec => {
        // If AI provided a direct URL, use it; otherwise fall back to a site-scoped Google search
        const directUrl = rec.url && rec.url.startsWith('http') ? rec.url : null;
        const fallbackUrl = rec.domain 
            ? `https://www.google.com/search?q=site:${rec.domain}+${encodeURIComponent(rec.name)}`
            : `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(rec.query || (rec.brand + ' ' + rec.name))}`;
        const productUrl = directUrl || fallbackUrl;
        const btnLabel = directUrl ? 'Shop Now' : 'Find Product';
        
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.background = '#fafafa';
        card.style.border = '1px solid #eee';
        card.style.borderRadius = '12px';
        card.style.padding = '24px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.boxSizing = 'border-box';
        
        card.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; margin-bottom: 24px;">
                ${rec.domain ? `<img src="https://logo.clearbit.com/${rec.domain}?size=80" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); background: white;">` : ''}
                <svg viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="1.5" style="width: 48px; height: 48px; margin-bottom: 20px; ${rec.domain ? 'display: none;' : ''}">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8l4 4-4 4M8 12h8"/>
                </svg>
                <div class="brand" style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:10px; font-weight:600;">${rec.brand}</div>
                <div class="name" style="font-size:16px; font-weight:600; line-height:1.4; color:#222; text-transform:capitalize;">${rec.name}</div>
                <div class="price" style="font-size:13px; font-weight:500; color:#888; margin-top:14px; background:#fff; padding:4px 10px; border-radius:4px; border:1px solid #eee;">Est. ${rec.price}</div>
            </div>
            <a href="${productUrl}" target="_blank" style="background: #000; color: #fff; text-decoration: none; padding: 14px; border-radius: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; display: block; text-align: center; transition: background 0.2s;">
                ${btnLabel}
            </a>
        `;
        
        const cardImg = card.querySelector('img');
        const cardSvg = card.querySelector('svg');
        if (cardImg && cardSvg) {
            cardImg.addEventListener('error', () => {
                cardImg.style.display = 'none';
                cardSvg.style.display = 'block';
            });
        }
        
        resultsGrid.appendChild(card);
    });
}


// Settings & Support Modal
const settingsBtn = document.getElementById('settings-support-btn');
const settingsOverlay = document.getElementById('settings-modal-overlay');
const settingsClose = document.getElementById('settings-modal-close');

if (settingsBtn && settingsOverlay) {
    settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        settingsOverlay.classList.add('active');
    });
    settingsClose.addEventListener('click', () => {
        settingsOverlay.classList.remove('active');
    });
    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) settingsOverlay.classList.remove('active');
    });
}

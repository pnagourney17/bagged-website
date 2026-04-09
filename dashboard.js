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
                    <div style="font-size: 12px; font-weight: bold;">${item.price}</div>
                </div>
                <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; cursor: pointer; color: #999; font-size: 16px; padding: 5px;">×</button>
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
            checkoutCart.forEach((item, index) => {
                setTimeout(() => window.open(item.url, '_blank'), index * 300);
            });
            checkoutAllBtn.textContent = 'Opening...';
            setTimeout(() => { checkoutAllBtn.textContent = 'Checkout All'; }, 2000);
        };
    }
}

function createCard(item, wishlistId, itemId, isSharedView = false, user) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.textTransform = "capitalize";
    const productUrl = item.url || '#';

    card.innerHTML = `
        <a href="${productUrl}" target="_blank" style="display: block;">
            <img src="${item.image}" style="width:100%; height:280px; object-fit:cover; cursor: pointer;">
        </a>
        <div class="brand" style="font-size:10px; color:#888;">${(item.brand || '').toLowerCase()}</div>
        <div class="name" style="font-weight:bold; margin: 5px 0;">${item.name}</div>
        <div class="price">${item.price}</div>
        <div class="cta-row" style="display: flex; gap: 8px; margin-top: 14px;">
            ${!isSharedView ? '<button class="remove-btn" style="background: #fff; color: #000; border: 1px solid #ddd; border-radius: 4px; height: 38px; cursor: pointer; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; flex: 1; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">Remove</button>' : ''}
            <button class="add-checkout-btn" data-url="${productUrl}" data-id="${itemId}" data-name="${item.name}" data-brand="${item.brand || ''}" data-price="${item.price}" data-image="${item.image}" style="background: #000; color: #fff; border: 1px solid #000; border-radius: 4px; height: 38px; cursor: pointer; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; flex: 1; line-height: 1.2; display: flex; align-items: center; justify-content: center; text-align: center; transition: background 0.2s;">Add to Checkout</button>
        </div>
    `;

    // Hover effects via JS (inline handlers violate Chrome Extension CSP)
    if (!isSharedView) {
        const removeBtn = card.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('mouseenter', () => { removeBtn.style.background = '#fafafa'; removeBtn.style.borderColor = '#ccc'; });
            removeBtn.addEventListener('mouseleave', () => { removeBtn.style.background = '#fff'; removeBtn.style.borderColor = '#ddd'; });
        }
    }
    const checkoutBtn = card.querySelector('.add-checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('mouseenter', () => { checkoutBtn.style.background = '#222'; });
        checkoutBtn.addEventListener('mouseleave', () => { checkoutBtn.style.background = '#000'; });
    }

    if (!isSharedView) {
        card.querySelector('.remove-btn').onclick = async () => {
            await db.collection('users').doc(user.uid).collection('wishlists').doc(wishlistId).collection('items').doc(itemId).delete();
            card.remove();
        };
    }

    card.querySelector('.add-checkout-btn').onclick = function () {
        const id = this.dataset.id;
        const existingIndex = checkoutCart.findIndex(item => item.id === id);

        if (existingIndex >= 0) {
            checkoutCart.splice(existingIndex, 1);
            this.textContent = 'Add to Checkout';
            this.style.background = '#000';
        } else {
            checkoutCart.push({
                id: id,
                url: this.dataset.url,
                name: this.dataset.name,
                brand: this.dataset.brand,
                price: this.dataset.price,
                image: this.dataset.image
            });
            this.textContent = 'Added!';
            this.style.background = '#27ae60';
        }
        updateCartDropdown();
    };

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

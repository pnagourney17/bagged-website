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

// Sign out from sidebar
document.getElementById('sidebar-signout').addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut();
});

// Auth state listener
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

// Check if viewing a shared bag
function getSharedBagId() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#bag-')) {
        return decodeURIComponent(hash.replace('#bag-', ''));
    }
    return null;
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

function renderBoardsOverview(container, boardsData, user) {
    const grid = document.createElement('div');
    grid.className = 'boards-grid';

    for (const board of boardsData) {
        const card = document.createElement('div');
        card.className = 'board-card';

        // Build collage (1 large left + 2 small right)
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
            ${collageHTML}
            <div class="board-name">${board.name}</div>
            <div class="board-count">${board.items.length} item${board.items.length !== 1 ? 's' : ''}</div>
        `;

        card.addEventListener('click', () => {
            container.innerHTML = '';
            renderBoardDetail(container, board, user, false);
        });

        grid.appendChild(card);
    }

    container.appendChild(grid);
}

function renderBoardDetail(container, board, user, isShared) {
    // Header with back button
    const header = document.createElement('div');
    header.className = 'board-detail-header';
    header.innerHTML = `
        <button class="back-btn" id="back-to-boards">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            back
        </button>
        <span class="board-detail-title">${board.name}</span>
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
        <div class="cta-row" style="display: flex; gap: 0; margin-top: 12px;">
            ${!isSharedView ? '<button class="remove-btn" style="background: #fff; color: #000; border: 1px solid #000; padding: 12px 0; cursor: pointer; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; flex: 1; text-align: center;">Remove</button>' : ''}
            <button class="add-checkout-btn" data-url="${productUrl}" data-id="${itemId}" data-name="${item.name}" data-brand="${item.brand || ''}" data-price="${item.price}" data-image="${item.image}" style="background: #000; color: #fff; border: 1px solid #000; padding: 12px 0; cursor: pointer; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; flex: 1; text-align: center;">Add to Checkout</button>
        </div>
    `;

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
document.getElementById('nav-create-wishlist').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const bagName = prompt("Enter a name for your new bag:");
    if (bagName && bagName.trim() !== '') {
        try {
            await db.collection('users').doc(auth.currentUser.uid)
                .collection('wishlists').doc(bagName.trim().toLowerCase()).set({
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            // Reload the dashboard view to show the new bag
            loadCloudDashboard(auth.currentUser);
        } catch (error) {
            console.error("Error creating bag:", error);
            alert("Failed to create bag. Please try again.");
        }
    }
});

document.getElementById('sidebar-signout').addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().then(() => {
        // Redirect to landing page
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Error signing out:", error);
    });
});

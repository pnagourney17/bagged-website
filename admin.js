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

// ========== AUTH GATE ==========
const adminSidebar = document.getElementById('admin-sidebar');
const adminMain = document.getElementById('admin-main');
const authGate = document.getElementById('admin-auth-gate');

document.getElementById('sidebar-signout').addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged((user) => {
    if (user) {
        adminSidebar.style.display = '';
        adminMain.style.display = '';
        authGate.style.display = 'none';
        document.getElementById('sidebar-email').innerText = user.email;
        loadAdminDashboard();
    } else {
        adminSidebar.style.display = 'none';
        adminMain.style.display = 'none';
        authGate.style.display = 'flex';
    }
});

document.getElementById('refresh-btn').addEventListener('click', () => loadAdminDashboard());

// ========== LOAD DASHBOARD DATA ==========
async function loadAdminDashboard() {
    try {
        const usersSnapshot = await db.collection('users').get();

        let totalUsers = 0;
        let totalItems = 0;
        let totalWishlists = 0;
        let activeToday = 0;
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const usersData = [];
        const allItems = [];
        const productCounts = {};

        for (const userDoc of usersSnapshot.docs) {
            totalUsers++;
            const userId = userDoc.id;
            let userEmail = userId; // fallback
            let userWishlists = 0;
            let userItems = 0;
            let lastActive = null;

            // Get user's wishlists
            const wishlistsSnap = await db.collection('users').doc(userId).collection('wishlists').get();

            for (const wishlistDoc of wishlistsSnap.docs) {
                userWishlists++;
                totalWishlists++;

                // Get items in this wishlist
                const itemsSnap = await db.collection('users').doc(userId).collection('wishlists').doc(wishlistDoc.id).collection('items').get();

                for (const itemDoc of itemsSnap.docs) {
                    const item = itemDoc.data();
                    userItems++;
                    totalItems++;

                    // Track product counts
                    const productKey = (item.name || 'unknown').toLowerCase().trim();
                    if (!productCounts[productKey]) {
                        productCounts[productKey] = {
                            name: item.name || 'Unknown',
                            brand: item.brand || '',
                            url: item.url || '#',
                            count: 0
                        };
                    }
                    productCounts[productKey].count++;

                    // Track timestamps for activity
                    const timestamp = item.timestamp ? item.timestamp.toDate() : null;
                    if (timestamp) {
                        if (!lastActive || timestamp > lastActive) {
                            lastActive = timestamp;
                        }
                        allItems.push({
                            name: item.name || 'Unknown',
                            brand: item.brand || '',
                            userId: userId,
                            timestamp: timestamp,
                            bag: wishlistDoc.id
                        });
                    }
                }
            }

            if (lastActive && lastActive > oneDayAgo) {
                activeToday++;
            }

            usersData.push({
                uid: userId,
                email: userEmail,
                wishlists: userWishlists,
                items: userItems,
                lastActive: lastActive
            });
        }

        // Update stat cards
        animateValue('stat-users', totalUsers);
        animateValue('stat-items', totalItems);
        animateValue('stat-wishlists', totalWishlists);
        animateValue('stat-active', activeToday);

        // Render users table
        renderUsersTable(usersData);

        // Render top products
        renderTopProducts(productCounts);

        // Render activity feed
        renderActivityFeed(allItems);

    } catch (error) {
        console.error('Admin dashboard error:', error);
    }
}

// ========== ANIMATE STAT VALUES ==========
function animateValue(elementId, endValue) {
    const el = document.getElementById(elementId);
    if (endValue === 0) {
        el.textContent = '0';
        return;
    }
    let current = 0;
    const step = Math.max(1, Math.floor(endValue / 20));
    const timer = setInterval(() => {
        current += step;
        if (current >= endValue) {
            current = endValue;
            clearInterval(timer);
        }
        el.textContent = current.toLocaleString();
    }, 30);
}

// ========== RENDER USERS TABLE ==========
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');

    // Sort by last active (most recent first)
    users.sort((a, b) => {
        if (!a.lastActive && !b.lastActive) return 0;
        if (!a.lastActive) return 1;
        if (!b.lastActive) return -1;
        return b.lastActive - a.lastActive;
    });

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="color: #444; padding: 20px;">no users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td class="email-cell">${escapeHtml(user.email)}</td>
            <td class="uid-cell">${user.uid.substring(0, 16)}...</td>
            <td><span class="badge">${user.wishlists}</span></td>
            <td><span class="badge">${user.items}</span></td>
            <td style="color: #555; font-size: 12px;">${user.lastActive ? timeAgo(user.lastActive) : 'no activity'}</td>
        </tr>
    `).join('');
}

// ========== RENDER TOP PRODUCTS ==========
function renderTopProducts(productCounts) {
    const container = document.getElementById('top-products');
    const sorted = Object.values(productCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = '<div style="color: #444; font-size: 13px; padding: 16px 0;">no products saved yet</div>';
        return;
    }

    container.innerHTML = sorted.map((product, i) => `
        <div class="product-row">
            <div class="product-rank">${i + 1}</div>
            <div class="product-info">
                <div class="product-title">${escapeHtml(product.name)}</div>
                <div class="product-brand">${escapeHtml(product.brand)}</div>
            </div>
            <div class="product-count">${product.count}x</div>
        </div>
    `).join('');
}

// ========== RENDER ACTIVITY FEED ==========
function renderActivityFeed(items) {
    const container = document.getElementById('activity-feed');

    // Sort by most recent first
    items.sort((a, b) => b.timestamp - a.timestamp);
    const recent = items.slice(0, 15);

    if (recent.length === 0) {
        container.innerHTML = '<div style="color: #444; font-size: 13px; padding: 16px 0;">no recent activity</div>';
        return;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    container.innerHTML = recent.map(item => {
        const isRecent = item.timestamp > oneDayAgo;
        return `
            <div class="activity-item">
                <div class="activity-dot ${isRecent ? 'recent' : ''}"></div>
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>${escapeHtml(truncate(item.name, 40))}</strong>
                        saved to <strong>${escapeHtml(item.bag)}</strong>
                    </div>
                    <div class="activity-time">${timeAgo(item.timestamp)} &middot; ${item.userId.substring(0, 8)}...</div>
                </div>
            </div>
        `;
    }).join('');
}

// ========== HELPERS ==========
function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA1BJ5_ItJr_S9bExIIz_oaeg-HYDMc7LY",
    authDomain: "bagged-dc0f7.firebaseapp.com",
    projectId: "bagged-dc0f7",
    storageBucket: "bagged-dc0f7.firebasestorage.app",
    messagingSenderId: "103392647585",
    appId: "1:103392647585:web:edd49907154bd481a193e0"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// ========== AUTH STATE ==========
auth.onAuthStateChanged((user) => {
    // If user is already logged in and visits landing page, redirect to dashboard
    // unless they clicked the 'about' button which passes ?view=about
    if (user && !window.location.search.includes('view=about')) {
        window.location.href = 'dashboard.html';
    } else if (user) {
        // Update nav bar so they can navigate back to Dashboard
        const navCtas = document.querySelector('.nav-ctas');
        if (navCtas) navCtas.innerHTML = '<a href="dashboard.html" class="btn-solid-nav">Dashboard</a>';
        
        // Update bottom CTA button
        const bottomBtn = document.querySelector('.bottom-cta .btn-solid-large');
        if (bottomBtn) {
            bottomBtn.href = "dashboard.html";
            bottomBtn.classList.remove('open-auth-btn');
            bottomBtn.innerText = 'GO TO DASHBOARD';
        }
    }
});

// ========== UI LOGIC ==========
let authMode = 'login'; // 'login' or 'signup'

const authModalOverlay = document.getElementById('auth-modal-overlay');
const closeModalBtn = document.getElementById('close-modal');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');
const authError = document.getElementById('auth-error');
const authConfirmWrapper = document.getElementById('auth-confirm-wrapper');
const authNameWrapper = document.getElementById('auth-name-wrapper');
const authFirstName = document.getElementById('auth-first-name');
const authLastName = document.getElementById('auth-last-name');
const authConfirmInput = document.getElementById('auth-confirm-password');
const togglePasswordBtn = document.getElementById('toggle-auth-password');
const toggleConfirmBtn = document.getElementById('toggle-auth-confirm');

function openModal(mode) {
    authMode = mode;
    updateModalUI();
    authModalOverlay.classList.add('active');
    authError.innerText = '';
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    authFirstName.value = '';
    authLastName.value = '';
    authConfirmInput.value = '';
    
    // Reset toggles
    document.getElementById('auth-password').type = 'password';
    authConfirmInput.type = 'password';
    togglePasswordBtn.innerText = 'show';
    togglePasswordBtn.classList.remove('active');
    toggleConfirmBtn.innerText = 'show';
    toggleConfirmBtn.classList.remove('active');
}

function closeModal() {
    authModalOverlay.classList.remove('active');
}

function updateModalUI() {
    if (authMode === 'login') {
        authTitle.innerText = 'SIGN IN';
        authSubmitBtn.innerText = 'CONTINUE';
        authSwitchText.innerText = 'New to Bagged?';
        authSwitchLink.innerText = 'Create an account';
        authConfirmWrapper.classList.remove('show');
        authNameWrapper.classList.remove('show');
        authConfirmInput.removeAttribute('required');
        authFirstName.removeAttribute('required');
        authLastName.removeAttribute('required');
    } else {
        authTitle.innerText = 'CREATE ACCOUNT';
        authSubmitBtn.innerText = 'SIGN UP';
        authSwitchText.innerText = 'Already have an account?';
        authSwitchLink.innerText = 'Sign in';
        authConfirmWrapper.classList.add('show');
        authNameWrapper.classList.add('show');
        authConfirmInput.setAttribute('required', 'true');
        authFirstName.setAttribute('required', 'true');
        authLastName.setAttribute('required', 'true');
    }
}

// Bind open buttons
document.querySelectorAll('.open-auth-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(btn.dataset.mode);
    });
});

// Close modal handlers
closeModalBtn.addEventListener('click', closeModal);
authModalOverlay.addEventListener('click', (e) => {
    if (e.target === authModalOverlay) closeModal();
});

// Switch mode handlers
authSwitchLink.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'signup' : 'login';
    updateModalUI();
    authError.innerText = '';
});

function friendlyError(code) {
    if (code === 'auth/email-already-in-use') return 'You already have an account, <a href="#" id="error-login-link" style="text-decoration: underline; font-weight: 600; color: inherit;">log in here</a>';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
    if (code === 'auth/wrong-password') return 'Incorrect password.';
    if (code === 'auth/user-not-found') return 'No account found with this email.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later.';
    return 'Error: ' + (code || 'Unknown') + ' - Please try again.';
}

// Password Toggle Handlers
function handlePasswordToggle(btn, input) {
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerText = 'hide';
        btn.classList.add('active');
    } else {
        input.type = 'password';
        btn.innerText = 'show';
        btn.classList.remove('active');
    }
}

togglePasswordBtn.addEventListener('click', () => handlePasswordToggle(togglePasswordBtn, document.getElementById('auth-password')));
toggleConfirmBtn.addEventListener('click', () => handlePasswordToggle(toggleConfirmBtn, authConfirmInput));

// ========== MAILCHIMP CONFIG ==========
// Uses JSONP to avoid CORS — no Zapier or server needed
function addToMailchimp(firstName, lastName, email) {
    const callbackName = 'mcCallback_' + Date.now();
    const url = 'https://shop-bagged.us19.list-manage.com/subscribe/post-json'
        + '?u=0da92e32a8c9e5ee0c4f11eb8'
        + '&id=b0d7479011'
        + '&f_id=0096c2e1f0'
        + '&EMAIL=' + encodeURIComponent(email)
        + '&FNAME=' + encodeURIComponent(firstName)
        + '&LNAME=' + encodeURIComponent(lastName)
        + '&b_0da92e32a8c9e5ee0c4f11eb8_b0d7479011='  // honeypot — must be empty
        + '&c=' + callbackName;

    window[callbackName] = function(data) {
        if (data.result === 'success') {
            console.log('Mailchimp: added to waitlist ✓');
        } else {
            // Already subscribed is fine — not a real error
            console.warn('Mailchimp:', data.msg);
        }
        delete window[callbackName];
    };

    const script = document.createElement('script');
    script.src = url;
    document.body.appendChild(script);
    setTimeout(() => script.remove(), 5000);
}

// Form Submit
authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const confirmPassword = authConfirmInput.value;
    authError.innerText = '';

    if (authMode === 'signup' && password !== confirmPassword) {
        authError.innerText = 'Passwords do not match.';
        return;
    }

    const oldText = authSubmitBtn.innerText;
    authSubmitBtn.innerText = 'PLEASE WAIT...';
    authSubmitBtn.disabled = true;

    if (authMode === 'login') {
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                // onAuthStateChanged will handle the redirect
            })
            .catch(error => {
                console.error("Login err:", error);
                authError.innerHTML = friendlyError(error.code);
                authSubmitBtn.innerText = oldText;
                authSubmitBtn.disabled = false;
            });
    } else {
        const firstName = authFirstName.value.trim();
        const lastName = authLastName.value.trim();

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;

                // 1. Set display name
                return user.updateProfile({
                    displayName: `${firstName} ${lastName}`.trim()
                }).then(() => user);
            })
            .then((user) => {
                // 2. Send Firebase email verification
                user.sendEmailVerification().catch(err =>
                    console.warn('Email verification send error:', err)
                );

                // 3. Add to Mailchimp list
                addToMailchimp(firstName, lastName, email);

                // 5. Show confirmation message before redirecting
                authError.style.color = '#27ae60';
                authError.innerText = `Welcome, ${firstName}! Check your inbox to verify your email.`;

                // onAuthStateChanged will redirect after a short delay
            })
            .catch(error => {
                console.error("Signup err:", error);
                authError.style.color = '#d63031';
                authError.innerHTML = friendlyError(error.code);
                authSubmitBtn.innerText = oldText;
                authSubmitBtn.disabled = false;
            });
    }
});

// Event delegation for auth error links
authError.addEventListener('click', (e) => {
    if (e.target.id === 'error-login-link') {
        e.preventDefault();
        authSwitchLink.click();
    }
});

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
    if (user) {
        window.location.href = 'dashboard.html';
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
        authConfirmInput.removeAttribute('required');
    } else {
        authTitle.innerText = 'CREATE ACCOUNT';
        authSubmitBtn.innerText = 'SIGN UP';
        authSwitchText.innerText = 'Already have an account?';
        authSwitchLink.innerText = 'Sign in';
        authConfirmWrapper.classList.add('show');
        authConfirmInput.setAttribute('required', 'true');
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
    if (code === 'auth/email-already-in-use') return 'Email already registered. Try signing in.';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
    if (code === 'auth/wrong-password') return 'Incorrect password.';
    if (code === 'auth/user-not-found') return 'No account found with this email.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later.';
    return 'An error occurred. Please try again.';
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
                authError.innerText = friendlyError(error.code);
                authSubmitBtn.innerText = oldText;
                authSubmitBtn.disabled = false;
            });
    } else {
        auth.createUserWithEmailAndPassword(email, password)
            .then(() => {
                // onAuthStateChanged will handle redirect
            })
            .catch(error => {
                console.error("Signup err:", error);
                authError.innerText = friendlyError(error.code);
                authSubmitBtn.innerText = oldText;
                authSubmitBtn.disabled = false;
            });
    }
});

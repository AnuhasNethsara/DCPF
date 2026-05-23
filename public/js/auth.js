let isSignUp = false;

const emailForm = document.getElementById('emailForm');
const emailInput = document.getElementById('emailInput');
const passInput = document.getElementById('passInput');
const emailBtn = document.getElementById('emailBtn');
const googleBtn = document.getElementById('googleBtn');
const authError = document.getElementById('authError');
const toggleText = document.getElementById('toggleText');
const toggleLink = document.getElementById('toggleLink');

// Redirect if already logged in
firebase.auth().onAuthStateChanged(user => {
  if (user) window.location.href = '/dashboard.html';
});

function toggleMode(e) {
  e.preventDefault();
  isSignUp = !isSignUp;
  if (isSignUp) {
    emailBtn.textContent = 'Sign Up';
    toggleText.textContent = 'Already have an account?';
    toggleLink.textContent = 'Sign In';
    document.querySelector('.auth-title').textContent = 'Create Account';
    document.querySelector('.auth-subtitle').textContent = 'Sign up to build your profile';
  } else {
    emailBtn.textContent = 'Sign In';
    toggleText.textContent = "Don't have an account?";
    toggleLink.textContent = 'Sign Up';
    document.querySelector('.auth-title').textContent = 'Welcome Back';
    document.querySelector('.auth-subtitle').textContent = 'Sign in to manage your profile';
  }
  authError.textContent = '';
}

function showError(msg) {
  authError.textContent = msg;
  authError.style.display = 'block';
}

// Google sign in
googleBtn.addEventListener('click', async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
    window.location.href = '/dashboard.html';
  } catch (err) {
    showError(err.message);
  }
});

// Email sign in / sign up
emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const pass = passInput.value;

  if (!email || !pass) return showError('Please fill in all fields.');
  if (pass.length < 6) return showError('Password must be at least 6 characters.');

  try {
    if (isSignUp) {
      await firebase.auth().createUserWithEmailAndPassword(email, pass);
    } else {
      await firebase.auth().signInWithEmailAndPassword(email, pass);
    }
    window.location.href = '/dashboard.html';
  } catch (err) {
    const messages = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/weak-password': 'Password is too weak (min 6 chars).',
      'auth/invalid-email': 'Invalid email address.',
    };
    showError(messages[err.code] || err.message);
  }
});

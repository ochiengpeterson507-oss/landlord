// ========== WAIT FOR DOM TO LOAD ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Login page loaded');
    
    // ========== CHECK SUPABASE CONNECTION ==========
    if (typeof supabaseClient === 'undefined') {
        console.error('❌ Supabase client not initialized!');
        alert('Configuration error: Supabase not connected. Please check your setup.');
        return;
    }
    
    console.log('✅ Supabase client connected');
    
    // ========== GET ALL DOM ELEMENTS ==========
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginFormElement = document.getElementById('login');
    const signupFormElement = document.getElementById('signup');
    const gotoSignup = document.getElementById('goto-signup');
    const gotoLogin = document.getElementById('goto-login');
    const forgotLink = document.getElementById('forgot-password');
    const resetModal = document.getElementById('reset-modal');
    const resetForm = document.getElementById('reset-form');
    const resetCancel = document.querySelector('#reset-modal .btn-outline');
    
    // Check if critical elements exist
    if (!loginTab || !signupTab || !loginForm || !signupForm) {
        console.error('❌ Critical elements missing!');
        return;
    }
    
    // ========== TAB SWITCHING FUNCTIONS ==========
    window.activateLogin = function() {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        window.location.hash = 'login';
    };
    
    window.activateSignup = function() {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
        window.location.hash = 'signup';
    };
    
    // ========== TAB CLICK EVENTS ==========
    loginTab.addEventListener('click', function(e) {
        e.preventDefault();
        window.activateLogin();
    });
    
    signupTab.addEventListener('click', function(e) {
        e.preventDefault();
        window.activateSignup();
    });
    
    // ========== SWITCH LINKS ==========
    if (gotoSignup) {
        gotoSignup.addEventListener('click', function(e) {
            e.preventDefault();
            window.activateSignup();
        });
    }
    
    if (gotoLogin) {
        gotoLogin.addEventListener('click', function(e) {
            e.preventDefault();
            window.activateLogin();
        });
    }
    
    // ========== CHECK URL HASH ==========
    function checkHash() {
        if (window.location.hash === '#signup') {
            window.activateSignup();
        } else {
            window.activateLogin();
        }
    }
    checkHash();
    
    // ========== LOGIN FORM SUBMISSION ==========
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('📝 Login form submitted');
            
            // Get button elements
            const submitBtn = document.getElementById('login-btn');
            const btnText = submitBtn?.querySelector('.btn-text');
            const btnLoader = submitBtn?.querySelector('.btn-loader');
            
            if (!submitBtn || !btnText || !btnLoader) {
                console.error('Button elements not found');
                return;
            }
            
            // Show loading state
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline';
            submitBtn.disabled = true;
            
            // Get form values
            const email = document.getElementById('email')?.value.trim();
            const password = document.getElementById('login-password')?.value;
            
            // Validate
            if (!email || !password) {
                showError('Please fill in all fields');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            console.log('Attempting login for:', email);
            
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password,
                });
                
                if (error) throw error;
                
                console.log('✅ Login successful:', data);
                showSuccess('Login successful! Redirecting...');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
                
            } catch (error) {
                console.error('❌ Login error:', error);
                showError(error.message || 'Invalid email or password');
                resetButton(submitBtn, btnText, btnLoader);
            }
        });
    }
    
    // ========== SIGNUP FORM SUBMISSION ==========
    if (signupFormElement) {
        signupFormElement.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('📝 Signup form submitted');
            
            // Get button elements
            const submitBtn = document.getElementById('signup-btn');
            const btnText = submitBtn?.querySelector('.btn-text');
            const btnLoader = submitBtn?.querySelector('.btn-loader');
            
            if (!submitBtn || !btnText || !btnLoader) {
                console.error('Button elements not found');
                return;
            }
            
            // Show loading state
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline';
            submitBtn.disabled = true;
            
            // Get form values
            const fullname = document.getElementById('fullname')?.value.trim();
            const email = document.getElementById('signup-email')?.value.trim();
            const password = document.getElementById('signup-password')?.value;
            const confirmPassword = document.getElementById('confirm-password')?.value;
            const termsChecked = document.querySelector('input[name="terms"]')?.checked || false;
            
            // Validate
            if (!fullname || !email || !password || !confirmPassword) {
                showError('Please fill in all fields');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (!termsChecked) {
                showError('Please agree to the terms and conditions');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (password !== confirmPassword) {
                showError('Passwords do not match');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            if (password.length < 8) {
                showError('Password must be at least 8 characters');
                resetButton(submitBtn, btnText, btnLoader);
                return;
            }
            
            console.log('Attempting signup for:', email);
            
            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: fullname,
                        }
                    }
                });
                
                if (error) throw error;
                
                console.log('✅ Signup response:', data);
                
                if (data.user) {
                    if (data.user.identities && data.user.identities.length === 0) {
                        showError('This email is already registered. Please login instead.');
                        setTimeout(() => {
                            window.activateLogin();
                        }, 2000);
                    } else {
                        if (data.user.confirmation_sent_at) {
                            showSuccess('✅ Signup successful! Please check your email for confirmation.');
                        } else {
                            showSuccess('✅ Signup successful! Redirecting to dashboard...');
                            setTimeout(() => {
                                window.location.href = 'dashboard.html';
                            }, 2000);
                        }
                        
                        // Clear form
                        signupFormElement.reset();
                    }
                }
                
                resetButton(submitBtn, btnText, btnLoader);
                
            } catch (error) {
                console.error('❌ Signup error:', error);
                showError(error.message || 'Error signing up');
                resetButton(submitBtn, btnText, btnLoader);
            }
        });
    }
    
    // ========== PASSWORD VALIDATION ==========
    const signupPassword = document.getElementById('signup-password');
    const confirmPassword = document.getElementById('confirm-password');
    
    if (signupPassword && confirmPassword) {
        function validatePasswordMatch() {
            if (confirmPassword.value && signupPassword.value !== confirmPassword.value) {
                confirmPassword.style.borderColor = '#ef4444';
                confirmPassword.setCustomValidity('Passwords do not match');
            } else {
                confirmPassword.style.borderColor = '#e2e8f0';
                confirmPassword.setCustomValidity('');
            }
        }
        
        signupPassword.addEventListener('input', validatePasswordMatch);
        confirmPassword.addEventListener('input', validatePasswordMatch);
    }
    
    // ========== FORGOT PASSWORD MODAL ==========
    if (forgotLink && resetModal) {
        forgotLink.addEventListener('click', function(e) {
            e.preventDefault();
            resetModal.style.display = 'flex';
        });
    }
    
    // Close modal function
    window.closeResetModal = function() {
        if (resetModal) {
            resetModal.style.display = 'none';
        }
    };
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === resetModal) {
            window.closeResetModal();
        }
    });
    
    // Reset password form
    if (resetForm) {
        resetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('reset-email')?.value.trim();
            
            if (!email) {
                showError('Please enter your email');
                return;
            }
            
            try {
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset-password.html',
                });
                
                if (error) throw error;
                
                showSuccess('✅ Password reset email sent! Check your inbox.');
                window.closeResetModal();
                resetForm.reset();
                
            } catch (error) {
                console.error('Reset error:', error);
                showError(error.message || 'Error sending reset email');
            }
        });
    }
    
    // Cancel button in modal
    if (resetCancel) {
        resetCancel.addEventListener('click', function() {
            window.closeResetModal();
        });
    }
    
    // ========== SOCIAL LOGIN ==========
    async function handleSocialLogin(provider) {
        try {
            console.log('Attempting social login with:', provider);
            
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: window.location.origin + '/dashboard.html'
                }
            });
            
            if (error) throw error;
            
        } catch (error) {
            console.error('Social login error:', error);
            showError(error.message || `Error with ${provider} login`);
        }
    }
    
    // Social login buttons
    const googleLogin = document.getElementById('google-login');
    const githubLogin = document.getElementById('github-login');
    const googleSignup = document.getElementById('google-signup');
    const githubSignup = document.getElementById('github-signup');
    
    if (googleLogin) {
        googleLogin.addEventListener('click', (e) => {
            e.preventDefault();
            handleSocialLogin('google');
        });
    }
    
    if (githubLogin) {
        githubLogin.addEventListener('click', (e) => {
            e.preventDefault();
            handleSocialLogin('github');
        });
    }
    
    if (googleSignup) {
        googleSignup.addEventListener('click', (e) => {
            e.preventDefault();
            handleSocialLogin('google');
        });
    }
    
    if (githubSignup) {
        githubSignup.addEventListener('click', (e) => {
            e.preventDefault();
            handleSocialLogin('github');
        });
    }
});

// ========== HELPER FUNCTIONS ==========
function resetButton(btn, btnText, btnLoader) {
    if (btn && btnText && btnLoader) {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        btn.disabled = false;
    }
}

function showError(message) {
    createToast(message, '#ef4444');
}

function showSuccess(message) {
    createToast(message, '#10b981');
}

function createToast(message, bgColor) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.custom-toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
        max-width: 350px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animations
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
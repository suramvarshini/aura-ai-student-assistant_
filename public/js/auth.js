/**
 * Campus Lost and Found System - Admin Auth Script
 * Manages admin login form, token storage, and session validation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');

  // If already logged in, redirect to dashboard
  const token = localStorage.getItem('adminToken');
  if (token && window.location.pathname.includes('admin-login.html')) {
    window.location.href = 'admin-dashboard.html';
    return;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value.trim();

      if (!email || !password) {
        showToast('Please enter both email and password.', 'error');
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const origText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '🔐 Authenticating...';

      try {
        const response = await API.loginAdmin(email, password);

        if (response.success) {
          localStorage.setItem('adminToken', response.token);
          localStorage.setItem('adminUser', JSON.stringify(response.user));
          showToast('Login successful! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
          }, 800);
        } else {
          showToast(response.message || 'Login failed. Invalid credentials.', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
      } catch (err) {
        console.error('Login error:', err);
        showToast('Server error during login.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    });
  }
});

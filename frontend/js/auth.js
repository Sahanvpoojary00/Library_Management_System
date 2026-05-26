document.addEventListener('DOMContentLoaded', () => {
  // 1. Tab Switching Logic (on Login Page)
  const tabs = document.querySelectorAll('.auth-tab');
  if (tabs.length > 0) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const formId = tab.dataset.form;
        document.querySelectorAll('.auth-form-container').forEach(form => {
          form.classList.remove('active');
        });
        document.getElementById(formId).classList.add('active');
      });
    });
  }

  // 2. Register Form Submission
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirmPass = document.getElementById('reg-confirm-password').value;

      if (!name || !email || !password) {
        showToast('All fields are required', 'error');
        return;
      }

      if (password !== confirmPass) {
        showToast('Passwords do not match', 'error');
        return;
      }

      try {
        const response = await apiFetch('/auth/register', {
          method: 'POST',
          body: { name, email, password }
        });

        if (response) {
          showToast('Registration successful! Please login.', 'success');
          
          // Reset form and switch tab to login
          registerForm.reset();
          const loginTab = document.querySelector('[data-form="login-container"]');
          if (loginTab) loginTab.click();
          
          // Pre-fill email
          document.getElementById('login-email').value = email;
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // 3. Login Form Submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showToast('Email and password are required', 'error');
        return;
      }

      try {
        const response = await apiFetch('/auth/login', {
          method: 'POST',
          body: { email, password }
        });

        if (response && response.token) {
          setSession(response.token, response.user);
          showToast(`Welcome back, ${response.user.name}!`, 'success');

          // Redirect based on role
          setTimeout(() => {
            if (response.user.role === 'admin') {
              window.location.href = 'admin.html';
            } else {
              window.location.href = 'student.html';
            }
          }, 1000);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // 4. Session Guards for Dashboard Protection
  protectDashboard();
});

// Guard dashboards
function protectDashboard() {
  const path = window.location.pathname;
  const user = getCurrentUser();

  if (path.includes('admin.html')) {
    if (!isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }
    if (user.role !== 'admin') {
      window.location.href = 'student.html';
      return;
    }
  }

  if (path.includes('student.html')) {
    if (!isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }
    if (user.role !== 'student') {
      window.location.href = 'admin.html';
      return;
    }
  }
}

// Global Signout Trigger
function handleLogout() {
  clearSession();
  showToast('Logged out successfully', 'success');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
}

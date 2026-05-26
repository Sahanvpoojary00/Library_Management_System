const API_BASE = '/api';

// Save JWT and user info
function setSession(token, user) {
  localStorage.setItem('library_token', token);
  localStorage.setItem('library_user', JSON.stringify(user));
}

// Clear session
function clearSession() {
  localStorage.removeItem('library_token');
  localStorage.removeItem('library_user');
}

// Retrieve token
function getToken() {
  return localStorage.getItem('library_token');
}

// Retrieve current user
function getCurrentUser() {
  const user = localStorage.getItem('library_user');
  return user ? JSON.parse(user) : null;
}

// Check session valid
function isAuthenticated() {
  return !!getToken();
}

// Core API Fetch Helper
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Set headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchConfig = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object') {
    fetchConfig.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, fetchConfig);
    
    // Auto logout if token is invalid or expired
    if (response.status === 401 || response.status === 403) {
      // Avoid redirect loops if we are already trying to access auth endpoints
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        clearSession();
        showToast('Session expired. Redirecting to login...', 'warning');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
        return null;
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }
    return data;
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}

// Toast alerts helper
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-check-circle';
  if (type === 'error') iconClass = 'fa-times-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-circle';

  toast.innerHTML = `
    <i class="fas ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Animate out and remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

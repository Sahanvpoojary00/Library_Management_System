document.addEventListener('DOMContentLoaded', () => {
  const user = getCurrentUser();
  if (!user || user.role !== 'student') return;

  // Display student name
  const studentNameEl = document.getElementById('student-name');
  if (studentNameEl) studentNameEl.textContent = user.name;
  const avatarEl = document.getElementById('student-avatar-char');
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();

  // 1. Sidebar Section Switcher
  const menuLinks = document.querySelectorAll('.menu-link[data-section]');
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      menuLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const targetId = link.dataset.section;
      document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.classList.remove('active');
      });
      document.getElementById(targetId).classList.add('active');
    });
  });

  // 2. Fetch Initial Student Data
  loadStudentData();

  // 3. Search Catalog Trigger
  const searchInput = document.getElementById('catalog-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      loadCatalog(searchInput.value.trim());
    }, 300));
  }
});

// Load student dashboard datasets
async function loadStudentData() {
  try {
    const history = await apiFetch('/history'); // Student specific history
    const reservations = await apiFetch('/reservations'); // Student specific reservations
    
    // We fetch catalog separately to support dynamic filters
    await loadCatalog('');

    if (history && reservations) {
      renderStudentDashboard(history, reservations);
    }
  } catch (err) {
    console.error('Error loading student data:', err);
    showToast('Failed to load library status', 'error');
  }
}

// Render student overview, history list, and active items
function renderStudentDashboard(history, reservations) {
  // Filter active borrows (where return_date is null)
  const activeBorrows = history.filter(row => row.return_date === null);
  
  // Set metrics
  document.getElementById('student-metric-active').textContent = activeBorrows.length;
  document.getElementById('student-metric-reserves').textContent = reservations.length;
  
  // Find next deadline
  let nextDeadlineText = 'No active deadlines';
  if (activeBorrows.length > 0) {
    // Sort active checkouts by due date
    const sorted = [...activeBorrows].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const earliestDueDate = new Date(sorted[0].due_date);
    nextDeadlineText = earliestDueDate.toLocaleDateString();
  }
  document.getElementById('student-metric-deadline').textContent = nextDeadlineText;

  // Render My Active Borrows Section
  renderActiveBorrows(activeBorrows);

  // Render History Section
  renderHistoryTable(history);

  // Render Reservations Section
  renderReservationsTable(reservations);
}

// Load catalog grid
async function loadCatalog(searchTerm) {
  try {
    const books = await apiFetch(`/books?search=${encodeURIComponent(searchTerm)}`);
    if (books) {
      renderCatalogGrid(books);
    }
  } catch (err) {
    console.error('Error fetching catalog:', err);
  }
}

// Render Book Cards for Catalog Grid
function renderCatalogGrid(books) {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (books.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No books match your search query.</div>`;
    return;
  }

  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'glass-card book-card';
    
    let actionBtnHTML = '';
    let statusBadgeHTML = '';

    if (book.available > 0) {
      statusBadgeHTML = `<span class="status-badge success">${book.available} Available</span>`;
      // Informational checkout instructions
      actionBtnHTML = `
        <button class="btn btn-secondary" style="font-size: 13px;" onclick="showToast('Visit the library desk with Book ID ${book.id} to borrow', 'warning')">
          <i class="fas fa-info-circle"></i> Borrow Instructions
        </button>
      `;
    } else {
      statusBadgeHTML = `<span class="status-badge danger">Out of Stock</span>`;
      // Reservation trigger
      actionBtnHTML = `
        <button class="btn btn-primary" style="font-size: 13px;" onclick="reserveBook(${book.id})">
          <i class="fas fa-bookmark"></i> Pre-Book / Reserve
        </button>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="book-category">${book.category}</div>
        <h3 class="book-title">${book.title}</h3>
        <p class="book-author">by ${book.author}</p>
      </div>
      <div>
        <div class="book-status-row">
          <span>Book ID: <strong>#${book.id}</strong></span>
          ${statusBadgeHTML}
        </div>
        <div class="book-action-row">
          ${actionBtnHTML}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Render Active Borrows (Summary list on Overview page)
function renderActiveBorrows(borrows) {
  const tbody = document.getElementById('student-borrows-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (borrows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">You have no active book loans.</td></tr>`;
    return;
  }

  borrows.forEach(row => {
    const issueDate = new Date(row.issue_date).toLocaleDateString();
    const dueDate = new Date(row.due_date).toLocaleDateString();
    const isOverdue = new Date() > new Date(row.due_date);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.book_title}</strong><br><small>${row.book_author}</small></td>
      <td>${issueDate}</td>
      <td>
        <span class="status-badge ${isOverdue ? 'danger' : 'warning'}">
          ${dueDate} ${isOverdue ? '(OVERDUE)' : ''}
        </span>
      </td>
      <td>
        <span class="status-badge warning">Issued</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Borrow History Table (All time logs)
function renderHistoryTable(history) {
  const tbody = document.getElementById('student-history-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No borrowing logs found in your history.</td></tr>`;
    return;
  }

  history.forEach(row => {
    const issueDate = new Date(row.issue_date).toLocaleDateString();
    const dueDate = new Date(row.due_date).toLocaleDateString();
    const returnDate = row.return_date ? new Date(row.return_date).toLocaleDateString() : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.book_title}</strong><br><small>${row.book_author}</small></td>
      <td>${issueDate}</td>
      <td>${dueDate}</td>
      <td>${returnDate}</td>
      <td>
        <span class="status-badge ${row.return_date ? 'success' : 'warning'}">
          ${row.return_date ? 'Returned' : 'Active'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Reservations table
function renderReservationsTable(resList) {
  const tbody = document.getElementById('student-reservations-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (resList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">You have no pending reservations.</td></tr>`;
    return;
  }

  resList.forEach(row => {
    const resDate = new Date(row.reservation_date).toLocaleDateString();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.book_title}</strong><br><small>${row.book_author}</small></td>
      <td>${resDate}</td>
      <td>
        <span class="status-badge success" style="background: var(--accent-light); color: var(--accent);">Queue Position: #1</span>
      </td>
      <td>
        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 13px;" onclick="cancelReservation(${row.id})">
          <i class="fas fa-times"></i> Cancel
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Action Trigger: Pre-book/Reserve Book
async function reserveBook(bookId) {
  try {
    await apiFetch('/reserve', {
      method: 'POST',
      body: { bookId }
    });
    showToast('Book reserved successfully!', 'success');
    loadStudentData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Action Trigger: Cancel Reservation
async function cancelReservation(resId) {
  if (!confirm('Are you sure you want to cancel your reservation for this book?')) return;
  try {
    await apiFetch(`/reservations/${resId}`, { method: 'DELETE' });
    showToast('Reservation cancelled.', 'success');
    loadStudentData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Utility: Debounce for search inputs
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

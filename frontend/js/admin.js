document.addEventListener('DOMContentLoaded', () => {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') return;

  // Display admin name
  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) adminNameEl.textContent = user.name;
  const avatarEl = document.getElementById('admin-avatar-char');
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

  // 2. Fetch Initial Dashboard Data
  loadDashboardData();

  // 3. Form Submit Listeners
  
  // Add Book Form
  const addBookForm = document.getElementById('add-book-form');
  if (addBookForm) {
    addBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('book-title').value.trim();
      const author = document.getElementById('book-author').value.trim();
      const category = document.getElementById('book-category').value.trim();
      const quantity = parseInt(document.getElementById('book-quantity').value, 10);

      if (!title || !author || !category || isNaN(quantity)) {
        showToast('Please fill all fields correctly', 'error');
        return;
      }

      try {
        await apiFetch('/books', {
          method: 'POST',
          body: { title, author, category, quantity }
        });
        showToast('Book added successfully!', 'success');
        addBookForm.reset();
        loadDashboardData(); // Refresh list & metrics
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Issue Book Form
  const issueBookForm = document.getElementById('issue-book-form');
  if (issueBookForm) {
    issueBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentEmail = document.getElementById('issue-student-email').value.trim();
      const bookId = document.getElementById('issue-book-select').value;
      const daysToReturn = parseInt(document.getElementById('issue-duration').value, 10) || 14;

      if (!studentEmail || !bookId) {
        showToast('Please specify student email and select a book', 'error');
        return;
      }

      try {
        await apiFetch('/issue', {
          method: 'POST',
          body: { studentEmail, bookId, daysToReturn }
        });
        showToast('Book issued successfully!', 'success');
        issueBookForm.reset();
        loadDashboardData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Return Book Form (Manual ID input if needed, though processing from tables is better)
  const returnBookForm = document.getElementById('return-book-form');
  if (returnBookForm) {
    returnBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const transactionId = document.getElementById('return-trans-id').value.trim();

      if (!transactionId) {
        showToast('Please enter a Transaction ID', 'error');
        return;
      }

      try {
        await apiFetch('/return', {
          method: 'POST',
          body: { transactionId }
        });
        showToast('Book returned successfully!', 'success');
        returnBookForm.reset();
        loadDashboardData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Edit Book Form Submit (Modal)
  const editBookForm = document.getElementById('edit-book-form');
  if (editBookForm) {
    editBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-book-id').value;
      const title = document.getElementById('edit-book-title').value.trim();
      const author = document.getElementById('edit-book-author').value.trim();
      const category = document.getElementById('edit-book-category').value.trim();
      const quantity = parseInt(document.getElementById('edit-book-quantity').value, 10);
      const available = parseInt(document.getElementById('edit-book-available').value, 10);

      try {
        await apiFetch(`/books/${id}`, {
          method: 'PUT',
          body: { title, author, category, quantity, available }
        });
        showToast('Book details updated successfully!', 'success');
        closeEditModal();
        loadDashboardData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
});

// Load all dashboard components
async function loadDashboardData() {
  try {
    const books = await apiFetch('/books');
    const activeBorrows = await apiFetch('/active');
    const reservations = await apiFetch('/reservations');
    const allHistory = await apiFetch('/history');

    if (books && activeBorrows && reservations && allHistory) {
      updateMetrics(books, activeBorrows, reservations);
      renderInventoryTable(books);
      renderActiveBorrowsTable(activeBorrows);
      renderReservationsTable(reservations);
      renderHistoryTable(allHistory);
      populateBookDropdowns(books);
    }
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    showToast('Failed to load dashboard statistics', 'error');
  }
}

// Update Overview Metrics Grid
function updateMetrics(books, activeBorrows, reservations) {
  const totalBooks = books.reduce((acc, book) => acc + book.quantity, 0);
  const totalAvailable = books.reduce((acc, book) => acc + book.available, 0);

  document.getElementById('metric-total-books').textContent = totalBooks;
  document.getElementById('metric-avail-books').textContent = totalAvailable;
  document.getElementById('metric-active-borrows').textContent = activeBorrows.length;
  document.getElementById('metric-reservations').textContent = reservations.length;
}

// Render Book Inventory Table
function renderInventoryTable(books) {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (books.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No books available in the inventory.</td></tr>`;
    return;
  }

  books.forEach(book => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${book.id}</td>
      <td><strong>${book.title}</strong></td>
      <td>${book.author}</td>
      <td><span class="status-badge success" style="background: var(--accent-light); color: var(--accent);">${book.category}</span></td>
      <td>${book.quantity}</td>
      <td>
        <span class="status-badge ${book.available > 0 ? 'success' : 'danger'}">
          ${book.available} available
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;" onclick="openEditModal(${JSON.stringify(book).replace(/"/g, '&quot;')})">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn btn-danger" style="padding: 6px 12px; font-size: 13px;" onclick="deleteBook(${book.id})">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Populating dropdowns for issuing books
function populateBookDropdowns(books) {
  const select = document.getElementById('issue-book-select');
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Choose a book...</option>';
  
  books.forEach(book => {
    if (book.available > 0) {
      const opt = document.createElement('option');
      opt.value = book.id;
      opt.textContent = `${book.title} (by ${book.author} - ${book.available} left)`;
      select.appendChild(opt);
    }
  });
}

// Render Active Borrows Table
function renderActiveBorrowsTable(borrows) {
  const tbody = document.getElementById('active-borrows-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (borrows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No active book borrowings.</td></tr>`;
    return;
  }

  borrows.forEach(row => {
    const issueDate = new Date(row.issue_date).toLocaleDateString();
    const dueDate = new Date(row.due_date).toLocaleDateString();
    
    // Check if overdue
    const isOverdue = new Date() > new Date(row.due_date);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.id}</td>
      <td><strong>${row.book_title}</strong><br><small>${row.book_author}</small></td>
      <td>${row.student_name}<br><small>${row.student_email}</small></td>
      <td>${issueDate}</td>
      <td>
        <span class="status-badge ${isOverdue ? 'danger' : 'warning'}">
          ${dueDate} ${isOverdue ? '(OVERDUE)' : ''}
        </span>
      </td>
      <td>
        <button class="btn btn-success" style="background: var(--success); color: white; padding: 6px 12px; font-size: 13px;" onclick="processReturn(${row.id})">
          <i class="fas fa-undo"></i> Return Book
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Reservations Queue
function renderReservationsTable(resList) {
  const tbody = document.getElementById('reservations-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (resList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No pending pre-bookings/reservations.</td></tr>`;
    return;
  }

  resList.forEach(row => {
    const resDate = new Date(row.reservation_date).toLocaleDateString();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.id}</td>
      <td><strong>${row.book_title}</strong><br><small>${row.book_author}</small></td>
      <td>${row.student_name}<br><small>${row.student_email}</small></td>
      <td>${resDate}</td>
      <td>
        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 13px;" onclick="cancelReservation(${row.id})">
          <i class="fas fa-times"></i> Cancel
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Borrow History Table (Admin view of all history)
function renderHistoryTable(history) {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No historical transactions found.</td></tr>`;
    return;
  }

  history.forEach(row => {
    const issueDate = new Date(row.issue_date).toLocaleDateString();
    const dueDate = new Date(row.due_date).toLocaleDateString();
    const returnDate = row.return_date ? new Date(row.return_date).toLocaleDateString() : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.id}</td>
      <td><strong>${row.book_title}</strong></td>
      <td>${row.student_name}</td>
      <td>${issueDate}</td>
      <td>${dueDate}</td>
      <td>
        <span class="status-badge ${row.return_date ? 'success' : 'warning'}">
          ${row.return_date ? `Returned on ${returnDate}` : 'Issued'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Book Deletion Handler
async function deleteBook(id) {
  if (!confirm('Are you sure you want to delete this book from the database? All records linking this book will also be affected.')) {
    return;
  }

  try {
    await apiFetch(`/books/${id}`, { method: 'DELETE' });
    showToast('Book deleted successfully!', 'success');
    loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Return Handler from Active list row
async function processReturn(transId) {
  try {
    await apiFetch('/return', {
      method: 'POST',
      body: { transactionId: transId }
    });
    showToast('Book return registered!', 'success');
    loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Reservation Cancellation Handler
async function cancelReservation(id) {
  if (!confirm('Are you sure you want to cancel this reservation request?')) {
    return;
  }
  try {
    await apiFetch(`/reservations/${id}`, { method: 'DELETE' });
    showToast('Reservation request cancelled!', 'success');
    loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Modal Handlers
function openEditModal(book) {
  const overlay = document.getElementById('edit-book-modal');
  if (!overlay) return;

  document.getElementById('edit-book-id').value = book.id;
  document.getElementById('edit-book-title').value = book.title;
  document.getElementById('edit-book-author').value = book.author;
  document.getElementById('edit-book-category').value = book.category;
  document.getElementById('edit-book-quantity').value = book.quantity;
  document.getElementById('edit-book-available').value = book.available;

  overlay.classList.add('active');
}

function closeEditModal() {
  const overlay = document.getElementById('edit-book-modal');
  if (overlay) overlay.classList.remove('active');
}

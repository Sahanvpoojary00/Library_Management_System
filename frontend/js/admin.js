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
        ${book.reserved_count > 0 ? `<br><small style="color: #d97706; font-weight: 500; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;"><i class="fas fa-bookmark"></i> ${book.reserved_count} reserved</small>` : ''}
        ${book.borrowed_count > 0 ? `<br><small style="color: var(--primary); font-weight: 500; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;"><i class="fas fa-book-reader"></i> ${book.borrowed_count} borrowed</small>` : ''}
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
    const opt = document.createElement('option');
    opt.value = book.id;
    opt.textContent = `${book.title} (by ${book.author} - ID: #${book.id}, Available: ${book.available}/${book.quantity})`;
    select.appendChild(opt);
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
    const resDate = new Date(row.reservation_date);
    const expiryTime = new Date(resDate.getTime() + 12 * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = expiryTime - now;

    let timeRemainingText = '';
    let badgeClass = 'success';
    if (diffMs <= 0) {
      timeRemainingText = 'Expired';
      badgeClass = 'danger';
    } else {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      timeRemainingText = `${diffHours}h ${diffMins}m remaining`;
      if (diffHours < 2) {
        badgeClass = 'warning';
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.id}</td>
      <td><strong>${row.book_title}</strong><br><small>${row.book_author}</small></td>
      <td>${row.student_name}<br><small>${row.student_email}</small></td>
      <td>
        <div>${resDate.toLocaleString()}</div>
        <span class="status-badge ${badgeClass}" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11px; padding: 2px 6px;">
          <i class="fas fa-clock"></i> ${timeRemainingText}
        </span>
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

// ═══════════════════════════════════════════════════════════════════════════
// ACADEMIC RESOURCES — EBOOK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Wire up the ebook upload form and PDF file picker on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // PDF file picker display
  const pdfInput = document.getElementById('ebook-pdf-input');
  if (pdfInput) {
    pdfInput.addEventListener('change', () => {
      const nameEl = document.getElementById('pdf-file-name');
      const dropZone = document.getElementById('pdf-drop-zone');
      if (pdfInput.files[0]) {
        const name = pdfInput.files[0].name;
        if (nameEl) nameEl.textContent = `📄 ${name}`;
        if (dropZone) dropZone.style.borderColor = 'var(--primary)';
      }
    });
  }

  // Upload form submit
  const uploadForm = document.getElementById('ebook-upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('ebook-title').value.trim();
      const subject = document.getElementById('ebook-subject').value.trim();
      const fileInput = document.getElementById('ebook-pdf-input');
      const allowDownloadCb = document.getElementById('ebook-allow-download');
      const allowDownload = allowDownloadCb ? allowDownloadCb.checked : true;

      if (!title || !subject) { showToast('Title and subject are required.', 'error'); return; }
      if (!fileInput.files[0]) { showToast('Please select a PDF file.', 'error'); return; }

      await uploadEbook(title, subject, fileInput.files[0], allowDownload);
    });
  }

  // Load ebooks when section is activated
  const ebooksMenuLink = document.getElementById('ebooks-menu-link');
  if (ebooksMenuLink) {
    ebooksMenuLink.addEventListener('click', () => {
      loadEbooks();
    });
  }
});

// Load and render ebook list
async function loadEbooks() {
  try {
    const ebooks = await apiFetch('/ebooks');
    if (!ebooks) return;
    renderEbooksTable(ebooks);

    // Update stats
    const totalChunks = ebooks.reduce((sum, e) => sum + (e.chunk_count || 0), 0);
    const metricEbooks = document.getElementById('metric-ebooks');
    const metricChunks = document.getElementById('metric-chunks');
    if (metricEbooks) metricEbooks.textContent = ebooks.length;
    if (metricChunks) metricChunks.textContent = totalChunks;
  } catch (err) {
    showToast('Failed to load academic resources.', 'error');
  }
}

// Render ebook management table
function renderEbooksTable(ebooks) {
  const tbody = document.getElementById('ebooks-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (ebooks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No academic resources uploaded yet. Upload a PDF textbook to get started.</td></tr>`;
    return;
  }

  ebooks.forEach(eb => {
    const uploadedDate = new Date(eb.uploaded_at).toLocaleDateString();
    const chunkBadge = eb.chunk_count > 0
      ? `<span class="status-badge success">${eb.chunk_count} chunks</span>`
      : `<span class="status-badge danger">No text extracted</span>`;
    const downloadBadge = eb.allow_download === 1 || eb.allow_download === true
      ? `<span class="status-badge success" style="background: rgba(16, 185, 129, 0.12); color: #10b981; margin-top: 4px; display: inline-block;"><i class="fas fa-download"></i> Enabled</span>`
      : `<span class="status-badge danger" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; margin-top: 4px; display: inline-block;"><i class="fas fa-ban"></i> Disabled</span>`;

    const token = getToken();
    const viewUrl = `/api/ebooks/${eb.id}/view?token=${token}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${eb.id}</td>
      <td><strong>${eb.title}</strong></td>
      <td><span class="status-badge" style="background: rgba(99,102,241,0.15); color: var(--primary);">${eb.subject}</span></td>
      <td>${uploadedDate}</td>
      <td>${chunkBadge}<br>${downloadBadge}</td>
      <td style="display: flex; gap: 6px; flex-wrap: wrap;">
        <a href="${viewUrl}" target="_blank" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px; text-decoration: none;">
          <i class="fas fa-eye"></i> View
        </a>
        <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="openEditEbookModal(${eb.id}, '${eb.title.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${eb.subject.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', ${eb.allow_download})">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-danger" style="padding: 5px 10px; font-size: 12px;" onclick="deleteEbook(${eb.id}, '${eb.title.replace(/'/g, "\\'")}')">  
          <i class="fas fa-trash"></i> Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Upload ebook (multipart/form-data)
async function uploadEbook(title, subject, file, allowDownload) {
  const btn = document.getElementById('upload-btn');
  const progressWrap = document.getElementById('upload-progress-wrap');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');

  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }
    if (progressWrap) progressWrap.style.display = 'block';

    // Simulate progress bar (real progress not possible with fetch without XHR)
    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 8, 85);
      if (progressBar) progressBar.style.width = fakeProgress + '%';
      if (fakeProgress > 40 && progressText) progressText.textContent = 'Extracting and indexing text chunks...';
    }, 400);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('subject', subject);
    formData.append('pdf', file);
    formData.append('allowDownload', allowDownload);

    const token = getToken();
    const response = await fetch('/api/ebooks/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    clearInterval(progressInterval);
    if (progressBar) progressBar.style.width = '100%';

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');

    setTimeout(() => {
      if (progressWrap) progressWrap.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
    }, 800);

    showToast(`${data.message} (${data.chunksCreated} chunks indexed)`, 'success');

    // Reset form
    document.getElementById('ebook-upload-form').reset();
    const nameEl = document.getElementById('pdf-file-name');
    if (nameEl) nameEl.textContent = '';
    const dropZone = document.getElementById('pdf-drop-zone');
    if (dropZone) dropZone.style.borderColor = '';

    loadEbooks();
  } catch (err) {
    showToast(err.message, 'error');
    if (progressWrap) progressWrap.style.display = 'none';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> Upload & Process PDF'; }
  }
}

// Delete ebook
async function deleteEbook(id, title) {
  if (!confirm(`Delete "${title}" and all its indexed content? This cannot be undone.`)) return;
  try {
    await apiFetch(`/ebooks/${id}`, { method: 'DELETE' });
    showToast(`"${title}" deleted successfully.`, 'success');
    loadEbooks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Open edit ebook modal
function openEditEbookModal(id, title, subject, allowDownload) {
  const overlay = document.getElementById('edit-ebook-modal');
  if (!overlay) return;
  document.getElementById('edit-ebook-id').value = id;
  document.getElementById('edit-ebook-title').value = title;
  document.getElementById('edit-ebook-subject').value = subject;
  const cb = document.getElementById('edit-ebook-allow-download');
  if (cb) cb.checked = allowDownload === 1 || allowDownload === true || allowDownload === '1';
  overlay.classList.add('active');
}

function closeEditEbookModal() {
  const overlay = document.getElementById('edit-ebook-modal');
  if (overlay) overlay.classList.remove('active');
}

// Wire up edit ebook form
document.addEventListener('DOMContentLoaded', () => {
  const editEbookForm = document.getElementById('edit-ebook-form');
  if (editEbookForm) {
    editEbookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id      = document.getElementById('edit-ebook-id').value;
      const title   = document.getElementById('edit-ebook-title').value.trim();
      const subject = document.getElementById('edit-ebook-subject').value.trim();
      const cb      = document.getElementById('edit-ebook-allow-download');
      const allowDownload = cb ? cb.checked : true;

      if (!title || !subject) { showToast('Title and subject are required.', 'error'); return; }

      try {
        await apiFetch(`/ebooks/${id}`, {
          method: 'PATCH',
          body: { title, subject, allowDownload }
        });
        showToast('Resource metadata updated!', 'success');
        closeEditEbookModal();
        loadEbooks();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
});

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

  // 3. Load Recent Queries Widget (Overview)
  loadRecentQueries();

  // 4. Academic Resources section
  const resourcesLink = document.getElementById('resources-menu-link');
  if (resourcesLink) {
    resourcesLink.addEventListener('click', () => loadAcademicResources());
  }

  // 5. Resources search input
  const resSearchInput = document.getElementById('resources-search');
  if (resSearchInput) {
    resSearchInput.addEventListener('input', debounce(() => {
      filterResources();
    }, 300));
  }

  // 6. Catalog search
  const searchInput = document.getElementById('catalog-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      loadCatalog(searchInput.value.trim());
    }, 300));
  }
});

let activeReservations = [];
let _allResources = []; // cache for resources

// Load student dashboard datasets
async function loadStudentData() {
  try {
    const history = await apiFetch('/history'); // Student borrow history
    const reservations = await apiFetch('/reservations');
    activeReservations = reservations || [];

    // Load catalog
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
  const activeBorrows = history.filter(row => row.return_date === null);

  document.getElementById('student-metric-active').textContent = activeBorrows.length;
  document.getElementById('student-metric-reserves').textContent = reservations.length;

  let nextDeadlineText = 'No active deadlines';
  if (activeBorrows.length > 0) {
    const sorted = [...activeBorrows].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    nextDeadlineText = new Date(sorted[0].due_date).toLocaleDateString();
  }
  document.getElementById('student-metric-deadline').textContent = nextDeadlineText;

  renderActiveBorrows(activeBorrows);
  renderHistoryTable(history);
  renderReservationsTable(reservations);
}

// ── Academic Resources Section ─────────────────────────────────────────────

async function loadAcademicResources() {
  const grid = document.getElementById('resources-grid');
  if (!grid) return;
  grid.innerHTML = `<div style="text-align: center; padding: 50px; color: var(--text-muted); grid-column: 1/-1;"><i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 12px; display: block;"></i><p>Loading resources...</p></div>`;

  try {
    const ebooks = await apiFetch('/ebooks');
    _allResources = ebooks || [];
    renderResourceCards(_allResources);
  } catch (err) {
    grid.innerHTML = `<div style="text-align: center; padding: 50px; color: var(--text-muted); grid-column: 1/-1;"><p>Failed to load resources.</p></div>`;
    console.error('loadAcademicResources error:', err);
  }
}

window.filterResources = function() {
  const term = (document.getElementById('resources-search') || {}).value || '';
  if (!term.trim()) {
    renderResourceCards(_allResources);
    return;
  }
  const filtered = _allResources.filter(eb =>
    eb.title.toLowerCase().includes(term.toLowerCase()) ||
    eb.subject.toLowerCase().includes(term.toLowerCase())
  );
  renderResourceCards(filtered);
};

function renderResourceCards(ebooks) {
  const grid = document.getElementById('resources-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!ebooks || ebooks.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 50px; color: var(--text-muted); grid-column: 1/-1;">
        <i class="fas fa-book-open" style="font-size: 2.5rem; margin-bottom: 14px; display: block; opacity: 0.3;"></i>
        <p>No academic resources found. Check back later or contact your administrator.</p>
      </div>`;
    return;
  }

  const token = getToken();

  ebooks.forEach(eb => {
    const date = new Date(eb.uploaded_at).toLocaleDateString();
    const card = document.createElement('div');
    card.className = 'resource-card glass-card';

    // Route through secure authenticated PDF viewer & download endpoints
    const viewUrl = `/api/ebooks/${eb.id}/view?token=${token}`;
    const downloadUrl = `/api/ebooks/${eb.id}/download?token=${token}`;

    let downloadBtnHTML = '';
    if (eb.allow_download === 1 || eb.allow_download === true) {
      downloadBtnHTML = `
        <a href="${downloadUrl}" download="${eb.title}.pdf" class="btn btn-secondary" style="font-size: 12px; padding: 7px 14px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
          <i class="fas fa-download"></i> Download
        </a>
      `;
    } else {
      downloadBtnHTML = `
        <button class="btn btn-secondary" style="font-size: 12px; padding: 7px 14px; opacity: 0.5; cursor: not-allowed; display: inline-flex; align-items: center; gap: 4px;" disabled title="Download disabled by administrator">
          <i class="fas fa-ban"></i> Restricted
        </button>
      `;
    }

    card.innerHTML = `
      <div class="resource-card-icon">
        <i class="fas fa-file-pdf"></i>
      </div>
      <div class="resource-card-body">
        <div class="resource-card-subject">${eb.subject}</div>
        <h4 class="resource-card-title">${eb.title}</h4>
        <div class="resource-card-meta">
          <span><i class="fas fa-cubes"></i> ${eb.chunk_count || 0} sections indexed</span>
          <span><i class="fas fa-calendar"></i> ${date}</span>
        </div>
        <div class="resource-card-actions">
          <button class="btn btn-primary" style="font-size: 12px; padding: 7px 14px;" onclick="openPdfViewer('${viewUrl}', '${eb.title.replace(/'/g, "\\'")}', '${eb.subject.replace(/'/g, "\\'")}', ${eb.allow_download}, '${downloadUrl}')">
            <i class="fas fa-eye"></i> Read Online
          </button>
          ${downloadBtnHTML}
          <button class="btn btn-secondary" style="font-size: 12px; padding: 7px 14px; color: var(--primary);" onclick="useInAssistant(${eb.id}, '${eb.title.replace(/'/g, "\\'")}')">
            <i class="fas fa-graduation-cap"></i> Ask AI
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Open PDF in embedded viewer modal
window.openPdfViewer = function(url, title, subject, allowDownload, downloadUrl) {
  const modal = document.getElementById('pdf-viewer-modal');
  const frame = document.getElementById('pdf-viewer-frame');
  const titleEl = document.getElementById('pdf-viewer-title');
  const subjectEl = document.getElementById('pdf-viewer-subject');
  const downloadLink = document.getElementById('pdf-download-link');

  if (!modal) return;
  if (titleEl) titleEl.textContent = title;
  if (subjectEl) subjectEl.textContent = subject;
  if (frame) frame.src = url;
  if (downloadLink) {
    if (allowDownload === 1 || allowDownload === true) {
      downloadLink.style.display = 'inline-flex';
      downloadLink.href = downloadUrl;
      downloadLink.download = title + '.pdf';
    } else {
      downloadLink.style.display = 'none';
    }
  }

  modal.classList.add('active');
};

window.closePdfViewer = function(e) {
  if (e && e.target !== document.getElementById('pdf-viewer-modal')) return;
  const modal = document.getElementById('pdf-viewer-modal');
  if (modal) modal.classList.remove('active');
  // Clear iframe src to stop loading
  const frame = document.getElementById('pdf-viewer-frame');
  if (frame) frame.src = '';
};

// When "Ask AI" clicked in Academic Resources — open widget with this PDF selected
window.useInAssistant = function(ebookId, ebookTitle) {
  // Trigger the AI Assistant widget
  const fab = document.getElementById('ai-fab');
  if (fab) fab.click();

  // Small delay to let widget open, then set PDF selection
  setTimeout(() => {
    const selectedEbookIdEl = document.getElementById('ai-selected-ebook-id');
    const selectedPdfNameEl = document.getElementById('ai-selected-pdf-name');
    const selectedPdfBadge  = document.getElementById('ai-selected-pdf-badge');
    const pdfSearchInput    = document.getElementById('ai-pdf-search-input');
    const pdfClearBtn       = document.getElementById('ai-pdf-clear-btn');

    if (selectedEbookIdEl) selectedEbookIdEl.value = ebookId;
    if (selectedPdfNameEl) selectedPdfNameEl.textContent = ebookTitle;
    if (selectedPdfBadge)  selectedPdfBadge.style.display = 'flex';
    if (pdfSearchInput)    pdfSearchInput.value = ebookTitle;
    if (pdfClearBtn)       pdfClearBtn.style.display = 'flex';

    // Focus question input
    const qi = document.getElementById('ai-question-input');
    if (qi) qi.focus();
  }, 500);
};

// ── Recent Queries Widget ──────────────────────────────────────────────────

window.loadRecentQueries = async function() {
  const container = document.getElementById('overview-recent-queries');
  if (!container) return;

  try {
    const history = await apiFetch('/ebooks/history');
    if (!history || history.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted);">No recent academic queries. <a href="#" onclick="document.getElementById('ai-fab').click(); return false;" style="color: var(--primary); font-weight: 600;">Ask your first question →</a></div>`;
      return;
    }

    container.innerHTML = '';
    const recent = history.slice(0, 5);
    recent.forEach(item => {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 12px 4px; border-bottom: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; border-radius: 8px; transition: background 0.15s;';
      div.onmouseenter = () => div.style.background = 'rgba(99,102,241,0.04)';
      div.onmouseleave = () => div.style.background = 'transparent';

      const timeStr = getRelativeTime(new Date(item.created_at));
      const sourceIcon = item.source_type === 'PDF' ? 'fa-file-pdf' : 'fa-brain';
      const sourceLabel = item.source_type === 'PDF' ? (item.source_pdf || 'PDF') : 'Gemini AI';

      div.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 13.5px; font-weight: 600; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.question}</div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
            <i class="fas ${sourceIcon}" style="color: var(--primary); margin-right: 4px;"></i>${sourceLabel}
            <span style="margin-left: 8px; background: rgba(99,102,241,0.1); color: var(--primary); padding: 1px 8px; border-radius: 10px; font-weight: 600; font-size: 10px;">${item.marks_requested} Marks</span>
          </div>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">${timeStr}</div>
      `;
      div.onclick = () => {
        // Open AI section
        document.getElementById('ai-menu-link').click();
      };
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">Could not load recent queries.</div>`;
  }
};

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

// ── History Actions (global scope) ─────────────────────────────────────────

window.clearCompanionHistory = async function() {
  if (!confirm('Are you sure you want to permanently clear ALL your academic assistant history? This cannot be undone.')) return;
  try {
    await apiFetch('/ebooks/history', { method: 'DELETE' });
    showToast('History cleared successfully', 'success');
    if (window.loadPageHistory) window.loadPageHistory();
    window.loadRecentQueries();
  } catch (err) {
    showToast('Failed to clear history: ' + err.message, 'error');
  }
};

window.deleteHistoryEntry = async function(id) {
  if (!confirm('Delete this saved answer?')) return;
  try {
    await apiFetch(`/ebooks/history/${id}`, { method: 'DELETE' });
    showToast('Entry deleted', 'success');
    if (window.loadPageHistory) window.loadPageHistory();
    window.loadRecentQueries();
  } catch (err) {
    showToast('Failed to delete entry: ' + err.message, 'error');
  }
};

window.exportAnswerToPDF = function(question, answer, sourcePdf, sourceType) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { showToast('Please allow popups to export PDF.', 'error'); return; }
  printWindow.document.write(`
    <html>
      <head>
        <title>Academic Answer — ${question.slice(0, 60)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.7; padding: 48px; color: #1e293b; max-width: 820px; margin: 0 auto; }
          h1 { color: #4f46e5; font-size: 22px; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 8px; }
          .meta { font-size: 13px; color: #64748b; margin-bottom: 28px; display: flex; gap: 24px; flex-wrap: wrap; }
          .meta strong { color: #374151; }
          .answer { margin-top: 20px; font-size: 15px; line-height: 1.8; }
          .footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
          @media print { body { padding: 24px; } }
        </style>
      </head>
      <body>
        <h1>${question}</h1>
        <div class="meta">
          <span><strong>Source:</strong> ${sourcePdf || 'Gemini AI'}</span>
          <span><strong>Generated:</strong> ${new Date().toLocaleString()}</span>
        </div>
        <div class="answer">${answer.replace(/\n/g, '<br>')}</div>
        <div class="footer">Generated by Smart Library & Academic Assistant &nbsp;|&nbsp; ScholarSync</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
};

// ── Catalog ───────────────────────────────────────────────────────────────

async function loadCatalog(searchTerm) {
  try {
    const books = await apiFetch(`/books?search=${encodeURIComponent(searchTerm)}`);
    if (books) renderCatalogGrid(books);
  } catch (err) {
    console.error('Error fetching catalog:', err);
  }
}

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

    const isReservedByMe = activeReservations.find(r => r.book_id === book.id);

    if (isReservedByMe) {
      statusBadgeHTML = `<span class="status-badge warning" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b;"><i class="fas fa-lock"></i> Reserved by You</span>`;
      actionBtnHTML = `<button class="btn btn-danger" style="font-size: 13px; width: 100%;" onclick="cancelReservation(${isReservedByMe.id})"><i class="fas fa-times"></i> Cancel Lock</button>`;
    } else if (book.available > 0) {
      statusBadgeHTML = `<span class="status-badge success">${book.available} Available</span>`;
      actionBtnHTML = `<button class="btn btn-primary" style="font-size: 13px;" onclick="reserveBook(${book.id})"><i class="fas fa-bookmark"></i> Pre-Book / Reserve</button>`;
    } else {
      statusBadgeHTML = `<span class="status-badge danger">Out of Stock</span>`;
      actionBtnHTML = `<button class="btn btn-secondary" style="font-size: 13px;" disabled><i class="fas fa-ban"></i> Out of Stock</button>`;
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
        <div class="book-action-row">${actionBtnHTML}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ── Active Borrows (Overview) ──────────────────────────────────────────────

function renderActiveBorrows(borrows) {
  const tbody = document.getElementById('student-borrows-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (borrows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">You have no active book loans.</td></tr>`;
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
      <td><span class="status-badge warning">Issued</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Borrow History Table ───────────────────────────────────────────────────

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
    const returnDate = row.return_date ? new Date(row.return_date).toLocaleDateString() : '—';

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

// ── Reservations Table ────────────────────────────────────────────────────

function renderReservationsTable(resList) {
  const tbody = document.getElementById('student-reservations-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (resList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">You have no pending reservations.</td></tr>`;
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
      const diffMins  = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      timeRemainingText = `${diffHours}h ${diffMins}m remaining`;
      if (diffHours < 2) badgeClass = 'warning';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.book_title}</strong><br><small>${row.book_author}</small></td>
      <td>${resDate.toLocaleString()}</td>
      <td>
        <span class="status-badge ${badgeClass}" style="display: inline-flex; align-items: center; gap: 4px;">
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

// ── Actions ───────────────────────────────────────────────────────────────

async function reserveBook(bookId) {
  try {
    await apiFetch('/reserve', { method: 'POST', body: { bookId } });
    showToast('Book reserved successfully!', 'success');
    loadStudentData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

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

// ── Utilities ─────────────────────────────────────────────────────────────

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

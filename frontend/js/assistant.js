/**
 * Smart Library & Academic Assistant — Widget Logic
 * GSAP-powered floating widget with searchable PDF selector,
 * per-ebook RAG, typewriter rendering, marks-based Q&A,
 * source citations, and full answer history.
 */

(function () {
  'use strict';

  // ── DOM References ─────────────────────────────────────────────────────────
  const fab           = document.getElementById('ai-fab');
  const widget        = document.getElementById('ai-widget');
  const closeBtn      = document.getElementById('ai-close-btn');
  const historyBtn    = document.getElementById('ai-history-toggle-btn');
  const generateBtn   = document.getElementById('ai-generate-btn');
  const openWidgetBtn = document.getElementById('open-ai-widget-btn');

  const questionInput = document.getElementById('ai-question-input');
  const loadingEl     = document.getElementById('ai-loading');
  const answerBox     = document.getElementById('ai-answer-box');
  const answerContent = document.getElementById('ai-answer-content');
  const copyBtn       = document.getElementById('ai-copy-btn');

  const sourceBook    = document.getElementById('ai-source-book');
  const sourceSubject = document.getElementById('ai-source-subject');
  const sourceChapter = document.getElementById('ai-source-chapter');
  const sourcePages   = document.getElementById('ai-source-pages');

  const askView      = document.getElementById('ai-ask-view');
  const historyView  = document.getElementById('ai-history-view');
  const historyItems = document.getElementById('ai-history-items');
  const historyList  = document.getElementById('ai-history-list'); // main page

  // PDF Selector elements
  const pdfSearchInput    = document.getElementById('ai-pdf-search-input');
  const pdfDropdown       = document.getElementById('ai-pdf-dropdown');
  const pdfList           = document.getElementById('ai-pdf-list');
  const pdfClearBtn       = document.getElementById('ai-pdf-clear-btn');
  const selectedEbookId   = document.getElementById('ai-selected-ebook-id');
  const selectedPdfBadge  = document.getElementById('ai-selected-pdf-badge');
  const selectedPdfName   = document.getElementById('ai-selected-pdf-name');

  let isOpen = false;
  let isHistoryView = false;
  let currentAnswer = '';
  let currentQuestion = '';
  let allEbooks = []; // cached ebook list

  // ── GSAP Idle Float Animation ──────────────────────────────────────────────
  function startIdleAnimation() {
    if (!fab || !window.gsap) return;
    gsap.to(fab, { y: -8, duration: 2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  // ── Open Widget ────────────────────────────────────────────────────────────
  function openWidget() {
    if (isOpen) return;
    isOpen = true;
    widget.style.display = 'flex';
    widget.setAttribute('aria-hidden', 'false');

    gsap.killTweensOf(fab);
    gsap.fromTo(widget,
      { opacity: 0, scale: 0.85, y: 30 },
      { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.4)' }
    );
    gsap.to(fab, { scale: 0.9, opacity: 0.7, duration: 0.2 });
  }

  // ── Close Widget ───────────────────────────────────────────────────────────
  function closeWidget() {
    if (!isOpen) return;
    gsap.to(widget, {
      opacity: 0, scale: 0.88, y: 20,
      duration: 0.3, ease: 'power2.in',
      onComplete: () => {
        widget.style.display = 'none';
        widget.setAttribute('aria-hidden', 'true');
        isOpen = false;
        gsap.to(fab, { scale: 1, opacity: 1, duration: 0.25 });
        startIdleAnimation();
        hidePdfDropdown();
      }
    });
  }

  // ── Toggle History / Ask View ──────────────────────────────────────────────
  function showAskView() {
    isHistoryView = false;
    historyView.style.display = 'none';
    askView.style.display = 'block';
    historyBtn.querySelector('i').className = 'fas fa-history';
    historyBtn.title = 'Answer History';
  }

  function showHistoryView() {
    isHistoryView = true;
    askView.style.display = 'none';
    historyView.style.display = 'block';
    historyBtn.querySelector('i').className = 'fas fa-pencil-alt';
    historyBtn.title = 'Back to Ask';
    loadWidgetHistory();
  }

  // ── PDF Selector Logic ─────────────────────────────────────────────────────

  async function loadEbookOptions() {
    try {
      const ebooks = await apiFetch('/ebooks');
      allEbooks = ebooks || [];
      renderPdfOptions(allEbooks);
      populatePdfFilterDropdown(allEbooks);
    } catch (err) {
      if (pdfList) pdfList.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">Could not load resources.</div>`;
    }
  }

  function renderPdfOptions(ebooks) {
    if (!pdfList) return;
    if (ebooks.length === 0) {
      pdfList.innerHTML = `<div style="padding: 12px 16px; color: var(--text-muted); font-size: 13px;">No resources uploaded yet.</div>`;
      return;
    }
    pdfList.innerHTML = '';
    ebooks.forEach(eb => {
      const opt = document.createElement('div');
      opt.className = 'ai-pdf-option';
      opt.dataset.id = eb.id;
      opt.dataset.title = eb.title;
      opt.innerHTML = `
        <i class="fas fa-file-pdf"></i>
        <div>
          <strong>${eb.title}</strong>
          <small>${eb.subject}</small>
        </div>
      `;
      opt.addEventListener('click', () => selectPdf(eb.id, eb.title));
      pdfList.appendChild(opt);
    });
  }

  function selectPdf(id, title) {
    if (selectedEbookId) selectedEbookId.value = id || '';
    if (selectedPdfName) selectedPdfName.textContent = title || 'None';
    if (selectedPdfBadge) selectedPdfBadge.style.display = id ? 'flex' : 'none';
    if (pdfSearchInput) pdfSearchInput.value = title || '';
    if (pdfClearBtn) pdfClearBtn.style.display = id ? 'flex' : 'none';
    hidePdfDropdown();
  }

  function clearPdfSelection() {
    selectPdf('', 'Gemini General Knowledge');
    if (pdfSearchInput) pdfSearchInput.value = '';
    if (pdfClearBtn) pdfClearBtn.style.display = 'none';
    if (selectedPdfBadge) selectedPdfBadge.style.display = 'none';
  }

  function showPdfDropdown() {
    if (pdfDropdown) {
      pdfDropdown.style.display = 'block';
      if (window.gsap) gsap.fromTo(pdfDropdown, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.2 });
    }
  }

  function hidePdfDropdown() {
    if (pdfDropdown) pdfDropdown.style.display = 'none';
  }

  function filterPdfOptions(term) {
    const filtered = term.trim()
      ? allEbooks.filter(eb =>
          eb.title.toLowerCase().includes(term.toLowerCase()) ||
          eb.subject.toLowerCase().includes(term.toLowerCase())
        )
      : allEbooks;
    renderPdfOptions(filtered);
  }

  // Populate the main-page history filter PDF dropdown
  function populatePdfFilterDropdown(ebooks) {
    const sel = document.getElementById('ai-history-filter-pdf');
    if (!sel) return;
    // Keep first option "All Textbooks"
    while (sel.options.length > 1) sel.remove(1);
    ebooks.forEach(eb => {
      const opt = document.createElement('option');
      opt.value = eb.title;
      opt.textContent = eb.title;
      sel.appendChild(opt);
    });
  }

  // ── Typewriter Effect ──────────────────────────────────────────────────────
  function typewriterRender(text, container) {
    const html = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h5 style="margin: 12px 0 6px; color: var(--primary-dark, #4338ca); font-size: 14px;">$1</h5>')
      .replace(/^## (.+)$/gm, '<h4 style="margin: 14px 0 8px; color: var(--primary);">$1</h4>')
      .replace(/^# (.+)$/gm, '<h3 style="margin: 14px 0 8px; color: var(--primary);">$1</h3>')
      .replace(/^- (.+)$/gm, '<li style="margin-bottom: 4px;">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-bottom: 4px;"><strong>$1.</strong> $2</li>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    container.innerHTML = '';
    const wrapped = html.replace(/(<li[^>]*>.*?<\/li>)+/gs, match => `<ul style="margin: 8px 0 8px 16px; padding: 0;">${match}</ul>`);
    container.innerHTML = `<div class="ai-answer-text" style="opacity:0;">${wrapped}</div>`;
    const inner = container.querySelector('.ai-answer-text');
    if (inner && window.gsap) {
      gsap.to(inner, { opacity: 1, duration: 0.6, ease: 'power2.out' });
    } else if (inner) {
      inner.style.opacity = '1';
    }
  }

  // ── Generate Answer ────────────────────────────────────────────────────────
  async function generateAnswer() {
    const question = questionInput ? questionInput.value.trim() : '';
    if (!question) {
      questionInput.classList.add('ai-input-error');
      setTimeout(() => questionInput.classList.remove('ai-input-error'), 1200);
      return;
    }

    const marksEl = document.querySelector('input[name="ai-marks"]:checked');
    const marks = marksEl ? parseInt(marksEl.value) : 10;

    const ebookId = selectedEbookId ? selectedEbookId.value : '';
    const useGeminiOnly = !ebookId && !allEbooks.length;

    currentQuestion = question;

    // UI: loading state
    generateBtn.disabled = true;
    document.getElementById('ai-generate-btn-text').textContent = 'Generating...';
    if (loadingEl) loadingEl.style.display = 'flex';
    if (answerBox) answerBox.style.display = 'none';

    try {
      const data = await apiFetch('/ebooks/ask', {
        method: 'POST',
        body: { question, marks, useGeminiOnly: useGeminiOnly || false, ebookId: ebookId || null }
      });

      if (!data) return;

      currentAnswer = data.answer;

      // Populate source citation
      if (data.source) {
        if (sourceBook) sourceBook.textContent = data.source.book || '—';
        if (sourceSubject) sourceSubject.textContent = data.source.subject || '—';
        if (sourceChapter) sourceChapter.textContent = data.source.chapter || '—';
        if (sourcePages) sourcePages.textContent = data.source.pages || '—';
      }

      // Show answer with animation
      if (answerBox) {
        answerBox.style.display = 'block';
        gsap.fromTo(answerBox,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
        );
      }

      typewriterRender(data.answer, answerContent);

      // Refresh history + analytics + recent queries (real-time updates)
      if (window.loadPageHistory) window.loadPageHistory();
      if (window.loadRecentQueries) window.loadRecentQueries();
      loadAnalytics();

    } catch (err) {
      showToast(err.message || 'Failed to generate answer. Try again.', 'error');
    } finally {
      generateBtn.disabled = false;
      document.getElementById('ai-generate-btn-text').textContent = 'Generate Answer';
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  // ── Load Widget History Panel ──────────────────────────────────────────────
  async function loadWidgetHistory() {
    if (!historyItems) return;
    historyItems.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;

    try {
      const history = await apiFetch('/ebooks/history');
      if (!history || history.length === 0) {
        historyItems.innerHTML = `<div class="ai-history-empty"><i class="fas fa-inbox"></i><p>No answers yet. Ask your first question!</p></div>`;
        return;
      }

      historyItems.innerHTML = '';
      history.slice(0, 20).forEach(item => {
        const card = document.createElement('div');
        card.className = 'ai-history-card';
        const date = new Date(item.created_at).toLocaleDateString();
        const sourceIcon = item.source_type === 'PDF' ? 'fa-file-pdf' : 'fa-brain';
        const sourceLabel = item.source_type === 'PDF' ? (item.source_pdf || 'PDF') : 'Gemini AI';

        card.innerHTML = `
          <div class="ai-history-card-top">
            <span class="ai-marks-tag">${item.marks_requested} Marks</span>
            <span class="ai-history-date">${date}</span>
          </div>
          <p class="ai-history-question">${item.question}</p>
          <div class="ai-history-source">
            <i class="fas ${sourceIcon}"></i> ${sourceLabel}
          </div>
          <div style="display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap;">
            <button class="ai-history-view-btn" onclick="viewHistoryAnswer(${JSON.stringify(item).replace(/"/g, '&quot;')})">
              <i class="fas fa-eye"></i> Open
            </button>
            <button class="ai-history-view-btn" style="background: rgba(99,102,241,0.08);" onclick="regenerateHistoryAnswer(${JSON.stringify(item.question).replace(/"/g, '&quot;')}, ${item.marks_requested})">
              <i class="fas fa-redo"></i> Regenerate
            </button>
            <button class="ai-history-view-btn" style="background: rgba(16,185,129,0.08);" onclick="copyHistoryAnswer(${JSON.stringify(item.answer).replace(/"/g, '&quot;')})">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        `;
        historyItems.appendChild(card);
      });
    } catch (err) {
      historyItems.innerHTML = `<div class="ai-history-empty"><i class="fas fa-exclamation-circle"></i><p>Failed to load history.</p></div>`;
    }
  }

  // ── Load History on Main Dashboard Page ───────────────────────────────────
  window.loadPageHistory = async function() {
    if (!historyList) return;

    const searchInput  = document.getElementById('ai-history-search');
    const sourceInput  = document.getElementById('ai-history-filter-source');
    const pdfInput     = document.getElementById('ai-history-filter-pdf');
    const dateInput    = document.getElementById('ai-history-filter-date');

    let query = '/ebooks/history?';
    if (searchInput && searchInput.value) query += `search=${encodeURIComponent(searchInput.value)}&`;
    if (sourceInput && sourceInput.value) query += `source=${encodeURIComponent(sourceInput.value)}&`;
    if (pdfInput && pdfInput.value)    query += `pdf=${encodeURIComponent(pdfInput.value)}&`;
    if (dateInput && dateInput.value)  query += `date=${encodeURIComponent(dateInput.value)}&`;

    try {
      const history = await apiFetch(query);
      if (!history || history.length === 0) {
        historyList.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            <i class="fas fa-robot" style="font-size: 2rem; margin-bottom: 12px; display: block; opacity: 0.4;"></i>
            <p>No matching answers found. Generate your first answer using the AI Assistant!</p>
          </div>`;
        return;
      }

      historyList.innerHTML = '';
      history.forEach(item => {
        const date = new Date(item.created_at).toLocaleString();
        const card = document.createElement('div');
        const sourceIcon = item.source_type === 'PDF' ? 'fa-file-pdf' : 'fa-brain';
        const sourceLabel = item.source_type === 'PDF' ? (item.source_pdf || 'PDF Textbook') : 'Gemini General Knowledge';

        card.style.cssText = 'border: 1px solid var(--glass-border); border-radius: 14px; padding: 18px; margin-bottom: 16px; background: var(--glass-bg); transition: box-shadow 0.2s;';
        card.innerHTML = `
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
            <span style="font-weight: 600; font-size: 14px; flex: 1; min-width: 0; line-height: 1.4;">${item.question}</span>
            <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
              <span style="background: linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.15)); color: var(--primary); font-size: 11px; padding: 2px 10px; border-radius: 20px; font-weight: 700;">${item.marks_requested} Marks</span>
              <span style="font-size: 11px; color: var(--text-muted);">${date}</span>
            </div>
          </div>
          <div style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 12px;">
            <i class="fas ${sourceIcon}" style="color: var(--primary); margin-right: 5px;"></i>
            <strong>${sourceLabel}</strong>
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
            <button class="btn btn-secondary" style="font-size: 11px; padding: 5px 12px;" onclick="openHistoryInWidget(${JSON.stringify(item).replace(/"/g, '&quot;')})">
              <i class="fas fa-eye"></i> Open
            </button>
            <button class="btn btn-secondary" style="font-size: 11px; padding: 5px 12px;" onclick="navigator.clipboard.writeText(${JSON.stringify(item.answer).replace(/"/g, '&quot;')}).then(()=>showToast('Copied!','success'))">
              <i class="fas fa-copy"></i> Copy
            </button>
            <button class="btn btn-secondary" style="font-size: 11px; padding: 5px 12px;" onclick='window.exportAnswerToPDF(${JSON.stringify(item.question)}, ${JSON.stringify(item.answer)}, ${JSON.stringify(sourceLabel)}, ${JSON.stringify(item.source_type)})'>
              <i class="fas fa-file-pdf"></i> Export PDF
            </button>
            <button class="btn btn-secondary" style="font-size: 11px; padding: 5px 12px; color: #ef4444; border-color: rgba(239,68,68,0.25);" onclick="deleteHistoryEntry(${item.id})">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
          <details style="cursor: pointer;">
            <summary style="font-size: 13px; color: var(--primary); font-weight: 600; list-style: none; display: flex; align-items: center; gap: 6px; outline: none;">
              <i class="fas fa-chevron-right" style="font-size: 10px; transition: transform .2s;"></i> View Full Answer
            </summary>
            <div style="margin-top: 12px; font-size: 13px; line-height: 1.8; border-top: 1px solid var(--glass-border); padding-top: 12px; white-space: pre-wrap;">${item.answer}</div>
          </details>
        `;
        historyList.appendChild(card);
      });
    } catch (err) {
      console.error('History load error:', err);
    }
  };

  // ── Load Analytics ─────────────────────────────────────────────────────────
  async function loadAnalytics() {
    try {
      const stats = await apiFetch('/ebooks/analytics');
      if (stats) {
        const tq = document.getElementById('stat-total-q');
        const wq = document.getElementById('stat-week-q');
        const aq = document.getElementById('stat-avg-q');
        const mp = document.getElementById('stat-most-pdf');
        const ms = document.getElementById('stat-most-subject');
        const lq = document.getElementById('stat-last-q');

        if (tq) tq.textContent = stats.totalQuestions;
        if (wq) wq.textContent = stats.questionsThisWeek;
        if (aq) aq.textContent = stats.avgQuestionsPerDay;
        if (mp) { mp.textContent = stats.mostUsedPdf || 'None'; mp.title = stats.mostUsedPdf || ''; }
        if (ms) { ms.textContent = stats.mostStudiedSubject || 'General'; ms.title = stats.mostStudiedSubject || ''; }
        if (lq) { lq.textContent = stats.lastQuestion || 'None'; lq.title = stats.lastQuestion || ''; }
      }
    } catch (err) {
      console.error('Analytics load error:', err);
    }
  }

  // ── View History Answer in Widget ──────────────────────────────────────────
  window.viewHistoryAnswer = function (item) {
    showAskView();
    if (questionInput) questionInput.value = item.question;

    const radioEl = document.getElementById(`marks-${item.marks_requested}`);
    if (radioEl) radioEl.checked = true;

    currentAnswer = item.answer;
    currentQuestion = item.question;
    typewriterRender(item.answer, answerContent);

    // Restore source info
    const srcLabel = item.source_type === 'PDF' ? (item.source_pdf || 'PDF') : 'Gemini General Knowledge';
    if (sourceBook) sourceBook.textContent = srcLabel;
    if (sourceSubject) sourceSubject.textContent = item.source_type === 'GEMINI' ? 'General AI' : '—';
    if (sourceChapter) sourceChapter.textContent = '—';
    if (sourcePages) sourcePages.textContent = '—';

    if (answerBox) {
      answerBox.style.display = 'block';
      gsap.fromTo(answerBox, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 });
    }
  };

  window.openHistoryInWidget = function(item) {
    openWidget();
    window.viewHistoryAnswer(item);
  };

  window.regenerateHistoryAnswer = function(question, marks) {
    showAskView();
    if (questionInput) questionInput.value = question;
    const radioEl = document.getElementById(`marks-${marks}`);
    if (radioEl) radioEl.checked = true;
    generateAnswer();
  };

  window.copyHistoryAnswer = function(answer) {
    navigator.clipboard.writeText(answer).then(() => showToast('Answer copied!', 'success'));
  };

  // ── Copy Current Answer ────────────────────────────────────────────────────
  function copyAnswer() {
    if (!currentAnswer) return;
    navigator.clipboard.writeText(currentAnswer).then(() => {
      showToast('Answer copied to clipboard!', 'success');
      if (copyBtn) {
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
      }
    }).catch(() => showToast('Copy failed. Please select and copy manually.', 'error'));
  }

  // ── Event Listeners ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    startIdleAnimation();

    if (fab)          fab.addEventListener('click', openWidget);
    if (closeBtn)     closeBtn.addEventListener('click', closeWidget);
    if (generateBtn)  generateBtn.addEventListener('click', generateAnswer);
    if (copyBtn)      copyBtn.addEventListener('click', copyAnswer);

    if (openWidgetBtn) {
      openWidgetBtn.addEventListener('click', () => {
        openWidget();
        showAskView();
      });
    }

    if (historyBtn) {
      historyBtn.addEventListener('click', () => {
        if (isHistoryView) showAskView();
        else showHistoryView();
      });
    }

    // Enter key in textarea (Shift+Enter = newline, Enter alone = generate)
    if (questionInput) {
      questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          generateAnswer();
        }
      });
    }

    // ── PDF Selector Events ───────────────────────────────────────────────────
    if (pdfSearchInput) {
      pdfSearchInput.addEventListener('focus', () => {
        showPdfDropdown();
        loadEbookOptions();
      });

      pdfSearchInput.addEventListener('input', () => {
        showPdfDropdown();
        filterPdfOptions(pdfSearchInput.value);
        // Clear selection if user types (don't lock to previous selection)
        if (selectedEbookId) selectedEbookId.value = '';
        if (pdfClearBtn) pdfClearBtn.style.display = pdfSearchInput.value ? 'flex' : 'none';
        if (selectedPdfBadge) selectedPdfBadge.style.display = 'none';
      });
    }

    // Click "No PDF" option (first in dropdown)
    const noneOption = document.querySelector('.ai-pdf-none-option');
    if (noneOption) {
      noneOption.addEventListener('click', () => clearPdfSelection());
    }

    if (pdfClearBtn) {
      pdfClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPdfSelection();
      });
    }

    // Close PDF dropdown on outside click
    document.addEventListener('click', (e) => {
      const selectorWrap = document.getElementById('ai-pdf-selector-wrap');
      if (selectorWrap && !selectorWrap.contains(e.target)) {
        hidePdfDropdown();
      }
    });

    // Load page history & analytics when AI section link is clicked
    const aiMenuLink = document.getElementById('ai-menu-link');
    if (aiMenuLink) {
      aiMenuLink.addEventListener('click', () => {
        loadAnalytics();
        if (window.loadPageHistory) window.loadPageHistory();
        loadEbookOptions(); // Refresh PDF list for filter dropdown
      });
    }

    // Filter event listeners (main page history)
    const searchInputEl = document.getElementById('ai-history-search');
    if (searchInputEl) {
      searchInputEl.addEventListener('input', () => {
        if (window.loadPageHistory) window.loadPageHistory();
      });
    }

    ['ai-history-filter-source', 'ai-history-filter-pdf', 'ai-history-filter-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { if (window.loadPageHistory) window.loadPageHistory(); });
    });

    // Close widget on outside click
    document.addEventListener('click', (e) => {
      if (isOpen && widget && fab &&
          !widget.contains(e.target) &&
          !fab.contains(e.target)) {
        closeWidget();
      }
    });

    // Initial load of ebook options (for PDF filter dropdown on page load)
    loadEbookOptions();
  });

})();

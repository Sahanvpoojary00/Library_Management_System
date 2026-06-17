const path = require('path');
const fs = require('fs');
const db = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Gemini Config & Helper ───────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API_KEY_MISSING: Gemini API key is missing or not configured in environment variables.');
  }
  return new GoogleGenerativeAI(apiKey);
}

// ── Helpers ──────────────────────────────────────────────────────────────────


/**
 * Split raw text into overlapping chunks (~500 words each, 50-word overlap).
 */
function chunkText(text, chunkWords = 500, overlapWords = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkWords).join(' ');
    if (chunk.trim().length > 20) chunks.push(chunk); // skip tiny remnants
    i += chunkWords - overlapWords;
  }
  return chunks;
}

/**
 * Build a marks-specific instruction string for Gemini.
 */
function marksInstruction(marks) {
  const formats = {
    2:  `Write a 2-mark university answer with:
- Definition (1-2 sentences)
- One key point`,
    5:  `Write a 5-mark university answer with:
- Definition
- Explanation (3-4 sentences)
- One relevant example`,
    10: `Write a 10-mark university answer with:
- Introduction
- Detailed Explanation
- Key Concepts (use sub-headings or bullet points)
- Real-world Applications
- Conclusion`,
    15: `Write a 15-mark university answer with:
- Detailed Introduction
- Core Explanation
- Working Principle / Mechanism
- Advantages
- Disadvantages
- Practical Applications
- Conclusion`
  };
  return formats[marks] || formats[10];
}

/**
 * Heuristically infer chapter from a text chunk.
 */
function inferChapter(chunkText) {
  // Look for patterns like "Chapter 1", "CHAPTER TWO", "Unit 3", section headings
  const patterns = [
    /chapter\s+\d+[:\s–-]?\s*([^\n]{0,60})/i,
    /unit\s+\d+[:\s–-]?\s*([^\n]{0,60})/i,
    /section\s+\d+[:\s–-]?\s*([^\n]{0,60})/i,
    /module\s+\d+[:\s–-]?\s*([^\n]{0,60})/i,
  ];
  for (const pattern of patterns) {
    const match = chunkText.match(pattern);
    if (match) return match[0].trim().slice(0, 80);
  }
  return 'Relevant Section';
}

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/ebooks/upload  (admin only)
 * Multer has already placed file at req.file.
 */
async function uploadEbook(req, res) {
  try {
    const { title, subject, allowDownload } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No PDF file provided.' });
    if (!title || !subject) return res.status(400).json({ error: 'Title and subject are required.' });

    const filePath = req.file.path.replace(/\\/g, '/'); // normalise for storage
    const isAllowDownload = allowDownload === 'false' || allowDownload === false || allowDownload === 0 || allowDownload === '0' ? 0 : 1;

    // 1. Persist ebook metadata (both ebooks and academic_resources)
    const [result] = await db.query(
      'INSERT INTO ebooks (title, subject, file_path, allow_download) VALUES (?, ?, ?, ?)',
      [title.trim(), subject.trim(), filePath, isAllowDownload]
    );
    const ebookId = result.insertId;

    await db.query(
      'INSERT INTO academic_resources (id, title, subject, file_path, allow_download) VALUES (?, ?, ?, ?, ?)',
      [ebookId, title.trim(), subject.trim(), filePath, isAllowDownload]
    );

    // 2. Extract text from PDF using pdf-parse v1.1.1 (simple function-based API)
    let extractedText = '';
    try {
      const pdfParse = require('pdf-parse');
      const fileBuffer = fs.readFileSync(req.file.path);
      const parsed = await pdfParse(fileBuffer);
      extractedText = parsed.text || '';
    } catch (pdfErr) {
      console.error('PDF parse error:', pdfErr.message);
      // Still keep the ebook record, just with 0 chunks
      return res.status(201).json({
        message: 'Ebook saved but PDF text could not be extracted. Ensure it is a text-based PDF.',
        ebookId,
        chunksCreated: 0
      });
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(201).json({
        message: 'Ebook saved but no readable text found. It may be a scanned/image PDF.',
        ebookId,
        chunksCreated: 0
      });
    }

    // 3. Chunk the text
    const chunks = chunkText(extractedText);

    // 4. Persist chunks in batch (grouped inserts)
    if (chunks.length > 0) {
      const chunkValues = chunks.map((text, idx) => [ebookId, text, idx]);
      await db.query(
        'INSERT INTO ebook_chunks (ebook_id, chunk_text, chunk_index) VALUES ?',
        [chunkValues]
      );
    }

    res.status(201).json({
      message: `"${title}" uploaded and processed successfully.`,
      ebookId,
      chunksCreated: chunks.length
    });
  } catch (err) {
    console.error('uploadEbook error:', err);
    res.status(500).json({ error: 'Failed to upload ebook. ' + err.message });
  }
}

/**
 * GET /api/ebooks  (authenticated)
 */
async function listEbooks(req, res) {
  try {
    const [ebooks] = await db.query(`
      SELECT e.id, e.title, e.subject, e.file_path, e.allow_download, e.uploaded_at,
             COUNT(ec.id) AS chunk_count
      FROM ebooks e
      LEFT JOIN ebook_chunks ec ON ec.ebook_id = e.id
      GROUP BY e.id
      ORDER BY e.uploaded_at DESC
    `);
    res.json(ebooks);
  } catch (err) {
    console.error('listEbooks error:', err);
    res.status(500).json({ error: 'Failed to fetch ebooks.' });
  }
}

/**
 * DELETE /api/ebooks/:id  (admin only)
 */
async function deleteEbook(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM ebooks WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ebook not found.' });

    const ebook = rows[0];

    // Delete physical file
    if (fs.existsSync(ebook.file_path)) {
      fs.unlinkSync(ebook.file_path);
    }

    // Cascade delete chunks then record
    await db.query('DELETE FROM ebook_chunks WHERE ebook_id = ?', [id]);
    await db.query('DELETE FROM ebooks WHERE id = ?', [id]);
    await db.query('DELETE FROM academic_resources WHERE id = ?', [id]);

    res.json({ message: `"${ebook.title}" deleted successfully.` });
  } catch (err) {
    console.error('deleteEbook error:', err);
    res.status(500).json({ error: 'Failed to delete ebook.' });
  }
}

/**
 * PATCH /api/ebooks/:id  (admin only)
 */
async function updateEbook(req, res) {
  try {
    const { id } = req.params;
    const { title, subject, allowDownload } = req.body;
    if (!title || !subject) return res.status(400).json({ error: 'Title and subject are required.' });

    const [rows] = await db.query('SELECT * FROM ebooks WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ebook not found.' });

    const isAllowDownload = allowDownload === 'false' || allowDownload === false || allowDownload === 0 || allowDownload === '0' ? 0 : 1;

    await db.query('UPDATE ebooks SET title = ?, subject = ?, allow_download = ? WHERE id = ?', [title.trim(), subject.trim(), isAllowDownload, id]);
    await db.query('UPDATE academic_resources SET title = ?, subject = ?, allow_download = ? WHERE id = ?', [title.trim(), subject.trim(), isAllowDownload, id]);
    res.json({ message: 'Ebook updated successfully.' });
  } catch (err) {
    console.error('updateEbook error:', err);
    res.status(500).json({ error: 'Failed to update ebook. ' + err.message });
  }
}

/**
 * POST /api/ebooks/ask  (student only)
 * Body: { question, marks, useGeminiOnly, ebookId }
 */
async function askQuestion(req, res) {
  try {
    const { question, marks, useGeminiOnly, ebookId } = req.body;
    const userId = req.user.id;

    if (!question || !question.trim()) return res.status(400).json({ error: 'Question is required.' });
    const marksNum = parseInt(marks) || 10;
    if (![2, 5, 10, 15].includes(marksNum)) return res.status(400).json({ error: 'Marks must be 2, 5, 10, or 15.' });

    let answer = '';
    let sourceType = 'GEMINI';
    let sourcePdfName = null;
    let responseSource = null;

    // 1. If not forcing Gemini, try PDF Search (RAG)
    if (!useGeminiOnly) {
      // Build the ebook scope filter
      const ebookIdNum = ebookId ? parseInt(ebookId) : null;
      const ebookFilter = ebookIdNum ? 'AND e.id = ?' : '';

      // Check if any ebooks exist in scope
      const countParams = ebookIdNum ? [ebookIdNum] : [];
      const [ebookCount] = await db.query(
        `SELECT COUNT(*) as cnt FROM ebooks${ebookIdNum ? ' WHERE id = ?' : ''}`,
        countParams
      );
      if (ebookCount[0].cnt > 0) {
        // FULLTEXT search for relevant chunks
        let chunks = [];
        try {
          const ftParams = ebookIdNum
            ? [question, question, ebookIdNum]
            : [question, question];
          const [results] = await db.query(`
            SELECT ec.chunk_text, ec.chunk_index, e.title AS book_title, e.subject,
                   MATCH(ec.chunk_text) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance_score
            FROM ebook_chunks ec
            JOIN ebooks e ON e.id = ec.ebook_id
            WHERE MATCH(ec.chunk_text) AGAINST(? IN NATURAL LANGUAGE MODE) ${ebookFilter}
            ORDER BY relevance_score DESC
            LIMIT 5
          `, ftParams);
          chunks = results;
        } catch (searchErr) {
          console.error('FULLTEXT search error:', searchErr.message);
        }

        // Fallback: LIKE search if FULLTEXT yields nothing
        if (chunks.length === 0) {
          const keywords = question.split(/\s+/).filter(w => w.length > 3).slice(0, 4);
          if (keywords.length > 0) {
            const likeClauses = keywords.map(() => 'ec.chunk_text LIKE ?').join(' OR ');
            const likeParams = keywords.map(k => `%${k}%`);
            if (ebookIdNum) likeParams.push(ebookIdNum);
            const [fallback] = await db.query(`
              SELECT ec.chunk_text, ec.chunk_index, e.title AS book_title, e.subject
              FROM ebook_chunks ec
              JOIN ebooks e ON e.id = ec.ebook_id
              WHERE (${likeClauses}) ${ebookFilter}
              LIMIT 5
            `, likeParams);
            chunks = fallback;
          }
        }

        // If we found relevant textbook excerpts, perform RAG
        if (chunks.length > 0) {
          sourceType = 'PDF';
          sourcePdfName = chunks[0].book_title;
          const context = chunks
            .map((c, i) => `[Excerpt ${i + 1} from "${c.book_title}" — ${c.subject}]\n${c.chunk_text}`)
            .join('\n\n---\n\n');

          const sourceChapter = inferChapter(chunks[0].chunk_text);
          const approxStartPage = Math.max(1, chunks[0].chunk_index * 2);
          const approxEndPage = approxStartPage + 3;

          responseSource = {
            book: sourcePdfName,
            chapter: sourceChapter,
            pages: `${approxStartPage}–${approxEndPage}`,
            subject: chunks[0].subject
          };

          const systemInstruction = `You are the Smart Library & Academic Assistant, a university academic assistant for exam preparation.
You MUST answer ONLY using the provided textbook excerpts below.
Do NOT use any outside knowledge, internet information, or general facts not present in these excerpts.
If the answer cannot be found in the excerpts, say: "This topic is not covered in the uploaded textbook material."
Always write in formal university examination style.`;

          const fullPrompt = `${systemInstruction}

--- TEXTBOOK CONTENT (use ONLY this for your answer) ---
${context}
--- END OF TEXTBOOK CONTENT ---

QUESTION: ${question}

${marksInstruction(marksNum)}

Format your answer clearly with proper headings, numbered points, or bullet points as appropriate for a ${marksNum}-mark university answer.`;

          console.log(`[Gemini Request] Sending RAG prompt. Model: ${GEMINI_MODEL}`);
          const model = getGenAI().getGenerativeModel({ model: GEMINI_MODEL });
          const result = await model.generateContent(fullPrompt);
          answer = result.response.text();
        }
      }
    }

    // 2. Fallback or Explicit General Knowledge Generation
    if (!answer) {
      sourceType = 'GEMINI';
      sourcePdfName = null;
      responseSource = {
        book: 'Gemini General Knowledge',
        chapter: 'Global Knowledge Base',
        pages: 'Web-Wide',
        subject: 'General AI Assistant'
      };

      const systemInstruction = `You are the Smart Library & Academic Assistant, a university academic assistant for exam preparation.
Explain the topic using general scientific and academic knowledge.
Always write in formal, structured, detailed university examination style.`;

      const fullPrompt = `${systemInstruction}

QUESTION: ${question}

${marksInstruction(marksNum)}

Format your answer clearly with proper headings, numbered points, or bullet points as appropriate for a ${marksNum}-mark university answer.`;

      console.log(`[Gemini Request] Sending general prompt. Model: ${GEMINI_MODEL}`);
      const model = getGenAI().getGenerativeModel({ model: GEMINI_MODEL });
      const result = await model.generateContent(fullPrompt);
      answer = result.response.text();
    }

    // 3. Persist the generated answer for history (both generated_answers AND academic_assistant_history)
    await db.query(
      `INSERT INTO generated_answers (user_id, question, answer, marks, source_book, source_chapter)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, question, answer, marksNum, responseSource.book, responseSource.chapter]
    );

    await db.query(
      `INSERT INTO academic_assistant_history (user_id, question, answer, marks_requested, source_type, source_pdf)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, question, answer, marksNum, sourceType, sourcePdfName]
    );

    res.json({
      answer,
      source: responseSource
    });
  } catch (err) {
    console.error('askQuestion error:', err);
    const errMsg = err.message || '';
    if (errMsg.includes('API_KEY_MISSING')) {
      return res.status(500).json({ error: 'Gemini API key is missing. Please set GEMINI_API_KEY in the environment configuration.' });
    }
    if (errMsg.includes('API_KEY') || errMsg.includes('API key') || errMsg.includes('unauthorized') || errMsg.includes('invalid')) {
      return res.status(500).json({ error: 'Gemini API key is invalid or not found. Please verify your API key.' });
    }
    if (errMsg.includes('model not found') || errMsg.includes('not found') || errMsg.includes('404')) {
      return res.status(500).json({ error: `The selected Gemini model (${GEMINI_MODEL}) was not found or is deprecated: ${err.message}` });
    }
    res.status(500).json({ error: 'Failed to generate answer: ' + errMsg });
  }
}

/**
 * GET /api/ebooks/history  (student only, with filters & search)
 */
async function getAnswerHistory(req, res) {
  try {
    const userId = req.user.id;
    const { search, date, source, pdf } = req.query;

    let sql = `SELECT id, question, answer, marks_requested, source_type, source_pdf, created_at
               FROM academic_assistant_history
               WHERE user_id = ?`;
    const params = [userId];

    if (search && search.trim()) {
      sql += ` AND (question LIKE ? OR answer LIKE ? OR source_pdf LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    if (date && date.trim()) {
      if (date === 'today') {
        sql += ` AND DATE(created_at) = CURDATE()`;
      } else {
        sql += ` AND DATE(created_at) = DATE(?)`;
        params.push(date);
      }
    }

    if (source && source.trim()) {
      sql += ` AND source_type = ?`;
      params.push(source.toUpperCase());
    }

    if (pdf && pdf.trim()) {
      sql += ` AND source_pdf = ?`;
      params.push(pdf);
    }

    sql += ` ORDER BY created_at DESC`;

    const [history] = await db.query(sql, params);
    res.json(history);
  } catch (err) {
    console.error('getAnswerHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch answer history.' });
  }
}

/**
 * DELETE /api/ebooks/history/:id (student only)
 */
async function deleteHistoryEntry(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [result] = await db.query(
      `DELETE FROM academic_assistant_history WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'History entry not found.' });
    }

    res.json({ message: 'History entry deleted successfully.' });
  } catch (err) {
    console.error('deleteHistoryEntry error:', err);
    res.status(500).json({ error: 'Failed to delete history entry.' });
  }
}

/**
 * DELETE /api/ebooks/history (student only)
 */
async function clearAllHistory(req, res) {
  try {
    const userId = req.user.id;
    await db.query(
      `DELETE FROM academic_assistant_history WHERE user_id = ?`,
      [userId]
    );
    res.json({ message: 'All academic assistant history cleared successfully.' });
  } catch (err) {
    console.error('clearAllHistory error:', err);
    res.status(500).json({ error: 'Failed to clear history.' });
  }
}

/**
 * GET /api/ebooks/analytics (student only)
 */
async function getHistoryAnalytics(req, res) {
  try {
    const userId = req.user.id;

    // Total questions asked
    const [totalCount] = await db.query(
      `SELECT COUNT(*) as count FROM academic_assistant_history WHERE user_id = ?`,
      [userId]
    );

    // Questions this week (last 7 days)
    const [weekCount] = await db.query(
      `SELECT COUNT(*) as count FROM academic_assistant_history 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId]
    );

    // Most used PDF
    const [mostUsedPdf] = await db.query(
      `SELECT source_pdf, COUNT(*) as count 
       FROM academic_assistant_history 
       WHERE user_id = ? AND source_type = 'PDF' AND source_pdf IS NOT NULL
       GROUP BY source_pdf 
       ORDER BY count DESC 
       LIMIT 1`,
      [userId]
    );

    // Most studied subject / PDF categories
    const [mostStudiedSub] = await db.query(
      `SELECT e.subject, COUNT(*) as count 
       FROM academic_assistant_history h
       JOIN ebooks e ON h.source_pdf = e.title
       WHERE h.user_id = ?
       GROUP BY e.subject 
       ORDER BY count DESC 
       LIMIT 1`,
      [userId]
    );

    // Last question asked
    const [lastQuestion] = await db.query(
      `SELECT question, created_at FROM academic_assistant_history 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    // Average questions per day
    const [daysActive] = await db.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) as days FROM academic_assistant_history WHERE user_id = ?`,
      [userId]
    );

    const total = totalCount[0].count;
    const days = daysActive[0].days || 1;
    const avgPerDay = (total / days).toFixed(1);

    res.json({
      totalQuestions: total,
      questionsThisWeek: weekCount[0].count,
      mostUsedPdf: mostUsedPdf[0] ? mostUsedPdf[0].source_pdf : 'None',
      mostStudiedSubject: mostStudiedSub[0] ? mostStudiedSub[0].subject : 'General',
      lastQuestion: lastQuestion[0] ? lastQuestion[0].question : 'None',
      avgQuestionsPerDay: parseFloat(avgPerDay)
    });
  } catch (err) {
    console.error('getHistoryAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch history analytics.' });
  }
}

async function viewEbookPdf(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT file_path FROM ebooks WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ebook not found.' });

    const ebook = rows[0];
    const absolutePath = path.resolve(ebook.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'PDF file not found on disk.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(absolutePath).pipe(res);
  } catch (err) {
    console.error('viewEbookPdf error:', err);
    res.status(500).json({ error: 'Failed to stream PDF. ' + err.message });
  }
}

async function downloadEbookPdf(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT title, file_path, allow_download FROM ebooks WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ebook not found.' });

    const ebook = rows[0];
    if (!ebook.allow_download) {
      return res.status(403).json({ error: 'Download not permitted by administrator.' });
    }

    const absolutePath = path.resolve(ebook.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'PDF file not found on disk.' });
    }
    res.download(absolutePath, `${ebook.title}.pdf`);
  } catch (err) {
    console.error('downloadEbookPdf error:', err);
    res.status(500).json({ error: 'Failed to download PDF. ' + err.message });
  }
}

module.exports = {
  uploadEbook,
  listEbooks,
  deleteEbook,
  updateEbook,
  askQuestion,
  getAnswerHistory,
  deleteHistoryEntry,
  clearAllHistory,
  getHistoryAnalytics,
  viewEbookPdf,
  downloadEbookPdf
};

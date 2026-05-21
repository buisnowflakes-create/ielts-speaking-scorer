/* ================================================================
   app.js — IELTS Speaking Scorer
   Toàn bộ logic: render, scoring, IPA, generate, export, draft
   Depends on: data.js (PRESETS, ENC_LIST, IPA_DICT)
   ================================================================ */

/* ================================================================
   KHỞI TẠO
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hv-date').value = todayISO();
  renderAllLists();
  restoreAutoSave();          // khôi phục bài đang làm dở (nếu có)
  initAI();

  // Tự động lưu mọi thay đổi vào trình duyệt — F5 / đóng tab không mất dữ liệu
  document.addEventListener('input',  scheduleAutoSave);
  document.addEventListener('change', scheduleAutoSave);
  window.addEventListener('beforeunload', autoSave);
});

/* Đóng modal đang mở khi bấm phím Esc */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show')
      .forEach(m => m.classList.remove('show'));
  }
});

/* ================================================================
   RENDER CHECKLIST
   Đọc từ PRESETS (data.js) và tạo DOM cho từng nhận xét.
   ================================================================ */
function renderAllLists() {
  Object.keys(PRESETS).forEach(key => renderList(key));
}

function renderList(key) {
  const container = document.querySelector(`[data-list="${key}"]`);
  if (!container) return;
  container.innerHTML = '';

  const isGood = key.endsWith('-good');

  PRESETS[key].forEach((item, idx) => {
    const label = document.createElement('label');
    label.className   = 'check-item';
    label.htmlFor     = `${key}-${idx}`;
    label.dataset.key = key;
    label.dataset.idx = idx;

    // Tách label khỏi nội dung để hiển thị đẹp hơn
    const bodyText = item.t.replace(item.l + ': ', '').replace(item.l + ':', '');

    label.innerHTML = `
      <input type="checkbox" id="${key}-${idx}"
             data-key="${key}" data-idx="${idx}" />
      <div class="it">
        <b>${esc(item.l)}:</b> ${esc(bodyText)}
      </div>
    `;

    label.querySelector('input').addEventListener('change', e => {
      label.classList.toggle(isGood ? 'chk-good' : 'chk-bad', e.target.checked);
    });

    container.appendChild(label);
  });
}

/* ================================================================
   ERROR ROWS (Lỗi từ vựng / ngữ pháp)
   ================================================================ */

/**
 * Thêm 1 dòng lỗi vào container
 * @param {string} containerId - 'lr-errors' hoặc 'gra-errors'
 * @param {string} wrong       - câu/cụm sai (mặc định rỗng)
 * @param {string} right       - câu/cụm đúng (mặc định rỗng)
 * @param {string} note        - ghi chú/giải thích (mặc định rỗng)
 */
function addErrRow(containerId, wrong = '', right = '', note = '') {
  const cont = document.getElementById(containerId);
  const wrap = document.createElement('div');

  wrap.innerHTML = `
    <div class="err-row">
      <textarea rows="2" placeholder="Câu/cụm sai"
                data-role="wrong">${esc(wrong)}</textarea>
      <div class="err-arr">→</div>
      <textarea rows="2" placeholder="Sửa lại"
                data-role="right">${esc(right)}</textarea>
      <button class="btn-ai-mini" onclick="aiFixRow(this)"
              title="AI gợi ý phần sửa cho câu sai">✨</button>
      <button class="btn-mini"
              onclick="this.closest('.err-row').parentElement.remove()"
              title="Xoá">✕</button>
    </div>
    <div class="err-note">
      <textarea rows="2"
                placeholder="Giải thích / ghi chú (không bắt buộc)"
                data-role="note">${esc(note)}</textarea>
    </div>
  `;

  cont.appendChild(wrap);
}

/**
 * Thu thập tất cả error rows trong 1 container
 * @returns {Array<{wrong, right, note}>}
 */
function getErrRows(containerId) {
  const rows = [];
  document.querySelectorAll(`#${containerId} .err-row`).forEach(row => {
    const wrong  = row.querySelector('[data-role="wrong"]').value.trim();
    const right  = row.querySelector('[data-role="right"]').value.trim();
    const noteEl = row.parentElement?.querySelector('[data-role="note"]');
    const note   = noteEl ? noteEl.value.trim() : '';
    if (wrong || right) rows.push({ wrong, right, note });
  });
  return rows;
}

/**
 * Render danh sách lỗi thành các <li> cho feedback.
 * Hỗ trợ ô lỗi NHIỀU DÒNG: mỗi dòng "sai" ghép với dòng "sửa" cùng vị trí
 * thành 1 bullet riêng; ghi chú gắn vào bullet cuối của lỗi đó.
 * @param {Array<{wrong,right,note}>} errs
 * @returns {string} HTML
 */
function renderErrItems(errs) {
  let html = '';
  errs.forEach(e => {
    const wLines = String(e.wrong || '').split('\n').map(s => s.trim());
    const rLines = String(e.right || '').split('\n').map(s => s.trim());
    const n = Math.max(wLines.length, rLines.length, 1);

    // Ghép từng dòng sai → dòng sửa cùng vị trí
    const pairs = [];
    for (let i = 0; i < n; i++) {
      const w = wLines[i] || '';
      const r = rLines[i] || '';
      if (w || r) pairs.push({ w, r });
    }

    pairs.forEach((p, i) => {
      html += '<li>';
      if (p.w) html += `<span class="fb-err-mark">${esc(p.w)}</span> → `;
      html += `<span class="fb-fix-mark">${esc(p.r)}</span>`;
      // Ghi chú gắn vào bullet cuối cùng của lỗi này
      if (e.note && i === pairs.length - 1) {
        html += `<br/><span class="fb-note">(${esc(e.note).replace(/\n/g, '<br/>')})</span>`;
      }
      html += '</li>';
    });
  });
  return html;
}

/* ================================================================
   IPA LOOKUP
   Tra từ điển local trước (IPA_DICT), sau đó gọi API nếu không có.
   ================================================================ */

/** Tra IPA cho tất cả từ trong textarea p-words */
async function fetchIPA() {
  const raw = document.getElementById('p-words').value.trim();
  if (!raw) { toast('Chưa nhập từ nào.'); return; }

  const words = raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const status = document.getElementById('ipa-st');
  status.textContent = `Đang tra ${words.length} từ...`;
  document.getElementById('p-tags').innerHTML = '';

  for (const w of words) {
    const ipa = await lookupIPA(w);
    addWordTag(w, ipa);
  }

  status.textContent = `✓ Đã tra ${words.length} từ`;
  setTimeout(() => status.textContent = '', 4000);
}

/**
 * Tra IPA cho 1 từ
 * Ưu tiên: IPA_DICT → dictionaryapi.dev → '/?/'
 */
async function lookupIPA(word) {
  const clean = word.toLowerCase().replace(/[^a-z']/g, '');

  // 1. Local dictionary
  if (IPA_DICT[clean]) return IPA_DICT[clean];

  // 2. Online API (free, không cần key)
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`
    );
    if (res.ok) {
      const data = await res.json();
      for (const entry of (Array.isArray(data) ? data : [])) {
        for (const p of (entry.phonetics || [])) {
          if (p.text?.trim()) return p.text.trim();
        }
        if (entry.phonetic) return entry.phonetic;
      }
    }
  } catch (e) { /* ignore network errors */ }

  return '/?/';
}

/** Thêm 1 word tag vào #p-tags */
function addWordTag(word, ipa) {
  const tags = document.getElementById('p-tags');
  const span = document.createElement('span');
  span.className    = 'word-tag';
  span.dataset.word = word;
  span.dataset.ipa  = ipa || '';
  span.innerHTML = `
    <b>${esc(word)}</b>
    <span class="ipa">${esc(ipa || '/?/')}</span>
    <a class="ox-link" href="${escAttr(oxfordURL(word))}" target="_blank" rel="noopener"
       title="Tra trên Oxford Learner's Dictionary">📖</a>
    <button onclick="this.parentElement.remove()" title="Xoá">✕</button>
  `;
  tags.appendChild(span);
}

/** Lấy danh sách từ phát âm + IPA từ tags hoặc textarea */
function getPronWords() {
  const tags = document.querySelectorAll('#p-tags .word-tag');
  if (tags.length) {
    return Array.from(tags).map(t => ({ word: t.dataset.word, ipa: t.dataset.ipa }));
  }
  // Fallback nếu chưa tra IPA
  const raw = document.getElementById('p-words').value.trim();
  return raw
    ? raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).map(w => ({ word: w, ipa: '' }))
    : [];
}

/* ================================================================
   TẠO FEEDBACK (generate)
   Xây dựng HTML feedback từ các checkbox đã tick + lỗi cụ thể
   ================================================================ */

/** Mã hoá object → chuỗi base64 URL-safe (dùng cho link luyện tập) */
function encodeData(obj) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Tạo URL trang luyện tập (practice.html cùng thư mục) kèm dữ liệu lỗi */
function practiceURL(payload) {
  const base = location.href.split('?')[0].split('#')[0]
    .replace(/[^/]*$/, 'practice.html');
  return base + '?d=' + encodeData(payload);
}

/** Rút gọn 1 URL qua dịch vụ miễn phí (is.gd → v.gd → tinyurl). Trả null nếu lỗi. */
async function shortenURL(longUrl) {
  const apis = [
    'https://is.gd/create.php?format=simple&url=',
    'https://v.gd/create.php?format=simple&url=',
    'https://tinyurl.com/api-create.php?url=',
  ];
  for (const api of apis) {
    try {
      const res = await fetch(api + encodeURIComponent(longUrl));
      if (!res.ok) continue;
      const txt = (await res.text()).trim();
      if (/^https?:\/\/\S+$/i.test(txt) && txt.length < longUrl.length) return txt;
    } catch (e) { /* thử dịch vụ kế tiếp */ }
  }
  return null;
}

/** Rút gọn link luyện tập rồi cập nhật vào feedback (chạy ngầm) */
async function shortenPracticeLink(longUrl) {
  const short   = await shortenURL(longUrl);
  const linkEl  = document.getElementById('fb-practice-a');
  const shortEl = document.getElementById('fb-shorturl');
  if (short) {
    if (linkEl)  linkEl.href = short;          // nút bấm trỏ tới link ngắn
    if (shortEl) shortEl.textContent = short;  // hiện link ngắn để gõ tay khi in giấy
    toast('✅ Link ngắn đã sẵn sàng — giờ có thể xuất PDF / tải .html.');
  } else if (shortEl) {
    shortEl.textContent = '(không tạo được link ngắn — em bấm vào nút ở trên nhé)';
  }
}

function generate() {
  const name    = document.getElementById('hv-name').value.trim() || 'em';
  const cls     = document.getElementById('hv-class').value.trim();
  const date    = fmtDate(document.getElementById('hv-date').value);
  const pronoun = document.getElementById('hv-pronoun').value;

  let html = '';

  /* ----- Header ----- */
  html += `
    <div class="fb-header">
      <div class="fb-title">Feedback IELTS Speaking</div>
      <div class="fb-meta">
        ${name ? `<b>${esc(name)}</b>` : ''}
        ${cls  ? ` · ${esc(cls)}`      : ''}
        ${date ? ` · ${esc(date)}`     : ''}
      </div>
    </div>
  `;

  /* ----- Lời chào ----- */
  html += `<p style="margin-bottom:7px">Hi <b>${esc(name)}</b>! Dưới đây là feedback chi tiết cho ${esc(pronoun)} nhé:</p>`;

  /* ----- 4 tiêu chí ----- */
  const CRIT_KEYS = [
    { id: 'fc',  label: 'FLUENCY & COHERENCE (Độ trôi chảy & mạch lạc)',    extra: 'fc-extra' },
    { id: 'lr',  label: 'LEXICAL RESOURCE (Từ vựng)',                         extra: null       },
    { id: 'gra', label: 'GRAMMATICAL RANGE & ACCURACY (Ngữ pháp)',           extra: null       },
    { id: 'p',   label: 'PRONUNCIATION (Phát âm)',                            extra: null       },
  ];

  CRIT_KEYS.forEach(({ id, label, extra }) => {
    html += `<div class="fb-section-title">${label}</div>`;

    // Lấy index đã check
    const goodIdx = [];
    const badIdx  = [];
    document.querySelectorAll(`input[data-key="${id}-good"]:checked`)
      .forEach(cb => goodIdx.push(parseInt(cb.dataset.idx)));
    document.querySelectorAll(`input[data-key="${id}-bad"]:checked`)
      .forEach(cb => badIdx.push(parseInt(cb.dataset.idx)));

    /* Điểm tốt */
    if (goodIdx.length) {
      html += `<div class="fb-good-title">✅ Điểm tốt:</div><ul class="fb-list">`;
      goodIdx.forEach(i => {
        const item = PRESETS[`${id}-good`][i];
        if (!item) return;
        const body = item.t.replace(item.l + ': ', '').replace(item.l + ':', '');
        html += `<li><b>${esc(item.l)}:</b> ${esc(body)}</li>`;
      });
      html += `</ul>`;
    }

    /* Cần cải thiện */
    if (badIdx.length) {
      html += `<div class="fb-bad-title">⚠ Cần cải thiện:</div><ul class="fb-list">`;
      badIdx.forEach(i => {
        const item = PRESETS[`${id}-bad`][i];
        if (!item) return;
        const body = item.t.replace(item.l + ': ', '').replace(item.l + ':', '');
        html += `<li><b>${esc(item.l)}:</b> ${esc(body)}</li>`;
      });
      html += `</ul>`;
    }

    /* FC extra note */
    if (extra) {
      const exTxt = document.getElementById(extra)?.value.trim();
      if (exTxt) {
        html += `<ul class="fb-list">`;
        exTxt.split('\n').forEach(line => {
          const t = line.trim();
          if (t) html += `<li>${esc(t)}</li>`;
        });
        html += `</ul>`;
      }
    }

    /* LR: lỗi từ vựng cụ thể */
    if (id === 'lr') {
      const errs = getErrRows('lr-errors');
      if (errs.length) {
        html += `<div class="fb-bad-title">📝 Lỗi từ vựng / collocation:</div><ul class="fb-list">`;
        html += renderErrItems(errs);
        html += `</ul>`;
      }
    }

    /* GRA: lỗi ngữ pháp cụ thể */
    if (id === 'gra') {
      const errs = getErrRows('gra-errors');
      if (errs.length) {
        html += `<div class="fb-bad-title">📝 Lỗi ngữ pháp cụ thể:</div><ul class="fb-list">`;
        html += renderErrItems(errs);
        html += `</ul>`;
      }
    }

    /* P: từ phát âm + ghi chú khác */
    if (id === 'p') {
      const pWords = getPronWords();
      if (pWords.length) {
        html += `<div class="fb-bad-title">🔊 Từ cần luyện phát âm:</div><ul class="fb-list">`;
        pWords.forEach(w => {
          const hasIpa = w.ipa && w.ipa.trim() && w.ipa !== '/?/';
          html += `<li><a class="fb-word-link" href="${escAttr(oxfordURL(w.word))}"`
                +  ` target="_blank" rel="noopener" title="Tra Oxford Learner's Dictionary">`
                +  `<span class="fb-word-mark">${esc(w.word)}</span> 📖</a>`;
          if (hasIpa) html += ` → <span class="fb-ipa-mark">${esc(w.ipa)}</span>`;
          html += `</li>`;
        });
        html += `</ul>`;
      }

      const pExtra = document.getElementById('p-extra')?.value.trim();
      if (pExtra) {
        html += `<div class="fb-bad-title">📌 Ghi chú phát âm khác:</div><ul class="fb-list">`;
        pExtra.split('\n').forEach(line => {
          const t = line.trim();
          if (t) html += `<li>${esc(t)}</li>`;
        });
        html += `</ul>`;
      }
    }
  });

  /* ----- Link bài luyện tập cá nhân hoá -----
     Hiện khi có lỗi từ vựng / ngữ pháp / từ phát âm để học viên luyện lại. */
  let _practiceURL = '';
  {
    const _vErr = getErrRows('lr-errors');
    const _gErr = getErrRows('gra-errors');
    const _pW   = getPronWords();
    if (_vErr.length || _gErr.length || _pW.length) {
      const _payload = {
        n: name,
        d: date,
        v: _vErr.map(e => ({ w: e.wrong, r: e.right, x: e.note })),
        g: _gErr.map(e => ({ w: e.wrong, r: e.right, x: e.note })),
        p: _pW.map(w => ({ w: w.word, i: (w.ipa && w.ipa !== '/?/') ? w.ipa : '' })),
      };
      _practiceURL = practiceURL(_payload);
      html += `<div class="fb-practice-link">
        <div class="fb-practice-title">🎯 Bài luyện tập riêng cho ${esc(name)}</div>
        <div>Em bấm vào nút bên dưới — hoặc gõ link ngắn vào trình duyệt — để luyện lại các lỗi từ vựng / ngữ pháp đã sửa và nghe phát âm chuẩn các từ cần cải thiện nhé:</div>
        <a class="fb-practice-btn" id="fb-practice-a" href=" PURL " target="_blank" rel="noopener">👉 Click vào đây để luyện nói</a>
        <div class="fb-practice-short">🔗 Link ngắn (gõ vào trình duyệt): <b id="fb-shorturl">⏳ đang tạo link ngắn…</b></div>
      </div>`;
    }
  }

  /* ----- Câu động viên ----- */
  const enc = document.getElementById('encourage').value.trim();
  if (enc) {
    html += `<div class="fb-encourage">${esc(enc).replace(/\n/g, '<br/>')}</div>`;
  }

  /* ----- Áp dụng xưng hô ----- */
  if (pronoun && pronoun !== 'em') {
    const cap = pronoun[0].toUpperCase() + pronoun.slice(1);
    // Chỉ thay ở text nodes (an toàn hơn replaceAll trên raw HTML)
    html = html
      .replace(/\bEm\b/g, cap)
      .replace(/\bem\b/g, pronoun);
  }

  /* Chèn URL luyện tập SAU khi thay xưng hô — tránh làm hỏng chuỗi base64 */
  if (_practiceURL) {
    html = html.split(' PURL ').join(escAttr(_practiceURL));
  }

  document.getElementById('preview').innerHTML = html;
  toast('✅ Đã tạo feedback thành công!');

  // Rút gọn link luyện tập (chạy ngầm) — để in giấy học viên gõ tay được
  if (_practiceURL) shortenPracticeLink(_practiceURL);
}

/* ================================================================
   COPY / EXPORT
   ================================================================ */

/** Copy feedback có định dạng (HTML + fallback text) vào clipboard */
function copyHTML() {
  const el = document.getElementById('preview');
  if (el.querySelector('.empty-state')) { toast('Chưa có feedback.'); return; }

  const blob = new Blob([el.innerHTML], { type: 'text/html' });
  const data = [
    new ClipboardItem({
      'text/html':  blob,
      'text/plain': new Blob([el.innerText], { type: 'text/plain' }),
    }),
  ];

  navigator.clipboard.write(data).then(
    () => toast('✅ Đã copy! Paste vào Zalo/Word/Email để giữ định dạng.'),
    () => {
      // Fallback: select + copy
      const r = document.createRange();
      r.selectNode(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();
      toast('✅ Đã copy!');
    }
  );
}

/** Tải feedback dưới dạng file .html (standalone, không cần server) */
function dlHTML() {
  const el = document.getElementById('preview');
  if (el.querySelector('.empty-state')) { toast('Hãy tạo feedback trước.'); return; }

  const name  = document.getElementById('hv-name').value.trim() || 'student';
  const fname = `Feedback_Speaking_${name.replace(/\s+/g, '_')}_${todayStr().replace(/\//g, '-')}.html`;

  // CSS nhúng vào file export (light theme, không cần dark mode)
  const exportCSS = `
    body { font-family: Arial, Helvetica, sans-serif; max-width: 780px; margin: 32px auto; padding: 0 20px; line-height: 1.7; color: #1f2937; }
    .fb-title      { font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 700; color: #9a0c23; }
    .fb-meta       { font-size: 12px; color: #6b7280; margin-top: 3px; font-family: Arial, Helvetica, sans-serif; }
    .fb-header     { border-bottom: 2px solid #ffd6dc; padding-bottom: 13px; margin-bottom: 15px; }
    .fb-section-title { font-family: Arial, Helvetica, sans-serif; font-size: 13.5px; font-weight: 700; color: #9a0c23; text-transform: uppercase; letter-spacing: .5px; border-bottom: 2px solid #ffd6dc; padding-bottom: 3px; margin: 18px 0 9px; }
    .fb-good-title { color: #15803d; font-size: 12px; font-weight: 700; margin: 9px 0 3px; }
    .fb-bad-title  { color: #b45309; font-size: 12px; font-weight: 700; margin: 9px 0 3px; }
    .fb-list       { padding-left: 17px; margin: 3px 0 7px; }
    .fb-list li    { margin-bottom: 3px; font-size: 13px; }
    .fb-err-mark   { color: #dc2626; text-decoration: line-through; background: #fee2e2; padding: 1px 4px; border-radius: 3px; font-size: 12.5px; }
    .fb-fix-mark   { color: #16a34a; background: #dcfce7; padding: 1px 4px; border-radius: 3px; font-weight: 600; font-size: 12.5px; }
    .fb-ipa-mark   { color: #c8102e; font-weight: 600; font-family: Arial, Helvetica, sans-serif; }
    .fb-word-mark  { background: #fef3c7; padding: 1px 4px; border-radius: 3px; font-weight: 600; font-size: 12.5px; }
    .fb-word-link  { text-decoration: none; color: inherit; }
    .fb-note       { color: #6b7280; font-style: italic; font-size: 12px; }
    .fb-encourage  { margin-top: 16px; padding: 12px 14px; background: #fff0f2; border-left: 4px solid #c8102e; border-radius: 6px; font-style: italic; color: #9a0c23; font-size: 13px; }
    .fb-practice-link  { margin-top: 16px; padding: 13px 15px; background: #eef2ff; border: 1px solid #c7d2fe; border-left: 4px solid #4f46e5; border-radius: 6px; font-size: 13px; color: #3730a3; }
    .fb-practice-title { font-weight: 700; margin-bottom: 3px; }
    .fb-practice-btn   { display: inline-block; margin-top: 9px; background: #eef2ff; color: #3730a3; border: 1.5px solid #4f46e5; text-decoration: none; font-weight: 700; padding: 9px 18px; border-radius: 8px; font-size: 12.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .fb-practice-short { margin-top: 9px; font-size: 12px; color: #3730a3; }
    .fb-practice-short b { font-size: 13px; color: #4338ca; word-break: break-all; }
  `;

  const doc = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Feedback Speaking – ${esc(name)}</title>
  <style>${exportCSS}</style>
</head>
<body>
  ${el.innerHTML}
</body>
</html>`;

  const blob = new Blob([doc], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('✅ Đã tải file .html!');
}

/* ---------- XUẤT PDF (xem trước → In / Tải về) ----------
   Dùng jsPDF + html2canvas, tải động từ CDN khi cần (lần đầu cần internet). */
let _pdfLibsLoaded = false;
let _pdfDoc     = null;            // jsPDF instance của lần xuất gần nhất
let _pdfBlobURL = '';              // blob URL để xem trước trong iframe
let _pdfName    = 'feedback.pdf';  // tên file khi tải về

/** Nạp 1 file script ngoài, trả Promise */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('không tải được thư viện'));
    document.head.appendChild(s);
  });
}

/** Bảo đảm jsPDF + html2canvas đã sẵn sàng */
async function ensurePdfLibs() {
  if (_pdfLibsLoaded) return;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  _pdfLibsLoaded = true;
}

/** Xuất feedback thành file PDF và tải về (1 bấm) */
async function dlPDF() {
  const el = document.getElementById('preview');
  if (el.querySelector('.empty-state')) { toast('Hãy tạo feedback trước.'); return; }

  // Nếu link ngắn đang tạo dở → nhắc chờ để PDF không lỡ chụp lúc "đang tạo"
  const shortEl = document.getElementById('fb-shorturl');
  if (shortEl && shortEl.textContent.includes('⏳')) {
    toast('⏳ Link ngắn đang tạo — đợi 1-2 giây rồi bấm Xuất PDF nhé.');
    return;
  }

  toast('🖨 Đang tạo PDF...');
  // Bỏ giới hạn chiều cao để chụp trọn nội dung
  const oldMaxH = el.style.maxHeight, oldOv = el.style.overflow;
  el.style.maxHeight = 'none';
  el.style.overflow  = 'visible';
  try {
    await ensurePdfLibs();
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    el.style.maxHeight = oldMaxH;
    el.style.overflow  = oldOv;

    const { jsPDF } = window.jspdf;
    const pdf    = new jsPDF('p', 'mm', 'a4');
    const margin = 10;
    const pageW  = pdf.internal.pageSize.getWidth();
    const pageH  = pdf.internal.pageSize.getHeight();
    const imgW   = pageW - margin * 2;
    const imgH   = canvas.height * imgW / canvas.width;
    const usableH = pageH - margin * 2;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    let heightLeft = imgH;
    let posY = margin;
    pdf.addImage(imgData, 'JPEG', margin, posY, imgW, imgH);
    heightLeft -= usableH;
    while (heightLeft > 0) {
      posY -= usableH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, posY, imgW, imgH);
      heightLeft -= usableH;
    }

    const name = document.getElementById('hv-name').value.trim() || 'student';
    _pdfDoc  = pdf;
    _pdfName = `Feedback_Speaking_${name.replace(/\s+/g, '_')}_${todayStr().replace(/\//g, '-')}.pdf`;
    if (_pdfBlobURL) URL.revokeObjectURL(_pdfBlobURL);
    _pdfBlobURL = pdf.output('bloburl');
    document.getElementById('pdf-frame').src = _pdfBlobURL;
    openModal('pdf-modal');
    toast('✅ PDF đã sẵn sàng — xem trước rồi bấm In / Tải về.');
  } catch (e) {
    el.style.maxHeight = oldMaxH;
    el.style.overflow  = oldOv;
    toast('❌ Không tạo được PDF (lần đầu cần internet để tải thư viện). '
        + 'Em thử lại, hoặc dùng nút "Tải .html".');
  }
}

/** Tải file PDF (đang xem trước) về máy */
function downloadPDF() {
  if (!_pdfDoc) { toast('Chưa có PDF — hãy tạo lại.'); return; }
  _pdfDoc.save(_pdfName);
  toast('✅ Đã tải file PDF về máy!');
}

/** In trực tiếp PDF đang xem trước */
function printPDF() {
  const fr = document.getElementById('pdf-frame');
  try {
    fr.contentWindow.focus();
    fr.contentWindow.print();
  } catch (e) {
    toast('Không in trực tiếp được — em bấm "Tải về máy" rồi mở file PDF để in.');
  }
}

/* ================================================================
   LƯU / MỞ NHÁP + TỰ ĐỘNG LƯU
   Dùng localStorage (bộ nhớ sẵn của trình duyệt) — KHÔNG cần server/DB.
   · DRAFT_KEY    : nháp do giáo viên chủ động lưu (nút "Lưu nháp")
   · AUTOSAVE_KEY : tự động lưu liên tục — F5 / đóng tab vẫn còn nguyên
   ================================================================ */
const DRAFT_KEY    = 'ielts_scorer_draft_v1';
const AUTOSAVE_KEY = 'ielts_scorer_autosave_v1';

/** Thu thập toàn bộ trạng thái form thành 1 object */
function collectState() {
  const checked = {};
  document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
    const k = cb.dataset.key;
    if (!k) return;
    (checked[k] = checked[k] || []).push(parseInt(cb.dataset.idx));
  });
  return {
    name:      document.getElementById('hv-name').value,
    cls:       document.getElementById('hv-class').value,
    date:      document.getElementById('hv-date').value,
    pronoun:   document.getElementById('hv-pronoun').value,
    fcExtra:   document.getElementById('fc-extra').value,
    pWords:    document.getElementById('p-words').value,
    pExtra:    document.getElementById('p-extra').value,
    encourage: document.getElementById('encourage').value,
    lrErrors:  getErrRows('lr-errors'),
    graErrors: getErrRows('gra-errors'),
    pTags:     Array.from(document.querySelectorAll('#p-tags .word-tag'))
                    .map(t => ({ word: t.dataset.word, ipa: t.dataset.ipa })),
    checked,
    previewHTML: document.getElementById('preview').innerHTML,
  };
}

/** Áp 1 object trạng thái lên form */
function applyState(d) {
  if (!d) return;
  document.getElementById('hv-name').value    = d.name    || '';
  document.getElementById('hv-class').value   = d.cls     || '';
  document.getElementById('hv-date').value    = d.date    || todayISO();
  document.getElementById('fc-extra').value   = d.fcExtra || '';
  document.getElementById('p-words').value    = d.pWords  || '';
  document.getElementById('p-extra').value    = d.pExtra  || '';
  document.getElementById('encourage').value  = d.encourage || ENC_LIST[0];
  if (d.pronoun) document.getElementById('hv-pronoun').value = d.pronoun;

  // Checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.closest('.check-item')?.classList.remove('chk-good', 'chk-bad');
  });
  Object.entries(d.checked || {}).forEach(([k, idxArr]) => {
    const isGood = k.endsWith('-good');
    idxArr.forEach(idx => {
      const cb = document.querySelector(`input[data-key="${k}"][data-idx="${idx}"]`);
      if (cb) {
        cb.checked = true;
        cb.closest('.check-item')?.classList.add(isGood ? 'chk-good' : 'chk-bad');
      }
    });
  });

  // Dòng lỗi LR / GRA
  document.getElementById('lr-errors').innerHTML  = '';
  document.getElementById('gra-errors').innerHTML = '';
  (d.lrErrors  || []).forEach(e => addErrRow('lr-errors',  e.wrong, e.right, e.note));
  (d.graErrors || []).forEach(e => addErrRow('gra-errors', e.wrong, e.right, e.note));

  // Word tags phát âm
  document.getElementById('p-tags').innerHTML = '';
  (d.pTags || []).forEach(t => addWordTag(t.word, t.ipa));

  // Khung feedback đã tạo
  if (typeof d.previewHTML === 'string' && d.previewHTML.trim()) {
    document.getElementById('preview').innerHTML = d.previewHTML;
  }
}

/** Lưu nháp — giáo viên chủ động bấm */
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(collectState()));
    toast('✅ Đã lưu nháp!');
  } catch (e) {
    toast('❌ Không lưu được: ' + e.message);
  }
}

/** Mở nháp đã lưu */
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) { toast('Chưa có nháp lưu.'); return; }
    applyState(JSON.parse(raw));
    toast('✅ Đã mở nháp!');
  } catch (e) {
    toast('❌ Lỗi khi mở nháp: ' + e.message);
  }
}

/* ---------- TỰ ĐỘNG LƯU (auto-save) ---------- */

/** Ghi trạng thái hiện tại vào localStorage — chạy ngầm, không báo */
function autoSave() {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(collectState()));
  } catch (e) { /* hết bộ nhớ — bỏ qua */ }
}

/** Lưu sau 0.6s kể từ thay đổi cuối (gộp nhiều lần gõ) */
let _autoSaveTimer;
function scheduleAutoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(autoSave, 600);
}

/** Khôi phục bài đang làm dở khi tải trang */
function restoreAutoSave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    applyState(d);
    const hasData = (d.name && d.name.trim())
      || Object.keys(d.checked || {}).length
      || (d.lrErrors || []).length || (d.graErrors || []).length
      || (d.pWords && d.pWords.trim()) || (d.pTags || []).length;
    if (hasData) toast('↩ Đã khôi phục bài đang làm dở.');
  } catch (e) { /* autosave hỏng — bỏ qua */ }
}

/** Reset toàn bộ form về trạng thái ban đầu */
function resetAll() {
  if (!confirm('Reset toàn bộ form về trạng thái ban đầu?')) return;

  // Clear checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    cb.closest('.check-item')?.classList.remove('chk-good', 'chk-bad');
  });

  // Clear text inputs
  ['hv-name', 'hv-class', 'fc-extra', 'p-words', 'p-extra'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Reset date, encouragement
  document.getElementById('hv-date').value    = todayISO();
  document.getElementById('encourage').value  = ENC_LIST[0];

  // Clear error rows & tags
  document.getElementById('lr-errors').innerHTML  = '';
  document.getElementById('gra-errors').innerHTML = '';
  document.getElementById('p-tags').innerHTML     = '';

  // Clear preview
  document.getElementById('preview').innerHTML = `
    <div class="empty-state">
      <div class="ei">✏️</div>
      Tích chọn nhận xét rồi bấm<br />
      <b>✨ Tạo Feedback</b>
    </div>
  `;

  toast('🔄 Đã reset!');
}

/* ================================================================
   ENCOURAGEMENT PRESETS
   ================================================================ */
function setEnc(i) {
  document.getElementById('encourage').value = ENC_LIST[i] || ENC_LIST[0];
}

/* ================================================================
   UTILITY HELPERS
   ================================================================ */

/** Ngày hôm nay dạng dd/mm/yyyy (vi-VN) — dùng cho tên file tải về */
function todayStr() {
  return new Date().toLocaleDateString('vi-VN');
}

/** Ngày hôm nay dạng yyyy-mm-dd — dùng cho <input type="date"> */
function todayISO() {
  const d  = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Đổi yyyy-mm-dd → dd/mm/yyyy để hiển thị (chuỗi khác giữ nguyên) */
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  return m ? `${+m[3]}/${+m[2]}/${m[1]}` : String(iso || '');
}

/** Escape HTML entities để tránh XSS */
function esc(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
}

/** Escape dùng trong attribute (thêm escape cho dấu nháy đơn) */
function escAttr(s) {
  return esc(s).replace(/'/g, '&#39;');
}

/** Hiển thị toast notification */
let _toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ================================================================
   TRỢ LÝ AI — Google Gemini
   3 tính năng: (1) sửa lỗi theo dòng, (2) quét lỗi từ transcript,
   (3) trau chuốt feedback. Phụ thuộc: AI_CONFIG, AI_SCHEMAS,
   AI_PROMPTS (định nghĩa trong data.js).
   ================================================================ */
const AI_KEY_LS   = 'ielts_ai_key';
const AI_MODEL_LS = 'ielts_ai_model';
let _scanCategory = 'vocab';   // 'vocab' | 'grammar' — mục tiêu modal quét lỗi

/** API key đang dùng: ưu tiên key nhập trong modal, sau đó key dán sẵn ở data.js */
function getAIKey() {
  const saved = (localStorage.getItem(AI_KEY_LS) || '').trim();
  return saved || (AI_CONFIG.apiKey || '').trim();
}

/** Model đang chọn (mặc định AI_CONFIG.defaultModel) */
function getAIModel() { return localStorage.getItem(AI_MODEL_LS) || AI_CONFIG.defaultModel; }

/** Khởi tạo phần AI — gọi 1 lần khi tải trang */
function initAI() {
  const sel = document.getElementById('ai-model');
  if (sel && !sel.options.length) {
    AI_CONFIG.models.forEach(m => {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      sel.appendChild(o);
    });
  }
  refreshAIBadge();
}

/** Cập nhật chấm trạng thái trên nút "Trợ lý AI" (xanh = đã có key) */
function refreshAIBadge() {
  document.getElementById('ai-btn')?.classList.toggle('ready', !!getAIKey());
}

/* ---------------- MODAL ---------------- */
function openModal(id)  { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

/** Mở modal cài đặt AI */
function openAIModal() {
  document.getElementById('ai-key').value   = getAIKey();
  document.getElementById('ai-model').value = getAIModel();
  document.getElementById('ai-test-st').textContent = '';
  openModal('ai-modal');
}

/** Lưu cài đặt AI từ modal vào localStorage */
function saveAISettings() {
  const key   = document.getElementById('ai-key').value.trim();
  const model = document.getElementById('ai-model').value;
  localStorage.setItem(AI_KEY_LS, key);
  localStorage.setItem(AI_MODEL_LS, model);
  refreshAIBadge();
  toast(key ? '✅ Đã lưu cài đặt Trợ lý AI!' : '✅ Đã lưu (chưa nhập API key).');
  closeModal('ai-modal');
}

/** Kiểm tra kết nối Gemini bằng key/model đang nhập trong modal */
async function aiTest(btn) {
  const key   = document.getElementById('ai-key').value.trim();
  const model = document.getElementById('ai-model').value;
  const st    = document.getElementById('ai-test-st');

  if (!key) {
    st.style.color = '#f87171';
    st.textContent = '⚠ Hãy nhập API key trước.';
    return;
  }

  // Lưu tạm để callGemini sử dụng
  localStorage.setItem(AI_KEY_LS, key);
  localStorage.setItem(AI_MODEL_LS, model);
  refreshAIBadge();

  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Đang kiểm tra...';
  st.textContent = '';
  try {
    await callGemini('Trả lời đúng một từ: OK', { temperature: 0 });
    st.style.color = '#4ade80';
    st.textContent = '✅ Kết nối thành công — Trợ lý AI đã sẵn sàng!';
  } catch (e) {
    st.style.color = '#f87171';
    st.textContent = '❌ ' + aiErr(e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/** Bảo đảm đã có API key; nếu chưa thì nhắc + mở modal */
function ensureAIKey() {
  if (getAIKey()) return true;
  toast('⚠ Chưa có API key — hãy mở "Trợ lý AI" để nhập.');
  openAIModal();
  return false;
}

/** Đổi lỗi kỹ thuật sang thông báo tiếng Việt dễ hiểu */
function aiErr(e) {
  const m = String((e && e.message) || e || '');
  if (m === 'NO_KEY')                                       return 'chưa nhập API key';
  if (/API_KEY_INVALID|api key not valid/i.test(m))         return 'API key không hợp lệ';
  if (/quota|RESOURCE_EXHAUSTED|\b429\b/i.test(m))          return 'đã hết hạn mức (quota) — thử lại sau';
  if (/not found|\b404\b/i.test(m))                         return 'model không khả dụng — thử đổi model khác';
  if (/failed to fetch|networkerror|load failed/i.test(m))  return 'không kết nối được — kiểm tra mạng';
  return m.slice(0, 140);
}

/**
 * Gọi Gemini API.
 * @param {string} prompt - nội dung prompt
 * @param {{json?:boolean, schema?:object, temperature?:number}} opts
 * @returns {Promise<string>} text trả về (đã trim)
 */
async function callGemini(prompt, opts = {}) {
  const key = getAIKey();
  if (!key) throw new Error('NO_KEY');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.4 },
  };
  if (opts.json) {
    body.generationConfig.responseMimeType = 'application/json';
    if (opts.schema) body.generationConfig.responseSchema = opts.schema;
  }

  const res = await fetch(
    `${AI_CONFIG.endpoint(getAIModel())}?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error && j.error.message) msg = j.error.message;
    } catch (e) { /* giữ msg mặc định */ }
    throw new Error(msg);
  }

  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  const text = ((cand && cand.content && cand.content.parts) || [])
    .map(p => p.text || '')
    .join('')
    .trim();

  if (!text) {
    const why = (cand && cand.finishReason)
      || (data && data.promptFeedback && data.promptFeedback.blockReason);
    throw new Error(why ? `bị chặn (${why})` : 'không có nội dung trả về');
  }
  return text;
}

/* ---------- TÍNH NĂNG 1: SỬA LỖI THEO DÒNG ----------
   Giáo viên gõ "Câu/cụm sai" → AI điền "Sửa lại" + ghi chú.        */
async function aiFixRow(btn) {
  if (!ensureAIKey()) return;

  const errRow  = btn.closest('.err-row');
  const wrap    = errRow.parentElement;
  const wrongEl = errRow.querySelector('[data-role="wrong"]');
  const rightEl = errRow.querySelector('[data-role="right"]');
  const noteEl  = wrap.querySelector('[data-role="note"]');

  const wrong = wrongEl.value.trim();
  if (!wrong) {
    toast('Hãy gõ câu/cụm sai trước nhé.');
    wrongEl.focus();
    return;
  }

  const cat = (wrap.parentElement && wrap.parentElement.id === 'gra-errors')
    ? 'grammar' : 'vocab';

  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  try {
    const txt = await callGemini(AI_PROMPTS.fixOne(cat, wrong), {
      json: true, schema: AI_SCHEMAS.fixOne, temperature: 0.3,
    });
    const obj = JSON.parse(txt);
    if (obj.right) rightEl.value = obj.right;
    if (obj.note)  noteEl.value  = obj.note;
    toast('✨ AI đã gợi ý phần sửa — kiểm tra lại nhé!');
  } catch (e) {
    toast('❌ AI lỗi: ' + aiErr(e));
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* ---------- TÍNH NĂNG 2: QUÉT LỖI TỪ TRANSCRIPT ---------- */

/** Mở modal quét lỗi cho 1 nhóm tiêu chí ('vocab' | 'grammar') */
function openScanModal(category) {
  _scanCategory = category === 'grammar' ? 'grammar' : 'vocab';
  const isGram = _scanCategory === 'grammar';
  document.getElementById('scan-title').textContent =
    isGram ? '✨ AI quét lỗi ngữ pháp' : '✨ AI quét lỗi từ vựng';
  document.getElementById('scan-hint').innerHTML = isGram
    ? 'AI sẽ đọc đoạn văn và tự thêm các lỗi <b>ngữ pháp</b> vào mục “Lỗi ngữ pháp cụ thể”.'
    : 'AI sẽ đọc đoạn văn và tự thêm các lỗi <b>từ vựng / collocation</b> vào mục “Lỗi từ vựng”.';
  openModal('scan-modal');
  document.getElementById('scan-text').focus();
}

/** Quét transcript → tự thêm các dòng lỗi vào danh sách tương ứng */
async function runScan(btn) {
  if (!ensureAIKey()) return;

  const text = document.getElementById('scan-text').value.trim();
  if (!text) {
    toast('Hãy dán đoạn học viên nói vào đã.');
    return;
  }

  const container = _scanCategory === 'grammar' ? 'gra-errors' : 'lr-errors';
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Đang quét...';
  try {
    const txt = await callGemini(AI_PROMPTS.scan(_scanCategory, text), {
      json: true, schema: AI_SCHEMAS.scan, temperature: 0.3,
    });
    const arr = JSON.parse(txt);
    if (!Array.isArray(arr) || !arr.length) {
      toast('✓ AI không tìm thấy lỗi nào đáng kể.');
    } else {
      arr.forEach(e => addErrRow(container, e.wrong || '', e.right || '', e.note || ''));
      toast(`✨ Đã thêm ${arr.length} lỗi — kiểm tra & chỉnh lại nhé!`);
      closeModal('scan-modal');
    }
  } catch (e) {
    toast('❌ AI lỗi: ' + aiErr(e));
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* ---------- TÍNH NĂNG 3: TRAU CHUỐT FEEDBACK ---------- */

/** Gửi feedback hiện tại cho AI viết lại mượt hơn (giữ nguyên HTML) */
async function aiPolish(btn) {
  if (!ensureAIKey()) return;

  const el = document.getElementById('preview');
  if (el.querySelector('.empty-state')) {
    toast('Hãy bấm “✨ Tạo Feedback” trước đã.');
    return;
  }

  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Đang trau chuốt...';
  try {
    let out = await callGemini(
      AI_PROMPTS.polish + '\n\nHTML cần viết lại:\n' + el.innerHTML,
      { temperature: 0.6 }
    );
    // Bỏ rào ```html nếu AI lỡ thêm
    out = out.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Kiểm tra cấu trúc còn nguyên vẹn trước khi áp dụng
    if (out[0] !== '<' || !/fb-section-title/.test(out)) {
      toast('❌ Kết quả AI không hợp lệ — giữ nguyên bản cũ.');
      return;
    }
    el.innerHTML = out;
    toast('✨ Đã trau chuốt! Kiểm tra lại rồi gửi nhé. (Bấm “Tạo Feedback” để về bản gốc)');
  } catch (e) {
    toast('❌ AI lỗi: ' + aiErr(e));
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* ---------- OXFORD LEARNER'S DICTIONARY ---------- */

/** Link tra cứu 1 từ trên Oxford Learner's Dictionary */
function oxfordURL(word) {
  const w = String(word == null ? '' : word).trim();
  return 'https://www.oxfordlearnersdictionaries.com/search/english/?q=' + encodeURIComponent(w);
}

/* ================================================================
   LỊCH SỬ HỌC VIÊN + TỔNG HỢP CẢ LỚP
   Lưu feedback từng học viên vào localStorage để xem lại và
   tổng hợp điểm toàn lớp.
   ================================================================ */
const HISTORY_LS = 'ielts_history_v1';

/** Đọc mảng lịch sử từ localStorage */
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_LS) || '[]'); }
  catch (e) { return []; }
}

/** Ghi mảng lịch sử vào localStorage */
function setHistory(arr) {
  localStorage.setItem(HISTORY_LS, JSON.stringify(arr));
}

/** Số nhận xét đã tick của 4 tiêu chí → { fc, lr, gra, p } (good + bad, không trừ) */
function getCritCounts() {
  const out = {};
  ['fc', 'lr', 'gra', 'p'].forEach(c => {
    const good = document.querySelectorAll(`input[data-key="${c}-good"]:checked`).length;
    const bad  = document.querySelectorAll(`input[data-key="${c}-bad"]:checked`).length;
    out[c] = good + bad;
  });
  return out;
}

/** Lưu feedback hiện tại vào lịch sử học viên */
function saveToHistory() {
  const name = document.getElementById('hv-name').value.trim();
  if (!name) {
    toast('⚠ Hãy nhập Tên học viên trước khi lưu vào lịch sử.');
    document.getElementById('hv-name').focus();
    return;
  }

  // Tạo feedback mới nhất để lưu kèm
  generate();
  const feedbackHTML = document.getElementById('preview').innerHTML;

  const rec = {
    id:       'h' + Date.now() + Math.random().toString(36).slice(2, 7),
    name:     name,
    cls:      document.getElementById('hv-class').value.trim(),
    date:     document.getElementById('hv-date').value.trim(),
    savedAt:  new Date().toISOString(),
    scores:   getCritCounts(),
    feedbackHTML: feedbackHTML,
  };

  const hist = getHistory();
  hist.push(rec);
  setHistory(hist);
  toast(`✅ Đã lưu feedback của "${name}" vào lịch sử!`);
}

/* ---------- XEM LỊCH SỬ ---------- */

/** Mở modal lịch sử */
function openHistory() {
  document.getElementById('history-search').value = '';
  renderHistory('');
  openModal('history-modal');
}

/** Render danh sách lịch sử, gom nhóm theo học viên, lọc theo tên */
function renderHistory(filter) {
  const box  = document.getElementById('history-body');
  const hist = getHistory();

  if (!hist.length) {
    box.innerHTML = '<div class="hist-empty">Chưa có feedback nào được lưu.<br/>'
                  + 'Chấm xong rồi bấm “📒 Lưu vào lịch sử HV” để lưu lại.</div>';
    return;
  }

  const fl     = (filter || '').trim().toLowerCase();
  const groups = {};
  hist.forEach(r => {
    if (fl && !(r.name || '').toLowerCase().includes(fl)) return;
    (groups[r.name] = groups[r.name] || []).push(r);
  });

  const names = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'vi'));
  if (!names.length) {
    box.innerHTML = '<div class="hist-empty">Không tìm thấy học viên nào khớp.</div>';
    return;
  }

  let html = '';
  names.forEach(nm => {
    const recs = groups[nm].slice()
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    html += `<div class="hist-group">
      <div class="hist-name">👤 ${esc(nm)} <span class="hist-count">${recs.length} bài</span></div>`;
    recs.forEach(r => {
      html += `<div class="hist-row">
        <div class="hist-meta">
          <b>${esc(fmtDate(r.date) || '—')}</b>${r.cls ? ' · ' + esc(r.cls) : ''}
          <span class="hist-sub">Nhận xét đã chọn: FC ${r.scores.fc} · LR ${r.scores.lr} · GRA ${r.scores.gra} · PRON ${r.scores.p}</span>
        </div>
        <div class="hist-actions">
          <button class="btn-mini" onclick="viewHistoryRecord('${r.id}')">👁 Xem</button>
          <button class="btn-mini" onclick="deleteHistoryRecord('${r.id}')">🗑 Xoá</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  box.innerHTML = html;
}

/** Mở lại 1 feedback đã lưu vào khung preview */
function viewHistoryRecord(id) {
  const rec = getHistory().find(r => r.id === id);
  if (!rec) { toast('Không tìm thấy bản ghi.'); return; }
  document.getElementById('preview').innerHTML = rec.feedbackHTML;
  closeModal('history-modal');
  toast(`📄 Đang xem feedback của "${rec.name}".`);
  document.getElementById('preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Xoá 1 bản ghi khỏi lịch sử */
function deleteHistoryRecord(id) {
  if (!confirm('Xoá bản ghi feedback này khỏi lịch sử?')) return;
  setHistory(getHistory().filter(r => r.id !== id));
  renderHistory(document.getElementById('history-search').value);
  toast('🗑 Đã xoá khỏi lịch sử.');
}

/* ---------- TỔNG HỢP CẢ LỚP ---------- */

/** Mở modal tổng hợp điểm cả lớp (lấy bài mới nhất của mỗi học viên) */
function openClassSummary() {
  const box  = document.getElementById('summary-body');
  const hist = getHistory();

  if (!hist.length) {
    box.innerHTML = '<div class="hist-empty">Chưa có dữ liệu.<br/>'
                  + 'Hãy lưu feedback học viên vào lịch sử trước.</div>';
    openModal('summary-modal');
    return;
  }

  // Lấy bài mới nhất của mỗi học viên
  const latest = {};
  hist.forEach(r => {
    if (!latest[r.name] || (r.savedAt || '') > (latest[r.name].savedAt || '')) {
      latest[r.name] = r;
    }
  });
  const rows = Object.values(latest).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  let body = '';
  rows.forEach(r => {
    body += `<tr>
      <td class="sum-name">${esc(r.name)}</td>
      <td>${esc(r.cls || '—')}</td>
      <td>${esc(fmtDate(r.date) || '—')}</td>
      <td>${r.scores.fc}</td><td>${r.scores.lr}</td>
      <td>${r.scores.gra}</td><td>${r.scores.p}</td>
    </tr>`;
  });

  box.innerHTML = `<table class="sum-table">
    <thead><tr>
      <th>Học viên</th><th>Lớp</th><th>Ngày</th>
      <th>FC</th><th>LR</th><th>GRA</th><th>PRON</th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td colspan="7">Tổng cộng · ${rows.length} học viên (số = nhận xét đã chọn)</td>
    </tr></tfoot>
  </table>`;
  openModal('summary-modal');
}

/* ================================================================
   NÚT CUỘN TRANG
   ================================================================ */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function scrollToBottom() {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
}

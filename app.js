/* ================================================================
   app.js — IELTS Speaking Scorer
   Toàn bộ logic: render, scoring, IPA, generate, export, draft
   Depends on: data.js (PRESETS, ENC_LIST, BAND_SCALE, IPA_DICT)
   ================================================================ */

/* ================================================================
   KHỞI TẠO
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hv-date').value = todayStr();
  renderAllLists();
  updateScores();
  initAI();
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
      <span class="pt-badge">${isGood ? '+1' : '-1'}</span>
    `;

    label.querySelector('input').addEventListener('change', e => {
      label.classList.toggle(isGood ? 'chk-good' : 'chk-bad', e.target.checked);
      updateScores();
    });

    container.appendChild(label);
  });
}

/* ================================================================
   CẬP NHẬT ĐIỂM (real-time)
   Công thức: điểm = (số good ticked) - (số bad ticked), min = 0
   ================================================================ */
let _totalPts = 0;
let _totalMax = 0;

function updateScores() {
  const crits = ['fc', 'lr', 'gra', 'p'];
  let grandTotal = 0;
  let grandMax   = 0;

  crits.forEach(c => {
    const goodChecked = document.querySelectorAll(`input[data-key="${c}-good"]:checked`).length;
    const badChecked  = document.querySelectorAll(`input[data-key="${c}-bad"]:checked`).length;
    const max         = PRESETS[`${c}-good`].length;
    const pts         = Math.max(0, goodChecked - badChecked);

    // --- Cập nhật badge điểm trên header từng tiêu chí ---
    document.getElementById(`${c}-cur`).textContent = pts;
    document.getElementById(`${c}-max`).textContent = max;

    grandTotal += pts;
    grandMax   += max;
  });

  // Cache cho generate()
  _totalPts = grandTotal;
  _totalMax = grandMax;
}

/* ================================================================
   BAND CALCULATION
   ================================================================ */
function calcBand(ratio) {
  if (_totalMax === 0) return null;
  for (const b of BAND_SCALE) {
    if (ratio >= b.min) return b.band;
  }
  return 2.0;
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
function generate() {
  const name    = document.getElementById('hv-name').value.trim() || 'em';
  const cls     = document.getElementById('hv-class').value.trim();
  const date    = document.getElementById('hv-date').value.trim();
  const part    = document.getElementById('hv-part').value;
  const pronoun = document.getElementById('hv-pronoun').value;

  // Band
  const ratio   = _totalMax > 0 ? _totalPts / _totalMax : 0;
  const band    = calcBand(ratio);
  const bandStr = band !== null ? band.toFixed(1) : 'N/A';

  let html = '';

  /* ----- Header ----- */
  html += `
    <div class="fb-header">
      <div class="fb-title">Feedback IELTS Speaking</div>
      <div class="fb-meta">
        ${name ? `<b>${esc(name)}</b>` : ''}
        ${cls  ? ` · ${esc(cls)}`      : ''}
        ${date ? ` · ${esc(date)}`     : ''}
        ${part ? ` · ${esc(part)}`     : ''}
      </div>
      <div style="margin-top:10px">
        <div class="fb-band-box">
          <div class="fb-band-num">${bandStr}</div>
          <div class="fb-band-label">Estimated Band Score</div>
        </div>
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

  document.getElementById('preview').innerHTML = html;
  toast('✅ Đã tạo feedback thành công!');
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
    .fb-band-box   { display: inline-flex; flex-direction: column; align-items: center; background: #fef9ec; border: 2px solid #d4a017; border-radius: 12px; padding: 8px 18px; margin-top: 10px; }
    .fb-band-num   { font-family: Arial, Helvetica, sans-serif; font-size: 36px; font-weight: 900; color: #b8860b; line-height: 1; }
    .fb-band-label { font-size: 10px; color: #8a6d00; font-weight: 600; text-transform: uppercase; letter-spacing: .8px; }
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

/**
 * Xuất PDF bằng print dialog của trình duyệt.
 * CSS @media print trong style.css đã ẩn form, chỉ in preview.
 * Người dùng chọn "Save as PDF" trong hộp thoại in.
 */
function dlPDF() {
  const el = document.getElementById('preview');
  if (el.querySelector('.empty-state')) { toast('Hãy tạo feedback trước.'); return; }
  toast('🖨 Đang mở hộp thoại in PDF...');
  setTimeout(() => window.print(), 400);
}

/* ================================================================
   LƯU / MỞ NHÁP
   Dùng localStorage để lưu trạng thái form.
   ================================================================ */
const DRAFT_KEY = 'ielts_scorer_draft_v1';

/** Lưu toàn bộ trạng thái form vào localStorage */
function saveDraft() {
  try {
    // Thu thập checkbox đã tích
    const checked = {};
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      const k = cb.dataset.key;
      if (!k) return;
      if (!checked[k]) checked[k] = [];
      checked[k].push(parseInt(cb.dataset.idx));
    });

    const draft = {
      name:     document.getElementById('hv-name').value,
      cls:      document.getElementById('hv-class').value,
      date:     document.getElementById('hv-date').value,
      part:     document.getElementById('hv-part').value,
      pronoun:  document.getElementById('hv-pronoun').value,
      fcExtra:  document.getElementById('fc-extra').value,
      pWords:   document.getElementById('p-words').value,
      pExtra:   document.getElementById('p-extra').value,
      encourage:document.getElementById('encourage').value,
      lrErrors: getErrRows('lr-errors'),
      graErrors:getErrRows('gra-errors'),
      pTags:    Array.from(document.querySelectorAll('#p-tags .word-tag'))
                     .map(t => ({ word: t.dataset.word, ipa: t.dataset.ipa })),
      checked,
    };

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    toast('✅ Đã lưu nháp!');
  } catch (e) {
    toast('❌ Không lưu được: ' + e.message);
  }
}

/** Khôi phục form từ nháp đã lưu */
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) { toast('Chưa có nháp lưu.'); return; }
    const d = JSON.parse(raw);

    // Thông tin học viên
    document.getElementById('hv-name').value    = d.name    || '';
    document.getElementById('hv-class').value   = d.cls     || '';
    document.getElementById('hv-date').value    = d.date    || todayStr();
    document.getElementById('fc-extra').value   = d.fcExtra || '';
    document.getElementById('p-words').value    = d.pWords  || '';
    document.getElementById('p-extra').value    = d.pExtra  || '';
    document.getElementById('encourage').value  = d.encourage || ENC_LIST[0];
    if (d.part)    document.getElementById('hv-part').value    = d.part;
    if (d.pronoun) document.getElementById('hv-pronoun').value = d.pronoun;

    // Khôi phục checkboxes
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

    // Khôi phục error rows
    document.getElementById('lr-errors').innerHTML  = '';
    document.getElementById('gra-errors').innerHTML = '';
    (d.lrErrors  || []).forEach(e => addErrRow('lr-errors',  e.wrong, e.right, e.note));
    (d.graErrors || []).forEach(e => addErrRow('gra-errors', e.wrong, e.right, e.note));

    // Khôi phục pronunciation tags
    document.getElementById('p-tags').innerHTML = '';
    (d.pTags || []).forEach(t => addWordTag(t.word, t.ipa));

    updateScores();
    toast('✅ Đã mở nháp!');
  } catch (e) {
    toast('❌ Lỗi khi mở nháp: ' + e.message);
  }
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
  document.getElementById('hv-date').value    = todayStr();
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

  updateScores();
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

/** Ngày hôm nay dạng dd/mm/yyyy (vi-VN) */
function todayStr() {
  return new Date().toLocaleDateString('vi-VN');
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
    if (out[0] !== '<' || !/fb-band-num/.test(out) || !/fb-section-title/.test(out)) {
      toast('❌ Kết quả AI không hợp lệ — giữ nguyên bản cũ.');
      return;
    }
    el.innerHTML = out;
    toast('✨ Đã trau chuốt! Soát lại điểm số rồi mới gửi. (Bấm “Tạo Feedback” để về bản gốc)');
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

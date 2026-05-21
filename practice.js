/* ================================================================
   practice.js — Trang luyện tập cá nhân hoá cho học viên
   Đọc dữ liệu lỗi (mã hoá base64) từ ?d= trên URL. Mỗi mục:
   nghe phát âm chuẩn (chọn nhiều giọng) → thu âm → nghe lại giọng
   mình → tạo báo cáo gửi thầy/cô. Chạy hoàn toàn trong trình duyệt.
   ================================================================ */
(function () {
  'use strict';

  /* ---------------- Helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function escAttr(s) { return esc(s).replace(/'/g, '&#39;'); }

  let _toastTimer;
  function toast(msg) {
    const t = document.getElementById('pr-toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  /* ---------------- Giải mã dữ liệu từ URL ---------------- */
  function decodeData(s) {
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '+');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }

  const content = document.getElementById('pr-content');
  const menuEl  = document.getElementById('pr-menu');

  let data = null;
  try {
    const d = new URLSearchParams(location.search).get('d');
    if (d) data = decodeData(d);
  } catch (e) {
    console.warn('Không giải mã được dữ liệu luyện tập:', e);
  }

  if (!data) {
    menuEl.style.display = 'none';
    content.innerHTML =
      '<div class="pr-card pr-empty">' +
      '<div class="pr-empty-ic">⚠️</div>' +
      '<h2>Link không hợp lệ</h2>' +
      '<p>Link bài luyện tập bị thiếu dữ liệu hoặc đã hỏng.<br/>' +
      'Em hãy nhờ thầy/cô gửi lại link mới nhé.</p></div>';
    return;
  }

  /* ---------------- Tách lỗi nhiều dòng thành từng cặp ---------------- */
  function splitPairs(w, r) {
    const wl = String(w || '').split('\n').map(s => s.trim());
    const rl = String(r || '').split('\n').map(s => s.trim());
    const n  = Math.max(wl.length, rl.length, 1);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = wl[i] || '', b = rl[i] || '';
      if (a || b) out.push({ w: a, r: b });
    }
    return out;
  }

  function oxfordURL(word) {
    return 'https://www.oxfordlearnersdictionaries.com/search/english/?q='
         + encodeURIComponent(String(word || '').trim());
  }

  /* ================================================================
     DANH SÁCH MỤC LUYỆN TẬP
     type: 'v' (từ vựng) | 'g' (ngữ pháp) | 'p' (phát âm)
     ================================================================ */
  const ALL = [];
  let uid = 0;
  (Array.isArray(data.v) ? data.v : []).forEach(e =>
    splitPairs(e.w, e.r).forEach(p =>
      ALL.push({ id: 'it' + (uid++), type: 'v', w: p.w, r: p.r, x: e.x })));
  (Array.isArray(data.g) ? data.g : []).forEach(e =>
    splitPairs(e.w, e.r).forEach(p =>
      ALL.push({ id: 'it' + (uid++), type: 'g', w: p.w, r: p.r, x: e.x })));
  (Array.isArray(data.p) ? data.p : []).forEach(w => {
    if (w && w.w) ALL.push({ id: 'it' + (uid++), type: 'p', word: w.w, ipa: w.i });
  });

  const recorded = new Set();   // id các mục đã thu âm

  /* ================================================================
     TEXT-TO-SPEECH + CHỌN GIỌNG
     ================================================================ */
  let VOICES = [];

  function voiceLabel(v) {
    const flag = /[-_]GB/i.test(v.lang) ? '🇬🇧 Anh–Anh (UK)'
               : /[-_]US/i.test(v.lang) ? '🇺🇸 Anh–Mỹ (US)'
               : /[-_]AU/i.test(v.lang) ? '🇦🇺 Anh–Úc (AU)'
               : /[-_]IN/i.test(v.lang) ? '🇮🇳 Anh–Ấn (IN)'
               : '🌐 ' + v.lang;
    return `${flag} — ${v.name}`;
  }

  function loadVoices() {
    if (!window.speechSynthesis) return;
    VOICES = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    populateVoiceSelect();
  }

  function populateVoiceSelect() {
    const sel = document.getElementById('pr-voice');
    if (!sel) return;
    if (!VOICES.length) {
      sel.innerHTML = '<option value="">(giọng mặc định của trình duyệt)</option>';
      return;
    }
    sel.innerHTML = VOICES.map((v, i) =>
      `<option value="${i}">${esc(voiceLabel(v))}</option>`).join('');
    // Khôi phục giọng đã lưu, nếu không có thì ưu tiên UK → US
    const saved = localStorage.getItem('pr_voice') || '';
    let idx = saved ? VOICES.findIndex(v => v.voiceURI === saved) : -1;
    if (idx < 0) idx = VOICES.findIndex(v => /[-_]GB/i.test(v.lang));
    if (idx < 0) idx = VOICES.findIndex(v => /[-_]US/i.test(v.lang));
    if (idx < 0) idx = 0;
    sel.value = String(idx);
  }

  function getSelectedVoice() {
    const sel = document.getElementById('pr-voice');
    if (!sel || !VOICES.length) return null;
    return VOICES[parseInt(sel.value, 10)] || VOICES[0] || null;
  }
  function getRate() {
    const sel = document.getElementById('pr-rate');
    return sel ? parseFloat(sel.value) : 0.85;
  }

  /** Đưa nút "Nghe phát âm chuẩn" về trạng thái ban đầu */
  function resetSpeakBtn(btn) {
    if (!btn) return;
    btn.classList.remove('speaking');
    btn.innerHTML = '🔊 Nghe phát âm chuẩn';
  }

  /** Dừng mọi giọng đọc mẫu đang phát + reset tất cả nút nghe */
  function stopSpeaking() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    document.querySelectorAll('.pr-listen.speaking').forEach(resetSpeakBtn);
  }

  function speak(text, btn) {
    if (!window.speechSynthesis) {
      toast('Trình duyệt không hỗ trợ phát âm — em mở bằng Chrome nhé.');
      return;
    }
    stopSpeaking();   // dừng giọng đang đọc (nếu có) trước khi đọc mục mới
    const u = new SpeechSynthesisUtterance(String(text || ''));
    const v = getSelectedVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
    u.rate = getRate();
    if (btn) {
      // Khi đang đọc, nút đổi thành "⏹ Dừng" — bấm lại để ngừng
      btn.classList.add('speaking');
      btn.innerHTML = '⏹ Dừng';
      u.onend = u.onerror = () => resetSpeakBtn(btn);
    }
    speechSynthesis.speak(u);
  }

  if (window.speechSynthesis) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  const CAN_RECORD = !!(navigator.mediaDevices
    && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  /* ================================================================
     DỰNG GIAO DIỆN
     ================================================================ */
  const SPEAK = [];   // text để đọc — tham chiếu theo index (tránh lỗi escape)

  function itemHTML(it, num) {
    let body = `<span class="pr-num">${num}</span>`;
    let speakText;
    let oxBtn = '';
    if (it.type === 'p') {
      body += `<span class="pr-word">${esc(it.word)}</span>`;
      if (it.ipa) body += `<span class="pr-ipa">${esc(it.ipa)}</span>`;
      speakText = it.word;
      oxBtn = `<a class="pr-btn pr-ox" href="${escAttr(oxfordURL(it.word))}"`
            + ` target="_blank" rel="noopener">📖 Oxford</a>`;
    } else {
      if (it.w) body += `<span class="pr-wrong">${esc(it.w)}</span>`
                      + `<span class="pr-arrow">→</span>`;
      body += `<span class="pr-right">${esc(it.r)}</span>`;
      if (it.x) body += `<div class="pr-note">💡 ${esc(it.x)}</div>`;
      speakText = it.r;
    }
    const si = SPEAK.push(speakText) - 1;
    return `<div class="pr-item" id="${it.id}">
      <div class="pr-body">${body}</div>
      <div class="pr-actions">
        <button class="pr-btn pr-listen" onclick="prSpeak(this,${si})">🔊 Nghe phát âm chuẩn</button>
        <button class="pr-btn pr-rec" onclick="prRecord(this,'${it.id}')">🎤 Thu âm</button>
        <button class="pr-btn pr-play" onclick="prPlay('${it.id}')" hidden>▶ Nghe lại giọng em</button>
        ${oxBtn}
      </div>
      <div class="pr-status" id="${it.id}-st"></div>
    </div>`;
  }

  function section(id, icon, title, items) {
    let rows = '';
    items.forEach((it, i) => { rows += itemHTML(it, i + 1); });
    return `<section class="pr-card" id="${id}">
      <div class="pr-section-head">${icon} ${title}</div>
      <div class="pr-section-body">${rows}</div>
    </section>`;
  }

  const sv = ALL.filter(x => x.type === 'v');
  const sg = ALL.filter(x => x.type === 'g');
  const sp = ALL.filter(x => x.type === 'p');

  let html = '';

  /* Lời chào */
  html += `<div class="pr-card pr-greeting">
    <h2>Hi ${esc(data.n || 'em')}! 👋</h2>
    <p>Đây là <b>bài luyện tập riêng</b> dựa trên buổi feedback${data.d ? ` ngày <b>${esc(data.d)}</b>` : ''}.</p>
    <p>Em luyện theo phương pháp <b>shadowing</b>: nghe mẫu → thu âm đọc theo → nghe lại để so sánh.</p>
  </div>`;

  /* Hướng dẫn */
  html += `<div class="pr-howto">
    💡 <b>Cách luyện (Shadowing):</b><br/>
    1. Chọn <b>giọng đọc</b> em thích ở thanh bên dưới.<br/>
    2. Bấm <b>🔊 Nghe phát âm chuẩn</b> để nghe mẫu (nghe nhiều lần được).<br/>
    3. Bấm <b>🎤 Thu âm</b> rồi đọc theo, bấm <b>⏹ Dừng</b> khi xong.<br/>
    4. Bấm <b>▶ Nghe lại giọng em</b> để so sánh với mẫu — chỗ nào chưa giống thì luyện lại.<br/>
    5. Luyện xong hết thì bấm <b>📋 Tạo báo cáo gửi thầy/cô</b> ở cuối trang.
  </div>`;

  if (!CAN_RECORD) {
    html += `<div class="pr-warn">
      ⚠ Trình duyệt hiện tại có thể <b>không thu âm được</b>. Em nên mở link bằng
      <b>Chrome</b> (máy tính / Android) hoặc <b>Safari</b> (iPhone/iPad), và truy cập
      qua <b>https</b>. Em vẫn nghe phát âm chuẩn bình thường nhé.
    </div>`;
  }

  /* Thanh chọn giọng + tốc độ */
  const savedRate = localStorage.getItem('pr_rate') || '0.85';
  html += `<div class="pr-voicebar">
    <div class="vb-group">
      <label>🔊 Giọng đọc:</label>
      <select id="pr-voice"><option value="">(đang tải giọng...)</option></select>
    </div>
    <div class="vb-group">
      <label>Tốc độ:</label>
      <select id="pr-rate">
        <option value="0.6"${savedRate==='0.6'?' selected':''}>Rất chậm</option>
        <option value="0.75"${savedRate==='0.75'?' selected':''}>Chậm</option>
        <option value="0.85"${savedRate==='0.85'?' selected':''}>Vừa</option>
        <option value="1"${savedRate==='1'?' selected':''}>Bình thường</option>
      </select>
    </div>
    <button type="button" id="pr-voice-test">▶ Nghe thử giọng</button>
  </div>`;

  /* Các phần — thứ tự: Từ vựng → Ngữ pháp → Phát âm */
  const menu = [];
  if (sv.length) {
    menu.push(`<a href="#sec-v">📖 Từ vựng (${sv.length})</a>`);
    html += section('sec-v', '📖', 'Từ vựng / collocation cần luyện', sv);
  }
  if (sg.length) {
    menu.push(`<a href="#sec-g">📝 Ngữ pháp (${sg.length})</a>`);
    html += section('sec-g', '📝', 'Câu ngữ pháp đã sửa — đọc lại cho đúng', sg);
  }
  if (sp.length) {
    menu.push(`<a href="#sec-p">🔊 Phát âm (${sp.length})</a>`);
    html += section('sec-p', '🔊', 'Từ cần luyện phát âm', sp);
  }

  /* Tổng kết + báo cáo */
  html += `<div class="pr-summary">
    <div class="pr-sub">Tiến độ luyện tập</div>
    <div class="pr-count"><span id="pr-done">0</span><span class="tot"> / ${ALL.length} mục</span></div>
    <div class="pr-bar"><div class="pr-bar-fill" id="pr-bar"></div></div>
    <button class="pr-report" type="button" onclick="prReport()">📋 Tạo báo cáo gửi thầy/cô</button>
  </div>`;

  html += `<div class="pr-footer">IELTS Phuong Bui · Bài luyện tập cá nhân hoá</div>`;

  content.innerHTML = html;
  menuEl.innerHTML  = menu.join('');
  if (!menu.length) menuEl.style.display = 'none';

  /* Nạp giọng vào select + ghi nhớ lựa chọn */
  populateVoiceSelect();
  const voiceSel = document.getElementById('pr-voice');
  const rateSel  = document.getElementById('pr-rate');
  if (voiceSel) voiceSel.onchange = () => {
    const v = getSelectedVoice();
    if (v) localStorage.setItem('pr_voice', v.voiceURI);
  };
  if (rateSel) rateSel.onchange = () => localStorage.setItem('pr_rate', rateSel.value);
  const testBtn = document.getElementById('pr-voice-test');
  if (testBtn) testBtn.onclick = () =>
    speak('Hello! This is the voice you selected for practice.', null);

  /* ================================================================
     TƯƠNG TÁC (gắn vào window cho inline onclick)
     ================================================================ */
  window.prSpeak = function (btn, idx) {
    // Đang đọc → bấm lần nữa để DỪNG
    if (btn.classList.contains('speaking')) {
      stopSpeaking();
      return;
    }
    speak(SPEAK[idx] || '', btn);
  };

  /** Thu âm / dừng thu âm cho 1 mục */
  window.prRecord = async function (btn, id) {
    const item = document.getElementById(id);
    const st   = document.getElementById(id + '-st');

    // Đang thu → dừng
    if (item._rec && item._rec.state === 'recording') {
      item._rec.stop();
      return;
    }

    // Tắt giọng đọc mẫu trước khi thu — tránh lọt vào bản ghi của em
    stopSpeaking();

    if (!CAN_RECORD) {
      st.innerHTML = '⚠ Trình duyệt này không thu âm được. Em mở bằng Chrome (qua https) nhé.';
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      st.innerHTML = '⚠ Em cần <b>cho phép dùng micro</b>. Bấm vào biểu tượng 🎤/🔒 '
                   + 'trên thanh địa chỉ → chọn "Cho phép" rồi thử lại nhé.';
      return;
    }

    let rec;
    try {
      rec = new MediaRecorder(stream);
    } catch (e) {
      st.textContent = 'Trình duyệt không hỗ trợ thu âm.';
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      btn.classList.remove('recording');
      btn.textContent = '🎤 Thu âm lại';
      if (!chunks.length) {
        st.textContent = 'Không thu được âm thanh. Em thử lại nhé.';
        return;
      }
      const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
      if (item._recUrl) URL.revokeObjectURL(item._recUrl);
      item._recUrl = URL.createObjectURL(blob);
      item.querySelector('.pr-play').hidden = false;
      if (!item.classList.contains('done')) {
        item.classList.add('done');
        recorded.add(id);
        updateProgress();
      }
      st.innerHTML = '✅ <b>Đã thu âm.</b> Bấm <b>▶ Nghe lại giọng em</b> để so với mẫu nhé!';
    };

    rec.start();
    item._rec = rec;
    btn.classList.add('recording');
    btn.textContent = '⏹ Dừng';
    st.textContent = '🔴 Đang thu âm... Đọc rõ ràng rồi bấm "⏹ Dừng" khi xong.';
  };

  /** Nghe lại giọng học viên vừa thu */
  window.prPlay = function (id) {
    const item = document.getElementById(id);
    if (!item || !item._recUrl) { toast('Em chưa thu âm mục này.'); return; }
    stopSpeaking();   // tắt giọng mẫu để nghe rõ giọng em
    const audio = new Audio(item._recUrl);
    audio.play().catch(() => toast('Không phát được ghi âm.'));
  };

  function updateProgress() {
    const done = recorded.size, total = ALL.length;
    document.getElementById('pr-done').textContent = done;
    document.getElementById('pr-bar').style.width =
      (total ? (done / total) * 100 : 0) + '%';
    if (done === total && total > 0) {
      toast('🎉 Tuyệt vời! Em đã luyện hết tất cả các mục!');
    }
  }

  /** Tạo báo cáo dạng text rồi copy để gửi thầy/cô */
  window.prReport = function () {
    const L = [];
    L.push('📊 BÁO CÁO LUYỆN TẬP SPEAKING');
    L.push(`Học viên: ${data.n || 'em'}${data.d ? '  ·  ' + data.d : ''}`);
    L.push(`Đã luyện: ${recorded.size}/${ALL.length} mục`);

    const group = (title, arr) => {
      if (!arr.length) return;
      L.push('');
      L.push(`[${title}]`);
      arr.forEach(it => {
        const mark  = recorded.has(it.id) ? '✅' : '⬜';
        const label = it.type === 'p'
          ? it.word
          : (it.w ? it.w + ' → ' + it.r : it.r);
        L.push(`${mark} ${label}`);
      });
    };
    group('Từ vựng',  sv);
    group('Ngữ pháp', sg);
    group('Phát âm',  sp);
    L.push('');
    L.push('(Báo cáo tạo tự động từ trang luyện tập IELTS Phuong Bui)');

    const report = L.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report).then(
        () => alert('✅ Đã copy báo cáo!\n\nEm dán (Ctrl+V) và gửi cho thầy/cô '
                  + 'qua Zalo / Messenger / Email nhé.'),
        () => window.prompt('Copy báo cáo dưới đây gửi cho thầy/cô:', report)
      );
    } else {
      window.prompt('Copy báo cáo dưới đây gửi cho thầy/cô:', report);
    }
  };
})();

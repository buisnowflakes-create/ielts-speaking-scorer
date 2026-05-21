# IELTS Speaking Scorer — LangGo

Tool tạo feedback Speaking IELTS bằng checkbox, xuất HTML/PDF.

---

## Cấu trúc file

```
ielts-scorer/
├── index.html    ← Giao diện chính của tool (giáo viên dùng)
├── style.css     ← CSS cho tool
├── data.js       ← Dữ liệu: presets, IPA dict, cấu hình AI
├── app.js        ← Logic: render, generate, export, AI, lịch sử
├── practice.html ← Trang luyện tập cá nhân hoá (học viên dùng)
├── practice.css  ← CSS cho trang luyện tập
├── practice.js   ← Logic trang luyện tập (đọc dữ liệu từ link)
└── README.md     ← File này
```

---

## Cách dùng

Mở `index.html` trực tiếp trong trình duyệt — **không cần server**.

---

## Trợ lý AI (Google Gemini)

Tool tích hợp AI để **tìm & sửa lỗi** và **trau chuốt feedback**, dùng Google Gemini.

Lấy API key **miễn phí** tại <https://aistudio.google.com/app/apikey>. Có 2 cách dùng key:

**Cách 1 — Tự nhập trên từng máy** (mỗi máy nhập 1 lần)

1. Bấm nút **🤖 Trợ lý AI** ở góc trên bên phải.
2. Dán key vào ô **Gemini API Key**, chọn **Model**, bấm **🧪 Kiểm tra kết nối** rồi **💾 Lưu**.

> 🔒 Key chỉ lưu trong `localStorage` của trình duyệt máy đó.

**Cách 2 — Dán sẵn vào tool, AI tự chạy mọi máy** (không cần nhập tay)

Mở file `data.js`, tìm dòng `apiKey: ''` ở đầu `AI_CONFIG`, dán key vào giữa 2 dấu nháy:

```js
apiKey: 'AIza...key-của-bạn...',
```

Từ đó tool tự dùng key này trên mọi máy, không hiện yêu cầu nhập.

> ⚠️ Khi đã dán key vào `data.js`: **không** đẩy file lên GitHub/website công khai.
> Nên dùng key của tài khoản Google **không gắn thẻ thanh toán** → rủi ro tối đa chỉ
> là hết lượt miễn phí trong ngày, không phát sinh tiền.

### 3 tính năng AI

| Tính năng | Cách dùng |
|-----------|-----------|
| **Sửa lỗi theo dòng** | Ở mục "Lỗi từ vựng/ngữ pháp", gõ câu sai vào ô **Câu/cụm sai** rồi bấm **✨** — AI tự điền ô "Sửa lại" + ghi chú giải thích. |
| **Quét lỗi từ transcript** | Bấm **✨ AI quét lỗi từ transcript**, dán đoạn học viên nói — AI tự tìm lỗi và thêm vào danh sách. |
| **Trau chuốt feedback** | Sau khi bấm "Tạo Feedback", bấm **✨ AI trau chuốt** — AI viết lại cho mượt, vẫn giữ nguyên điểm số & cấu trúc. |

Luôn **kiểm tra lại** kết quả AI gợi ý trước khi gửi học viên.

---

## Oxford Learner's Dictionary

Mỗi từ trong phần Pronunciation có nút **📖** mở thẳng trang tra cứu trên
Oxford Learner's Dictionary (nghĩa, IPA, audio chuẩn UK/US). Phần feedback xuất
ra cho học viên cũng kèm link Oxford cho từng từ luyện phát âm.

---

## Trang luyện tập cá nhân hoá (`practice.html`)

Khi feedback có lỗi từ vựng / ngữ pháp / từ phát âm, tool tự chèn một **hyperlink**
vào cuối feedback. Học viên bấm link → mở `practice.html` — trang luyện tập riêng
liệt kê đúng các lỗi của em đó, mỗi mục có nút **🔊 Nghe** phát âm chuẩn (đọc bằng
giọng máy của trình duyệt), link tra Oxford và ô tick "đã luyện".

Dữ liệu lỗi được mã hoá thẳng vào link (`practice.html?d=...`) — **không cần server,
không cần database**.

> ⚠️ **Để link gửi được cho học viên:** phải đăng tool lên web (vd: GitHub Pages) và
> mở tool từ địa chỉ web đó. Link luyện tập sinh ra theo địa chỉ hiện tại — nếu mở
> tool bằng `file://` hay `localhost` thì link chỉ chạy trên máy giáo viên.
> Có thể rút gọn link (kể cả link rút gọn có kiếm tiền) trước khi gửi học viên.

---

## Cách maintain

### Thêm / sửa / xóa nhận xét → `data.js`

```js
const PRESETS = {
  'fc-good': [
    { l: 'Tên tiêu chí nhỏ', t: 'Tên tiêu chí nhỏ: Nội dung nhận xét...' },
    // Thêm dòng mới tại đây
  ],
  'fc-bad': [ ... ],
  'lr-good': [ ... ],
  // v.v.
};
```

**Quy tắc:**
- `l` = Label ngắn (in đậm trong feedback)
- `t` = Toàn bộ nội dung (bắt đầu bằng `"<label>: "` để hệ thống tách tự động)
- Good items = `+1 điểm`, Bad items = `-1 điểm`

### Thêm từ vào từ điển IPA → `data.js`

```js
const IPA_DICT = {
  schedule: '/ˈʃed.juːl/',
  // Thêm từ mới: key = lowercase, value = Oxford UK IPA
};
```

### Thêm mẫu câu động viên → `data.js`

```js
const ENC_LIST = [
  'Câu mẫu 1...',
  'Câu mẫu 2...',
  // Thêm câu mới, các nút "Mẫu 1/2/3..." trong HTML tự map theo index
];
```

### Sửa giao diện → `style.css`

File được comment rõ từng section:
- `HEADER`, `LAYOUT`, `CARDS`, `CHECKLIST`, `BUTTONS`, `PREVIEW`, `PRINT STYLES`...

### Sửa logic → `app.js`

Các hàm chính:
| Hàm | Mô tả |
|-----|-------|
| `renderAllLists()` | Render toàn bộ checklist từ PRESETS |
| `generate()` | Tạo HTML feedback |
| `fetchIPA()` | Tra phiên âm IPA |
| `addErrRow()` | Thêm dòng lỗi cụ thể (LR/GRA) |
| `dlHTML()` | Tải file .html |
| `dlPDF()` | Xuất PDF — hiện cửa sổ xem trước rồi In / Tải về (jsPDF + html2canvas) |
| `saveDraft()` / `loadDraft()` | Lưu/mở nháp qua localStorage |
| `autoSave()` / `restoreAutoSave()` | Tự động lưu & khôi phục khi F5 |
| `resetAll()` | Reset form |
| `callGemini()` | Gọi Google Gemini API |
| `aiFixRow()` | AI gợi ý sửa 1 dòng lỗi |
| `runScan()` | AI quét lỗi từ transcript |
| `aiPolish()` | AI trau chuốt feedback |
| `saveToHistory()` | Lưu feedback của 1 HV vào lịch sử |
| `openHistory()` | Mở modal xem lại lịch sử feedback |
| `openClassSummary()` | Mở bảng tổng hợp điểm cả lớp |
| `scrollToTop()` / `scrollToBottom()` | Cuộn nhanh lên đầu / xuống cuối trang |

### Chỉnh prompt / model AI → `data.js`

```js
const AI_CONFIG  = { defaultModel: 'gemini-2.5-flash', models: [ ... ] };
const AI_PROMPTS = {
  fixOne: (cat, wrong) => `...`,   // prompt sửa 1 câu lỗi
  scan:   (cat, text)  => `...`,   // prompt quét transcript
  polish: `...`,                   // prompt trau chuốt feedback
};
```

---

## Tính năng

- ✅ Chọn nhận xét bằng checkbox (Điểm tốt / Cần cải thiện)
- ✅ Thêm lỗi từ vựng / ngữ pháp cụ thể (sai → đúng + giải thích)
- ✅ Tra IPA tự động (local dict + dictionaryapi.dev)
- ✅ Trợ lý AI (Google Gemini): sửa lỗi theo dòng, quét lỗi từ transcript, trau chuốt feedback
- ✅ Tra cứu Oxford Learner's Dictionary cho từ luyện phát âm
- ✅ Lịch sử học viên: lưu feedback từng HV, xem lại, tổng hợp điểm cả lớp
- ✅ Nút cuộn nhanh lên đầu / xuống cuối trang
- ✅ Trang luyện tập cá nhân hoá (`practice.html`): feedback tự kèm link để HV
  click vào luyện lại lỗi từ vựng / ngữ pháp + nghe phát âm chuẩn (TTS)
- ✅ Tạo feedback đầy đủ với bảng điểm + highlight màu
- ✅ Copy feedback có định dạng (paste vào Zalo/Word/Notion)
- ✅ Tải file .html standalone (gửi học viên)
- ✅ Xuất PDF qua print dialog
- ✅ Lưu / mở nháp (localStorage)
- ✅ Tự động lưu — F5 hay đóng tab vẫn không mất dữ liệu đang nhập
- ✅ Hỗ trợ xưng hô: em / anh / chị

---

## Browser support

Chrome / Edge / Firefox / Safari (phiên bản mới nhất).  
Tra IPA tự động cần kết nối internet.

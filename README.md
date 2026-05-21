# IELTS Speaking Scorer — LangGo

Tool chấm điểm Speaking IELTS bằng checkbox, tạo feedback và xuất HTML/PDF.

---

## Cấu trúc file

```
ielts-scorer/
├── index.html   ← Giao diện chính (HTML thuần)
├── style.css    ← Toàn bộ CSS (dark theme + print styles)
├── data.js      ← Dữ liệu: presets, IPA dict, band scale
├── app.js       ← Logic: render, scoring, IPA, generate, export
└── README.md    ← File này
```

---

## Cách dùng

Mở `index.html` trực tiếp trong trình duyệt — **không cần server**.

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

### Điều chỉnh ngưỡng Band → `data.js`

```js
const BAND_SCALE = [
  { min: 0.90, band: 9.0, desc: 'Expert' },
  { min: 0.80, band: 8.0, desc: 'Very Good' },
  // Chỉnh min để calibrate lại thang điểm
];
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
| `updateScores()` | Tính điểm real-time khi tick checkbox |
| `generate()` | Tạo HTML feedback |
| `fetchIPA()` | Tra phiên âm IPA |
| `addErrRow()` | Thêm dòng lỗi cụ thể (LR/GRA) |
| `dlHTML()` | Tải file .html |
| `dlPDF()` | Mở print dialog để xuất PDF |
| `saveDraft()` / `loadDraft()` | Lưu/mở nháp qua localStorage |
| `resetAll()` | Reset form |

---

## Tính năng

- ✅ Chấm điểm checkbox real-time: good = +1, bad = -1
- ✅ Live score dashboard: 4 progress bars + band meter
- ✅ Ước tính Band Score (2.0 – 9.0)
- ✅ Thêm lỗi từ vựng / ngữ pháp cụ thể (sai → đúng + giải thích)
- ✅ Tra IPA tự động (local dict + dictionaryapi.dev)
- ✅ Tạo feedback đầy đủ với bảng điểm + highlight màu
- ✅ Copy feedback có định dạng (paste vào Zalo/Word/Notion)
- ✅ Tải file .html standalone (gửi học viên)
- ✅ Xuất PDF qua print dialog
- ✅ Lưu / mở nháp (localStorage)
- ✅ Hỗ trợ xưng hô: em / anh / chị

---

## Browser support

Chrome / Edge / Firefox / Safari (phiên bản mới nhất).  
Tra IPA tự động cần kết nối internet.

/* ================================================================
   data.js — IELTS Speaking Scorer
   Chứa toàn bộ dữ liệu: preset nhận xét, từ điển IPA, thang Band
   Chỉnh sửa file này để thêm / bớt / sửa nhận xét mà không cần
   đụng vào logic (app.js).
   ================================================================ */

/* ----------------------------------------------------------------
   PRESETS
   Cấu trúc mỗi item: { l: "Label (tiêu chí nhỏ)", t: "Nội dung nhận xét" }
   - "l" sẽ được in đậm trong feedback
   - "t" là đoạn text đầy đủ (bao gồm cả label, hệ thống tự bỏ label khỏi body)
   ---------------------------------------------------------------- */
const PRESETS = {

  /* ==================== FLUENCY & COHERENCE ==================== */
  'fc-good': [
    {
      l: 'Về tốc độ nói',
      t: 'Về tốc độ nói: Em duy trì tốc độ nói hợp lý và liền mạch, ít khi phải tự sửa hoặc lặp lại.'
    },
    {
      l: 'Về xử lý ngập ngừng',
      t: 'Về xử lý ngập ngừng: Em dùng các filler tự nhiên để xử lý khoảng dừng thay vì im lặng quá lâu.'
    },
    {
      l: 'Về phát triển ý',
      t: 'Về phát triển ý: Em phát triển câu trả lời chi tiết, mở rộng ý một cách hợp lý và mạch lạc.'
    },
    {
      l: 'Về linking words',
      t: 'Về linking words: Em dùng đa dạng cohesive devices đúng ngữ cảnh, người nghe dễ theo dõi mạch ý.'
    },
  ],

  'fc-bad': [
    {
      l: 'Về ngập ngừng',
      t: 'Về ngập ngừng: Em vẫn còn ngập ngừng và tự sửa câu, ảnh hưởng đến fluency. Em nên dùng filler tự nhiên và tiếp tục nói thay vì dừng lại sửa.'
    },
    {
      l: 'Về phát triển ý',
      t: 'Về phát triển ý: Câu trả lời còn cơ bản, cần phát triển thêm. Em mở rộng theo các hướng đã hướng dẫn nhé.'
    },
    {
      l: 'Về linking words',
      t: 'Về linking words: Linking words còn hạn chế, chuyển ý hơi đột ngột. Em đa dạng hóa từ nối để mạch nói rõ ràng hơn.'
    },
    {
      l: 'Về Part 2',
      t: 'Về Part 2: Em vẫn gặp khó duy trì 2 phút. Luyện cue card hàng ngày và bấm giờ để cải thiện.'
    },
  ],

  /* ==================== LEXICAL RESOURCE ==================== */
  'lr-good': [
    {
      l: 'Về phạm vi từ vựng',
      t: 'Về phạm vi từ vựng: Em có vốn từ khá tốt, đủ diễn đạt nhiều ý mà ít bị bí từ.'
    },
    {
      l: 'Về paraphrase',
      t: 'Về paraphrase: Em có thể paraphrase tốt, biết diễn đạt cùng ý bằng nhiều cách thay vì lặp từ đề bài.'
    },
    {
      l: 'Về từ vựng nâng cao',
      t: 'Về từ vựng nâng cao: Em dùng được một số từ nâng cao và collocations khá tự nhiên cho chủ đề.'
    },
    {
      l: 'Về độ chính xác',
      t: 'Về độ chính xác: Word choice của em nhìn chung chính xác, truyền đúng ý và phù hợp ngữ cảnh.'
    },
  ],

  'lr-bad': [
    {
      l: 'Về phạm vi từ vựng',
      t: 'Về phạm vi từ vựng: Vốn từ còn hạn chế ở một số chủ đề. Em bổ sung từ theo chủ đề và áp dụng thường xuyên nhé.'
    },
    {
      l: 'Về paraphrase',
      t: 'Về paraphrase: Em vẫn lặp lại từ trong câu trả lời. Hãy luyện paraphrase — học 2-3 cách nói khác nhau cho cùng một ý.'
    },
    {
      l: 'Về độ chính xác',
      t: 'Về độ chính xác: Một số chỗ chọn từ chưa chính xác. Em kiểm tra nghĩa và cách dùng trong ngữ cảnh nhé.'
    },
    {
      l: 'Về collocations',
      t: 'Về collocations: Một số collocations chưa tự nhiên. Em học từ theo cụm cố định để câu nói mượt hơn.'
    },
  ],

  /* ==================== GRAMMATICAL RANGE & ACCURACY ==================== */
  'gra-good': [
    {
      l: 'Về đa dạng cấu trúc',
      t: 'Về đa dạng cấu trúc: Em đã dùng thêm cấu trúc phức, giúp câu trả lời tự nhiên và đa dạng hơn.'
    },
    {
      l: 'Về độ chính xác (cấu trúc đơn giản)',
      t: 'Về độ chính xác (cấu trúc đơn giản): Em sử dụng ngữ pháp khá chính xác ở các cấu trúc đơn giản.'
    },
    {
      l: 'Về độ chính xác (cấu trúc nâng cao)',
      t: 'Về độ chính xác (cấu trúc nâng cao): Em kiểm soát tốt độ chính xác kể cả với cấu trúc nâng cao. Phát huy tiếp nhé!'
    },
    {
      l: 'Về ảnh hưởng nghe hiểu',
      t: 'Về ảnh hưởng nghe hiểu: Lỗi ngữ pháp không ảnh hưởng nhiều đến việc người nghe hiểu ý.'
    },
  ],

  'gra-bad': [
    {
      l: 'Về đa dạng cấu trúc',
      t: 'Về đa dạng cấu trúc: Ngữ pháp còn hạn chế, chủ yếu câu đơn. Em luyện thêm câu điều kiện, bị động, mệnh đề phụ.'
    },
    {
      l: 'Về thì & cấu trúc cơ bản',
      t: 'Về thì & cấu trúc cơ bản: Còn lỗi về thì và cấu trúc khi nói dài. Em nói chậm lại để có thời gian kiểm tra.'
    },
    {
      l: 'Về cấu trúc phức',
      t: 'Về cấu trúc phức: Cần chính xác hơn khi dùng cấu trúc phức. Em luyện từng cấu trúc riêng trước.'
    },
    {
      l: 'Về ảnh hưởng nghe hiểu',
      t: 'Về ảnh hưởng nghe hiểu: Khá nhiều lỗi ngữ pháp, có thể ảnh hưởng nghe hiểu. Em luyện chắc cấu trúc cơ bản trước.'
    },
  ],

  /* ==================== PRONUNCIATION ==================== */
  'p-good': [
    {
      l: 'Về độ rõ ràng',
      t: 'Về độ rõ ràng: Phát âm của em khá rõ ràng, người nghe hiểu toàn bộ mà không cần đoán ý.'
    },
    {
      l: 'Về trọng âm từ',
      t: 'Về trọng âm từ: Em đặt trọng âm từ khá chính xác, kể cả từ nhiều âm tiết.'
    },
    {
      l: 'Về ngữ điệu',
      t: 'Về ngữ điệu: Ngữ điệu lên xuống tự nhiên, không bị flat. Em biết nhấn content word trong câu.'
    },
    {
      l: 'Về nối âm',
      t: 'Về nối âm: Em đã có đặc điểm nối âm và ngắt câu theo cụm ý khá hợp lý.'
    },
  ],

  'p-bad': [
    {
      l: 'Về phát âm từ',
      t: 'Về phát âm từ: Một số từ cần điều chỉnh. Em tra phiên âm Cambridge/Oxford và luyện theo audio mẫu ngay từ đầu.'
    },
    {
      l: 'Về âm cuối',
      t: 'Về âm cuối: Cần phát âm rõ âm cuối hơn (tránh ảnh hưởng ngữ pháp). Em phóng đại âm cuối khi luyện.'
    },
    {
      l: 'Về trọng âm từ',
      t: 'Về trọng âm từ: Cần nhấn trọng âm chính xác hơn. Em tra trọng âm mỗi từ mới và luyện phản xạ ngay.'
    },
    {
      l: 'Về ngữ điệu',
      t: 'Về ngữ điệu: Ngữ điệu vẫn còn hơi flat. Em luyện shadowing với audio BBC/VOA để học cách lên xuống giọng.'
    },
    {
      l: 'Về nối âm',
      t: 'Về nối âm: Các từ phát âm rời rạc, chưa có nối âm. Em luyện shadowing hàng ngày để quen nối âm tự nhiên.'
    },
  ],

};

/* ----------------------------------------------------------------
   ENCOURAGEMENT PRESETS
   Thêm / bớt mẫu tại đây. setEnc(index) trong HTML lấy từ mảng này.
   ---------------------------------------------------------------- */
const ENC_LIST = [
  'Em đọc lại feedback thật kỹ và note các điểm cần cải thiện vào sổ nhé. Sau đó luyện tập đều đặn mỗi ngày — đây là cách hiệu quả nhất để tiến bộ. Cố gắng nhé em!',
  'Em xem kỹ từng lỗi và phần phân tích ở trên, rồi áp dụng vào các bài luyện tiếp theo. Cứ kiên trì luyện đều, kết quả chắc chắn sẽ đến. Cố lên em!',
  'Em đọc kỹ feedback, chọn 2-3 điểm quan trọng nhất để tập trung cải thiện trong tuần này. Đừng cố sửa hết một lúc — luyện có trọng tâm sẽ hiệu quả hơn. Cố gắng nhé!',
  'Feedback chỉ phát huy giá trị khi em đọc kỹ và chủ động luyện tập. Em note lại từ vựng/cấu trúc/phát âm mới rồi áp dụng vào bài speaking tiếp theo. Cố lên em!',
];

/* ----------------------------------------------------------------
   BAND SCALE
   ratio = tổng điểm / tổng điểm tối đa
   Điều chỉnh ngưỡng min nếu muốn calibrate lại thang điểm.
   ---------------------------------------------------------------- */
const BAND_SCALE = [
  { min: 0.90, band: 9.0, desc: 'Expert / Chuyên gia'        },
  { min: 0.80, band: 8.0, desc: 'Very Good'                  },
  { min: 0.70, band: 7.0, desc: 'Good'                       },
  { min: 0.60, band: 6.0, desc: 'Competent'                  },
  { min: 0.50, band: 5.0, desc: 'Modest'                     },
  { min: 0.38, band: 4.0, desc: 'Limited'                    },
  { min: 0.25, band: 3.0, desc: 'Extremely Limited'          },
  { min: 0,    band: 2.0, desc: 'Intermittent'               },
];

/* ----------------------------------------------------------------
   IPA LOCAL DICTIONARY
   Tra offline (không cần internet). Ưu tiên hơn dictionaryapi.dev.
   Key = từ viết thường, value = phiên âm Oxford UK.
   ---------------------------------------------------------------- */
const IPA_DICT = {
  // === Thường gặp trong IELTS Speaking ===
  comfortable:      '/ˈkʌm.fə.tə.bəl/',
  environment:      '/ɪnˈvaɪ.rən.mənt/',
  pronunciation:    '/prəˌnʌn.siˈeɪ.ʃən/',
  government:       '/ˈɡʌv.ən.mənt/',
  vocabulary:       '/vəˈkæb.jə.lə.ri/',
  interesting:      '/ˈɪn.trəs.tɪŋ/',
  beautiful:        '/ˈbjuː.tɪ.fəl/',
  restaurant:       '/ˈres.tər.ɒnt/',
  technology:       '/tekˈnɒl.ə.dʒi/',
  education:        '/ˌed.juˈkeɪ.ʃən/',
  university:       '/ˌjuː.nɪˈvɜː.sə.ti/',
  opportunity:      '/ˌɒp.əˈtʃuː.nə.ti/',
  experience:       '/ɪkˈspɪə.ri.əns/',
  important:        '/ɪmˈpɔː.tənt/',
  different:        '/ˈdɪf.ər.ənt/',
  especially:       '/ɪˈspeʃ.əl.i/',
  usually:          '/ˈjuː.ʒu.ə.li/',
  probably:         '/ˈprɒb.ə.bli/',
  family:           '/ˈfæm.ə.li/',
  february:         '/ˈfeb.ru.ə.ri/',
  wednesday:        '/ˈwenz.deɪ/',
  schedule:         '/ˈʃed.juːl/',
  colleague:        '/ˈkɒl.iːɡ/',
  business:         '/ˈbɪz.nəs/',
  island:           '/ˈaɪ.lənd/',
  doubt:            '/daʊt/',
  debt:             '/det/',
  though:           '/ðəʊ/',
  through:          '/θruː/',
  enough:           '/ɪˈnʌf/',
  muscle:           '/ˈmʌs.əl/',
  receipt:          '/rɪˈsiːt/',
  science:          '/ˈsaɪ.əns/',
  genre:            '/ˈʒɒn.rə/',
  leisure:          '/ˈleʒ.ər/',
  pleasure:         '/ˈpleʒ.ər/',
  achieve:          '/əˈtʃiːv/',
  community:        '/kəˈmjuː.nə.ti/',
  economy:          '/ɪˈkɒn.ə.mi/',
  society:          '/səˈsaɪ.ə.ti/',
  culture:          '/ˈkʌl.tʃər/',
  foreign:          '/ˈfɒr.ən/',
  knowledge:        '/ˈnɒl.ɪdʒ/',
  analysis:         '/əˈnæl.ə.sɪs/',
  develop:          '/dɪˈvel.əp/',
  vegetable:        '/ˈvedʒ.tə.bəl/',
  photograph:       '/ˈfəʊ.tə.ɡrɑːf/',
  chocolate:        '/ˈtʃɒk.lət/',
  recipe:           '/ˈres.ə.pi/',
  mortgage:         '/ˈmɔː.ɡɪdʒ/',
  castle:           '/ˈkɑː.səl/',
  determine:        '/dɪˈtɜː.mɪn/',
  controversy:      '/ˈkɒn.trə.vɜː.si/',
  purchase:         '/ˈpɜː.tʃəs/',
  empathy:          '/ˈem.pə.θi/',
  numerous:         '/ˈnjuː.mə.rəs/',
  reputation:       '/ˌrep.jʊˈteɪ.ʃən/',
  available:        '/əˈveɪ.lə.bəl/',
  comparison:       '/kəmˈpær.ɪ.sən/',
  definitely:       '/ˈdef.ɪ.nət.li/',
  brochure:         '/ˈbrəʊ.ʃər/',
  comfortable:      '/ˈkʌm.fə.tə.bəl/',
  climate:          '/ˈklaɪ.mət/',
  colleague:        '/ˈkɒl.iːɡ/',
  architecture:     '/ˈɑː.kɪ.tek.tʃər/',
  literature:       '/ˈlɪt.rə.tʃər/',
  // === Âm câm / dễ đọc sai ===
  knight:           '/naɪt/',
  knee:             '/niː/',
  know:             '/nəʊ/',
  knife:            '/naɪf/',
  wrap:             '/ræp/',
  write:            '/raɪt/',
  wrong:            '/rɒŋ/',
  subtle:           '/ˈsʌt.əl/',
  scissors:         '/ˈsɪz.əz/',
  sword:            '/sɔːd/',
  salmon:           '/ˈsæm.ən/',
  almond:           '/ˈɑː.mənd/',
  colonel:          '/ˈkɜː.nəl/',
  often:            '/ˈɒf.ən/',
  listen:           '/ˈlɪs.ən/',
  whistle:          '/ˈwɪs.əl/',
  autumn:           '/ˈɔː.təm/',
  column:           '/ˈkɒl.əm/',
  half:             '/hɑːf/',
  // === Công nghệ ===
  internet:         '/ˈɪn.tə.net/',
  digital:          '/ˈdɪdʒ.ɪ.təl/',
  virtual:          '/ˈvɜː.tʃu.əl/',
  smartphone:       '/ˈsmɑːt.fəʊn/',
  laptop:           '/ˈlæp.tɒp/',
  application:      '/ˌæp.lɪˈkeɪ.ʃən/',
  software:         '/ˈsɒft.weər/',
  subscribe:        '/səbˈskraɪb/',
  streaming:        '/ˈstriː.mɪŋ/',
  podcast:          '/ˈpɒd.kɑːst/',
};

/* ----------------------------------------------------------------
   AI CONFIG — Google Gemini
   Trợ lý AI giúp: gợi ý sửa lỗi theo dòng, quét lỗi từ transcript,
   và trau chuốt feedback. API key do giáo viên tự nhập, lưu trong
   localStorage của trình duyệt (không gửi đi đâu ngoài Google).
   ---------------------------------------------------------------- */
const AI_CONFIG = {

  /* ⚙️ DÁN API KEY GEMINI VÀO GIỮA 2 DẤU NHÁY DƯỚI ĐÂY
     → Trợ lý AI sẽ TỰ CHẠY trên mọi máy, không cần nhập tay.
     → Để trống ('') nếu muốn mỗi máy tự nhập key riêng.
     ⚠️ Khi đã dán key: KHÔNG đẩy file này lên GitHub/website công khai. */
  apiKey: '',

  defaultModel: 'gemini-2.5-flash',
  models: [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
  ],
  endpoint: model =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  keyURL: 'https://aistudio.google.com/app/apikey',
};

/* JSON schema cho structured output của Gemini (responseSchema) */
const AI_SCHEMAS = {
  fixOne: {
    type: 'OBJECT',
    properties: {
      right: { type: 'STRING' },
      note:  { type: 'STRING' },
    },
    required: ['right', 'note'],
  },
  scan: {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        wrong: { type: 'STRING' },
        right: { type: 'STRING' },
        note:  { type: 'STRING' },
      },
      required: ['wrong', 'right', 'note'],
    },
  },
};

/* ----------------------------------------------------------------
   AI PROMPTS — chỉnh văn phong / yêu cầu của AI tại đây
   ---------------------------------------------------------------- */
const AI_PROMPTS = {

  /* Sửa 1 hoặc NHIỀU câu/cụm sai (mỗi dòng = 1 câu) → JSON { right, note } */
  fixOne: (cat, wrong) => {
    const label = cat === 'grammar' ? 'ngữ pháp' : 'từ vựng / collocation';
    return `Bạn là giáo viên IELTS Speaking giàu kinh nghiệm, đang chấm bài cho học viên người Việt.
Dưới đây là MỘT hoặc NHIỀU câu/cụm học viên nói — MỖI DÒNG là một câu/cụm riêng biệt (có thể mắc lỗi ${label}):
"""
${wrong}
"""

Nhiệm vụ: sửa TỪNG DÒNG cho ĐÚNG và TỰ NHIÊN theo văn phong IELTS Speaking.
Trả về JSON gồm 2 trường:
- "right": bản sửa. PHẢI có ĐÚNG số dòng bằng đầu vào và giữ nguyên thứ tự — dòng thứ n của "right" là bản sửa cho dòng thứ n của đầu vào. Dòng nào vốn đã đúng thì chép lại nguyên dòng đó.
- "note": giải thích NGẮN GỌN bằng tiếng Việt. Nếu đầu vào có nhiều dòng, giải thích lần lượt từng dòng (mỗi dòng một ý ngắn, đánh số 1., 2., 3...). Dòng nào đã đúng thì ghi "đã đúng".`;
  },

  /* Quét transcript → MẢNG JSON [{ wrong, right, note }] */
  scan: (cat, text) => {
    const label = cat === 'grammar'
      ? 'NGỮ PHÁP (grammar): thì, hoà hợp chủ-vị, mạo từ, giới từ, cấu trúc câu...'
      : 'TỪ VỰNG / COLLOCATION (lexical): chọn từ sai nghĩa, collocation không tự nhiên, dùng từ lặp/quá cơ bản...';
    return `Bạn là giáo viên IELTS Speaking giàu kinh nghiệm. Dưới đây là phần nói của một học viên người Việt:
"""
${text}
"""

Nhiệm vụ: tìm các lỗi ${label}
Chỉ tập trung vào loại lỗi nêu trên, bỏ qua các loại lỗi khác.
Trả về một MẢNG JSON, mỗi phần tử gồm:
- "wrong": cụm/câu SAI, trích đúng như trong bài của học viên.
- "right": bản sửa đúng, tự nhiên theo văn phong IELTS Speaking.
- "note": giải thích ngắn gọn bằng tiếng Việt vì sao sai.
Chỉ liệt kê lỗi thật sự, ưu tiên lỗi ảnh hưởng band điểm, tối đa 12 lỗi.
Nếu không tìm thấy lỗi nào, trả về mảng rỗng [].`;
  },

  /* Trau chuốt feedback (giữ nguyên HTML) */
  polish: `Bạn là giáo viên IELTS giàu kinh nghiệm và tận tâm. Dưới đây là một bản feedback dạng HTML gửi cho học viên.
Hãy VIẾT LẠI phần văn xuôi tiếng Việt cho mượt mà, rõ ràng, ấm áp và mang tính khích lệ hơn, nhưng vẫn chuyên nghiệp.

QUY TẮC BẮT BUỘC:
- GIỮ NGUYÊN 100% mọi thẻ HTML, tên class, thuộc tính, cấu trúc, bảng điểm, mọi con số và band score.
- GIỮ NGUYÊN mọi từ/cụm tiếng Anh và phiên âm IPA; KHÔNG dịch chúng.
- KHÔNG thay đổi nội dung bên trong các thẻ <span class="fb-err-mark">, <span class="fb-fix-mark">, <span class="fb-word-mark">, <span class="fb-ipa-mark"> và mọi thẻ <a>.
- KHÔNG thêm hoặc bớt mục, KHÔNG bịa thêm thông tin.
- Chỉ cải thiện cách diễn đạt tiếng Việt trong các thẻ <li>, <p> và <div class="fb-encourage">.
- Trả về DUY NHẤT đoạn HTML hoàn chỉnh, KHÔNG kèm lời giải thích, KHÔNG bọc trong dấu \`\`\`.`,
};

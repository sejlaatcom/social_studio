/* تحسين — قراءة تقرير منصة تميز داخل المتصفح (لا يُرفع الملف لأي خادم) */
(function (global) {
  'use strict';

  const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };

  function normalizeDigits(s) {
    return s.replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d]).replace(/٫/g, '.').replace(/٪/g, '%').replace(/،/g, '،');
  }

  function normalize(s) {
    if (!s) return '';
    let t = s.normalize('NFKC');
    t = normalizeDigits(t);
    t = t.replace(/ـ/g, '') // تطويل
      .replace(/[‎‏‪-‮⁦-⁩]/g, '')
      .replace(/[ \t ]+/g, ' ');
    return t.trim();
  }

  // مؤشر على أن النص العربي مستخرج بترتيب بصري معكوس
  function reversalScore(text) {
    const words = text.split(/\s+/).filter((w) => /[؀-ۿ]/.test(w));
    let fwd = 0, rev = 0;
    for (const w of words) {
      if (/^(ال|وال|بال|لل)/.test(w)) fwd++;
      if (/(لا|لاو|لاب|لل)$/.test(w) && w.length > 3) rev++;
    }
    return { fwd, rev };
  }

  const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
  function reverseVisual(str) {
    // اعكس المحارف ثم أعد ترتيب الأرقام واللاتيني لوضعها الطبيعي
    const r = Array.from(str).reverse().map((c) => MIRROR[c] || c).join('');
    return r.replace(/[0-9A-Za-z.%:\/_-]+/g, (m) => Array.from(m).reverse().join(''));
  }

  async function extractPdf(file, onProgress) {
    if (!global.pdfjsLib) throw new Error('مكتبة قراءة PDF غير محمّلة');
    const buf = await file.arrayBuffer();
    const pdf = await global.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items.filter((it) => it.str && it.str.trim()).map((it) => ({
        str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || 8,
      }));
      pages.push(items);
      if (onProgress) onProgress(p, pdf.numPages);
    }
    // اكتشاف الانعكاس على مستوى المستند
    const allText = normalize(pages.flat().map((i) => i.str).join(' '));
    const sc = reversalScore(allText);
    const reversed = sc.rev > sc.fwd * 1.3 && sc.rev > 5;

    const lines = [];
    pages.forEach((items, pi) => {
      // تجميع العناصر في أسطر حسب الإحداثي الرأسي
      items.sort((a, b) => b.y - a.y || b.x - a.x);
      const rows = [];
      for (const it of items) {
        const tol = Math.max(2.5, it.h * 0.45);
        let row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
        if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
        row.items.push(it);
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        // 1) ترتيب فيزيائي من اليسار لليمين وتجميع العناصر المتلاصقة في كلمات
        r.items.sort((a, b) => a.x - b.x);
        const words = [];
        for (const it of r.items) {
          let s = normalize(it.str);
          if (!s) continue;
          if (reversed && s.length > 1 && /[؀-ۿ]/.test(s)) s = reverseVisual(s);
          const last = words[words.length - 1];
          const gap = last ? it.x - last.right : Infinity;
          if (last && gap < Math.max(1.2, it.h * 0.18)) {
            last.parts.push(s); last.right = Math.max(last.right, it.x + it.w);
          } else {
            words.push({ left: it.x, right: it.x + it.w, parts: [s], h: it.h });
          }
        }
        // 2) الكلمة العربية تُقرأ من اليمين لليسار، والأرقام/اللاتيني من اليسار لليمين
        for (const w of words) {
          const joined = w.parts.join('');
          w.text = /[؀-ۿ]/.test(joined) ? w.parts.slice().reverse().join('') : joined;
        }
        // 3) ترتيب الكلمات من اليمين لليسار مع فاصل للأعمدة البعيدة
        words.sort((a, b) => b.right - a.right);
        const cells = [];
        let prev = null;
        for (const w of words) {
          if (prev && prev.left - w.right > Math.max(14, w.h * 1.6)) cells.push('|');
          cells.push(w.text);
          prev = w;
        }
        const line = cells.join(' ').replace(/\s+/g, ' ').trim();
        if (line) lines.push({ page: pi + 1, text: line });
      }
    });
    return { lines, numPages: pdf.numPages, reversed };
  }

  // ———— التحليل النصي ————
  const CODE_RE = /(?<![\d.])([1-6])\s?[.\-]\s?(\d{1,2})\s?[.\-]\s?(\d{1,2})(?![\d]|\.\d)/g;
  const STD_RE = /(?<![\d.])([1-6])\s?\.\s?(\d{1,2})(?![\d]|\s?\.\s?\d)/g;
  const PCT_RE = /(\d{1,3}(?:\.\d{1,2})?)\s?%|%\s?(\d{1,3}(?:\.\d{1,2})?)/g;
  const NUM_RE = /(?<![\d.])(\d{1,3}(?:\.\d{1,2})?)(?![\d.])/g;
  const ORDINALS = { 'الأول': '1', 'الاول': '1', 'الثاني': '2', 'الثالث': '3', 'الرابع': '4', 'الخامس': '5' };
  const LEVEL_WORDS = /(تميّز|تميز|تقدّم|تقدم|انطلاق|تهيئة|متميز|متقدم|منجز|بحاجة إلى (?:تطوير|دعم|تحسين))/g;

  function pcts(text) {
    const out = [];
    let m;
    PCT_RE.lastIndex = 0;
    while ((m = PCT_RE.exec(text))) {
      const v = parseFloat(m[1] || m[2]);
      if (v >= 0 && v <= 100) out.push(v);
    }
    return out;
  }

  function cleanText(t) {
    return t.replace(CODE_RE, ' ').replace(PCT_RE, ' ').replace(/\|/g, ' ')
      .replace(/(?<![؀-ۿ])\d+(?:\.\d+)?(?![؀-ۿ])/g, ' ')
      .replace(LEVEL_WORDS, ' ')
      .replace(/[()\[\]:%\-–—•·]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function detectMeta(full) {
    const meta = {};
    const grab = (re) => { const m = full.match(re); return m ? m[1].replace(/\|/g, ' ').trim() : ''; };
    meta.schoolName = grab(/(?:اسم المدرسة|المدرسة)\s*[:：]?\s*([^\n|]{3,60})/);
    meta.ministryCode = grab(/(?:الرقم الوزاري|رقم المدرسة|الرمز الوزاري)\s*[:：]?\s*(\d{4,10})/);
    meta.region = grab(/إدارة\s+(?:التعليم|تعليم)\s+(?:ب|في)?\s*([^\n|]{2,40})/);
    meta.office = grab(/مكتب\s+(?:التعليم|تعليم)\s+(?:ب|في)?\s*([^\n|]{2,40})/);
    meta.stage = grab(/المرحلة\s*[:：]?\s*(الابتدائية|المتوسطة|الثانوية|رياض الأطفال|الطفولة المبكرة)/);
    if (/التقويم الخارجي|المراجعة الخارجية/.test(full)) meta.type = 'external';
    else if (/الدورة الثانية|دورة التقويم الثانية/.test(full)) meta.type = 'self2';
    else meta.type = 'self1';
    meta.edition3 = /الإصدار الثالث|1447/.test(full);
    const y = full.match(/(14\d\d)\s?ه/);
    meta.year = y ? y[1] : '';
    return meta;
  }

  function parseLines(lines) {
    const texts = lines.map((l) => (typeof l === 'string' ? normalize(l) : l.text));
    const full = texts.join('\n');
    const meta = detectMeta(full);
    const hasSurvey = /استبان/.test(full);
    const indicators = new Map();
    const standards = new Map();
    const domains = new Map();
    let overall = null;

    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      // الأداء العام
      if (overall == null && /(الأداء العام|النتيجة العامة|النتيجة الكلية|الدرجة الكلية|المستوى العام|الأداء الكلي|النسبة العامة|المتوسط العام)/.test(t)) {
        const p = pcts(t).concat(pcts(texts[i + 1] || ''));
        if (p.length) overall = p[0];
      }
      // المؤشرات
      CODE_RE.lastIndex = 0;
      const codes = [];
      let m;
      while ((m = CODE_RE.exec(t))) codes.push(`${m[1]}.${parseInt(m[2], 10)}.${parseInt(m[3], 10)}`);
      if (codes.length) {
        let values = pcts(t);
        let text = cleanText(t);
        // استكمال النص والقيم من الأسطر التالية حتى المؤشر التالي
        for (let j = i + 1; j < Math.min(texts.length, i + 4); j++) {
          CODE_RE.lastIndex = 0;
          if (CODE_RE.test(texts[j]) || /المعيار|المجال/.test(texts[j])) break;
          const extra = cleanText(texts[j]);
          if (!values.length) values = pcts(texts[j]);
          if (extra && text.length < 160 && /[؀-ۿ]{3}/.test(extra) && !/صفحة|الصفحة/.test(extra)) text += ' ' + extra;
        }
        if (!values.length) {
          // أرقام بلا علامة %
          const stripped = t.replace(CODE_RE, ' ');
          NUM_RE.lastIndex = 0;
          let n;
          while ((n = NUM_RE.exec(stripped))) { const v = parseFloat(n[1]); if (v <= 100) values.push(v); }
        }
        const code = codes[0];
        if (!indicators.has(code) || (indicators.get(code).score == null && values.length)) {
          indicators.set(code, {
            code,
            oldCode: codes[1] && codes[1] !== code ? codes[1] : '',
            text: text.slice(0, 260),
            score: values.length ? values[0] : null,
            survey: hasSurvey && values.length > 1 ? values[1] : null,
            values,
          });
        }
        continue;
      }
      // المعايير
      if (/المعيار|^\s*[1-6]\.\d{1,2}\s/.test(t) || (STD_RE.test(t) && pcts(t).length)) {
        STD_RE.lastIndex = 0;
        const sm = STD_RE.exec(t);
        STD_RE.lastIndex = 0;
        const p = pcts(t);
        if (sm && p.length && !/^\d+\.\d+\s?%/.test(sm[0])) {
          const code = `${sm[1]}.${parseInt(sm[2], 10)}`;
          const name = cleanText(t.replace(/المعيار/, '')).replace(STD_RE, '').trim();
          if (!standards.has(code)) standards.set(code, { code, name: name.slice(0, 80), score: p[0] });
          continue;
        }
      }
      // المجالات
      if (/المجال/.test(t)) {
        const p = pcts(t);
        let code = null;
        const dm = t.match(/المجال\s*(?:رقم)?\s*\(?([1-6])\)?/);
        if (dm) code = dm[1];
        else for (const k in ORDINALS) if (t.includes('المجال ' + k)) code = ORDINALS[k];
        if (!code) {
          const names = { 'الإدارة المدرسية': '1', 'التعليم والتعلم': '2', 'نواتج التعلم': '3', 'البيئة المدرسية': '4' };
          for (const k in names) if (t.replace(/ّ/g, '').includes(k)) code = names[k];
        }
        if (code && p.length && !domains.has(code)) {
          let name = cleanText(t.replace(/المجال\s*(?:رقم)?\s*\(?[1-6]?\)?/, '')).replace(/الأول|الثاني|الثالث|الرابع|الخامس/, '').trim();
          domains.set(code, { code, name: name.slice(0, 60), score: p[0] });
        }
      }
    }

    // تصنيف أسماء المعايير المأخوذة من سطر المؤشر إن لم تُكتشف
    return {
      meta, overall, hasSurvey,
      domains: [...domains.values()],
      standards: [...standards.values()],
      indicators: [...indicators.values()].sort(cmpCode),
      lineCount: texts.length,
    };
  }

  function cmpCode(a, b) {
    const pa = String(a.code).split('.').map(Number), pb = String(b.code).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  global.TahseenParser = { extractPdf, parseLines, normalize, cmpCode, reverseVisual };
})(window);

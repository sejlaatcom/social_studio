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
    t = t.replace(/[\u0000\u0640\u064B-\u0652\u0670]/g, '') // تطويل وتشكيل
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

  // حروف لا تتصل بما بعدها
  const NON_JOIN = new Set(Array.from('اأإآٱدذرزوؤةىء'));
  const FINAL_ONLY = new Set(Array.from('ىة'));
  const isLetter = (c) => !!c && /[\u0621-\u064A\u0671-\u06D3]/.test(c);
  const joins = (c) => isLetter(c) && !NON_JOIN.has(c);
  // يقرر هل الجزء سلسلة حروف منفصلة بترتيب منطقي (تبقى كما هي) أم حرف مركّب انعكست حروفه (يُعكس).
  // الحرف المنفصل يُخزَّن بصيغته الأساسية، والمتصل بصيغة عرض (FExx)؛ لذا فالسلسلة المنطقية لا تحتوي حرفًا متصلًا بجاره.
  function fixLigature(p, prev, next) {
    if (!/^[\u0621-\u064A\u0671-\u06D3]{2,4}$/.test(p)) return p;
    const a = Array.from(p);
    let logical = !joins(prev) && (!joins(a[a.length - 1]) || !isLetter(next));
    for (let i = 0; i < a.length - 1 && logical; i++) if (joins(a[i]) || FINAL_ONLY.has(a[i])) logical = false;
    if (logical) return p;
    const rev = a.slice().reverse();
    for (let i = 0; i < rev.length - 1; i++) if (!joins(rev[i])) return p;
    return rev.join('');
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
          const raw = it.str.replace(/\s+/g, ' ').trim();
          if (!raw) continue;
          const last = words[words.length - 1];
          const gap = last ? it.x - last.right : Infinity;
          if (last && gap < Math.max(1.2, it.h * 0.18)) {
            last.parts.push(raw); last.right = Math.max(last.right, it.x + it.w);
          } else {
            words.push({ left: it.x, right: it.x + it.w, parts: [raw], h: it.h });
          }
        }
        // 2) الكلمة العربية تُقرأ من اليمين لليسار، والأرقام/اللاتيني من اليسار لليمين.
        //    في ملفات الحروف المنفردة (مثل تقارير منصة تميز) تُخزَّن حروف الحرف المركّب (ligature)
        //    بترتيب بصري، فتُعكس داخل الجزء الواحد (مثل «ني» ← «ين»).
        for (const w of words) {
          const joinedRaw = w.parts.join('');
          if (/[؀-ۿﭐ-﻿]/.test(joinedRaw)) {
            const glyphLevel = w.parts.length > 1;
            const logicalParts = w.parts.slice().reverse();
            const fixed = [];
            for (let k = 0; k < logicalParts.length; k++) {
              const prevPart = fixed[k - 1] ? normalize(fixed[k - 1]) : '';
              const nextPart = logicalParts[k + 1] ? normalize(logicalParts[k + 1]) : '';
              fixed.push(fixLigature(logicalParts[k], prevPart.slice(-1), nextPart.charAt(0)));
            }
            let t = normalize(fixed.join(''));
            if (reversed && !glyphLevel) t = reverseVisual(t);
            w.text = t;
          } else {
            w.text = normalize(joinedRaw);
          }
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
    const textChars = pages.reduce((a, items) => a + items.reduce((b, it) => b + it.str.trim().length, 0), 0);
    return { lines, numPages: pdf.numPages, reversed, textChars, pdf };
  }

  // ———— الرموز ————
  // الإصدار الثالث: رمز رباعي «1-2-1-3» (المجال-المعيار-المجموعة-المؤشر)، والإصدارات السابقة ثلاثي «1.2.3»
  const codeParts = (c) => String(c || '').split(/[.\-]/).filter(Boolean).map((x) => parseInt(x, 10));
  const normCode = (c) => codeParts(c).join('-');
  const domainOf = (c) => String(codeParts(c)[0] || '');
  const standardOf = (c) => codeParts(c).slice(0, 2).join('-');
  function cmpCode(a, b) {
    const pa = codeParts(a.code != null ? a.code : a), pb = codeParts(b.code != null ? b.code : b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  // ———— التحليل النصي ————
  const CODE4_RE = /(?<![\d.\-])([1-6])\s?[.\-]\s?(\d{1,2})\s?[.\-]\s?(\d{1,2})\s?[.\-]\s?(\d{1,2})(?![\d])/g;
  const CODE_RE = /(?<![\d.\-])([1-6])\s?[.\-]\s?(\d{1,2})\s?[.\-]\s?(\d{1,2})(?![\d]|[.\-]\d)/g;
  const STD_RE = /(?<![\d.\-])([1-6])\s?[.\-]\s?(\d{1,2})(?![\d]|\s?[.\-]\s?\d)/g;
  const PCT_RE = /(\d{1,3}(?:\.\d{1,4})?)\s?%|%\s?(\d{1,3}(?:\.\d{1,4})?)/g;
  const NUM_RE = /(?<![\d.])(\d{1,3}(?:\.\d{1,4})?)(?![\d.])/g;
  const ORDINALS = { 'الأول': '1', 'الاول': '1', 'الثاني': '2', 'الثالث': '3', 'الرابع': '4', 'الخامس': '5' };
  const LEVEL_WORDS = /(التميز|التقدم|الانطلاق|التهيئة|تميّز|تميز|تقدّم|تقدم|انطلاق|تهيئة|متميز|متقدم|منجز|بحاجة إلى (?:تطوير|دعم|تحسين))/g;
  const DOMAIN_NAMES = { 'الإدارة المدرسية': '1', 'التعليم والتعلم': '2', 'نواتج التعلم': '3', 'البيئة المدرسية': '4' };

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
    return t.replace(CODE4_RE, ' ').replace(CODE_RE, ' ').replace(PCT_RE, ' ').replace(/\|/g, ' ')
      .replace(/(?<![؀-ۿ])\d+(?:\.\d+)?(?![؀-ۿ])/g, ' ')
      .replace(LEVEL_WORDS, ' ')
      .replace(/[()\[\]:%\-–—•·]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function stageFrom(text) {
    if (/ثانوي/.test(text)) return 'الثانوية';
    if (/متوسط/.test(text)) return 'المتوسطة';
    if (/ابتدائ/.test(text)) return 'الابتدائية';
    if (/روضة|رياض الأطفال|الطفولة المبكرة/.test(text)) return 'رياض الأطفال';
    return '';
  }

  function detectMeta(full) {
    const meta = {};
    const grab = (re) => { const m = full.match(re); return m ? m[1].replace(/\|/g, ' ').trim() : ''; };
    meta.schoolName = grab(/(?:اسم المدرسة)\s*[:：]\s*([^\n|]{3,80})/);
    meta.ministryCode = grab(/(?:الرقم الوزاري|رقم المدرسة|الرمز الوزاري)\s*[:：]?\s*(S-?M?\d{4,10}|\d{4,10})/) || grab(/\b(S-M?\d{4,10})\b/);
    meta.region = grab(/الإدارة العامة للتعليم\s*(?:ب|في)?\s*([^\n|]{2,40})/) || grab(/إدارة\s+(?:التعليم|تعليم)\s+(?:ب|في)?\s*([^\n|]{2,40})/);
    meta.office = grab(/مكتب\s+(?:التعليم|تعليم)\s+(?:ب|في)?\s*([^\n|]{2,40})/);
    meta.stage = grab(/المرحلة(?: الدراسية)?\s*[:：]?\s*(الابتدائية|المتوسطة|الثانوية|رياض الأطفال|الطفولة المبكرة)/);
    if (/التقويم الخارجي|المراجعة الخارجية/.test(full) && !/بعد تنفيذ التقويم الخارجي/.test(full)) meta.type = 'external';
    else if (/الدورة الثانية|دورة التقويم الثانية/.test(full)) meta.type = 'self2';
    else meta.type = 'self1';
    meta.edition3 = /الإصدار الثالث|1447|1448|\d-\d{1,2}-\d{1,2}-\d{1,2}/.test(full);
    const y = full.match(/(14\d\d)\s?ه/);
    meta.year = y ? y[1] : '';
    return meta;
  }

  function parseLines(lines) {
    const texts = lines.map((l) => (typeof l === 'string' ? normalize(l) : l.text));
    const full = texts.join('\n');
    if (isPlanReport(full)) return parsePlanReport(texts);
    const meta = detectMeta(full);
    const hasSurvey = /استبان/.test(full);
    const indicators = new Map();
    const standards = new Map();
    const domains = new Map();
    let overall = null;

    const codesIn = (t) => {
      const out = [];
      let m;
      CODE4_RE.lastIndex = 0;
      while ((m = CODE4_RE.exec(t))) out.push(`${m[1]}-${+m[2]}-${+m[3]}-${+m[4]}`);
      const rest = t.replace(CODE4_RE, ' ');
      CODE_RE.lastIndex = 0;
      while ((m = CODE_RE.exec(rest))) out.push(`${m[1]}-${+m[2]}-${+m[3]}`);
      return out;
    };

    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (overall == null && /(الأداء العام|النتيجة العامة|النتيجة الكلية|الدرجة الكلية|المستوى العام|الأداء الكلي|النسبة العامة|المتوسط العام)/.test(t)) {
        const p = pcts(t).concat(pcts(texts[i + 1] || ''));
        if (p.length) overall = p[0];
      }
      const codes = codesIn(t);
      if (codes.length) {
        let values = pcts(t);
        let text = cleanText(t);
        for (let j = i + 1; j < Math.min(texts.length, i + 4); j++) {
          if (codesIn(texts[j]).length || /المعيار|المجال|تشير النتائج/.test(texts[j])) break;
          const extra = cleanText(texts[j]);
          if (!values.length) values = pcts(texts[j]);
          if (extra && text.length < 160 && /[؀-ۿ]{3}/.test(extra) && !/صفحة|الصفحة/.test(extra)) text += ' ' + extra;
        }
        if (!values.length) {
          const stripped = t.replace(CODE4_RE, ' ').replace(CODE_RE, ' ');
          NUM_RE.lastIndex = 0;
          let n;
          while ((n = NUM_RE.exec(stripped))) { const v = parseFloat(n[1]); if (v <= 100) values.push(v); }
        }
        // مقترح التحسين الوارد في التقرير
        let suggestion = '';
        for (let j = i + 1; j < Math.min(texts.length, i + 8); j++) {
          if (codesIn(texts[j]).length) break;
          if (/تشير النتائج/.test(texts[j]) || suggestion) suggestion += (suggestion ? ' ' : '') + texts[j];
        }
        const code = codes[0];
        if (!indicators.has(code) || (indicators.get(code).score == null && values.length)) {
          indicators.set(code, {
            code, oldCode: codes[1] && codes[1] !== code ? codes[1] : '',
            text: text.slice(0, 260), score: values.length ? values[0] : null,
            survey: hasSurvey && values.length > 1 ? values[1] : null, values, suggestion: suggestion.slice(0, 600),
          });
        }
        continue;
      }
      STD_RE.lastIndex = 0;
      if (/المعيار/.test(t) || (STD_RE.test(t) && pcts(t).length)) {
        STD_RE.lastIndex = 0;
        const sm = STD_RE.exec(t);
        STD_RE.lastIndex = 0;
        const p = pcts(t);
        if (sm && p.length && !/^\d+\.\d+\s?%/.test(sm[0])) {
          const code = `${sm[1]}-${+sm[2]}`;
          const name = cleanText(t.replace(/المعيار/, '')).replace(STD_RE, '').trim();
          if (!standards.has(code)) standards.set(code, { code, name: name.slice(0, 80), score: p[0] });
          continue;
        }
      }
      if (/المجال/.test(t)) {
        const p = pcts(t);
        let code = null;
        const dm = t.match(/المجال\s*(?:رقم)?\s*\(?([1-6])\)?/);
        if (dm) code = dm[1];
        else for (const k in ORDINALS) if (t.includes('المجال ' + k)) code = ORDINALS[k];
        if (!code) for (const k in DOMAIN_NAMES) if (t.replace(/ّ/g, '').includes(k)) code = DOMAIN_NAMES[k];
        if (code && p.length && !domains.has(code)) {
          const name = cleanText(t.replace(/المجال\s*(?:رقم)?\s*\(?[1-6]?\)?/, '')).replace(/الأول|الثاني|الثالث|الرابع|الخامس/, '').trim();
          domains.set(code, { code, name: name.slice(0, 60), score: p[0] });
        }
      }
    }
    return {
      kind: 'self', meta, overall, hasSurvey,
      domains: [...domains.values()], standards: [...standards.values()],
      indicators: [...indicators.values()].sort(cmpCode), lineCount: texts.length,
    };
  }

  // ———— تقرير «خطة تحسين» الصادر من منصة تميز ————
  const isPlanReport = (full) => /إجراءات خطة التحسين|\|\s*الإجراء\s+\d+/.test(full);
  const SECTION = { need: /^وصف الاحتياج$/, procedures: /^إجراءات التحسين$/, mechanisms: /^آليات تنفيذ إجراءات التحسين$/, owner: /^مسؤولية التنفيذ$/ };
  const NOISE = /^(منصة تميز الرقمية|العام الدراسي \d{4} ه \|)|^[ً-ًْ\s.]*$/;

  // تقسيم نص البنود: «• بند» أو «.1 بند» أو «-1 بند» أو «1. بند»
  function splitItems(text) {
    const t = ' ' + text.replace(/\s+/g, ' ') + ' ';
    let parts;
    if (/•/.test(t)) parts = t.split('•');
    else parts = t.split(/\s(?:[.\-]\d{1,2}|\d{1,2}[.\-\)])\s/);
    return parts.map((x) => x.replace(/^[\s.،\-]+|[\s.،\-]+$/g, '').trim()).filter((x) => x.length > 2);
  }

  function parsePlanReport(texts) {
    const full = texts.join('\n');
    const meta = detectMeta(full);
    meta.kind = 'plan';
    const ref = full.match(/مرجع\s*[:：]?\s*(REF-[\w-]+)/);
    if (ref) meta.ref = ref[1];
    // الاسم الكامل من سطر العنوان: «اسم المدرسة | العام الدراسي 1448 ه»
    const titleLine = texts.find((l) => /\|\s*العام الدراسي\s*\d{4}/.test(l) && !/خطة تحسين -/.test(l));
    if (titleLine) meta.schoolName = titleLine.split('|')[0].trim();
    const valuesAfter = (label) => {
      const i = texts.findIndex((l) => l.includes(label) && l.includes('|'));
      if (i < 0 || !texts[i + 1]) return null;
      const keys = texts[i].split('|').map((x) => x.trim()), vals = texts[i + 1].split('|').map((x) => x.trim());
      const o = {};
      keys.forEach((k, j) => { o[k] = vals[j] || ''; });
      return o;
    };
    const b1 = valuesAfter('الرقم الوزاري') || {};
    const b2 = valuesAfter('نوع السلطة') || {};
    if (!meta.ministryCode) { const m = full.match(/\b(S-M?\d{4,10})\b/); if (m) meta.ministryCode = m[1]; }
    const row1 = Object.values(b1).join(' | ');
    const st = row1.match(/(الابتدائية|المتوسطة|الثانوية|رياض الأطفال)/);
    meta.stage = st ? st[1] : stageFrom(meta.schoolName || '');
    const gd = row1.match(/(بنين|بنات)/);
    if (gd) meta.gender = gd[1];
    if (b2['الفترة الدراسية']) meta.shift = b2['الفترة الدراسية'];
    if (b2['نوع السلطة']) meta.authority = b2['نوع السلطة'];
    if (b2['نوع المشاركة']) meta.participation = b2['نوع المشاركة'];
    const lv = full.match(/مستوى الأداء العام\s*\|?\s*(التميز|التقدم|الانطلاق|التهيئة)/);
    if (lv) meta.overallLevel = lv[1];
    const lo = full.match(/مستوى نواتج التعلم\s*\|?\s*(التميز|التقدم|الانطلاق|التهيئة)/);
    if (lo) meta.outcomesLevel = lo[1];
    meta.type = meta.type || 'self1';

    const actions = [];
    let cur = null, sec = null;
    const tailStart = texts.findIndex((l) => /^(ثالثا|ثالثًا)\s*[:：]/.test(l.trim()));
    const end = tailStart >= 0 ? tailStart : texts.length;
    for (let i = 0; i < end; i++) {
      const l = texts[i].trim();
      if (NOISE.test(l)) continue;
      const am = l.match(/^(.*?)\s*\|\s*الإجراء\s+(\d+)$/) || l.match(/^الإجراء\s+(\d+)\s*\|\s*(.*)$/);
      if (am) {
        let title = (/^الإجراء/.test(l) ? am[2] : am[1]).trim();
        const n = +(/^الإجراء/.test(l) ? am[1] : am[2]);
        if (!title && texts[i + 1] && !/مدة الإنجاز/.test(texts[i + 1])) { title = texts[i + 1].trim(); i++; }
        cur = { n, text: title, start: '', end: '', domain: '', standard: '', need: '', procedures: '', mechanisms: '', owner: '' };
        actions.push(cur); sec = null;
        continue;
      }
      if (!cur) continue;
      const dm = l.match(/مدة الإنجاز\s*[:：]?\s*(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
      if (dm) {
        cur.start = dm[1]; cur.end = dm[2];
        const dd = l.match(/المجال\s*[:：]\s*(.*?)\s*المعيار\s*[:：]\s*(.*)$/);
        if (dd) { cur.domain = dd[1].trim(); cur.standard = dd[2].trim(); }
        continue;
      }
      let hit = null;
      for (const k in SECTION) if (SECTION[k].test(l)) hit = k;
      if (hit) { sec = hit; continue; }
      if (sec) cur[sec] += (cur[sec] ? ' ' : '') + l;
    }
    // ثالثًا: توصيات ومقترحات التحسين (مرقّمة حسب المجال) — رابعًا: الاعتماد
    const recommendations = [];
    if (tailStart >= 0) {
      const approvalAt = texts.findIndex((l, k) => k > tailStart && /^(رابعا|رابعًا)\s*[:：]/.test(l.trim()));
      const block = texts.slice(tailStart + 1, approvalAt > 0 ? approvalAt : texts.length).filter((l) => !NOISE.test(l.trim()) && !/الصفحة \d+ من/.test(l)).join(' ');
      block.split(/(?:^|\s)(\d)\s*-\s+/).reduce((acc, part, k, arr) => {
        if (k % 2 === 1) recommendations.push({ domain: part, items: arr[k + 1].split(/-\s*\.|\s-\s(?=[\u0600-\u06FF])/).map((x) => x.replace(/^[\s.\-]+|[\s.\-]+$/g, '').trim()).filter((x) => x.length > 3) });
        return acc;
      }, null);
      // الأسطر الملحقة بلا رقم تُضاف للمجال الأخير
      if (approvalAt > 0) {
        const ai = texts.findIndex((l, k) => k > approvalAt && /تاريخ التقديم/.test(l));
        if (ai > 0 && texts[ai + 1]) {
          const [d, name] = texts[ai + 1].split('|').map((x) => x.trim());
          meta.submittedAt = (d || '').replace(/\s+/g, '');
          meta.principal = name || '';
        }
      }
    }

    for (const a of actions) {
      a.procedureItems = splitItems(a.procedures);
      a.mechanismItems = splitItems(a.mechanisms);
      a.owner = a.owner.replace(/\s*\+\s*/g, '، ');
      a.domainCode = DOMAIN_NAMES[a.domain] || '';
    }
    return { kind: 'plan', meta, overall: null, actions, recommendations, domains: [], standards: [], indicators: [], lineCount: texts.length };
  }

  // تشابه نصّين عربيين (لمطابقة إجراءات الخطة بالمؤشرات)
  function similarity(a, b) {
    const tok = (s) => new Set(normalize(s).replace(/[^ء-ي ]/g, ' ').split(/\s+/).filter((w) => w.length > 2).map((w) => w.replace(/^(وال|بال|لل|ال|و)/, '')));
    const A = tok(a), B = tok(b);
    let inter = 0;
    A.forEach((w) => { if (B.has(w)) inter++; });
    return inter / Math.max(1, A.size + B.size - inter);
  }

  global.TahseenParser = { extractPdf, parseLines, parsePlanReport, normalize, cmpCode, codeParts, normCode, domainOf, standardOf, stageFrom, similarity, reverseVisual, splitItems };
})(window);

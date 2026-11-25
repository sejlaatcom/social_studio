/* تحسين — قراءة تقارير التقويم الذاتي المصوّرة (بدون طبقة نص) بالتعرف الضوئي داخل المتصفح */
(function (global) {
  'use strict';
  const BASE = 'vendor/tesseract/';
  const LEVEL_COLORS = [
    { key: 'excellence', rgb: [8, 148, 85] },
    { key: 'advanced', rgb: [20, 112, 239] },
    { key: 'launch', rgb: [220, 104, 3] },
    { key: 'prep', rgb: [215, 40, 40] },
  ];

  let workers = null;
  async function getWorkers(onStatus) {
    if (workers) return workers;
    if (!global.Tesseract) throw new Error('مكتبة التعرف الضوئي غير محمّلة');
    const opts = { workerPath: BASE + 'worker.min.js', corePath: BASE, langPath: BASE + 'lang', gzip: true, workerBlobURL: false };
    if (onStatus) onStatus('تحميل محرك التعرف الضوئي…');
    const [eng, ara] = await Promise.all([
      global.Tesseract.createWorker('eng', 1, opts),
      global.Tesseract.createWorker('ara', 1, opts),
    ]);
    workers = { eng, ara };
    return workers;
  }
  async function terminate() { if (workers) { await workers.eng.terminate(); await workers.ara.terminate(); workers = null; } }

  // ———— أدوات الصور ————
  async function renderPage(pdf, n) {
    const page = await pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = 1654 / vp1.width;
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return { canvas: c, ctx, data: ctx.getImageData(0, 0, c.width, c.height).data, W: c.width, H: c.height };
  }
  const px = (img, x, y) => { const i = (y * img.W + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  const sat = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]);

  // مقطع مع تحويل لثنائي: mode 'light' = نص أبيض على خلفية ملونة، 'dark' = نص داكن على خلفية فاتحة
  function crop(img, x0, y0, x1, y1, mode, upscale) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); x1 = Math.min(img.W, Math.round(x1)); y1 = Math.min(img.H, Math.round(y1));
    const w = x1 - x0, h = y1 - y0, k = upscale || 2;
    const c = document.createElement('canvas');
    c.width = w * k; c.height = h * k;
    const ctx = c.getContext('2d');
    const src = img.ctx.getImageData(x0, y0, w, h);
    const d = src.data;
    for (let i = 0; i < d.length; i += 4) {
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const gray = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const ink = mode === 'light' ? mn > 170 : gray < 150;
      const v = ink ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').putImageData(src, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(tmp, 0, 0, c.width, c.height);
    return c;
  }

  // صناديق مستوى الأداء الملونة في عمود اليسار
  function findBoxes(img, xFrac, yFrom, yTo, minH, maxH) {
    const x = Math.round(img.W * xFrac);
    const runs = [];
    let cur = null;
    for (let y = Math.round(img.H * (yFrom || 0)); y < Math.round(img.H * (yTo || 1)); y++) {
      if (sat(px(img, x, y)) > 60) {
        if (cur && y - cur.b <= 6) cur.b = y; else { if (cur) runs.push(cur); cur = { t: y, b: y }; }
      }
    }
    if (cur) runs.push(cur);
    return runs.filter((r) => r.b - r.t >= (minH || 50) && r.b - r.t <= (maxH || 240)).map((r) => {
      const yy = Math.min(r.b, r.t + 6);
      let l = x, rr = x;
      while (l > 0 && sat(px(img, l - 1, yy)) > 60) l--;
      while (rr < img.W / 2 && sat(px(img, rr + 1, yy)) > 60) rr++;
      const c = px(img, x, Math.round(r.t + 6));
      let best = null, bd = 1e9;
      for (const lc of LEVEL_COLORS) {
        const dd = (c[0] - lc.rgb[0]) ** 2 + (c[1] - lc.rgb[1]) ** 2 + (c[2] - lc.rgb[2]) ** 2;
        if (dd < bd) { bd = dd; best = lc.key; }
      }
      return { top: r.t, bottom: r.b, left: l, right: rr, level: best };
    });
  }

  // أعمدة المخططات: مستطيلات ملونة رأسية، تُقرأ قيمتها من التسمية فوقها
  function findBars(img, yFrom, yTo) {
    const step = 2, minRun = 14;
    const y0 = Math.round(img.H * yFrom), y1 = Math.round(img.H * yTo);
    let open = [];
    const done = [];
    for (let x = 0; x < img.W; x += step) {
      const segs = [];
      let top = -1, bottom = -1;
      for (let y = y0; y <= y1; y++) {
        const on = y < y1 && sat(px(img, x, y)) > 70;
        if (on) { if (top < 0) top = y; bottom = y; } else if (top >= 0) { if (bottom - top >= minRun) segs.push({ t: top, b: bottom }); top = -1; }
      }
      const next = [];
      for (const sg of segs) {
        const bar = open.find((o) => !o.used && Math.abs(o.b - sg.b) < 6);
        if (bar) { bar.used = true; bar.x1 = x; bar.t = Math.min(bar.t, sg.t); next.push(bar); }
        else next.push({ x0: x, x1: x, t: sg.t, b: sg.b, used: true });
      }
      for (const o of open) if (!o.used) done.push(o);
      open = next.map((o) => { o.used = false; return o; });
    }
    done.push(...open);
    return done.filter((b) => b.x1 - b.x0 >= img.W * 0.02 && b.x1 - b.x0 <= img.W * 0.07 && b.b - b.t >= minRun)
      .map(({ x0, x1, t, b }) => ({ x0, x1, t, b }));
  }
  async function readBars(img, w, bars) {
    const out = [];
    for (const b of bars) {
      const cx = (b.x0 + b.x1) / 2, half = img.W * 0.045;
      const t = await ocrText(w.eng, crop(img, cx - half, b.t - img.H * 0.022, cx + half, b.t - 2, 'dark', 2), 7, '0123456789.%');
      out.push({ v: numFrom(t), x: cx, b: b.b, t: b.t });
    }
    return out;
  }

  async function ocrText(worker, canvas, psm, whitelist) {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm), tessedit_char_whitelist: whitelist || '' });
    const r = await worker.recognize(canvas);
    return r.data.text || '';
  }
  async function ocrWords(worker, canvas, psm, whitelist) {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm), tessedit_char_whitelist: whitelist || '' });
    const r = await worker.recognize(canvas, {}, { blocks: true, text: true });
    const words = [], lines = [];
    for (const b of r.data.blocks || []) for (const p of b.paragraphs) for (const l of p.lines) {
      lines.push({ text: l.text.trim(), x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1 });
      for (const w of l.words) words.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, conf: w.confidence });
    }
    return { words, lines, text: r.data.text || '' };
  }

  const numFrom = (s) => {
    const m = String(s).replace(/,/g, '.').match(/(\d{1,3}(?:\.\d{1,4})?)/);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return v >= 0 && v <= 100 ? v : null;
  };
  const LEVEL_MIN = { excellence: [90, 100], advanced: [75, 90], launch: [50, 75], prep: [0, 50] };
  const levelMatches = (v, key) => { const r = LEVEL_MIN[key]; return !r || (v >= r[0] && (v < r[1] || (key === 'excellence' && v <= 100))); };
  // خطأ شائع: قراءة الرقم 9 الأول على أنه 2 أو 3
  function fixLeading(v, key) {
    if (v == null) return null;
    const s = String(v);
    for (const d of ['9', '8', '7', '6', '5', '4']) {
      const c = parseFloat(d + s.slice(1));
      if (levelMatches(c, key)) return c;
    }
    return levelMatches(v, key) ? v : null;
  }
  // تصحيح أخطاء التعرف الشائعة في الكلمات العربية
  const AR_FIX = [[/(^|\s)(?:لل|الل|ال)(درسة|درسي|درسية|تعلمين|تعلمون|ؤشر|جتمع|جتمعية|ستهدفة|ناهج|مارسات|رافق|واصفات|عتمدة|حافظة|ستقبل|هنية|عايير)/g, '$1الم$2'],
    [/الهيئة|البيئة(?= بشكل)/g, 'الهيئة'], [/مبف|مب(?= )/g, 'مبنى'], [/البق/g, 'المبنى'], [/ففا/g, 'فقا'], [/,/g, '،']];
  const fixAr = (s) => AR_FIX.reduce((t, [re, rep]) => t.replace(re, rep), s);
  const cleanAr = (s) => fixAr(global.TahseenParser.normalize(String(s || '').replace(/\n+/g, ' ')).replace(/\s+/g, ' ').trim());

  async function readIndicatorPage(img, w, boxes) {
    const out = [];
    const page = await ocrWords(w.ara, img.canvas, 3);
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      // قراءة النسبة مع التحقق من اتساقها مع لون المستوى
      const cands = [];
      cands.push(numFrom(await ocrText(w.eng, crop(img, b.left + 4, b.top + 2, b.right - 4, b.top + (b.bottom - b.top) * 0.55, 'light'), 7, '0123456789.%')));
      let score = cands[0];
      if (score == null || !levelMatches(score, b.level)) {
        cands.push(numFrom(await ocrText(w.eng, crop(img, b.left + 4, b.top + 2, b.right - 4, b.top + (b.bottom - b.top) * 0.55, 'light', 3), 8, '0123456789.%')));
        cands.push(numFrom(await ocrText(w.eng, crop(img, b.left + 2, b.top, b.right - 2, b.bottom, 'light', 2), 6, '0123456789.%')));
        score = cands.find((v) => v != null && levelMatches(v, b.level));
        if (score == null) score = fixLeading(cands.find((v) => v != null), b.level);
      }
      const codeTxt = await ocrText(w.eng, crop(img, img.W * 0.80, b.top, img.W * 0.955, b.bottom, 'dark'), 7, '0123456789-');
      const cm = codeTxt.replace(/\s/g, '').match(/(\d)-(\d{1,2})-(\d{1,2})-(\d{1,2})/);
      const nextTop = boxes[i + 1] ? boxes[i + 1].top : img.H * 0.92;
      const inText = (l) => l.x1 > img.W * 0.19 && l.x0 < img.W * 0.80;
      const titleLines = page.lines.filter((l) => inText(l) && (l.y0 + l.y1) / 2 >= b.top && (l.y0 + l.y1) / 2 <= b.bottom).sort((a, c) => a.y0 - c.y0);
      const sugLines = page.lines.filter((l) => l.x1 > img.W * 0.04 && (l.y0 + l.y1) / 2 > b.bottom && (l.y0 + l.y1) / 2 < nextTop).sort((a, c) => a.y0 - c.y0);
      out.push({
        code: cm ? `${cm[1]}-${cm[2]}-${cm[3]}-${cm[4]}` : '',
        score, levelKey: b.level,
        text: cleanAr(titleLines.map((l) => l.text).join(' ')).replace(/^[\d\-\s]+|[\d\-\s]+$/g, ''),
        suggestion: cleanAr(sugLines.map((l) => l.text).join(' ')),
      });
    }
    return out;
  }

  async function readSummaryPage(img, w, res) {
    const ar = await ocrWords(w.ara, img.canvas, 3);
    const t = cleanAr(ar.text);
    const en = await ocrWords(w.eng, img.canvas, 11, '0123456789.%-SM');
    const pcts = en.words.filter((x) => /^\d{1,3}(\.\d{1,4})?%$/.test(x.text) && x.conf > 50)
      .map((x) => ({ v: parseFloat(x.text), x: (x.x0 + x.x1) / 2, y: (x.y0 + x.y1) / 2 }));
    if (/دورة التقويم الثانية/.test(t)) res.meta.type = 'self2';
    else if (/دورة التقويم الأولى|دورة التقويم الاولى/.test(t)) res.meta.type = res.meta.type || 'self1';
    if (/التقويم الخارجي/.test(t) && !/بعد تنفيذ التقويم الخارجي/.test(t)) res.meta.type = 'external';

    if (/البيانات الأساسية|وفق المجالات/.test(t)) {
      // البيانات الأساسية
      const nameLine = ar.lines.find((l) => /الرقم الوزاري/.test(l.text)) || ar.lines.find((l) => /^(ابتدائية|متوسطة|ثانوية|مجمع|روضة|مدرسة)/.test(cleanAr(l.text)));
      if (nameLine) res.meta.schoolName = cleanAr(nameLine.text.replace(/الرقم الوزاري.*$/, '').replace(/[:：]/g, ''));
      if (nameLine) {
        const codeTxt = await ocrText(w.eng, crop(img, img.W * 0.03, nameLine.y0 - 6, nameLine.x0 + 20 > img.W * 0.6 ? img.W * 0.6 : img.W * 0.6, nameLine.y1 + 6, 'dark'), 7, 'SM-0123456789:');
        const cm = codeTxt.match(/S-?M?\d{4,10}/);
        if (cm) res.meta.ministryCode = cm[0].replace(/^S(?!-)/, 'S-');
      }
      const adm = t.match(/الإدارة العامة للتعليم\s*(?:ب|في)?\s*([ء-ي]+(?:\s+ال[ء-ي]+)?)/);
      if (adm) res.meta.region = adm[1].replace(/^ب(?=ال)/, '').trim();
      // اسم المنطقة قد ينكسر إلى السطر التالي (مثل: «بالمنطقة» ثم «الشرقية»)
      if (res.meta.region && /^المنطقة$/.test(res.meta.region)) {
        const li = ar.lines.findIndex((l) => /الإدارة العامة للتعليم/.test(cleanAr(l.text)));
        const nx = li >= 0 && ar.lines[li + 1] ? cleanAr(ar.lines[li + 1].text) : '';
        const w2 = nx.match(/^(ال[\u0621-\u064A]+)/);
        if (w2 && !/الأداء|المدرسة/.test(w2[1])) res.meta.region += ' ' + w2[1];
      }
      if (/\bبنات\b/.test(t)) res.meta.gender = 'بنات'; else if (/\bبنين\b/.test(t)) res.meta.gender = 'بنين';
      const auth = t.match(/السلطة[\s\S]{0,60}?(تعليمي|حكومي|أهلي|عالمي)/);
      if (auth) res.meta.authority = auth[1];
      const stud = en.words.filter((x) => /^\d{2,5}$/.test(x.text) && x.conf > 80 && x.y0 < img.H * 0.3 && x.x1 < img.W * 0.4);
      if (stud.length) res.meta.students = stud[0].text;
      // الأداء العام: الشريط الملون
      const pills = findBoxes(img, 0.075, 0.33, 0.5, 18, 90);
      if (pills.length) {
        const p = pills[0];
        const v = numFrom(await ocrText(w.eng, crop(img, p.left, p.top, p.right, p.bottom, 'light', 3), 7, '0123456789.%'));
        if (v != null) { res.overall = v; res.overallLevel = p.level; }
      }
      // المجالات: الأعمدة من اليمين لليسار
      let bars = await readBars(img, w, findBars(img, 0.45, 0.76));
      bars.sort((a, b) => b.x - a.x);
      if (bars.filter((b) => b.v != null).length < 4) bars = pcts.filter((p) => p.y > img.H * 0.45 && p.y < img.H * 0.8).sort((a, b) => b.x - a.x);
      bars.slice(0, 4).forEach((p, k) => { res.domains.push({ code: String(k + 1), score: p.v }); });
    }
    if (/وفق المعايير/.test(t)) {
      const bars = await readBars(img, w, findBars(img, 0.08, 0.93));
      const rows = [];
      for (const b of bars.sort((a, c) => a.b - c.b)) {
        const last = rows[rows.length - 1];
        if (last && Math.abs(b.b - last.b) < img.H * 0.06) last.items.push(b); else rows.push({ b: b.b, items: [b] });
      }
      res.standardValues = rows.flatMap((r) => r.items.sort((a, c) => c.x - a.x)).map((b) => b.v);
    }
  }

  async function readImageReport(pdf, onProgress) {
    const w = await getWorkers((s) => onProgress && onProgress(s));
    const res = { meta: {}, overall: null, overallLevel: null, domains: [], standards: [], indicators: [], standardValues: null, ocr: true };
    for (let n = 1; n <= pdf.numPages; n++) {
      if (onProgress) onProgress(`التعرف الضوئي: الصفحة ${n} من ${pdf.numPages}…`);
      const img = await renderPage(pdf, n);
      const boxes = findBoxes(img, 0.07, 0.08, 0.95, 50, 240).filter((b) => b.left < img.W * 0.1 && b.right > img.W * 0.14 && b.right < img.W * 0.22);
      if (boxes.length) res.indicators.push(...(await readIndicatorPage(img, w, boxes)));
      else await readSummaryPage(img, w, res);
      img.canvas.width = img.canvas.height = 0;
    }
    return res;
  }

  global.TahseenOCR = { readImageReport, terminate, _dbg: { renderPage, findBars, readBars, getWorkers } };
})(window);

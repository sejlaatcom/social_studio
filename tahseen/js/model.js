/* تحسين — نموذج البيانات: الخطط، الدمج، الحسابات، القراءة التحليلية */
(function (global) {
  'use strict';
  const F = global.TahseenFramework;
  const P = global.TahseenParser;
  const cmpCode = P.cmpCode;
  const STORE_KEY = 'tahseen.plans.v1';

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const round1 = (v) => (v == null || isNaN(v) ? null : Math.round(v * 100) / 100);
  const avg = (arr) => { const a = arr.filter((v) => v != null && !isNaN(v)); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; };

  const REPORT_TYPES = {
    self1: 'التقويم الذاتي — الدورة الأولى',
    self2: 'التقويم الذاتي — الدورة الثانية',
    external: 'التقويم الخارجي',
  };
  const STATUS = { not: 'لم يبدأ', progress: 'قيد التنفيذ', done: 'منفّذ', late: 'متأخر' };

  function newPlan(title) {
    const now = new Date().toISOString();
    return {
      id: uid(), version: 2, title: title || 'خطة تحسين جديدة', createdAt: now, updatedAt: now,
      school: { name: '', ministryCode: '', region: '', office: '', stage: '', gender: 'بنين', students: '', teachers: '', classes: '',
        principal: '', deputy: '', supervisor: '', year: '', phone: '', email: '', address: '', logo: '',
        shift: '', authority: '', participation: '', ref: '' },
      report: { type: 'self1', edition3: true, date: '', source: '', planSource: '', overall: null, overallParsed: null, hasSurvey: false, outcomesLevel: '', platformLevel: '' },
      domains: F.DEFAULT_DOMAINS.map((d) => ({ ...d, score: null })),
      standards: F.DEFAULT_STANDARDS.map((s) => ({ ...s, score: null })),
      indicators: [],
      team: [
        { name: '', role: 'قائد المدرسة', task: 'رئيسًا' },
        { name: '', role: 'وكيل الشؤون التعليمية', task: 'نائبًا للرئيس' },
        { name: '', role: 'الموجه الطلابي', task: 'عضوًا' },
        { name: '', role: 'معلم', task: 'عضوًا ومقررًا' },
      ],
      decision: { number: '', date: '', notes: '' },
      approval: { preparedBy: '', principal: '', supervisor: '', date: '' },
      period: { start: '', end: '' },
      previous: null,
      settings: { includeAdvanced: true, includeExcellence: false, levels: F.LEVELS.map((l) => ({ ...l })) },
    };
  }

  // ترقية الخطط المحفوظة بالإصدار الأول (رموز نقطية ومستويات بأسماء قديمة)
  function migrate(p) {
    if (!p || p.version >= 2) return p;
    p.version = 2;
    p.settings = p.settings || {};
    if (p.settings.includeExcellence == null) p.settings.includeExcellence = false;
    if (p.settings.levels) p.settings.levels.forEach((l) => { const d = F.LEVELS.find((x) => x.key === l.key); if (d) l.name = d.name; });
    Object.assign(p.school, { shift: p.school.shift || '', authority: p.school.authority || '', participation: p.school.participation || '', ref: p.school.ref || '' });
    p.report.outcomesLevel = p.report.outcomesLevel || '';
    const fix = (x) => { if (x && x.code) x.code = P.normCode(x.code); };
    p.domains.forEach(fix); p.standards.forEach(fix); p.indicators.forEach((i) => { fix(i); if (i.oldCode) i.oldCode = P.normCode(i.oldCode); upgradeIndPlan(i); });
    return p;
  }
  function upgradeIndPlan(i) {
    if (!i.plan) return;
    if (i.plan.need == null) i.plan.need = '';
    if (!Array.isArray(i.plan.mechanisms)) i.plan.mechanisms = [];
    if (i.plan.suggestion == null) i.plan.suggestion = i.suggestion || '';
  }

  function levelsOf(plan) { return (plan && plan.settings && plan.settings.levels) || F.LEVELS; }
  function levelOf(plan, score) { return F.levelOf(score, levelsOf(plan)); }
  const stageOf = (plan) => plan.school.stage || P.stageFrom(plan.school.name || '');

  function makeIndicatorPlan(ind, plan) {
    const s = F.suggestFor(ind);
    const start = (plan.period && plan.period.start) || '';
    const end = (plan.period && plan.period.end) || '';
    const owner = s.team.split('،')[0].trim();
    return {
      initiative: s.initiative,
      need: s.need || '',
      suggestion: ind.suggestion || '',
      programs: s.programs.map((p, i) => ({
        id: uid(), name: p,
        method: s.fromBank ? 'إجراء تحسين' : i === 0 ? 'ورشة عمل / اجتماع' : i === 1 ? 'تطبيق ميداني ومتابعة' : 'لقاءات دورية',
        start, end, owner, status: 'not', completion: 0, achieved: null, note: '',
      })),
      mechanisms: (s.mechanisms || []).slice(),
      evidence: s.evidence.slice(),
      measure: s.measure,
      team: s.team,
      sustain: 'الاستمرار في تطبيق الممارسات الناجحة وتوثيقها وتعميمها',
      source: s.fromBank ? 'bank' : 'library',
      measurements: [
        { period: 'القياس القبلي', target: null, actual: null },
        { period: 'نهاية الفترة الأولى', target: null, actual: null },
        { period: 'نهاية الفترة الثانية', target: null, actual: null },
        { period: 'القياس البعدي', target: null, actual: null },
      ],
    };
  }

  function fillMeasurements(ind) {
    const m = ind.plan.measurements;
    if (ind.score == null || ind.target == null) return;
    const step = (ind.target - ind.score) / 3;
    if (m[0].target == null) m[0].target = round1(ind.score);
    if (m[0].actual == null) m[0].actual = round1(ind.score);
    if (m[1].target == null) m[1].target = round1(ind.score + step);
    if (m[2].target == null) m[2].target = round1(ind.score + step * 2);
    if (m[3].target == null) m[3].target = round1(ind.target);
  }

  function ensureIndicator(plan, ind) {
    if (ind.target == null && ind.score != null) ind.target = F.defaultTarget(ind.score, levelsOf(plan));
    if (!ind.plan) ind.plan = makeIndicatorPlan(ind, plan);
    upgradeIndPlan(ind);
    fillMeasurements(ind);
    return ind;
  }

  function mergeMeta(plan, m) {
    const sc = plan.school;
    const set = (k, v) => { if (v && !sc[k]) sc[k] = v; };
    set('name', m.schoolName); set('ministryCode', m.ministryCode); set('region', m.region); set('office', m.office);
    set('stage', m.stage || P.stageFrom(m.schoolName || '')); set('year', m.year); set('students', m.students);
    set('shift', m.shift); set('authority', m.authority); set('participation', m.participation); set('ref', m.ref);
    if (m.gender) sc.gender = m.gender;
    if (sc.name && /^خطة تحسين جديدة$/.test(plan.title)) plan.title = 'خطة تحسين ' + sc.name;
  }

  // دمج نتائج قراءة تقرير التقويم (نصّي أو بالتعرف الضوئي) مع المحافظة على التعديلات السابقة
  function applyParsed(plan, parsed, sourceName) {
    if (parsed.kind === 'plan') return applyPlanReport(plan, parsed, sourceName);
    const m = parsed.meta || {};
    if (m.type) plan.report.type = m.type;
    plan.report.edition3 = parsed.ocr ? true : (!!m.edition3 || plan.report.edition3);
    plan.report.source = sourceName || plan.report.source;
    plan.report.hasSurvey = !!parsed.hasSurvey;
    plan.report.overallParsed = parsed.overall;
    if (parsed.overall != null) plan.report.overall = parsed.overall;
    mergeMeta(plan, m);
    const stage = stageOf(plan);

    for (const d of parsed.domains || []) {
      const ex = plan.domains.find((x) => x.code === d.code);
      if (ex) { ex.score = d.score; if (d.name && d.name.length > 3) ex.name = d.name; } else plan.domains.push({ ...d });
    }
    for (const s of parsed.standards || []) {
      const code = P.normCode(s.code);
      const ex = plan.standards.find((x) => x.code === code);
      if (ex) { ex.score = s.score; if (s.name && s.name.length > 3) ex.name = s.name; } else plan.standards.push({ ...s, code });
    }
    // قيم المعايير المقروءة من المخطط بالترتيب الرسمي
    if (parsed.standardValues && parsed.standardValues.length) {
      const order = F.DEFAULT_STANDARDS.map((s) => s.code);
      parsed.standardValues.forEach((v, k) => { const st = plan.standards.find((x) => x.code === order[k]); if (st && v != null) st.score = v; });
    }
    for (const pi of parsed.indicators || []) {
      if (!pi.code) continue;
      const code = P.normCode(pi.code);
      const official = F.catalogText(code, stage);
      const text = official || pi.text;
      const ex = plan.indicators.find((x) => x.code === code);
      if (ex) {
        ex.score = pi.score; if (pi.survey != null) ex.survey = pi.survey;
        if (text && text.length > 5) ex.text = text;
        if (pi.oldCode) ex.oldCode = P.normCode(pi.oldCode);
        if (pi.suggestion) { ex.suggestion = pi.suggestion; if (ex.plan && !ex.plan.suggestion) ex.plan.suggestion = pi.suggestion; }
        ex.values = pi.values;
        if (ex.target == null && ex.score != null) ex.target = F.defaultTarget(ex.score, levelsOf(plan));
        if (ex.plan) { ex.plan.measurements.forEach((mm) => { mm.target = null; }); ex.plan.measurements[0].actual = null; }
        ensureIndicator(plan, ex);
      } else {
        plan.indicators.push(ensureIndicator(plan, { code, oldCode: pi.oldCode ? P.normCode(pi.oldCode) : '', text, score: pi.score, survey: pi.survey == null ? null : pi.survey,
          values: pi.values, suggestion: pi.suggestion || '', target: null }));
      }
    }
    sortAll(plan);
    recompute(plan);
    return { indicators: (parsed.indicators || []).length };
  }

  // استيراد تقرير «خطة تحسين» من منصة تميز: يملأ إجراءات كل مؤشر
  function applyPlanReport(plan, parsed, sourceName) {
    const m = parsed.meta || {};
    mergeMeta(plan, m);
    plan.report.planSource = sourceName || 'خطة منصة تميز';
    if (m.outcomesLevel) plan.report.outcomesLevel = m.outcomesLevel;
    if (parsed.recommendations && parsed.recommendations.length) plan.recommendations = parsed.recommendations;
    if (m.principal) { if (!plan.school.principal) plan.school.principal = m.principal; if (!plan.approval.principal) plan.approval.principal = m.principal; if (!plan.team[0].name) plan.team[0].name = m.principal; }
    if (m.submittedAt && !plan.approval.date) plan.approval.date = m.submittedAt;
    if (m.overallLevel) plan.report.platformLevel = m.overallLevel;
    const stage = stageOf(plan);
    const catalog = F.indicatorsFor(stage);
    let matched = 0, added = 0;
    const dates = [];
    const used = new Set();
    const key = (t) => P.normalize(t || '').replace(/[^\u0621-\u064A]/g, '');
    const pick = (list, text, min) => {
      let best = null, bs = 0;
      for (const c of list) { if (used.has(c.code)) continue; const sc = P.similarity(c.text, text); if (sc > bs) { bs = sc; best = c; } }
      return bs >= min ? best : null;
    };
    for (const a of parsed.actions || []) {
      if (!a.text) continue;
      const k = key(a.text);
      // 1) تطابق تام مع مؤشر في الخطة أو في الإطار، 2) أقرب نص غير مستخدم
      let ind = plan.indicators.find((i) => !used.has(i.code) && key(i.text) === k);
      if (!ind) {
        const cat = catalog.find((c) => !used.has(c.code) && key(c.text) === k) || pick(catalog, a.text, 0.75);
        if (cat) ind = plan.indicators.find((i) => i.code === cat.code);
        if (!ind) ind = pick(plan.indicators, a.text, 0.75);
        if (!ind) {
          const code = cat ? cat.code : nextFreeCode(plan, a);
          ind = ensureIndicator(plan, { code, oldCode: '', text: cat ? cat.text : a.text, score: null, survey: null, target: null, provisional: !!(cat && cat.provisional) });
          plan.indicators.push(ind); added++;
        }
      }
      used.add(ind.code);
      matched++;
      const pl = ind.plan;
      pl.need = a.need || pl.need;
      if (a.procedureItems && a.procedureItems.length) {
        pl.programs = a.procedureItems.map((name, k) => {
          const old = pl.programs[k] && pl.source === 'platform' ? pl.programs[k] : null;
          return { id: old ? old.id : uid(), name, method: 'إجراء تحسين', start: a.start, end: a.end, owner: (a.owner || '').split('،')[0].trim(),
            status: old ? old.status : 'not', completion: old ? old.completion : 0, achieved: old ? old.achieved : null, note: old ? old.note : '' };
        });
      }
      if (a.mechanismItems && a.mechanismItems.length) pl.mechanisms = a.mechanismItems.slice();
      if (a.owner) pl.team = a.owner;
      pl.source = 'platform';
      if (a.start) dates.push(a.start, a.end);
    }
    if (dates.length) {
      const sorted = dates.filter(Boolean).sort();
      if (!plan.period.start) plan.period.start = sorted[0];
      if (!plan.period.end) plan.period.end = sorted[sorted.length - 1];
    }
    plan.settings.includeExcellence = true;
    sortAll(plan);
    recompute(plan);
    return { matched, added };
  }

  function nextFreeCode(plan, a) {
    const std = (F.DEFAULT_STANDARDS.find((s) => s.name === a.standard) || {}).code || (a.domainCode ? a.domainCode + '-9' : '9-9');
    let n = 1;
    while (plan.indicators.some((i) => i.code === `${std}-9-${n}`)) n++;
    return `${std}-9-${n}`;
  }

  // تحميل مؤشرات الإطار للمرحلة (للإدخال اليدوي)
  function loadFramework(plan, stage) {
    let n = 0;
    for (const c of F.indicatorsFor(stage || stageOf(plan))) {
      if (plan.indicators.some((i) => i.code === c.code)) continue;
      plan.indicators.push(ensureIndicator(plan, { code: c.code, oldCode: '', text: c.text, score: null, survey: null, target: null, provisional: !!c.provisional }));
      n++;
    }
    sortAll(plan);
    recompute(plan);
    return n;
  }

  function sortAll(plan) { plan.indicators.sort(cmpCode); plan.domains.sort(cmpCode); plan.standards.sort(cmpCode); }

  function addIndicator(plan, code, text, score) {
    code = P.normCode(code);
    const ind = ensureIndicator(plan, { code, oldCode: '', text: text || F.catalogText(code, stageOf(plan)) || '', score: score == null || score === '' ? null : Number(score), survey: null, target: null });
    plan.indicators.push(ind);
    sortAll(plan);
    recompute(plan);
    return ind;
  }

  const inStandard = (i, s) => P.standardOf(i.code) === s.code;
  const inDomain = (i, d) => P.domainOf(i.code) === d.code;

  function recompute(plan) {
    for (const s of plan.standards) {
      const inds = plan.indicators.filter((i) => inStandard(i, s));
      s.computed = round1(avg(inds.map((i) => i.score)));
      s.count = inds.length;
    }
    for (const d of plan.domains) {
      const inds = plan.indicators.filter((i) => inDomain(i, d));
      d.computed = round1(avg(inds.map((i) => i.score)));
      d.count = inds.length;
    }
    plan.report.computedOverall = round1(avg(plan.indicators.map((i) => i.score)));
    plan.updatedAt = new Date().toISOString();
  }

  const scoreOf = (x) => (x.score != null ? x.score : x.computed != null ? x.computed : null);
  function overallOf(plan) {
    if (plan.report.overall != null && plan.report.overall !== '') return Number(plan.report.overall);
    const ds = plan.domains.map(scoreOf).filter((v) => v != null);
    if (ds.length) return round1(avg(ds));
    return plan.report.computedOverall;
  }
  function standardName(plan, code) {
    const s = plan.standards.find((x) => x.code === P.standardOf(code));
    return s ? s.name : '';
  }
  function domainName(plan, code) {
    const d = plan.domains.find((x) => x.code === P.domainOf(code));
    return d ? d.name : '';
  }

  function distribution(plan) {
    const lv = levelsOf(plan);
    const out = lv.map((l) => ({ ...l, count: 0 }));
    for (const i of plan.indicators) {
      const l = F.levelOf(i.score, lv);
      if (l) out.find((o) => o.key === l.key).count++;
    }
    return out;
  }

  // المؤشرات المشمولة بصفحات الخطة
  function planIndicators(plan) {
    const lv = levelsOf(plan);
    return plan.indicators.filter((i) => {
      if (i.excluded) return false;
      const l = F.levelOf(i.score, lv);
      if (!l) return true;
      if (l.key === 'excellence') return !!plan.settings.includeExcellence;
      if (l.key === 'advanced') return plan.settings.includeAdvanced !== false;
      return true;
    });
  }
  function sustainIndicators(plan) {
    const lv = levelsOf(plan);
    return plan.indicators.filter((i) => { const l = F.levelOf(i.score, lv); return l && (l.key === 'excellence' || l.key === 'advanced'); });
  }

  function analysis(plan) {
    const lv = levelsOf(plan);
    const scored = plan.indicators.filter((i) => i.score != null);
    const lowest = scored.slice().sort((a, b) => a.score - b.score).slice(0, 5);
    const quick = [];
    for (const i of scored) {
      const next = lv.slice().sort((a, b) => a.min - b.min).find((l) => l.min > i.score);
      if (next && next.min - i.score <= 7) quick.push({ ind: i, next, need: round1(next.min - i.score) });
    }
    quick.sort((a, b) => a.need - b.need);
    const exMin = (lv.find((l) => l.key === 'excellence') || { min: 90 }).min;
    const strengths = scored.filter((i) => i.score >= exMin).sort((a, b) => b.score - a.score);
    const gaps = scored.filter((i) => i.survey != null).map((i) => ({ ind: i, gap: round1(i.survey - i.score) }))
      .filter((g) => Math.abs(g.gap) >= 10).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    const surveyAvg = avg(scored.filter((i) => i.survey != null).map((i) => i.survey));
    const actualAvg = avg(scored.filter((i) => i.survey != null).map((i) => i.score));
    const domainsRanked = plan.domains.filter((d) => scoreOf(d) != null).slice().sort((a, b) => scoreOf(a) - scoreOf(b));
    const standardsRanked = plan.standards.filter((s) => scoreOf(s) != null).slice().sort((a, b) => scoreOf(a) - scoreOf(b));
    return { lowest, quick: quick.slice(0, 6), strengths: strengths.slice(0, 6), strengthsCount: strengths.length, gaps: gaps.slice(0, 6),
      surveyAvg: round1(surveyAvg), actualAvg: round1(actualAvg), domainsRanked, standardsRanked };
  }

  function comparison(plan) {
    const p = plan.previous;
    if (!p) return null;
    const rows = plan.indicators.map((i) => {
      const prev = p.indicators.find((x) => x.code === i.code || (i.oldCode && x.code === i.oldCode));
      return { code: i.code, text: i.text, now: i.score, prev: prev ? prev.score : null, diff: prev && prev.score != null && i.score != null ? round1(i.score - prev.score) : null };
    });
    const doms = plan.domains.map((d) => {
      const pd = p.domains.find((x) => x.code === d.code);
      const now = scoreOf(d), prev = pd ? scoreOf(pd) : null;
      return { code: d.code, name: d.name, now, prev, diff: now != null && prev != null ? round1(now - prev) : null };
    });
    const stds = plan.standards.map((s) => {
      const ps = p.standards.find((x) => x.code === s.code);
      const now = scoreOf(s), prev = ps ? scoreOf(ps) : null;
      return { code: s.code, name: s.name, now, prev, diff: now != null && prev != null ? round1(now - prev) : null };
    });
    const now = overallOf(plan), prev = p.overall;
    return { label: p.label, now, prev, diff: now != null && prev != null ? round1(now - prev) : null, rows, doms, stds,
      improved: rows.filter((r) => r.diff > 0).length, declined: rows.filter((r) => r.diff < 0).length };
  }

  function previousFromParsed(parsed, label) {
    const tmp = newPlan('tmp');
    applyParsed(tmp, parsed, '');
    return { label: label || 'الدورة السابقة', overall: overallOf(tmp),
      domains: tmp.domains.map((d) => ({ code: d.code, score: d.score, computed: d.computed })),
      standards: tmp.standards.map((s) => ({ code: s.code, score: s.score, computed: s.computed })),
      indicators: tmp.indicators.map((i) => ({ code: i.code, oldCode: i.oldCode, score: i.score })) };
  }

  function progressOf(plan) {
    const progs = planIndicators(plan).flatMap((i) => i.plan.programs);
    if (!progs.length) return { total: 0, done: 0, progress: 0, late: 0, pct: 0, achieved: 0 };
    return {
      total: progs.length,
      done: progs.filter((p) => p.status === 'done').length,
      progress: progs.filter((p) => p.status === 'progress').length,
      late: progs.filter((p) => p.status === 'late').length,
      pct: Math.round(avg(progs.map((p) => Number(p.completion) || 0))),
      achieved: progs.filter((p) => p.achieved === true).length,
    };
  }

  // ———— التخزين ————
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]').map(migrate); } catch (e) { return []; }
  }
  function saveAll(plans) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(plans)); return true; } catch (e) { return false; }
  }

  // خطة تجريبية بمؤشرات الإطار الرسمي ونسب افتراضية
  function demoPlan() {
    const p = newPlan('خطة تحسين — مدرسة تجريبية');
    Object.assign(p.school, { name: 'متوسطة تجريبية', ministryCode: 'S-000000', region: 'منطقة تجريبية', stage: 'المتوسطة', year: '1448', students: '420', teachers: '28', classes: '18', principal: 'قائد المدرسة', supervisor: 'المشرف التربوي' });
    p.period = { start: '2026-11-16', end: '2027-06-17' };
    loadFramework(p, 'المتوسطة');
    const seed = [97, 92, 88, 84, 96, 79, 72, 91, 66, 58, 83, 95, 77, 81, 93, 98, 88, 69, 74, 91, 86, 93, 64, 81, 90, 76, 87, 95, 82, 58, 63, 77, 71, 68, 74, 92, 89, 95, 82, 90, 86, 94, 99, 93, 97, 88, 95, 91, 90];
    p.indicators.forEach((i, k) => { i.score = seed[k % seed.length]; i.survey = Math.min(100, i.score + ((k % 5) - 1) * 4); i.target = null; i.plan = null; ensureIndicator(p, i); });
    p.report.hasSurvey = true;
    recompute(p);
    p.previous = {
      label: 'الدورة السابقة (1447هـ)', overall: 76.5,
      domains: [{ code: '1', score: 80 }, { code: '2', score: 78 }, { code: '3', score: 66 }, { code: '4', score: 86 }],
      standards: [], indicators: p.indicators.map((i, k) => ({ code: i.code, score: Math.max(30, i.score - (k % 4) * 3 + 1) })),
    };
    recompute(p);
    return p;
  }

  global.TahseenModel = {
    uid, round1, avg, REPORT_TYPES, STATUS, newPlan, migrate, applyParsed, applyPlanReport, loadFramework, addIndicator, recompute, ensureIndicator, makeIndicatorPlan,
    scoreOf, overallOf, standardName, domainName, distribution, planIndicators, sustainIndicators, analysis, comparison,
    previousFromParsed, progressOf, loadAll, saveAll, demoPlan, levelsOf, levelOf, stageOf, sortAll,
  };
})(window);

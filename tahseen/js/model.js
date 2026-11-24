/* تحسين — نموذج البيانات: الخطط، الدمج، الحسابات، القراءة التحليلية */
(function (global) {
  'use strict';
  const F = global.TahseenFramework;
  const cmpCode = global.TahseenParser.cmpCode;
  const STORE_KEY = 'tahseen.plans.v1';

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const round1 = (v) => (v == null || isNaN(v) ? null : Math.round(v * 10) / 10);
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
      id: uid(), title: title || 'خطة تحسين جديدة', createdAt: now, updatedAt: now,
      school: { name: '', ministryCode: '', region: '', office: '', stage: '', gender: 'بنين', students: '', teachers: '', classes: '',
        principal: '', deputy: '', supervisor: '', year: '', phone: '', email: '', address: '', logo: '' },
      report: { type: 'self1', edition3: true, date: '', source: '', overall: null, overallParsed: null, hasSurvey: false },
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
      settings: { includeAdvanced: true, levels: F.LEVELS.map((l) => ({ ...l })) },
    };
  }

  function levelsOf(plan) { return (plan && plan.settings && plan.settings.levels) || F.LEVELS; }
  function levelOf(plan, score) { return F.levelOf(score, levelsOf(plan)); }

  function makeIndicatorPlan(ind, plan) {
    const s = F.suggestFor(ind);
    const start = (plan.period && plan.period.start) || '';
    const end = (plan.period && plan.period.end) || '';
    return {
      initiative: s.initiative,
      programs: s.programs.map((p, i) => ({
        id: uid(), name: p,
        method: i === 0 ? 'ورشة عمل / اجتماع' : i === 1 ? 'تطبيق ميداني ومتابعة' : 'لقاءات دورية',
        start, end, owner: s.team.split('،')[0].trim(), status: 'not', completion: 0, achieved: null, note: '',
      })),
      evidence: s.evidence.slice(),
      measure: s.measure,
      team: s.team,
      sustain: 'الاستمرار في تطبيق الممارسات الناجحة وتوثيقها وتعميمها',
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
    fillMeasurements(ind);
    return ind;
  }

  // دمج نتائج القراءة في الخطة مع المحافظة على التعديلات السابقة
  function applyParsed(plan, parsed, sourceName) {
    const m = parsed.meta || {};
    plan.report.type = m.type || plan.report.type;
    plan.report.edition3 = !!m.edition3 || plan.report.edition3;
    plan.report.source = sourceName || plan.report.source;
    plan.report.hasSurvey = !!parsed.hasSurvey;
    plan.report.overallParsed = parsed.overall;
    if (parsed.overall != null) plan.report.overall = parsed.overall;
    const sc = plan.school;
    if (m.schoolName && !sc.name) sc.name = m.schoolName;
    if (m.ministryCode && !sc.ministryCode) sc.ministryCode = m.ministryCode;
    if (m.region && !sc.region) sc.region = m.region;
    if (m.office && !sc.office) sc.office = m.office;
    if (m.stage && !sc.stage) sc.stage = m.stage;
    if (m.year && !sc.year) sc.year = m.year;
    if (sc.name && plan.title === 'خطة تحسين جديدة') plan.title = 'خطة تحسين ' + sc.name;

    for (const d of parsed.domains) {
      const ex = plan.domains.find((x) => x.code === d.code);
      if (ex) { ex.score = d.score; if (d.name && d.name.length > 3) ex.name = d.name; }
      else plan.domains.push({ ...d });
    }
    for (const s of parsed.standards) {
      const ex = plan.standards.find((x) => x.code === s.code);
      if (ex) { ex.score = s.score; if (s.name && s.name.length > 3) ex.name = s.name; }
      else plan.standards.push({ ...s });
    }
    for (const pi of parsed.indicators) {
      const ex = plan.indicators.find((x) => x.code === pi.code);
      if (ex) {
        ex.score = pi.score; if (pi.survey != null) ex.survey = pi.survey;
        if (pi.text && pi.text.length > 5) ex.text = pi.text;
        if (pi.oldCode) ex.oldCode = pi.oldCode;
        ex.values = pi.values;
        fillMeasurements(ex);
      } else {
        plan.indicators.push(ensureIndicator(plan, { code: pi.code, oldCode: pi.oldCode, text: pi.text, score: pi.score, survey: pi.survey, values: pi.values, target: null }));
      }
    }
    plan.indicators.sort(cmpCode);
    plan.domains.sort(cmpCode);
    plan.standards.sort(cmpCode);
    recompute(plan);
  }

  function addIndicator(plan, code, text, score) {
    const ind = ensureIndicator(plan, { code, oldCode: '', text: text || '', score: score == null || score === '' ? null : Number(score), survey: null, target: null });
    plan.indicators.push(ind);
    plan.indicators.sort(cmpCode);
    recompute(plan);
    return ind;
  }

  // استكمال نسب المعايير والمجالات والأداء العام من المؤشرات عند غيابها
  function recompute(plan) {
    for (const s of plan.standards) {
      const inds = plan.indicators.filter((i) => i.code.startsWith(s.code + '.'));
      s.computed = round1(avg(inds.map((i) => i.score)));
      s.count = inds.length;
    }
    for (const d of plan.domains) {
      const inds = plan.indicators.filter((i) => i.code.startsWith(d.code + '.'));
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
    const s = plan.standards.find((x) => x.code === code.split('.').slice(0, 2).join('.'));
    return s ? s.name : '';
  }
  function domainName(plan, code) {
    const d = plan.domains.find((x) => x.code === code.split('.')[0]);
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

  // المؤشرات المشمولة بصفحات التحسين
  function planIndicators(plan) {
    const lv = levelsOf(plan);
    return plan.indicators.filter((i) => {
      if (i.excluded) return false;
      const l = F.levelOf(i.score, lv);
      if (!l) return true;
      if (l.key === 'excellence') return false;
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
    // المكاسب السريعة: قريبة من عتبة المستوى التالي (≤ 7 نقاط)
    const quick = [];
    for (const i of scored) {
      const next = lv.slice().sort((a, b) => a.min - b.min).find((l) => l.min > i.score);
      if (next && next.min - i.score <= 7) quick.push({ ind: i, next, need: round1(next.min - i.score) });
    }
    quick.sort((a, b) => a.need - b.need);
    const strengths = scored.filter((i) => i.score >= (lv.find((l) => l.key === 'excellence') || { min: 90 }).min).sort((a, b) => b.score - a.score);
    // فجوة الإدراك: الاستبانات مقابل النتيجة الفعلية
    const gaps = scored.filter((i) => i.survey != null).map((i) => ({ ind: i, gap: round1(i.survey - i.score) }))
      .filter((g) => Math.abs(g.gap) >= 10).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    const surveyAvg = avg(scored.filter((i) => i.survey != null).map((i) => i.survey));
    const actualAvg = avg(scored.filter((i) => i.survey != null).map((i) => i.score));
    const domainsRanked = plan.domains.filter((d) => scoreOf(d) != null).slice().sort((a, b) => scoreOf(a) - scoreOf(b));
    const standardsRanked = plan.standards.filter((s) => scoreOf(s) != null).slice().sort((a, b) => scoreOf(a) - scoreOf(b));
    return { lowest, quick: quick.slice(0, 6), strengths: strengths.slice(0, 6), gaps: gaps.slice(0, 6),
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
    tmp.indicators = [];
    tmp.domains = F.DEFAULT_DOMAINS.map((d) => ({ ...d, score: null }));
    tmp.standards = F.DEFAULT_STANDARDS.map((s) => ({ ...s, score: null }));
    for (const d of parsed.domains) { const ex = tmp.domains.find((x) => x.code === d.code); if (ex) ex.score = d.score; else tmp.domains.push({ ...d }); }
    for (const s of parsed.standards) { const ex = tmp.standards.find((x) => x.code === s.code); if (ex) ex.score = s.score; else tmp.standards.push({ ...s }); }
    tmp.indicators = parsed.indicators.map((i) => ({ code: i.code, oldCode: i.oldCode, score: i.score }));
    recompute(tmp);
    const overall = parsed.overall != null ? parsed.overall : overallOf(tmp);
    return { label: label || 'الدورة السابقة', overall,
      domains: tmp.domains.map((d) => ({ code: d.code, score: d.score, computed: d.computed })),
      standards: tmp.standards.map((s) => ({ code: s.code, score: s.score, computed: s.computed })),
      indicators: tmp.indicators };
  }

  function progressOf(plan) {
    const progs = planIndicators(plan).flatMap((i) => i.plan.programs);
    if (!progs.length) return { total: 0, done: 0, pct: 0, achieved: 0 };
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
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveAll(plans) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(plans)); return true; } catch (e) { return false; }
  }

  // بيانات تجريبية لعرض الأداة
  function demoPlan() {
    const p = newPlan('خطة تحسين — مدرسة تجريبية');
    Object.assign(p.school, { name: 'مدرسة تجريبية', ministryCode: '000000', region: 'منطقة تجريبية', office: 'مكتب تجريبي', stage: 'الابتدائية', year: '1447', students: '420', teachers: '28', classes: '18', principal: 'قائد المدرسة', supervisor: 'المشرف التربوي' });
    p.period = { start: '1447-03-01', end: '1447-11-30' };
    const samples = [
      ['1.1.1', 'توفر رؤية ورسالة وقيم واضحة للمدرسة يشارك في صياغتها منسوبوها', 92, 95],
      ['1.1.2', 'تفويض الصلاحيات وتوزيع المهام وتفعيل فرق العمل', 78, 90],
      ['1.2.1', 'بناء الخطة التشغيلية في ضوء نتائج التقويم الذاتي', 64, 88],
      ['1.2.2', 'متابعة تنفيذ الخطة وقياس أثرها', 55, 80],
      ['1.3.1', 'التواصل الفاعل مع الأسرة وإشراكها في تعلم أبنائها', 71, 85],
      ['1.3.2', 'بناء شراكات مجتمعية داعمة', 46, 70],
      ['2.1.1', 'التخطيط للدروس بما يراعي الفروق الفردية', 81, 90],
      ['2.2.1', 'توظيف استراتيجيات التعلم النشط', 69, 92],
      ['2.2.2', 'توظيف التقنية ومصادر التعلم الرقمية', 88, 86],
      ['2.3.1', 'التقويم البنائي وتقديم التغذية الراجعة', 58, 84],
      ['3.1.1', 'نتائج الطلاب في الاختبارات الوطنية (نافس)', 48, null],
      ['3.1.2', 'تحسن التحصيل الدراسي في المهارات الأساسية', 73, null],
      ['3.2.1', 'الانضباط والحضور والسلوك الإيجابي', 91, 93],
      ['3.2.2', 'التطور الصحي والاجتماعي للطلاب', 76, 82],
      ['4.1.1', 'تطبيق إجراءات الأمن والسلامة وفرضيات الإخلاء', 95, 96],
      ['4.1.2', 'صيانة المبنى والمرافق ونظافتها', 84, 80],
      ['4.2.1', 'تنوع الأنشطة ورعاية الموهوبين', 67, 85],
      ['4.2.2', 'المناخ المدرسي الداعم للتعلم', 89, 91],
    ];
    for (const [code, text, score, survey] of samples) {
      const i = addIndicator(p, code, text, score);
      i.survey = survey;
      if (code === '1.2.1') i.oldCode = '1.3.1';
    }
    p.report.hasSurvey = true;
    p.previous = {
      label: 'الدورة السابقة (1446هـ)', overall: 68.5,
      domains: [{ code: '1', score: 63 }, { code: '2', score: 70 }, { code: '3', score: 66 }, { code: '4', score: 80 }],
      standards: [],
      indicators: samples.map(([code, , score], k) => ({ code, score: Math.max(30, score - (k % 4) * 4 + 2) })),
    };
    recompute(p);
    return p;
  }

  global.TahseenModel = {
    uid, round1, avg, REPORT_TYPES, STATUS, newPlan, applyParsed, addIndicator, recompute, ensureIndicator, makeIndicatorPlan,
    scoreOf, overallOf, standardName, domainName, distribution, planIndicators, sustainIndicators, analysis, comparison,
    previousFromParsed, progressOf, loadAll, saveAll, demoPlan, levelsOf, levelOf,
  };
})(window);

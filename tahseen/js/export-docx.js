/* تحسين — تصدير Word (.docx) قابل للتعديل بنفس محتوى الخطة وهويتها */
(function (global) {
  'use strict';
  const M = global.TahseenModel;
  const X = global.TahseenPdf;

  const GREEN = '0F6B5C', SOFT = 'E3F0EC', FONT = 'Arial';

  function D() { if (!global.docx) throw new Error('مكتبة Word غير محمّلة'); return global.docx; }
  const pct = (v) => (v == null || v === '' || isNaN(v) ? '—' : `${M.round1(Number(v))}%`);

  function run(text, o) {
    const d = D();
    return new d.TextRun({ text: String(text == null ? '' : text), rightToLeft: true, font: FONT, size: (o && o.size) || 21, bold: !!(o && o.bold), color: (o && o.color) || '1D2B29' });
  }
  function P(text, o) {
    const d = D();
    o = o || {};
    const runs = Array.isArray(text) ? text : [run(text, o)];
    return new d.Paragraph({ children: runs, bidirectional: true, alignment: o.align || d.AlignmentType.RIGHT, spacing: { after: o.after != null ? o.after : 80, before: o.before || 0 },
      shading: o.fill ? { type: d.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, pageBreakBefore: !!o.pageBreak });
  }
  function title(text, pageBreak) {
    const d = D();
    return new d.Paragraph({ children: [run(text, { bold: true, size: 28, color: 'FFFFFF' })], bidirectional: true, alignment: d.AlignmentType.RIGHT,
      shading: { type: d.ShadingType.CLEAR, fill: GREEN, color: 'auto' }, spacing: { after: 160 }, pageBreakBefore: !!pageBreak });
  }
  function h(text) { return P(text, { bold: true, size: 24, color: GREEN, before: 120 }); }

  function cell(content, o) {
    const d = D();
    o = o || {};
    const paras = (Array.isArray(content) ? content : String(content == null ? '' : content).split('\n')).map((c) => (c instanceof d.Paragraph ? c : P(c, { size: o.size || 19, bold: o.bold, align: o.align || d.AlignmentType.CENTER, after: 0, color: o.color })));
    return new d.TableCell({ children: paras, shading: o.fill ? { type: d.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
      width: o.width ? { size: o.width, type: d.WidthType.PERCENTAGE } : undefined, verticalAlign: d.VerticalAlign.CENTER,
      margins: { top: 50, bottom: 50, left: 80, right: 80 } });
  }
  function table(headers, rows, opts) {
    const d = D();
    opts = opts || {};
    const size = opts.size || 18;
    const border = { style: d.BorderStyle.SINGLE, size: 4, color: 'B9CFC9' };
    const tr = [];
    if (headers) tr.push(new d.TableRow({ tableHeader: true, children: headers.map((t, k) => cell(t, { bold: true, fill: SOFT, size, width: opts.widths && opts.widths[k] })) }));
    for (const r of rows) tr.push(new d.TableRow({ cantSplit: true, children: r.map((t, k) => cell(t, { size, align: opts.textCols && opts.textCols.includes(k) ? d.AlignmentType.RIGHT : d.AlignmentType.CENTER, width: opts.widths && opts.widths[k] })) }));
    return new d.Table({ rows: tr, width: { size: 100, type: d.WidthType.PERCENTAGE }, visuallyRightToLeft: true,
      borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border } });
  }
  const levelName = (plan, v) => { const l = M.levelOf(plan, v); return l ? l.name : '—'; };

  function dataUrlToBytes(url) {
    const b64 = url.split(',')[1];
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function headerBlock(plan) {
    const d = D();
    const s = plan.school;
    const right = [P('المملكة العربية السعودية', { bold: true, size: 18, color: GREEN, after: 0 }), P('وزارة التعليم', { bold: true, size: 18, color: GREEN, after: 0 }),
      P(s.region ? 'الإدارة العامة للتعليم ' + s.region : 'إدارة التعليم', { bold: true, size: 18, color: GREEN, after: 0 })];
    let center = [P('', { after: 0 })];
    if (s.logo && /^data:image\/(png|jpe?g|gif)/.test(s.logo)) {
      try {
        center = [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.ImageRun({ data: dataUrlToBytes(s.logo), transformation: { width: 70, height: 55 } })] })];
      } catch (e) { /* تجاهل */ }
    }
    const left = [P(s.name || '', { bold: true, size: 18, color: GREEN, after: 0, align: d.AlignmentType.LEFT }),
      P(s.ministryCode ? 'الرقم الوزاري: ' + s.ministryCode : '', { size: 18, color: GREEN, after: 0, align: d.AlignmentType.LEFT }),
      P(s.year ? 'العام الدراسي ' + s.year + 'هـ' : '', { size: 18, color: GREEN, after: 0, align: d.AlignmentType.LEFT })];
    const none = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const mk = (c, w) => new d.TableCell({ children: c, width: { size: w, type: d.WidthType.PERCENTAGE }, borders: { top: none, left: none, right: none, bottom: { style: d.BorderStyle.SINGLE, size: 12, color: GREEN } } });
    return new d.Table({ visuallyRightToLeft: true, width: { size: 100, type: d.WidthType.PERCENTAGE }, rows: [new d.TableRow({ children: [mk(right, 38), mk(center, 24), mk(left, 38)] })] });
  }

  function pageChildren(plan, p) {
    const d = D();
    const s = plan.school;
    const out = [];
    switch (p.kind) {
      case 'cover': {
        const ov = M.overallOf(plan);
        out.push(P('', { after: 1600 }));
        out.push(P(M.REPORT_TYPES[plan.report.type] || '', { align: d.AlignmentType.CENTER, bold: true, color: GREEN, size: 24 }));
        out.push(P('خطة التحسين المدرسي', { align: d.AlignmentType.CENTER, bold: true, size: 64, color: '0F4C43', after: 200 }));
        out.push(P(s.name || '', { align: d.AlignmentType.CENTER, bold: true, size: 40, color: GREEN, after: 600 }));
        out.push(table(['العام الدراسي', 'المرحلة', 'الأداء العام', 'المستوى'], [[s.year ? s.year + 'هـ' : '—', s.stage || '—', pct(ov), levelName(plan, ov)]], { size: 24 }));
        out.push(P('أُعدّت هذه الخطة في ضوء نتائج تقرير الأداء المدرسي، وتتضمن المبادرات والبرامج وأساليب التنفيذ والأدلة ومؤشرات القياس لكل مؤشر مستهدف.', { align: d.AlignmentType.CENTER, before: 400, color: '445555' }));
        break;
      }
      case 'school': {
        out.push(title('بطاقة البيانات الأساسية للمدرسة', true));
        const rows = [['اسم المدرسة', s.name], ['الرقم الوزاري', s.ministryCode], ['إدارة التعليم', s.region], ['مكتب التعليم', s.office], ['المرحلة', s.stage], ['النوع', s.gender],
          ['عدد الطلاب', s.students], ['عدد المعلمين', s.teachers], ['عدد الفصول', s.classes], ['قائد المدرسة', s.principal], ['الوكيل', s.deputy], ['المشرف التربوي', s.supervisor],
          ['الهاتف', s.phone], ['البريد الإلكتروني', s.email], ['العنوان', s.address], ['نوع التقرير', M.REPORT_TYPES[plan.report.type]], ['مدة تنفيذ الخطة', `${plan.period.start || '—'} إلى ${plan.period.end || '—'}`]];
        out.push(table(null, rows.map(([k, v]) => [k, v || '']), { size: 21, widths: [30, 70], textCols: [0, 1] }));
        break;
      }
      case 'decision': {
        out.push(title('قرار تشكيل فريق التقويم الذاتي', true));
        out.push(P(`قرار رقم (${plan.decision.number || '....'}) وتاريخ ${plan.decision.date || '..../..../....'}هـ`, { bold: true }));
        out.push(P('إن قائد المدرسة، بناءً على الصلاحيات الممنوحة له، وتحقيقًا لمتطلبات التقويم المدرسي، وحرصًا على تحسين الأداء المدرسي، يقرر ما يلي:'));
        out.push(P('أولًا: تشكيل فريق التقويم الذاتي وإعداد خطة التحسين بالمدرسة على النحو التالي:', { bold: true }));
        out.push(table(['م', 'الاسم', 'العمل الحالي', 'المهمة في الفريق', 'التوقيع'], plan.team.filter((t) => t.name || t.role).map((t, k) => [k + 1, t.name, t.role, t.task, '']), { widths: [7, 30, 25, 22, 16] }));
        out.push(P('ثانيًا: يتولى الفريق تحليل نتائج التقويم، وإعداد خطة التحسين ومتابعة تنفيذها وقياس أثرها ورفع التقارير الدورية.'));
        out.push(P('ثالثًا: يُبلّغ القرار لمن يلزم لتنفيذه، ويُعمل به من تاريخه.'));
        if (plan.decision.notes) out.push(P(plan.decision.notes));
        out.push(P(`قائد المدرسة: ${s.principal || ''}        التوقيع: ............        الختم`, { bold: true, before: 400, align: d.AlignmentType.LEFT }));
        break;
      }
      case 'summary': {
        out.push(title('لوحة النتائج', true));
        const ov = M.overallOf(plan);
        const dist = M.distribution(plan);
        out.push(table(['الأداء العام', ...dist.map((l) => 'مستوى ' + l.name)], [[`${pct(ov)} (${levelName(plan, ov)})`, ...dist.map((l) => `${l.count} مؤشر`)]], { size: 22 }));
        out.push(h('أداء المجالات'));
        out.push(table(['الرمز', 'المجال', 'النسبة', 'المستوى'], plan.domains.map((x) => [x.code, x.name, pct(M.scoreOf(x)), levelName(plan, M.scoreOf(x))]), { widths: [10, 50, 20, 20], textCols: [1] }));
        out.push(h('أداء المعايير'));
        out.push(table(['الرمز', 'المعيار', 'النسبة', 'المستوى'], plan.standards.map((x) => [x.code, x.name, pct(M.scoreOf(x)), levelName(plan, M.scoreOf(x))]), { widths: [10, 50, 20, 20], textCols: [1] }));
        break;
      }
      case 'analysis': {
        const a = M.analysis(plan);
        out.push(title('القراءة التحليلية', true));
        const list = (arr, f) => (arr.length ? arr.map((x, k) => P(`${k + 1}. ${f(x)}`, { size: 20 })) : [P('—')]);
        out.push(h('أدنى المؤشرات أداءً'), ...list(a.lowest, (i) => `${i.code} ${i.text} — ${pct(i.score)}`));
        out.push(h('المكاسب السريعة'), ...list(a.quick, (q) => `${q.ind.code} ${q.ind.text} — ${pct(q.ind.score)} (يحتاج ${q.need} نقطة لبلوغ «${q.next.name}»)`));
        out.push(h('جوانب القوة'), ...list(a.strengths, (i) => `${i.code} ${i.text} — ${pct(i.score)}`));
        out.push(h('فجوة الإدراك (الاستبانات مقابل النتيجة)'));
        out.push(P(a.surveyAvg != null ? `متوسط الاستبانات ${pct(a.surveyAvg)} مقابل النتيجة الفعلية ${pct(a.actualAvg)}.` : 'لا تتوفر بيانات استبانات.'));
        out.push(...(a.gaps.length ? list(a.gaps, (g) => `${g.ind.code} ${g.ind.text} — النتيجة ${pct(g.ind.score)}، الاستبانة ${pct(g.ind.survey)}`) : []));
        out.push(h('ترتيب المجالات من الأدنى'), P(a.domainsRanked.map((x) => `${x.name} (${pct(M.scoreOf(x))})`).join(' ← ') || '—'));
        break;
      }
      case 'compareSummary': {
        const c = p.cmp;
        out.push(title('المقارنة مع ' + c.label, true));
        out.push(table([c.label, 'الدورة الحالية', 'الفرق', 'تحسن / تراجع'], [[pct(c.prev), pct(c.now), c.diff == null ? '—' : (c.diff > 0 ? '+' : '') + c.diff, `${c.improved} / ${c.declined}`]], { size: 22 }));
        const rr = (r) => [r.code, r.name, pct(r.prev), pct(r.now), r.diff == null ? '—' : (r.diff > 0 ? '+' : '') + r.diff];
        out.push(h('المجالات'), table(['الرمز', 'المجال', 'السابقة', 'الحالية', 'الفرق'], c.doms.map(rr), { textCols: [1] }));
        out.push(h('المعايير'), table(['الرمز', 'المعيار', 'السابقة', 'الحالية', 'الفرق'], c.stds.map(rr), { textCols: [1] }));
        break;
      }
      case 'compareRows': {
        out.push(title('مقارنة المؤشرات' + (p.part > 1 ? ' (تابع)' : ''), true));
        out.push(table(['الرمز', 'المؤشر', 'السابقة', 'الحالية', 'الفرق'], p.rows.map((r) => [r.code, r.text, pct(r.prev), pct(r.now), r.diff == null ? '—' : (r.diff > 0 ? '+' : '') + r.diff]), { widths: [10, 54, 12, 12, 12], textCols: [1] }));
        break;
      }
      case 'domainIndex': {
        const dm = p.domain;
        out.push(title(`المجال ${dm.code}: ${dm.name}`, true));
        out.push(P(`أداء المجال: ${pct(M.scoreOf(dm))} — ${levelName(plan, M.scoreOf(dm))}`, { bold: true, size: 24 }));
        out.push(h('فهرس برامج المجال'));
        out.push(table(['الرمز', 'المؤشر', 'النسبة', 'المستوى', 'المستهدف', 'الصفحة'],
          p.items.map((it) => [plan.report.edition3 && it.ind.oldCode ? `${it.ind.code} (سابقًا ${it.ind.oldCode})` : it.ind.code, it.ind.text, pct(it.ind.score), levelName(plan, it.ind.score), pct(it.ind.target), it.no]),
          { widths: [13, 47, 10, 10, 10, 10], textCols: [1] }));
        break;
      }
      case 'indicator': {
        const i = p.ind, pl = i.plan;
        const gap = i.target != null && i.score != null ? M.round1(i.target - i.score) : '—';
        out.push(title(`المؤشر ${i.code}${plan.report.edition3 && i.oldCode ? ` (سابقًا ${i.oldCode})` : ''}`, true));
        out.push(P(i.text, { bold: true, size: 24 }));
        out.push(P(`المجال: ${p.domain.name}    |    المعيار: ${M.standardName(plan, i.code)}`, { size: 19, color: '455555' }));
        out.push(table(['الأداء الحالي', 'المستوى', 'المستهدف', 'الفجوة', ...(i.survey != null ? ['الاستبانات'] : [])], [[pct(i.score), levelName(plan, i.score), pct(i.target), gap, ...(i.survey != null ? [pct(i.survey)] : [])]], { size: 22 }));
        out.push(h('المبادرة'), P(pl.initiative));
        out.push(h('البرامج وأساليب التنفيذ'));
        out.push(table(['م', 'البرنامج', 'أسلوب التنفيذ', 'المسؤول', 'من', 'إلى', 'التنفيذ', 'الإنجاز', 'تحقق الهدف'],
          pl.programs.map((g, k) => [k + 1, g.name, g.method, g.owner, g.start, g.end, M.STATUS[g.status] || '', (g.completion || 0) + '%', g.achieved === true ? 'نعم' : g.achieved === false ? 'لا' : '—']),
          { size: 17, widths: [4, 30, 14, 13, 9, 9, 8, 6, 7], textCols: [1] }));
        out.push(h('الأدلة والشواهد'), ...pl.evidence.map((e) => P('• ' + e, { size: 20, after: 20 })));
        out.push(h('مؤشر القياس'), P(pl.measure));
        out.push(h('الفريق المكلف'), P(pl.team));
        out.push(h('جدول قياس النواتج'));
        out.push(table(['فترة القياس', 'القيمة المستهدفة', 'القيمة المتحققة', 'الحالة'],
          pl.measurements.map((m) => [m.period, pct(m.target), pct(m.actual), m.actual == null || m.actual === '' ? '—' : Number(m.actual) >= Number(m.target) ? 'متحقق' : 'غير متحقق'])));
        break;
      }
      case 'sustain': {
        out.push(title('جدول استدامة مؤشرات التقدّم والتميّز', true));
        out.push(table(['الرمز', 'المؤشر', 'النسبة', 'المستوى', 'إجراءات الاستدامة', 'المسؤول'],
          p.rows.map((i) => [i.code, i.text, pct(i.score), levelName(plan, i.score), i.plan.sustain, i.plan.team.split('،')[0]]), { widths: [8, 34, 9, 9, 26, 14], textCols: [1, 4] }));
        break;
      }
      case 'followup': {
        const pr = M.progressOf(plan);
        const a = plan.approval;
        out.push(title('المتابعة والاعتماد', true));
        out.push(table(['إجمالي البرامج', 'منفّذ', 'متوسط الإنجاز', 'حققت أهدافها'], [[pr.total, pr.done, pr.pct + '%', pr.achieved]], { size: 22 }));
        out.push(P(''));
        out.push(table(['زيارة المتابعة', 'التاريخ', 'الملاحظات', 'التوقيع'], ['المتابعة الأولى', 'المتابعة الثانية', 'المتابعة الثالثة', 'التقييم الختامي'].map((t) => [t, '', '\n\n', '']), { widths: [20, 18, 44, 18] }));
        out.push(P('', { after: 300 }));
        out.push(table(['مُعدّ الخطة', 'قائد المدرسة', 'المشرف التربوي'], [[a.preparedBy || '', a.principal || s.principal || '', a.supervisor || s.supervisor || ''], ['التوقيع: ..........', 'التوقيع: ..........', 'التوقيع: ..........']], { size: 21 }));
        out.push(P(`تاريخ الاعتماد: ${a.date || '..../..../....'}هـ`, { align: d.AlignmentType.CENTER, before: 200 }));
        break;
      }
    }
    return out;
  }

  function footer(plan) {
    const d = D();
    return new d.Footer({ children: [new d.Paragraph({ bidirectional: true, alignment: d.AlignmentType.CENTER,
      children: [run(plan.title + '  —  صفحة ', { size: 16, color: '667777' }), new d.TextRun({ children: [d.PageNumber.CURRENT], font: FONT, size: 16, color: '667777' })] })] });
  }

  async function exportPlan(plan) {
    const d = D();
    const st = X.structure(plan);
    const children = [];
    st.pages.forEach((p) => children.push(...pageChildren(plan, p)));
    const doc = new d.Document({
      creator: 'تحسين', title: plan.title,
      styles: { default: { document: { run: { font: FONT, rightToLeft: true }, paragraph: { bidirectional: true } } } },
      sections: [{
        properties: { page: { margin: { top: 700, bottom: 800, left: 800, right: 800, header: 300, footer: 300 } } },
        headers: { default: new d.Header({ children: [headerBlock(plan), new d.Paragraph({ children: [] })] }) },
        footers: { default: footer(plan) },
        children,
      }],
    });
    return d.Packer.toBlob(doc);
  }

  async function exportSupervisory(plan) {
    const d = D();
    const s = plan.school;
    const inds = M.planIndicators(plan);
    const c1 = [title('الاستمارة (1): خطة التحسين وفق النموذج الإشرافي'),
      table(['م', 'المجال', 'المعيار', 'المؤشر', 'الوضع الراهن', 'المستهدف', 'المبادرة', 'البرامج والإجراءات التنفيذية', 'المسؤول', 'زمن التنفيذ', 'مؤشر القياس', 'الأدلة والشواهد'],
        inds.map((i, k) => [k + 1, M.domainName(plan, i.code), M.standardName(plan, i.code), `${i.code}${plan.report.edition3 && i.oldCode ? ` (سابقًا ${i.oldCode})` : ''} ${i.text}`, pct(i.score), pct(i.target), i.plan.initiative,
          i.plan.programs.map((g, n) => `${n + 1}. ${g.name} (${g.method})`).join('\n'), i.plan.team.split('،')[0],
          `${(i.plan.programs[0] || {}).start || plan.period.start || ''} — ${(i.plan.programs[0] || {}).end || plan.period.end || ''}`, i.plan.measure, i.plan.evidence.join('، ')]),
        { size: 15, textCols: [3, 6, 7, 10, 11] }),
      P(`قائد المدرسة: ${s.principal || ''} — التوقيع: ..........          المشرف التربوي: ${s.supervisor || ''} — التوقيع: ..........`, { bold: true, before: 200 })];
    const progs = inds.flatMap((i) => i.plan.programs.map((g) => ({ i, g })));
    const c2 = [title('الاستمارة (2): متابعة تنفيذ خطة التحسين', true),
      table(['م', 'المؤشر', 'البرنامج', 'المسؤول', 'حالة التنفيذ', 'نسبة الإنجاز', 'تحقق الهدف', 'الصعوبات / الملاحظات', 'الإجراء التصحيحي', 'ملاحظات المشرف'],
        progs.map(({ i, g }, k) => [k + 1, i.code, g.name, g.owner, M.STATUS[g.status] || '', (g.completion || 0) + '%', g.achieved === true ? 'نعم' : g.achieved === false ? 'لا' : '—', g.note || '', '', '']),
        { size: 16, textCols: [2, 7] }),
      P(`قائد المدرسة: ${s.principal || ''} — التوقيع: ..........     تاريخ المتابعة: ..../..../....هـ     المشرف التربوي: ${s.supervisor || ''} — التوقيع: ..........`, { bold: true, before: 200 })];
    // معالجة الأسطر المتعددة داخل الخلايا
    const doc = new d.Document({
      creator: 'تحسين', title: 'النموذج الإشرافي',
      styles: { default: { document: { run: { font: FONT, rightToLeft: true }, paragraph: { bidirectional: true } } } },
      sections: [{
        properties: { page: { size: { orientation: d.PageOrientation.LANDSCAPE, width: 11906, height: 16838 }, margin: { top: 600, bottom: 600, left: 600, right: 600, header: 250, footer: 250 } } },
        headers: { default: new d.Header({ children: [headerBlock(plan), new d.Paragraph({ children: [] })] }) },
        footers: { default: footer(plan) },
        children: [...c1, ...c2],
      }],
    });
    return d.Packer.toBlob(doc);
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  global.TahseenDocx = { exportPlan, exportSupervisory, download };
})(window);

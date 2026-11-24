/* تحسين — بناء مستند الخطة للطباعة/الحفظ PDF (A4) والنموذج الإشرافي (A4 أفقي) */
(function (global) {
  'use strict';
  const M = global.TahseenModel;
  const F = global.TahseenFramework;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = (v) => (v == null || v === '' || isNaN(v) ? '—' : `${M.round1(Number(v))}%`);
  const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out.length ? out : [[]]; };
  const codeLabel = (i, plan) => (plan.report.edition3 && i.oldCode ? `${i.code} <span class="old">(سابقًا ${esc(i.oldCode)})</span>` : esc(i.code));

  // ———— هيكل المستند (مشترك بين PDF وWord لضمان تطابق أرقام الصفحات) ————
  function structure(plan) {
    const pages = [];
    pages.push({ kind: 'cover' });
    pages.push({ kind: 'school' });
    pages.push({ kind: 'decision' });
    pages.push({ kind: 'summary' });
    pages.push({ kind: 'analysis' });
    const cmp = M.comparison(plan);
    if (cmp) {
      pages.push({ kind: 'compareSummary', cmp });
      chunk(cmp.rows, 24).forEach((rows, k) => pages.push({ kind: 'compareRows', rows, part: k + 1, cmp }));
    }
    const inds = M.planIndicators(plan);
    const domains = plan.domains.filter((d) => inds.some((i) => i.code.split('.')[0] === d.code));
    for (const d of domains) {
      const di = inds.filter((i) => i.code.split('.')[0] === d.code);
      const idx = { kind: 'domainIndex', domain: d, items: [] };
      pages.push(idx);
      for (const ind of di) {
        const pg = { kind: 'indicator', ind, domain: d };
        pages.push(pg);
        idx.items.push(pg);
      }
    }
    const sus = M.sustainIndicators(plan);
    if (sus.length) chunk(sus, 14).forEach((rows) => pages.push({ kind: 'sustain', rows }));
    pages.push({ kind: 'followup' });
    pages.forEach((p, k) => { p.no = k + 1; });
    return { pages, total: pages.length };
  }

  // ———— قطع HTML ————
  function header(plan) {
    const s = plan.school;
    return `<div class="hdr">
      <div class="hdr-r">المملكة العربية السعودية<br>وزارة التعليم<br>${s.region ? 'الإدارة العامة للتعليم ' + esc(s.region) : 'إدارة التعليم'}<br>${esc(s.office ? 'مكتب التعليم ' + s.office : '')}</div>
      <div class="hdr-c">${s.logo ? `<img src="${s.logo}" alt="">` : ''}</div>
      <div class="hdr-l">${esc(s.name || 'اسم المدرسة')}<br>${s.ministryCode ? 'الرقم الوزاري: ' + esc(s.ministryCode) : ''}<br>${s.year ? 'العام الدراسي ' + esc(s.year) + 'هـ' : ''}</div>
    </div>`;
  }
  const footer = (plan, no, total) => `<div class="ftr"><span>${esc(plan.title)}</span><span>صفحة ${no} من ${total}</span></div>`;
  const page = (plan, p, total, body, cls) => `<section class="page ${cls || ''}">${p.kind === 'cover' ? '' : header(plan)}<div class="body">${body}</div>${footer(plan, p.no, total)}</section>`;
  const lvlBadge = (plan, v) => { const l = M.levelOf(plan, v); return l ? `<span class="lv" style="background:${l.soft};color:${l.color};border-color:${l.color}">${l.name}</span>` : '—'; };

  function barRows(plan, items) {
    return items.map((x) => {
      const v = M.scoreOf(x);
      const l = M.levelOf(plan, v);
      return `<div class="br"><div class="bl">${esc(x.code)} ${esc(x.name)}</div><div class="bt"><div class="bf" style="width:${v || 0}%;background:${l ? l.color : '#999'}"></div></div><div class="bv">${pct(v)}</div></div>`;
    }).join('');
  }

  function renderPage(plan, p, total, st) {
    const s = plan.school;
    switch (p.kind) {
      case 'cover': {
        const ov = M.overallOf(plan);
        return page(plan, p, total, `
          ${header(plan)}
          <div class="cover">
            <div class="cv-kicker">${esc(M.REPORT_TYPES[plan.report.type] || '')}</div>
            <h1>خطة التحسين المدرسي</h1>
            <h2>${esc(s.name || '')}</h2>
            <div class="cv-meta">
              <div><b>العام الدراسي</b><span>${esc(s.year ? s.year + 'هـ' : '—')}</span></div>
              <div><b>المرحلة</b><span>${esc(s.stage || '—')}</span></div>
              <div><b>الأداء العام</b><span>${pct(ov)}</span></div>
              <div><b>المستوى</b><span>${lvlBadge(plan, ov)}</span></div>
            </div>
            <p class="cv-note">أُعدّت هذه الخطة في ضوء نتائج تقرير الأداء المدرسي، وتتضمن المبادرات والبرامج وأساليب التنفيذ والأدلة ومؤشرات القياس لكل مؤشر مستهدف.</p>
          </div>`, 'cover-page');
      }
      case 'school': {
        const rows = [
          ['اسم المدرسة', s.name], ['الرقم الوزاري', s.ministryCode], ['إدارة التعليم', s.region], ['مكتب التعليم', s.office],
          ['المرحلة', s.stage], ['النوع', s.gender], ['عدد الطلاب', s.students], ['عدد المعلمين', s.teachers], ['عدد الفصول', s.classes],
          ['قائد المدرسة', s.principal], ['الوكيل', s.deputy], ['المشرف التربوي', s.supervisor], ['الهاتف', s.phone], ['البريد الإلكتروني', s.email],
          ['العنوان', s.address], ['نوع التقرير', M.REPORT_TYPES[plan.report.type]], ['مدة تنفيذ الخطة', `${plan.period.start || '—'} إلى ${plan.period.end || '—'}`],
        ];
        return page(plan, p, total, `<h3 class="ttl">بطاقة البيانات الأساسية للمدرسة</h3>
          <table class="kv">${chunk(rows, 2).map((r) => `<tr>${r.map(([k, v]) => `<th>${k}</th><td>${esc(v || '')}</td>`).join('')}</tr>`).join('')}</table>`);
      }
      case 'decision': {
        const team = plan.team.filter((t) => t.name || t.role);
        return page(plan, p, total, `<h3 class="ttl">قرار تشكيل فريق التقويم الذاتي</h3>
          <p class="lead">قرار رقم (${esc(plan.decision.number || '....')}) وتاريخ ${esc(plan.decision.date || '..../..../....')}هـ</p>
          <p>إن قائد المدرسة، بناءً على الصلاحيات الممنوحة له، وتحقيقًا لمتطلبات التقويم المدرسي، وحرصًا على تحسين الأداء المدرسي، يقرر ما يلي:</p>
          <p><b>أولًا:</b> تشكيل فريق التقويم الذاتي وإعداد خطة التحسين بالمدرسة على النحو التالي:</p>
          <table class="grid"><thead><tr><th style="width:8%">م</th><th>الاسم</th><th>العمل الحالي</th><th>المهمة في الفريق</th><th style="width:16%">التوقيع</th></tr></thead>
          <tbody>${team.map((t, k) => `<tr><td>${k + 1}</td><td>${esc(t.name)}</td><td>${esc(t.role)}</td><td>${esc(t.task)}</td><td></td></tr>`).join('')}</tbody></table>
          <p><b>ثانيًا:</b> يتولى الفريق تحليل نتائج التقويم، وإعداد خطة التحسين ومتابعة تنفيذها وقياس أثرها ورفع التقارير الدورية.</p>
          <p><b>ثالثًا:</b> يُبلّغ القرار لمن يلزم لتنفيذه، ويُعمل به من تاريخه.</p>
          ${plan.decision.notes ? `<p>${esc(plan.decision.notes)}</p>` : ''}
          <div class="sign"><div>قائد المدرسة<br><b>${esc(s.principal || '')}</b><br>التوقيع: ............</div><div>الختم</div></div>`);
      }
      case 'summary': {
        const ov = M.overallOf(plan);
        const dist = M.distribution(plan);
        const totalInd = dist.reduce((a, b) => a + b.count, 0) || 1;
        return page(plan, p, total, `<h3 class="ttl">لوحة النتائج</h3>
          <div class="kpis"><div class="kpi"><span>الأداء العام</span><b>${pct(ov)}</b>${lvlBadge(plan, ov)}</div>
          ${dist.map((l) => `<div class="kpi"><span>مستوى ${l.name}</span><b>${l.count}</b><small>مؤشر (${Math.round(l.count / totalInd * 100)}%)</small></div>`).join('')}</div>
          <div class="stack">${dist.filter((l) => l.count).map((l) => `<div style="flex:${l.count};background:${l.color}">${l.name} ${l.count}</div>`).join('')}</div>
          <h4>أداء المجالات</h4><div class="bars">${barRows(plan, plan.domains)}</div>
          <h4>أداء المعايير</h4><div class="bars sm">${barRows(plan, plan.standards)}</div>`);
      }
      case 'analysis': {
        const a = M.analysis(plan);
        const li = (i, extra) => `<li><b>${esc(i.code)}</b> ${esc(i.text)} — <b>${pct(i.score)}</b>${extra || ''}</li>`;
        return page(plan, p, total, `<h3 class="ttl">القراءة التحليلية</h3>
          <div class="cols2">
            <div class="box red"><h4>أدنى المؤشرات أداءً</h4><ol>${a.lowest.map((i) => li(i)).join('') || '<li>—</li>'}</ol></div>
            <div class="box amber"><h4>المكاسب السريعة</h4><ol>${a.quick.map((q) => li(q.ind, ` <small>(يحتاج ${q.need} نقطة لبلوغ «${q.next.name}»)</small>`)).join('') || '<li>لا توجد مؤشرات قريبة من عتبة المستوى التالي</li>'}</ol></div>
            <div class="box green"><h4>جوانب القوة</h4><ol>${a.strengths.map((i) => li(i)).join('') || '<li>—</li>'}</ol></div>
            <div class="box blue"><h4>فجوة الإدراك (الاستبانات مقابل النتيجة)</h4>
              ${a.surveyAvg != null ? `<p>متوسط الاستبانات <b>${pct(a.surveyAvg)}</b> مقابل النتيجة الفعلية <b>${pct(a.actualAvg)}</b>.</p>` : '<p>لا تتوفر بيانات استبانات.</p>'}
              <ol>${a.gaps.map((g) => li(g.ind, ` <small>(استبانة ${pct(g.ind.survey)}، فجوة ${g.gap > 0 ? '+' : ''}${g.gap})</small>`)).join('')}</ol></div>
          </div>
          <h4>ترتيب المجالات من الأدنى</h4><p>${a.domainsRanked.map((d) => `${esc(d.name)} (${pct(M.scoreOf(d))})`).join(' ← ') || '—'}</p>
          <h4>المعايير الأولى بالتحسين</h4><p>${a.standardsRanked.slice(0, 4).map((d) => `${esc(d.code)} ${esc(d.name)} (${pct(M.scoreOf(d))})`).join('، ') || '—'}</p>`);
      }
      case 'compareSummary': {
        const c = p.cmp;
        const dr = (r) => `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${pct(r.prev)}</td><td>${pct(r.now)}</td><td class="${r.diff > 0 ? 'up' : r.diff < 0 ? 'down' : ''}">${r.diff == null ? '—' : (r.diff > 0 ? '▲ +' : r.diff < 0 ? '▼ ' : '') + r.diff}</td></tr>`;
        return page(plan, p, total, `<h3 class="ttl">المقارنة مع ${esc(c.label)}</h3>
          <div class="kpis"><div class="kpi"><span>${esc(c.label)}</span><b>${pct(c.prev)}</b></div><div class="kpi"><span>الدورة الحالية</span><b>${pct(c.now)}</b></div>
          <div class="kpi"><span>الفرق</span><b class="${c.diff > 0 ? 'up' : 'down'}">${c.diff == null ? '—' : (c.diff > 0 ? '+' : '') + c.diff}</b></div>
          <div class="kpi"><span>مؤشرات تحسنت / تراجعت</span><b>${c.improved} / ${c.declined}</b></div></div>
          <h4>المجالات</h4><table class="grid"><thead><tr><th>الرمز</th><th>المجال</th><th>السابقة</th><th>الحالية</th><th>الفرق</th></tr></thead><tbody>${c.doms.map(dr).join('')}</tbody></table>
          <h4>المعايير</h4><table class="grid sm"><thead><tr><th>الرمز</th><th>المعيار</th><th>السابقة</th><th>الحالية</th><th>الفرق</th></tr></thead><tbody>${c.stds.map(dr).join('')}</tbody></table>`);
      }
      case 'compareRows': {
        return page(plan, p, total, `<h3 class="ttl">مقارنة المؤشرات${p.part > 1 ? ' (تابع)' : ''}</h3>
          <table class="grid sm"><thead><tr><th>الرمز</th><th>المؤشر</th><th>السابقة</th><th>الحالية</th><th>الفرق</th></tr></thead>
          <tbody>${p.rows.map((r) => `<tr><td>${esc(r.code)}</td><td class="tx">${esc(r.text)}</td><td>${pct(r.prev)}</td><td>${pct(r.now)}</td><td class="${r.diff > 0 ? 'up' : r.diff < 0 ? 'down' : ''}">${r.diff == null ? '—' : (r.diff > 0 ? '▲ +' : r.diff < 0 ? '▼ ' : '') + r.diff}</td></tr>`).join('')}</tbody></table>`);
      }
      case 'domainIndex': {
        const d = p.domain;
        return page(plan, p, total, `<div class="dom-hero"><small>المجال ${esc(d.code)}</small><h2>${esc(d.name)}</h2><p>أداء المجال: <b>${pct(M.scoreOf(d))}</b> ${lvlBadge(plan, M.scoreOf(d))}</p></div>
          <h4>فهرس برامج المجال</h4>
          <table class="grid"><thead><tr><th>الرمز</th><th>المؤشر</th><th>النسبة</th><th>المستوى</th><th>المستهدف</th><th>الصفحة</th></tr></thead>
          <tbody>${p.items.map((it) => `<tr><td>${codeLabel(it.ind, plan)}</td><td class="tx">${esc(it.ind.text)}</td><td>${pct(it.ind.score)}</td><td>${lvlBadge(plan, it.ind.score)}</td><td>${pct(it.ind.target)}</td><td><b>${it.no}</b></td></tr>`).join('')}</tbody></table>`);
      }
      case 'indicator': {
        const i = p.ind, pl = i.plan;
        const gap = i.target != null && i.score != null ? M.round1(i.target - i.score) : null;
        return page(plan, p, total, `
          <div class="ind-head"><div class="ih-code">${codeLabel(i, plan)}</div><div class="ih-txt">${esc(i.text)}</div></div>
          <div class="ih-meta"><span>المجال: <b>${esc(p.domain.name)}</b></span><span>المعيار: <b>${esc(M.standardName(plan, i.code))}</b></span></div>
          <div class="kpis sm"><div class="kpi"><span>الأداء الحالي</span><b>${pct(i.score)}</b>${lvlBadge(plan, i.score)}</div>
          <div class="kpi"><span>المستهدف</span><b>${pct(i.target)}</b>${lvlBadge(plan, i.target)}</div><div class="kpi"><span>الفجوة</span><b>${gap == null ? '—' : gap}</b></div>
          ${i.survey != null ? `<div class="kpi"><span>الاستبانات</span><b>${pct(i.survey)}</b></div>` : ''}</div>
          <div class="sec"><h5>المبادرة</h5><p>${esc(pl.initiative)}</p></div>
          <div class="sec"><h5>البرامج وأساليب التنفيذ</h5>
          <table class="grid sm"><thead><tr><th>م</th><th>البرنامج</th><th>أسلوب التنفيذ</th><th>المسؤول</th><th>من</th><th>إلى</th><th>التنفيذ</th><th>الإنجاز</th><th>تحقق الهدف</th></tr></thead>
          <tbody>${pl.programs.map((g, k) => `<tr><td>${k + 1}</td><td class="tx">${esc(g.name)}</td><td>${esc(g.method)}</td><td>${esc(g.owner)}</td><td>${esc(g.start)}</td><td>${esc(g.end)}</td><td>${M.STATUS[g.status] || ''}</td><td>${g.completion != null ? g.completion + '%' : ''}</td><td>${g.achieved === true ? 'نعم' : g.achieved === false ? 'لا' : '—'}</td></tr>`).join('')}</tbody></table></div>
          <div class="cols2 tight"><div class="sec"><h5>الأدلة والشواهد</h5><ul>${pl.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>
          <div class="sec"><h5>مؤشر القياس</h5><p>${esc(pl.measure)}</p><h5>الفريق المكلف</h5><p>${esc(pl.team)}</p></div></div>
          <div class="sec"><h5>جدول قياس النواتج</h5>
          <table class="grid sm"><thead><tr><th>فترة القياس</th><th>القيمة المستهدفة</th><th>القيمة المتحققة</th><th>الحالة</th></tr></thead>
          <tbody>${pl.measurements.map((m) => `<tr><td>${esc(m.period)}</td><td>${pct(m.target)}</td><td>${pct(m.actual)}</td><td>${m.actual == null || m.actual === '' ? '—' : Number(m.actual) >= Number(m.target) ? '✔ متحقق' : '✖ غير متحقق'}</td></tr>`).join('')}</tbody></table></div>`, 'ind-page');
      }
      case 'sustain': {
        return page(plan, p, total, `<h3 class="ttl">جدول استدامة مؤشرات التقدّم والتميّز</h3>
          <table class="grid sm"><thead><tr><th>الرمز</th><th>المؤشر</th><th>النسبة</th><th>المستوى</th><th>إجراءات الاستدامة</th><th>المسؤول</th></tr></thead>
          <tbody>${p.rows.map((i) => `<tr><td>${codeLabel(i, plan)}</td><td class="tx">${esc(i.text)}</td><td>${pct(i.score)}</td><td>${lvlBadge(plan, i.score)}</td><td class="tx">${esc(i.plan.sustain)}</td><td>${esc(i.plan.team.split('،')[0])}</td></tr>`).join('')}</tbody></table>`);
      }
      case 'followup': {
        const pr = M.progressOf(plan);
        const a = plan.approval;
        return page(plan, p, total, `<h3 class="ttl">المتابعة والاعتماد</h3>
          <div class="kpis"><div class="kpi"><span>إجمالي البرامج</span><b>${pr.total}</b></div><div class="kpi"><span>منفّذ</span><b>${pr.done}</b></div>
          <div class="kpi"><span>متوسط الإنجاز</span><b>${pr.pct}%</b></div><div class="kpi"><span>برامج حققت أهدافها</span><b>${pr.achieved}</b></div></div>
          <table class="grid"><thead><tr><th>زيارة المتابعة</th><th>التاريخ</th><th>الملاحظات</th><th>التوقيع</th></tr></thead>
          <tbody>${['المتابعة الأولى', 'المتابعة الثانية', 'المتابعة الثالثة', 'التقييم الختامي'].map((t) => `<tr><td>${t}</td><td></td><td style="height:16mm"></td><td></td></tr>`).join('')}</tbody></table>
          <div class="sign three"><div>مُعدّ الخطة<br><b>${esc(a.preparedBy)}</b><br>التوقيع: ............</div>
          <div>قائد المدرسة<br><b>${esc(a.principal || s.principal)}</b><br>التوقيع: ............</div>
          <div>المشرف التربوي<br><b>${esc(a.supervisor || s.supervisor)}</b><br>التوقيع: ............</div></div>
          <p class="center">تاريخ الاعتماد: ${esc(a.date || '..../..../....')}هـ</p>`);
      }
    }
    return '';
  }

  const BASE_CSS = `
  *{box-sizing:border-box}
  body{margin:0;font-family:'Tajawal','Cairo','Segoe UI',Tahoma,Arial,sans-serif;color:#1d2b29;background:#e9eeec;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:210mm;height:297mm;margin:8mm auto;background:#fff;padding:10mm 12mm 14mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;display:flex;flex-direction:column}
  .page:last-child{page-break-after:auto;break-after:auto}
  @media print{body{background:#fff}.page{margin:0;box-shadow:none}}
  @page{size:A4 portrait;margin:0}
  .hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #0f6b5c;padding-bottom:3mm;margin-bottom:4mm;font-size:9.5pt;line-height:1.55;color:#0f4c43;font-weight:700}
  .hdr-r,.hdr-l{width:38%}.hdr-l{text-align:left}.hdr-c{width:24%;text-align:center}.hdr-c img{max-height:20mm;max-width:40mm}
  .logo-ph{display:inline-block;padding:3mm 6mm;border:1.5px solid #0f6b5c;border-radius:3mm;color:#0f6b5c;font-size:13pt}
  .body{flex:1;font-size:10.5pt;line-height:1.7}
  .ftr{position:absolute;bottom:6mm;left:12mm;right:12mm;display:flex;justify-content:space-between;font-size:8.5pt;color:#667;border-top:1px solid #cfdcd8;padding-top:2mm}
  .ttl{background:#0f6b5c;color:#fff;padding:2.5mm 4mm;border-radius:2mm;font-size:14pt;margin:0 0 4mm}
  h4{color:#0f6b5c;margin:4mm 0 2mm;font-size:11.5pt}h5{margin:0 0 1mm;color:#0f6b5c;font-size:10.5pt}
  table{width:100%;border-collapse:collapse;margin-bottom:3mm}
  .grid th{background:#e3f0ec;color:#0f4c43;font-weight:700}
  .grid th,.grid td,.kv th,.kv td{border:1px solid #b9cfc9;padding:1.6mm 2mm;text-align:center;vertical-align:middle}
  .grid td.tx{text-align:right}.grid.sm{font-size:9pt}.grid.sm th,.grid.sm td{padding:1.2mm 1.5mm}
  .kv th{background:#e3f0ec;width:18%;text-align:right}.kv td{text-align:right;width:32%}
  .lv{display:inline-block;border:1px solid;border-radius:10px;padding:0 2.5mm;font-size:8.5pt;font-weight:700;margin-inline-start:1mm}
  .kpis{display:flex;gap:3mm;margin:2mm 0 4mm}.kpi{flex:1;border:1px solid #cfe0db;border-radius:2.5mm;padding:2.5mm;text-align:center;background:#f6faf9}
  .kpi span{display:block;font-size:8.5pt;color:#566}.kpi b{display:block;font-size:16pt;color:#0f4c43}.kpis.sm .kpi b{font-size:13pt}.kpi small{font-size:8pt;color:#667}
  .stack{display:flex;height:9mm;border-radius:2mm;overflow:hidden;gap:2px;margin-bottom:3mm}.stack div{color:#fff;font-size:8.5pt;font-weight:700;display:flex;align-items:center;justify-content:center}
  .bars .br{display:flex;align-items:center;gap:2mm;margin:1.4mm 0}.bl{width:42%;font-size:9.5pt}.bt{flex:1;height:4.5mm;background:#edf2f0;border-radius:2mm;overflow:hidden}.bf{height:100%;border-radius:2mm}.bv{width:14mm;text-align:left;font-weight:700;font-size:9.5pt}
  .bars.sm .br{margin:.8mm 0}.bars.sm .bt{height:3.5mm}.bars.sm .bl{font-size:8.8pt}
  .cols2{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.cols2.tight{gap:2mm}
  .box{border-radius:2.5mm;padding:2.5mm 3.5mm;border:1px solid;font-size:9.3pt}.box ol{margin:0;padding-inline-start:5mm}.box h4{margin:0 0 1.5mm}
  .box.red{border-color:#e9b4ad;background:#fdf3f2}.box.amber{border-color:#ecd29b;background:#fef8ec}.box.green{border-color:#a9d9c7;background:#f1faf6}.box.blue{border-color:#b3cbe8;background:#f2f6fc}
  .up{color:#0f7b5f;font-weight:700}.down{color:#c0392b;font-weight:700}
  .cover{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:10mm}
  .cover h1{font-size:34pt;color:#0f4c43;margin:4mm 0}.cover h2{font-size:20pt;color:#0f6b5c;margin:0 0 10mm}.cv-kicker{background:#e3f0ec;color:#0f4c43;padding:2mm 6mm;border-radius:20mm;font-weight:700}
  .cv-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;width:100%}.cv-meta div{border:1px solid #cfe0db;border-radius:2.5mm;padding:3mm}.cv-meta b{display:block;font-size:9pt;color:#566}.cv-meta span{font-size:13pt;font-weight:700}
  .cv-note{margin-top:12mm;color:#445;max-width:150mm}
  .cover-page{background:linear-gradient(180deg,#fff 0,#fff 70%,#eef6f3 100%)}
  .lead{font-weight:700}
  .sign{display:flex;justify-content:space-between;margin-top:12mm;text-align:center;line-height:2}.sign.three div{width:32%}
  .center{text-align:center}
  .dom-hero{background:linear-gradient(135deg,#0f6b5c,#14846f);color:#fff;border-radius:3mm;padding:8mm;margin-bottom:5mm}.dom-hero h2{margin:1mm 0;font-size:22pt}.dom-hero .lv{background:#fff!important}
  .ind-head{display:flex;gap:3mm;align-items:stretch;margin-bottom:2mm}.ih-code{background:#0f6b5c;color:#fff;border-radius:2mm;padding:2mm 3mm;font-weight:800;font-size:13pt;display:flex;flex-direction:column;justify-content:center;text-align:center;min-width:24mm}
  .ih-code .old{display:block;font-size:7.5pt;font-weight:500;opacity:.85}
  .ih-txt{flex:1;border:1.5px solid #0f6b5c;border-radius:2mm;padding:2mm 3mm;font-weight:700;font-size:11.5pt;display:flex;align-items:center}
  .ih-meta{display:flex;gap:6mm;font-size:9pt;color:#455;margin-bottom:1mm}
  .sec{border:1px solid #dbe7e3;border-radius:2mm;padding:2mm 3mm;margin-bottom:2mm}.sec p{margin:0}.sec ul{margin:0;padding-inline-start:5mm}
  .ind-page .body{font-size:9.8pt;line-height:1.55}
  `;

  function buildPlanHtml(plan) {
    const st = structure(plan);
    const pagesHtml = st.pages.map((p) => renderPage(plan, p, st.total, st)).join('\n');
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(plan.title)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
      <style>${BASE_CSS}</style></head><body>${pagesHtml}</body></html>`;
  }

  // ———— النموذج الإشرافي: استمارتان A4 أفقي ————
  function buildSupervisoryHtml(plan) {
    const s = plan.school;
    const inds = M.planIndicators(plan);
    const rows1 = inds.map((i) => ({ i, progs: i.plan.programs }));
    const progs = inds.flatMap((i) => i.plan.programs.map((g) => ({ i, g })));
    const hdr = `<div class="lhdr"><div>المملكة العربية السعودية<br>وزارة التعليم<br>${esc(s.region ? 'الإدارة العامة للتعليم ' + s.region : 'إدارة التعليم')}</div>
      <div class="lc">${s.logo ? `<img src="${s.logo}" alt="">` : ''}</div>
      <div style="text-align:left">المدرسة: ${esc(s.name)}<br>الرقم الوزاري: ${esc(s.ministryCode)}<br>المشرف التربوي: ${esc(s.supervisor)}</div></div>`;
    const p1 = [rows1].map((part, k, all) => `<section class="lpage">${hdr}
      <h3 class="ttl">الاستمارة (1): خطة التحسين وفق النموذج الإشرافي ${all.length > 1 ? `<small>(${k + 1}/${all.length})</small>` : ''}</h3>
      <table class="grid sm"><thead><tr><th>م</th><th>المجال</th><th>المعيار</th><th>المؤشر</th><th>الوضع الراهن</th><th>المستهدف</th><th>المبادرة</th><th>البرامج والإجراءات التنفيذية</th><th>المسؤول</th><th>زمن التنفيذ</th><th>مؤشر القياس</th><th>الأدلة والشواهد</th></tr></thead>
      <tbody>${part.map(({ i }, n) => `<tr><td>${n + 1}</td><td>${esc(M.domainName(plan, i.code))}</td><td>${esc(M.standardName(plan, i.code))}</td><td class="tx"><b>${esc(i.code)}</b>${plan.report.edition3 && i.oldCode ? ` <small>(سابقًا ${esc(i.oldCode)})</small>` : ''} ${esc(i.text)}</td>
        <td>${pct(i.score)}</td><td>${pct(i.target)}</td><td class="tx">${esc(i.plan.initiative)}</td><td class="tx"><ol>${i.plan.programs.map((g) => `<li>${esc(g.name)} <small>(${esc(g.method)})</small></li>`).join('')}</ol></td>
        <td>${esc(i.plan.team.split('،')[0])}</td><td>${esc((i.plan.programs[0] || {}).start || plan.period.start)} — ${esc((i.plan.programs[0] || {}).end || plan.period.end)}</td><td class="tx">${esc(i.plan.measure)}</td><td class="tx">${esc(i.plan.evidence.join('، '))}</td></tr>`).join('')}</tbody></table>
      <div class="lsign"><span>قائد المدرسة: ${esc(s.principal)} — التوقيع: ..........</span><span>المشرف التربوي: ${esc(s.supervisor)} — التوقيع: ..........</span></div></section>`).join('');
    const p2 = [progs].map((part, k, all) => `<section class="lpage">${hdr}
      <h3 class="ttl">الاستمارة (2): متابعة تنفيذ خطة التحسين ${all.length > 1 ? `<small>(${k + 1}/${all.length})</small>` : ''}</h3>
      <table class="grid sm"><thead><tr><th>م</th><th>المؤشر</th><th>البرنامج</th><th>المسؤول</th><th>حالة التنفيذ</th><th>نسبة الإنجاز</th><th>تحقق الهدف</th><th>الصعوبات / الملاحظات</th><th>الإجراء التصحيحي</th><th>ملاحظات المشرف</th></tr></thead>
      <tbody>${part.map(({ i, g }, n) => `<tr><td>${n + 1}</td><td>${esc(i.code)}</td><td class="tx">${esc(g.name)}</td><td>${esc(g.owner)}</td><td>${M.STATUS[g.status] || ''}</td><td>${g.completion || 0}%</td><td>${g.achieved === true ? 'نعم' : g.achieved === false ? 'لا' : '—'}</td><td class="tx">${esc(g.note)}</td><td></td><td></td></tr>`).join('')}</tbody></table>
      <div class="lsign"><span>قائد المدرسة: ${esc(s.principal)} — التوقيع: ..........</span><span>تاريخ المتابعة: ..../..../....هـ</span><span>المشرف التربوي: ${esc(s.supervisor)} — التوقيع: ..........</span></div></section>`).join('');
    const css = BASE_CSS.replace('@page{size:A4 portrait;margin:0}', '@page{size:A4 landscape;margin:0}') + `
      .lpage{width:297mm;min-height:210mm;margin:8mm auto;background:#fff;padding:8mm 10mm;page-break-after:always;break-after:page;font-size:9pt}
      .lpage tr{break-inside:avoid;page-break-inside:avoid}.lpage thead{display:table-header-group}
      @media print{.lpage{width:auto;min-height:0;padding:0}}
      @page{margin:8mm 10mm}
      .lpage:last-child{page-break-after:auto}@media print{.lpage{margin:0}}
      .lhdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f6b5c;padding-bottom:2mm;margin-bottom:3mm;font-weight:700;color:#0f4c43;font-size:9pt;line-height:1.5}
      .lhdr>div{width:36%}.lc{text-align:center;width:28%!important}.lc img{max-height:15mm}
      .lpage .grid.sm{font-size:8pt}.lpage ol{margin:0;padding-inline-start:4mm}
      .lsign{display:flex;justify-content:space-between;margin-top:4mm;font-weight:700}`;
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>النموذج الإشرافي — ${esc(s.name)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"><style>${css}</style></head><body>${p1}${p2}</body></html>`;
  }

  function printHtml(html) {
    const old = document.getElementById('tahseen-print-frame');
    if (old) old.remove();
    const fr = document.createElement('iframe');
    fr.id = 'tahseen-print-frame';
    fr.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-10px;top:-10px';
    document.body.appendChild(fr);
    const doc = fr.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { console.error(e); } };
    const ready = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
    Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(go, 300));
  }

  function previewHtml(html) {
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.open(); w.document.write(html); w.document.close();
    return true;
  }

  global.TahseenPdf = { structure, buildPlanHtml, buildSupervisoryHtml, printHtml, previewHtml, esc, pct, chunk };
})(window);

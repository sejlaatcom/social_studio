/* تحسين — واجهة التطبيق */
(function () {
  'use strict';
  const F = window.TahseenFramework, P = window.TahseenParser, M = window.TahseenModel, X = window.TahseenPdf, W = window.TahseenDocx;
  const esc = X.esc, pct = X.pct;
  const app = document.getElementById('app');

  let plans = M.loadAll();
  let state = { planId: null, tab: 'upload', lastParse: null, busy: '' };

  const TABS = [
    ['upload', '⬆', 'رفع التقرير والبيانات'],
    ['dashboard', '◔', 'لوحة النتائج'],
    ['analysis', '✦', 'القراءة التحليلية'],
    ['plan', '☰', 'خطة التحسين'],
    ['follow', '✔', 'متابعة التنفيذ'],
    ['compare', '⇄', 'المقارنة بدورة سابقة'],
    ['school', '⌂', 'المدرسة والفريق'],
    ['supervisory', '▭', 'النموذج الإشرافي'],
  ];

  // ———— أدوات ————
  const plan = () => plans.find((p) => p.id === state.planId);
  function toast(msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }
  let saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    const go = () => { if (!M.saveAll(plans)) toast('تعذّر الحفظ: مساحة التخزين ممتلئة — صدّر نسخة احتياطية'); };
    if (now) go(); else saveTimer = setTimeout(go, 400);
  }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, val) {
    const ks = path.split('.');
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = val;
  }
  const lvBadge = (p, v) => { const l = M.levelOf(p, v); return l ? `<span class="lv" style="background:${l.soft};color:${l.color};border-color:${l.color}">${l.name}</span>` : '<span class="muted">—</span>'; };
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return iso; } };
  const inp = (path, val, o) => {
    o = o || {};
    const v = val == null ? '' : val;
    if (o.area) return `<textarea data-p="${path}" ${o.t ? `data-t="${o.t}"` : ''} rows="${o.rows || 3}" ${o.r ? 'data-r' : ''}>${esc(v)}</textarea>`;
    return `<input ${o.type ? `type="${o.type}"` : 'type="text"'} ${o.cls ? `class="${o.cls}"` : ''} data-p="${path}" ${o.t ? `data-t="${o.t}"` : ''} value="${esc(v)}" ${o.r ? 'data-r' : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.step ? `step="${o.step}"` : ''} ${o.min != null ? `min="${o.min}" max="${o.max}"` : ''}>`;
  };
  const field = (label, html) => `<label class="f">${label}${html}</label>`;

  // ———— التوجيه ————
  function route() {
    const h = location.hash.replace(/^#\/?/, '').split('/');
    if (h[0] === 'plan' && plans.some((p) => p.id === h[1])) {
      state.planId = h[1];
      state.tab = TABS.some((t) => t[0] === h[2]) ? h[2] : 'upload';
    } else state.planId = null;
    render();
    window.scrollTo(0, 0);
  }
  const go = (id, tab) => { location.hash = id ? `#/plan/${id}/${tab || 'upload'}` : '#/'; };

  function render() {
    const p = plan();
    document.getElementById('topPlan').textContent = p ? p.title : '';
    if (!p) { app.innerHTML = viewHome(); return; }
    const views = { upload: viewUpload, dashboard: viewDashboard, analysis: viewAnalysis, plan: viewPlan, follow: viewFollow, compare: viewCompare, school: viewSchool, supervisory: viewSupervisory };
    app.innerHTML = `<div class="layout"><nav class="tabs" aria-label="أقسام الخطة">${TABS.map(([k, ic, name]) => `<button class="tab ${state.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span class="ic">${ic}</span>${name}</button>`).join('')}
      <hr style="border:0;border-top:1px solid var(--line);width:100%"><button class="tab" data-act="home"><span class="ic">↩</span>كل الخطط</button></nav>
      <section>${views[state.tab](p)}</section></div>`;
  }

  // ———— الرئيسية ————
  function viewHome() {
    const list = plans.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return `<div class="hero"><h1>تحسين</h1>
      <p>ارفع تقرير الأداء المدرسي من منصة تميز (التقويم الذاتي أو الخارجي)، فتُحلَّل المؤشرات وتُصنَّف على المستويات الأربعة، ويُحدَّد المستهدف والفجوة لكل مؤشر، ثم تصدّر خطة التحسين PDF أو Word بضغطة واحدة.</p>
      <div class="steps"><div class="step"><b>١. ارفع التقرير</b>يُقرأ داخل متصفحك — لا يُرفع لأي خادم.</div><div class="step"><b>٢. راجع التحليل</b>لوحة نتائج وقراءة تحليلية آلية ومستهدفات قابلة للتعديل.</div><div class="step"><b>٣. صدّر الخطة</b>PDF أو Word، والنموذج الإشرافي بمقاس A4 أفقي.</div></div>
      <div class="row" style="margin-top:18px"><button class="btn" data-act="new">＋ خطة جديدة</button><button class="btn" data-act="demo">جرّب بخطة تجريبية</button></div></div>
      <div class="card"><div class="row"><h2 style="margin:0">خططي (${list.length})</h2><span class="spacer"></span>
        <label class="btn sm">استيراد نسخة احتياطية<input type="file" accept=".json,application/json" data-act="importJson" hidden></label>
        <button class="btn sm" data-act="exportAll" ${list.length ? '' : 'disabled'}>تصدير نسخة احتياطية</button></div>
      ${list.length ? `<div class="plans" style="margin-top:14px">${list.map((p) => {
        const ov = M.overallOf(p);
        const pr = M.progressOf(p);
        return `<div class="card plan-card" style="margin:0"><div class="row"><h3>${esc(p.title)}</h3></div>
          <div class="muted small">${esc(M.REPORT_TYPES[p.report.type])} · ${p.indicators.length} مؤشر · آخر تعديل ${fmtDate(p.updatedAt)}</div>
          <div class="row"><b style="font-size:22px">${pct(ov)}</b>${lvBadge(p, ov)}<span class="spacer"></span><span class="small muted">إنجاز الخطة ${pr.pct}%</span></div>
          <div class="progress"><div style="width:${pr.pct}%"></div></div>
          <div class="row"><button class="btn primary sm" data-act="open" data-id="${p.id}">فتح</button><button class="btn sm" data-act="dup" data-id="${p.id}">نسخ</button><span class="spacer"></span><button class="btn sm danger" data-act="del" data-id="${p.id}">حذف</button></div></div>`;
      }).join('')}</div>` : '<div class="empty">لا توجد خطط بعد. ابدأ بخطة جديدة وارفع تقرير منصة تميز.</div>'}
      <p class="small muted" style="margin-top:14px">تُحفظ الخطط في متصفحك على هذا الجهاز. لنقلها إلى جهاز آخر استخدم «تصدير نسخة احتياطية» ثم «استيراد».</p></div>`;
  }

  // ———— رفع التقرير ————
  function viewUpload(p) {
    const lp = state.lastParse;
    const parsedInfo = lp ? `<div class="${lp.parsed.indicators.length ? 'ok' : 'note'}" style="margin-top:12px">
        ${lp.parsed.indicators.length ? `✔ تمت قراءة <b>${esc(lp.name)}</b>: ${lp.numPages} صفحة، ${lp.parsed.indicators.length} مؤشرًا، ${lp.parsed.standards.length} معيارًا، ${lp.parsed.domains.length} مجالات${lp.parsed.overall != null ? `، الأداء العام ${pct(lp.parsed.overall)}` : ''}. راجع الجدول أدناه وصحّح ما يلزم.`
        : `لم نتعرّف على مؤشرات في <b>${esc(lp.name)}</b>. قد يكون الملف ممسوحًا ضوئيًا (صورة) أو بتنسيق مختلف. استخدم الإدخال اليدوي أو الصق النص أدناه.`}
        <details style="margin-top:8px"><summary class="small">عرض النص المستخرج (${lp.lines.length} سطر)</summary><pre class="raw">${esc(lp.lines.map((l) => l.text).join('\n'))}</pre></details></div>` : '';
    return `<div class="card"><h2>رفع تقرير الأداء المدرسي</h2>
      <p class="muted">ارفع ملف PDF الصادر من منصة تميز (التقويم الذاتي — الدورة الأولى أو الثانية، أو التقويم الخارجي). تُقرأ النصوص داخل متصفحك ولا يُرفع الملف لأي خادم. يمكنك إعادة رفع التقرير على نفس الخطة في أي وقت دون فقدان تعديلاتك.</p>
      <label class="drop" id="drop"><input type="file" accept="application/pdf,.pdf" data-act="pdf" hidden>
        <b>${state.busy ? esc(state.busy) : 'اسحب ملف التقرير هنا أو اضغط للاختيار'}</b><span class="muted small">PDF فقط</span></label>
      ${parsedInfo}
      <div class="grid4" style="margin-top:16px">
        ${field('نوع التقرير', `<select data-p="report.type">${Object.entries(M.REPORT_TYPES).map(([k, v]) => `<option value="${k}" ${p.report.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${field('الأداء العام (%)', inp('report.overall', p.report.overall, { type: 'number', t: 'num', step: '0.1', r: 1, ph: p.report.computedOverall != null ? 'محسوب: ' + p.report.computedOverall : '' }))}
        ${field('عنوان الخطة', inp('title', p.title))}
        <label class="f">ترقيم الإصدار الثالث (1447هـ)<span class="row" style="font-weight:500;color:var(--ink)"><input type="checkbox" data-p="report.edition3" data-t="bool" ${p.report.edition3 ? 'checked' : ''} style="width:auto"> إظهار الكود القديم بجانب الجديد</span></label>
      </div>
      <details style="margin-top:14px"><summary class="small"><b>لا يتوفر ملف PDF؟ الصق نص التقرير</b></summary>
        <p class="small muted">انسخ نص التقرير (أو جدول المؤشرات) والصقه هنا. يكفي أن يحتوي كل سطر على رمز المؤشر (مثل 1.2.3) ونصه ونسبته.</p>
        <textarea id="pasteText" rows="6" placeholder="1.1.1 توفر رؤية ورسالة واضحة للمدرسة 85%"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn" data-act="parsePaste">تحليل النص</button></div></details>
    </div>
    ${editorDomains(p)}
    ${editorIndicators(p)}`;
  }

  function editorDomains(p) {
    const row = (arr, k, x, kind) => `<tr><td><input class="code" data-p="${kind}.${k}.code" value="${esc(x.code)}" data-r></td><td>${inp(`${kind}.${k}.name`, x.name)}</td>
      <td><input type="number" step="0.1" class="num" data-p="${kind}.${k}.score" data-t="num" value="${x.score == null ? '' : x.score}" data-r placeholder="${x.computed == null ? '' : x.computed}"></td>
      <td>${lvBadge(p, M.scoreOf(x))}</td><td class="small muted">${x.count || 0} مؤشر</td><td><button class="btn sm danger" data-act="delRow" data-kind="${kind}" data-k="${k}" title="حذف">✕</button></td></tr>`;
    return `<div class="card"><h2>المجالات والمعايير</h2><p class="small muted">تُستبدل الأسماء تلقائيًا بما ورد في التقرير. اترك النسبة فارغة لتُحسب من متوسط المؤشرات.</p>
      <div class="grid2"><div class="tw"><table class="t"><thead><tr><th>الرمز</th><th>المجال</th><th>النسبة</th><th>المستوى</th><th></th><th></th></tr></thead><tbody>${p.domains.map((x, k) => row(p.domains, k, x, 'domains')).join('')}</tbody></table>
        <button class="btn sm" data-act="addRow" data-kind="domains" style="margin-top:8px">＋ مجال</button></div>
      <div class="tw"><table class="t"><thead><tr><th>الرمز</th><th>المعيار</th><th>النسبة</th><th>المستوى</th><th></th><th></th></tr></thead><tbody>${p.standards.map((x, k) => row(p.standards, k, x, 'standards')).join('')}</tbody></table>
        <button class="btn sm" data-act="addRow" data-kind="standards" style="margin-top:8px">＋ معيار</button></div></div></div>`;
  }

  function editorIndicators(p) {
    return `<div class="card"><div class="row"><h2 style="margin:0">المؤشرات (${p.indicators.length})</h2><span class="spacer"></span>
      ${p.indicators.length ? '<button class="btn sm" data-act="swapCodes" title="إذا قُرئ الكود القديم مكان الجديد">تبديل الكود الجديد/القديم</button>' : ''}</div>
      <p class="small muted">أدخل النسب يدويًا إن لم يتوفر ملف PDF. «الاستبانة» اختيارية لحساب فجوة الإدراك. ألغِ «ضمن الخطة» لاستبعاد مؤشر من صفحات التحسين.</p>
      <div class="tw"><table class="t"><thead><tr><th>الرمز</th><th>الرمز السابق</th><th>نص المؤشر</th><th>النسبة</th><th>الاستبانة</th><th>المستوى</th><th>المستهدف</th><th>ضمن الخطة</th><th></th></tr></thead><tbody>
      ${p.indicators.map((i, k) => `<tr><td><input class="code" data-p="indicators.${k}.code" value="${esc(i.code)}" data-r></td>
        <td><input class="code" data-p="indicators.${k}.oldCode" value="${esc(i.oldCode || '')}"></td>
        <td style="min-width:260px">${inp(`indicators.${k}.text`, i.text)}${i.values && i.values.length > 1 ? `<div class="small muted">قيم مقروءة: ${i.values.map((v) => `<a href="#" data-act="pickVal" data-k="${k}" data-v="${v}">${v}%</a>`).join(' · ')}</div>` : ''}</td>
        <td><input type="number" step="0.1" class="num" data-p="indicators.${k}.score" data-t="num" value="${i.score == null ? '' : i.score}" data-r></td>
        <td><input type="number" step="0.1" class="num" data-p="indicators.${k}.survey" data-t="num" value="${i.survey == null ? '' : i.survey}"></td>
        <td>${lvBadge(p, i.score)}</td>
        <td><input type="number" step="0.1" class="num" data-p="indicators.${k}.target" data-t="num" value="${i.target == null ? '' : i.target}"></td>
        <td style="text-align:center"><input type="checkbox" data-p="indicators.${k}.excluded" data-t="notbool" ${i.excluded ? '' : 'checked'} style="width:auto"></td>
        <td><button class="btn sm danger" data-act="delInd" data-k="${k}" title="حذف">✕</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="row" style="margin-top:10px"><input class="code" id="newCode" placeholder="1.1.1"><input id="newText" placeholder="نص المؤشر" style="flex:1;min-width:200px"><input type="number" step="0.1" class="num" id="newScore" placeholder="%"><button class="btn primary sm" data-act="addInd">＋ إضافة مؤشر</button></div>
      ${p.indicators.length ? `<div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn primary" data-act="tab" data-tab="dashboard">عرض لوحة النتائج ←</button></div>` : ''}</div>`;
  }

  // ———— لوحة النتائج ————
  function donut(p, v) {
    const l = M.levelOf(p, v);
    const r = 54, c = 2 * Math.PI * r, val = v == null ? 0 : Math.max(0, Math.min(100, v));
    return `<svg width="150" height="150" viewBox="0 0 140 140" role="img" aria-label="الأداء العام ${pct(v)}"><circle cx="70" cy="70" r="${r}" fill="none" stroke="#edf2f0" stroke-width="14"/>
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="${l ? l.color : '#999'}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c * val / 100} ${c}" transform="rotate(-90 70 70)"/>
      <text x="70" y="70" text-anchor="middle" font-size="24" font-weight="800" fill="#1d2b29" dominant-baseline="middle">${v == null ? '—' : M.round1(v) + '%'}</text>
      <text x="70" y="96" text-anchor="middle" font-size="12" fill="#5d6f6b">${l ? l.name : ''}</text></svg>`;
  }
  function bars(p, items) {
    const ticks = M.levelsOf(p).filter((l) => l.min > 0).map((l) => `<span class="tick" style="right:${l.min}%"></span>`).join('');
    return `<div class="bars">${items.map((x) => {
      const v = M.scoreOf(x), l = M.levelOf(p, v);
      return `<div class="br" title="${esc(x.code + ' ' + x.name)}: ${pct(v)}${l ? ' — ' + l.name : ''}"><div class="bl">${esc(x.code)} ${esc(x.name)}</div>
        <div class="bt">${ticks}<div class="bf" style="width:${v || 0}%;background:${l ? l.color : '#bbb'}"></div></div><div class="bv">${pct(v)}</div></div>`;
    }).join('')}</div>`;
  }
  function viewDashboard(p) {
    if (!p.indicators.length && p.domains.every((d) => d.score == null)) return emptyNeedData();
    const ov = M.overallOf(p);
    const dist = M.distribution(p);
    const total = dist.reduce((a, b) => a + b.count, 0) || 1;
    return `<div class="card"><div class="row"><h2 style="margin:0">لوحة النتائج</h2><span class="spacer"></span><span class="muted small">${esc(M.REPORT_TYPES[p.report.type])}</span></div>
      <div class="donut-wrap" style="margin-top:12px">${donut(p, ov)}
        <div style="flex:1;min-width:260px"><div class="kpis">${dist.map((l) => `<div class="kpi" style="border-inline-start:4px solid ${l.color}"><span>${l.name} <small>(من ${l.min}%)</small></span><b>${l.count}</b><small>${Math.round(l.count / total * 100)}% من المؤشرات</small></div>`).join('')}</div>
        <h3>توزّع المؤشرات على المستويات</h3><div class="stack" role="img" aria-label="توزع المؤشرات">${dist.filter((l) => l.count).map((l) => `<div style="flex:${l.count};background:${l.color}" title="${l.name}: ${l.count}">${l.name} ${l.count}</div>`).join('')}</div></div></div></div>
      <div class="grid2"><div class="card"><h2>أداء المجالات</h2>${bars(p, p.domains)}</div><div class="card"><h2>أداء المعايير</h2>${bars(p, p.standards)}</div></div>
      <div class="card"><h2>جميع المؤشرات</h2>${bars(p, p.indicators.map((i) => ({ code: i.code, name: i.text, score: i.score })))}</div>`;
  }
  const emptyNeedData = () => `<div class="card empty">لا توجد بيانات بعد. ارفع التقرير أو أدخل النسب يدويًا من تبويب «رفع التقرير والبيانات».<br><br><button class="btn primary" data-act="tab" data-tab="upload">رفع التقرير</button></div>`;

  // ———— القراءة التحليلية ————
  function viewAnalysis(p) {
    if (!p.indicators.length) return emptyNeedData();
    const a = M.analysis(p);
    const li = (i, extra) => `<li><b>${esc(i.code)}</b> ${esc(i.text)} — <b>${pct(i.score)}</b> ${extra || ''}</li>`;
    const ov = M.overallOf(p), lvl = M.levelOf(p, ov);
    const weakestD = a.domainsRanked[0], strongestD = a.domainsRanked[a.domainsRanked.length - 1];
    const summary = `حققت المدرسة أداءً عامًا قدره <b>${pct(ov)}</b>${lvl ? ` (مستوى «${lvl.name}»)` : ''}.
      ${weakestD ? ` أدنى المجالات «${esc(weakestD.name)}» بنسبة ${pct(M.scoreOf(weakestD))}` : ''}${strongestD && strongestD !== weakestD ? `، وأعلاها «${esc(strongestD.name)}» بنسبة ${pct(M.scoreOf(strongestD))}.` : '.'}
      ${a.quick.length ? ` يوجد <b>${a.quick.length}</b> مؤشرات قريبة من عتبة المستوى التالي يمكن رفعها سريعًا.` : ''}
      ${a.surveyAvg != null ? ` متوسط نتائج الاستبانات ${pct(a.surveyAvg)} مقابل ${pct(a.actualAvg)} للنتيجة الفعلية${a.surveyAvg - a.actualAvg > 5 ? '، ما يشير إلى تقدير ذاتي أعلى من الواقع يستدعي مراجعة الأدلة' : a.actualAvg - a.surveyAvg > 5 ? '، ما يشير إلى ضعف وعي المستفيدين بالجهود المبذولة' : ''}.` : ''}`;
    return `<div class="card"><h2>القراءة التحليلية</h2><p>${summary}</p></div>
      <div class="grid2">
        <div class="insight red"><h3>أدنى المؤشرات أداءً</h3><ol>${a.lowest.map((i) => li(i, lvBadge(p, i.score))).join('')}</ol></div>
        <div class="insight amber"><h3>المكاسب السريعة</h3>${a.quick.length ? `<ol>${a.quick.map((q) => li(q.ind, `<span class="small muted">— يحتاج <b>${q.need}</b> نقطة لبلوغ «${q.next.name}»</span>`)).join('')}</ol>` : '<p class="small">لا توجد مؤشرات ضمن 7 نقاط من عتبة المستوى التالي.</p>'}</div>
        <div class="insight green"><h3>جوانب القوة</h3>${a.strengths.length ? `<ol>${a.strengths.map((i) => li(i)).join('')}</ol>` : '<p class="small">لا توجد مؤشرات في مستوى التميز بعد.</p>'}</div>
        <div class="insight blue"><h3>فجوة الإدراك: الاستبانات مقابل النتيجة الفعلية</h3>
          ${a.surveyAvg == null ? '<p class="small">أدخل نتائج الاستبانات في جدول المؤشرات لإظهار الفجوة.</p>' : `<p class="small">متوسط الاستبانات <b>${pct(a.surveyAvg)}</b> · النتيجة الفعلية <b>${pct(a.actualAvg)}</b></p>
          ${a.gaps.length ? `<ol>${a.gaps.map((g) => li(g.ind, `<span class="small ${g.gap > 0 ? 'down' : 'up'}">(استبانة ${pct(g.ind.survey)}، فجوة ${g.gap > 0 ? '+' : ''}${g.gap})</span>`)).join('')}</ol>` : '<p class="small">لا توجد فجوات تتجاوز 10 نقاط.</p>'}`}</div>
      </div>
      <div class="card" style="margin-top:18px"><h2>أولويات التحسين حسب المعايير</h2>${bars(p, a.standardsRanked)}</div>`;
  }

  // ———— خطة التحسين ————
  function viewPlan(p) {
    if (!p.indicators.length) return emptyNeedData();
    const list = M.planIndicators(p);
    const st = X.structure(p);
    const idx = (i) => p.indicators.indexOf(i);
    return `<div class="card"><div class="row"><h2 style="margin:0">خطة التحسين</h2><span class="spacer"></span>
        <button class="btn primary" data-act="exportPdf">⬇ تصدير PDF</button><button class="btn" data-act="exportDocx">⬇ تصدير Word</button><button class="btn" data-act="previewPdf">معاينة</button></div>
      <p class="small muted">تضم الخطة ${st.total} صفحة: الغلاف، بطاقة المدرسة، قرار تشكيل الفريق، لوحة النتائج، القراءة التحليلية${p.previous ? '، المقارنة' : ''}، فهرس لكل مجال، صفحة لكل مؤشر (${list.length})، جدول الاستدامة، وصفحة المتابعة والاعتماد. عند تصدير PDF اختر «حفظ بتنسيق PDF» من نافذة الطباعة.</p>
      <div class="row"><label class="row small" style="font-weight:700"><input type="checkbox" data-p="settings.includeAdvanced" data-t="bool" data-r ${p.settings.includeAdvanced !== false ? 'checked' : ''} style="width:auto"> تضمين مؤشرات مستوى «تقدّم» في صفحات التحسين</label>
        <span class="spacer"></span>${field('بداية التنفيذ', inp('period.start', p.period.start, { ph: '1447-03-01' }))}${field('نهاية التنفيذ', inp('period.end', p.period.end, { ph: '1447-11-30' }))}
        <button class="btn sm" data-act="applyPeriod" title="تطبيق التواريخ على كل البرامج">تطبيق على البرامج</button></div></div>
      ${list.length ? list.map((i) => indicatorEditor(p, i, idx(i), st)).join('') : '<div class="card empty">جميع المؤشرات في مستوى التميز — راجع جدول الاستدامة في الملف المصدّر.</div>'}`;
  }

  function indicatorEditor(p, i, k, st) {
    const base = `indicators.${k}.plan`;
    const pageNo = (st.pages.find((x) => x.kind === 'indicator' && x.ind === i) || {}).no;
    const gap = i.target != null && i.score != null ? M.round1(i.target - i.score) : '—';
    return `<details class="acc"><summary><span class="codepill">${esc(i.code)}</span>${p.report.edition3 && i.oldCode ? `<span class="old">(سابقًا ${esc(i.oldCode)})</span>` : ''}
      <span class="ttx">${esc(i.text || 'بدون نص')}</span>${lvBadge(p, i.score)}<b>${pct(i.score)}</b><span class="small muted">← ${pct(i.target)}</span>${pageNo ? `<span class="small muted">ص ${pageNo}</span>` : ''}</summary>
      <div class="acc-body">
        <div class="grid4">${field('الأداء الحالي %', inp(`indicators.${k}.score`, i.score, { type: 'number', t: 'num', step: '0.1', r: 1 }))}
          ${field('المستهدف %', inp(`indicators.${k}.target`, i.target, { type: 'number', t: 'num', step: '0.1', r: 1 }))}
          <label class="f">الفجوة<b style="font-size:20px;color:var(--ink)">${gap}</b></label>
          <label class="f">&nbsp;<button class="btn sm" data-act="regen" data-k="${k}">↻ اقتراح برامج جديدة</button></label></div>
        <div style="margin-top:12px">${field('المبادرة', inp(`${base}.initiative`, i.plan.initiative))}</div>
        <h3>البرامج وأساليب التنفيذ</h3>
        <div class="tw"><table class="t"><thead><tr><th>البرنامج</th><th>أسلوب التنفيذ</th><th>المسؤول</th><th>من</th><th>إلى</th><th></th></tr></thead><tbody>
        ${i.plan.programs.map((g, n) => `<tr><td style="min-width:220px">${inp(`${base}.programs.${n}.name`, g.name)}</td><td>${inp(`${base}.programs.${n}.method`, g.method)}</td><td>${inp(`${base}.programs.${n}.owner`, g.owner)}</td>
          <td>${inp(`${base}.programs.${n}.start`, g.start, { ph: '1447-03-01' })}</td><td>${inp(`${base}.programs.${n}.end`, g.end)}</td><td><button class="btn sm danger" data-act="delProg" data-k="${k}" data-n="${n}">✕</button></td></tr>`).join('')}
        </tbody></table></div><button class="btn sm" data-act="addProg" data-k="${k}" style="margin-top:8px">＋ برنامج</button>
        <div class="grid2" style="margin-top:12px">${field('الأدلة والشواهد (دليل في كل سطر)', inp(`${base}.evidence`, i.plan.evidence.join('\n'), { area: 1, t: 'lines', rows: 4 }))}
          <div>${field('مؤشر القياس', inp(`${base}.measure`, i.plan.measure))}<div style="height:10px"></div>${field('الفريق المكلف', inp(`${base}.team`, i.plan.team))}</div></div>
        <div style="margin-top:12px">${field('إجراءات الاستدامة', inp(`${base}.sustain`, i.plan.sustain))}</div>
        <h3>جدول قياس النواتج (القيم المستهدفة)</h3>
        <div class="grid4">${i.plan.measurements.map((m, n) => field(esc(m.period), inp(`${base}.measurements.${n}.target`, m.target, { type: 'number', t: 'num', step: '0.1' }))).join('')}</div>
      </div></details>`;
  }

  // ———— المتابعة ————
  function viewFollow(p) {
    const list = M.planIndicators(p);
    if (!list.length) return emptyNeedData();
    const pr = M.progressOf(p);
    return `<div class="card"><h2>متابعة التنفيذ</h2><p class="small muted">علّم حالة كل برنامج ونسبة إنجازه وتحقق هدفه، وسجّل القيم المتحققة في جدول قياس النواتج. تظهر هذه البيانات داخل الخطة المصدّرة والنموذج الإشرافي.</p>
      <div class="kpis"><div class="kpi"><span>إجمالي البرامج</span><b>${pr.total}</b></div><div class="kpi"><span>منفّذ</span><b class="status-done">${pr.done}</b></div><div class="kpi"><span>قيد التنفيذ</span><b class="status-progress">${pr.progress}</b></div>
      <div class="kpi"><span>متأخر</span><b class="status-late">${pr.late}</b></div><div class="kpi"><span>متوسط الإنجاز</span><b>${pr.pct}%</b><div class="progress"><div style="width:${pr.pct}%"></div></div></div><div class="kpi"><span>حققت أهدافها</span><b>${pr.achieved}</b></div></div></div>
      ${list.map((i) => {
        const k = p.indicators.indexOf(i), base = `indicators.${k}.plan`;
        const ip = M.round1(M.avg(i.plan.programs.map((g) => Number(g.completion) || 0))) || 0;
        return `<details class="acc"><summary><span class="codepill">${esc(i.code)}</span><span class="ttx">${esc(i.text)}</span><span class="small muted">إنجاز ${ip}%</span><div class="progress" style="width:90px"><div style="width:${ip}%"></div></div></summary><div class="acc-body">
          <div class="tw"><table class="t"><thead><tr><th>البرنامج</th><th>حالة التنفيذ</th><th>نسبة الإنجاز</th><th>تحقق الهدف</th><th>ملاحظات</th></tr></thead><tbody>
          ${i.plan.programs.map((g, n) => `<tr><td>${esc(g.name)}</td>
            <td><select data-p="${base}.programs.${n}.status" data-r>${Object.entries(M.STATUS).map(([s, t]) => `<option value="${s}" ${g.status === s ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
            <td style="min-width:150px"><div class="row"><input type="range" min="0" max="100" step="5" data-p="${base}.programs.${n}.completion" data-t="num" data-r value="${g.completion || 0}" style="flex:1"><b>${g.completion || 0}%</b></div></td>
            <td><select data-p="${base}.programs.${n}.achieved" data-t="tri"><option value="" ${g.achieved == null ? 'selected' : ''}>—</option><option value="1" ${g.achieved === true ? 'selected' : ''}>نعم</option><option value="0" ${g.achieved === false ? 'selected' : ''}>لا</option></select></td>
            <td>${inp(`${base}.programs.${n}.note`, g.note)}</td></tr>`).join('')}</tbody></table></div>
          <h3>القيم المتحققة في قياس النواتج</h3>
          <div class="grid4">${i.plan.measurements.map((m, n) => field(`${esc(m.period)} <span class="muted">(المستهدف ${pct(m.target)})</span>`, inp(`${base}.measurements.${n}.actual`, m.actual, { type: 'number', t: 'num', step: '0.1' }))).join('')}</div>
        </div></details>`;
      }).join('')}`;
  }

  // ———— المقارنة ————
  function viewCompare(p) {
    const c = M.comparison(p);
    const dcell = (d) => (d == null ? '—' : `<span class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : ''}${d}</span>`);
    return `<div class="card"><h2>المقارنة مع دورة تقويم سابقة (اختياري)</h2>
      <p class="small muted">ارفع تقرير الدورة الماضية لتظهر الفروق لكل مؤشر ومجال، وتُضاف صفحات المقارنة داخل الخطة المصدّرة. تُطابق المؤشرات بالرمز الجديد أو القديم.</p>
      <div class="row"><input id="prevLabel" placeholder="اسم الدورة السابقة (مثال: 1446هـ)" value="${esc(p.previous ? p.previous.label : '')}" style="max-width:280px">
        <label class="btn primary">رفع تقرير الدورة السابقة<input type="file" accept="application/pdf,.pdf" data-act="prevPdf" hidden></label>
        <button class="btn" data-act="prevManual">إدخال يدوي</button>${p.previous ? '<button class="btn danger" data-act="prevClear">إزالة المقارنة</button>' : ''}</div>
      ${state.busy ? `<p class="muted">${esc(state.busy)}</p>` : ''}</div>
      ${c ? `<div class="card"><div class="kpis"><div class="kpi"><span>${esc(c.label)}</span><b>${pct(c.prev)}</b></div><div class="kpi"><span>الدورة الحالية</span><b>${pct(c.now)}</b></div>
        <div class="kpi"><span>الفرق</span><b>${dcell(c.diff)}</b></div><div class="kpi"><span>مؤشرات تحسّنت</span><b class="up">${c.improved}</b></div><div class="kpi"><span>مؤشرات تراجعت</span><b class="down">${c.declined}</b></div></div></div>
      <div class="grid2"><div class="card"><h2>المجالات</h2><table class="t"><thead><tr><th>المجال</th><th>السابقة</th><th>الحالية</th><th>الفرق</th></tr></thead><tbody>
        ${c.doms.map((r, k) => `<tr><td>${esc(r.code)} ${esc(r.name)}</td><td>${p.previous._manual ? `<input type="number" class="num" step="0.1" data-p="previous.domains.${k}.score" data-t="num" data-r value="${r.prev == null ? '' : r.prev}">` : pct(r.prev)}</td><td>${pct(r.now)}</td><td>${dcell(r.diff)}</td></tr>`).join('')}</tbody></table>
        ${p.previous._manual ? `<div style="margin-top:10px">${field('الأداء العام السابق %', inp('previous.overall', p.previous.overall, { type: 'number', t: 'num', step: '0.1', r: 1 }))}</div>` : ''}</div>
      <div class="card"><h2>المعايير</h2><table class="t"><thead><tr><th>المعيار</th><th>السابقة</th><th>الحالية</th><th>الفرق</th></tr></thead><tbody>
        ${c.stds.map((r) => `<tr><td>${esc(r.code)} ${esc(r.name)}</td><td>${pct(r.prev)}</td><td>${pct(r.now)}</td><td>${dcell(r.diff)}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h2>المؤشرات</h2><div class="tw"><table class="t"><thead><tr><th>الرمز</th><th>المؤشر</th><th>السابقة</th><th>الحالية</th><th>الفرق</th></tr></thead><tbody>
        ${c.rows.map((r) => {
          const pi = p.previous.indicators.findIndex((x) => x.code === r.code);
          return `<tr><td>${esc(r.code)}</td><td>${esc(r.text)}</td><td>${p.previous._manual && pi >= 0 ? `<input type="number" class="num" step="0.1" data-p="previous.indicators.${pi}.score" data-t="num" data-r value="${r.prev == null ? '' : r.prev}">` : pct(r.prev)}</td><td>${pct(r.now)}</td><td>${dcell(r.diff)}</td></tr>`;
        }).join('')}</tbody></table></div></div>` : ''}`;
  }

  // ———— المدرسة والفريق ————
  function viewSchool(p) {
    const s = 'school';
    const f = (k, label, o) => field(label, inp(`${s}.${k}`, p.school[k], o));
    return `<div class="card"><h2>بطاقة البيانات الأساسية للمدرسة</h2>
      <div class="grid3">${f('name', 'اسم المدرسة')}${f('ministryCode', 'الرقم الوزاري')}${f('year', 'العام الدراسي (هـ)', { ph: '1447' })}
        ${f('region', 'إدارة التعليم (المنطقة/المحافظة)')}${f('office', 'مكتب التعليم')}${field('المرحلة', `<select data-p="school.stage">${['', 'رياض الأطفال', 'الابتدائية', 'المتوسطة', 'الثانوية', 'مجمع'].map((v) => `<option ${p.school.stage === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${field('النوع', `<select data-p="school.gender">${['بنين', 'بنات'].map((v) => `<option ${p.school.gender === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${f('students', 'عدد الطلاب', { type: 'number' })}${f('teachers', 'عدد المعلمين', { type: 'number' })}${f('classes', 'عدد الفصول', { type: 'number' })}
        ${f('principal', 'قائد المدرسة')}${f('deputy', 'الوكيل')}${f('supervisor', 'المشرف التربوي')}${f('phone', 'الهاتف')}${f('email', 'البريد الإلكتروني')}${f('address', 'العنوان')}</div>
      <div class="row" style="margin-top:14px"><b class="small">شعار يظهر في رأس الصفحات (اختياري):</b>${p.school.logo ? `<img class="logo-prev" src="${p.school.logo}" alt="الشعار">` : ''}
        <label class="btn sm">اختيار صورة<input type="file" accept="image/png,image/jpeg" data-act="logo" hidden></label>${p.school.logo ? '<button class="btn sm danger" data-act="logoClear">إزالة</button>' : ''}</div></div>
    <div class="card"><h2>قرار تشكيل فريق التقويم الذاتي</h2>
      <div class="grid3">${field('رقم القرار', inp('decision.number', p.decision.number))}${field('تاريخ القرار (هـ)', inp('decision.date', p.decision.date, { ph: '1447/03/01' }))}${field('ملاحظة إضافية', inp('decision.notes', p.decision.notes))}</div>
      <h3>أعضاء الفريق</h3><div class="tw"><table class="t"><thead><tr><th>الاسم</th><th>العمل الحالي</th><th>المهمة في الفريق</th><th></th></tr></thead><tbody>
      ${p.team.map((t, k) => `<tr><td>${inp(`team.${k}.name`, t.name)}</td><td>${inp(`team.${k}.role`, t.role)}</td><td>${inp(`team.${k}.task`, t.task)}</td><td><button class="btn sm danger" data-act="delTeam" data-k="${k}">✕</button></td></tr>`).join('')}
      </tbody></table></div><button class="btn sm" data-act="addTeam" style="margin-top:8px">＋ عضو</button></div>
    <div class="card"><h2>المتابعة والاعتماد</h2><div class="grid4">${field('مُعدّ الخطة', inp('approval.preparedBy', p.approval.preparedBy))}${field('قائد المدرسة', inp('approval.principal', p.approval.principal, { ph: p.school.principal }))}
      ${field('المشرف التربوي', inp('approval.supervisor', p.approval.supervisor, { ph: p.school.supervisor }))}${field('تاريخ الاعتماد (هـ)', inp('approval.date', p.approval.date))}</div></div>
    <div class="card"><h2>مستويات الأداء</h2><p class="small muted">الحد الأدنى لكل مستوى (٪). عدّلها إن اختلفت في دليل التقويم المعتمد لديك.</p>
      <div class="grid4">${p.settings.levels.map((l, k) => field(`<span style="color:${l.color}">${l.name}</span>`, inp(`settings.levels.${k}.min`, l.min, { type: 'number', t: 'num', r: 1 }))).join('')}</div></div>`;
  }

  // ———— النموذج الإشرافي ————
  function viewSupervisory(p) {
    const list = M.planIndicators(p);
    if (!list.length) return emptyNeedData();
    return `<div class="card"><div class="row"><h2 style="margin:0">النموذج الإشرافي</h2><span class="spacer"></span>
      <button class="btn primary" data-act="supPdf">⬇ تصدير PDF (A4 أفقي)</button><button class="btn" data-act="supDocx">⬇ تصدير Word</button><button class="btn" data-act="supPreview">معاينة</button></div>
      <p class="small muted">خطة التحسين وفق النموذج الإشرافي باستمارتيها: <b>الاستمارة (1)</b> خطة التحسين (المجال، المعيار، المؤشر، الوضع الراهن، المستهدف، المبادرة، البرامج، المسؤول، الزمن، مؤشر القياس، الأدلة)، و<b>الاستمارة (2)</b> متابعة التنفيذ (الحالة، الإنجاز، تحقق الهدف، الصعوبات، الإجراء التصحيحي، ملاحظات المشرف).</p></div>
      <div class="card"><h3>معاينة الاستمارة (1)</h3><div class="tw"><table class="t"><thead><tr><th>م</th><th>المؤشر</th><th>الوضع الراهن</th><th>المستهدف</th><th>المبادرة</th><th>البرامج</th><th>المسؤول</th></tr></thead><tbody>
      ${list.map((i, n) => `<tr><td>${n + 1}</td><td><b>${esc(i.code)}</b> ${esc(i.text)}</td><td>${pct(i.score)}</td><td>${pct(i.target)}</td><td>${esc(i.plan.initiative)}</td><td>${i.plan.programs.length}</td><td>${esc(i.plan.team.split('،')[0])}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  // ———— قراءة ملفات PDF ————
  async function readPdf(file) {
    state.busy = 'جارٍ قراءة الملف…'; render();
    try {
      const ex = await P.extractPdf(file, (n, t) => { state.busy = `جارٍ قراءة الصفحة ${n} من ${t}…`; const d = document.querySelector('#drop b'); if (d) d.textContent = state.busy; });
      const parsed = P.parseLines(ex.lines);
      return { ex, parsed };
    } finally { state.busy = ''; }
  }

  async function handlePdf(file) {
    const p = plan();
    try {
      const { ex, parsed } = await readPdf(file);
      state.lastParse = { name: file.name, numPages: ex.numPages, lines: ex.lines, parsed };
      if (parsed.indicators.length || parsed.domains.length) {
        M.applyParsed(p, parsed, file.name);
        save(true);
        toast(`تمت قراءة ${parsed.indicators.length} مؤشرًا`);
      } else toast('لم يُتعرف على مؤشرات — راجع النص المستخرج');
    } catch (e) {
      console.error(e);
      toast('تعذرت قراءة الملف: ' + (e.message || e));
    }
    render();
  }

  // ———— الأحداث ————
  function onInput(e) {
    const el = e.target;
    const path = el.dataset && el.dataset.p;
    if (!path) return;
    const p = plan();
    let v = el.type === 'checkbox' ? el.checked : el.value;
    const t = el.dataset.t;
    if (t === 'num') v = v === '' ? null : Number(v);
    else if (t === 'bool') v = !!el.checked;
    else if (t === 'notbool') v = !el.checked;
    else if (t === 'lines') v = String(v).split('\n').map((s) => s.trim()).filter(Boolean);
    else if (t === 'tri') v = v === '' ? null : v === '1';
    setPath(p, path, v);
    if (/^indicators\.\d+\.code$/.test(path) || /^(domains|standards)\.\d+\.code$/.test(path)) { /* يُرتّب عند التغيير */ }
    M.recompute(p);
    save();
    if (path === 'title') document.getElementById('topPlan').textContent = p.title;
    if (e.type === 'change' && el.hasAttribute('data-r')) {
      if (/\.code$/.test(path)) { const cmp = P.cmpCode; p.indicators.sort(cmp); p.domains.sort(cmp); p.standards.sort(cmp); }
      if (/^indicators\.\d+\.score$/.test(path)) {
        const ind = getPath(p, path.replace(/\.score$/, ''));
        if (ind) { ind.target = F.defaultTarget(ind.score, M.levelsOf(p)); ind.plan.measurements.forEach((m) => { m.target = null; }); ind.plan.measurements[0].actual = null; M.ensureIndicator(p, ind); }
      }
      if (/^indicators\.\d+\.target$/.test(path)) {
        const ind = getPath(p, path.replace(/\.target$/, ''));
        if (ind) { ind.plan.measurements.forEach((m) => { m.target = null; }); M.ensureIndicator(p, ind); }
      }
      if (/^settings\.levels/.test(path)) p.settings.levels.sort((a, b) => b.min - a.min);
      const y = window.scrollY;
      const open = [...document.querySelectorAll('details[open] .codepill')].map((x) => x.textContent);
      render();
      document.querySelectorAll('details.acc').forEach((d) => { const c = d.querySelector('.codepill'); if (c && open.includes(c.textContent)) d.open = true; });
      window.scrollTo(0, y);
    }
  }
  app.addEventListener('input', (e) => { if (e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') onInput(e); });
  app.addEventListener('change', onInput);

  app.addEventListener('dragover', (e) => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  app.addEventListener('dragleave', (e) => { const d = e.target.closest && e.target.closest('#drop'); if (d) d.classList.remove('over'); });
  app.addEventListener('drop', (e) => {
    const d = e.target.closest && e.target.closest('#drop');
    if (!d) return;
    e.preventDefault(); d.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f) handlePdf(f);
  });

  app.addEventListener('change', async (e) => {
    const el = e.target;
    const act = el.dataset && el.dataset.act;
    if (!act || el.type !== 'file' || !el.files[0]) return;
    const file = el.files[0];
    const p = plan();
    if (act === 'pdf') handlePdf(file);
    if (act === 'prevPdf') {
      try {
        const { parsed } = await readPdf(file);
        if (!parsed.indicators.length && !parsed.domains.length) { toast('لم يُتعرف على بيانات في التقرير السابق'); render(); return; }
        const label = (document.getElementById('prevLabel') || {}).value || 'الدورة السابقة';
        p.previous = M.previousFromParsed(parsed, label);
        save(true); toast('أُضيفت المقارنة');
      } catch (err) { toast('تعذرت قراءة الملف'); }
      render();
    }
    if (act === 'logo') {
      if (file.size > 600 * 1024) { toast('الصورة كبيرة — اختر صورة أقل من 600 كيلوبايت'); return; }
      const r = new FileReader();
      r.onload = () => { p.school.logo = r.result; save(); render(); };
      r.readAsDataURL(file);
    }
    if (act === 'importJson') {
      try {
        const data = JSON.parse(await file.text());
        const arr = Array.isArray(data) ? data : [data];
        let n = 0;
        for (const pl of arr) {
          if (!pl || !pl.id || !Array.isArray(pl.indicators)) continue;
          const ex = plans.findIndex((x) => x.id === pl.id);
          if (ex >= 0) plans[ex] = pl; else plans.push(pl);
          n++;
        }
        save(true); toast(`تم استيراد ${n} خطة`); render();
      } catch (err) { toast('ملف غير صالح'); }
    }
  });

  app.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.type === 'file' || el.tagName === 'INPUT') return;
    const act = el.dataset.act;
    const p = plan();
    const k = el.dataset.k != null ? Number(el.dataset.k) : null;
    switch (act) {
      case 'tab': go(p.id, el.dataset.tab); return;
      case 'open': go(el.dataset.id); return;
      case 'new': { const np = M.newPlan(); plans.push(np); save(true); go(np.id); return; }
      case 'demo': { const np = M.demoPlan(); plans.push(np); save(true); go(np.id, 'dashboard'); return; }
      case 'dup': { const src = plans.find((x) => x.id === el.dataset.id); const cp = JSON.parse(JSON.stringify(src)); cp.id = M.uid(); cp.title += ' (نسخة)'; cp.updatedAt = new Date().toISOString(); plans.push(cp); save(true); render(); return; }
      case 'del': { const src = plans.find((x) => x.id === el.dataset.id); if (confirm(`حذف «${src.title}» نهائيًا؟`)) { plans = plans.filter((x) => x.id !== src.id); save(true); render(); } return; }
      case 'exportAll': W.download(new Blob([JSON.stringify(plans, null, 1)], { type: 'application/json' }), `tahseen-backup-${new Date().toISOString().slice(0, 10)}.json`); return;
      case 'parsePaste': {
        const txt = document.getElementById('pasteText').value;
        const parsed = P.parseLines(txt.split('\n'));
        state.lastParse = { name: 'النص الملصق', numPages: 1, lines: txt.split('\n').map((t) => ({ text: t })), parsed };
        if (parsed.indicators.length) { M.applyParsed(p, parsed, 'نص ملصق'); save(true); toast(`تمت قراءة ${parsed.indicators.length} مؤشرًا`); } else toast('لم يُتعرف على مؤشرات في النص');
        break;
      }
      case 'addInd': {
        const code = document.getElementById('newCode').value.trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        if (!/^\d+\.\d+\.\d+$/.test(code)) { toast('أدخل رمز المؤشر بالصيغة 1.2.3'); return; }
        if (p.indicators.some((i) => i.code === code)) { toast('الرمز موجود مسبقًا'); return; }
        M.addIndicator(p, code, document.getElementById('newText').value.trim(), document.getElementById('newScore').value);
        const sc = code.split('.').slice(0, 2).join('.');
        if (!p.standards.some((s) => s.code === sc)) { p.standards.push({ code: sc, name: 'معيار ' + sc, score: null }); p.standards.sort(P.cmpCode); }
        save(); break;
      }
      case 'delInd': if (confirm('حذف المؤشر؟')) { p.indicators.splice(k, 1); M.recompute(p); save(); } break;
      case 'pickVal': e.preventDefault(); p.indicators[k].score = Number(el.dataset.v); p.indicators[k].target = null; M.ensureIndicator(p, p.indicators[k]); M.recompute(p); save(); break;
      case 'swapCodes': p.indicators.forEach((i) => { if (i.oldCode) { const t = i.code; i.code = i.oldCode; i.oldCode = t; } }); p.indicators.sort(P.cmpCode); M.recompute(p); save(); toast('تم التبديل'); break;
      case 'addRow': { const arr = p[el.dataset.kind]; arr.push({ code: '', name: '', score: null }); save(); break; }
      case 'delRow': p[el.dataset.kind].splice(k, 1); M.recompute(p); save(); break;
      case 'regen': {
        const ind = p.indicators[k];
        const keep = ind.plan.measurements;
        ind.plan = M.makeIndicatorPlan(ind, p);
        ind.plan.measurements = keep;
        save(); toast('تم توليد برامج مقترحة');
        break;
      }
      case 'addProg': p.indicators[k].plan.programs.push({ id: M.uid(), name: '', method: '', owner: '', start: p.period.start, end: p.period.end, status: 'not', completion: 0, achieved: null, note: '' }); save(); break;
      case 'delProg': p.indicators[k].plan.programs.splice(Number(el.dataset.n), 1); save(); break;
      case 'applyPeriod': M.planIndicators(p).forEach((i) => i.plan.programs.forEach((g) => { g.start = p.period.start; g.end = p.period.end; })); save(); toast('طُبّقت التواريخ على كل البرامج'); break;
      case 'addTeam': p.team.push({ name: '', role: '', task: 'عضوًا' }); save(); break;
      case 'delTeam': p.team.splice(k, 1); save(); break;
      case 'logoClear': p.school.logo = ''; save(); break;
      case 'prevManual': {
        const label = (document.getElementById('prevLabel') || {}).value || 'الدورة السابقة';
        p.previous = { _manual: true, label, overall: null, domains: p.domains.map((d) => ({ code: d.code, score: null })), standards: [], indicators: p.indicators.map((i) => ({ code: i.code, score: null })) };
        save(); break;
      }
      case 'prevClear': p.previous = null; save(); break;
      case 'exportPdf': X.printHtml(X.buildPlanHtml(p)); toast('اختر «حفظ بتنسيق PDF» من نافذة الطباعة', 4000); return;
      case 'previewPdf': if (!X.previewHtml(X.buildPlanHtml(p))) toast('اسمح بالنوافذ المنبثقة للمعاينة'); return;
      case 'supPdf': X.printHtml(X.buildSupervisoryHtml(p)); toast('اختر «حفظ بتنسيق PDF» والاتجاه أفقي', 4000); return;
      case 'supPreview': if (!X.previewHtml(X.buildSupervisoryHtml(p))) toast('اسمح بالنوافذ المنبثقة للمعاينة'); return;
      case 'exportDocx':
      case 'supDocx': {
        el.disabled = true;
        try {
          const blob = act === 'exportDocx' ? await W.exportPlan(p) : await W.exportSupervisory(p);
          const name = (p.school.name || 'خطة') .replace(/[\\/:*?"<>|]/g, '');
          W.download(blob, act === 'exportDocx' ? `خطة التحسين - ${name}.docx` : `النموذج الإشرافي - ${name}.docx`);
          toast('تم إنشاء ملف Word');
        } catch (err) { console.error(err); toast('تعذر إنشاء ملف Word: ' + err.message); }
        el.disabled = false;
        return;
      }
      default: return;
    }
    render();
  });
  document.querySelector('.topbar').addEventListener('click', (e) => { if (e.target.closest('[data-act="home"]')) { e.preventDefault(); go(null); } });
  app.addEventListener('click', (e) => { if (e.target.closest('[data-act="home"]')) go(null); });

  window.addEventListener('hashchange', route);
  route();
})();

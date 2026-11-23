(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  var EST_TXT = { done: 'administrada', missed: 'no administrada', pending: 'pendiente', future: 'aún no', none: 'sin registro' };

    function pad(n) { return ('0' + n).slice(-2); }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDia(d) { return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }); }
  function todayIdx() { return (new Date().getDay() + 6) % 7; }
  function monthsBetween(iso) {
    var b = new Date(iso + 'T00:00:00'), n = new Date();
    var m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
    if (n.getDate() < b.getDate()) m -= 1;
    return m;
  }
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }
  function showErr(id, msg) { var e = $(id); if (msg) e.textContent = msg; e.hidden = false; }
  function hideErr(id) { $(id).hidden = true; }

    function newChild(name, months, peso, sample, seed) {
    var c = { name: name, months: months, peso: peso, hist: {}, moles: [] };
    if (sample) {
      for (var i = 1; i <= 60; i++) {
        var miss = (i * 5 + seed) % 9 === 0;
        c.hist[key(addDays(today, -i))] = miss
          ? { s: 'missed', by: 'Madre/Padre', t: '08:05', motivo: 'Se olvidó' }
          : { s: 'done', by: i % 4 === 0 ? 'Abuela' : 'Madre/Padre', t: '08:0' + (i % 10), tipo: 'completa' };
      }
    }
    return c;
  }
  var children = [newChild('Mateo', 14, 9.8, true, 2)];
  var active = 0;
  var indic = { sup: 'Sulfato ferroso (gotas)', dosis: 'Según tu receta', frec: 'Según tu receta', dur: '3 meses', notas: 'Sin instrucciones adicionales', act: 'Ejemplo inicial' };
  var events = [];
  var reminder = { time: '08:00', status: '' };
  var inv = null;
  var shareCode = null;
  var linked = false;
  var viewMonth = { y: today.getFullYear(), m: today.getMonth() };
  var recSaved = {}, recDone = {};
  var umbral = 3;

  function cur() { return children[active]; }
  function statusOn(c, d) {
    var r = c.hist[key(d)];
    if (r) return r.s;
    if (d.getTime() > today.getTime()) return 'future';
    return d.getTime() === today.getTime() ? 'pending' : 'none';
  }
  function todayRec() { return cur().hist[key(today)]; }
  function isDone() { var r = todayRec(); return !!r && r.s === 'done'; }

    var navToggle = $('navToggle'), nav = $('navPrincipal');
  navToggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { nav.classList.remove('open'); navToggle.setAttribute('aria-expanded', 'false'); }
  });

    function setupTabs(list, onSelect) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var p = $(t.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
      if (focus) tab.focus();
      if (onSelect) onSelect(tab);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') n = (i + 1) % tabs.length;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
        else if (k === 'Home') n = 0;
        else if (k === 'End') n = tabs.length - 1;
        if (n >= 0) { e.preventDefault(); select(tabs[n], true); }
      });
    });
    return { select: select };
  }
  var roleTabs = setupTabs($('rolePicker'), function () { renderAll(); });
  var subTabs = setupTabs(document.querySelector('[data-sub="padres"]'));

  function goTo(role, sub, targetId) {
    roleTabs.select($('tab-' + role), false);
    if (role === 'padres' && sub) subTabs.select($('st-' + sub), false);
    var el = $(targetId) || $('demo');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!el.hasAttribute('tabindex') && !/^(INPUT|SELECT|BUTTON|TEXTAREA|A)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
    setTimeout(function () { el.focus({ preventScroll: true }); }, 400);
  }

    function renderToday() {
    var c = cur(), r = todayRec(), txt, cls = 'today-state';
    if (r && r.s === 'done') { txt = 'Administrada (' + (r.tipo || 'completa') + ') · ' + r.by + ' · ' + r.t; cls += ' done'; }
    else if (r && r.s === 'missed') { txt = 'No administrada · ' + r.motivo; cls += ' missed'; }
    else txt = 'Pendiente';
    ['hoyEstado', 'cEstado'].forEach(function (id) { $(id).textContent = txt; $(id).className = cls; });
    $('hoyNino').textContent = c.name;
    $('hoyEdad').textContent = c.months + ' meses';
    $('cNino').textContent = c.name;
    $('avisoNino').textContent = c.name;
    $('btnRegistrar').disabled = !!r && r.s === 'done';
    $('cRegistrar').disabled = !!r && r.s === 'done';
    $('cAviso').textContent = r && r.s === 'done'
      ? 'Hoy ya se registró la dosis. Esto evita duplicarla entre cuidadores.'
      : 'Aún no se registra la dosis de hoy.';
  }

  function renderWeek() {
    var c = cur(), mon = addDays(today, -todayIdx()), html = '';
    for (var i = 0; i < 7; i++) {
      var s = statusOn(c, addDays(mon, i));
      var sym = s === 'done' ? '✓' : s === 'missed' ? '✕' : s === 'pending' ? '•' : '';
      html += '<li class="' + s + '"><span class="dia" role="img" aria-label="' + DIAS_LARGO[i] + ': ' + EST_TXT[s] + '">' + sym + '</span><span aria-hidden="true">' + DIAS[i] + '</span></li>';
    }
    $('semana').innerHTML = html;
  }

  function statsRange(c, n) {
    var done = 0, missed = 0;
    for (var i = 0; i < n; i++) {
      var s = statusOn(c, addDays(today, -i));
      if (s === 'done') done++; else if (s === 'missed') missed++;
    }
    return { done: done, missed: missed, total: done + missed };
  }
  function renderKpi() {
    var st = statsRange(cur(), 30);
    $('kpiPct').textContent = st.total ? Math.round(st.done / st.total * 100) + ' %' : '—';
    $('kpiDet').textContent = st.total
      ? st.done + ' de ' + st.total + ' días con dosis administrada (últimos 30 días).'
      : 'Aún no hay días registrados.';
  }

  function renderCal() {
    var c = cur(), y = viewMonth.y, m = viewMonth.m;
    var first = new Date(y, m, 1), dim = new Date(y, m + 1, 0).getDate();
    $('calTitulo').textContent = first.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    var html = DIAS.map(function (d, i) { return '<span class="cal-h" title="' + DIAS_LARGO[i] + '">' + d + '</span>'; }).join('');
    var lead = (first.getDay() + 6) % 7;
    for (var b = 0; b < lead; b++) html += '<span></span>';
    for (var d = 1; d <= dim; d++) {
      var dt = new Date(y, m, d), s = statusOn(c, dt);
      html += '<button type="button" class="cal-day ' + s + '" data-d="' + key(dt) + '" aria-label="' + d + ' de ' + first.toLocaleDateString('es-PE', { month: 'long' }) + ': ' + EST_TXT[s] + '">' + d + '</button>';
    }
    $('calGrid').innerHTML = html;
    $('btnMesNext').disabled = (y === today.getFullYear() && m === today.getMonth());
    $('calDetalle').hidden = true;
  }
  $('btnMesPrev').addEventListener('click', function () {
    viewMonth.m--; if (viewMonth.m < 0) { viewMonth.m = 11; viewMonth.y--; } renderCal();
  });
  $('btnMesNext').addEventListener('click', function () {
    viewMonth.m++; if (viewMonth.m > 11) { viewMonth.m = 0; viewMonth.y++; } renderCal();
  });
  $('calGrid').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-d]');
    if (!b) return;
    var d = new Date(b.getAttribute('data-d') + 'T00:00:00'), c = cur(), r = c.hist[b.getAttribute('data-d')], s = statusOn(c, d);
    var txt = fmtDia(d) + ': ' + EST_TXT[s] + '.';
    if (r && r.s === 'done') txt += ' Registrada por ' + r.by + ' a las ' + r.t + ' (' + (r.tipo || 'completa') + ').' + (r.obs ? ' Observación: ' + r.obs : '');
    if (r && r.s === 'missed') txt += ' Motivo: ' + r.motivo + '.';
    var el = $('calDetalle'); el.textContent = txt; el.hidden = false;
  });

  function eventsHtml(list, emptyTxt) {
    var rows = list.slice().sort(function (a, b) { return b.t - a.t; });
    return rows.length
      ? rows.map(function (a) { return '<li><span>' + esc(a.text) + '</span><span class="meta">' + a.time + '</span></li>'; }).join('')
      : '<li class="empty">' + emptyTxt + '</li>';
  }
  function renderEvents() {
    $('actividad').innerHTML = eventsHtml(events, 'Aún no hay actividad hoy.');
    $('avisosPadres').innerHTML = eventsHtml(events.filter(function (e) { return e.cuid; }), 'Aún no hay avisos.');
  }

  function renderRem() {
    var r = todayRec();
    if (r && r.s === 'done') $('recEstado').textContent = 'Avisos de hoy cancelados: la dosis ya se registró.';
    else $('recEstado').textContent = reminder.status || ('Recordatorio diario a las ' + reminder.time + '.');
  }

    function renderIndic() {
    $('indSup').textContent = indic.sup; $('indDosis').textContent = indic.dosis; $('indFrec').textContent = indic.frec;
    $('indDur').textContent = indic.dur; $('indNotas').textContent = indic.notas; $('indAct').textContent = indic.act;
    $('cSup').textContent = indic.sup; $('cDosis').textContent = indic.dosis; $('cFrec').textContent = indic.frec;
    $('cDur').textContent = indic.dur; $('cNotas').textContent = indic.notas;
  }
  function renderSelNino() {
    $('selNino').innerHTML = children.map(function (c, i) {
      return '<option value="' + i + '"' + (i === active ? ' selected' : '') + '>' + esc(c.name) + ' · ' + c.months + ' meses</option>';
    }).join('');
  }
  function renderTecnicas() {
    var c = cur(), young = c.months <= 11;
    $('tecEdad').textContent = 'Para ' + c.name + ' (' + c.months + ' meses).';
    var A = '<details class="acc"' + (young ? ' open' : '') + '><summary>De 6 a 11 meses</summary><p>Mézclalo en una cucharada de papilla o puré que el niño ya acepte y ofrécelo primero.</p></details>';
    var B = '<details class="acc"' + (young ? '' : ' open') + '><summary>De 12 a 35 meses</summary><p>Mézclalo en una porción pequeña de sopa o puré tibio y verifica que la termine.</p></details>';
    var P = '<details class="acc"><summary>Precauciones</summary><p>Prepara solo la porción que se va a consumir en el momento. Si rechaza o vomita, no insistas: repórtalo en esta sección y consulta al personal de salud.</p></details>';
    $('tecnicas').innerHTML = (young ? A + B : B + A) + P;
  }
  function renderMolLog() {
    var m = cur().moles;
    $('molestiasLog').innerHTML = m.length
      ? m.slice().reverse().map(function (x) { return '<li><span>' + esc(x.label) + '</span><span class="meta">' + esc(x.fecha) + ' · ' + x.hora + '</span></li>'; }).join('')
      : '<li class="empty">Aún no registraste molestias.</li>';
  }
  function renderInv() {
    var show = !!inv;
    $('codInvit').hidden = !show; $('invEstado').hidden = !show; $('invAcc').hidden = !(show && inv.state === 'Pendiente');
    if (show) {
      $('codInvit').textContent = inv.code;
      $('invEstado').textContent = inv.state;
      $('invEstado').className = 'today-state' + (inv.state === 'Aceptada' ? ' done' : inv.state === 'Cancelada' ? ' missed' : '');
    }
  }

  function renderAll() {
    renderToday(); renderWeek(); renderKpi(); renderCal(); renderEvents(); renderRem(); renderIndic();
    renderSelNino(); renderTecnicas(); renderMolLog(); renderInv(); renderPacientes(); defaultEdad(); renderRecetas();
  }

    function registerDose(by, extra) {
    var c = cur(), r = todayRec();
    if (r && r.s === 'done') { toast('La dosis de hoy ya fue registrada por ' + r.by + '.'); return false; }
    var now = new Date(), isCuid = by !== 'Madre/Padre';
    c.hist[key(today)] = { s: 'done', by: by, t: hhmm(now), tipo: (extra && extra.tipo) || 'completa', obs: (extra && extra.obs) || '' };
    var text = by + ' registró la dosis ' + ((extra && extra.tipo === 'parcial') ? 'parcial ' : '') + 'de ' + c.name + ' a las ' + hhmm(now) + '.' + ((extra && extra.obs) ? ' Observación: ' + extra.obs : '');
    events.push({ t: Date.now(), time: hhmm(now), text: text, cuid: isCuid });
    $('orientacion').hidden = true; $('avisoRec').hidden = true; $('segundoAviso').hidden = true;
    renderAll();
    toast('Dosis de ' + c.name + ' registrada por ' + by + '.');
    return true;
  }
  $('btnRegistrar').addEventListener('click', function () { registerDose('Madre/Padre'); });

    $('formCuid').addEventListener('submit', function (e) {
    e.preventDefault();
    var n = $('cNombreCuid'), name = n.value.trim();
    n.removeAttribute('aria-invalid');
    if (!name) { n.setAttribute('aria-invalid', 'true'); showErr('errCuid'); n.focus(); return; }
    hideErr('errCuid');
    var tipo = this.querySelector('input[name="dosisTipo"]:checked').value;
    if (registerDose(name, { tipo: tipo, obs: $('cObs').value.trim() })) $('cObs').value = '';
  });

    var MOTIVOS = {
    olvido: { label: 'Se olvidó', tip: 'Continúa con el esquema indicado en tu receta. Si tienes dudas sobre cuánto dar, consulta al personal de salud.' },
    rechazo: { label: 'Lo rechazó', tip: 'Prueba las técnicas de la sección Ayuda y ofrécelo con calma. Si el rechazo se repite, coméntalo en tu control.' },
    molestia: { label: 'Tuvo una molestia', tip: 'Registra la molestia en la sección Ayuda para ver la orientación y cuándo acudir al establecimiento de salud.' }
  };
  var btnNoDada = $('btnNoDada'), noDadaBox = $('noDadaBox');
  btnNoDada.addEventListener('click', function () {
    var open = noDadaBox.hidden;
    noDadaBox.hidden = !open;
    btnNoDada.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) $('motivoNoDada').focus();
  });
  $('btnGuardarNoDada').addEventListener('click', function () {
    var sel = $('motivoNoDada'), m = MOTIVOS[sel.value];
    if (!m) { sel.setAttribute('aria-invalid', 'true'); showErr('errNoDada'); sel.focus(); return; }
    sel.removeAttribute('aria-invalid'); hideErr('errNoDada');
    if (isDone()) { toast('La dosis de hoy ya está registrada como administrada.'); return; }
    cur().hist[key(today)] = { s: 'missed', by: 'Madre/Padre', t: hhmm(new Date()), motivo: m.label };
    events.push({ t: Date.now(), time: hhmm(new Date()), text: 'Dosis de ' + cur().name + ' no administrada: ' + m.label + '.', cuid: false });
    var o = $('orientacion');
    o.innerHTML = '<strong>Qué hacer ahora</strong>' + esc(m.tip) + '<span class="meta">Orientación referencial del prototipo, pendiente de validar con personal de salud. Ante dudas, consulta al personal de salud.</span>';
    o.hidden = false;
    noDadaBox.hidden = true; btnNoDada.setAttribute('aria-expanded', 'false');
    renderAll();
  });

    $('horaRec').addEventListener('change', function () {
    if (!this.value) return;
    reminder.time = this.value; reminder.status = '';
    renderRem();
    toast('Recordatorio guardado a las ' + reminder.time + '.');
  });
  $('btnProbarRec').addEventListener('click', function () {
    if (isDone()) { toast('La dosis de hoy ya está registrada: no se envían avisos.'); return; }
    $('avisoRec').hidden = false; $('avisoRegistrar').focus();
  });
  $('avisoRegistrar').addEventListener('click', function () { registerDose('Madre/Padre'); });
  $('avisoPosponer').addEventListener('click', function () {
    var min = +$('snoozeSel').value, d = new Date(Date.now() + min * 60000);
    reminder.status = 'Pospuesto hasta las ' + hhmm(d) + '.';
    $('avisoRec').hidden = true;
    renderRem();
    toast('Te avisaremos de nuevo a las ' + hhmm(d) + '.');
  });
  $('btnSegundoAviso').addEventListener('click', function () {
    var el = $('segundoAviso');
    el.textContent = 'Segundo aviso: aún no se registró la dosis de ' + cur().name + '.';
    el.hidden = false;
  });

    $('btnResumen').addEventListener('click', function () {
    var c = cur(), n = +$('periodoRes').value, st = statsRange(c, n);
    var desde = addDays(today, -(n - 1));
    var mol = c.moles.filter(function (m) { return new Date(m.iso).getTime() >= desde.getTime(); });
    $('resumenTxt').textContent =
      'Resumen para el control CRED\n' +
      'Niño: ' + c.name + ' (' + c.months + ' meses)\n' +
      'Indicación: ' + indic.sup + ' · dosis: ' + indic.dosis + ' · frecuencia: ' + indic.frec + ' · duración: ' + indic.dur + '\n' +
      'Periodo: últimos ' + n + ' días\n' +
      'Dosis administradas: ' + st.done + '\n' +
      'Dosis no administradas: ' + st.missed + '\n' +
      'Molestias reportadas: ' + mol.length + (mol.length ? ' (' + mol.map(function (m) { return m.label; }).join(', ') + ')' : '') + '\n' +
      'Datos de ejemplo de la demostración.';
    $('resumenBox').hidden = false;
    $('resumenTxt').focus();
  });
  $('btnCopiar').addEventListener('click', function () {
    var txt = $('resumenTxt').textContent;
    function fallback() {
      var r = document.createRange(); r.selectNodeContents($('resumenTxt'));
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      toast('Selecciona y copia el texto (Ctrl+C).');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Resumen copiado.'); }, fallback);
    else fallback();
  });

    $('formNino').addEventListener('submit', function (e) {
    e.preventDefault();
    var n = $('ninoNombre'), f = $('ninoNac'), p = $('ninoPeso'), msg = '', bad = null;
    [n, f, p].forEach(function (x) { x.removeAttribute('aria-invalid'); });
    $('okNino').hidden = true;
    var name = n.value.trim();
    if (name.length < 2) { msg = 'Escribe el nombre del niño.'; bad = n; }
    else if (!f.value) { msg = 'Elige la fecha de nacimiento.'; bad = f; }
    else {
      var m = monthsBetween(f.value);
      if (m < 6 || m > 35) { msg = 'Advertencia: HemoWawa acompaña a niños de 6 a 35 meses. La edad calculada es ' + (m < 0 ? 'inválida' : m + ' meses') + '.'; bad = f; }
      else if (!p.value || +p.value < 2 || +p.value > 25) { msg = 'Ingresa un peso entre 2 y 25 kg.'; bad = p; }
    }
    if (bad) { bad.setAttribute('aria-invalid', 'true'); showErr('errNino', msg); bad.focus(); return; }
    hideErr('errNino');
    var months = monthsBetween(f.value);
    children.push(newChild(name, months, +p.value, false, 0));
    active = children.length - 1;
    this.reset();
    renderAll();
    var ok = $('okNino'); ok.textContent = name + ' fue agregado (edad calculada: ' + months + ' meses). Ya es el niño activo.'; ok.hidden = false;
  });
  $('selNino').addEventListener('change', function () { active = +this.value; $('orientacion').hidden = true; renderAll(); });

    $('formIndic').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = $('inDosis'), fr = $('inFrec'), u = $('inDur'), miss = null;
    [d, fr, u].forEach(function (x) { x.removeAttribute('aria-invalid'); if (!x.value.trim() && !miss) miss = x; });
    if (miss) { miss.setAttribute('aria-invalid', 'true'); showErr('errIndic'); miss.focus(); return; }
    hideErr('errIndic');
    indic = { sup: $('inSup').value, dosis: d.value.trim(), frec: fr.value.trim(), dur: u.value.trim(), notas: $('inNotas').value.trim() || 'Sin instrucciones adicionales', act: 'Hoy ' + hhmm(new Date()) };
    this.reset();
    renderIndic();
    toast('Indicación guardada. El cuidador la verá actualizada.');
  });

    var MOLESTIAS = {
    heces: { t: 'Heces más oscuras', k: 'normal', txt: 'Es un cambio que suele relacionarse con el suplemento de hierro. Sigue el esquema indicado y coméntalo en el próximo control.' },
    estre: { t: 'Estreñimiento', k: 'normal', txt: 'Puede aparecer durante el tratamiento. Comenta con el personal de salud qué hacer y avísale si persiste.' },
    sabor: { t: 'Rechaza el sabor', k: 'normal', txt: 'Es frecuente. Revisa las técnicas de mezcla de esta misma sección y no suspendas el suplemento sin consultar.' },
    alarma: { t: 'Algo me preocupa mucho', k: 'alarma', txt: 'Acude cuanto antes a tu establecimiento de salud más cercano. No esperes al próximo control.' }
  };
  $('formMolestia').addEventListener('submit', function (e) {
    e.preventDefault();
    var sel = this.querySelector('input[name="molestia"]:checked'), out = $('molestiaOut');
    if (!sel) { showErr('errMolestia'); return; }
    hideErr('errMolestia');
    var m = MOLESTIAS[sel.value], now = new Date();
    cur().moles.push({ label: m.t, fecha: fmtDia(now), hora: hhmm(now), iso: now.toISOString() });
    out.className = 'callout' + (m.k === 'alarma' ? ' callout-danger' : '');
    out.innerHTML = '<strong>' + (m.k === 'alarma' ? 'Signo de alarma: ' : 'Guía: ') + esc(m.t) + '</strong>' + esc(m.txt) +
      '<span class="meta">Contenido de ejemplo del prototipo, pendiente de validar con personal de salud. No reemplaza la atención médica.</span>';
    out.hidden = false;
    renderMolLog();
  });

    var RECETAS = [
    { id: 1, n: 'Puré de lentejas con zapallo', edad: '6-8', ing: 'lentejas', t: '35 min', ingr: ['Lentejas', 'Zapallo', 'Aceite vegetal'], pasos: ['Cocina las lentejas hasta que estén muy blandas.', 'Cocina el zapallo al vapor.', 'Tritura todo hasta obtener un puré fino.'] },
    { id: 2, n: 'Papilla de hígado de pollo con papa', edad: '6-8', ing: 'higado', t: '30 min', ingr: ['Hígado de pollo', 'Papa', 'Zanahoria'], pasos: ['Cocina bien el hígado de pollo.', 'Sancocha la papa y la zanahoria.', 'Tritura con un poco del agua de cocción.'] },
    { id: 3, n: 'Sopa de lentejas con fideos finos', edad: '9-11', ing: 'lentejas', t: '40 min', ingr: ['Lentejas', 'Fideos cabello de ángel', 'Zanahoria'], pasos: ['Cocina las lentejas con la zanahoria picada.', 'Agrega los fideos al final.', 'Sirve tibio y en trozos pequeños.'] },
    { id: 4, n: 'Sangrecita con arroz y espinaca', edad: '9-11', ing: 'sangrecita', t: '30 min', ingr: ['Sangrecita de pollo', 'Arroz', 'Espinaca'], pasos: ['Cocina la sangrecita hasta que esté firme.', 'Desmenúzala bien.', 'Mézclala con el arroz y la espinaca cocida.'] },
    { id: 5, n: 'Guiso de hígado con arroz', edad: '12-35', ing: 'higado', t: '35 min', ingr: ['Hígado de pollo', 'Arroz', 'Cebolla', 'Tomate'], pasos: ['Saltea cebolla y tomate.', 'Agrega el hígado en trozos pequeños y cocina completamente.', 'Sirve con arroz.'] },
    { id: 6, n: 'Lentejas con arroz y huevo', edad: '12-35', ing: 'lentejas', t: '40 min', ingr: ['Lentejas', 'Arroz', 'Huevo cocido'], pasos: ['Cocina las lentejas hasta que estén blandas.', 'Sirve con arroz.', 'Agrega el huevo cocido picado.'] }
  ];
  var EDAD_TXT = { '6-8': '6 a 8 meses', '9-11': '9 a 11 meses', '12-35': '12 a 35 meses' };
  var ING_TXT = { lentejas: 'Lentejas', higado: 'Hígado de pollo', sangrecita: 'Sangrecita' };
  var ING_COL = { lentejas: '#B45309', higado: '#7F1D1D', sangrecita: '#581C1C' };
  function foto(r) {
    return '<svg class="foto" viewBox="0 0 120 72" role="img" aria-label="Ilustración referencial de ' + esc(r.n) + '">' +
      '<rect width="120" height="72" fill="#E0F2FE"/><ellipse cx="60" cy="42" rx="46" ry="22" fill="#fff" stroke="#CBD5E1" stroke-width="2"/>' +
      '<ellipse cx="60" cy="40" rx="32" ry="14" fill="' + ING_COL[r.ing] + '"/><circle cx="48" cy="38" r="5" fill="#16A34A"/><circle cx="72" cy="42" r="5" fill="#F59E0B"/></svg>';
  }
  function defaultEdad() {
    var m = cur().months;
    $('fEdad').value = m <= 8 ? '6-8' : m <= 11 ? '9-11' : '12-35';
  }
  function renderRecetas() {
    var fe = $('fEdad').value, fi = $('fIng').value;
    var list = RECETAS.filter(function (r) { return (fe === 'todas' || r.edad === fe) && (fi === 'todos' || r.ing === fi); });
    $('recCount').textContent = list.length + (list.length === 1 ? ' receta encontrada' : ' recetas encontradas');
    $('recetas').innerHTML = list.length ? list.map(function (r) {
      return '<article class="recipe">' + foto(r) + '<h4>' + esc(r.n) + '</h4>' +
        '<div class="tags"><span class="tag">' + EDAD_TXT[r.edad] + '</span><span class="tag">' + ING_TXT[r.ing] + '</span><span class="tag">' + r.t + '</span>' +
        (recSaved[r.id] ? '<span class="tag">★ Guardada</span>' : '') + (recDone[r.id] ? '<span class="tag">✓ Preparada</span>' : '') + '</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-receta="' + r.id + '" aria-expanded="false">Ver receta<span class="sr-only">: ' + esc(r.n) + '</span></button></article>';
    }).join('') : '<p class="callout" role="status">No hay recetas con esos filtros. Prueba con otra combinación.</p>';
    $('recDetalle').hidden = true;
  }
  $('fEdad').addEventListener('change', renderRecetas);
  $('fIng').addEventListener('change', renderRecetas);
  function showReceta(id) {
    var r = RECETAS.filter(function (x) { return x.id === id; })[0], d = $('recDetalle');
    d.innerHTML = foto(r) + '<h4>' + esc(r.n) + '</h4><p class="meta">' + EDAD_TXT[r.edad] + ' · ' + r.t + '</p>' +
      '<div><strong>Ingredientes</strong><ul>' + r.ingr.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>' +
      '<div><strong>Preparación</strong><ol>' + r.pasos.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol></div>' +
      '<div class="btn-row"><button type="button" class="btn btn-outline btn-sm" data-guardar="' + id + '" aria-pressed="' + (!!recSaved[id]) + '">' + (recSaved[id] ? '★ Guardada' : 'Guardar receta') + '</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-prep="' + id + '" aria-pressed="' + (!!recDone[id]) + '">' + (recDone[id] ? '✓ Preparada' : 'Marcar como preparada') + '</button></div>';
    d.hidden = false;
    return d;
  }
  $('recetas').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-receta]');
    if (!b) return;
    Array.prototype.forEach.call($('recetas').querySelectorAll('button[data-receta]'), function (x) { x.setAttribute('aria-expanded', 'false'); });
    b.setAttribute('aria-expanded', 'true');
    showReceta(+b.getAttribute('data-receta')).focus();
  });
  $('recDetalle').addEventListener('click', function (e) {
    var g = e.target.closest('button[data-guardar]'), p = e.target.closest('button[data-prep]');
    if (!g && !p) return;
    var id = +(g ? g.getAttribute('data-guardar') : p.getAttribute('data-prep'));
    if (g) recSaved[id] = !recSaved[id]; else recDone[id] = !recDone[id];
    var open = $('recetas').querySelector('button[aria-expanded="true"]');
    var openId = open ? open.getAttribute('data-receta') : null;
    renderRecetas();
    if (openId) { var nb = $('recetas').querySelector('button[data-receta="' + openId + '"]'); if (nb) nb.setAttribute('aria-expanded', 'true'); showReceta(+openId); }
    var again = $('recDetalle').querySelector(g ? 'button[data-guardar]' : 'button[data-prep]');
    if (again) again.focus();
  });

    $('btnInvitar').addEventListener('click', function () {
    inv = { code: 'CUID-' + (1000 + Math.floor(Math.random() * 9000)), state: 'Pendiente' };
    renderInv();
    toast('Código generado. Compártelo con el cuidador.');
  });
  $('btnInvAceptar').addEventListener('click', function () {
    inv.state = 'Aceptada'; renderInv();
    events.push({ t: Date.now(), time: hhmm(new Date()), text: 'El cuidador aceptó la invitación.', cuid: false });
    renderEvents();
  });
  $('btnInvCancelar').addEventListener('click', function () { inv.state = 'Cancelada'; renderInv(); toast('Invitación cancelada.'); });
  $('btnCodSalud').addEventListener('click', function () {
    shareCode = 'HEMO-' + (1000 + Math.floor(Math.random() * 9000));
    $('codSalud').textContent = shareCode; $('codSalud').hidden = false;
    $('codSaludEst').textContent = 'Código activo. Compártelo con tu centro de salud.';
  });

    $('formInc').addEventListener('submit', function (e) {
    e.preventDefault();
    var sel = this.querySelector('input[name="inc"]:checked');
    if (!sel) { showErr('errInc'); return; }
    hideErr('errInc');
    var nota = $('incNota').value.trim(), now = new Date(), who = $('cNombreCuid').value.trim() || 'Cuidador';
    events.push({ t: Date.now(), time: hhmm(now), text: 'Incidencia de ' + who + ': ' + sel.value + (nota ? ' — ' + nota : '') + '.', cuid: true });
    this.reset();
    renderEvents();
    toast('Incidencia enviada a los padres.');
  });

    var SAMPLE = [
    { n: 'Lucía P.', meses: 11, seed: 2, sin: 0, moles: [] },
    { n: 'Diego R.', meses: 20, seed: 5, sin: 4, moles: [{ label: 'Rechaza el sabor', ago: 6 }] },
    { n: 'Valeria S.', meses: 8, seed: 7, sin: 1, moles: [{ label: 'Heces más oscuras', ago: 3 }, { label: 'Estreñimiento', ago: 9 }] }
  ];
  function sampleStatus(p, i) { return i < p.sin ? 'none' : ((i * 5 + p.seed) % 4 === 0 ? 'missed' : 'done'); }
  function patientList() {
    var list = SAMPLE.map(function (p) {
      var days = []; for (var i = 0; i < 14; i++) days.push(sampleStatus(p, i));
      return { n: p.n, meses: p.meses, days: days, moles: p.moles.map(function (m) { return { label: m.label, ago: m.ago }; }) };
    });
    if (linked) {
      var c = children[0], days = [];
      for (var i = 0; i < 14; i++) { var s = statusOn(c, addDays(today, -i)); days.push(s === 'pending' ? 'none' : s); }
      list.push({ n: c.name + ' (vinculado)', meses: c.months, days: days, live: true,
        moles: c.moles.map(function (m) { return { label: m.label, ago: Math.round((today.getTime() - new Date(m.iso).setHours(0, 0, 0, 0)) / 86400000) }; }) });
    }
    list.forEach(function (p) {
      var d = 0, m = 0, sin = 0, brk = false;
      p.days.forEach(function (s) { if (s === 'done') d++; else if (s === 'missed') m++; });
      p.days.forEach(function (s) { if (!brk && s === 'none') sin++; else brk = true; });
      p.adh = (d + m) ? Math.round(d / (d + m) * 100) : 0; p.sin = sin;
    });
    return list;
  }
  var lastList = [];
  function renderPacientes() {
    var all = patientList(); lastList = all;
    var q = $('busca').value.trim().toLowerCase(), f = $('estado').value, o = $('orden').value;
    var rows = all.map(function (p, idx) { return { p: p, idx: idx }; }).filter(function (x) {
      var risk = x.p.sin >= umbral;
      return (!q || x.p.n.toLowerCase().indexOf(q) >= 0) && (f === 'todos' || (f === 'riesgo' ? risk : !risk));
    });
    rows.sort(function (a, b) {
      return o === 'adh' ? a.p.adh - b.p.adh : o === 'sin' ? b.p.sin - a.p.sin : a.p.n.localeCompare(b.p.n, 'es');
    });
    $('pacientes').innerHTML = rows.map(function (x) {
      var p = x.p, risk = p.sin >= umbral;
      return '<tr><th scope="row">' + esc(p.n) + '</th><td>' + p.meses + ' meses</td><td class="num">' + p.adh + ' %</td><td class="num">' + p.sin + (p.sin === 1 ? ' día' : ' días') + '</td>' +
        '<td><span class="badge ' + (risk ? 'badge-risk">⚠ En riesgo' : 'badge-ok">✓ Al día') + '</span></td>' +
        '<td><button type="button" class="link-btn" data-pac="' + x.idx + '">Ver detalle<span class="sr-only"> de ' + esc(p.n) + '</span></button></td></tr>';
    }).join('') || '<tr><td colspan="6">No hay pacientes con esos filtros.</td></tr>';
    $('pacCount').textContent = rows.length + ' de ' + all.length + ' pacientes';
    var riesgo = all.map(function (p, idx) { return { p: p, idx: idx }; }).filter(function (x) { return x.p.sin >= umbral; });
    $('alertas').innerHTML = riesgo.length
      ? riesgo.map(function (x) { return '<li><span>' + esc(x.p.n) + ': ' + x.p.sin + ' días sin registro</span><button type="button" class="link-btn" data-pac="' + x.idx + '">Ver detalle<span class="sr-only"> de ' + esc(x.p.n) + '</span></button></li>'; }).join('')
      : '<li class="empty">Sin alertas con el umbral actual.</li>';
    $('vincBox').hidden = !linked;
    if (linked) $('vincTxt').textContent = 'Acceso confirmado: ' + children[0].name + ' está vinculado a tu panel.';
    var det = $('pacDetalle'); if (!det.hidden && det.getAttribute('data-idx')) showDetalle(+det.getAttribute('data-idx'), false);
  }
  function showDetalle(idx, focus) {
    var p = lastList[idx], d = $('pacDetalle');
    if (!p) { d.hidden = true; return; }
    var n = +(d.getAttribute('data-n') || 14); if (n !== 7 && n !== 14) n = 14;
    var cells = '';
    for (var i = n - 1; i >= 0; i--) {
      var s = p.days[i], dt = addDays(today, -i);
      cells += '<li class="' + s + '"><span class="dia" role="img" aria-label="' + fmtDia(dt) + ': ' + EST_TXT[s] + '">' + (s === 'done' ? '✓' : s === 'missed' ? '✕' : '') + '</span><span aria-hidden="true">' + dt.getDate() + '</span></li>';
    }
    var mol = p.moles.filter(function (m) { return m.ago < n; });
    d.setAttribute('data-idx', idx); d.setAttribute('data-n', n);
    d.innerHTML = '<h4>' + esc(p.n) + ' · ' + p.meses + ' meses</h4>' +
      '<div><label for="perDet">Periodo</label><select id="perDet"><option value="7"' + (n === 7 ? ' selected' : '') + '>Últimos 7 días</option><option value="14"' + (n === 14 ? ' selected' : '') + '>Últimos 14 días</option></select></div>' +
      '<ol class="week mini" aria-label="Calendario de dosis">' + cells + '</ol>' +
      '<p class="meta legend">✓ administrada · ✕ no administrada · vacío: sin registro</p>' +
      '<p>Adherencia (14 días): <strong>' + p.adh + ' %</strong>. Días sin registro: <strong>' + p.sin + '</strong>.</p>' +
      '<div><strong>Molestias reportadas</strong><ul>' + (mol.length ? mol.map(function (m) { return '<li>' + esc(m.label) + ' (hace ' + m.ago + (m.ago === 1 ? ' día' : ' días') + ')</li>'; }).join('') : '<li>Sin molestias en el periodo.</li>') + '</ul></div>' +
      '<p class="meta">' + (p.sin >= umbral ? 'Posible abandono según el criterio del prototipo (' + umbral + ' o más días sin registro). Se sugiere contactar a la familia.' : 'Sin señales de abandono según el criterio del prototipo.') + '</p>';
    d.hidden = false;
    if (focus) d.focus();
  }
  ['pacientes', 'alertas'].forEach(function (id) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('button[data-pac]');
      if (!b) return;
      $('pacDetalle').setAttribute('data-n', 14);
      showDetalle(+b.getAttribute('data-pac'), true);
    });
  });
  $('pacDetalle').addEventListener('change', function (e) {
    if (e.target.id === 'perDet') { this.setAttribute('data-n', e.target.value); showDetalle(+this.getAttribute('data-idx'), false); $('perDet').focus(); }
  });
  $('busca').addEventListener('input', renderPacientes);
  $('estado').addEventListener('change', renderPacientes);
  $('orden').addEventListener('change', renderPacientes);
  $('umbral').addEventListener('input', function () {
    var v = parseInt(this.value, 10);
    if (v >= 1 && v <= 14) { umbral = v; renderPacientes(); }
  });
  $('formVinc').addEventListener('submit', function (e) {
    e.preventDefault();
    var i = $('vincCod'), v = i.value.trim().toUpperCase();
    i.removeAttribute('aria-invalid');
    if (v !== 'HEMO-4821' && v !== shareCode) {
      i.setAttribute('aria-invalid', 'true');
      showErr('errVinc', v ? 'Código no válido. Pídele a la familia que lo revise.' : 'Escribe el código que te compartió la familia.');
      i.focus();
      return;
    }
    if (linked) { showErr('errVinc', 'Este paciente ya está vinculado.'); return; }
    hideErr('errVinc');
    linked = true;
    this.reset();
    renderPacientes();
    toast('Acceso confirmado. El paciente aparece en el panel.');
  });
  $('btnRetirar').addEventListener('click', function () {
    linked = false; $('pacDetalle').hidden = true; $('pacDetalle').removeAttribute('data-idx');
    renderPacientes();
    toast('Acceso retirado. El paciente ya no aparece en el panel.');
  });

    var HU = [{"id": "HU-001", "name": "Registro de cuenta", "rol": "Madre/Padre", "uns": "—", "n": "—", "role": "unete", "sub": null, "target": "cNombre"}, {"id": "HU-002", "name": "Registro del perfil del niño", "rol": "Madre/Padre", "uns": "UNS 1.4", "n": "1", "role": "padres", "sub": "trat", "target": "formNino"}, {"id": "HU-004", "name": "Registro de la indicación de hierro", "rol": "Madre/Padre", "uns": "UNS 1.4, 2.2", "n": "1", "role": "padres", "sub": "trat", "target": "formIndic"}, {"id": "HU-005", "name": "Consulta de la indicación vigente", "rol": "Madre/Padre", "uns": "UNS 1.2, 2.2", "n": "1", "role": "padres", "sub": "trat", "target": "indSup"}, {"id": "HU-008", "name": "Configuración del recordatorio diario", "rol": "Madre/Padre", "uns": "UNS 1.1", "n": "2", "role": "padres", "sub": "hoy", "target": "horaRec"}, {"id": "HU-009", "name": "Recepción del recordatorio diario", "rol": "Madre/Padre", "uns": "UNS 1.1, 1.4", "n": "2", "role": "padres", "sub": "hoy", "target": "btnProbarRec"}, {"id": "HU-010", "name": "Posposición del recordatorio", "rol": "Madre/Padre", "uns": "UNS 1.1", "n": "2", "role": "padres", "sub": "hoy", "target": "btnProbarRec"}, {"id": "HU-011", "name": "Registro de dosis con un toque", "rol": "Madre/Padre", "uns": "UNS 1.4", "n": "3", "role": "padres", "sub": "hoy", "target": "btnRegistrar"}, {"id": "HU-012", "name": "Registro de dosis no administrada", "rol": "Madre/Padre", "uns": "UNS 1.3, 1.4", "n": "3", "role": "padres", "sub": "hoy", "target": "btnNoDada"}, {"id": "HU-013", "name": "Consulta del historial de dosis", "rol": "Madre/Padre", "uns": "UNS 1.3", "n": "3", "role": "padres", "sub": "hoy", "target": "calGrid"}, {"id": "HU-014", "name": "Seguimiento de días de cumplimiento", "rol": "Madre/Padre", "uns": "UNS 1.3", "n": "3", "role": "padres", "sub": "hoy", "target": "kpiPct"}, {"id": "HU-015", "name": "Orientación ante una dosis olvidada", "rol": "Madre/Padre", "uns": "UNS 1.2", "n": "2, 4", "role": "padres", "sub": "hoy", "target": "btnNoDada"}, {"id": "HU-016", "name": "Historial para mostrar en el control", "rol": "Madre/Padre", "uns": "UNS 1.3, 3.1", "n": "3, 10", "role": "padres", "sub": "hoy", "target": "btnResumen"}, {"id": "HU-018", "name": "Reporte de molestias", "rol": "Madre/Padre", "uns": "UNS 1.2, 3.2", "n": "4", "role": "padres", "sub": "ayuda", "target": "formMolestia"}, {"id": "HU-019", "name": "Guía de molestias normales", "rol": "Madre/Padre", "uns": "UNS 1.2, 3.2", "n": "4", "role": "padres", "sub": "ayuda", "target": "formMolestia"}, {"id": "HU-020", "name": "Alerta ante signos de alarma", "rol": "Madre/Padre", "uns": "UNS 1.2, 3.2", "n": "4", "role": "padres", "sub": "ayuda", "target": "formMolestia"}, {"id": "HU-021", "name": "Técnicas para mezclar el suplemento", "rol": "Madre/Padre", "uns": "UNS 1.2, 2.4", "n": "5", "role": "padres", "sub": "ayuda", "target": "tecnicas"}, {"id": "HU-024", "name": "Búsqueda de recetas por edad", "rol": "Madre/Padre", "uns": "UNS 1.5", "n": "6", "role": "padres", "sub": "rec", "target": "fEdad"}, {"id": "HU-025", "name": "Filtro de recetas por ingredientes", "rol": "Madre/Padre", "uns": "UNS 1.5", "n": "6", "role": "padres", "sub": "rec", "target": "fIng"}, {"id": "HU-026", "name": "Detalle de una receta", "rol": "Madre/Padre", "uns": "UNS 1.5", "n": "6", "role": "padres", "sub": "rec", "target": "recetas"}, {"id": "HU-031", "name": "Invitación a un cuidador secundario", "rol": "Madre/Padre", "uns": "UNS 2.3", "n": "7", "role": "padres", "sub": "cuid", "target": "btnInvitar"}, {"id": "HU-033", "name": "Consulta de las indicaciones del niño", "rol": "Cuidador", "uns": "UNS 2.2, 2.3", "n": "7", "role": "cuidadores", "sub": null, "target": "cSup"}, {"id": "HU-034", "name": "Registro de dosis por el cuidador", "rol": "Cuidador", "uns": "UNS 2.1, 2.3", "n": "3, 8", "role": "cuidadores", "sub": null, "target": "formCuid"}, {"id": "HU-035", "name": "Verificación de la dosis del día", "rol": "Cuidador", "uns": "UNS 2.3", "n": "8", "role": "cuidadores", "sub": null, "target": "cEstado"}, {"id": "HU-036", "name": "Notificación automática a los padres", "rol": "Cuidador", "uns": "UNS 2.1", "n": "9", "role": "cuidadores", "sub": null, "target": "avisosPadres"}, {"id": "HU-037", "name": "Reporte de incidencias a los padres", "rol": "Cuidador", "uns": "UNS 2.1", "n": "4, 9", "role": "cuidadores", "sub": null, "target": "formInc"}, {"id": "HU-041", "name": "Vinculación de pacientes", "rol": "Personal de salud", "uns": "UNS 3.1", "n": "10", "role": "salud", "sub": null, "target": "formVinc"}, {"id": "HU-042", "name": "Panel de adherencia de pacientes", "rol": "Personal de salud", "uns": "UNS 3.1", "n": "10", "role": "salud", "sub": null, "target": "pacientes"}, {"id": "HU-043", "name": "Detalle de adherencia de un paciente", "rol": "Personal de salud", "uns": "UNS 3.1", "n": "10", "role": "salud", "sub": null, "target": "pacientes"}, {"id": "HU-044", "name": "Alerta de posible abandono", "rol": "Personal de salud", "uns": "UNS 3.1", "n": "10", "role": "salud", "sub": null, "target": "alertas"}];
  var ROL_CHIP = { 'Madre/Padre': 'chip-padres', 'Cuidador': 'chip-cuidadores', 'Personal de salud': 'chip-salud' };
  var SUB_TXT = { hoy: 'Inicio', trat: 'Dosis', ayuda: 'Ayuda', rec: 'Recetas', cuid: 'Perfil' };
  $('trazaBody').innerHTML = HU.map(function (h, i) {
    var donde = h.role === 'unete' ? 'Crear cuenta' : h.role === 'padres' ? 'Madre/Padre › ' + SUB_TXT[h.sub] : h.role === 'cuidadores' ? 'Cuidador' : 'Personal de salud';
    return '<tr><td>' + h.id + '</td><td>' + h.name + '</td><td><span class="chip ' + ROL_CHIP[h.rol] + '">' + h.rol + '</span></td><td>' + h.uns + '</td><td>' + h.n + '</td>' +
      '<td><button type="button" class="link-btn" data-hu="' + i + '">' + donde + '<span class="sr-only">, probar ' + h.id + '</span></button></td></tr>';
  }).join('');
  $('trazaCount').textContent = HU.length + ' historias de usuario core implementadas. Numeración, UNS y N° (oportunidad de mejora) según el Registro de historias de usuario del informe TB1.';
  $('trazaBody').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-hu]');
    if (!b) return;
    var h = HU[+b.getAttribute('data-hu')];
    if (h.role === 'unete') { $('unete').scrollIntoView({ behavior: 'smooth' }); $('cNombre').focus({ preventScroll: true }); return; }
    goTo(h.role, h.sub, h.target);
  });

    $('formCuenta').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = { n: $('cNombre'), c: $('cCorreo'), t: $('cCel'), p: $('cPass') };
    Object.keys(f).forEach(function (k) { f[k].removeAttribute('aria-invalid'); });
    var msg = '', bad = null;
    if (f.n.value.trim().split(/\s+/).length < 2) { msg = 'Escribe tu nombre completo (nombre y apellido).'; bad = f.n; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.c.value.trim())) { msg = 'Ingresa un correo válido, por ejemplo nombre@correo.com.'; bad = f.c; }
    else if (!/^9\d{8}$/.test(f.t.value.replace(/\s+/g, ''))) { msg = 'Ingresa un celular de 9 dígitos que empiece con 9.'; bad = f.t; }
    else if (f.p.value.length < 8) { msg = 'La contraseña debe tener al menos 8 caracteres.'; bad = f.p; }
    $('okCuenta').hidden = true;
    if (bad) { bad.setAttribute('aria-invalid', 'true'); showErr('errCuenta', msg); bad.focus(); return; }
    hideErr('errCuenta');
    $('okCuenta').textContent = '¡Listo, ' + f.n.value.trim().split(/\s+/)[0] + '! Tu cuenta de demostración fue creada. Ahora registra a tu niño en la demo.';
    $('okCuenta').hidden = false;
    this.reset();
  });

    renderAll();
})();

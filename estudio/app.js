/* Mi Aula — herramienta de estudio estática.
   Cursos: archivos JSON en cursos/ (listados en cursos/index.json) o importados desde el navegador.
   Avance, notas y cursos importados se guardan en localStorage. */
(() => {
'use strict';

const LS_PROG = 'aula.progreso', LS_CURSOS = 'aula.cursos', LS_ACT = 'aula.actividad', LS_TEMA = 'aula.tema';
const APROBAR = 0.7; // % mínimo para aprobar un cuestionario
const $app = document.getElementById('app');

// ---------- almacenamiento seguro ----------
const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let progreso = load(LS_PROG, {});
let actividad = load(LS_ACT, {});
const cursos = new Map(); // id -> curso normalizado
const origen = new Map(); // id -> 'sitio' | 'importado'

// ---------- utilidades ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hoy = () => new Date().toISOString().slice(0, 10);
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'curso';
const md = txt => {
  if (!txt) return '';
  if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(txt));
  return '<p>' + esc(txt).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
};
const toast = msg => {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
};
const fmtFecha = iso => iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ---------- cursos ----------
function normalizar(c) {
  if (!c || !Array.isArray(c.modulos)) throw new Error('El curso debe tener "titulo" y "modulos".');
  const id = c.id ? slug(c.id) : slug(c.titulo || 'curso');
  const modulos = c.modulos.map((m, i) => ({
    titulo: m.titulo || `Módulo ${i + 1}`,
    lecciones: (m.lecciones || []).map((l, j) => ({ ...l, id: l.id ? slug(l.id) : `m${i + 1}-l${j + 1}`, titulo: l.titulo || `Lección ${j + 1}` }))
  }));
  return { ...c, id, titulo: c.titulo || id, modulos, lecciones: modulos.flatMap(m => m.lecciones) };
}
function agregarCurso(raw, fuente) {
  const c = normalizar(raw);
  cursos.set(c.id, c); origen.set(c.id, fuente);
  return c;
}
async function cargarCursos() {
  try {
    const r = await fetch('cursos/index.json', { cache: 'no-cache' });
    if (r.ok) {
      const lista = await r.json();
      await Promise.all(lista.map(async f => {
        try { const rc = await fetch('cursos/' + f, { cache: 'no-cache' }); if (rc.ok) agregarCurso(await rc.json(), 'sitio'); }
        catch (e) { console.warn('No se pudo cargar', f, e); }
      }));
    }
  } catch (e) { console.warn('Sin cursos/index.json (¿abierto como archivo local?)', e); }
  for (const raw of load(LS_CURSOS, [])) { try { agregarCurso(raw, 'importado'); } catch {} }
}
function guardarImportados() {
  save(LS_CURSOS, [...cursos.values()].filter(c => origen.get(c.id) === 'importado').map(({ lecciones, ...c }) => c));
}

// ---------- progreso ----------
const pc = id => (progreso[id] ??= { lecciones: {} });
const pl = (cid, lid) => (pc(cid).lecciones[lid] ??= {});
const guardarProg = () => save(LS_PROG, progreso);
function registrarActividad() { actividad[hoy()] = (actividad[hoy()] || 0) + 1; save(LS_ACT, actividad); }
function resumen(c) {
  const total = c.lecciones.length;
  const hechas = c.lecciones.filter(l => progreso[c.id]?.lecciones[l.id]?.hecho).length;
  return { total, hechas, pct: total ? Math.round(hechas / total * 100) : 0 };
}
function marcar(c, l, valor = true) {
  const p = pl(c.id, l.id);
  if (!!p.hecho === valor) return;
  p.hecho = valor; p.fecha = valor ? new Date().toISOString() : undefined;
  guardarProg(); if (valor) registrarActividad();
}
function racha() {
  let n = 0; const d = new Date();
  if (!actividad[hoy()]) d.setDate(d.getDate() - 1); // la racha sigue viva si estudiaste ayer
  while (actividad[d.toISOString().slice(0, 10)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- vistas ----------
function vistaInicio() {
  const lista = [...cursos.values()];
  const tarjetas = lista.map(c => {
    const r = resumen(c); const ult = progreso[c.id]?.ultima;
    const destino = ult && c.lecciones.some(l => l.id === ult) ? ult : (c.lecciones.find(l => !progreso[c.id]?.lecciones[l.id]?.hecho) || c.lecciones[0])?.id;
    return `<div class="card">
      <a class="cover" href="#/curso/${c.id}">
        ${c.categoria ? `<span class="tag">${esc(c.categoria)}</span>` : ''}
        <h3>${esc(c.titulo)}</h3>
        <p class="muted" style="margin:4px 0 0">${esc(c.descripcion || '')}</p>
      </a>
      <div class="spacer"></div>
      <div class="row"><small class="muted">${r.hechas}/${r.total} lecciones</small><span class="spacer"></span><b>${r.pct}%</b></div>
      <div class="bar ${r.pct === 100 ? 'ok' : ''}"><span style="width:${r.pct}%"></span></div>
      <div class="row" style="margin-top:6px">
        ${destino ? `<a class="btn primary small" href="#/curso/${c.id}/${destino}">${r.hechas ? 'Continuar' : 'Empezar'}</a>` : ''}
        <a class="btn small" href="#/curso/${c.id}">Temario</a>
        ${origen.get(c.id) === 'importado' ? `<span class="spacer"></span><button class="icon" data-quitar="${c.id}" title="Quitar curso">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('');
  $app.innerHTML = `
    <div class="row">
      <div><h1>Mis cursos</h1><p class="muted" style="margin:0">Aprende a tu ritmo. Tu avance se guarda en este navegador.</p></div>
      <span class="spacer"></span>
      <button class="btn primary" id="btnImportar">+ Cargar curso (.json)</button>
    </div>
    ${lista.length ? `<div class="grid">${tarjetas}</div>` :
      `<div class="empty"><h2>Aún no hay cursos</h2><p class="muted">Carga un archivo .json con el formato descrito en <code>estudio/README.md</code>.</p></div>`}`;
  document.getElementById('btnImportar').onclick = () => document.getElementById('fileCurso').click();
  $app.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => {
    const c = cursos.get(b.dataset.quitar);
    if (!confirm(`¿Quitar "${c.titulo}"? Tu avance se conserva por si lo vuelves a cargar.`)) return;
    cursos.delete(c.id); origen.delete(c.id); guardarImportados(); render();
  });
}

function vistaTemario(c) {
  const r = resumen(c);
  $app.innerHTML = `
    <p><a href="#/">← Mis cursos</a></p>
    ${c.categoria ? `<span class="tag">${esc(c.categoria)}</span>` : ''}
    <h1>${esc(c.titulo)}</h1>
    ${c.autor ? `<p class="muted" style="margin:0">Por ${esc(c.autor)}</p>` : ''}
    <div class="content">${md(c.descripcion)}</div>
    <div class="stats">
      <div class="stat"><b>${r.pct}%</b><small>completado</small></div>
      <div class="stat"><b>${r.hechas}/${r.total}</b><small>lecciones</small></div>
      <div class="stat"><b>${c.modulos.length}</b><small>módulos</small></div>
    </div>
    <div class="bar ${r.pct === 100 ? 'ok' : ''}"><span style="width:${r.pct}%"></span></div>
    ${c.modulos.map((m, i) => {
      const h = m.lecciones.filter(l => progreso[c.id]?.lecciones[l.id]?.hecho).length;
      return `<div class="card" style="margin-top:16px">
        <div class="row"><h3>${i + 1}. ${esc(m.titulo)}</h3><span class="spacer"></span><small class="muted">${h}/${m.lecciones.length}</small></div>
        ${m.lecciones.map(l => itemLeccion(c, l)).join('')}
      </div>`;
    }).join('')}
    <div class="row" style="margin-top:20px">
      <button class="btn" id="btnReiniciar">Reiniciar avance de este curso</button>
    </div>`;
  document.getElementById('btnReiniciar').onclick = () => {
    if (!confirm('¿Borrar el avance, notas y resultados de este curso?')) return;
    delete progreso[c.id]; guardarProg(); render();
  };
}

const ICONO = { video: '▶', quiz: '?', tarjetas: '⧉', texto: '' };
function tipo(l) { return l.tipo || (l.preguntas ? 'quiz' : l.tarjetas ? 'tarjetas' : l.video ? 'video' : 'texto'); }
function itemLeccion(c, l, actual) {
  const p = progreso[c.id]?.lecciones[l.id] || {};
  const t = tipo(l);
  return `<a href="#/curso/${c.id}/${l.id}" class="${actual === l.id ? 'on' : ''}">
    <span class="chk ${p.hecho ? 'done' : ''}">${p.hecho ? '✓' : ''}</span>
    <span>${esc(l.titulo)} ${ICONO[t] ? `<small class="muted">${ICONO[t]}</small>` : ''}
    ${l.duracion ? `<small class="muted"> · ${esc(l.duracion)}</small>` : ''}</span></a>`;
}

function embedVideo(url) {
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)))
    return `<iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe>`;
  if ((m = url.match(/vimeo\.com\/(\d+)/)))
    return `<iframe src="https://player.vimeo.com/video/${m[1]}" allowfullscreen></iframe>`;
  return `<video src="${esc(url)}" controls></video>`;
}

function htmlSide(c, l) {
  const r = resumen(c);
  return `<div class="row"><b>${r.pct}%</b><span class="spacer"></span><small class="muted">${r.hechas}/${r.total}</small></div>
    <div class="bar ${r.pct === 100 ? 'ok' : ''}" style="margin:6px 0 4px"><span style="width:${r.pct}%"></span></div>
    ${c.modulos.map(m => `<h4>${esc(m.titulo)}</h4>${m.lecciones.map(x => itemLeccion(c, x, l.id)).join('')}`).join('')}`;
}

function vistaLeccion(c, l) {
  const idx = c.lecciones.indexOf(l);
  const prev = c.lecciones[idx - 1], next = c.lecciones[idx + 1];
  const p = pl(c.id, l.id);
  pc(c.id).ultima = l.id; pc(c.id).ultimaFecha = new Date().toISOString(); guardarProg();
  const r = resumen(c);
  const mod = c.modulos.find(m => m.lecciones.includes(l));

  $app.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <a href="#/curso/${c.id}">← ${esc(c.titulo)}</a><span class="spacer"></span>
      <button class="btn small menu-toggle" id="btnMenu">☰ Temario</button>
    </div>
    <div class="course">
      <aside class="side" id="side">${htmlSide(c, l)}</aside>
      <article class="lesson">
        <small class="muted">${esc(mod?.titulo || '')} · Lección ${idx + 1} de ${c.lecciones.length}</small>
        <h1>${esc(l.titulo)}</h1>
        ${l.video ? `<div class="video">${embedVideo(l.video)}</div>` : ''}
        <div class="content">${md(l.contenido)}</div>
        ${l.tarjetas ? htmlTarjetas(l) : ''}
        ${l.preguntas ? htmlQuiz(l, p) : ''}
        ${l.recursos?.length ? `<h3>Recursos</h3><ul>${l.recursos.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titulo || x.url)}</a></li>`).join('')}</ul>` : ''}
        <details class="notes" ${p.nota ? 'open' : ''}>
          <summary>📝 Mis notas</summary>
          <textarea id="nota" placeholder="Escribe tus apuntes de esta lección…">${esc(p.nota || '')}</textarea>
          <small class="muted" id="notaEstado"></small>
        </details>
        <div class="nav-lesson">
          ${prev ? `<a class="btn" href="#/curso/${c.id}/${prev.id}">← Anterior</a>` : ''}
          <span class="spacer"></span>
          ${l.preguntas ? '' : `<button class="btn ${p.hecho ? '' : 'ok'}" id="btnHecho">${p.hecho ? 'Marcar como pendiente' : '✓ Marcar como completada'}</button>`}
          ${next ? `<a class="btn primary" href="#/curso/${c.id}/${next.id}" id="btnNext">Siguiente →</a>` : `<a class="btn primary" href="#/curso/${c.id}">Ver temario</a>`}
        </div>
      </article>
    </div>`;

  document.getElementById('btnMenu').onclick = () => document.getElementById('side').classList.toggle('open');
  const bh = document.getElementById('btnHecho');
  if (bh) bh.onclick = () => {
    const nuevo = !p.hecho; marcar(c, l, nuevo);
    if (nuevo && next) location.hash = `#/curso/${c.id}/${next.id}`; else render();
  };
  let t; const ta = document.getElementById('nota');
  ta.oninput = () => { clearTimeout(t); t = setTimeout(() => { p.nota = ta.value; guardarProg(); document.getElementById('notaEstado').textContent = 'Guardado'; }, 400); };
  if (l.preguntas) enlazarQuiz(c, l, p);
  if (l.tarjetas) enlazarTarjetas(l);
  window.scrollTo(0, 0);
}

// ---------- cuestionario ----------
function htmlQuiz(l, p) {
  return `<form id="quiz">
    ${p.quiz ? `<div class="result ${p.quiz.aprobado ? 'ok' : 'bad'}">Último intento: ${p.quiz.aciertos}/${p.quiz.total} · ${p.quiz.aprobado ? 'Aprobado' : `Necesitas ${Math.round(APROBAR * 100)}% para aprobar`}</div>` : ''}
    ${l.preguntas.map((q, i) => `<div class="q" data-i="${i}">
      <p>${i + 1}. ${esc(q.pregunta)}</p>
      ${q.opciones.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}" required><span>${esc(o)}</span></label>`).join('')}
      <div class="expl" hidden></div>
    </div>`).join('')}
    <div class="row"><button class="btn primary" type="submit">Comprobar respuestas</button>
    <button class="btn" type="reset" id="quizReset" hidden>Intentar de nuevo</button></div>
    <div id="quizRes" style="margin-top:12px"></div>
  </form>`;
}
function enlazarQuiz(c, l, p) {
  const f = document.getElementById('quiz');
  f.onsubmit = e => {
    e.preventDefault();
    let ok = 0;
    l.preguntas.forEach((q, i) => {
      const box = f.querySelector(`.q[data-i="${i}"]`);
      const sel = +f.querySelector(`input[name=q${i}]:checked`).value;
      box.querySelectorAll('.opt').forEach((o, j) => { o.classList.toggle('correct', j === q.correcta); o.classList.toggle('wrong', j === sel && sel !== q.correcta); });
      box.querySelectorAll('input').forEach(x => x.disabled = true);
      if (sel === q.correcta) ok++;
      if (q.explicacion) { const ex = box.querySelector('.expl'); ex.hidden = false; ex.textContent = q.explicacion; }
    });
    const total = l.preguntas.length, aprobado = ok / total >= APROBAR;
    p.quiz = { aciertos: ok, total, aprobado, fecha: new Date().toISOString(), intentos: (p.quiz?.intentos || 0) + 1 };
    p.mejor = Math.max(p.mejor || 0, ok);
    guardarProg();
    if (aprobado) { marcar(c, l, true); document.getElementById('side').innerHTML = htmlSide(c, l); } else registrarActividad();
    document.getElementById('quizRes').innerHTML = `<div class="result ${aprobado ? 'ok' : 'bad'}">${ok}/${total} correctas · ${aprobado ? '¡Aprobado! Lección completada.' : `Te faltó poco: necesitas ${Math.ceil(APROBAR * total)} aciertos.`}</div>`;
    f.querySelector('[type=submit]').hidden = true;
    document.getElementById('quizReset').hidden = false;
  };
  f.onreset = () => setTimeout(() => {
    f.querySelectorAll('input').forEach(x => x.disabled = false);
    f.querySelectorAll('.opt').forEach(o => o.classList.remove('correct', 'wrong'));
    f.querySelectorAll('.expl').forEach(x => x.hidden = true);
    f.querySelector('[type=submit]').hidden = false;
    document.getElementById('quizReset').hidden = true;
    document.getElementById('quizRes').innerHTML = '';
  });
}

// ---------- tarjetas de repaso ----------
function htmlTarjetas(l) {
  return `<h3>Tarjetas de repaso</h3>
    <div class="flash" id="flash"><div class="inner"><div class="face front"></div><div class="face back"></div></div></div>
    <div class="row"><button class="btn small" id="fPrev">←</button><small class="muted" id="fNum"></small>
    <button class="btn small" id="fNext">→</button><span class="spacer"></span><small class="muted">Toca la tarjeta para voltearla</small></div>`;
}
function enlazarTarjetas(l) {
  let i = 0; const el = document.getElementById('flash');
  const pintar = () => {
    const t = l.tarjetas[i]; el.classList.remove('flip');
    el.querySelector('.front').textContent = t.frente; el.querySelector('.back').textContent = t.reverso;
    document.getElementById('fNum').textContent = `${i + 1} / ${l.tarjetas.length}`;
  };
  el.onclick = () => el.classList.toggle('flip');
  document.getElementById('fPrev').onclick = () => { i = (i - 1 + l.tarjetas.length) % l.tarjetas.length; pintar(); };
  document.getElementById('fNext').onclick = () => { i = (i + 1) % l.tarjetas.length; pintar(); };
  pintar();
}

// ---------- progreso global ----------
function vistaProgreso() {
  const lista = [...cursos.values()];
  let total = 0, hechas = 0, quizzes = 0, aprob = 0;
  lista.forEach(c => { const r = resumen(c); total += r.total; hechas += r.hechas;
    c.lecciones.forEach(l => { const q = progreso[c.id]?.lecciones[l.id]?.quiz; if (q) { quizzes++; if (q.aprobado) aprob++; } }); });
  // últimas 12 semanas
  const dias = []; const d = new Date(); d.setDate(d.getDate() - 83);
  for (let k = 0; k < 84; k++) { dias.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  const max = Math.max(1, ...dias.map(x => actividad[x] || 0));
  const celdas = dias.map(x => { const v = actividad[x] || 0; const a = v ? 0.25 + 0.75 * v / max : 0;
    return `<span title="${x}: ${v} actividad(es)" style="width:14px;height:14px;border-radius:3px;background:${v ? `color-mix(in srgb, var(--ok) ${Math.round(a * 100)}%, transparent)` : 'var(--line)'}"></span>`; }).join('');

  $app.innerHTML = `
    <h1>Mi progreso</h1>
    <div class="stats">
      <div class="stat"><b>${total ? Math.round(hechas / total * 100) : 0}%</b><small>avance total</small></div>
      <div class="stat"><b>${hechas}</b><small>lecciones completadas</small></div>
      <div class="stat"><b>${aprob}/${quizzes}</b><small>cuestionarios aprobados</small></div>
      <div class="stat"><b>${racha()} 🔥</b><small>días seguidos estudiando</small></div>
    </div>
    <div class="card"><h3>Actividad (últimas 12 semanas)</h3>
      <div style="display:grid;grid-template-rows:repeat(7,14px);grid-auto-columns:14px;grid-auto-flow:column;gap:3px;overflow-x:auto;justify-content:start">${celdas}</div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Por curso</h3>
      ${lista.map(c => { const r = resumen(c); return `<div style="margin:10px 0">
        <div class="row"><a href="#/curso/${c.id}">${esc(c.titulo)}</a><span class="spacer"></span><small class="muted">Última vez: ${fmtFecha(progreso[c.id]?.ultimaFecha)}</small><b>${r.pct}%</b></div>
        <div class="bar ${r.pct === 100 ? 'ok' : ''}"><span style="width:${r.pct}%"></span></div></div>`; }).join('') || '<p class="muted">Sin cursos.</p>'}
    </div>
    <div class="card" style="margin-top:16px"><h3>Copia de seguridad</h3>
      <p class="muted" style="margin:0">Tu avance vive en este navegador. Descárgalo para pasarlo a otro dispositivo.</p>
      <div class="row"><button class="btn" id="btnExport">⬇ Descargar avance</button><button class="btn" id="btnImport">⬆ Restaurar avance</button></div>
    </div>`;
  document.getElementById('btnExport').onclick = () => {
    const data = { version: 1, fecha: new Date().toISOString(), progreso, actividad, cursos: load(LS_CURSOS, []) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `mi-aula-${hoy()}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  document.getElementById('btnImport').onclick = () => document.getElementById('fileBackup').click();
}

// ---------- importación ----------
document.getElementById('fileCurso').onchange = async e => {
  for (const f of e.target.files) {
    try { const c = agregarCurso(JSON.parse(await f.text()), 'importado'); guardarImportados(); toast(`Curso "${c.titulo}" cargado`); }
    catch (err) { alert(`No se pudo cargar ${f.name}: ${err.message}`); }
  }
  e.target.value = ''; render();
};
document.getElementById('fileBackup').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d.progreso) throw new Error('Archivo de respaldo no válido');
    if (!confirm('Esto reemplazará tu avance actual. ¿Continuar?')) return;
    progreso = d.progreso; actividad = d.actividad || {}; guardarProg(); save(LS_ACT, actividad);
    (d.cursos || []).forEach(c => { try { agregarCurso(c, 'importado'); } catch {} }); guardarImportados();
    toast('Avance restaurado'); render();
  } catch (err) { alert(err.message); }
  e.target.value = '';
};

// ---------- tema ----------
const tema = load(LS_TEMA, null); if (tema) document.documentElement.dataset.theme = tema;
document.getElementById('btnTema').onclick = () => {
  const actual = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const n = actual === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; save(LS_TEMA, n);
};

// ---------- router ----------
function render() {
  const [, ruta, cid, lid] = location.hash.split('/');
  if (ruta === 'curso') {
    const c = cursos.get(cid);
    if (!c) { $app.innerHTML = '<p>Curso no encontrado. <a href="#/">Volver</a></p>'; return; }
    const l = lid && c.lecciones.find(x => x.id === lid);
    return l ? vistaLeccion(c, l) : vistaTemario(c);
  }
  if (ruta === 'progreso') return vistaProgreso();
  vistaInicio();
}
addEventListener('hashchange', render);
cargarCursos().then(render);
})();

const CALENDAR_2026 = [
  // ── JANEIRO ──
  { date:"2026-01-01", name:"Ano Novo",                     icon:"fa-champagne-glasses", type:"national" },
  { date:"2026-01-06", name:"Dia de Reis",                  icon:"fa-star",              type:"commemorative" },
  { date:"2026-01-25", name:"Aniversário de São Paulo",     icon:"fa-city",              type:"state" },
  // ── FEVEREIRO ──
  { date:"2026-02-14", name:"Dia dos Namorados (BR-Jun)",   icon:"fa-heart",             type:"commemorative" },
  { date:"2026-02-16", name:"Carnaval",                     icon:"fa-masks-theater",     type:"optional" },
  { date:"2026-02-17", name:"Carnaval",                     icon:"fa-masks-theater",     type:"optional" },
  { date:"2026-02-18", name:"Quarta-Feira de Cinzas",       icon:"fa-cross",             type:"optional" },
  // ── MARÇO ──
  { date:"2026-03-08", name:"Dia Internacional da Mulher",  icon:"fa-venus",             type:"commemorative" },
  { date:"2026-03-20", name:"Início do Outono",             icon:"fa-leaf",              type:"seasonal" },
  { date:"2026-03-22", name:"Dia Mundial da Água",          icon:"fa-droplet",           type:"commemorative" },
  // ── ABRIL ──
  { date:"2026-04-02", name:"Quinta-Feira Santa",           icon:"fa-church",            type:"optional" },
  { date:"2026-04-03", name:"Sexta-Feira da Paixão",        icon:"fa-cross",             type:"national" },
  { date:"2026-04-05", name:"Páscoa",                       icon:"fa-egg",               type:"commemorative" },
  { date:"2026-04-21", name:"Tiradentes",                   icon:"fa-landmark",          type:"national" },
  { date:"2026-04-22", name:"Descobrimento do Brasil",      icon:"fa-ship",              type:"commemorative" },
  // ── MAIO ──
  { date:"2026-05-01", name:"Dia do Trabalhador",           icon:"fa-hammer",            type:"national" },
  { date:"2026-05-10", name:"Dia das Mães",                 icon:"fa-heart",             type:"commemorative" },
  { date:"2026-05-15", name:"Dia do Assistente Social",     icon:"fa-hands-helping",     type:"commemorative" },
  // ── JUNHO ──
  { date:"2026-06-04", name:"Corpus Christi",               icon:"fa-place-of-worship",  type:"optional" },
  { date:"2026-06-12", name:"Dia dos Namorados",            icon:"fa-heart",             type:"commemorative" },
  { date:"2026-06-13", name:"Festa Junina — Santo Antônio", icon:"fa-hat-cowboy",        type:"commemorative" },
  { date:"2026-06-21", name:"Início do Inverno",            icon:"fa-snowflake",         type:"seasonal" },
  { date:"2026-06-24", name:"Festa Junina — São João",      icon:"fa-fire",              type:"commemorative" },
  { date:"2026-06-29", name:"Festa Junina — São Pedro",     icon:"fa-star",              type:"commemorative" },
  // ── JULHO ──
  { date:"2026-07-09", name:"Revolução Constitucionalista", icon:"fa-flag",              type:"state" },
  { date:"2026-07-25", name:"Dia de São Tiago",             icon:"fa-church",            type:"commemorative" },
  // ── AGOSTO ──
  { date:"2026-08-09", name:"Dia dos Pais",                 icon:"fa-person",            type:"commemorative" },
  { date:"2026-08-11", name:"Dia do Estudante",             icon:"fa-graduation-cap",    type:"commemorative" },
  { date:"2026-08-15", name:"Assunção de Nossa Senhora",    icon:"fa-church",            type:"commemorative" },
  // ── SETEMBRO ──
  { date:"2026-09-07", name:"Independência do Brasil",      icon:"fa-flag",              type:"national" },
  { date:"2026-09-08", name:"Dia da Amazônia",              icon:"fa-tree",              type:"commemorative" },
  { date:"2026-09-22", name:"Início da Primavera",          icon:"fa-seedling",          type:"seasonal" },
  // ── OUTUBRO ──
  { date:"2026-10-04", name:"Dia de São Francisco",         icon:"fa-dove",              type:"commemorative" },
  { date:"2026-10-12", name:"Nossa Senhora Aparecida",      icon:"fa-church",            type:"national" },
  { date:"2026-10-15", name:"Dia do Professor",             icon:"fa-chalkboard-user",   type:"commemorative" },
  { date:"2026-10-28", name:"Dia do Servidor Público",      icon:"fa-id-badge",          type:"optional" },
  { date:"2026-10-31", name:"Halloween / Dia das Bruxas",   icon:"fa-ghost",             type:"commemorative" },
  // ── NOVEMBRO ──
  { date:"2026-11-02", name:"Finados",                      icon:"fa-cross",             type:"national" },
  { date:"2026-11-15", name:"Proclamação da República",     icon:"fa-landmark",          type:"national" },
  { date:"2026-11-20", name:"Consciência Negra",            icon:"fa-hand-fist",         type:"national" },
  // ── DEZEMBRO ──
  { date:"2026-12-08", name:"Nossa Senhora da Conceição",   icon:"fa-star",              type:"commemorative" },
  { date:"2026-12-21", name:"Início do Verão",              icon:"fa-sun",               type:"seasonal" },
  { date:"2026-12-24", name:"Véspera de Natal",             icon:"fa-sleigh",            type:"optional" },
  { date:"2026-12-25", name:"Natal",                        icon:"fa-tree",              type:"national" },
  { date:"2026-12-31", name:"Véspera do Ano Novo",          icon:"fa-champagne-glasses", type:"optional" },
];

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const TYPE_META = {
  national:      { label:"Feriado Nacional",   color:"#EF476F", bg:"rgba(239,71,111,0.12)"  },
  optional:      { label:"Ponto Facultativo",  color:"#FFD166", bg:"rgba(255,209,102,0.12)" },
  state:         { label:"Feriado Estadual",   color:"#5B8DEF", bg:"rgba(91,141,239,0.12)"  },
  seasonal:      { label:"Data Sazonal",       color:"#4ECDC4", bg:"rgba(78,205,196,0.12)"  },
  commemorative: { label:"Data Comemorativa",  color:"#7C6FCD", bg:"rgba(124,111,205,0.12)" },
};

// ── Sheet de detalhe do dia ──────────────────────────────────
// Adicionamos um sheet reutilizável para mostrar tarefas do dia.
// O HTML do sheet está abaixo (seção 3).

function _getTasksForDate(dateISO) {
  return state.tasks.filter(t => t.dueDate === dateISO && t.status !== 'done');
}

function _getDoneTasksForDate(dateISO) {
  return state.tasks.filter(t => t.dueDate === dateISO && t.status === 'done');
}

// Abre o sheet de detalhe de uma data comemorativa
function openCalDayDetail(dateISO, evName, evIcon, evType) {
  const meta     = TYPE_META[evType] || TYPE_META.commemorative;
  const pending  = _getTasksForDate(dateISO);
  const done     = _getDoneTasksForDate(dateISO);
  const allTasks = [...pending, ...done];

  const [y, m, d]  = dateISO.split('-');
  const dateLabel  = new Date(+y, +m - 1, +d)
    .toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });

  // Cabeçalho
  document.getElementById('cal-day-icon').className  = `fa-solid ${evIcon}`;
  document.getElementById('cal-day-icon').style.color = meta.color;
  document.getElementById('cal-day-icon-wrap').style.background = meta.bg;
  document.getElementById('cal-day-title').textContent   = evName;
  document.getElementById('cal-day-date').textContent    = dateLabel;
  document.getElementById('cal-day-type').textContent    = meta.label;
  document.getElementById('cal-day-type').style.color    = meta.color;

  // Lista de tarefas
  const listEl = document.getElementById('cal-day-task-list');
  if (allTasks.length === 0) {
    listEl.innerHTML = `
      <div class="cal-day-empty">
        <i class="fa-regular fa-calendar-xmark"></i>
        <p>Nenhuma tarefa para este dia.</p>
      </div>`;
  } else {
    listEl.innerHTML = allTasks.map(t => {
      const cat  = state.categories.find(c => c.id === t.catId);
      const imp  = { Obrigatório:'imp-mandatory', Necessário:'imp-necessary', Padrão:'imp-standard', Ideia:'imp-idea' }[t.importance] || 'imp-standard';
      const done = t.status === 'done';
      return `
        <div class="cal-day-task-row ${done ? 'cal-day-task-done' : ''}"
             onclick="openEditTask('${t.id}'); closeSheet('cal-day-sheet');">
          <div class="cal-day-task-dot ${imp}"></div>
          <div class="cal-day-task-body">
            <span class="cal-day-task-title">${escHtml(t.title)}</span>
            ${cat ? `<span class="cal-day-task-cat" style="color:${cat.color}">${escHtml(cat.name)}</span>` : ''}
          </div>
          ${done ? '<i class="fa-solid fa-circle-check" style="color:var(--accent-teal);font-size:14px;flex-shrink:0;"></i>' : ''}
        </div>`;
    }).join('');
  }

  // Botão "Nova tarefa neste dia"
  document.getElementById('cal-day-add-btn').onclick = () => {
    closeSheet('cal-day-sheet');
    openAddTask(dateISO);
  };

  openSheet('cal-day-sheet');
}

// ── Hold para criar tarefa ───────────────────────────────────
// Tempo mínimo de pressão para abrir o sheet de nova tarefa (ms)
const CAL_HOLD_MS = 500;
let _calHoldTimer = null;
let _calHoldRow   = null;

function _attachCalRowEvents(rowEl, dateISO, evName, evIcon, evType) {
  // Toque/clique simples → detalhe
  rowEl.addEventListener('click', (e) => {
    if (_calHoldFired) { _calHoldFired = false; return; }
    openCalDayDetail(dateISO, evName, evIcon, evType);
  });

  // Hold → nova tarefa
  rowEl.addEventListener('pointerdown', (e) => {
    _calHoldFired = false;
    _calHoldTimer = setTimeout(() => {
      _calHoldFired = true;
      vib([30, 60, 30]);
      // Feedback visual
      rowEl.classList.add('cal-event-holding');
      setTimeout(() => rowEl.classList.remove('cal-event-holding'), 600);
      openAddTask(dateISO);
    }, CAL_HOLD_MS);
  });

  const cancelHold = () => {
    clearTimeout(_calHoldTimer);
    _calHoldTimer = null;
  };
  rowEl.addEventListener('pointerup',     cancelHold);
  rowEl.addEventListener('pointercancel', cancelHold);
  rowEl.addEventListener('pointermove',   cancelHold);
}

let _calHoldFired = false;

// ── Render principal ─────────────────────────────────────────
function renderSeasonalCalendar() {
  const container = document.getElementById('screen-seasonal');
  if (!container) return;

  const contentEl = container.querySelector('#seasonal-content');
  if (!contentEl) return;

  // Agrupa por mês
  const byMonth = {};
  CALENDAR_2026.forEach(ev => {
    const d   = new Date(ev.date + 'T00:00:00');
    const key = d.getMonth();
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push({ ...ev, _d: d });
  });

  const todayStr = todayISO();

  // Legenda
  let html = `<div class="cal-legend">`;
  Object.entries(TYPE_META).forEach(([, v]) => {
    html += `<span class="cal-legend-pill" style="background:${v.bg};color:${v.color}">${v.label}</span>`;
  });
  html += `</div>`;

  // Constrói os blocos de mês como strings, depois injeta e atribui eventos
  const monthBlocks = [];

  for (let m = 0; m < 12; m++) {
    const events = byMonth[m];
    if (!events) continue;

    const hasToday    = events.some(e => e.date === todayStr);
    const monthHtml   = `
      <div class="cal-month-block${hasToday ? ' cal-month-today' : ''}" data-month="${m}">
        <div class="cal-month-header">
          <span class="cal-month-name">${MONTH_NAMES[m]}</span>
          <span class="cal-month-count">${events.length} evento${events.length > 1 ? 's' : ''}</span>
        </div>
        <div class="cal-events" data-month-events="${m}"></div>
      </div>`;
    monthBlocks.push({ m, html: monthHtml, events, hasToday });
    html += monthHtml;
  }

  contentEl.innerHTML = html;

  // Injeta rows por evento (DOM real → para poder attachar eventos)
  monthBlocks.forEach(({ m, events }) => {
    const eventsEl = contentEl.querySelector(`[data-month-events="${m}"]`);
    if (!eventsEl) return;

    events.forEach(ev => {
      const meta    = TYPE_META[ev.type] || TYPE_META.commemorative;
      const dayNum  = ev._d.getDate().toString().padStart(2, '0');
      const weekDay = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][ev._d.getDay()];
      const isToday = ev.date === todayStr;

      // Tarefas deste dia (resumo)
      const tasksHere = _getTasksForDate(ev.date);
      const doneHere  = _getDoneTasksForDate(ev.date);
      const totalHere = tasksHere.length + doneHere.length;

      let taskSummaryHtml = '';
      if (totalHere > 0) {
        const chip = tasksHere.length > 0
          ? `<span class="cal-task-chip cal-task-chip-pending">
               <i class="fa-solid fa-circle-check"></i>${tasksHere.length} tarefa${tasksHere.length > 1 ? 's' : ''}
             </span>`
          : `<span class="cal-task-chip cal-task-chip-done">
               <i class="fa-solid fa-circle-check"></i>Tudo concluído
             </span>`;
        taskSummaryHtml = `<div class="cal-task-chips">${chip}</div>`;
      }

      const row = document.createElement('div');
      row.className = `cal-event-row${isToday ? ' cal-event-today' : ''}`;
      row.setAttribute('data-date', ev.date);
      row.innerHTML = `
        <div class="cal-event-date-col">
          <span class="cal-event-day">${dayNum}</span>
          <span class="cal-event-weekday">${weekDay}</span>
        </div>
        <div class="cal-event-icon-wrap" style="background:${meta.bg}">
          <i class="fa-solid ${ev.icon}" style="color:${meta.color}"></i>
        </div>
        <div class="cal-event-info">
          <span class="cal-event-name">${escHtml(ev.name)}</span>
          <span class="cal-event-type" style="color:${meta.color}">${meta.label}</span>
          ${taskSummaryHtml}
        </div>
        <div class="cal-row-arrow"><i class="fa-solid fa-chevron-right"></i></div>
        ${isToday ? '<div class="cal-today-badge"><i class="fa-solid fa-circle-dot"></i></div>' : ''}`;

      _attachCalRowEvents(row, ev.date, ev.name, ev.icon, ev.type);
      eventsEl.appendChild(row);
    });
  });

  requestAnimationFrame(() => {
    const scroll = container.querySelector('.screen-scroll');
    if (!scroll) return;
  
    // Pega o mês atual (0-11) e busca o bloco correspondente
    const currentMonth = new Date().getMonth();
    const target = contentEl.querySelector(`[data-month="${currentMonth}"]`);
  
    if (!target) {
      console.warn('[CAL SCROLL] Bloco do mês atual não encontrado no calendário.');
      return;
    }
  
    let offset = 0;
    let el = target;
    while (el && el !== scroll) {
      offset += el.offsetTop;
      el = el.offsetParent;
    }
  
    const centered = offset - (scroll.clientHeight / 2) + (target.offsetHeight / 2);
    scroll.scrollTo({ top: Math.max(0, centered), behavior: 'smooth' });
  });
}
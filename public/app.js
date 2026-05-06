'use strict';

//#region Constantes & Variáveis Globais
const XP_TABLE = { Obrigatório: 100, Necessário: 60, Padrão: 30, Ideia: 10 };

const LEVEL_TITLES = [
  'Procrastinador',   // 1
  'Despertando',      // 2
  'Em Movimento',     // 3
  'Focado',           // 4
  'Imparável',        // 5
  'Estrategista',     // 6
  'Alto Desempenho',  // 7
  'Dominador',        // 8
  'Lendário',         // 9
  'Imortal',          // 10
];

const CAT_COLORS = [
  '#7C6FCD', // roxo
  '#5B8DEF', // azul
  '#4ECDC4', // teal
  '#EF476F', // vermelho-rosa
  '#FFD166', // amarelo
  '#06D6A0', // verde
  '#E07A5F', // terracota
  '#A78BFA', // lavanda
  '#F97316', // laranja
  '#EC4899', // pink
  '#14B8A6', // ciano-escuro
  '#84CC16', // verde-limão
  '#F43F5E', // vermelho-vivo
  '#8B5CF6', // violeta
  '#64748B', // cinza-azulado
  '#FB7185', // salmão
  '#34D399', // esmeralda
  '#FBBF24', // âmbar
  '#60A5FA', // azul-claro
  '#C084FC', // lilás
];

const CAT_FA_ICONS = [
  { icon: 'fa-solid fa-briefcase',        label: 'Trabalho'    },
  { icon: 'fa-solid fa-house',            label: 'Casa'        },
  { icon: 'fa-solid fa-lightbulb',        label: 'Ideia'       },
  { icon: 'fa-solid fa-heart-pulse',      label: 'Saúde'       },
  { icon: 'fa-solid fa-book-open',        label: 'Estudo'      },
  { icon: 'fa-solid fa-bullseye',         label: 'Meta'        },
  { icon: 'fa-solid fa-plane',            label: 'Viagem'      },
  { icon: 'fa-solid fa-gamepad',          label: 'Lazer'       },
  { icon: 'fa-solid fa-coins',            label: 'Finanças'    },
  { icon: 'fa-solid fa-dumbbell',         label: 'Treino'      },
  { icon: 'fa-solid fa-code',             label: 'Dev'         },
  { icon: 'fa-solid fa-paintbrush',       label: 'Criativo'    },
  { icon: 'fa-solid fa-cart-shopping',    label: 'Compras'     },
  { icon: 'fa-solid fa-utensils',         label: 'Alimentação' },
  { icon: 'fa-solid fa-people-group',     label: 'Equipe'      },
  { icon: 'fa-solid fa-graduation-cap',   label: 'Faculdade'   },
  { icon: 'fa-solid fa-rocket',           label: 'Projeto'     },
  { icon: 'fa-solid fa-music',            label: 'Música'      },
  { icon: 'fa-solid fa-leaf',             label: 'Bem-estar'   },
  { icon: 'fa-solid fa-wrench',           label: 'Manutenção'  },
  { icon: 'fa-solid fa-chart-line',       label: 'Negócios'    },
  { icon: 'fa-solid fa-camera',           label: 'Foto/Vídeo'  },
  { icon: 'fa-solid fa-handshake',        label: 'Parceria'    },
  { icon: 'fa-solid fa-star',             label: 'Favorito'    },
  { icon: 'fa-solid fa-baby',             label: 'Família'     },
  { icon: 'fa-solid fa-paw',             label: 'Pet'         },
  { icon: 'fa-solid fa-car',              label: 'Automóvel'   },
  { icon: 'fa-solid fa-bible',            label: 'Espiritual'  },
  { icon: 'fa-solid fa-flask',            label: 'Pesquisa'    },
];

let state = defaultState();
let _reactivateTargetId = null;
let undoStack = null;
let undoTimer = null;
let audioCtx;
const IMP_ALIASES = { 'obrigatório':'Obrigatório', 'obrigatorio':'Obrigatório', 'necessário':'Necessário', 'necessario':'Necessário', 'padrão':'Padrão', 'padrao':'Padrão', 'ideia':'Ideia' };
let _postponeTargetId = null;
let snackbarTimeout = null;
let _editTaskId = null;
let ACHIEVEMENTS  = [];
let RARITY_STYLE  = {};
const SWIPE_THRESHOLD   = 18;  // px mínimos para considerar "arrastando"
const SWIPE_ACTION_LEFT  = 80;  // px para confirmar delete
const SWIPE_ACTION_RIGHT = 80;  // px para abrir context menu
let _newTaskType    = 'task';      // 'task' | 'mission'
let _addSubtaskTargetId = null;    // id da mission-task que está recebendo subtask
let _aiSuggestions  = [];          // cache das sugestões retornadas pela IA
let TempoParaMostrarEventosNoBanner = 15; // dias antes para mostrar eventos sazonais no banner
const HOLD_MS = 1000; // tempo segurando para concluir tarefa/subtarefa em MS
//#endregion

//#region Remind & Insistent — estado de sessão
const _insistentTimers = {};   // taskId → intervalId
let _remindVal      = 'none';  // estado do picker de lembrete antecipado
let _remindCustom   = null;
let _insistentOn    = false;
let _insistentMin   = 5;       // minutos padrão
let _insistentCustom = null;
//#endregion

//#region Inicialização dos pickers no sheet
function initRemindAndInsistentPickers() {
  // Lembrete antecipado
  document.addEventListener('click', e => {
    const btn = e.target.closest('#remind-pills .remind-pill');
    if (!btn) return;
    _remindVal = btn.dataset.val;
    document.querySelectorAll('#remind-pills .remind-pill')
      .forEach(b => b.classList.toggle('active', b === btn));
    const customWrap = document.getElementById('remind-custom-wrap');
    if (_remindVal !== 'custom') {
      customWrap?.classList.add('hidden');
      _remindCustom = null;   // ← zera ao sair do custom
    } else {
      customWrap?.classList.remove('hidden');
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'remind-custom-days')
      _remindCustom = parseInt(e.target.value) || null;
  });

  // Toggle insistente
  document.addEventListener('change', e => {
    if (e.target.id !== 'task-insistent-toggle') return;
    _insistentOn = e.target.checked;
    document.getElementById('insistent-interval-wrap')
      ?.classList.toggle('hidden', !_insistentOn);
    const label = document.getElementById('insistent-label');
    const badge = document.getElementById('insistent-badge');
    if (label) label.textContent = _insistentOn ? 'Ativado' : 'Desativado';
    badge?.classList.toggle('hidden', !_insistentOn);
  });

  // Intervalo insistente
  document.addEventListener('click', e => {
    const btn = e.target.closest('#insistent-pills .remind-pill');
    if (!btn) return;
    const val = btn.dataset.val;
    document.querySelectorAll('#insistent-pills .remind-pill')
      .forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('insistent-custom-wrap')
      ?.classList.toggle('hidden', val === 'custom' ? false : true);
    if (val !== 'custom') _insistentMin = parseInt(val);
  });

  document.addEventListener('input', e => {
    if (e.target.id !== 'insistent-custom-min') return;
    _insistentCustom = parseInt(e.target.value) || null;
    if (_insistentCustom) _insistentMin = _insistentCustom;
  });
}

//#endregion

//#region Helpers — reset/restore pickers ao abrir sheet
function resetRemindPickers() {
  _remindVal    = 'none';
  _remindCustom = null;
  _insistentOn  = false;
  _insistentMin = 5;
  _insistentCustom = null;

  document.querySelectorAll('#remind-pills .remind-pill')
    .forEach(b => b.classList.toggle('active', b.dataset.val === 'none'));
  document.getElementById('remind-custom-wrap')?.classList.add('hidden');
  document.getElementById('remind-custom-days') && (document.getElementById('remind-custom-days').value = '');

  const toggle = document.getElementById('task-insistent-toggle');
  if (toggle) toggle.checked = false;
  document.getElementById('insistent-interval-wrap')?.classList.add('hidden');
  document.getElementById('insistent-label') && (document.getElementById('insistent-label').textContent = 'Desativado');
  document.getElementById('insistent-badge')?.classList.add('hidden');
  document.querySelectorAll('#insistent-pills .remind-pill')
    .forEach(b => b.classList.toggle('active', b.dataset.val === '5'));
  document.getElementById('insistent-custom-wrap')?.classList.add('hidden');
}

function restoreRemindPickers(task) {
  resetRemindPickers();
  if (!task) return;

  // Lembrete antecipado
  if (task.remindBefore) {
    const known = ['1d','7d','30d'];
    _remindVal = known.includes(task.remindBefore) ? task.remindBefore : 'custom';
    document.querySelectorAll('#remind-pills .remind-pill')
      .forEach(b => b.classList.toggle('active', b.dataset.val === _remindVal));
    if (_remindVal === 'custom') {
      document.getElementById('remind-custom-wrap')?.classList.remove('hidden');
      document.getElementById('remind-custom-days').value = task.remindBeforeDays || '';
      _remindCustom = task.remindBeforeDays;
    }
  }

  // Modo insistente
  if (task.insistent) {
    _insistentOn  = true;
    _insistentMin = task.insistentMin || 5;
    const toggle = document.getElementById('task-insistent-toggle');
    if (toggle) toggle.checked = true;
    document.getElementById('insistent-interval-wrap')?.classList.remove('hidden');
    document.getElementById('insistent-label') && (document.getElementById('insistent-label').textContent = 'Ativado');
    document.getElementById('insistent-badge')?.classList.remove('hidden');

    const known = [5,10,15,30,60];
    const valStr = known.includes(_insistentMin) ? String(_insistentMin) : 'custom';
    document.querySelectorAll('#insistent-pills .remind-pill')
      .forEach(b => b.classList.toggle('active', b.dataset.val === valStr));
    if (valStr === 'custom') {
      document.getElementById('insistent-custom-wrap')?.classList.remove('hidden');
      document.getElementById('insistent-custom-min').value = _insistentMin;
    }
  }
}

async function pollJob(endpoint, body, existingJobId = null) {
  let jobId = existingJobId;
  const token = getToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  if (!jobId) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    jobId = data.jobId;
    console.log(`[pollJob] job criado: ${jobId}`);
  }

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const poll = await fetch(`/api/job/${jobId}`, { headers: authHeader });
    if (!poll.ok) throw new Error(`Poll HTTP ${poll.status}`);
    const job = await poll.json();
    if (job.status === 'done')  return job.result;
    if (job.status === 'error') throw new Error(job.error || 'Job falhou');
  }
  throw new Error('Timeout no job de IA');
}
//#endregion

//#region Cálculo da data de lembrete antecipado
function calcRemindDate(dueDate, remindBefore, remindBeforeDays) {
  if (!dueDate || !remindBefore || remindBefore === 'none') return null;
  const map = { '1d': 1, '7d': 7, '30d': 30 };
  const days = remindBefore === 'custom' ? (remindBeforeDays || 1) : (map[remindBefore] || 0);
  const d = new Date(dueDate + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
//#endregion

//#region Serviço de notificações (Web Notifications API)
async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendNotif(title, body, tag) {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag,                         // evita duplicatas
      icon: '/icon-192.png',       // ajuste ao seu manifest
      badge: '/icon-192.png',
      renotify: true,
    });
  } catch(e) {}
}
//#endregion

//#region Modo Insistente — agendador
function scheduleInsistent(task) {
  if (!task.insistent || task.status === 'done') return;
  clearInsistent(task.id);   // garante sem duplicata

  const ms = (task.insistentMin || 5) * 60 * 1000;
  _insistentTimers[task.id] = setInterval(async () => {
    const current = state.tasks.find(t => t.id === task.id);
    if (!current || current.status === 'done') {
      clearInsistent(task.id);
      return;
    }
    // Toast no app
    showXPToast(`${current.title}`);
    playTone(660, 0.18);
    vib([60, 30, 60]);
    // Notificação push se permitido
    await requestNotifPermission();
    sendNotif(
      'NextXP — Lembrete insistente',
      `"${current.title}" ainda está pendente. Bora!`,
      `insistent_${task.id}`
    );
  }, ms);
}

function clearInsistent(id) {
  if (_insistentTimers[id]) {
    clearInterval(_insistentTimers[id]);
    delete _insistentTimers[id];
  }
}

/** Chame no boot para reativar insistentes de tarefas já salvas */
function bootInsistentScheduler() {
  state.tasks.forEach(t => {
    if (t.insistent && t.status !== 'done') scheduleInsistent(t);
  });
}
//#endregion

//#region Estado & Persistência

function defaultState() {
  return {
    userName: 'Herói',
    userProfile: 'Projetos Pessoais',
    userRhythm: 'moderado',
    onboardingDone: false,
    tasks: [],
    categories: [
      { id: 'empresa', name: 'Empresa', icon: 'fa-solid fa-briefcase', color: '#7C6FCD' },
      { id: 'pessoal', name: 'Pessoal', icon: 'fa-solid fa-house',     color: '#5B8DEF' },
      { id: 'saude',   name: 'Saúde',   icon: 'fa-solid fa-heart',     color: '#EF476F' },
      { id: 'ideias',  name: 'Ideias',  icon: 'fa-solid fa-lightbulb', color: '#FFD166' },
    ],
    totalXP: 0, todayXP: 0, coins: 0, level: 1, streak: 0,
    lastActiveDate: null, tasksCompleted: 0, missionsCompleted: 0,
    focusSessions: 0, missions: [], missionsDate: null,
    timeline: [], dailyHistory: {}, gestureHintSeen: false,
    activeTab: 'today', planView: 'today', planCat: null,
  };
}
/* ── Token ───────────────────────────────────────────────── */
function getToken()   { return localStorage.getItem('nxp_user_token'); }
function clearToken() { localStorage.removeItem('nxp_user_token'); }

/* ── save() — debounced, persiste no backend ─────────────── */
let _saveTimer = null;
function save() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_persist, 800);
}

async function _persist() {
  const token = getToken();
  if (!token) return;
  try {
    await fetch('/api/auth/state', {
      method:  'PUT',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ state }),
    });
    // Cache local para uso offline
    localStorage.setItem('nxp_state_cache', JSON.stringify(state));
  } catch (err) {
    console.warn('[save] falha ao persistir — continuando offline.', err.message);
  }
}

/* ── load() — chamado após auto-login resolver ───────────── */
function load(remoteState) {
  if (remoteState) Object.assign(state, remoteState);
  // Garante campos novos de versões futuras
  const def = defaultState();
  for (const k of Object.keys(def)) {
    if (state[k] === undefined) state[k] = def[k];
  }
}

/* ── autoLogin() — chamado no topo do init() ─────────────── */
async function autoLogin() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/auto-login', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.status === 401) {
      clearToken();
      return null; // token expirado → tela de auth
    }

    const data = await res.json();
    return data.state ?? null;

  } catch {
    // Sem conexão → tenta cache local
    try {
      const cached = localStorage.getItem('nxp_state_cache');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  }
}

//#endregion

//#region Datas & Utilidades de Tempo
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate()+1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function nextWeekendISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : 6 - day;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return new Date(y, m-1, d).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
}

function friendlyDate() {
  return new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'short' });
}

function getPrevWeekISO() {
  const d = new Date(); d.setDate(d.getDate()-7);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDaysISO(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

//#endregion

//#region Filtros de Tarefas (Data/Status)
function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  return task.dueDate < todayISO();
}

function isToday(task) {
  if (!task.dueDate) return task.status !== 'done';
  return task.dueDate === todayISO();
}

function isTomorrow(task) {
  return task.dueDate === tomorrowISO();
}

function isThisWeek(task) {
  if (!task.dueDate) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(task.dueDate + 'T00:00:00');
  const diff = (due - today) / 86400000;
  return diff >= 0 && diff <= 6;
}
//#endregion

//#region Sistema de XP, Nível & Progresso
function xpForLevel(lvl) {
  let xp = 300;
  for (let i = 1; i < lvl; i++) xp = Math.round(xp * 1.4);
  return xp;
}

function currentLevelTitle() {
  return LEVEL_TITLES[Math.min(state.level - 1, LEVEL_TITLES.length - 1)];
}

function streakMult() {
  if (state.streak >= 30) return 1.5;
  if (state.streak >= 14) return 1.35;
  if (state.streak >= 7)  return 1.2;
  if (state.streak >= 3)  return 1.1;
  return 1.0;
}

function computeXP(importance, focusBonus = false) {
  let xp = XP_TABLE[importance] || 30;
  xp = Math.round(xp * streakMult());
  if (focusBonus) xp = Math.round(xp * 1.25);
  return xp;
}

function addXP(amount) {
  state.totalXP += amount;
  state.todayXP += amount;
  checkLevelUp();
  saveDailyHistory(); // ← garante que dailyHistory é atualizado junto
}

function checkLevelUp() {
  let leveled = false;
  while (state.totalXP >= xpForLevel(state.level)) {
    state.level++;
    leveled = true;
    addTimelineItem('fa-solid fa-trophy', `Nível ${state.level} — ${currentLevelTitle()}`);
  }
  if (leveled) triggerLevelUp();
}

function recalcLevel() {
  state.level = 1;
  while (state.totalXP >= xpForLevel(state.level)) {
    state.level++;
  }
}

function updateStreak() {
  const today = todayISO();
  if (state.lastActiveDate === today) return;
  const d = new Date(); d.setDate(d.getDate() - 1);
  const yesterday = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  state.streak = (state.lastActiveDate === yesterday) ? state.streak + 1 : 1;
  state.lastActiveDate = today;
}

//#endregion

//#region Histórico Diário & Missões

function saveDailyHistory() {
  const key = todayISO();
  if (!state.dailyHistory[key]) {
    state.dailyHistory[key] = { xp: 0, completed: 0, focusSessions: 0 };
  }
  // Sempre sobrescreve com os valores atuais do state (fonte de verdade)
  state.dailyHistory[key].xp            = state.todayXP;
  state.dailyHistory[key].completed     = state.tasks.filter(t => t.status === 'done').length;
  state.dailyHistory[key].focusSessions = state.focusSessions;
}


function generateMissions() {
  const today = todayISO();
  if (state.missionsDate === today) return;
  state.missionsDate = today;
  const pending = state.tasks.filter(t => t.status !== 'done').length;
  const cap3 = Math.min(3, Math.max(1, pending));
  const cap5 = Math.min(5, Math.max(2, pending));
  state.missions = [
    { id: 'm1', title: `Complete ${cap3} tarefas hoje`, target: cap3, progress: 0, xp: 120+cap3*10, coins: 4, done: false, bonus: false },
    { id: 'm2', title: 'Complete 1 tarefa Obrigatória', target: 1, progress: 0, xp: 120, coins: 4, done: false, bonus: false },
    { id: 'm3', title: 'Use o Modo Foco por 25 minutos', target: 1, progress: 0, xp: 100, coins: 3, done: false, bonus: false },
    { id: 'm4', title: `Bônus: Complete ${cap5} tarefas em 1 dia`, target: cap5, progress: 0, xp: 280, coins: 10, done: false, bonus: true },
  ];
  save();
}

function updateMissionProgress(type) {
  state.missions.forEach(m => {
    if (m.done) return;
    if ((type === 'task' && (m.id === 'm1' || m.id === 'm4'))
      || (type === 'mandatory' && m.id === 'm2')
      || (type === 'focus' && m.id === 'm3')) {
      m.progress = Math.min(m.progress + 1, m.target);
      if (m.progress >= m.target) {
        m.done = true;
        state.missionsCompleted++;
        addXP(m.xp);
        state.coins += m.coins;
        showXPToast(`+${m.xp} XP (Missão!)`);
        const badge = document.getElementById('menu-missions-badge');
        if (badge) badge.classList.add('hidden');
      }
    }
  });
  if (state.activeTab === 'missions') renderMissions();
  save();
}

//#endregion

//#region Tarefas Recorrentes
function processRecurringTasks() {
  const today = todayISO();
  const dow = new Date().getDay();
  state.tasks.forEach(t => {
    if (t.repeat === 'none' || !t.lastCompleted) return;
    if (t.lastCompleted === today) return;
    if (t.repeat === 'daily'
      || (t.repeat === 'weekdays' && dow >= 1 && dow <= 5)
      || (t.repeat === 'weekly' && t.lastCompleted <= getPrevWeekISO())) {
      t.status = 'todo';
      t.dueDate = today;
    }
  });
}
//#endregion

//#region Undo / Histórico de Ações
function pushUndo(snapshot, label) {
  undoStack = { snapshot, label };
  clearTimeout(undoTimer);
  showSnackbar(label, () => {
    if (undoStack) {
      const s = undoStack.snapshot;
      state.tasks          = s.tasks;
      state.totalXP        = s.totalXP;
      state.todayXP        = s.todayXP;
      state.coins          = s.coins;
      state.tasksCompleted = s.tasksCompleted;
      state.streak         = s.streak;
      state.lastActiveDate = s.lastActiveDate;
      state.level          = 1;
      recalcLevel();
      undoStack = null;
      save();
      renderAll();
    }
  });
  undoTimer = setTimeout(() => { undoStack = null; }, 5000);
}
//#endregion

//#region Áudio & Feedback (Sons/Vibração)
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playTone(freq, dur, vol = 0.18) {
  try {
    initAudio();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}

function playDing()    { playTone(880, 0.12); setTimeout(() => playTone(1320, 0.25), 100); }
function playLevelUpSfx() { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f, 0.28), i*110)); }

function vib(p) { if (navigator.vibrate) navigator.vibrate(p); }
//#endregion

//#region Parsing & Helpers
function parseQuickInput(raw) {
  let title = raw;
  let catId = null, importance = null;

  const catMatch = raw.match(/#(\S+)/i);
  if (catMatch) {
    const q = catMatch[1].toLowerCase();
    const found = state.categories.find(c => c.name.toLowerCase().startsWith(q));
    if (found) catId = found.id;
    title = title.replace(catMatch[0], '').trim();
  }

  const impMatch = raw.match(/!(\S+)/i);
  if (impMatch) {
    const q = impMatch[1].toLowerCase();
    importance = IMP_ALIASES[q] || null;
    title = title.replace(impMatch[0], '').trim();
  }

  return { title: title.trim(), catId, importance };
}

function uid() { return `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Retorna true se a tarefa está atrasada considerando data E hora
function isOverdueByTime(task) {
  if (!task.dueDate || task.status === 'done') return false;
  const today = todayISO();
  if (task.dueDate < today) return true;                    // dia passado
  if (task.dueDate > today) return false;                   // dia futuro
  // mesmo dia: só atrasa se tiver hora definida e já passou
  if (!task.taskTime) return false;
  const [h, m] = task.taskTime.split(':').map(Number);
  const due = new Date(); due.setHours(h, m, 0, 0);
  return Date.now() > due.getTime();
}

// Peso de importância (menor = maior prioridade)
function impWeight(imp) {
  return { Obrigatório: 0, Necessário: 1, Padrão: 2, Ideia: 3 }[imp] ?? 2;
}

// Ordenação: atrasadas primeiro → data+hora → importância
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aOver = isOverdueByTime(a) ? 0 : 1;
    const bOver = isOverdueByTime(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;

    // Compara data
    const dateA = a.dueDate || '9999-99-99';
    const dateB = b.dueDate || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    // Mesma data: hora (sem hora vai pro fim)
    const timeA = a.taskTime || '23:59';
    const timeB = b.taskTime || '23:59';
    if (timeA !== timeB) return timeA.localeCompare(timeB);

    // Mesmo horário: importância
    return impWeight(a.importance) - impWeight(b.importance);
  });
}
//#endregion

//#region CRUD de Tarefas
function completeTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || task.status === 'done') return;

  const snapshot = {
    tasks: state.tasks.map(t => ({...t})),
    totalXP: state.totalXP, todayXP: state.todayXP,
    coins: state.coins, tasksCompleted: state.tasksCompleted,
    streak: state.streak, lastActiveDate: state.lastActiveDate,
  };

  task.status        = 'done';
  task.lastCompleted = todayISO();
  clearInsistent(id);

  updateStreak();
  const xp    = computeXP(task.importance);
  task.xpEarned = xp;
  addXP(xp);
  state.coins += Math.floor(xp / 30);
  state.tasksCompleted++;

  updateMissionProgress('task');
  if (task.importance === 'Obrigatório') updateMissionProgress('mandatory');

  _recordDailyComplete(xp);

  playDing();
  vib([40, 20, 80]);
  showXPToast(`+${xp} XP`);
  confetti({ particleCount: 45, spread: 55, origin: { y: 0.55 },
             colors: ['#4ECDC4','#7C6FCD','#FFD166'], scalar: 0.85 });

  // ── Bridge: cancela alarme e dispensa notificação persistente ──
  NativeBridge.cancelAlarm(id);
  NativeBridge.dismissNotification(id);

  pushUndo(snapshot, 'Tarefa concluída');
  save();
  if (task.empresaId && task._empresaAtribuidaRowId) {
    _syncTarefaEmpresaConcluida(task._empresaAtribuidaRowId).catch(() => {});
  }
  renderAll(); // syncAll() é chamado dentro de renderAll
}

function deleteTask(id) {
  const snapshot = state.tasks.map(t => ({...t}));
  state.tasks = state.tasks.filter(t => t.id !== id);
  pushUndo({ tasks: state.tasks.map(t=>({...t})), totalXP: state.totalXP, todayXP: state.todayXP, coins: state.coins, tasksCompleted: state.tasksCompleted, streak: state.streak, lastActiveDate: state.lastActiveDate }, 'Tarefa removida');

  // ── Bridge: cancela alarme da tarefa deletada ──
  NativeBridge.cancelAlarm(id);
  NativeBridge.dismissNotification(id);

  save();
  renderAll();
}

async function _recordDailyComplete(xp, focusSession = false) {
  const token = getToken();
  if (!token) return;
  try {
    await fetch('/api/daily-history/complete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ xp, focusSession }),
    });
  } catch (err) {
    console.warn('[_recordDailyComplete] falha — continuando offline.', err.message);
  }
}

function openPostpone(id) {
  _postponeTargetId = id;

  // pré-preenche com data/hora atual da tarefa, se houver
  const task = state.tasks.find(t => t.id === id);
  const dateInput = document.getElementById('postpone-date-input');
  const timeInput = document.getElementById('postpone-time-input');
  const confirmBtn = document.getElementById('postpone-confirm-btn');

  dateInput.value = task?.dueDate || '';
  timeInput.value = task?.taskTime || '';
  confirmBtn.disabled = !dateInput.value;

  openSheet('postpone-sheet');
}

function applyPostpone(newDate, newTime = null) {
  if (!_postponeTargetId) return;
  const task = state.tasks.find(t => t.id === _postponeTargetId);
  if (task) {
    pushUndo(
      {
        tasks: state.tasks.map(t => ({ ...t })),
        totalXP: state.totalXP, todayXP: state.todayXP,
        coins: state.coins, tasksCompleted: state.tasksCompleted,
        streak: state.streak, lastActiveDate: state.lastActiveDate,
      },
      'Tarefa adiada'
    );
    task.status   = 'todo';
    task.dueDate  = newDate;
    task.taskTime = newTime || null;

    // Reagenda alarme nativo se tiver horário
    if (newTime) {
      const [h, m] = newTime.split(':').map(Number);
      const dt = new Date(`${newDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
      if (dt.getTime() > Date.now()) {
        NativeBridge.cancelAlarm(task.id);
        NativeBridge.scheduleAlarm(task.id, task.title, dt.getTime(), task.repeat);
      }
    } else {
      NativeBridge.cancelAlarm(task.id);
    }

    save();
    renderAll();
  }
  closeSheet('postpone-sheet');
  _postponeTargetId = null;
}

// ── Bindings
function initPostponeBindings() {
  // Chips rápidos
  document.querySelectorAll('.postpone-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const days    = parseInt(btn.dataset.days);
      const weekend = btn.dataset.weekend;
      let date = new Date();

      if (weekend) {
        // avança até o próximo sábado
        const dow = date.getDay();           // 0=dom … 6=sab
        const daysUntilSat = dow === 6 ? 7 : (6 - dow);
        date.setDate(date.getDate() + daysUntilSat);
      } else {
        date.setDate(date.getDate() + days);
      }

      const iso = date.toISOString().split('T')[0];

      // mantém o horário original da tarefa nos chips rápidos
      const task = state.tasks.find(t => t.id === _postponeTargetId);
      applyPostpone(iso, task?.taskTime || null);
    });
  });

  // Input de data habilita botão confirmar
  const dateInput  = document.getElementById('postpone-date-input');
  const confirmBtn = document.getElementById('postpone-confirm-btn');
  dateInput.addEventListener('input', () => {
    confirmBtn.disabled = !dateInput.value;
  });

  // Confirmar manual
  confirmBtn.addEventListener('click', () => {
    const date = document.getElementById('postpone-date-input').value;
    const time = document.getElementById('postpone-time-input').value || null;
    if (!date) return;
    applyPostpone(date, time);
  });
}
//#endregion

//#region Renderização - Today
function renderToday() {
  const today = todayISO();
  renderSeasonalBanner('seasonal-banner-today');

  // ── usa isOverdueByTime no lugar de isOverdue ──
  const todayTasks  = sortTasks(
    state.tasks.filter(t => (isToday(t) || isOverdueByTime(t)) && t.status !== 'done')
  );
  const futureTasks = sortTasks(
    state.tasks.filter(t => t.dueDate && t.dueDate > today && t.status !== 'done')
  );

  const done  = state.tasks.filter(t => t.status === 'done' && t.lastCompleted === todayISO()).length;
  const total = todayTasks.length + done;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const mins  = todayTasks.reduce((s, t) => s + (t.estimateMinutes || 0), 0);

  document.getElementById('h-greeting').textContent  = greeting();
  document.getElementById('h-name').textContent      = state.userName;
  document.getElementById('h-avatar').textContent    = state.userName[0].toUpperCase();
  document.getElementById('streak-count').textContent = state.streak;

  document.getElementById('hero-date').textContent    = friendlyDate();
  document.getElementById('hero-summary').textContent =
    `${todayTasks.length} tarefa${todayTasks.length !== 1 ? 's' : ''} pendente`;
  document.getElementById('hero-pct').textContent     = `${pct}%`;
  document.getElementById('hero-fill').style.width    = `${pct}%`;

  const nextTask = todayTasks[0]; // já ordenado: 1ª é a mais urgente
  document.getElementById('hero-next-task').textContent =
    nextTask ? nextTask.title : 'Nenhuma tarefa pendente';

  // ── seções: agora ordenação já veio do sortTasks ──
  const now = todayTasks.filter(t =>
    t.importance === 'Obrigatório' ||
    t.importance === 'Necessário'  ||
    isOverdueByTime(t)              // ← atrasada sempre vai pra "Agora"
  );
  
  const ideas = todayTasks.filter(t => t.importance === 'Ideia' && !isOverdueByTime(t));
  
  const later = [
    ...todayTasks.filter(t =>
      t.importance === 'Padrão' && !isOverdueByTime(t)  // ← só Padrão não-atrasada
    ),
    ...futureTasks,
  ];

  renderTaskList('list-now',   now,   'empty-now');
  renderTaskList('list-later', later, 'empty-later');
  renderTaskList('list-ideas', ideas, null, true);

  const hint = document.getElementById('gesture-hint');
  if (!state.gestureHintSeen && todayTasks.length > 0) hint?.classList.remove('hidden');
  else hint?.classList.add('hidden');
  window.initSectionCollapseBindings?.();
}


function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

function renderTaskList(listId, tasks, emptyId, isIdeas = false) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.innerHTML = '';

  if (tasks.length === 0) {
    if (isIdeas) {
      list.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:20px 16px 8px;">
          <i class="fa-regular fa-lightbulb" style="font-size:26px;color:#FFD166;margin-bottom:10px;"></i>
          <p style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 4px;">Nenhuma ideia ainda.</p>
          <p style="font-size:12px;color:var(--text-muted);line-height:1.5;max-width:240px;margin:0;">Registre pensamentos, projetos futuros ou qualquer coisa que surgir.</p>
        </div>`;
      return;
    }
    if (emptyId) document.getElementById(emptyId)?.classList.remove('hidden');
    return;
  }

  if (emptyId) document.getElementById(emptyId)?.classList.add('hidden');

  tasks.forEach((task, i) => {
    const card = task.type === 'mission'
      ? createMissionCard(task)
      : createTaskCard(task);

    list.appendChild(card);
    gsap.fromTo(card,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.28, delay: i * 0.04, ease: 'power2.out' }
    );
  });
}

function createTaskCard(task) {
  const cat = getCatSafe(task.catId);
  const impClass = { Obrigatório:'imp-mandatory', Necessário:'imp-necessary', Padrão:'imp-standard', Ideia:'imp-idea' }[task.importance] || 'imp-standard';
  const xp = computeXP(task.importance);
  const overdue = isOverdueByTime(task); // ← corrigido

  const card = document.createElement('div');
  card.className = `task-card${task.status==='done'?' completed':''}${overdue?' overdue':''}`;
  card.dataset.id  = task.id;
  card.dataset.imp = task.importance; // ← adicionado

  let metaExtra = '';
  if (task.estimateMinutes) metaExtra += `<span class="task-meta-extra"><i class="fa-regular fa-clock"></i>${task.estimateMinutes}</span>`;
  if (task.repeat && task.repeat !== 'none') metaExtra += `<span class="task-meta-extra"><i class="fa-solid fa-rotate"></i></span>`;

  if (overdue) {
    const sameDay = task.dueDate === todayISO();
    const label   = sameDay && task.taskTime
      ? `Atrasada desde ${task.taskTime}`
      : `Atrasada ${formatDate(task.dueDate)}`;
    metaExtra += `<span class="task-overdue-tag">${label}</span>`;
  } else if (task.dueDate && task.dueDate !== todayISO()) {
    metaExtra += `<span class="task-meta-extra"><i class="fa-regular fa-calendar"></i>${formatDate(task.dueDate)}</span>`;
  }

  if (task.remindDate && task.status !== 'done')
    metaExtra += `<span class="task-remind-tag"><i class="fa-solid fa-bell"></i>${formatDate(task.remindDate)}</span>`;
  if (task.insistent && task.insistentMin && task.status !== 'done')
    metaExtra += `<span class="task-insistent-tag"><i class="fa-solid fa-bell-concierge"></i>${task.insistentMin}min</span>`;
  if (task.empresaId && task.assignedBy)
    metaExtra += `<span class="task-assigned-tag"><i class="fa-solid fa-building"></i>Atribuída por ${task.assignedBy}</span>`;

  card.innerHTML = `
    <div class="task-card-inner">
      <div class="task-check-wrap">
        <div class="task-check-ring">
          <div class="hold-ring"></div>
          <i class="fa-solid fa-check" style="${task.status==='done'?'opacity:1':'opacity:0'}"></i>
        </div>
      </div>
      <div class="task-content">
        <div class="task-title">${escHtml(task.title)}</div>
        <div class="task-meta">
          <span class="task-cat-tag" style="background:${cat.color}1a;color:${cat.color}">
            <i class="${cat.icon}" style="font-size:10px;margin-right:3px;"></i>${cat.name}
          </span>
          <span class="task-imp-badge ${impClass}">${task.importance}</span>
          ${metaExtra}
        </div>
      </div>
      <span class="task-xp">${xp} XP</span>
    </div>
    <div class="task-actions">
      <button class="task-action-btn action-postpone" title="Adiar"><i class="fa-solid fa-clock-rotate-left"></i></button>
      <button class="task-action-btn action-delete" title="Excluir"><i class="fa-solid fa-trash"></i></button>
    </div>
  `;

  if (task.status !== 'done') {
    setupHold(card, task.id);
    setupSwipe(card, task.id);
  } else {
    setupHold(card, task.id);
  }

  card.querySelector('.action-postpone')?.addEventListener('click', e => { e.stopPropagation(); openPostpone(task.id); });
  card.querySelector('.action-delete')?.addEventListener('click', e => { e.stopPropagation(); deleteTask(task.id); });
  card.querySelector('.task-title')?.addEventListener('click', e => {
    e.stopPropagation();
    e.target.classList.toggle('expanded');
  });
  return card;
}

function getCatSafe(catId) {
  const cat = state.categories.find(c => c.id === catId);
  return {
    name:  cat?.name  || 'Geral',
    color: cat?.color || '#7C6FCD',
    icon:  cat?.icon  || 'fa-solid fa-circle',
  };
}

//#endregion

//#region Interações de Tarefa (Gestos)
function setupHold(card, id) {
  const ring = card.querySelector('.hold-ring');
  let holdTimer = null, raf = null, t0 = 0;
  

  function isDone() {
    return state.tasks.find(t => t.id === id)?.status === 'done';
  }

  function start(e) {
    if (e.target.closest('.task-action-btn')) return;
    if (card._isSwiping) return;
  
    t0 = Date.now();
  
    // Só começa o ring após 150ms (evita flicker em taps rápidos)
    holdTimer = setTimeout(() => {
      cancelAnimationFrame(raf);
      if (card._isSwiping) return;
      if (isDone()) openReactivate(id);
      else          completeTask(id);
    }, HOLD_MS);
  
    const ringColor = isDone() ? '#EF476F' : 'var(--accent-teal)';
  
    function anim() {
      if (card._isSwiping) { cancel(); return; }
      const elapsed = Date.now() - t0;
      if (elapsed < 150) { raf = requestAnimationFrame(anim); return; } // aguarda antes de pintar
      const pct = Math.min((elapsed - 150) / (HOLD_MS - 150), 1) * 360;
      if (ring) ring.style.background =
        `conic-gradient(${ringColor} ${pct}deg, transparent ${pct}deg)`;
      if (elapsed < HOLD_MS) raf = requestAnimationFrame(anim);
    }
    raf = requestAnimationFrame(anim);
  }

  let _lastTap = 0;

  function cancel(e) {
    const elapsed = Date.now() - t0;
    clearTimeout(holdTimer);
    cancelAnimationFrame(raf);
    if (ring) ring.style.background = '';
  
    // Ignora se veio de botões de ação
    if (e?.target?.closest('.task-action-btn')) return;
  
    if (elapsed < 200 && !card._isSwiping) {
      const now = Date.now();
      if (now - _lastTap < 300) return;
      _lastTap = now;
      const titleEl = card.querySelector('.task-title');
      titleEl?.classList.toggle('expanded');
    }
  }

  card.addEventListener('mousedown',  start);
  card.addEventListener('touchstart', start, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel']
  .forEach(ev => card.addEventListener(ev, cancel));
}

function setupSwipe(card, id) {
  const inner = card.querySelector('.task-card-inner');
  let sx = 0, sy = 0, dx = 0, active = false, dirLocked = null;

  function resetVisual() {
    inner.style.transform = '';
    inner.style.opacity   = '';
    card.style.background = '';
    card.style.removeProperty('--swipe-hint-color');
  }

  card.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    dx = 0;
    active = true;
    dirLocked = null;
    card._isSwiping = false; // sempre reseta no início
    resetVisual();           // limpa qualquer resíduo visual
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    if (!active) return;
    const curX = e.touches[0].clientX;
    const curY = e.touches[0].clientY;
    dx = curX - sx;
    const dy = curY - sy;

    if (!dirLocked && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      dirLocked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }

    if (dirLocked === 'v') {
      active = false;
      card._isSwiping = false;
      resetVisual();
      return;
    }

    if (dirLocked !== 'h') return;
    if (Math.abs(dx) > SWIPE_THRESHOLD) card._isSwiping = true;

    const clamped = Math.max(-120, Math.min(120, dx));

    if (dx < 0) {
      inner.style.transform = `translateX(${clamped}px)`;
      const ratio = Math.min(Math.abs(dx) / SWIPE_ACTION_LEFT, 1);
      inner.style.opacity = String(1 - ratio * 0.45);
      card.style.setProperty('--swipe-hint-color', `rgba(239,71,111,${ratio * 0.18})`);
    } else {
      inner.style.transform = `translateX(${clamped}px)`;
      const ratio = Math.min(dx / SWIPE_ACTION_RIGHT, 1);
      card.style.setProperty('--swipe-hint-color', `rgba(124,111,205,${ratio * 0.18})`);
    }

    card.style.background = 'var(--swipe-hint-color, transparent)';
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (!active) return;
    active = false;

    const wasSwipe = card._isSwiping;
    card._isSwiping = false;
    resetVisual();

    if (!wasSwipe) return;

    if (dx < -SWIPE_ACTION_LEFT) {
      openDeleteModal(id);
    } else if (dx > SWIPE_ACTION_RIGHT) {
      openTaskContextMenu(id, card);
    }
  });

  card.addEventListener('touchcancel', () => {
    active = false;
    card._isSwiping = false;
    resetVisual();
  });
}

function openReactivate(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  _reactivateTargetId = id;

  const nameEl = document.getElementById('reactivate-task-name');
  if (nameEl) nameEl.textContent = `"${task.title}" será marcada como pendente novamente.`;

  openSheet('reactivate-sheet');
}

function reactivateTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const snapshot = state.tasks.map(t => ({ ...t }));
  task.status = 'todo';
  task.lastCompleted = null;

  // Reverte o XP ganho se houver registro
  if (task.xpEarned) {
    state.totalXP  = Math.max(0, state.totalXP  - task.xpEarned);
    state.todayXP  = Math.max(0, state.todayXP  - task.xpEarned);
    state.coins    = Math.max(0, state.coins     - Math.floor(task.xpEarned / 30));
    state.tasksCompleted = Math.max(0, state.tasksCompleted - 1);
    checkLevelUp();        // recalcula nível após dedução
    task.xpEarned = 0;
  }

  pushUndo({ tasks: state.tasks.map(t=>({...t})), totalXP: state.totalXP, todayXP: state.todayXP, coins: state.coins, tasksCompleted: state.tasksCompleted, streak: state.streak, lastActiveDate: state.lastActiveDate }, 'Tarefa reativada');
  save();
  saveDailyHistory();
  renderAll();
}

// ── WIRE UP DOS BOTÕES (chame esta função no seu init / DOMContentLoaded) ──
function initReactivateSheet() {
  document.getElementById('reactivate-confirm-btn')?.addEventListener('click', () => {
    if (_reactivateTargetId) {
      reactivateTask(_reactivateTargetId);
      _reactivateTargetId = null;
    }
    closeSheet('reactivate-sheet');
  });

  document.getElementById('reactivate-cancel-btn')?.addEventListener('click', () => {
    _reactivateTargetId = null;
    closeSheet('reactivate-sheet');
  });
}

function captureSnapshot() {
  return {
    tasks: state.tasks.map(t => ({...t})),
    totalXP: state.totalXP,
    todayXP: state.todayXP,
    coins: state.coins,
    tasksCompleted: state.tasksCompleted,
    streak: state.streak,
    lastActiveDate: state.lastActiveDate,
  };
}

(function injectDeleteModal() {
  if (document.getElementById('delete-modal')) return;
  const el = document.createElement('div');
  el.id = 'delete-modal';
  el.className = 'bottom-sheet hidden';
  el.innerHTML = `
    <div class="sheet-backdrop" data-close="delete-modal"></div>
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <div style="text-align:center;padding:8px 0 20px;">
        <div style="width:52px;height:52px;border-radius:50%;background:#EF476F1a;
                    display:flex;align-items:center;justify-content:center;
                    margin:0 auto 14px;font-size:22px;color:#EF476F;">
          <i class="fa-solid fa-trash"></i>
        </div>
        <h3 class="sheet-title" style="margin-bottom:6px;">Excluir tarefa?</h3>
        <p id="delete-modal-name" style="font-size:13px;color:var(--text-muted);margin:0 16px;line-height:1.4;"></p>
      </div>
      <button class="btn-danger w-full" id="delete-modal-confirm"
              style="background:#EF476F;color:#fff;border:none;border-radius:14px;
                     padding:14px;font-size:15px;font-weight:800;cursor:pointer;">
        <i class="fa-solid fa-trash" style="margin-right:6px;"></i>Sim, excluir
      </button>
      <button id="delete-modal-cancel"
              style="width:100%;margin-top:10px;background:transparent;
                     border:1px solid var(--border,#333);color:var(--text-muted,#888);
                     border-radius:14px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;">
        Cancelar
      </button>
      <div style="height:8px;"></div>
    </div>
  `;
  document.body.appendChild(el);

  let _deleteTargetId = null;

  window._openDeleteModal = function(id) {
    _deleteTargetId = id;
    const task = state.tasks.find(t => t.id === id);
    const nameEl = document.getElementById('delete-modal-name');
    if (nameEl) nameEl.textContent = `"${task?.title}" será removida permanentemente.`;
    openSheet('delete-modal');
  };

  document.getElementById('delete-modal-confirm').addEventListener('click', () => {
    if (_deleteTargetId) {
      deleteTask(_deleteTargetId);
      _deleteTargetId = null;
    }
    closeSheet('delete-modal');
  });

  document.getElementById('delete-modal-cancel').addEventListener('click', () => {
    _deleteTargetId = null;
    closeSheet('delete-modal');
  });

  document.querySelector('#delete-modal .sheet-backdrop')
    .addEventListener('click', () => closeSheet('delete-modal'));
})();

function openDeleteModal(id) {
  window._openDeleteModal(id);
}

(function injectContextMenu() {
  if (document.getElementById('task-context-sheet')) return;
  const el = document.createElement('div');
  el.id = 'task-context-sheet';
  el.className = 'bottom-sheet hidden';
  el.innerHTML = `
    <div class="sheet-backdrop" data-close="task-context-sheet"></div>
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <div style="padding:4px 4px 14px;text-align:center;">
        <p id="ctx-task-name" style="font-size:15px;color:var(--text);
                                      line-height:1.4;font-weight:800;margin:0 0 6px;"></p>
        <p id="ctx-task-notes" style="font-size:12px;color:var(--text-muted);
                                       line-height:1.6;margin:0;white-space:pre-wrap;
                                       background:var(--surface2,#1e1e2a);
                                       border-radius:10px;padding:8px 12px;
                                       text-align:left;display:none;"></p>
      </div>
      <nav class="ctx-menu-nav">
        <button class="ctx-menu-btn" id="ctx-edit">
          <span class="ctx-icon" style="background:#7C6FCD1a;color:#7C6FCD;">
            <i class="fa-solid fa-pen"></i>
          </span>
          <span class="ctx-text">
            <strong>Editar tarefa</strong>
            <small>Alterar título, data, categoria...</small>
          </span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
        </button>
        <button class="ctx-menu-btn" id="ctx-postpone">
          <span class="ctx-icon" style="background:#4ECDC41a;color:#4ECDC4;">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </span>
          <span class="ctx-text">
            <strong>Adiar tarefa</strong>
            <small>Escolher nova data ou período</small>
          </span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
        </button>
        <button class="ctx-menu-btn" id="ctx-to-mission">
          <span class="ctx-icon" style="background:#FFD1661a;color:#FFD166;">
            <i class="fa-solid fa-crosshairs"></i>
          </span>
          <span class="ctx-text">
            <strong>Transformar em missão</strong>
            <small>Adiciona como missão bônus do dia</small>
          </span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
        </button>
      </nav>
      <div style="height:8px;"></div>
    </div>
  `;
  document.body.appendChild(el);

  let _ctxTargetId = null;

  window._openTaskContextMenu = function(id) {
    _ctxTargetId = id;
    const task = state.tasks.find(t => t.id === id);
    const nameEl  = document.getElementById('ctx-task-name');
    const notesEl = document.getElementById('ctx-task-notes');
    if (nameEl)  nameEl.textContent  = task?.title || '';
    if (notesEl) {
      const notes = task?.notes?.trim();
      if (notes) {
        notesEl.textContent = notes;
        notesEl.style.display = 'block';
      } else {
        notesEl.style.display = 'none';
      }
    }
    openSheet('task-context-sheet');
  };

  document.getElementById('ctx-edit').addEventListener('click', () => {
    closeSheet('task-context-sheet');
    if (_ctxTargetId) openEditTask(_ctxTargetId);
    _ctxTargetId = null;
  });

  document.getElementById('ctx-postpone').addEventListener('click', () => {
    const id = _ctxTargetId;
    _ctxTargetId = null;
    closeSheet('task-context-sheet');
    if (id) openPostpone(id);
  });

  document.getElementById('ctx-to-mission').addEventListener('click', () => {
    if (_ctxTargetId) convertToMission(_ctxTargetId);
    _ctxTargetId = null;
    closeSheet('task-context-sheet');
  });

  document.querySelector('#task-context-sheet .sheet-backdrop')
    .addEventListener('click', () => closeSheet('task-context-sheet'));
})();

function openTaskContextMenu(id) {
  window._openTaskContextMenu(id);
}

//#endregion

//#region Transformar em missão
async function convertToMission(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  if (state.tasks.some(t => t._missionSourceId === id)) {
    showXPToast('Já é uma missão!');
    return;
  }

  const cat = state.categories.find(c => c.id === task.catId);
  const taskSnapshot = {
    title:           task.title,
    notes:           task.notes || '',
    importance:      task.importance,
    category:        cat?.name || 'Geral',
    estimateMinutes: task.estimateMinutes || null,
    energy:          task.energy || 'medium',
    dueDate:         task.dueDate || null,
    catId:           task.catId,
  };

  state.tasks = state.tasks.filter(t => t.id !== id);

  const placeholderId = `mission_${Date.now()}`;
  const placeholder = {
    id:               placeholderId,
    type:             'mission',
    _missionSourceId: id,
    title:            taskSnapshot.title,
    notes:            taskSnapshot.notes,
    importance:       taskSnapshot.importance,
    catId:            taskSnapshot.catId,
    dueDate:          taskSnapshot.dueDate,
    status:           'loading',
    subtasks:         [],
    createdAt:        Date.now(),
  };

  state.tasks.unshift(placeholder);
  save();
  renderAll();

  const payload = {
    task: {
      title:           taskSnapshot.title,
      notes:           taskSnapshot.notes,
      importance:      taskSnapshot.importance,
      category:        taskSnapshot.category,
      estimateMinutes: taskSnapshot.estimateMinutes,
      energy:          taskSnapshot.energy,
      dueDate:         taskSnapshot.dueDate,
    },
    user: {
      name:      state.userName,
      profile:   state.userProfile,
      rhythm:    state.userRhythm,
      peak:      state.userPeak      || 'variavel',
      challenge: state.userChallenge || 'foco',
      level:     state.level,
      streak:    state.streak,
    },
  };

  try {
    // ← pollJob substitui o fetch direto
    const data = await pollJob('/api/expand-task', payload);

    const idx = state.tasks.findIndex(t => t.id === placeholderId);
    if (idx > -1) {
      state.tasks[idx] = {
        ...placeholder,
        status:           'todo',
        missionTitle:     data.missionTitle || taskSnapshot.title,
        totalXP:          data.totalXP      || 0,
        estimatedMinutes: data.estimatedMinutes || 0,
        subtasks:         (data.subtasks || []).map(st => ({ ...st, done: false })),
      };
    }

    addTimelineItem('fa-solid fa-crosshairs', `Missão: ${data.missionTitle || taskSnapshot.title}`);
    showXPToast(`Missão criada! +${data.totalXP} XP ao concluir`);
    vib([30, 15, 60]);

    const loadingCard = document.querySelector(`.mission-task-card[data-id="${placeholderId}"]`);
    if (loadingCard) {
      const newCard = createMissionCard(state.tasks[idx]);
      loadingCard.replaceWith(newCard);
    } else {
      renderAll();
    }

  } catch (err) {
    console.error('[convertToMission]', err);
    const idx = state.tasks.findIndex(t => t.id === placeholderId);
    if (idx > -1) {
      state.tasks[idx].status = 'error';
      const loadingCard = document.querySelector(`.mission-task-card[data-id="${placeholderId}"]`);
      if (loadingCard) {
        const errCard = createMissionCard(state.tasks[idx]);
        loadingCard.replaceWith(errCard);
      } else {
        renderAll();
      }
    }
  }

  save();
}

function createMissionCard(task) {
  const card = document.createElement('div');
  card.className = 'mission-task-card';
  card.dataset.id = task.id;

  if (task.status === 'loading') {
    card.innerHTML = `
      <div class="mtc-loading">
        <div class="mtc-spinner"></div>
        <span class="mtc-loading-text">A IA está montando sua missão...</span>
      </div>`;
    return card;
  }

  if (task.status === 'error') {
    card.innerHTML = `
      <div class="mtc-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        Não foi possível gerar a missão. Tente novamente.
        <button class="remind-pill" style="margin-left:auto"
          onclick="convertToMission('${task._missionSourceId || task.id}')">
          Tentar de novo
        </button>
      </div>`;
    return card;
  }

  const subtasks  = task.subtasks || [];
  const doneCount = subtasks.filter(s => s.done).length;
  const pct       = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;
  const allDone   = subtasks.length > 0 && doneCount === subtasks.length;

  if (allDone) card.classList.add('all-done');

  card.innerHTML = `
    <div class="mtc-header" id="mtc-header-${task.id}">
      <div class="mtc-icon"><i class="fa-solid fa-crosshairs"></i></div>
      <div class="mtc-info">
        <div class="mtc-title">${escHtml(task.missionTitle || task.title)}</div>
        <div class="mtc-meta">
          <span class="mtc-badge">
            <i class="fa-solid fa-list-check" style="margin-right:3px;font-size:9px;"></i>
            ${doneCount}/${subtasks.length} subtarefas
          </span>
          ${task.estimatedMinutes
            ? `<span class="task-meta-extra"><i class="fa-regular fa-clock"></i>${task.estimatedMinutes}</span>`
            : ''}
          ${task.notes
            ? `<span class="task-meta-extra" title="${escHtml(task.notes)}"><i class="fa-solid fa-align-left"></i></span>`
            : ''}
        </div>
      </div>
      <span class="mtc-xp-total">${task.totalXP || 0} XP</span>
      <button class="mtc-add-btn" id="mtc-addbtn-${task.id}" title="Adicionar subtarefa">
        <i class="fa-solid fa-plus"></i>
      </button>
      <i class="fa-solid fa-chevron-down mtc-chevron" id="mtc-chev-${task.id}"></i>
    </div>

    <div class="mtc-progress-wrap">
      <div class="mtc-progress-track">
        <div class="mtc-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="mtc-progress-label">${pct}% concluído</div>
    </div>

    ${task.notes ? `
      <div style="padding:0 14px 10px 18px;">
        <p style="font-size:11px;color:var(--text-muted);line-height:1.5;margin:0;
                  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
          ${escHtml(task.notes)}
        </p>
      </div>` : ''}

    <div class="mtc-subtasks" id="mtc-subs-${task.id}">
      <div class="mtc-subtask-list" id="mtc-sublist-${task.id}"></div>
    </div>
  `;

  const subList = card.querySelector(`#mtc-sublist-${task.id}`);
  subtasks.forEach(st => subList.appendChild(createSubtaskItem(task.id, st)));

  card.querySelector(`#mtc-header-${task.id}`).addEventListener('click', e => {
    if (e.target.closest('.mtc-add-btn')) return;
    const body = card.querySelector(`#mtc-subs-${task.id}`);
    const chev = card.querySelector(`#mtc-chev-${task.id}`);
    const open = body.classList.toggle('open');
    chev.classList.toggle('open', open);
  });

  card.querySelector(`#mtc-addbtn-${task.id}`)?.addEventListener('click', e => {
    e.stopPropagation();
    openAddSubtaskSheet(task.id);
  });

  return card;
}

function openAddSubtaskSheet(missionTaskId) {
  _addSubtaskTargetId = missionTaskId;
  const task = state.tasks.find(t => t.id === missionTaskId);

  const nameEl = document.getElementById('add-subtask-mission-name');
  if (nameEl) nameEl.textContent = task?.missionTitle || task?.title || '';

  // Reset campos — sem tentar acessar IDs inexistentes
  const fields = {
    'subtask-title-input':  '',
    'subtask-xp-input':     '30',
    'subtask-tip-input':    '',
    'subtask-ai-context':   '',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  document.getElementById('subtask-ai-results')?.classList.add('hidden');
  document.getElementById('subtask-ai-loading')?.classList.add('hidden');
  _aiSuggestions = [];

  setSubtaskMode('manual');
  openSheet('add-subtask-sheet');
  setTimeout(() => document.getElementById('subtask-title-input')?.focus(), 320);
  const timeEl = document.getElementById('task-time2');
  if (timeEl) timeEl.value = nowTimeStr();
}

function deleteSubtask(parentTaskId, stId) {
  const task = state.tasks.find(t => t.id === parentTaskId);
  if (!task) return;

  task.subtasks = (task.subtasks || []).filter(s => s.id !== stId);
  task.totalXP          = task.subtasks.reduce((s, x) => s + (x.xp || 0), 0);
  task.estimatedMinutes = task.subtasks.reduce((s, x) => s + (x.estimatedMinutes || 0), 0);

  // Verifica se a missão deve ser concluída após a remoção
  const remaining = task.subtasks;
  const allDone   = remaining.length === 0 || remaining.every(s => s.done);

  if (allDone && task.status !== 'done') {
    task.status        = 'done';
    task.lastCompleted = todayISO();
    save();
    renderAll(); // estado mudou para done — reconstrói o card corretamente
    return;
  }

  save();

  // Patch cirúrgico — remove só o item do DOM sem fechar o accordion
  const card   = document.querySelector(`.mission-task-card[data-id="${parentTaskId}"]`);
  const stItem = card?.querySelector(`.mtc-subtask[data-st-id="${stId}"]`);

  if (card && stItem) {
    stItem.remove();
    patchMissionCard(task);
  } else {
    renderAll();
  }
}

function setSubtaskMode(mode) {
  document.querySelectorAll('#subtask-mode-toggle .task-type-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('subtask-manual-panel')
    ?.classList.toggle('hidden', mode !== 'manual');
  document.getElementById('subtask-ai-panel')
    ?.classList.toggle('hidden', mode !== 'ai');
}

function initAddSubtaskSheet() {
  // Impede que cliques dentro do painel fechem o sheet via backdrop
  document.addEventListener('click', e => {
    if (e.target.closest('#add-subtask-sheet .sheet-panel')) return; // ← deixa passar
    if (e.target.closest('#add-subtask-sheet .sheet-backdrop'))
      closeSheet('add-subtask-sheet');
  });

  // Toggle manual/IA
  document.addEventListener('click', e => {
    const btn = e.target.closest('#subtask-mode-toggle .task-type-btn');
    if (!btn) return;
    setSubtaskMode(btn.dataset.mode);
  });

  // Salvar manual
  document.addEventListener('click', e => {
    if (!e.target.closest('#subtask-save-btn')) return;
    const title = document.getElementById('subtask-title-input').value.trim();
    if (!title || !_addSubtaskTargetId) return;
    const xp  = parseInt(document.getElementById('subtask-xp-input')?.value)  || 30;
    const tip = document.getElementById('subtask-tip-input')?.value.trim()    || null;
    addSubtaskToMission(_addSubtaskTargetId, { title, xp, tip });
    closeSheet('add-subtask-sheet');
  });

  // Gerar sugestões com IA
  document.addEventListener('click', async e => {
    if (!e.target.closest('#subtask-ai-btn')) return;
    if (!_addSubtaskTargetId) return;
  
    const task   = state.tasks.find(t => t.id === _addSubtaskTargetId);
    const context = document.getElementById('subtask-ai-context').value.trim();
    const aiBtn   = document.getElementById('subtask-ai-btn');
  
    // Lock + feedback no botão
    aiBtn.disabled = true;
    aiBtn.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:8px;">
        <span style="
          width:14px;height:14px;border-radius:50%;
          border:2px solid rgba(255,255,255,0.3);
          border-top-color:#fff;
          display:inline-block;
          animation:subtask-spin 0.7s linear infinite;
        "></span>
        Gerando sugestões...
      </span>
    `;
  
    // Injeta keyframe se ainda não existe
    if (!document.getElementById('subtask-spin-style')) {
      const style = document.createElement('style');
      style.id = 'subtask-spin-style';
      style.textContent = `@keyframes subtask-spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }
  
    document.getElementById('subtask-ai-results')?.classList.add('hidden');
  
    try {
      const suggestions = await fetchSubtaskSuggestions(task, context);
      _aiSuggestions    = suggestions.map(s => ({ ...s, _selected: true }));
      renderAISuggestions(_aiSuggestions);
      document.getElementById('subtask-ai-results')?.classList.remove('hidden');
    } catch(err) {
      showXPToast('Erro ao gerar sugestões. Tente novamente.');
      console.error(err);
    } finally {
      aiBtn.disabled = false;
      aiBtn.innerHTML = `
        <i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px;"></i>Gerar sugestões
      `;
    }
  });
  

  // Confirmar sugestões selecionadas
  document.addEventListener('click', e => {
    if (!e.target.closest('#subtask-ai-confirm-btn')) return;
    if (!_addSubtaskTargetId) return;
    const selected = _aiSuggestions.filter(s => s._selected);
    selected.forEach(s => {
      const { _selected, ...st } = s;
      addSubtaskToMission(_addSubtaskTargetId, st);
    });
    if (selected.length > 0)
      showXPToast(`${selected.length} subtarefa${selected.length > 1 ? 's' : ''} adicionada${selected.length > 1 ? 's' : ''}!`);
    closeSheet('add-subtask-sheet');
  });
}

function renderAISuggestions(suggestions) {
  const list = document.getElementById('subtask-ai-list');
  if (!list) return;
  list.innerHTML = '';
  suggestions.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = `ai-suggestion-item${s._selected ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="ai-suggestion-check"><i class="fa-solid fa-check"></i></div>
      <div class="ai-suggestion-info">
        <div class="ai-suggestion-title">${escHtml(s.title)}</div>
        <div class="ai-suggestion-meta">
          ${s.estimatedMinutes ? `<span><i class="fa-regular fa-clock"></i> ${s.estimatedMinutes}min</span>` : ''}
          <span><i class="fa-solid fa-bolt"></i> ${s.xp} XP</span>
          ${s.tip ? `<span style="color:var(--accent);font-style:italic;">${escHtml(s.tip)}</span>` : ''}
        </div>
      </div>
    `;
    item.addEventListener('click', () => {
      suggestions[i]._selected = !suggestions[i]._selected;
      item.classList.toggle('selected', suggestions[i]._selected);
    });
    list.appendChild(item);
  });
}

// ─────────────────────────────────────────────────────
// 8. addSubtaskToMission — adiciona subtask ao state
// ─────────────────────────────────────────────────────
function addSubtaskToMission(missionTaskId, st) {
  const task = state.tasks.find(t => t.id === missionTaskId);
  if (!task) return;

  const newSt = {
    id:               `st_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
    title:            st.title,
    estimatedMinutes: st.estimatedMinutes || null,
    xp:               st.xp || 30,
    tip:              st.tip || null,
    done:             false,
  };

  task.subtasks = task.subtasks || [];
  task.subtasks.push(newSt);

  // Recalcula totais
  task.totalXP          = task.subtasks.reduce((s, x) => s + (x.xp || 0), 0);
  task.estimatedMinutes = task.subtasks.reduce((s, x) => s + (x.estimatedMinutes || 0), 0);

  // Reabre a missão se estava concluída
  if (task.status === 'done') task.status = 'todo';

  save();
  renderAll();
}

// 9. fetchSubtaskSuggestions — chama o backend (nova rota)
async function fetchSubtaskSuggestions(task, extraContext = '') {
  const cat = state.categories.find(c => c.id === task.catId);
  const payload = {
    task: {
      title:            task.missionTitle || task.title,
      notes:            task.notes || '',
      importance:       task.importance,
      category:         cat?.name || 'Geral',
      estimateMinutes:  task.estimateMinutes || null,
      energy:           task.energy || 'medium',
      existingSubtasks: (task.subtasks || []).map(s => s.title),
    },
    user: {
      name:      state.userName,
      profile:   state.userProfile,
      rhythm:    state.userRhythm,
      peak:      state.userPeak      || 'variavel',
      challenge: state.userChallenge || 'foco',
      level:     state.level,
      streak:    state.streak,
    },
    extraContext,
  };

  // ← pollJob substitui o fetch direto
  const data = await pollJob('/api/suggest-subtasks', payload);
  return data.subtasks || [];
}

function createSubtaskItem(parentTaskId, st) {
  const item = document.createElement('div');
  item.className = `mtc-subtask${st.done ? ' done' : ''}`;
  item.dataset.stId = st.id;
  item.style.position = 'relative';
  item.style.overflow = 'hidden';

  const inner = document.createElement('div');
  inner.className = 'mtc-subtask-inner';
  inner.style.cssText = 'display:flex;align-items:center;width:100%;transition:transform 0.15s,opacity 0.15s;';

  inner.innerHTML = `
    <div class="mtc-sub-check-wrap">
      <div class="mtc-sub-check-ring">
        <div class="mtc-sub-hold-ring"></div>
        <i class="fa-solid fa-check"></i>
      </div>
    </div>
    <div class="mtc-sub-content">
      <div class="mtc-sub-title">${escHtml(st.title)}</div>
      <div class="mtc-sub-meta">
        ${st.estimatedMinutes ? `<span class="mtc-sub-time"><i class="fa-regular fa-clock"></i>${st.estimatedMinutes}min</span>` : ''}
        ${st.tip ? `<span class="mtc-sub-tip">${escHtml(st.tip)}</span>` : ''}
      </div>
    </div>
    <span class="mtc-sub-xp">${st.xp} XP</span>
  `;

  item.appendChild(inner);

  if (!st.done) {
    setupSubtaskHold(item, parentTaskId, st.id);
    setupSubtaskSwipe(item, parentTaskId, st.id);
  }

  return item;
}

const SUBTASK_SWIPE_DELETE = 90;
const SUBTASK_SWIPE_CTX    = 80;

function setupSubtaskSwipe(item, parentTaskId, stId) {
  const inner = item.querySelector('.mtc-subtask-inner');
  let sx = 0, sy = 0, dx = 0, active = false, dirLocked = null;

  function resetVisual() {
    inner.style.transform = '';
    inner.style.opacity   = '';
    item.style.background = '';
    item.classList.remove('swiping-left', 'swiping-right');
    active = false;
    item._isSwiping = false;
  }

  item.addEventListener('touchstart', e => {
    // Não inicia swipe se a subtask já foi concluída
    const st = state.tasks
      .find(t => t.id === parentTaskId)?.subtasks
      ?.find(s => s.id === stId);
    if (!st || st.done) return;

    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    dx = 0; active = true; dirLocked = null;
    item._isSwiping = false;
  }, { passive: true });

  item.addEventListener('touchmove', e => {
    if (!active) return;

    // Se a subtask foi concluída durante o arrasto, cancela imediatamente
    const st = state.tasks
      .find(t => t.id === parentTaskId)?.subtasks
      ?.find(s => s.id === stId);
    if (!st || st.done) { resetVisual(); return; }

    const curX = e.touches[0].clientX;
    const curY = e.touches[0].clientY;
    dx = curX - sx;
    const dy = curY - sy;

    if (!dirLocked && (Math.abs(dx) > 6 || Math.abs(dy) > 6))
      dirLocked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';

    if (dirLocked === 'v') { resetVisual(); return; }
    if (dirLocked !== 'h') return;
    if (Math.abs(dx) > 10) item._isSwiping = true;

    const clamped = Math.max(-110, Math.min(110, dx));
    inner.style.transform = `translateX(${clamped}px)`;

    if (dx < 0) {
      const ratio = Math.min(Math.abs(dx) / SUBTASK_SWIPE_DELETE, 1);
      inner.style.opacity = String(1 - ratio * 0.45);
      item.style.background = `rgba(239,71,111,${ratio * 0.18})`;
      item.classList.add('swiping-left');
      item.classList.remove('swiping-right');
    } else {
      const ratio = Math.min(dx / SUBTASK_SWIPE_CTX, 1);
      item.style.background = `rgba(124,111,205,${ratio * 0.18})`;
      item.classList.add('swiping-right');
      item.classList.remove('swiping-left');
    }
  }, { passive: true });

  item.addEventListener('touchend', () => {
    if (!active) return;
    const wasSwiping = item._isSwiping;
    const lastDx = dx;
    resetVisual();

    if (!wasSwiping) return;

    // Checa estado atual antes de agir
    const st = state.tasks
      .find(t => t.id === parentTaskId)?.subtasks
      ?.find(s => s.id === stId);
    if (!st || st.done) return;

    if (lastDx < -SUBTASK_SWIPE_DELETE)   openDeleteSubtaskModal(parentTaskId, stId);
    else if (lastDx > SUBTASK_SWIPE_CTX)  openSubtaskContextMenu(parentTaskId, stId, item);
  });

  item.addEventListener('touchcancel', resetVisual);
}

(function injectDeleteSubtaskModal() {
  if (document.getElementById('delete-subtask-modal')) return;
  const el = document.createElement('div');
  el.id = 'delete-subtask-modal';
  el.className = 'bottom-sheet hidden';
  el.innerHTML = `
    <div class="sheet-backdrop" data-close="delete-subtask-modal"></div>
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <div style="text-align:center;padding:8px 0 20px;">
        <div style="width:52px;height:52px;border-radius:50%;background:#EF476F1a;
                    display:flex;align-items:center;justify-content:center;
                    margin:0 auto 14px;font-size:22px;color:#EF476F;">
          <i class="fa-solid fa-trash"></i>
        </div>
        <h3 class="sheet-title" style="margin-bottom:6px;">Excluir subtarefa?</h3>
        <p id="delete-subtask-name" style="font-size:13px;color:var(--text-muted);margin:0 16px;line-height:1.4;"></p>
      </div>
      <button class="btn-danger w-full" id="delete-subtask-confirm"
              style="background:#EF476F;color:#fff;border:none;border-radius:14px;
                     padding:14px;font-size:15px;font-weight:800;cursor:pointer;">
        <i class="fa-solid fa-trash" style="margin-right:6px;"></i>Sim, excluir
      </button>
      <button id="delete-subtask-cancel"
              style="width:100%;margin-top:10px;background:transparent;
                     border:1px solid var(--border,#333);color:var(--text-muted,#888);
                     border-radius:14px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;">
        Cancelar
      </button>
      <div style="height:8px;"></div>
    </div>
  `;
  document.body.appendChild(el);

  let _dsParentId = null, _dsStId = null;

  window._openDeleteSubtaskModal = function(parentTaskId, stId) {
    _dsParentId = parentTaskId; _dsStId = stId;
    const task = state.tasks.find(t => t.id === parentTaskId);
    const st   = task?.subtasks?.find(s => s.id === stId);
    const nameEl = document.getElementById('delete-subtask-name');
    if (nameEl) nameEl.textContent = `"${st?.title}" será removida permanentemente.`;
    openSheet('delete-subtask-modal');
  };

  document.getElementById('delete-subtask-confirm').addEventListener('click', () => {
    if (_dsParentId && _dsStId) deleteSubtask(_dsParentId, _dsStId);
    _dsParentId = null; _dsStId = null;
    closeSheet('delete-subtask-modal');
  });
  document.getElementById('delete-subtask-cancel').addEventListener('click', () => {
    _dsParentId = null; _dsStId = null;
    closeSheet('delete-subtask-modal');
  });
  document.querySelector('#delete-subtask-modal .sheet-backdrop')
    .addEventListener('click', () => closeSheet('delete-subtask-modal'));
})();

function openDeleteSubtaskModal(parentTaskId, stId) {
  window._openDeleteSubtaskModal(parentTaskId, stId);
}

(function injectSubtaskContextSheet() {
  if (document.getElementById('subtask-context-sheet')) return;
  const el = document.createElement('div');
  el.id = 'subtask-context-sheet';
  el.className = 'bottom-sheet hidden';
  el.innerHTML = `
    <div class="sheet-backdrop" data-close="subtask-context-sheet"></div>
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <div style="padding:4px 4px 14px;text-align:center;">
        <p id="stx-title" style="font-size:15px;color:var(--text);font-weight:800;margin:0 0 4px;"></p>
        <p id="stx-notes" style="font-size:12px;color:var(--text-muted);line-height:1.6;margin:0;
                                   white-space:pre-wrap;background:var(--surface2,#1e1e2a);
                                   border-radius:10px;padding:8px 12px;text-align:left;display:none;"></p>
      </div>
      <nav class="ctx-menu-nav">
        <button class="ctx-menu-btn" id="stx-edit">
          <span class="ctx-icon" style="background:#7C6FCD1a;color:#7C6FCD;">
            <i class="fa-solid fa-pen"></i>
          </span>
          <span class="ctx-text">
            <strong>Editar subtarefa</strong>
            <small>Alterar título, duração, XP, dica</small>
          </span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
        </button>
        <button class="ctx-menu-btn" id="stx-to-mission">
          <span class="ctx-icon" style="background:#FFD1661a;color:#FFD166;">
            <i class="fa-solid fa-crosshairs"></i>
          </span>
          <span class="ctx-text">
            <strong>Gerar missão</strong>
            <small>Remove daqui e vira uma missão própria</small>
          </span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
        </button>
      </nav>
      <div style="height:8px;"></div>
    </div>
  `;
  document.body.appendChild(el);

  let _stxParentId = null, _stxStId = null;

  window._openSubtaskContextMenu = function(parentTaskId, stId) {
    _stxParentId = parentTaskId; _stxStId = stId;
    const task = state.tasks.find(t => t.id === parentTaskId);
    const st   = task?.subtasks?.find(s => s.id === stId);
    const titleEl = document.getElementById('stx-title');
    const notesEl = document.getElementById('stx-notes');
    if (titleEl) titleEl.textContent = st?.title || '';
    if (notesEl) {
      const notes = st?.tip?.trim(); // subtasks usam "tip" como nota
      if (notes) { notesEl.textContent = notes; notesEl.style.display = 'block'; }
      else          notesEl.style.display = 'none';
    }
    openSheet('subtask-context-sheet');
  };

  document.getElementById('stx-edit').addEventListener('click', () => {
    const pId = _stxParentId, sId = _stxStId;
    _stxParentId = null; _stxStId = null;
    closeSheet('subtask-context-sheet');
    if (pId && sId) openEditSubtaskSheet(pId, sId);
  });

  document.getElementById('stx-to-mission').addEventListener('click', () => {
    const pId = _stxParentId, sId = _stxStId;
    _stxParentId = null; _stxStId = null;
    closeSheet('subtask-context-sheet');
    if (pId && sId) promoteSubtaskToMission(pId, sId);
  });

  document.querySelector('#subtask-context-sheet .sheet-backdrop')
    .addEventListener('click', () => closeSheet('subtask-context-sheet'));
})();

function openSubtaskContextMenu(parentTaskId, stId) {
  window._openSubtaskContextMenu(parentTaskId, stId);
}

(function injectEditSubtaskSheet() {
  if (document.getElementById('edit-subtask-sheet')) return;
  const el = document.createElement('div');
  el.id = 'edit-subtask-sheet';
  el.className = 'bottom-sheet hidden';
  el.innerHTML = `
    <div class="sheet-backdrop" data-close="edit-subtask-sheet"></div>
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <h3 class="sheet-title" style="margin-bottom:16px;">Editar subtarefa</h3>

      <label class="form-label">Título</label>
      <input id="edit-st-title" class="task-input" placeholder="Título da subtarefa" style="margin-bottom:12px;">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <label class="form-label">Duração (min)</label>
          <input id="edit-st-duration" class="task-input" type="number" min="1" placeholder="Ex: 30">
        </div>
        <div>
          <label class="form-label">XP</label>
          <input id="edit-st-xp" class="task-input" type="number" min="1" placeholder="30">
        </div>
      </div>

      <label class="form-label">Dica / Nota</label>
      <input id="edit-st-tip" class="task-input" placeholder="Dica opcional" style="margin-bottom:20px;">

      <button id="edit-st-save"
              style="width:100%;background:var(--accent);color:#fff;border:none;
                     border-radius:14px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;">
        <i class="fa-solid fa-floppy-disk" style="margin-right:6px;"></i>Salvar
      </button>
      <div style="height:8px;"></div>
    </div>
  `;
  document.body.appendChild(el);

  let _esParentId = null, _esStId = null;

  window._openEditSubtaskSheet = function(parentTaskId, stId) {
    _esParentId = parentTaskId; _esStId = stId;
    const task = state.tasks.find(t => t.id === parentTaskId);
    const st   = task?.subtasks?.find(s => s.id === stId);
    if (!st) return;
    document.getElementById('edit-st-title').value    = st.title || '';
    document.getElementById('edit-st-duration').value = st.estimatedMinutes || '';
    document.getElementById('edit-st-xp').value       = st.xp || 30;
    document.getElementById('edit-st-tip').value      = st.tip || '';
    openSheet('edit-subtask-sheet');
    setTimeout(() => document.getElementById('edit-st-title').focus(), 320);
  };

  document.getElementById('edit-st-save').addEventListener('click', () => {
    if (!_esParentId || !_esStId) return;
    const title = document.getElementById('edit-st-title').value.trim();
    if (!title) return;
    const dur = parseInt(document.getElementById('edit-st-duration').value) || null;
    const xp  = parseInt(document.getElementById('edit-st-xp').value)       || 30;
    const tip = document.getElementById('edit-st-tip').value.trim()         || null;
    editSubtask(_esParentId, _esStId, { title, estimatedMinutes: dur, xp, tip });
    _esParentId = null; _esStId = null;
    closeSheet('edit-subtask-sheet');
  });

  document.querySelector('#edit-subtask-sheet .sheet-backdrop')
    .addEventListener('click', () => closeSheet('edit-subtask-sheet'));
})();

function openEditSubtaskSheet(parentTaskId, stId) {
  window._openEditSubtaskSheet(parentTaskId, stId);
}

function editSubtask(parentTaskId, stId, fields) {
  const task = state.tasks.find(t => t.id === parentTaskId);
  if (!task) return;
  const st = task.subtasks?.find(s => s.id === stId);
  if (!st) return;
  Object.assign(st, fields);
  task.totalXP          = task.subtasks.reduce((s, x) => s + (x.xp || 0), 0);
  task.estimatedMinutes = task.subtasks.reduce((s, x) => s + (x.estimatedMinutes || 0), 0);
  save();
  renderAll();
}


// ─────────────────────────────────────────────────────
// TRECHO 6: promoteSubtaskToMission — novo
// Retira a subtarefa da missão-pai e cria uma tarefa
// do tipo 'task' temporária, depois chama convertToMission.
// ─────────────────────────────────────────────────────
async function promoteSubtaskToMission(parentTaskId, stId) {
  const parent = state.tasks.find(t => t.id === parentTaskId);
  if (!parent) return;
  const st = parent.subtasks?.find(s => s.id === stId);
  if (!st) return;

  // Remove da missão pai
  parent.subtasks = parent.subtasks.filter(s => s.id !== stId);
  parent.totalXP          = parent.subtasks.reduce((s, x) => s + (x.xp || 0), 0);
  parent.estimatedMinutes = parent.subtasks.reduce((s, x) => s + (x.estimatedMinutes || 0), 0);

  // Cria tarefa temporária com os dados da subtarefa
  const tempId = uid();
  const tempTask = {
    id:              tempId,
    type:            'task',
    title:           st.title,
    notes:           st.tip || '',
    catId:           parent.catId,
    importance:      parent.importance || 'Padrão',
    dueDate:         parent.dueDate || todayISO(),
    estimateMinutes: st.estimatedMinutes || null,
    energy:          'medium',
    repeat:          'none',
    status:          'todo',
    createdAt:       Date.now(),
    xpEarned:        0,
    lastCompleted:   null,
  };

  state.tasks.unshift(tempTask);
  save();

  showXPToast('Gerando missão a partir da subtarefa...');
  await convertToMission(tempId);
}

function setupSubtaskHold(item, parentTaskId, stId) {
  const ring    = item.querySelector('.mtc-sub-hold-ring');
  let holdTimer = null, raf = null, t0 = 0;

  function start() {
    // Não inicia hold se swipe está rolando
    if (item._isSwiping) return;
    t0 = Date.now();

    holdTimer = setTimeout(() => {
      cancelAnimationFrame(raf);
      completeSubtask(parentTaskId, stId);
    }, HOLD_MS);

    function anim() {
      // Cancela hold se swipe começou durante o hold
      if (item._isSwiping) { cancel(); return; }
      const pct = Math.min((Date.now() - t0) / HOLD_MS, 1) * 360;
      if (ring) ring.style.background =
        `conic-gradient(var(--accent-teal) ${pct}deg, transparent ${pct}deg)`;
      if ((Date.now() - t0) < HOLD_MS) raf = requestAnimationFrame(anim);
    }
    raf = requestAnimationFrame(anim);
  }

  function cancel() {
    clearTimeout(holdTimer);
    cancelAnimationFrame(raf);
    if (ring) ring.style.background = '';
  }

  item.addEventListener('mousedown',  start);
  item.addEventListener('touchstart', start, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel']
    .forEach(ev => item.addEventListener(ev, cancel));
}

function completeSubtask(parentTaskId, stId) {
  const parent = state.tasks.find(t => t.id === parentTaskId);
  if (!parent) return;

  const st = parent.subtasks?.find(s => s.id === stId);
  if (!st || st.done) return;

  st.done = true;
  updateStreak();
  addXP(st.xp);
  _recordDailyComplete(st.xp);
  state.coins += Math.floor(st.xp / 30);
  state.tasksCompleted++;

  playDing();
  vib([30, 15, 60]);
  showXPToast(`+${st.xp} XP`);

  const allDone = parent.subtasks.every(s => s.done);

  if (allDone) {
    parent.status = 'done';
    parent.lastCompleted = todayISO();
    if (parent._missionRef) updateMissionById(parent._missionRef);
    confetti({ particleCount: 80, spread: 65, origin: { y: 0.5 }, colors: ['#7C6FCD','#4ECDC4','#FFD166'], scalar: 0.9 });
    showXPToast('Missão completa!', { icon: 'fa-solid fa-trophy', color: '#7C6FCD', textColor: '#fff' });
    addTimelineItem('fa-solid fa-trophy', `Missão concluída: ${parent.missionTitle || parent.title}`);
    // Missão concluída: aí sim reconstrói pois o card some/muda de estado
    save();
    renderAll();
    return;
  }

  if (parent._missionRef) {
    updateMissionProgress_byId(parent._missionRef, parent.subtasks.filter(s => s.done).length);
  }

  save();

  // ── Atualiza o card cirurgicamente, sem fechar o painel ──
  patchMissionCard(parent);
}

function patchMissionCard(task) {
  const card = document.querySelector(`.mission-task-card[data-id="${task.id}"]`);
  if (!card) { renderAll(); return; } // fallback se o card não existir

  const subtasks  = task.subtasks || [];
  const doneCount = subtasks.filter(s => s.done).length;
  const pct       = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  // Atualiza badge de contagem
  const badge = card.querySelector('.mtc-badge');
  if (badge) badge.innerHTML = `
    <i class="fa-solid fa-list-check" style="margin-right:3px;font-size:9px;"></i>
    ${doneCount}/${subtasks.length} subtarefas
  `;

  // Atualiza barra de progresso
  const fill  = card.querySelector('.mtc-progress-fill');
  const label = card.querySelector('.mtc-progress-label');
  if (fill)  fill.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}% concluído`;

  // Atualiza XP total
  const xpEl = card.querySelector('.mtc-xp-total');
  if (xpEl) xpEl.textContent = `${task.totalXP || 0} XP`;

  // Marca a subtask concluída visualmente
  const stItem = card.querySelector(`.mtc-subtask[data-st-id="${
    task.subtasks.find(s => s.done && !card.querySelector(`[data-st-id="${s.id}"].done`))?.id
  }"]`);

  // Mais direto: atualiza todos os itens pelo estado atual
  card.querySelectorAll('.mtc-subtask').forEach(item => {
    const sid = item.dataset.stId;
    const st  = task.subtasks.find(s => s.id === sid);
    if (!st || item.classList.contains('done')) return;
    if (st.done) {
      // Limpa qualquer resíduo de swipe antes de clonar
      item.classList.remove('swiping-left', 'swiping-right');
      item.style.background = '';
      const inner = item.querySelector('.mtc-subtask-inner');
      if (inner) { inner.style.transform = ''; inner.style.opacity = ''; }
  
      item.classList.add('done');
      const ring = item.querySelector('.mtc-sub-hold-ring');
      if (ring) ring.style.background = '';
      const clone = item.cloneNode(true);
      item.replaceWith(clone);
    }
  });
}

// ─────────────────────────────────────────────────────
// Helpers de missão
// ─────────────────────────────────────────────────────
function updateMissionById(missionId) {
  const m = state.missions.find(m => m.id === missionId);
  if (!m || m.done) return;
  m.progress = m.target;
  m.done     = true;
  state.missionsCompleted++;
  addXP(m.xp);
  state.coins += m.coins;
  showXPToast(`+${m.xp} XP (Missão!)`);
}

function updateMissionProgress_byId(missionId, progress) {
  const m = state.missions.find(m => m.id === missionId);
  if (!m || m.done) return;
  m.progress = progress;
}

function initTaskTypeToggle() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.task-type-btn');
    if (!btn || !btn.closest('#task-type-toggle')) return;
    _newTaskType = btn.dataset.type;
    document.querySelectorAll('#task-type-toggle .task-type-btn')
      .forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('task-type-mission-hint')
      ?.classList.toggle('hidden', _newTaskType !== 'mission');
  });
}

function initNotesCounter() {
  document.addEventListener('input', e => {
    if (e.target.id !== 'task-notes') return;
    const el = document.getElementById('notes-char-count');
    if (el) el.textContent = e.target.value.length;
  });
}


//#endregion

//#region Renderização - Planejamento
function renderPlan() {
  const view      = state.planView;
  const filtersEl = document.getElementById('plan-filters');
  const content   = document.getElementById('plan-content');
  content.innerHTML = '';

  filtersEl.classList.add('hidden');

  const overdueCount = state.tasks.filter(t => isOverdueByTime(t) && t.status !== 'done').length;
  document.querySelectorAll('.plan-tab').forEach(tab => {
    const existing = tab.querySelector('.plan-tab-badge');
    if (existing) existing.remove();
    if (tab.dataset.view === 'overdue' && overdueCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'plan-tab-badge';
      badge.textContent = overdueCount;
      tab.appendChild(badge);
    }
  });

  if (view === 'category') {
    filtersEl.classList.remove('hidden');
    renderCatChipsPlan();
    renderPlanByCategory(content);
  } else if (view === 'priority') {
    renderPlanByPriority(content);
  } else {
    let tasks = [];
    let emptyMsg = 'Nenhuma tarefa aqui.';
    if (view === 'today')    { tasks = state.tasks.filter(t => isToday(t) || isOverdueByTime(t)); emptyMsg = 'Nenhuma tarefa para hoje.'; }
    if (view === 'tomorrow') { tasks = state.tasks.filter(t => isTomorrow(t));                    emptyMsg = 'Nenhuma tarefa para amanhã.'; }
    if (view === 'week')     { tasks = state.tasks.filter(t => isThisWeek(t));                    emptyMsg = 'Nenhuma tarefa essa semana.'; }
    if (view === 'overdue')  { tasks = state.tasks.filter(t => isOverdueByTime(t) && t.status !== 'done'); emptyMsg = 'Nada atrasado. Ótimo trabalho!'; }

    tasks = sortTasks(tasks); // ← ordenação aplicada

    if (tasks.length === 0) {
      content.innerHTML = `<div class="plan-empty"><i class="fa-solid fa-circle-check"></i><p>${emptyMsg}</p></div>`;
      return;
    }
    const group = document.createElement('div');
    group.className = 'task-list';
    tasks.forEach(t => group.appendChild(createTaskCard(t)));
    content.appendChild(group);
  }
}

function renderPlanByCategory(container) {
  const cats = state.planCat
    ? state.categories.filter(c => c.id === state.planCat)
    : state.categories;
  let any = false;
  cats.forEach(cat => {
    const tasks = sortTasks(
      state.tasks.filter(t => t.catId === cat.id && t.status !== 'done')
    );
    if (tasks.length === 0) return;
    any = true;
    const group = document.createElement('div');
    group.className = 'plan-group';
    group.innerHTML = `<div class="plan-group-title"><i class="${cat.icon}" style="color:${cat.color}"></i>${cat.name}</div>`;
    const list = document.createElement('div'); list.className = 'task-list';
    tasks.forEach(t => list.appendChild(createTaskCard(t)));
    group.appendChild(list);
    container.appendChild(group);
  });
  if (!any) container.innerHTML = `<div class="plan-empty"><i class="fa-solid fa-layer-group"></i><p>Nenhuma tarefa nesta categoria.</p></div>`;
}

function renderPlanByPriority(container) {
  const order = ['Obrigatório', 'Necessário', 'Padrão', 'Ideia'];
  const icons  = {
    Obrigatório: 'fa-solid fa-circle-exclamation',
    Necessário:  'fa-solid fa-circle-dot',
    Padrão:      'fa-solid fa-circle',
    Ideia:       'fa-regular fa-lightbulb',
  };
  let any = false;
  order.forEach(imp => {
    const tasks = sortTasks(
      state.tasks.filter(t => t.importance === imp && t.status !== 'done')
    );
    if (tasks.length === 0) return;
    any = true;
    const group = document.createElement('div');
    group.className = 'plan-group';
    group.innerHTML = `<div class="plan-group-title"><i class="${icons[imp]}"></i>${imp}</div>`;
    const list = document.createElement('div'); list.className = 'task-list';
    tasks.forEach(t => list.appendChild(createTaskCard(t)));
    group.appendChild(list);
    container.appendChild(group);
  });
  if (!any) container.innerHTML = `<div class="plan-empty"><i class="fa-solid fa-check-double"></i><p>Nenhuma tarefa pendente.</p></div>`;
}

function renderCatChipsPlan() {
  console.log('[renderCatChipsPlan] categorias:', state.categories.map(c => c.name));
  const el = document.getElementById('cat-chips-plan');
  console.log('[renderCatChipsPlan] elemento cat-chips-plan:', el);
  el.innerHTML = '';
  state.categories.forEach(cat => {
    const count = state.tasks.filter(t => t.catId === cat.id && t.status !== 'done').length;
    const btn = document.createElement('button');
    btn.className = `cat-chip${state.planCat === cat.id ? ' active' : ''}`;
    btn.innerHTML = `<i class="${cat.icon}" style="color:${cat.color}"></i>${cat.name}<span class="cc-count">${count}</span>`;
    btn.onclick = () => { state.planCat = state.planCat === cat.id ? null : cat.id; renderPlan(); };
    el.appendChild(btn);
  });
}
//#endregion

//#region Renderização - Missões
function renderMissions() {
  const list = document.getElementById('missions-list');
  if (!list) return;
  list.innerHTML = '';
  state.missions.forEach(m => {
    const pct = m.target > 0 ? Math.min(100, (m.progress / m.target) * 100) : 0;
    const div = document.createElement('div');
    div.className = `mission-card${m.bonus?' bonus':''}${m.done?' done':''}`;
    div.innerHTML = `
      ${m.bonus?`<div class="bonus-badge"><i class="fa-solid fa-star"></i> Bônus</div>`:''}
      <div class="mission-top">
        <div class="mission-title">${escHtml(m.title)}</div>
        <div class="mission-reward">
          <span class="mission-xp">+${m.xp} XP</span>
          <span class="mission-coins"><i class="fa-solid fa-coin" style="font-size:10px;"></i> ${m.coins}</span>
        </div>
      </div>
      ${m.done
        ? `<div class="mission-done-mark"><i class="fa-solid fa-circle-check"></i> Concluída!</div>`
        : `<div class="mission-progress-track"><div class="mission-progress-fill" style="width:${pct}%"></div></div>
           <div class="mission-progress-label">${m.progress} / ${m.target}</div>`
      }
    `;
    list.appendChild(div);
  });
  const pending = state.missions.filter(m => !m.done).length;
  const badge = document.getElementById('menu-missions-badge');
  if (badge) {
    badge.textContent = pending;
    pending > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');
  }
}

function updateMissionTimer() {
  const el = document.getElementById('mission-countdown');
  if (!el) return;
  const now = new Date(), midnight = new Date(now); midnight.setHours(24,0,0,0);
  const diff = midnight - now;
  const h = String(Math.floor(diff/3600000)).padStart(2,'0');
  const m = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
  const s = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
  el.textContent = `${h}:${m}:${s}`;
}
//#endregion

//#region Renderização - Conquistas & Timeline

async function loadAchievementsConfig() {
  try {
    const res  = await fetch('achievements.json');
    const data = await res.json();

    RARITY_STYLE = data.rarityStyles;

    /* Reconstrói as funções `check` a partir do descritor declarativo */
    ACHIEVEMENTS = data.achievements.map(b => ({
      ...b,
      check: buildCheck(b.check),
    }));
  } catch (e) {
    console.error('Falha ao carregar achievements.json:', e);
  }
}

function buildCheck({ field, op, value }) {
  return s => {
    /* Suporte a campos aninhados como "tasks.length" */
    const parts = field.split('.');
    let v = s;
    for (const p of parts) v = v?.[p];

    if (op === 'gte') return (v ?? 0) >= value;
    if (op === 'eq')  return v === value;
    return false;
  };
}


/* ── Renderização ──────────────────────────────────── */
function renderAchievements() {
  const grid = document.getElementById('badges-grid');
  if (!grid) return;
  grid.innerHTML = '';

  /* Agrupa por raridade na ordem definida */
  const ORDER = ['lendário','épico','raro','incomum','comum'];

  /* Separa desbloqueadas e bloqueadas, ordena dentro de cada grupo */
  const unlocked = ACHIEVEMENTS.filter(b => b.check(state));
  const locked   = ACHIEVEMENTS.filter(b => !b.check(state));

  /* Seção por raridade */
  ORDER.forEach(rarity => {
    const inUnlocked = unlocked.filter(b => b.rarity === rarity);
    const inLocked   = locked.filter(b => b.rarity === rarity);
    if (inUnlocked.length + inLocked.length === 0) return;

    const rs = RARITY_STYLE[rarity];

    /* Cabeçalho da seção */
    const header = document.createElement('div');
    header.className = 'badge-section-header';
    header.innerHTML = `
      <span class="badge-rarity-pill" style="background:${rs.bg};color:${rs.color};border:1px solid ${rs.border}">
        ${rs.label}
      </span>
      <span class="badge-rarity-count">${inUnlocked.length}/${inUnlocked.length+inLocked.length}</span>
    `;
    grid.appendChild(header);

    /* Wrap de badges */
    const wrap = document.createElement('div');
    wrap.className = 'badge-row';
    grid.appendChild(wrap);

    [...inUnlocked, ...inLocked].forEach(b => {
      const isUnlocked = b.check(state);
      const rs2 = RARITY_STYLE[b.rarity];
      const div = document.createElement('div');
      div.className = `badge-item ${isUnlocked ? 'unlocked' : 'locked'}`;
      if (isUnlocked) {
        div.style.cssText = `border-color:${rs2.border};background:${rs2.bg}`;
      }
      div.innerHTML = isUnlocked
        ? `<i class="${b.icon} badge-icon" style="color:${rs2.color}"></i>
           <div class="badge-name">${b.name}</div>
           <div class="badge-desc">${b.desc}</div>`
        : `<i class="fa-solid fa-lock badge-icon-locked"></i>
           <div class="badge-name">${b.name}</div>
           <div class="badge-desc">${b.desc}</div>`;
      wrap.appendChild(div);
    });
  });
}

/* ── Verificar e notificar novas conquistas ────────── */
function checkAchievements() {
  if (!state.unlockedAchievements) state.unlockedAchievements = [];
  ACHIEVEMENTS.forEach(b => {
    if (!state.unlockedAchievements.includes(b.id) && b.check(state)) {
      state.unlockedAchievements.push(b.id);
      addTimelineItem('fa-solid fa-trophy', `Conquista: ${b.name}`);
      showAchievementToast(b);
    }
  });
}

function showAchievementToast(b) {
  const rs = RARITY_STYLE[b.rarity];
  let toast = document.getElementById('achievement-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'achievement-toast';
    document.body.appendChild(toast);
  }
  toast.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%) translateY(20px);
    background:var(--bg-card); border:1px solid ${rs.border};
    border-radius:14px; padding:12px 18px;
    display:flex; align-items:center; gap:12px;
    z-index:999; opacity:0;
    transition: opacity 0.3s, transform 0.3s;
    max-width:300px; width:90%;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  `;
  toast.innerHTML = `
    <div style="width:36px;height:36px;border-radius:10px;background:${rs.bg};display:flex;align-items:center;justify-content:center;font-size:18px;color:${rs.color};flex-shrink:0">
      <i class="${b.icon}"></i>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;color:${rs.color};text-transform:uppercase;letter-spacing:0.08em">${rs.label} desbloqueado!</div>
      <div style="font-size:14px;font-weight:800;color:var(--text)">${b.name}</div>
      <div style="font-size:12px;color:var(--text-sec)">${b.desc}</div>
    </div>
  `;
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, 3500);
}

function renderTimeline() {
  const tl = document.getElementById('timeline');
  if (!tl) return;
  tl.innerHTML = '';
  if (state.timeline.length === 0) {
    tl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:12px 0;">Seus marcos aparecerão aqui conforme você progride.</p>';
    return;
  }
  state.timeline.forEach(item => {
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.innerHTML = `
      <div class="timeline-dot"><i class="${item.icon}" style="font-size:11px;"></i></div>
      <div class="timeline-body">
        <div class="timeline-title">${escHtml(item.title)}</div>
        <div class="timeline-date">${item.date}</div>
      </div>
    `;
    tl.appendChild(div);
  });

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  tl.querySelectorAll('.timeline-item').forEach(el => obs.observe(el));
}

function addTimelineItem(icon, title) {
  state.timeline.unshift({ icon, title, date: new Date().toLocaleDateString('pt-BR') });
  if (state.timeline.length > 60) state.timeline.pop();
}
//#endregion

//#region Perfil & Configurações
function renderMenuProfile() {
  const row = document.getElementById('menu-profile-row');
  if (!row) return;
  const needed = xpForLevel(state.level);
  const prev   = state.level > 1 ? xpForLevel(state.level-1) : 0;
  const pct    = Math.min(100, Math.round(((state.totalXP - prev) / (needed - prev)) * 100));
  row.innerHTML = `
    <div class="menu-avatar">${state.userName[0].toUpperCase()}</div>
    <div class="menu-avatar-info">
      <div class="menu-name">${escHtml(state.userName)}</div>
      <div class="menu-level">Nível ${state.level} — ${currentLevelTitle()}</div>
      <div class="menu-xp-row">
        <div class="menu-xp-track"><div class="menu-xp-fill" style="width:${pct}%"></div></div>
        <span class="menu-xp-val">${state.totalXP} / ${needed} XP</span>
      </div>
    </div>
  `;
}

function renderSettings() {
  const nameEl = document.getElementById('settings-name');
  const profEl = document.getElementById('settings-profile');
  if (nameEl) nameEl.value = state.userName;
  if (profEl) profEl.value = state.userProfile;
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('s-xp', state.totalXP);
  el('s-level', state.level);
  el('s-coins', state.coins);
}


//#endregion

//#region UI Feedback (Snackbar / Toast / LevelUp)
/* ── SNACKBAR QUEUE ──────────────────────────────────────────── */
const snackbarQueue = [];
let snackbarActive = false;

function showSnackbar(msg, onUndo) {
  snackbarQueue.push({ msg, onUndo });
  if (!snackbarActive) _nextSnackbar();
}

function _nextSnackbar() {
  if (!snackbarQueue.length) { snackbarActive = false; return; }
  snackbarActive = true;

  const { msg, onUndo } = snackbarQueue.shift();
  const sb     = document.getElementById('snackbar');
  const msgEl  = document.getElementById('snackbar-msg');
  const undoBtn = document.getElementById('snackbar-undo');
  if (!sb) return;

  // Reset animation state
  sb.classList.remove('sb-enter', 'sb-exit', 'hidden');
  void sb.offsetWidth; // reflow para reiniciar animação

  if (msgEl) msgEl.textContent = msg;
if (undoBtn) undoBtn.style.display = onUndo ? 'inline-flex' : 'none'; 
  let dismissed = false;
  const dismiss = (runUndo = false) => {
    if (dismissed) return;
    dismissed = true;
    if (runUndo && onUndo) onUndo();
    _exitSnackbar(sb, _nextSnackbar);
  };

  undoBtn.onclick = () => dismiss(true);

  sb.classList.add('sb-enter');

  const timer = setTimeout(() => dismiss(false), 4500);

  // Guarda o timer no elemento para cancelar se o undo for acionado antes
  sb._dismissTimer = timer;
  undoBtn.onclick = () => { clearTimeout(timer); dismiss(true); };
}

function _exitSnackbar(sb, cb) {
  sb.classList.remove('sb-enter');
  sb.classList.add('sb-exit');
  sb.addEventListener('animationend', function handler() {
    sb.removeEventListener('animationend', handler);
    sb.classList.add('hidden');
    sb.classList.remove('sb-exit');
    cb();
  }, { once: true });
}

function showXPToast(msg, opts = {}) {
  const t = document.getElementById('xp-toast');
  if (!t) return;

  const {
    duration = 1900,
    color,      // override de background
    textColor,  // override de cor do texto
    icon,       // classe FA extra, ex: 'fa-solid fa-trophy'
  } = opts;

  // Monta conteúdo
  const textEl = document.getElementById('xp-toast-text');
  if (textEl) {
    textEl.innerHTML = icon
      ? `<i class="${icon}" style="margin-right:6px;font-size:14px;"></i>${escHtml(msg)}`
      : escHtml(msg);
  }

  // Tamanho adaptativo
  const isLong = msg.length > 28;
  t.style.fontSize    = isLong ? '13px' : '';
  t.style.padding     = isLong ? '9px 18px' : '';
  t.style.fontFamily  = isLong ? 'Nunito, sans-serif' : '';
  t.style.fontWeight  = isLong ? '700' : '';
  t.style.maxWidth    = isLong ? '82vw' : '260px';
  t.style.whiteSpace  = isLong ? 'normal' : 'nowrap';
  t.style.textAlign   = isLong ? 'center' : '';
  t.style.lineHeight  = isLong ? '1.35' : '';

  // Cores opcionais
  t.style.background = color     || '';
  t.style.color      = textColor || '';

  // Duração adaptativa: mensagens longas ficam mais tempo
  const finalDuration = duration === 1900 && isLong ? 2800 : duration;

  // Re-trigger da animação
  t.classList.remove('visible', 'hidden');
  t.style.animationDuration = `${finalDuration}ms`;
  void t.offsetWidth;
  t.classList.remove('hidden');
  t.classList.add('visible');

  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove('visible'), finalDuration);
}

function triggerLevelUp() {
  playLevelUpSfx();
  vib([80, 40, 80, 40, 160]);
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors: ['#7C6FCD','#FFD166','#4ECDC4'] });

  const overlay = document.getElementById('levelup-overlay');
  document.getElementById('levelup-num').textContent = state.level;
  document.getElementById('levelup-title').textContent = currentLevelTitle();

  // Reinicia a animação do arco
  const arc = document.getElementById('levelup-ring-arc');
  if (arc) { arc.style.animation = 'none'; void arc.offsetWidth; arc.style.animation = ''; }

  overlay.classList.remove('hidden');
  gsap.fromTo('.levelup-badge-wrap', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.7)' });
  gsap.fromTo('.levelup-title',      { y: 16, opacity: 0 },       { y: 0, opacity: 1, duration: 0.4, delay: 0.3, ease: 'power2.out' });
  gsap.fromTo('.levelup-sub',        { y: 12, opacity: 0 },       { y: 0, opacity: 1, duration: 0.35, delay: 0.45, ease: 'power2.out' });
  gsap.fromTo('.levelup-rewards',    { y: 10, opacity: 0 },       { y: 0, opacity: 1, duration: 0.3, delay: 0.6, ease: 'power2.out' });

  setTimeout(() => overlay.classList.add('hidden'), 4200);
}
//#endregion

//#region Navegação & Sheets
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const bottomNav = document.getElementById('bottom-nav');
  const app       = document.getElementById('app');
  const NAV_TABS  = ['today', 'plan', 'focus'];
  const hasNav    = NAV_TABS.includes(tab);

  const screen = document.getElementById(`screen-${tab}`);
  if (screen) screen.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  if (navBtn) navBtn.classList.add('active');

  requestAnimationFrame(() => {
    if (hasNav) {
      app.style.bottom = 'calc(var(--nav-h) + var(--safe-bottom))';
      bottomNav.classList.remove('hidden');
    } else {
      app.style.bottom = '0px';
      bottomNav.classList.add('hidden');
    }
  });

  // Empurra estado para que o "voltar" nativo possa ser interceptado
  if (tab !== 'today') {
    history.pushState({ screen: tab }, '');
  }

  if (tab === 'today')        renderToday();
  if (tab === 'plan')         renderPlan();
  if (tab === 'focus')        renderFocusTaskSelect();
  if (tab === 'missions')     renderMissions();
  if (tab === 'achievements') renderAchievements();
  if (tab === 'timeline')     renderTimeline();
  if (tab === 'settings')     renderSettings();
  if (tab === 'seasonal')     renderSeasonalCalendar();
  if (tab === 'empresa')      renderEmpresa?.();
}

function goToScreen(name) {
  closeSheet('menu-sheet');
  const NAV_TABS = ['today','plan','focus'];
  if (NAV_TABS.includes(name)) { switchTab(name); return; }
  switchTab(name);
}

function openSheet(id) {
  const sheet = document.getElementById(id); if (!sheet) return;
  sheet.classList.remove('hidden');
  const panel = sheet.querySelector('.sheet-panel');
  if (panel) gsap.fromTo(panel, { y: 80 }, { y: 0, duration: 0.28, ease: 'power2.out' });

  // Empurra estado para capturar o "voltar" nativo
  history.pushState({ sheet: id }, '');
}

function closeSheet(id) {
  const sheet = document.getElementById(id); if (!sheet) return;
  const panel = sheet.querySelector('.sheet-panel');
  if (panel) gsap.to(panel, { y: 80, duration: 0.2, ease: 'power2.in', onComplete: () => sheet.classList.add('hidden') });
  else sheet.classList.add('hidden');
}

window.addEventListener('popstate', (e) => {
  // Marca como consumido por padrão; desmarca só se não houver nada para fechar
  window.__backConsumed = true;

  // 1. Voice sheet (handler especial)
  if (window._voiceSheetBackHandler?.()) return;

  // 2. Fecha qualquer sheet visível
  const visibleSheet = document.querySelector(
    '.bottom-sheet:not(.hidden), .sheet:not(.hidden), .voice-sheet:not(.hidden)'
  );
  if (visibleSheet) {
    closeSheet(visibleSheet.id);
    return;
  }

  // 3. Volta para today se estiver em outra screen
  const activeScreen = document.querySelector('.tab-screen.active');
  if (activeScreen && activeScreen.id !== 'screen-today') {
    switchTab('today');
    return;
  }

  // 4. Nada consumiu — deixa o Android exibir o diálogo de saída
  window.__backConsumed = false;
});

// Estado inicial no histórico
history.pushState(null, '');
//#endregion

//#region Swipe Navigation
(function initSwipeNav() {
  const NAV_TABS  = ['today', 'plan', 'focus'];
  const THRESHOLD = 72;  // px mínimos para confirmar swipe
  const RATIO     = 1.8; // deltaX deve ser N× maior que deltaY

  let touchStartX = 0;
  let touchStartY = 0;
  let decided     = false; // já decidimos se é swipe ou scroll?
  let isSwipe     = false; // gesto confirmado como horizontal
  let direction   = 0;     // -1 = próxima tab, +1 = tab anterior

  function currentIndex() {
    return NAV_TABS.indexOf(state.activeTab);
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    if (currentIndex() === -1) return;

    // Ignora se o toque começou dentro de um card de tarefa ou subtarefa
    if (e.target.closest('.task-card, .subtask-item, .mission-card, .mtc-subtask, .mission-task-card, .plan-tabs')) {
      decided = true; isSwipe = false; return;
    }

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    decided     = false;
    isSwipe     = false;
    direction   = 0;
  }

  function onTouchMove(e) {
    if (decided && !isSwipe) return; // confirmado como scroll — não faz nada

    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    if (!decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // aguarda movimento mínimo

      decided = true;

      // Eixo dominante é vertical → scroll normal
      if (Math.abs(dy) >= Math.abs(dx) || Math.abs(dx) / Math.abs(dy) < RATIO) {
        isSwipe = false;
        return;
      }

      // Horizontal confirmado — verifica se há tab nessa direção
      const dir      = dx < 0 ? -1 : 1;
      const idx      = currentIndex();
      const targetIdx = idx + (dir < 0 ? 1 : -1);

      if (targetIdx < 0 || targetIdx >= NAV_TABS.length) {
        isSwipe = false;
        return;
      }

      isSwipe   = true;
      direction = dir;
    }

    if (isSwipe) e.preventDefault(); // bloqueia scroll enquanto está swipando
  }

  function onTouchEnd(e) {
    if (!isSwipe) return;

    const dx  = e.changedTouches[0].clientX - touchStartX;
    const idx = currentIndex();

    if (Math.abs(dx) >= THRESHOLD) {
      const targetIdx = idx + (direction < 0 ? 1 : -1);
      if (targetIdx >= 0 && targetIdx < NAV_TABS.length) {
        switchTab(NAV_TABS[targetIdx]);
      }
    }

    // reset
    decided = isSwipe = false;
    direction = 0;
  }

  NAV_TABS.forEach(tab => {
    const screen = document.getElementById(`screen-${tab}`);
    if (!screen) return;
    const scroll = screen.querySelector('.screen-scroll') || screen;
    scroll.addEventListener('touchstart', onTouchStart, { passive: true });
    scroll.addEventListener('touchmove',  onTouchMove,  { passive: false });
    scroll.addEventListener('touchend',   onTouchEnd,   { passive: true });
  });
})();
//#endregion

//#region Section Collapse
(function initSectionCollapse() {
  // Persiste estado aberto/fechado entre renders
  const sectionState = { now: true, later: true, ideas: true };

  const sections = [
    { key: 'now',   headerId: 'sec-now',   listId: 'list-now',   emptyId: 'empty-now',   chevronId: 'sec-now-chevron' },
    { key: 'later', headerId: 'sec-later', listId: 'list-later', emptyId: 'empty-later', chevronId: 'sec-later-chevron' },
    { key: 'ideas', headerId: 'toggle-ideas', listId: 'list-ideas', emptyId: null,        chevronId: 'chevron-ideas' },
  ];

  function animateCollapse(list, empty, open) {
    // Mede a altura real do conteúdo
    const targets = [list, empty].filter(Boolean);

    targets.forEach(el => {
      if (open) {
        // Abre: define altura atual como 0 → altura real
        el.style.display  = '';
        const h = el.scrollHeight;
        el.style.overflow = 'hidden';
        el.style.height   = '0px';
        // Força reflow
        void el.offsetHeight;
        el.style.transition = 'height 0.26s cubic-bezier(0.4,0,0.2,1)';
        el.style.height     = h + 'px';
        el.addEventListener('transitionend', () => {
          el.style.height     = '';
          el.style.overflow   = '';
          el.style.transition = '';
        }, { once: true });
      } else {
        // Fecha: altura real → 0
        el.style.overflow   = 'hidden';
        el.style.height     = el.scrollHeight + 'px';
        void el.offsetHeight;
        el.style.transition = 'height 0.22s cubic-bezier(0.4,0,0.2,1)';
        el.style.height     = '0px';
        el.addEventListener('transitionend', () => {
          el.style.display    = 'none';
          el.style.height     = '';
          el.style.overflow   = '';
          el.style.transition = '';
        }, { once: true });
      }
    });
  }

  function toggle(key) {
    sectionState[key] = !sectionState[key];
    applyState(key);
  }

  function applyState(key) {
    const cfg     = sections.find(s => s.key === key);
    if (!cfg) return;
    const open    = sectionState[key];
    const list    = document.getElementById(cfg.listId);
    const empty   = cfg.emptyId ? document.getElementById(cfg.emptyId) : null;
    const chevron = document.getElementById(cfg.chevronId);

    if (!list) return;

    // Chevron
    if (chevron) chevron.classList.toggle('open', open);

    animateCollapse(list, empty?.classList.contains('hidden') ? null : empty, open);
  }

  // Aplica estado inicial (sem animação) após o primeiro render
  function applyInitial() {
    sections.forEach(({ key, listId, emptyId, chevronId }) => {
      const open    = sectionState[key];
      const list    = document.getElementById(listId);
      const empty   = emptyId ? document.getElementById(emptyId) : null;
      const chevron = document.getElementById(chevronId);

      if (chevron) chevron.classList.toggle('open', open);
      if (!open) {
        if (list)  list.style.display  = 'none';
        if (empty) empty.style.display = 'none';
      }
    });
  }

  // Registra cliques nos headers
  function bindHeaders() {
    sections.forEach(({ key, headerId, chevronId }) => {
      const header = document.getElementById(headerId);
      if (!header) return;
      if (header._collapsebound) return;
      header._collapsebound = true;
      header.style.cursor = 'pointer';
      header.addEventListener('click', (e) => {
        if (e.target.closest('.task-card, .subtask-item, .mission-task-card')) return;
        toggle(key);
      });
    });
  }

  // Expõe para ser chamado após cada renderToday()
  window.initSectionCollapseBindings = function () {
    bindHeaders();
    applyInitial();
  };
})();
//#endregion

//#region Criação & Edição (Tasks & Categorias)
function openAddTask(prefillDate) {
  _editTaskId  = null;
  _newTaskType = 'task';
  state._newTaskImp = 'Obrigatório';
  state._newTaskCat = state.categories[0]?.id || null;

  document.getElementById('task-title-input').value           = '';
  document.getElementById('task-due-date').value              = prefillDate || todayISO();
  document.getElementById('task-time').value                  = '';   // ← vazio; usuário define se quiser
  document.getElementById('task-repeat').value                = 'none';
  document.getElementById('task-energy').value                = 'medium';
  document.getElementById('task-notes').value                 = '';
  document.getElementById('notes-char-count').textContent     = '0';
  document.getElementById('task-sheet-title').textContent     = 'Nova Tarefa';

  // Reset tipo
  document.querySelectorAll('#task-type-toggle .task-type-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.type === 'task'));
  document.getElementById('task-type-mission-hint')?.classList.add('hidden');

  document.querySelectorAll('.imp-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.imp === 'Obrigatório'));

  renderCategoryPillsInSheet();
  resetRemindPickers();   // também zera _remindVal, _insistentOn etc.
  openSheet('add-task-sheet');
  setTimeout(() => document.getElementById('task-title-input').focus(), 320);
}

function openEditTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  _editTaskId  = id;
  _newTaskType = task.type === 'mission' ? 'mission' : 'task';
  state._newTaskImp = task.importance;
  state._newTaskCat = task.catId;

  document.getElementById('task-title-input').value = task.title;
  document.getElementById('task-due-date').value    = task.dueDate   || todayISO();
  document.getElementById('task-time').value = task.taskTime || nowTimeStr();
  document.getElementById('task-repeat').value      = task.repeat    || 'none';
  document.getElementById('task-energy').value      = task.energy    || 'medium';
  document.getElementById('task-notes').value       = task.notes     || '';
  document.getElementById('notes-char-count').textContent = (task.notes || '').length;
  document.getElementById('task-sheet-title').textContent = 'Editar Tarefa';

  // Tipo
  document.querySelectorAll('#task-type-toggle .task-type-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.type === _newTaskType));
  document.getElementById('task-type-mission-hint')
    ?.classList.toggle('hidden', _newTaskType !== 'mission');

  document.querySelectorAll('.imp-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.imp === task.importance));

  renderCategoryPillsInSheet();
  restoreRemindPickers(task);
  openSheet('add-task-sheet');
  setTimeout(() => document.getElementById('task-title-input').focus(), 320);
}

function renderCategoryPillsInSheet() {
  const c = document.getElementById('cat-pills'); if (!c) return;
  c.innerHTML = '';
  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `cat-pill-sel${state._newTaskCat === cat.id ? ' active' : ''}`;
    btn.textContent = cat.name;
    btn.onclick = () => {
      state._newTaskCat = cat.id;
      c.querySelectorAll('.cat-pill-sel').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    c.appendChild(btn);
  });
}

function saveTask() {
  const rawTitle = document.getElementById('task-title-input').value.trim();
  if (!rawTitle) return;

  const parsed   = parseQuickInput(rawTitle);
  const catId    = parsed.catId || state._newTaskCat || state.categories[0]?.id;
  const imp      = parsed.importance || state._newTaskImp || 'Padrão';
  const dueDate  = document.getElementById('task-due-date').value || todayISO();

  // ── Hora: lê o campo; se vazio salva null (não força hora atual) ──
  const taskTimeRaw = document.getElementById('task-time').value;
  const taskTime    = taskTimeRaw && taskTimeRaw.trim() !== '' ? taskTimeRaw.trim() : null;

  const repeat = document.getElementById('task-repeat').value;
  const energy = document.getElementById('task-energy').value;
  const notes  = document.getElementById('task-notes').value.trim();

  // ── Lembrete antecipado ──
  const remindBefore     = _remindVal === 'none' ? null : _remindVal;
  const remindBeforeDays = _remindVal === 'custom' ? (_remindCustom || 1) : null;
  const remindDate       = calcRemindDate(dueDate, remindBefore, remindBeforeDays);

  // ── Modo insistente ──
  const insistent    = _insistentOn;
  const insistentMin = insistent ? (_insistentMin || 5) : null;

  // ── Tipo: missões são salvas como 'task' e convertidas logo abaixo ──
  const isMission = _newTaskType === 'mission';

  const task = {
    id:              _editTaskId || uid(),
    type:            'task',          // sempre 'task' aqui; convertToMission muda depois
    title:           parsed.title || rawTitle,
    notes,
    catId,
    importance:      imp,
    dueDate,
    taskTime,                         // ← campo correto (era estimateMinutes: taskTime)
    estimateMinutes: null,            // preenchido pela expansão da missão, não pelo form
    repeat,
    energy,
    status:          'todo',
    createdAt:       Date.now(),
    xpEarned:        0,
    lastCompleted:   null,
    remindBefore,
    remindBeforeDays,
    remindDate,
    insistent,
    insistentMin,
  };

  if (_editTaskId) {
    clearInsistent(_editTaskId);
    const idx = state.tasks.findIndex(t => t.id === _editTaskId);
    if (idx > -1) state.tasks[idx] = { ...state.tasks[idx], ...task };
  } else {
    state.tasks.unshift(task);
    addTimelineItem('fa-solid fa-circle-plus', `Tarefa: ${task.title}`);
  }

  if (insistent) scheduleInsistent(task);

  save();
  // ── Bridge: agenda alarme se tarefa tem horário definido ──
  if (taskTime) {
    const [h, m] = taskTime.split(':').map(Number);
    const dt = new Date(`${dueDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
    if (dt.getTime() > Date.now()) {
      NativeBridge.scheduleAlarm(task.id, task.title, dt.getTime(), repeat);
    }
  }

  // ── Bridge: se foi edição, cancela alarme antigo antes de reagendar ──
  if (_editTaskId) NativeBridge.cancelAlarm(_editTaskId);

  closeSheet('add-task-sheet');

  // ── Missão: converte APÓS salvar (task já está no state como 'task') ──
  if (isMission && !_editTaskId) {
    convertToMission(task.id);
    return;
  }

  renderAll();
}

function openAddCat() {
  // Garante defaults antes de abrir o sheet
  state._newCatColor = CAT_COLORS[0];
  state._newCatIcon  = CAT_FA_ICONS[0].icon;

  document.getElementById('cat-name-input').value = '';
  renderColorPicker();
  renderIconPicker();
  openSheet('add-cat-sheet');
}

function renderColorPicker() {
  const cp = document.getElementById('color-picker'); if (!cp) return;
  cp.innerHTML = '';
  CAT_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = `color-swatch${state._newCatColor === c ? ' active' : ''}`;
    sw.style.background = c;
    sw.onclick = () => { state._newCatColor = c; cp.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active')); sw.classList.add('active'); };
    cp.appendChild(sw);
  });
}

function renderIconPicker() {
  const ip = document.getElementById('icon-picker'); if (!ip) return;
  ip.innerHTML = '';
  CAT_FA_ICONS.forEach(({ icon }) => {
    const btn = document.createElement('div');
    btn.className = `icon-option${state._newCatIcon === icon ? ' active' : ''}`;
    btn.innerHTML = `<i class="${icon}" style="font-size:15px;color:var(--text-sec);"></i>`;
    btn.onclick = () => { state._newCatIcon = icon; ip.querySelectorAll('.icon-option').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); };
    ip.appendChild(btn);
  });
}

function saveCat() {
  const name = document.getElementById('cat-name-input').value.trim();
  if (!name) return;

  if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showSnackbar('Já existe uma categoria com esse nome.');
    return;
  }

  const icon  = state._newCatIcon  || CAT_FA_ICONS[0].icon;
  const color = state._newCatColor || CAT_COLORS[0];

  state.categories.push({ id: `cat_${Date.now()}`, name, icon, color });

  save();
  closeSheet('add-cat-sheet');
  renderAll();
}
//#endregion

//#region Render Geral
function renderAll() {
  const tab = state.activeTab;
  if (tab === 'today')        renderToday();
  if (tab === 'plan')         renderPlan();
  if (tab === 'focus')        renderFocusTaskSelect();
  if (tab === 'missions')     renderMissions();
  if (tab === 'achievements') renderAchievements();
  if (tab === 'timeline')     renderTimeline();
  if (tab === 'settings')     renderSettings();
  if (tab === 'seasonal') renderSeasonalCalendar();
  NativeBridge.syncAll();
}
//#endregion

//#region Resumo Diário
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function showDaySummary(date) {
  const key   = date || todayKey();
  const panel = document.getElementById('ds-cards');
  if (!panel) return;

  // Esqueleto de carregamento
  panel.innerHTML = Array(4).fill(0).map(() => `
    <div class="ds-card ds-card--loading">
      <span class="ds-card-label">···</span>
      <span class="ds-card-val">—</span>
    </div>`).join('');
  document.getElementById('day-summary').classList.remove('hidden');

  try {
    const token = getToken();
    const res   = await fetch(`/api/day-summary?date=${key}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const items = [
      { label: 'XP Ganhos',          val: data.xp },
      { label: 'Tarefas Concluídas', val: data.completed },
      { label: 'Sessões de Foco',    val: data.focusSessions },
      { label: 'Streak Atual',       val: `${data.streak} dias` },
    ];

    panel.innerHTML = '';
    items.forEach((d, i) => {
      const card = document.createElement('div');
      card.className = 'ds-card';
      card.style.cssText = 'opacity:0; transform:translateY(18px)';
      card.innerHTML = `<span class="ds-card-label">${d.label}</span>
                        <span class="ds-card-val">${d.val}</span>`;
      panel.appendChild(card);
      gsap.to(card, { opacity:1, y:0, delay:0.25 + i*0.12, duration:0.35, ease:'power2.out' });
    });

  } catch (err) {
    console.error('[showDaySummary]', err);
    panel.innerHTML = `<p style="color:var(--danger);padding:1rem">Erro ao carregar resumo.</p>`;
  }
}

window.__testDaySummary = async function(date) {
  const key = date || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  await showDaySummary(key);
};

//#endregion

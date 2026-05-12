/* ─────────────────────────────────────────────────────────
   desktop-bridge.js  —  v3
   Carregado DEPOIS de todos os outros scripts (último <script>).
   Estratégia: wraps feitos no DOMContentLoaded (scripts já
   parseados), populate feito APÓS launchApp terminar (async).
───────────────────────────────────────────────────────── */
(function () {

  const IS_DESKTOP = () => window.innerWidth > 768;

  /* ══════════════════════════════════════════════════════
     IDs reais do HTML desktop — mapeamento explícito
  ══════════════════════════════════════════════════════ */
  const IDS = {
    // sidebar
    sidebarAvatar:  'sidebar-avatar',
    sidebarName:    'sidebar-profile-name',
    sidebarLevel:   'sidebar-profile-level',
    streakCount:    'streak-count',
    xpFill:         'sidebar-xp-fill',
    // painel today
    tsXP:           'ts-xp',
    tsDone:         'ts-done',
    tsStreak:       'ts-streak',
    tsLevel:        'ts-level',
    missionsMini:   'today-missions-mini',
    // nav
    bottomNav:      'bottom-nav',
    app:            'app',
    fabAdd:         'fab-add',
  };

  function el(id) { return document.getElementById(id); }
  function setText(id, val) { const e = el(id); if (e) e.textContent = val; }

  /* ══════════════════════════════════════════════════════
     1. WRAPS — feitos assim que os scripts estão parseados
        (DOMContentLoaded garante isso pois este arquivo é
        o último <script> síncrono do body)
  ══════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {

    /* ── 1a. Wrap launchApp ────────────────────────────
       Espera o original terminar (é async) e só então
       limpa side-effects mobile + popula UI desktop.    */
    const _origLaunch = window.launchApp;
    window.launchApp = async function (primeiraintecao = false) {
      await _origLaunch.call(this, primeiraintecao);
      if (!IS_DESKTOP()) return;

      /* Desfaz o bottom-nav que launchApp força visível */
      const nav = el(IDS.bottomNav);
      if (nav) { nav.classList.add('hidden'); nav.style.display = ''; }

      /* Desfaz app.style.bottom injetado por switchTab */
      const app = el(IDS.app);
      if (app) app.style.bottom = '';

      /* Popula tudo agora que state está pronto */
      updateDesktopUI();
    };

    /* ── 1b. Wrap switchTab ────────────────────────────
       Remove side-effects mobile pós-chamada.           */
    const _origSwitch = window.switchTab;
    window.switchTab = function (tab) {
      _origSwitch.call(this, tab);
      if (!IS_DESKTOP()) return;

      const nav = el(IDS.bottomNav);
      const app = el(IDS.app);
      if (nav) { nav.classList.add('hidden'); nav.style.display = ''; }
      if (app) app.style.bottom = '';

      syncSidebarActive(tab);
      if (tab === 'today') updateDesktopUI();
    };

    /* ── 1c. Wrap renderAll ────────────────────────────
       Qualquer re-render (completar tarefa, salvar…)
       mantém painel e sidebar sincronizados.            */
    const _origRenderAll = window.renderAll;
    if (typeof _origRenderAll === 'function') {
      window.renderAll = function () {
        _origRenderAll.call(this);
        if (IS_DESKTOP()) updateDesktopUI();
      };
    }

    /* ── 1d. Cliques na sidebar ────────────────────────*/
    document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof switchTab === 'function') switchTab(btn.dataset.tab);
      });
    });

    /* ── 1e. FAB desktop — bloqueia hold, abre sheet ── */
    const fab = el(IDS.fabAdd);
    if (fab) {
      /* Stoppa mousedown/touchstart antes do voice.js receber */
      fab.addEventListener('mousedown',  e => e.stopPropagation(), true);
      fab.addEventListener('touchstart', e => e.stopPropagation(),
        { capture: true, passive: false });
      fab.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof openAddTask === 'function') openAddTask();
      }, true);
    }

  }); /* fim DOMContentLoaded */

  /* ══════════════════════════════════════════════════════
     2. POPULATE — lê state e escreve nos elementos reais
  ══════════════════════════════════════════════════════ */
  function updateDesktopUI() {
    const s = window.state;
    if (!s) return;

    /* ── Sidebar ─────────────────────────────────────── */
    const name = s.userName || '';
    setText(IDS.sidebarName,  name);
    setText(IDS.sidebarLevel, `Nível ${s.level ?? 1}`);
    setText(IDS.streakCount,  s.streak ?? 0);

    const av = el(IDS.sidebarAvatar);
    if (av && name) av.textContent = name[0].toUpperCase();

    /* XP progress bar */
    const lvl    = s.level ?? 1;
    const needed = typeof xpForLevel === 'function' ? xpForLevel(lvl)     : 1000;
    const prev   = typeof xpForLevel === 'function' && lvl > 1
                   ? xpForLevel(lvl - 1) : 0;
    const range  = (needed - prev) || 1;
    const pct    = Math.min(100, Math.round(((s.totalXP - prev) / range) * 100));
    const fill   = el(IDS.xpFill);
    if (fill) fill.style.width = pct + '%';

    /* ── Stat cards (painel Today) ───────────────────── */
    const today = typeof todayISO === 'function'
      ? todayISO()
      : new Date().toISOString().split('T')[0];

    const todayDone = (s.tasks || []).filter(
      t => t.status === 'done' && t.lastCompleted === today
    ).length;

    setText(IDS.tsXP,     s.todayXP  ?? 0);
    setText(IDS.tsDone,   todayDone);
    setText(IDS.tsStreak, s.streak   ?? 0);
    setText(IDS.tsLevel,  s.level    ?? 1);

    /* ── Mini missões ────────────────────────────────── */
    renderMissionsMini(s);

    /* ── Sincroniza sidebar active ───────────────────── */
    syncSidebarActive(s.activeTab);
  }

  /* ── Missões mini no painel lateral ─────────────────── */
  function renderMissionsMini(s) {
    const container = el(IDS.missionsMini);
    if (!container) return;

    const missions = (s.missions || []).slice(0, 4);
    if (!missions.length) {
      container.innerHTML =
        '<p style="font-size:12px;color:var(--text-muted);padding:4px 0 2px;">Nenhuma missão ativa.</p>';
      return;
    }

    container.innerHTML = missions.map(m => {
      const pct   = m.target > 0
        ? Math.min(100, Math.round((m.progress / m.target) * 100)) : 0;
      const color = m.done ? 'var(--accent-teal)' : 'var(--accent)';
      const txtColor = m.done ? 'var(--accent-teal)' : 'var(--text-sec)';
      const title = typeof escHtml === 'function' ? escHtml(m.title) : m.title;

      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:700;color:${txtColor};
              flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${title}
            </span>
            <span style="font-size:10px;font-family:'Rajdhani',sans-serif;
              font-weight:700;color:${color};flex-shrink:0;">
              +${m.xp} XP
            </span>
          </div>
          <div style="height:3px;background:var(--bg-primary);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};
              border-radius:2px;transition:width .3s;"></div>
          </div>
          <div style="font-size:10px;margin-top:3px;color:${m.done ? 'var(--accent-teal)' : 'var(--text-muted)'};">
            ${m.done ? '✓ Concluída' : `${m.progress}/${m.target}`}
          </div>
        </div>`;
    }).join('');
  }

  /* ── Sidebar: marca botão ativo ──────────────────────── */
  function syncSidebarActive(activeTab) {
    const tab = activeTab ?? window.state?.activeTab;
    if (!tab) return;
    document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
  }

  /* Expõe para uso externo se necessário */
  window._desktopUpdateUI = updateDesktopUI;

})();
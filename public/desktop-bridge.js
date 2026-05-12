/* ═══════════════════════════════════════════════════════════════
   desktop-bridge.js  —  v2
   Ativa todos os elementos do layout desktop sem modificar os
   arquivos existentes. Carregado DEPOIS de todos os outros scripts.
═══════════════════════════════════════════════════════════════ */
(function desktopBridge() {

  /* ─── Só roda em desktop ─────────────────────────────────── */
  const IS_DESKTOP = () => window.innerWidth > 768;

  /* ══════════════════════════════════════════════════════════
     1. SIDEBAR — cliques disparam switchTab
     ══════════════════════════════════════════════════════════ */
  function bindSidebar() {
    document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
      if (btn._desktopBound) return;
      btn._desktopBound = true;
      btn.addEventListener('click', () => {
        if (typeof switchTab === 'function') switchTab(btn.dataset.tab);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     2. ESPELHA estado .active da sidebar
        Observer no bottom-nav detecta mudanças do switchTab()
        original e replica na sidebar.
     ══════════════════════════════════════════════════════════ */
  function syncSidebarActive(tab) {
    const activeTab = tab
      ?? document.querySelector('.nav-btn.active[data-tab]')?.dataset?.tab
      ?? window.state?.activeTab;
    if (!activeTab) return;
    document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });
    /* Sidebar badges — missões */
    syncSidebarBadges();
  }

  function syncSidebarBadges() {
    /* Replica badges do menu-sheet para a sidebar */
    [
      { src: 'menu-missions-badge', dst: '.sidebar-btn[data-tab="missions"] .sidebar-badge' },
      { src: 'menu-empresa-badge',  dst: '.sidebar-btn[data-tab="empresa"] .sidebar-badge'  },
    ].forEach(({ src, dst }) => {
      const srcEl = document.getElementById(src);
      const dstEl = document.querySelector(dst);
      if (!srcEl || !dstEl) return;
      dstEl.textContent = srcEl.textContent;
      dstEl.classList.toggle('hidden', srcEl.classList.contains('hidden'));
    });
  }

  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    new MutationObserver(() => syncSidebarActive())
      .observe(bottomNav, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /* ══════════════════════════════════════════════════════════
     3. PATCH switchTab — corrige estilos inline no desktop
        e sincroniza sidebar após cada troca de aba.
     ══════════════════════════════════════════════════════════ */
  const _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab === 'function') {
    window.switchTab = function (tab) {
      _origSwitchTab(tab);

      if (IS_DESKTOP()) {
        const app    = document.getElementById('app');
        const nav    = document.getElementById('bottom-nav');
        if (app) app.style.bottom = '';     // remove bottom inline
        if (nav) nav.style.display = '';    // deixa CSS decidir (será hidden)
        syncSidebarActive(tab);
        updateSidebarProfile();
      }
    };
  }

  /* ══════════════════════════════════════════════════════════
     4. PATCH renderToday — garante que os IDs que só existem
        no HTML mobile não quebrem no desktop, e depois
        atualiza o painel lateral com os dados corretos.
     ══════════════════════════════════════════════════════════ */

  /* Cria elementos-fantasma invisíveis para os IDs mobile que
     renderToday() tenta acessar mas não existem no desktop.
     Assim o JS original não joga erros e o DOM fica limpo.    */
  const MOBILE_ONLY_IDS = [
    'h-greeting', 'h-name', 'h-avatar', 'streak-count',
  ];

  function ensureGhostElements() {
    if (!IS_DESKTOP()) return;
    const ghost = document.getElementById('_desktop-ghost-pool')
      ?? (() => {
        const d = document.createElement('div');
        d.id = '_desktop-ghost-pool';
        d.style.cssText = 'display:none!important;position:absolute;pointer-events:none;';
        document.body.appendChild(d);
        return d;
      })();

    MOBILE_ONLY_IDS.forEach(id => {
      if (!document.getElementById(id)) {
        const el = document.createElement('span');
        el.id = id;
        ghost.appendChild(el);
      }
    });
  }

  const _origRenderToday = window.renderToday;
  if (typeof _origRenderToday === 'function') {
    window.renderToday = function () {
      if (IS_DESKTOP()) ensureGhostElements();
      _origRenderToday();
      if (IS_DESKTOP()) {
        updateTodayPanel();
        /* Espelha os valores que renderToday() escreveu nos
           fantasmas para os elementos reais da sidebar/desktop */
        mirrorMobileToDesktop();
      }
    };
  }

  /* Lê o que renderToday() escreveu nos IDs mobile e
     replica nos elementos visíveis do layout desktop.        */
  function mirrorMobileToDesktop() {
    if (!window.state) return;

    /* Saudação + nome no header desktop */
    const greeting = document.getElementById('h-greeting')?.textContent ?? '';
    const name     = document.getElementById('h-name')?.textContent     ?? state.userName ?? '';

    /* Header desktop: .greeting-sub e .greeting-name */
    const greetEl = document.querySelector('#screen-today .greeting-sub');
    const nameEl  = document.querySelector('#screen-today .greeting-name');
    if (greetEl) greetEl.textContent = greeting;
    if (nameEl)  nameEl.textContent  = name;

    /* Avatar mini no header (se existir no desktop) */
    const avatarMini = document.getElementById('h-avatar');
    if (avatarMini && state.userName)
      avatarMini.textContent = state.userName[0].toUpperCase();

    /* Streak pill no header */
    const streakEl = document.getElementById('h-streak');
    const streakCount = document.getElementById('streak-count');
    if (streakEl && streakCount)
      streakCount.textContent = state.streak ?? 0;
  }

  /* ══════════════════════════════════════════════════════════
     5. PATCH renderMissions — atualiza badge da sidebar
     ══════════════════════════════════════════════════════════ */
  const _origRenderMissions = window.renderMissions;
  if (typeof _origRenderMissions === 'function') {
    window.renderMissions = function () {
      _origRenderMissions();
      if (IS_DESKTOP()) {
        syncSidebarBadges();
        renderMissionsMini();
      }
    };
  }

  /* ══════════════════════════════════════════════════════════
     6. PAINEL LATERAL TODAY — stats + mini-missões
     ══════════════════════════════════════════════════════════ */
  function updateTodayPanel() {
    if (!window.state) return;

    /* Tarefas concluídas hoje */
    const today     = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().split('T')[0];
    const todayDone = (state.tasks || []).filter(
      t => t.status === 'done' && t.lastCompleted === today
    ).length;

    setElText('ts-xp',     state.todayXP      ?? 0);
    setElText('ts-done',   todayDone);
    setElText('ts-streak', state.streak        ?? 0);
    setElText('ts-level',  state.level         ?? 1);

    updateSidebarProfile();
    renderMissionsMini();
    syncSidebarBadges();
  }

  function updateSidebarProfile() {
    if (!window.state) return;

    /* XP bar */
    const needed = typeof xpForLevel === 'function' ? xpForLevel(state.level ?? 1) : 1000;
    const prev   = (state.level > 1 && typeof xpForLevel === 'function')
      ? xpForLevel((state.level ?? 1) - 1) : 0;
    const range  = Math.max(1, needed - prev);
    const pct    = Math.min(100, Math.round(((state.totalXP - prev) / range) * 100));

    const fill = document.getElementById('sidebar-xp-fill');
    if (fill) fill.style.width = pct + '%';

    /* Nome, nível, avatar */
    setElText('sidebar-profile-name',  state.userName ?? '');
    setElText('sidebar-profile-level', `Nível ${state.level ?? 1}`);

    const av = document.getElementById('sidebar-avatar');
    if (av && state.userName) av.textContent = state.userName[0].toUpperCase();

    /* Streak pill */
    const sc = document.getElementById('streak-count');
    if (sc) sc.textContent = state.streak ?? 0;
  }

  function renderMissionsMini() {
    const el = document.getElementById('today-missions-mini');
    if (!el || !window.state?.missions) return;

    const missions = state.missions.slice(0, 3);
    if (!missions.length) {
      el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:4px 0;">Nenhuma missão ativa.</p>';
      return;
    }

    el.innerHTML = missions.map(m => {
      const pct = m.target > 0 ? Math.min(100, Math.round((m.progress / m.target) * 100)) : 0;
      const titleSafe = typeof escHtml === 'function' ? escHtml(m.title) : m.title;
      const color = m.done ? 'var(--accent-teal)' : 'var(--accent)';
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">
            <span style="font-size:12px;font-weight:700;color:${m.done ? 'var(--accent-teal)' : 'var(--text-sec)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">
              ${titleSafe}
            </span>
            <span style="font-size:10px;color:${color};font-family:'Rajdhani',sans-serif;font-weight:700;flex-shrink:0;">
              +${m.xp} XP
            </span>
          </div>
          <div style="height:4px;background:var(--bg-card2,#1a1a24);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width .3s;"></div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">
            ${m.done ? '✓ Concluída' : `${m.progress} / ${m.target}`}
          </div>
        </div>`;
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════
     7. FABs E BOTÕES DO PAINEL LATERAL
     ══════════════════════════════════════════════════════════ */
  function bindPanelButtons() {
    /* #fab-add — Nova tarefa (painel lateral today) */
    const fabAdd = document.getElementById('fab-add');
    if (fabAdd && !fabAdd._desktopBound) {
      fabAdd._desktopBound = true;
      /* No desktop: clique simples abre o sheet diretamente,
         ignorando o hold/voice do voice.js (capture: true) */
      fabAdd.addEventListener('click', (e) => {
        if (!IS_DESKTOP()) return;
        /* Só age se NÃO vier do hold-ring do voice.js */
        if (e.target.closest('.fab-hold-ring')) return;
        e.stopPropagation();
        if (typeof openAddTask === 'function') openAddTask();
      }, true);
    }

    /* #plan-add-cat — Nova categoria (painel lateral today) */
    const catBtn = document.getElementById('plan-add-cat');
    if (catBtn && !catBtn._desktopBound) {
      catBtn._desktopBound = true;
      catBtn.addEventListener('click', () => {
        if (typeof openAddCat === 'function') openAddCat();
      });
    }

    /* #fab-plan-add — Nova tarefa (header da aba Planejar) */
    const fabPlan = document.getElementById('fab-plan-add');
    if (fabPlan && !fabPlan._desktopBound) {
      fabPlan._desktopBound = true;
      fabPlan.addEventListener('click', () => {
        if (!window.state) return;
        const date = state.planView === 'tomorrow'
          ? (typeof tomorrowISO === 'function' ? tomorrowISO() : null)
          : (typeof todayISO === 'function'    ? todayISO()    : null);
        if (typeof openAddTask === 'function') openAddTask(date);
      });
    }
  }

  /* ══════════════════════════════════════════════════════════
     8. HEADER DESKTOP — esconde botão de menu mobile,
        garante que o avatar do header aponta para settings
     ══════════════════════════════════════════════════════════ */
  function adjustDesktopHeader() {
    if (!IS_DESKTOP()) return;

    /* Esconde botão hamburguer/avatar do header mobile */
    const openMenuBtn = document.getElementById('open-menu');
    if (openMenuBtn) openMenuBtn.style.display = 'none';

    /* Esconde bottom-nav completamente no desktop */
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.add('hidden');
  }

  /* ══════════════════════════════════════════════════════════
     9. SETTINGS — garante que os campos refletem state
        quando a aba é aberta pela sidebar
     ══════════════════════════════════════════════════════════ */
  function patchSettingsTab() {
    /* renderSettings já existe no app.js — só garantimos que
       é chamado quando o switchTab('settings') roda via sidebar */
    /* Já coberto pelo patch do switchTab acima */

    /* Botão "Sair da conta" — já está no Inicializacao.js,
       mas o #reset-btn precisa estar acessível; não duplicamos. */
  }

  /* ══════════════════════════════════════════════════════════
     10. SWIPE NAV — desativa no desktop (não faz sentido)
     ══════════════════════════════════════════════════════════ */
  function disableSwipeNavOnDesktop() {
    if (!IS_DESKTOP()) return;
    /* O swipe nav do app.js usa touchstart/touchmove no .screen-scroll.
       No desktop, mouse events não disparam touch, então não é necessário
       desativar — mas bloqueamos qualquer tentativa de pointer events
       que possam causar side effects. */
    document.documentElement.classList.add('is-desktop');
  }

  /* ══════════════════════════════════════════════════════════
     11. RESIZE — readapta ao redimensionar janela
     ══════════════════════════════════════════════════════════ */
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (IS_DESKTOP()) {
        adjustDesktopHeader();
        const app = document.getElementById('app');
        if (app) app.style.bottom = '';
        const nav = document.getElementById('bottom-nav');
        if (nav) nav.classList.add('hidden');
        syncSidebarActive();
        updateTodayPanel();
      } else {
        /* Voltou para mobile — remove classe e deixa CSS/JS original agir */
        document.documentElement.classList.remove('is-desktop');
      }
    }, 120);
  });

  /* ══════════════════════════════════════════════════════════
     12. INICIALIZAÇÃO — roda após o DOM + scripts estarem prontos
     ══════════════════════════════════════════════════════════ */
  function boot() {
    bindSidebar();
    bindPanelButtons();
    adjustDesktopHeader();
    disableSwipeNavOnDesktop();

    if (IS_DESKTOP()) {
      syncSidebarActive();
      updateTodayPanel();

      /* Garante estado inicial correto da tab "today" */
      const active = window.state?.activeTab ?? 'today';
      syncSidebarActive(active);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    /* Scripts já carregados — aguarda um tick para que o init() do
       Inicializacao.js também já tenha rodado */
    setTimeout(boot, 0);
  } else {
    window.addEventListener('load', boot);
  }

  /* ══════════════════════════════════════════════════════════
     13. EXPOSIÇÃO GLOBAL (útil para renderAll e outros pontos)
     ══════════════════════════════════════════════════════════ */
  window._desktopUpdatePanel  = updateTodayPanel;
  window._desktopSyncSidebar  = syncSidebarActive;
  window._desktopUpdateBadges = syncSidebarBadges;

  /* ─── Helper ───────────────────────────────────────────── */
  function setElText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

})();
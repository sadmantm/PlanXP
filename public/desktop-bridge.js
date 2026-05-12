/* ─────────────────────────────────────────────────────────
   desktop-bridge.js
   Ponte entre o switchTab() mobile-original e a sidebar desktop.
   Não modifica nenhuma função existente — apenas observa e espelha.
   Cole este bloco no final de Inicializacao.js (ou num arquivo
   separado carregado DEPOIS de app.js).
───────────────────────────────────────────────────────── */
(function desktopBridge() {

  /* ── 1. Cliques na sidebar disparam switchTab ── */
  document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (typeof switchTab === 'function') switchTab(tab);
    });
  });

  /* ── 2. Espelha o estado .active da sidebar ─────
     switchTab() só adiciona .active em .nav-btn[data-tab].
     Usamos um MutationObserver no #bottom-nav para detectar
     essa mudança e replicar na sidebar imediatamente.        */
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    const observer = new MutationObserver(() => syncSidebarActive());
    observer.observe(bottomNav, { subtree: true, attributeFilter: ['class'], attributes: true });
  }

  /* Também chama uma vez na inicialização, após DOM pronto */
  if (document.readyState === 'complete') {
    syncSidebarActive();
  } else {
    window.addEventListener('load', syncSidebarActive);
  }

  function syncSidebarActive() {
    /* Descobre qual tab está ativa pelo estado atual das .nav-btn */
    const activeNavBtn = document.querySelector('.nav-btn.active[data-tab]');
    const activeTab    = activeNavBtn?.dataset?.tab ?? state?.activeTab;
    if (!activeTab) return;

    document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });
  }

  /* ── 3. Patch do switchTab para desktop ─────────
     No desktop não queremos que o JS mexa em app.style.bottom
     nem mostre o bottom-nav. Fazemos um wrapper silencioso:     */
  const _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab === 'function') {
    window.switchTab = function(tab) {
      _origSwitchTab(tab);           // executa tudo normalmente

      /* Pós-hook: corrige o bottom no desktop */
      if (window.innerWidth > 768) {
        const app       = document.getElementById('app');
        const bottomNav = document.getElementById('bottom-nav');
        if (app)       app.style.bottom       = '';   // remove o inline style
        if (bottomNav) bottomNav.style.display = '';  // deixa o CSS decidir
        syncSidebarActive();
      }
    };
  }

  /* ── 4. Ajuste do voice-sheet / FAB no desktop ──
     O voice.js busca #fab-add e adiciona listeners de hold.
     No desktop o FAB é um <button class="btn-primary"> injetado
     no painel lateral — o hold não faz sentido; o clique simples
     deve abrir o add-task-sheet diretamente.                    */
  if (window.innerWidth > 768) {
    const fab = document.getElementById('fab-add');
    if (fab) {
      /* Remove eventos de touch/hold que o voice.js vai adicionar
         e substitui por clique direto */
      fab.addEventListener('click', (e) => {
        /* Só age se não for o FAB mobile (que tem .fa-plus/.fa-microphone) */
        if (!fab.querySelector('.fab-hold-ring')) {
          e.stopPropagation();
          if (typeof openAddTask === 'function') openAddTask();
        }
      }, true); /* capture: true para rodar antes do handler do voice.js */
    }
  }

  /* ── 5. stats do painel lateral (Today) ────────
     Atualiza os 4 números do painel direito toda vez
     que renderToday() for chamado.                            */
  const _origRenderToday = window.renderToday;
  if (typeof _origRenderToday === 'function') {
    window.renderToday = function() {
      _origRenderToday();
      updateTodayPanel();
    };
  }

  function updateTodayPanel() {
    if (!window.state) return;
    const todayDone = state.tasks?.filter(t =>
      t.status === 'done' && t.lastCompleted === (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().split('T')[0])
    ).length ?? 0;

    setEl('ts-xp',     state.todayXP      ?? 0);
    setEl('ts-done',   todayDone);
    setEl('ts-streak', state.streak        ?? 0);
    setEl('ts-level',  state.level         ?? 1);

    /* XP bar na sidebar */
    const needed = typeof xpForLevel === 'function' ? xpForLevel(state.level) : 1000;
    const prev   = state.level > 1 && typeof xpForLevel === 'function' ? xpForLevel(state.level - 1) : 0;
    const pct    = Math.min(100, Math.round(((state.totalXP - prev) / (needed - prev)) * 100));
    const fill   = document.getElementById('sidebar-xp-fill');
    if (fill) fill.style.width = pct + '%';

    /* Nome/nível na sidebar */
    setEl('sidebar-profile-name', state.userName ?? '');
    setEl('sidebar-profile-level', `Nível ${state.level ?? 1}`);
    const av = document.getElementById('sidebar-avatar');
    if (av && state.userName) av.textContent = state.userName[0].toUpperCase();

    /* Streak na sidebar */
    const sc = document.getElementById('streak-count');
    if (sc) sc.textContent = state.streak ?? 0;

    /* Mini missões */
    renderMissionsMini();
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
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:700;color:${m.done ? 'var(--accent-teal)' : 'var(--text-sec)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;">
              ${escHtml ? escHtml(m.title) : m.title}
            </span>
            <span style="font-size:10px;color:var(--accent);font-family:'Rajdhani',sans-serif;font-weight:700;flex-shrink:0;margin-left:6px;">
              +${m.xp} XP
            </span>
          </div>
          <div style="height:4px;background:var(--bg-card2);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${m.done ? 'var(--accent-teal)' : 'var(--accent)'};border-radius:2px;transition:width .3s;"></div>
          </div>
        </div>`;
    }).join('');
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── Expõe updateTodayPanel globalmente (útil para renderAll) ── */
  window._desktopUpdatePanel = updateTodayPanel;

})();
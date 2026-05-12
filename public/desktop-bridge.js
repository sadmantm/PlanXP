/* ─────────────────────────────────────────────────────────
   desktop-bridge.js  —  v2
   Carregado DEPOIS de todos os outros scripts.
   Não modifica nenhuma função existente no lugar,
   apenas faz wraps pós-definição via window.addEventListener('load').
───────────────────────────────────────────────────────── */
window.addEventListener('load', function desktopBridge() {

  const IS_DESKTOP = window.innerWidth > 768;

  /* ══════════════════════════════════════════════════════
     1. CORRIGE launchApp — remove o .remove('hidden') do
        bottom-nav que o JS original força toda vez
  ══════════════════════════════════════════════════════ */
  const _origLaunchApp = window.launchApp;
  window.launchApp = async function(primeiraintecao = false) {
    await _origLaunchApp(primeiraintecao);

    if (IS_DESKTOP) {
      /* Desfaz o que launchApp fez no bottom-nav */
      const nav = document.getElementById('bottom-nav');
      if (nav) nav.style.display = 'none';

      /* Desfaz o app.style.bottom injetado por switchTab dentro de launchApp */
      const app = document.getElementById('app');
      if (app) app.style.bottom = '';

      /* Popula painel e sidebar logo após o app subir */
      updateDesktopUI();
    }
  };

  /* ══════════════════════════════════════════════════════
     2. WRAP switchTab — limpa os side-effects mobile
        e sincroniza a sidebar
  ══════════════════════════════════════════════════════ */
  const _origSwitchTab = window.switchTab;
  window.switchTab = function(tab) {
    _origSwitchTab(tab);

    if (IS_DESKTOP) {
      const app = document.getElementById('app');
      const nav = document.getElementById('bottom-nav');
      if (app) app.style.bottom = '';
      if (nav) nav.style.display = 'none';

      syncSidebarActive(tab);

      /* Atualiza painel lateral quando volta para Today */
      if (tab === 'today') updateDesktopUI();
    }
  };

  /* ══════════════════════════════════════════════════════
     3. WRAP renderToday — atualiza painel lateral
  ══════════════════════════════════════════════════════ */
  if (IS_DESKTOP) {
    const _origRenderToday = window.renderToday;
    if (typeof _origRenderToday === 'function') {
      window.renderToday = function() {
        _origRenderToday();
        updateDesktopUI();
      };
    }
  }

  /* ══════════════════════════════════════════════════════
     4. SIDEBAR — cliques e estado ativo
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  function syncSidebarActive(activeTab) {
    const tab = activeTab ?? window.state?.activeTab;
    if (!tab) return;
    document.querySelectorAll('.sidebar-btn[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
  }

  /* ══════════════════════════════════════════════════════
     5. FAB desktop — clique simples abre sheet direto
        (o voice.js adiciona hold; no desktop ignoramos)
  ══════════════════════════════════════════════════════ */
  if (IS_DESKTOP) {
    const fab = document.getElementById('fab-add');
    if (fab) {
      /* Capture=true: roda antes do handler de hold do voice.js */
      fab.addEventListener('mousedown', e => e.stopPropagation(), true);
      fab.addEventListener('touchstart', e => e.stopPropagation(), { capture: true, passive: false });
      fab.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof openAddTask === 'function') openAddTask();
      }, true);
    }
  }

  /* ══════════════════════════════════════════════════════
     6. updateDesktopUI — popula sidebar + painel Today
  ══════════════════════════════════════════════════════ */
  function updateDesktopUI() {
    if (!window.state) return;

    /* ── Sidebar: avatar, nome, nível, streak, XP bar ── */
    const name = state.userName || '';
    setEl('sidebar-profile-name',  name);
    setEl('sidebar-profile-level', `Nível ${state.level ?? 1}`);
    setEl('streak-count', state.streak ?? 0);

    const av = document.getElementById('sidebar-avatar');
    if (av && name) av.textContent = name[0].toUpperCase();

    const needed = typeof xpForLevel === 'function' ? xpForLevel(state.level ?? 1) : 1000;
    const prev   = (state.level > 1 && typeof xpForLevel === 'function')
      ? xpForLevel(state.level - 1) : 0;
    const range  = needed - prev || 1;
    const pct    = Math.min(100, Math.round(((state.totalXP - prev) / range) * 100));
    const xpFill = document.getElementById('sidebar-xp-fill');
    if (xpFill) xpFill.style.width = pct + '%';

    /* ── Painel Today: 4 stat cards ── */
    const today = typeof todayISO === 'function' ? todayISO() : new Date().toISOString().split('T')[0];
    const todayDone = (state.tasks || []).filter(
      t => t.status === 'done' && t.lastCompleted === today
    ).length;

    setEl('ts-xp',     state.todayXP      ?? 0);
    setEl('ts-done',   todayDone);
    setEl('ts-streak', state.streak        ?? 0);
    setEl('ts-level',  state.level         ?? 1);

    /* ── Painel Today: missões mini ── */
    renderMissionsMini();

    /* ── Sincroniza sidebar active ── */
    syncSidebarActive();
  }

  /* ── Mini missões no painel lateral ── */
  function renderMissionsMini() {
    const el = document.getElementById('today-missions-mini');
    if (!el || !window.state?.missions) return;

    const missions = state.missions.slice(0, 4);
    if (!missions.length) {
      el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:4px 0 2px;">Nenhuma missão ativa.</p>';
      return;
    }

    el.innerHTML = missions.map(m => {
      const pct   = m.target > 0 ? Math.min(100, Math.round((m.progress / m.target) * 100)) : 0;
      const color = m.done ? 'var(--accent-teal)' : 'var(--accent)';
      const title = typeof escHtml === 'function' ? escHtml(m.title) : m.title;
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">
            <span style="font-size:12px;font-weight:700;color:${m.done ? 'var(--accent-teal)' : 'var(--text-sec)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${title}</span>
            <span style="font-size:10px;color:${color};font-family:'Rajdhani',sans-serif;
              font-weight:700;flex-shrink:0;">+${m.xp} XP</span>
          </div>
          <div style="height:3px;background:var(--bg-primary);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};
              border-radius:2px;transition:width .3s;"></div>
          </div>
          ${m.done
            ? '<div style="font-size:10px;color:var(--accent-teal);margin-top:3px;font-weight:700;">✓ Concluída</div>'
            : `<div style="font-size:10px;color:var(--text-muted);margin-top:3px;">${m.progress}/${m.target}</div>`
          }
        </div>`;
    }).join('');
  }

  /* ── Helper ── */
  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── Expõe para uso externo (ex: renderAll) ── */
  window._desktopUpdateUI = updateDesktopUI;

  /* ══════════════════════════════════════════════════════
     7. Hook em renderAll (se existir) para manter painel
        sincronizado em qualquer re-render
  ══════════════════════════════════════════════════════ */
  if (IS_DESKTOP && typeof window.renderAll === 'function') {
    const _origRenderAll = window.renderAll;
    window.renderAll = function() {
      _origRenderAll();
      updateDesktopUI();
    };
  }

});
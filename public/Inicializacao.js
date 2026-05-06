async function launchApp(primeiraintecao = false) {
  if(primeiraintecao){
    await init();
  }
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');
  generateMissions();
  renderAll();
  resumePendingVoiceJob();
  renderMissions();
  requestNotifications();
  bindAtribuirTarefaSave();
  initPostponeBindings();
}

async function init() {
  // ── 1. Tenta revalidar token e buscar state do backend ──
  const remoteState = await autoLogin();

  // ── 2. Sem token válido → tela de auth ──────────────────
  if (!remoteState) {
    Auth.init();
    Auth.show();
    return;
  }

  // ── 3. Carrega state remoto na memória ───────────────────
  load(remoteState);

  // ── 4. Onboarding pendente ───────────────────────────────
  if (!state.onboardingDone) {
    startOnboarding();
    return;
  }

  // ── 5. Fluxo normal ─────────────────────────────────────
  processRecurringTasks();
  generateMissions();
  updateStreak();
  initReactivateSheet();
  await loadAchievementsConfig();
  checkAchievements();
  initRemindAndInsistentPickers();
  bootInsistentScheduler();
  bootSeasonalReminders();
  initTaskTypeToggle();
  initNotesCounter();
  initAddSubtaskSheet();
  await initEmpresa();
  const lastOpen = localStorage.getItem('dxp2_lastopen');
  const today    = todayISO();
  if (lastOpen && lastOpen !== today) {
    saveDailyHistory();
    state.todayXP = 0;
    save();
    launchApp();
    setTimeout(() => showDaySummary(lastOpen), 900);
  } else {
    launchApp();
  }

  localStorage.setItem('dxp2_lastopen', today);
  renderMissions();
  
}

async function resumePendingVoiceJob() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch('/api/ask-ai/active-job', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const { jobId } = await res.json();
    if (!jobId) return;

    // Há um job pendente — reexibe o card
    const genCard = createVoiceGenCard(`voice_gen_resume`, '...');
    const overlay = document.getElementById('gen-cards-overlay');
    if (!overlay) return;
    overlay.appendChild(genCard);
    updateGenCard(genCard, 'Retomando geração de tarefas...');

    // Retoma o polling
    try {
      const result = await pollJob('/api/ask-ai', null, jobId); // passa jobId direto, sem recriar
      if (!result) throw new Error('Job sem resultado');

      const raw     = result.content?.find(b => b.type === 'text')?.text || '[]';
      const cleaned = raw.replace(/```json|```/g, '').trim();
      let parsedArr;
      try {
        parsedArr = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\[[\s\S]*\]/);
        parsedArr = match ? JSON.parse(match[0]) : [];
      }

      genCard.remove();
      if (Array.isArray(parsedArr) && parsedArr.length > 0) {
        prefillTaskSheet(parsedArr, '');
      }
    } catch (err) {
      console.warn('[resumePendingVoiceJob] falhou:', err.message);
      genCard.remove();
    }
  } catch (err) {
    console.warn('[resumePendingVoiceJob] erro ao buscar job ativo:', err.message);
  }
}

// 🔒 Bloquear botão direito
document.addEventListener('contextmenu', e => e.preventDefault());

// 🔒 Bloquear teclas de inspeção
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && e.key === 'I') ||
    (e.ctrlKey && e.shiftKey && e.key === 'J') ||
    (e.ctrlKey && e.key === 'U')
  ) e.preventDefault();
});

document.addEventListener('DOMContentLoaded', () => {
  init();

  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // FABs
  document.getElementById('fab-add')?.addEventListener('click', () => openAddTask());
  document.getElementById('fab-plan-add')?.addEventListener('click', () => {
    const date = state.planView === 'tomorrow' ? tomorrowISO() : todayISO();
    openAddTask(date);
  });

  // Salvar tarefa
  document.getElementById('save-task-btn')?.addEventListener('click', saveTask);
  document.getElementById('task-title-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveTask();
  });

  // Importância
  document.getElementById('importance-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('.imp-btn'); if (!btn) return;
    state._newTaskImp = btn.dataset.imp;
    document.querySelectorAll('.imp-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // Categoria
  document.addEventListener('click', e => {
    if (e.target.closest('#save-cat-btn')) saveCat();
  });
  
  document.getElementById('plan-add-cat')?.addEventListener('click', openAddCat);

  // Sheet backdrops
  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => closeSheet(el.dataset.close));
  });

  // Plan tabs
  document.getElementById('plan-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.plan-tab'); if (!tab) return;
    state.planView = tab.dataset.view;
    document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderPlan();
  });

  // Focus timer
  document.getElementById('focus-start')?.addEventListener('click', startTimer);
  document.getElementById('focus-reset')?.addEventListener('click', resetTimer);
  document.getElementById('dur-slider')?.addEventListener('input', e => {
    const mins = parseInt(e.target.value);
    const el = document.getElementById('dur-label');
    if (el) el.textContent = `${mins} min`;
    if (!timer.running) { timer.total = mins * 60; timer.remaining = mins * 60; updateTimerUI(); }
  });

  // Menu sheet
  document.getElementById('open-menu')?.addEventListener('click', () => {
    renderMenuProfile();
    renderMissions();
    openSheet('menu-sheet');
  });
  document.querySelectorAll('.menu-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => goToScreen(btn.dataset.goto));
  });

  // Back buttons
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => switchTab('today'));
  });

  // Day summary
  document.getElementById('ds-close')?.addEventListener('click', () => {
    document.getElementById('day-summary').classList.add('hidden');
  });

  // Postpone
  document.querySelectorAll('.postpone-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const { days, weekend, custom } = btn.dataset;
      if (custom) {
        const inp = document.getElementById('postpone-date-input');
        inp.classList.remove('hidden');
        inp.focus();
        inp.onchange = () => { if (inp.value) applyPostpone(inp.value); inp.classList.add('hidden'); };
        return;
      }
      if (weekend) { applyPostpone(nextWeekendISO()); return; }
      const d = new Date();
      d.setDate(d.getDate() + parseInt(days));
      applyPostpone(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    });
  });

  // Gesture hint
  document.getElementById('gesture-hint')?.addEventListener('click', () => {
    state.gestureHintSeen = true; save();
    document.getElementById('gesture-hint')?.classList.add('hidden');
  });

  // Onboarding
  document.querySelectorAll('.ob-next').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.next === 'ob-3') {
        const name = document.getElementById('ob-name')?.value.trim();
        if (!name) { document.getElementById('ob-name')?.focus(); return; }
      }
      document.querySelector('.ob-screen.active')?.classList.remove('active');
      document.getElementById(btn.dataset.next)?.classList.add('active');
    });
  });

  document.querySelectorAll('.ob-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.ob-options')?.querySelectorAll('.ob-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  document.getElementById('ob-finish')?.addEventListener('click', finishOnboarding);

  // Settings
  document.getElementById('settings-name')?.addEventListener('change', e => {
    state.userName = e.target.value.trim() || state.userName; save(); renderAll();
  });
  document.getElementById('settings-profile')?.addEventListener('change', e => {
    state.userProfile = e.target.value; save();
  });

  // Sair da conta
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja sair da conta?')) {
      clearToken();
      localStorage.removeItem('dxp2_lastopen');
      localStorage.removeItem('nxp_state_cache');
      location.reload();
      NativeBridge.keepScreenOn(false);
NativeBridge.stopForegroundService();
    }
  });

  // Missão / Timer
  updateMissionTimer();
  setInterval(updateMissionTimer, 1000);
  updateTimerUI();
});
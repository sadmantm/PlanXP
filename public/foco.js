const RING_CIRC = 2 * Math.PI * 96;
let timer = { running: false, remaining: 1500, total: 1500, interval: null };

function updateTimerUI() {
    const m = String(Math.floor(timer.remaining/60)).padStart(2,'0');
    const s = String(timer.remaining%60).padStart(2,'0');
    const el = document.getElementById('timer-display'); if (el) el.textContent = `${m}:${s}`;
    const pct = 1 - (timer.remaining / timer.total);
    const ring = document.getElementById('ring-fill');
    if (ring) { ring.style.strokeDashoffset = RING_CIRC * (1 - pct); ring.style.strokeDasharray = RING_CIRC; }
  }
  
  function startTimer() {
    if (timer.running) { pauseTimer(); return; }
    timer.running = true;
    const stateEl = document.getElementById('timer-state'); if (stateEl) stateEl.textContent = 'Focando...';
    document.getElementById('ring-fill')?.classList.add('running');
    const btn = document.getElementById('focus-start');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  
    // ── Bridge: mantém tela acesa e serviço em segundo plano ──
    NativeBridge.keepScreenOn(true);
    NativeBridge.startForegroundService('Sessão de foco ativa ⏱');
  
    timer.interval = setInterval(() => {
      timer.remaining--;
      updateTimerUI();
      if (timer.remaining <= 0) { clearInterval(timer.interval); onTimerComplete(); }
    }, 1000);
  }
  
  function pauseTimer() {
    timer.running = false;
    clearInterval(timer.interval);
    const stateEl = document.getElementById('timer-state'); if (stateEl) stateEl.textContent = 'Pausado';
    document.getElementById('ring-fill')?.classList.remove('running');
    const btn = document.getElementById('focus-start');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i>';
  
    // ── Bridge: libera tela e encerra serviço ao pausar ──
    NativeBridge.keepScreenOn(false);
    NativeBridge.stopForegroundService();
  }
  
  
  function resetTimer() {
    pauseTimer();
    timer.remaining = timer.total;
    const stateEl = document.getElementById('timer-state'); if (stateEl) stateEl.textContent = 'Pronto';
    updateTimerUI();
  }
  
  function onTimerComplete() {
    timer.running = false;
    document.getElementById('ring-fill')?.classList.remove('running');
    const stateEl = document.getElementById('timer-state'); if (stateEl) stateEl.textContent = 'Sessão concluída!';
    const btn = document.getElementById('focus-start'); if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i>';
  
    // ── Bridge: encerra serviço e libera tela ──
    NativeBridge.keepScreenOn(false);
    NativeBridge.stopForegroundService();
    NativeBridge.vibrate([60, 40, 60, 40, 120, 60, 180]); // espelha o vib() nativo
  
    state.focusSessions++;
    updateMissionProgress('focus');
  
    const selId = document.getElementById('focus-task-select')?.value;
    const focusTask = selId ? state.tasks.find(t => t.id === selId) : null;
  
    // Ask to complete task
    if (focusTask && focusTask.status !== 'done') {
      const xp = computeXP(focusTask.importance, true);
      if (confirm(`Sessão de foco concluída! Deseja marcar "${focusTask.title}" como concluída e ganhar +${xp} XP?`)) {
        completeTask(focusTask.id);
      } else {
        addXP(Math.round(xp * 0.5));
        showXPToast(`+${Math.round(xp*0.5)} XP (Foco!)`);
      }
    } else {
      const xp = Math.round(computeXP('Padrão', true));
      addXP(xp);
      showXPToast(`+${xp} XP (Foco!)`);
    }
  
    playLevelUpSfx();
    vib([60, 40, 60, 40, 120, 60, 180]);
    confetti({ particleCount: 70, spread: 65, origin: { y: 0.5 }, colors: ['#4ECDC4','#7C6FCD'] });
    save();
    renderAll();
  }
  
  function renderFocusTaskSelect() {
    const sel = document.getElementById('focus-task-select');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">Selecione uma tarefa...</option>';
    state.tasks.filter(t => t.status !== 'done').forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.title;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
  }
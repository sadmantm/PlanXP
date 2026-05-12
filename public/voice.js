(function initVoiceTask() {
  const HOLD_MS   = 600;
  const BAR_COUNT = 7;
  const BAR_MIN   = 4;
  const BAR_MAX   = 44;

  const fab          = document.getElementById('fab-add');
  const sheet        = document.getElementById('voice-sheet');
  const backdrop     = document.getElementById('voice-sheet-backdrop');
  const labelEl      = document.getElementById('voice-label');
  const hintEl       = document.getElementById('voice-hint');
  const transcriptEl = document.getElementById('voice-transcript');
  const barsWrap     = document.getElementById('voice-bars');
  const stopBtn      = document.getElementById('voice-stop-btn');
  const cancelBtn    = document.getElementById('voice-cancel-btn');

  if (!fab || !sheet) return;

  const bars = Array.from(barsWrap?.querySelectorAll('.voice-bar') || []);

  // ── Detecta geometria do anel (mobile=circle, desktop=rect) ──────────────
  const holdRing   = fab.querySelector('.fab-hold-ring');
  const holdCircle = holdRing?.querySelector('circle, rect');
  const holdGlow   = fab.querySelector('.fab-hold-glow');
  const ring       = fab.querySelector('.fab-implode-ring');

  // CORREÇÃO: calcula CIRCUMFERENCE dinamicamente conforme o elemento encontrado
  let CIRCUMFERENCE = 169.6; // fallback (circle r=27)
  if (holdCircle) {
    if (holdCircle.tagName === 'circle') {
      const r = parseFloat(holdCircle.getAttribute('r') || 27);
      CIRCUMFERENCE = 2 * Math.PI * r;
    } else if (holdCircle.tagName === 'rect') {
      // Perímetro aproximado do rect arredondado usado no desktop
      const w = parseFloat(holdCircle.getAttribute('width') || 98);
      const h = parseFloat(holdCircle.getAttribute('height') || 98);
      CIRCUMFERENCE = 2 * (w + h); // ≈ 392
    }
    // Inicializa stroke-dasharray/offset
    holdCircle.style.strokeDasharray  = CIRCUMFERENCE;
    holdCircle.style.strokeDashoffset = CIRCUMFERENCE;
  }

  let holdTimer    = null;
  let holdRaf      = null;
  let holdStartTime = null;
  let recognition  = null;
  let audioCtx     = null;
  let analyser     = null;
  let micStream    = null;
  let animRaf      = null;
  let fullText     = '';
  let isListening  = false;
  let mediaRecorder  = null;
  let audioChunks    = [];

  // ── Listeners do FAB ─────────────────────────────────────────────────────
  fab.addEventListener('touchstart', onFabDown, { passive: false });
  fab.addEventListener('mousedown',  onFabDown);

  fab.addEventListener('touchend', () => {
    const held = holdTimer !== null;
    onFabUp();
    if (held) openAddTask();
  });

  fab.addEventListener('mouseup', () => {
    const held = holdTimer !== null;
    onFabUp();
    if (held) openAddTask();
  });

  fab.addEventListener('mouseleave', onFabUp);

  // ── Animação de hold ──────────────────────────────────────────────────────
  function startHoldAnimation() {
    holdRing?.classList.add('active');
    holdGlow?.classList.add('active');
    fab.classList.add('holding');
    holdStartTime = performance.now();

    function tick(now) {
      const elapsed  = now - holdStartTime;
      const progress = Math.min(elapsed / HOLD_MS, 1);
      const offset   = CIRCUMFERENCE * (1 - progress);

      if (holdCircle) {
        holdCircle.style.strokeDashoffset = offset;
        const r1 = [124, 111, 205], r2 = [71, 121, 239];
        const r = Math.round(r1[0] + (r2[0] - r1[0]) * progress);
        const g = Math.round(r1[1] + (r2[1] - r1[1]) * progress);
        const b = Math.round(r1[2] + (r2[2] - r1[2]) * progress);
        holdCircle.style.stroke = `rgb(${r},${g},${b})`;
        holdCircle.style.transition = 'none';
      }

      if (progress < 1) holdRaf = requestAnimationFrame(tick);
    }
    holdRaf = requestAnimationFrame(tick);
  }

  function stopHoldAnimation(completed = false) {
    cancelAnimationFrame(holdRaf);
    holdRaf = null;

    if (!completed) {
      holdRing?.classList.remove('active');
      holdGlow?.classList.remove('active');
      fab.classList.remove('holding');
      if (holdCircle) {
        holdCircle.style.transition = 'stroke-dashoffset 0.2s ease';
        holdCircle.style.strokeDashoffset = CIRCUMFERENCE;
      }
    } else {
      holdGlow?.classList.remove('active');
      setTimeout(() => {
        holdRing?.classList.remove('active');
        if (holdCircle) holdCircle.style.strokeDashoffset = CIRCUMFERENCE;
        fab.classList.remove('holding');
      }, 300);
    }
  }

  function onFabDown(e) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    startHoldAnimation();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      stopHoldAnimation(true);
      triggerImplode();
      startVoice();
    }, HOLD_MS);
  }

  function onFabUp() {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
      stopHoldAnimation(false);
    }
  }

  // ── Implosão ──────────────────────────────────────────────────────────────
  function triggerImplode() {
    if (!ring) return;
    ring.classList.remove('animate');
    void ring.offsetWidth;
    ring.classList.add('animate');
    fab.classList.add('voice-mode');
    const icon = fab.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-microphone';
    ring.addEventListener('animationend', () => ring.classList.remove('animate'), { once: true });
  }

  function resetFab() {
    fab.classList.remove('voice-mode');
    const icon = fab.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-plus';
  }

  // ── Voice sheet ───────────────────────────────────────────────────────────
  function openVoiceSheet()  { sheet.classList.add('visible'); }
  function closeVoiceSheet() { sheet.classList.remove('visible'); }

  // ── Visualizador de áudio ─────────────────────────────────────────────────
  function startIdleBarAnimation() {
    let t = 0;
    function frame() {
      animRaf = requestAnimationFrame(frame);
      t += 0.06;
      bars.forEach((bar, i) => {
        const h = BAR_MIN + (BAR_MAX - BAR_MIN) * 0.4 *
          (0.5 + 0.5 * Math.sin(t + i * 0.8));
        bar.style.height = `${h}px`;
      });
    }
    frame();
  }

  function stopAudioVisualizer() {
    cancelAnimationFrame(animRaf);
    animRaf = null;
    bars.forEach(b => b.style.height = `${BAR_MIN}px`);
    try { micStream?.getTracks().forEach(t => t.stop()); } catch {}
    try { audioCtx?.close(); } catch {}
    micStream = audioCtx = analyser = null;
    if (window.AndroidBridge) AndroidBridge.releaseAudioAfterRecording?.();
  }

  // ── Início da gravação ────────────────────────────────────────────────────
  function startVoice() {
    if (!navigator.mediaDevices?.getUserMedia) {
      closeVoiceSheet();
      resetFab();
      alert('Microfone indisponível: o app precisa rodar em HTTPS.');
      return;
    }
    fullText = '';
    isListening = false;
    transcriptEl.textContent = '';
    transcriptEl.classList.remove('visible');
    openVoiceSheet();
    startRecordingAndVisualizer();
  }

  function stopRecognition() {
    isListening = false;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }
  }

  function cancelVoice() {
    stopRecognition();
    stopAudioVisualizer();
    closeVoiceSheet();
    resetFab();
    fullText = '';
    transcriptEl.textContent = '';
    transcriptEl.classList.remove('visible');
  }

  async function startRecordingAndVisualizer() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
          channelCount:     1,
          sampleRate:       16000,
        },
      });

      audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
      analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      audioCtx.createMediaStreamSource(micStream).connect(analyser);

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      function drawBars() {
        animRaf = requestAnimationFrame(drawBars);
        analyser.getByteFrequencyData(dataArr);
        bars.forEach((bar, i) => {
          const center   = (BAR_COUNT - 1) / 2;
          const freqIdx  = Math.floor(Math.abs(i - center) * (dataArr.length / BAR_COUNT / 2));
          const rawVal   = dataArr[freqIdx] / 255;
          const bellMult = 1 - Math.abs((i - center) / center) * 0.4;
          const h = BAR_MIN + (BAR_MAX - BAR_MIN) * rawVal * bellMult;
          bar.style.height = `${Math.max(BAR_MIN, h)}px`;
        });
      }
      drawBars();

      audioChunks   = [];
      mediaRecorder = new MediaRecorder(micStream, { mimeType: getSupportedMime() });
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.start(200);

    } catch (err) {
      console.warn('[voice] getUserMedia falhou:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        closeVoiceSheet();
        resetFab();
        showMicDeniedDialog();
      } else {
        startIdleBarAnimation();
      }
    }
  }

  function showMicDeniedDialog() {
    const existing = document.getElementById('mic-denied-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'mic-denied-dialog';
    dialog.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,.6);display:flex;
      align-items:center;justify-content:center;padding:24px;
    `;
    dialog.innerHTML = `
      <div style="background:var(--surface,#1e1e2e);border-radius:16px;
                  padding:24px;max-width:320px;width:100%;text-align:center;">
        <i class="fa-solid fa-microphone-slash"
           style="font-size:2rem;color:var(--danger,#f38ba8);margin-bottom:12px;"></i>
        <h3 style="margin:0 0 8px;color:var(--text,#fff)">Microfone bloqueado</h3>
        <p style="margin:0 0 20px;color:var(--text-muted,#aaa);font-size:.9rem;line-height:1.5">
          Permita o acesso ao microfone nas
          <strong>configurações do site/app</strong>.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="mic-denied-settings" style="
            padding:10px 18px;border-radius:10px;border:none;cursor:pointer;
            background:var(--accent,#7c3aed);color:#fff;font-size:.9rem;font-weight:600;">
            Abrir configurações
          </button>
          <button id="mic-denied-close" style="
            padding:10px 18px;border-radius:10px;border:none;cursor:pointer;
            background:var(--surface2,#2a2a3e);color:var(--text,#fff);font-size:.9rem;">
            Fechar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    document.getElementById('mic-denied-close').onclick = () => dialog.remove();
    document.getElementById('mic-denied-settings').onclick = () => {
      dialog.remove();
      if (window.AndroidBridge?.openAppSettings) {
        AndroidBridge.openAppSettings();
      } else {
        alert('Clique no ícone de cadeado 🔒 na barra de endereços e permita o microfone.');
      }
    };
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });
  }

  function getSupportedMime() {
    const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  function stopMediaRecorder() {
    return new Promise(resolve => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') { resolve(null); return; }
      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunks, { type: mime });
        audioChunks   = [];
        mediaRecorder = null;
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  }

  // ── Polling do job ────────────────────────────────────────────────────────
  async function waitForJob(jobId, maxWaitMs = 60000, intervalMs = 1500) {
    const deadline = Date.now() + maxWaitMs;
    const token = getToken();
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, intervalMs));
      try {
        const res = await fetch(`/api/job/${jobId}`, { headers: authHeader });
        if (!res.ok) { console.warn(`[waitForJob] HTTP ${res.status}`); continue; }
        const job = await res.json();
        console.log(`[waitForJob] status: ${job.status}`);
        if (job.status === 'done')  return job.result;
        if (job.status === 'error') throw new Error(job.error || 'Job falhou no servidor');
      } catch (err) {
        if (err.message.includes('Job falhou')) throw err;
        console.warn('[waitForJob] erro de rede, retentando:', err.message);
      }
    }
    throw new Error('Timeout aguardando processamento da IA');
  }

  // ── Processamento principal ───────────────────────────────────────────────
  async function stopAndProcess() {
    stopRecognition();

    const audioBlob = await stopMediaRecorder();
    stopAudioVisualizer();
    closeVoiceSheet();
    resetFab();

    if (!audioBlob || audioBlob.size < 1000) {
      showXPToast('Áudio muito curto. Tente novamente.');
      return;
    }

    const genCard = createVoiceGenCard(`voice_gen_${Date.now()}`, '...');
    document.getElementById('gen-cards-overlay')?.appendChild(genCard);

    const unblock = () => {
      fab.style.pointerEvents = '';
      genCard.remove();
    };

    fab.style.pointerEvents = 'none';

    try {
      updateGenCard(genCard, 'Transcrevendo áudio...');

      const mime = audioBlob.type || 'audio/webm';
      const ext  = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm';
      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${ext}`);

      const now = new Date();
      const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      formData.append('clientTodayISO', todayISO);
      formData.append('clientOffsetMinutes', String(now.getTimezoneOffset()));

      const token = getToken();
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error(`Transcrição HTTP ${res.status}`);
      const { transcription, jobId } = await res.json();
      if (!transcription) throw new Error('Transcrição vazia');

      const preview = transcription.slice(0, 60) + (transcription.length > 60 ? '…' : '');
      updateGenCard(genCard, `"${preview}" — identificando tarefas...`);

      try {
        await waitForJob(jobId);
      } catch (err) {
        console.warn('[stopAndProcess] waitForJob não confirmou, sincronizando mesmo assim:', err.message);
      }

      updateGenCard(genCard, 'Sincronizando tarefas...');
      await syncStateFromServer();

      unblock();
      renderAll();
      showXPToast('Tarefa criada por voz!');

    } catch (err) {
      console.error('[stopAndProcess]', err);
      unblock();
      showXPToast('Erro ao processar voz. Tente novamente.');
    }
  }

  async function syncStateFromServer() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/auth/auto-login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { state: remoteState } = await res.json();
      if (remoteState) Object.assign(state, remoteState);
    } catch (err) {
      console.warn('[syncStateFromServer] falhou:', err.message);
    }
  }

  // ── CORREÇÃO: prefillTaskSheet declarado UMA única vez ────────────────────
  function prefillTaskSheet(parsedArr, fallbackText) {
    if (!Array.isArray(parsedArr) || parsedArr.length === 0) return;

    const validImportance = ['Obrigatório', 'Necessário', 'Padrão', 'Ideia'];
    const validRepeat     = ['none', 'daily', 'weekdays', 'weekly'];
    const validEnergy     = ['low', 'medium', 'high'];
    const validRemind     = ['1d', '7d', '30d', 'custom'];

    let createdCount = 0;
    let missionCount = 0;
    const missionIds = [];

    parsedArr.forEach((parsed, idx) => {
      const title = (parsed.title || (idx === 0 ? fallbackText : '')).trim().slice(0, 100);
      if (!title) return;

      const imp    = validImportance.includes(parsed.importance) ? parsed.importance : 'Padrão';
      const cat    = parsed.category
        ? (state.categories || []).find(c => c.name.toLowerCase() === parsed.category.toLowerCase())
        : null;
      const catId  = cat?.id || state.categories?.[0]?.id || null;
      const repeat = validRepeat.includes(parsed.repeat) ? parsed.repeat : 'none';
      const energy = validEnergy.includes(parsed.energy) ? parsed.energy : 'medium';

      const remindBefore     = validRemind.includes(parsed.remindBefore) ? parsed.remindBefore : null;
      const remindCustomDays = remindBefore === 'custom' ? (parseInt(parsed.remindCustomDays) || 1) : null;
      const remindDate       = calcRemindDate(parsed.dueDate || null, remindBefore, remindCustomDays);

      const insistent    = parsed.insistent === true;
      const insistentMin = insistent ? (parseInt(parsed.insistentMin) || 15) : null;
      const taskTime     = /^\d{2}:\d{2}$/.test(parsed.taskTime || '') ? parsed.taskTime : null;

      const task = {
        id:              uid(),
        type:            parsed.type === 'mission' ? 'mission' : 'task',
        title,
        notes:           parsed.notes || '',
        catId,
        importance:      imp,
        dueDate:         parsed.dueDate || null,
        taskTime,
        estimateMinutes: parsed.estimateMinutes || null,
        repeat,
        energy,
        status:          'todo',
        createdAt:       Date.now() + idx,
        xpEarned:        0,
        lastCompleted:   null,
        remindBefore,
        remindBeforeDays: remindCustomDays,
        remindDate,
        insistent,
        insistentMin,
      };

      state.tasks.unshift(task);
      addTimelineItem('fa-solid fa-microphone', `Tarefa (voz): ${task.title}`);
      createdCount++;

      if (insistent) scheduleInsistent(task);
      if (task.type === 'mission') { missionIds.push(task.id); missionCount++; }
    });

    save();
    missionIds.forEach(id => convertToMission(id));

    const simpleTasks = createdCount - missionCount;
    if (simpleTasks > 0 || missionCount === 0) renderAll();

    // Abre sheet de revisão somente quando há 1 tarefa simples criada
    if (createdCount === 1 && missionCount === 0) {
      const task = state.tasks[0];
      _fillAndOpenSheet(task);
      showXPToast('Revise e salve a tarefa!');
    } else if (createdCount > 1) {
      showXPToast(missionCount > 0
        ? `${createdCount} itens criados por voz!`
        : `${createdCount} tarefas criadas por voz!`);
    }
  }

  function _fillAndOpenSheet(task) {
    const titleEl = document.getElementById('task-title-input');
    if (titleEl) titleEl.value = task.title;

    const dateEl = document.getElementById('task-due-date');
    if (dateEl) dateEl.value = task.dueDate || '';

    const timeEl = document.getElementById('task-time');
    if (timeEl) timeEl.value = task.taskTime || '';

    const notesEl = document.getElementById('task-notes');
    if (notesEl) {
      notesEl.value = task.notes || '';
      const counter = document.getElementById('notes-char-count');
      if (counter) counter.textContent = (task.notes || '').length;
    }

    document.querySelectorAll('#importance-grid .imp-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.imp === task.importance);
    });

    document.querySelectorAll('#task-type-toggle .task-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === task.type);
    });
    document.getElementById('task-type-mission-hint')
      ?.classList.toggle('hidden', task.type !== 'mission');

    const repeatEl = document.getElementById('task-repeat');
    if (repeatEl) repeatEl.value = task.repeat || 'none';

    const energyEl = document.getElementById('task-energy');
    if (energyEl) energyEl.value = task.energy || 'medium';

    const remindVal = task.remindBefore || 'none';
    document.querySelectorAll('#remind-pills .remind-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === remindVal);
    });
    document.getElementById('remind-custom-wrap')
      ?.classList.toggle('hidden', remindVal !== 'custom');
    if (remindVal === 'custom') {
      const customDaysEl = document.getElementById('remind-custom-days');
      if (customDaysEl) customDaysEl.value = task.remindBeforeDays || '';
    }

    const insistentToggle = document.getElementById('task-insistent-toggle');
    if (insistentToggle) insistentToggle.checked = !!task.insistent;
    const insistentLabel = document.getElementById('insistent-label');
    if (insistentLabel) insistentLabel.textContent = task.insistent ? 'Ativado' : 'Desativado';
    document.getElementById('insistent-badge')?.classList.toggle('hidden', !task.insistent);
    document.getElementById('insistent-interval-wrap')?.classList.toggle('hidden', !task.insistent);

    openEditTask(task.id);
  }

  function updateGenCard(card, text) {
    const sub = card.querySelector('.voice-gen-sub');
    if (sub) sub.textContent = text;
  }

  function createVoiceGenCard(id, rawText) {
    const card = document.createElement('div');
    card.id = id;
    card.className = 'voice-generating-card';
    card.innerHTML = `
      <div class="voice-gen-spinner"></div>
      <div>
        <div class="voice-gen-text">Gerando tarefa com IA...</div>
        <div class="voice-gen-sub">"${rawText.length > 50 ? rawText.slice(0,50) + '…' : rawText}"</div>
      </div>
    `;
    return card;
  }

  // ── Eventos ───────────────────────────────────────────────────────────────
  stopBtn.addEventListener('click',   () => stopAndProcess());
  cancelBtn.addEventListener('click', () => cancelVoice());
  backdrop.addEventListener('click',  () => cancelVoice());

  function onBackPressed() {
    if (sheet.classList.contains('visible')) { cancelVoice(); return true; }
    return false;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') onBackPressed(); });
  window._voiceSheetBackHandler = onBackPressed;

})();
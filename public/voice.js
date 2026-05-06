// frontend
(function initVoiceTask() {
  const HOLD_MS     = 600;
  const BAR_COUNT   = 7;
  const BAR_MIN     = 4;
  const BAR_MAX     = 44;

  // ── Elementos ────────────────────────────────────────────
  const fab         = document.getElementById('fab-add');
  const sheet       = document.getElementById('voice-sheet');
  const backdrop    = document.getElementById('voice-sheet-backdrop');
  const labelEl     = document.getElementById('voice-label');
  const hintEl      = document.getElementById('voice-hint');
  const transcriptEl= document.getElementById('voice-transcript');
  const barsWrap    = document.getElementById('voice-bars');
  const stopBtn     = document.getElementById('voice-stop-btn');
  const cancelBtn   = document.getElementById('voice-cancel-btn');
  const holdRing   = fab.querySelector('.fab-hold-ring');
const holdCircle = holdRing?.querySelector('circle');
const holdGlow   = fab.querySelector('.fab-hold-glow');
const ring       = fab.querySelector('.fab-implode-ring');
const CIRCUMFERENCE = 2 * Math.PI * 27; // ≈ 169.6
let holdRaf       = null;
let holdStartTime = null;

  if (!fab || !sheet) return;

  const bars = Array.from(barsWrap?.querySelectorAll('.voice-bar') || []);

  // ── Estado interno ───────────────────────────────────────
  let holdTimer    = null;
  let recognition  = null;
  let audioCtx     = null;
  let analyser     = null;
  let micStream    = null;
  let animRaf      = null;
  let fullText     = '';
  let isListening  = false;
  let mediaRecorder  = null;
let audioChunks    = [];

  fab.addEventListener('touchstart', onFabDown, { passive: false });
  fab.addEventListener('mousedown',  onFabDown);

  fab.addEventListener('touchend', (e) => {
    const held = holdTimer !== null;
    onFabUp();
    // Se o hold não disparou (toque rápido) → clique normal
    if (held) openAddTask();
  });

  fab.addEventListener('mouseup', (e) => {
    const held = holdTimer !== null;
    onFabUp();
    if (held) openAddTask();
  });

  fab.addEventListener('mouseleave', onFabUp);

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
        // stroke vai de roxo-accent para danger conforme progride
        const r1 = [124, 111, 205], r2 = [71, 121, 239];
        const r = Math.round(r1[0] + (r2[0] - r1[0]) * progress);
        const g = Math.round(r1[1] + (r2[1] - r1[1]) * progress);
        const b = Math.round(r1[2] + (r2[2] - r1[2]) * progress);
        holdCircle.style.stroke = `rgb(${r},${g},${b})`;
        // transição do stroke: remove a transition linear pois atualizamos via rAF
        holdCircle.style.transition = 'none';
      }
  
      if (progress < 1) {
        holdRaf = requestAnimationFrame(tick);
      }
    }
    holdRaf = requestAnimationFrame(tick);
  }
  
  function stopHoldAnimation(completed = false) {
    cancelAnimationFrame(holdRaf);
    holdRaf = null;
  
    if (!completed) {
      // Cancela suavemente
      holdRing?.classList.remove('active');
      holdGlow?.classList.remove('active');
      fab.classList.remove('holding');
      if (holdCircle) {
        holdCircle.style.transition = 'stroke-dashoffset 0.2s ease';
        holdCircle.style.strokeDashoffset = CIRCUMFERENCE;
      }
    } else {
      // Completo — some junto com a implosão
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
  
  // ── Animação de implosão ─────────────────────────────────
  function triggerImplode() {
    ring.classList.remove('animate');
    void ring.offsetWidth;
    ring.classList.add('animate');
    fab.classList.add('voice-mode');
    fab.querySelector('i').className = 'fa-solid fa-microphone';
    ring.addEventListener('animationend', () => ring.classList.remove('animate'), { once: true });
  }
  
  function resetFab() {
    fab.classList.remove('voice-mode');
    fab.querySelector('i').className = 'fa-solid fa-plus';
  }

  // ── Sheet ────────────────────────────────────────────────
  function openVoiceSheet() {
    sheet.classList.add('visible');
  }

  function closeVoiceSheet() {
    sheet.classList.remove('visible');
  }

  // ── Web Audio — anima barras pelo volume real ────────────
  async function startAudioVisualizer() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
      analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      audioCtx.createMediaStreamSource(micStream).connect(analyser);

      const dataArr = new Uint8Array(analyser.frequencyBinCount);

      function drawBars() {
        animRaf = requestAnimationFrame(drawBars);
        analyser.getByteFrequencyData(dataArr);

        bars.forEach((bar, i) => {
            const center = (BAR_COUNT - 1) / 2;
            const freqIdx = Math.floor(Math.abs(i - center) * (dataArr.length / BAR_COUNT / 2));
            const rawVal  = dataArr[freqIdx] / 255;
            const bellMult = 1 - Math.abs((i - center) / center) * 0.4;
            const h = BAR_MIN + (BAR_MAX - BAR_MIN) * rawVal * bellMult;
            bar.style.height = `${Math.max(BAR_MIN, h)}px`;
          });
      }
      drawBars();
    } catch {
      // Sem permissão de áudio para visualizer — animação de fallback
      startIdleBarAnimation();
    }
  }

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
  
    // Libera o modo de áudio nativo
    if (window.AndroidBridge) {
      AndroidBridge.releaseAudioAfterRecording();
    }
  }

  function startVoice() {
    // FIX: detecta contexto inseguro (HTTP sem override) logo de cara
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      closeVoiceSheet();
      resetFab();
      alert('Microfone indisponível: o app precisa rodar em HTTPS para usar getUserMedia.');
      return;
    }
    fullText    = '';
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
    // FIX: removido AndroidBridge.prepareAudioForRecording() e o delay de 300ms
    // O WebView gerencia o pipeline de áudio internamente via AAudio
  
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,   // FIX: reativar — desativado causava roteamento errado
          noiseSuppression: true,
          autoGainControl:  true,
          channelCount:     1,
          sampleRate:       16000   // FIX: 16kHz é o ideal para Whisper; 44100 gera arquivo enorme
        }
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
  // Tenta via AndroidBridge primeiro (app nativo)
  if (window.AndroidBridge) {
    AndroidBridge.requestNotifPermission?.();
  }

  // Diálogo visual amigável
  const existing = document.getElementById('mic-denied-dialog');
  if (existing) existing.remove();

  const dialog = document.createElement('div');
  dialog.id = 'mic-denied-dialog';
  dialog.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,.6); display:flex;
    align-items:center; justify-content:center; padding:24px;
  `;
  dialog.innerHTML = `
    <div style="background:var(--surface,#1e1e2e); border-radius:16px;
                padding:24px; max-width:320px; width:100%; text-align:center;">
      <i class="fa-solid fa-microphone-slash"
         style="font-size:2rem; color:var(--danger,#f38ba8); margin-bottom:12px;"></i>
      <h3 style="margin:0 0 8px; color:var(--text,#fff)">Microfone bloqueado</h3>
      <p style="margin:0 0 20px; color:var(--text-muted,#aaa); font-size:.9rem; line-height:1.5">
        Para usar comandos de voz, permita o acesso ao microfone nas
        <strong>configurações do site/app</strong>.
      </p>
      <div style="display:flex; gap:10px; justify-content:center;">
        <button id="mic-denied-settings" style="
          padding:10px 18px; border-radius:10px; border:none; cursor:pointer;
          background:var(--accent,#7c3aed); color:#fff; font-size:.9rem; font-weight:600;">
          Abrir configurações
        </button>
        <button id="mic-denied-close" style="
          padding:10px 18px; border-radius:10px; border:none; cursor:pointer;
          background:var(--surface2,#2a2a3e); color:var(--text,#fff); font-size:.9rem;">
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
      // FIX: usa openAppSettings (leva direto às permissões do app)
      AndroidBridge.openAppSettings();
    } else {
      alert('Clique no ícone de cadeado 🔒 na barra de endereços e permita o microfone.');
    }
  };

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
}

function getSupportedMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
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

// ── Utilitário: ISO local (sem bug de UTC) ───────────────────────────────────
function toLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Preenche o sheet de tarefa e salva no state ──────────────────────────────
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
    const catId  = cat?.id || state.categories[0]?.id || null;
    const repeat = validRepeat.includes(parsed.repeat) ? parsed.repeat : 'none';
    const energy = validEnergy.includes(parsed.energy) ? parsed.energy : 'medium';

    // ── Lembrete antecipado ────────────────────────────────────────────────
    const remindBefore     = validRemind.includes(parsed.remindBefore) ? parsed.remindBefore : null;
    const remindCustomDays = remindBefore === 'custom'
      ? (parseInt(parsed.remindCustomDays) || 1)
      : null;
    const remindDate       = calcRemindDate(parsed.dueDate || null, remindBefore, remindCustomDays);

    // ── Modo insistente ────────────────────────────────────────────────────
    const insistent    = parsed.insistent === true;
    const insistentMin = insistent ? (parseInt(parsed.insistentMin) || 15) : null;

    // ── taskTime: valida formato HH:MM ─────────────────────────────────────
    const taskTime = /^\d{2}:\d{2}$/.test(parsed.taskTime || '') ? parsed.taskTime : null;

    const task = {
      id:               uid(),
      type:             parsed.type === 'mission' ? 'mission' : 'task',
      title,
      notes:            parsed.notes || '',
      catId,
      importance:       imp,
      dueDate:          parsed.dueDate || null,
      taskTime,                                                 // ← campo salvo no objeto
      estimateMinutes:  parsed.estimateMinutes || null,
      repeat,
      energy,
      status:           'todo',
      createdAt:        Date.now() + idx,
      xpEarned:         0,
      lastCompleted:    null,
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

  // ── Se apenas 1 tarefa simples: abre o sheet já preenchido para revisão ──
  if (createdCount === 1 && missionCount === 0) {
    const task = state.tasks[0]; // recém inserida no topo
    _fillAndOpenSheet(task);
    showXPToast('Revise e salve a tarefa!');
  } else if (createdCount > 1) {
    showXPToast(missionCount > 0
      ? `${createdCount} itens criados por voz!`
      : `${createdCount} tarefas criadas por voz!`);
  }
}

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
    const catId  = cat?.id || state.categories[0]?.id || null;
    const repeat = validRepeat.includes(parsed.repeat) ? parsed.repeat : 'none';
    const energy = validEnergy.includes(parsed.energy) ? parsed.energy : 'medium';

    // ── Lembrete antecipado ────────────────────────────────────────────────
    const remindBefore     = validRemind.includes(parsed.remindBefore) ? parsed.remindBefore : null;
    const remindCustomDays = remindBefore === 'custom'
      ? (parseInt(parsed.remindCustomDays) || 1)
      : null;
    const remindDate       = calcRemindDate(parsed.dueDate || null, remindBefore, remindCustomDays);

    // ── Modo insistente ────────────────────────────────────────────────────
    const insistent    = parsed.insistent === true;
    const insistentMin = insistent ? (parseInt(parsed.insistentMin) || 15) : null;

    // ── taskTime: valida formato HH:MM ─────────────────────────────────────
    const taskTime = /^\d{2}:\d{2}$/.test(parsed.taskTime || '') ? parsed.taskTime : null;

    const task = {
      id:               uid(),
      type:             parsed.type === 'mission' ? 'mission' : 'task',
      title,
      notes:            parsed.notes || '',
      catId,
      importance:       imp,
      dueDate:          parsed.dueDate || null,
      taskTime,                                                 // ← campo salvo no objeto
      estimateMinutes:  parsed.estimateMinutes || null,
      repeat,
      energy,
      status:           'todo',
      createdAt:        Date.now() + idx,
      xpEarned:         0,
      lastCompleted:    null,
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

  if (createdCount === 1 && missionCount === 0) {
    showXPToast('Tarefa criada por voz!');
  } else if (createdCount > 1) {
    showXPToast(missionCount > 0
      ? `${createdCount} itens criados por voz!`
      : `${createdCount} tarefas criadas por voz!`);
  }
}

// ── Preenche os inputs do sheet com os dados da task ────────────────────────
function _fillAndOpenSheet(task) {
  // Título
  const titleEl = document.getElementById('task-title-input');
  if (titleEl) titleEl.value = task.title;

  // Data — usa o valor já em formato YYYY-MM-DD, compatível com input[type=date]
  const dateEl = document.getElementById('task-due-date');
  if (dateEl) dateEl.value = task.dueDate || '';

  // Horário — usa taskTime "HH:MM" direto no input[type=time]
  const timeEl = document.getElementById('task-time');
  if (timeEl) timeEl.value = task.taskTime || '';

  // Notas
  const notesEl = document.getElementById('task-notes');
  if (notesEl) {
    notesEl.value = task.notes || '';
    document.getElementById('notes-char-count')?.textContent !== undefined &&
      (document.getElementById('notes-char-count').textContent = (task.notes || '').length);
  }

  // Importância
  document.querySelectorAll('#importance-grid .imp-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.imp === task.importance);
  });

  // Categoria
  document.querySelectorAll('#cat-pills .cat-pill-sel').forEach(btn => {
    const cat = (state.categories || []).find(c => c.id === task.catId);
    btn.classList.toggle('active', cat && btn.textContent.trim() === cat.name);
  });

  // Tipo (task / mission)
  document.querySelectorAll('#task-type-toggle .task-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === task.type);
  });
  document.getElementById('task-type-mission-hint')
    ?.classList.toggle('hidden', task.type !== 'mission');

  // Recorrência
  const repeatEl = document.getElementById('task-repeat');
  if (repeatEl) repeatEl.value = task.repeat || 'none';

  // Energia
  const energyEl = document.getElementById('task-energy');
  if (energyEl) energyEl.value = task.energy || 'medium';

  // Lembrete antecipado
  const remindVal = task.remindBefore || 'none';
  document.querySelectorAll('#remind-pills .remind-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === remindVal);
  });
  const customWrap = document.getElementById('remind-custom-wrap');
  if (customWrap) customWrap.classList.toggle('hidden', remindVal !== 'custom');
  if (remindVal === 'custom') {
    const customDaysEl = document.getElementById('remind-custom-days');
    if (customDaysEl) customDaysEl.value = task.remindBeforeDays || '';
  }

  // Modo insistente
  const insistentToggle = document.getElementById('task-insistent-toggle');
  if (insistentToggle) insistentToggle.checked = !!task.insistent;
  document.getElementById('insistent-label')
    ?.textContent !== undefined &&
    (document.getElementById('insistent-label').textContent =
      task.insistent ? 'Ativado' : 'Desativado');
  document.getElementById('insistent-badge')
    ?.classList.toggle('hidden', !task.insistent);
  const insistentWrap = document.getElementById('insistent-interval-wrap');
  if (insistentWrap) insistentWrap.classList.toggle('hidden', !task.insistent);
  if (task.insistent && task.insistentMin) {
    const presets = ['5','10','15','30','60'];
    const val = String(task.insistentMin);
    document.querySelectorAll('#insistent-pills .remind-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === (presets.includes(val) ? val : 'custom'));
    });
    if (!presets.includes(val)) {
      document.getElementById('insistent-custom-wrap')?.classList.remove('hidden');
      const customMinEl = document.getElementById('insistent-custom-min');
      if (customMinEl) customMinEl.value = val;
    }
  }

  // Abre o sheet (chama a função existente do seu app)
  openEditTask(task.id); // ← substitua pelo nome real da função que abre o sheet de edição
}

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
  fab.style.pointerEvents = 'none';

  try {
    updateGenCard(genCard, 'Transcrevendo áudio...');

    const mime = audioBlob.type || 'audio/webm';
    const ext  = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('audio', audioBlob, `recording.${ext}`);

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

    // Polling simples sem depender de pollJob externo
    await waitForJob(jobId);

    // Backend já salvou no banco — só recarrega o state do servidor
    updateGenCard(genCard, 'Sincronizando tarefas...');
    await syncStateFromServer();

    genCard.remove();
    fab.style.pointerEvents = '';
    showXPToast('Tarefa criada por voz!');
    renderAll();

  } catch (err) {
    console.error('[stopAndProcess]', err);
    genCard.remove();
    fab.style.pointerEvents = '';
    showXPToast('Erro ao processar voz. Tente novamente.');
  }
}

// Polling local — não depende de pollJob externo
async function waitForJob(jobId, maxWaitMs = 30000, intervalMs = 1200) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const res = await fetch(`/api/job/${jobId}`);
      if (!res.ok) continue;
      const job = await res.json();
      if (job.status === 'done')  return job.result;
      if (job.status === 'error') throw new Error(job.error || 'Job falhou no servidor');
    } catch (err) {
      if (err.message.includes('Job falhou')) throw err;
      // erro de rede — tenta de novo
    }
  }
  throw new Error('Timeout aguardando processamento da IA');
}

// Recarrega o state do backend e atualiza o state local em memória
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

function updateGenCard(card, text) {
  const sub = card.querySelector('.voice-gen-sub');
  if (sub) sub.textContent = text;
}

async function transcribeAudio(blob) {
  // Descobre a extensão real do blob gravado pelo MediaRecorder
  const mime = blob.type || 'audio/webm';
  const ext  = mime.includes('ogg') ? 'ogg'
             : mime.includes('mp4') ? 'mp4'
             : 'webm';

  const formData = new FormData();
  formData.append('audio', blob, `recording.${ext}`);

  const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Transcrição HTTP ${res.status}`);
  const data = await res.json();
  return data.transcription || '';
}

  // ── Card visual de "gerando em background" ───────────────
  function createVoiceGenCard(id, rawText) {
    const card = document.createElement('div');
    card.id = id;
    card.className = 'voice-generating-card';
    card.innerHTML = `
      <div class="voice-gen-spinner"></div>
      <div>
        <div class="voice-gen-text">Gerando tarefa com IA...</div>
        <div class="voice-gen-sub">"${rawText.length > 50 ? rawText.slice(0, 50) + '…' : rawText}"</div>
      </div>
    `;
    return card;
  }


  // ── Fallback sem Speech API ──────────────────────────────
  function showNoSpeechFallback() {
    labelEl.textContent    = 'Voz não suportada';
    hintEl.textContent     = 'Seu navegador não suporta reconhecimento de voz.';
    stopBtn.textContent    = 'Criar tarefa manualmente';
    stopBtn.onclick        = () => { cancelVoice(); openAddTask(); };
  }

  // ── Eventos ──────────────────────────────────────────────
  stopBtn.addEventListener('click',   () => stopAndProcess());
  cancelBtn.addEventListener('click', () => cancelVoice());
  backdrop.addEventListener('click',  () => cancelVoice());
  // ── Botão Voltar (Android) e ESC (teclado) fecham o voice-sheet ──
function onBackPressed() {
  if (sheet.classList.contains('visible')) {
    cancelVoice();
    return true; // consumiu o evento
  }
  return false;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') onBackPressed();
});

// Hook para o botão voltar nativo (Android WebView via history)
window._voiceSheetBackHandler = onBackPressed;
})();
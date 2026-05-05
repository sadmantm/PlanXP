
const NativeBridge = (() => {

  /* ── Detecção ──────────────────────────────────────────────── */
  const _android  = () => window.AndroidBridge || null;
  const _isNative = () => !!_android();

  /* ── Fila de chamadas pendentes (bridge ainda não pronto) ──── */
  const _queue = [];
  let   _ready = false;

  // Chamado pelo Android assim que a WebView injeta o bridge
  window._onNativeBridgeReady = () => {
    _ready = true;
    _queue.forEach(fn => fn());
    _queue.length = 0;
    console.info('[NativeBridge] Pronto — fila drenada.');
  };

  function _call(fn) {
    if (_ready || _isNative()) return fn();
    _queue.push(fn);
  }

  /* ── Logger interno ────────────────────────────────────────── */
  function _log(method, params = {}) {
    console.info(`[NativeBridge] ${method}`, params);
  }

  function _warn(method) {
    console.warn(`[NativeBridge] "${method}" ignorado — fora da WebView Android.`);
  }

  // ─────────────────────────────────────────────────────────────
  // 1. NOTIFICAÇÕES
  // ─────────────────────────────────────────────────────────────

  /**
   * Exibe uma notificação push simples.
   * @param {string} title
   * @param {string} body
   * @param {string} [tag]  - identificador único (evita duplicatas)
   */
  function notify(title, body, tag = 'nxp_general') {
    _call(() => {
      if (!_isNative()) {
        // Fallback: Web Notifications API
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body, tag });
        } else {
          _warn('notify');
        }
        return;
      }
      _log('notify', { title, body, tag });
      _android().showNotification(title, body, tag);
    });
  }

  /**
   * Notificação PERSISTENTE — fica fixada até o usuário concluir a tarefa.
   * Exibe botão "Concluir" inline que chama completeTask(taskId) via bridge.
   * @param {string} taskId
   * @param {string} title
   * @param {string} body
   */
  function showPersistentNotification(taskId, title, body) {
    _call(() => {
      if (!_isNative()) { _warn('showPersistentNotification'); return; }
      _log('showPersistentNotification', { taskId, title, body });
      _android().showPersistentNotification(taskId, title, body);
    });
  }

  /**
   * Remove uma notificação persistente pelo ID da tarefa.
   * @param {string} taskId
   */
  function dismissNotification(taskId) {
    _call(() => {
      if (!_isNative()) { _warn('dismissNotification'); return; }
      _log('dismissNotification', { taskId });
      _android().dismissNotification(taskId);
    });
  }

  /**
   * Atualiza o conteúdo de uma notificação persistente já exibida.
   * Útil para trocar a tarefa exibida após uma conclusão.
   * @param {string} taskId
   * @param {string} title
   * @param {string} body
   */
  function updatePersistentNotification(taskId, title, body) {
    _call(() => {
      if (!_isNative()) { _warn('updatePersistentNotification'); return; }
      _log('updatePersistentNotification', { taskId, title, body });
      _android().updatePersistentNotification(taskId, title, body);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ALARMES
  // ─────────────────────────────────────────────────────────────

  /**
   * Agenda um alarme sonoro — dispara mesmo com app fechado.
   * @param {string}  taskId
   * @param {string}  title        - texto exibido ao disparar
   * @param {number}  timestampMs  - Date.now() do momento desejado
   * @param {string}  repeat       - 'none' | 'daily' | 'weekly'
   */
  function scheduleAlarm(taskId, title, timestampMs, repeat = 'none') {
    _call(() => {
      if (!_isNative()) { _warn('scheduleAlarm'); return; }
      _log('scheduleAlarm', { taskId, title, timestampMs, repeat });
      _android().scheduleAlarm(taskId, title, String(timestampMs), repeat);
    });
  }

  /**
   * Cancela um alarme agendado.
   * @param {string} taskId
   */
  function cancelAlarm(taskId) {
    _call(() => {
      if (!_isNative()) { _warn('cancelAlarm'); return; }
      _log('cancelAlarm', { taskId });
      _android().cancelAlarm(taskId);
    });
  }

  /**
   * Agenda alarmes para TODAS as tarefas com taskTime definido.
   * Chame após renderAll() ou ao fazer login.
   */
  function syncAllAlarms() {
    if (typeof state === 'undefined') return;
    const today = todayISO?.() || new Date().toISOString().slice(0, 10);

    state.tasks
      .filter(t => t.status !== 'done' && t.taskTime && t.dueDate >= today)
      .forEach(t => {
        const [h, m] = t.taskTime.split(':').map(Number);
        const dt = new Date(`${t.dueDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
        if (dt.getTime() > Date.now()) {
          scheduleAlarm(t.id, t.title, dt.getTime(), t.repeat || 'none');
        }
      });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. FOREGROUND SERVICE
  // ─────────────────────────────────────────────────────────────

  /**
   * Inicia o ForegroundService — mantém app vivo em segundo plano.
   * Exibe ícone permanente na status bar.
   * @param {string} [label] - texto da notificação do serviço
   */
  function startForegroundService(label = 'NextXP rodando em segundo plano') {
    _call(() => {
      if (!_isNative()) { _warn('startForegroundService'); return; }
      _log('startForegroundService', { label });
      _android().startForegroundService(label);
    });
  }

  /**
   * Para o ForegroundService.
   */
  function stopForegroundService() {
    _call(() => {
      if (!_isNative()) { _warn('stopForegroundService'); return; }
      _log('stopForegroundService');
      _android().stopForegroundService();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. WIDGET
  // ─────────────────────────────────────────────────────────────

  /**
   * Envia dados atualizados para o Widget da home screen.
   * Chame sempre que state.tasks mudar (dentro de renderAll, por exemplo).
   * @param {Array} tasks - lista de tarefas pendentes de hoje
   */
  function updateWidget(tasks) {
    _call(() => {
      if (!_isNative()) { _warn('updateWidget'); return; }
      const payload = JSON.stringify(
        tasks
          .filter(t => t.status !== 'done')
          .slice(0, 5) // widget exibe até 5 itens
          .map(t => ({ id: t.id, title: t.title, importance: t.importance, xp: t.xpEarned || 0 }))
      );
      _log('updateWidget', { count: tasks.length });
      _android().updateWidget(payload);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 5. QUICK SETTINGS TILE
  // ─────────────────────────────────────────────────────────────

  /**
   * Atualiza o estado visual do Tile na Central de Notificações.
   * @param {boolean} active   - true = ativo (colorido), false = inativo (cinza)
   * @param {string}  subtitle - texto secundário exibido abaixo do ícone
   */
  function setTileState(active, subtitle = '') {
    _call(() => {
      if (!_isNative()) { _warn('setTileState'); return; }
      _log('setTileState', { active, subtitle });
      _android().setTileState(active ? '1' : '0', subtitle);
    });
  }

  // O Android chama esta função quando o usuário toca no Tile
  // O app deve ter startVoice() acessível globalmente
  window._onTileClicked = () => {
    _log('_onTileClicked — ativando modo de voz');
    if (typeof startVoice === 'function') {
      startVoice();
    } else {
      console.warn('[NativeBridge] startVoice() não encontrado.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 6. HARDWARE & SISTEMA
  // ─────────────────────────────────────────────────────────────

  /**
   * Vibração com padrão customizável.
   * @param {number|number[]} pattern - ms ou array [espera, vibra, espera, vibra...]
   */
  function vibrate(pattern = 80) {
    _call(() => {
      const p = Array.isArray(pattern) ? pattern : [pattern];
      if (!_isNative()) {
        // Fallback: Web Vibration API
        navigator.vibrate?.(p);
        return;
      }
      _log('vibrate', { pattern: p });
      _android().vibrate(JSON.stringify(p));
    });
  }

  /**
   * Mantém a tela acesa (útil durante sessão de foco/Pomodoro).
   * @param {boolean} on
   */
  function keepScreenOn(on) {
    _call(() => {
      if (!_isNative()) { _warn('keepScreenOn'); return; }
      _log('keepScreenOn', { on });
      _android().keepScreenOn(on ? '1' : '0');
    });
  }

  /**
   * Retorna nível de bateria (0–100). Retorna -1 fora da WebView.
   * @returns {number}
   */
  function getBatteryLevel() {
    if (!_isNative()) return -1;
    return parseInt(_android().getBatteryLevel(), 10) || -1;
  }

  /**
   * Retorna true se há conexão de rede ativa.
   * @returns {boolean}
   */
  function isOnline() {
    if (!_isNative()) return navigator.onLine;
    return _android().isOnline() === '1';
  }

  // ─────────────────────────────────────────────────────────────
  // 7. PERMISSÕES & CONFIGURAÇÕES
  // ─────────────────────────────────────────────────────────────

  /**
   * Solicita permissão de notificação em runtime (Android 13+).
   * O resultado chega via window._onNotifPermissionResult(granted: bool)
   */
  function requestNotifPermission() {
    _call(() => {
      if (!_isNative()) {
        // Fallback: Web Notifications API
        Notification.requestPermission?.().then(r => {
          window._onNotifPermissionResult?.(r === 'granted');
        });
        return;
      }
      _log('requestNotifPermission');
      _android().requestNotifPermission();
    });
  }

  /**
   * Abre a tela de permissão de Alarmes Exatos (Android 12+).
   */
  function requestExactAlarmPermission() {
    _call(() => {
      if (!_isNative()) { _warn('requestExactAlarmPermission'); return; }
      _log('requestExactAlarmPermission');
      _android().requestExactAlarmPermission();
    });
  }

  /**
   * Abre as configurações de otimização de bateria para o app.
   * Necessário para garantir alarmes em ROMs agressivas (MIUI, One UI).
   */
  function openBatteryOptimizationSettings() {
    _call(() => {
      if (!_isNative()) { _warn('openBatteryOptimizationSettings'); return; }
      _log('openBatteryOptimizationSettings');
      _android().openBatteryOptimizationSettings();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 8. COMPARTILHAMENTO & INTEGRAÇÃO
  // ─────────────────────────────────────────────────────────────

  /**
   * Abre o ShareSheet nativo do Android.
   * @param {string} text - conteúdo a compartilhar
   */
  function share(text) {
    _call(() => {
      if (!_isNative()) {
        navigator.share?.({ text }).catch(() => _warn('share'));
        return;
      }
      _log('share', { text });
      _android().share(text);
    });
  }

  /**
   * Adiciona atalho dinâmico na home screen ("Adicionar tarefa").
   */
  function addHomeShortcut() {
    _call(() => {
      if (!_isNative()) { _warn('addHomeShortcut'); return; }
      _log('addHomeShortcut');
      _android().addHomeShortcut();
    });
  }

  /**
   * Atualiza o badge do ícone do app com o nº de tarefas pendentes.
   * @param {number} count - 0 remove o badge
   */
  function setBadgeCount(count) {
    _call(() => {
      if (!_isNative()) { _warn('setBadgeCount'); return; }
      _log('setBadgeCount', { count });
      _android().setBadgeCount(String(count));
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 9. CALLBACKS VINDOS DO ANDROID → JS
  // ─────────────────────────────────────────────────────────────
  // O Android chama estas funções via evaluateJavascript().
  // Registre handlers onde precisar; o bridge apenas os expõe.

  // Botão "Concluir" tocado na notificação persistente
  window._onNotifCompleteTask = (taskId) => {
    _log('_onNotifCompleteTask', { taskId });
    if (typeof completeTask === 'function') completeTask(taskId);
  };

  // Alarme disparou
  window._onAlarmFired = (taskId) => {
    _log('_onAlarmFired', { taskId });
    if (typeof showXPToast === 'function') showXPToast('⏰ Hora da sua tarefa!');
  };

  // Resultado da permissão de notificação
  window._onNotifPermissionResult = (granted) => {
    _log('_onNotifPermissionResult', { granted });
  };

  // App aberto via atalho "Adicionar tarefa"
  window._onShortcutAddTask = () => {
    _log('_onShortcutAddTask');
    if (typeof openAddTask === 'function') openAddTask();
  };

  // ─────────────────────────────────────────────────────────────
  // 10. HELPERS DE INTEGRAÇÃO COM O APP
  // ─────────────────────────────────────────────────────────────

  /**
   * Sincroniza tudo com o Android de uma vez.
   * Chame dentro de renderAll() para manter widget, badge e
   * notificação persistente sempre atualizados.
   */
  function syncAll() {
    if (!_isNative()) return;
    if (typeof state === 'undefined') return;

    const today    = todayISO?.() || new Date().toISOString().slice(0, 10);
    const pending  = state.tasks.filter(t => t.status !== 'done' &&
      (t.dueDate === today || t.dueDate < today));
    const topTask  = pending.find(t => t.importance === 'Obrigatório') || pending[0];

    // Badge
    setBadgeCount(pending.length);

    // Widget
    updateWidget(pending);

    // Tile
    setTileState(pending.length > 0, `${pending.length} pendente${pending.length !== 1 ? 's' : ''}`);

    // Notificação persistente — atualiza ou remove
    if (topTask) {
      updatePersistentNotification(
        topTask.id,
        `📌 ${topTask.title}`,
        `${topTask.importance} · ${pending.length} tarefa${pending.length !== 1 ? 's' : ''} hoje`
      );
    } else {
      dismissNotification('nxp_persistent');
    }
  }

  /* ── API pública ───────────────────────────────────────────── */
  return {
    get isNative() { return _isNative(); },

    // Notificações
    notify,
    showPersistentNotification,
    dismissNotification,
    updatePersistentNotification,

    // Alarmes
    scheduleAlarm,
    cancelAlarm,
    syncAllAlarms,

    // Serviço em segundo plano
    startForegroundService,
    stopForegroundService,

    // Widget & Tile
    updateWidget,
    setTileState,

    // Hardware
    vibrate,
    keepScreenOn,
    getBatteryLevel,
    isOnline,

    // Permissões
    requestNotifPermission,
    requestExactAlarmPermission,
    openBatteryOptimizationSettings,

    // Integração
    share,
    addHomeShortcut,
    setBadgeCount,

    // Sync geral
    syncAll,
  };
})();
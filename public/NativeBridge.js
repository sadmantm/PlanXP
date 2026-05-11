const NativeBridge = (() => {

  /* ── Detecção ──────────────────────────────────────────────── */
  const _android  = () => window.AndroidBridge || null;
  const _isNative = () => !!_android();

  /* ── Fila de chamadas pendentes ────────────────────────────── */
  const _queue = [];
  let   _ready = false;

  // Chamado pelo Android assim que a WebView injeta o bridge
  window._onNativeBridgeReady = () => {
    _ready = true;
    _queue.forEach(fn => { try { fn(); } catch (e) { console.error('[NativeBridge] queued fn', e); } });
    _queue.length = 0;
    console.info('[NativeBridge] Pronto — fila drenada.');
  };

  // Se já estamos em ambiente nativo no momento do load, marca como ready
  if (_isNative()) _ready = true;

  function _call(fn) {
    // Em ambiente web (sem bridge), executa imediatamente para que fallbacks rodem
    if (!_isNative()) return fn();
    if (_ready) return fn();
    _queue.push(fn);
  }

  /* ── Debounce helper ───────────────────────────────────────── */
  function _debounce(fn, ms) {
    let h;
    return function (...args) {
      clearTimeout(h);
      h = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /* ── Logger interno ────────────────────────────────────────── */
  function _log(method, params = {}) {
    console.info(`[NativeBridge] ${method}`, params);
  }
  function _warn(method) {
    console.warn(`[NativeBridge] "${method}" ignorado — fora da WebView Android.`);
  }

  // Wrap seguro para chamadas ao bridge — captura erros sem derrubar o JS
  function _safe(method, fn) {
    try { return fn(); }
    catch (e) {
      console.error(`[NativeBridge] erro em ${method}:`, e);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. NOTIFICAÇÕES
  // ─────────────────────────────────────────────────────────────

  function notify(title, body, tag = 'nxp_general') {
    _call(() => {
      if (!_isNative()) {
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification(title, { body, tag }); } catch (e) { _warn('notify'); }
        } else {
          _warn('notify');
        }
        return;
      }
      _log('notify', { title, body, tag });
      _safe('notify', () => _android().showNotification(title, body, tag));
    });
  }

  function showPersistentNotification(taskId, title, body) {
    _call(() => {
      if (!_isNative()) { _warn('showPersistentNotification'); return; }
      _log('showPersistentNotification', { taskId, title, body });
      _safe('showPersistentNotification',
        () => _android().showPersistentNotification(taskId, title, body));
    });
  }

  function dismissNotification(taskId) {
    _call(() => {
      if (!_isNative()) { _warn('dismissNotification'); return; }
      _log('dismissNotification', { taskId });
      _safe('dismissNotification', () => _android().dismissNotification(taskId));
    });
  }

  function updatePersistentNotification(taskId, title, body) {
    _call(() => {
      if (!_isNative()) { _warn('updatePersistentNotification'); return; }
      _log('updatePersistentNotification', { taskId, title, body });
      _safe('updatePersistentNotification',
        () => _android().updatePersistentNotification(taskId, title, body));
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ALARMES
  // ─────────────────────────────────────────────────────────────

  // Cache local para evitar re-agendamento desnecessário.
  // Chave: taskId, Valor: timestamp agendado.
  const _scheduledAlarms = (() => {
    try { return JSON.parse(localStorage.getItem('nxp_scheduled_alarms') || '{}'); }
    catch { return {}; }
  })();

  function _saveAlarmsCache() {
    try { localStorage.setItem('nxp_scheduled_alarms', JSON.stringify(_scheduledAlarms)); }
    catch {}
  }

  function scheduleAlarm(taskId, title, timestampMs, repeat = 'none') {
    // Dedup: se já agendado para o mesmo tempo, não re-agenda
    if (_scheduledAlarms[taskId] === timestampMs) return;

    _call(() => {
      if (!_isNative()) { _warn('scheduleAlarm'); return; }
      _log('scheduleAlarm', { taskId, title, timestampMs, repeat });
      _safe('scheduleAlarm',
        () => _android().scheduleAlarm(taskId, title, String(timestampMs), repeat));
      _scheduledAlarms[taskId] = timestampMs;
      _saveAlarmsCache();
    });
  }

  function cancelAlarm(taskId) {
    _call(() => {
      if (!_isNative()) { _warn('cancelAlarm'); return; }
      _log('cancelAlarm', { taskId });
      _safe('cancelAlarm', () => _android().cancelAlarm(taskId));
      delete _scheduledAlarms[taskId];
      _saveAlarmsCache();
    });
  }

  /**
   * Re-sincroniza alarmes baseado no state atual.
   * - Agenda novos alarmes futuros.
   * - Cancela alarmes de tarefas concluídas/removidas.
   * - Pula tarefas já agendadas no mesmo timestamp (dedup via _scheduledAlarms).
   */
  function syncAllAlarms() {
    if (typeof state === 'undefined') return;
    const today  = (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0, 10);
    const now    = Date.now();
    const validIds = new Set();

    state.tasks
      .filter(t => t.status !== 'done' && t.taskTime && t.dueDate >= today)
      .forEach(t => {
        const [h, m] = t.taskTime.split(':').map(Number);
        const dt = new Date(`${t.dueDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
        const ts = dt.getTime();
        if (ts > now) {
          validIds.add(t.id);
          scheduleAlarm(t.id, t.title, ts, t.repeat || 'none');
        }
      });

    // Cancela alarmes obsoletos (tarefas concluídas/removidas/movidas)
    Object.keys(_scheduledAlarms).forEach(id => {
      if (!validIds.has(id)) cancelAlarm(id);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. FOREGROUND SERVICE
  // ─────────────────────────────────────────────────────────────

  function startForegroundService(label = 'NextXP rodando em segundo plano') {
    _call(() => {
      if (!_isNative()) { _warn('startForegroundService'); return; }
      _log('startForegroundService', { label });
      _safe('startForegroundService', () => _android().startForegroundService(label));
    });
  }

  function stopForegroundService() {
    _call(() => {
      if (!_isNative()) { _warn('stopForegroundService'); return; }
      _log('stopForegroundService');
      _safe('stopForegroundService', () => _android().stopForegroundService());
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. WIDGET
  // ─────────────────────────────────────────────────────────────

  function updateWidget(tasks) {
    _call(() => {
      if (!_isNative()) { _warn('updateWidget'); return; }
      const payload = JSON.stringify(
        tasks
          .filter(t => t.status !== 'done')
          .slice(0, 5)
          .map(t => ({
            id:         t.id,
            title:      t.title,
            importance: t.importance,
            xp:         t.xpEarned || 0,
          }))
      );
      _log('updateWidget', { count: tasks.length });
      _safe('updateWidget', () => _android().updateWidget(payload));
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 5. QUICK SETTINGS TILE
  // ─────────────────────────────────────────────────────────────

  function setTileState(active, subtitle = '') {
    _call(() => {
      if (!_isNative()) { _warn('setTileState'); return; }
      _log('setTileState', { active, subtitle });
      _safe('setTileState',
        () => _android().setTileState(active ? '1' : '0', subtitle));
    });
  }

  window._onTileClicked = () => {
    _log('_onTileClicked — ativando modo de voz');
    if (typeof startVoice === 'function') startVoice();
    else console.warn('[NativeBridge] startVoice() não encontrado.');
  };

  // ─────────────────────────────────────────────────────────────
  // 6. HARDWARE & SISTEMA
  // ─────────────────────────────────────────────────────────────

  function vibrate(pattern = 80) {
    _call(() => {
      const p = Array.isArray(pattern) ? pattern : [pattern];
      if (!_isNative()) {
        navigator.vibrate?.(p);
        return;
      }
      _log('vibrate', { pattern: p });
      _safe('vibrate', () => _android().vibrate(JSON.stringify(p)));
    });
  }

  function keepScreenOn(on) {
    _call(() => {
      if (!_isNative()) { _warn('keepScreenOn'); return; }
      _log('keepScreenOn', { on });
      _safe('keepScreenOn', () => _android().keepScreenOn(on ? '1' : '0'));
    });
  }

  // Cache leve de bateria/online (chamadas síncronas custosas)
  let _batteryCache = { value: -1, t: 0 };
  function getBatteryLevel() {
    if (!_isNative()) return -1;
    const now = Date.now();
    if (now - _batteryCache.t < 30000) return _batteryCache.value;
    const v = parseInt(_safe('getBatteryLevel', () => _android().getBatteryLevel()), 10);
    _batteryCache = { value: isNaN(v) ? -1 : v, t: now };
    return _batteryCache.value;
  }

  let _onlineCache = { value: true, t: 0 };
  function isOnline() {
    if (!_isNative()) return navigator.onLine;
    const now = Date.now();
    if (now - _onlineCache.t < 5000) return _onlineCache.value;
    const v = _safe('isOnline', () => _android().isOnline()) === '1';
    _onlineCache = { value: v, t: now };
    return v;
  }

  // ─────────────────────────────────────────────────────────────
  // 7. PERMISSÕES & CONFIGURAÇÕES
  // ─────────────────────────────────────────────────────────────

  function requestNotifPermission() {
    _call(() => {
      if (!_isNative()) {
        if ('Notification' in window) {
          Notification.requestPermission?.().then(r => {
            window._onNotifPermissionResult?.(r === 'granted');
          });
        } else {
          window._onNotifPermissionResult?.(false);
        }
        return;
      }
      _log('requestNotifPermission');
      _safe('requestNotifPermission', () => _android().requestNotifPermission());
    });
  }

  function requestExactAlarmPermission() {
    _call(() => {
      if (!_isNative()) { _warn('requestExactAlarmPermission'); return; }
      _log('requestExactAlarmPermission');
      _safe('requestExactAlarmPermission',
        () => _android().requestExactAlarmPermission());
    });
  }

  function openBatteryOptimizationSettings() {
    _call(() => {
      if (!_isNative()) { _warn('openBatteryOptimizationSettings'); return; }
      _log('openBatteryOptimizationSettings');
      _safe('openBatteryOptimizationSettings',
        () => _android().openBatteryOptimizationSettings());
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 8. COMPARTILHAMENTO & INTEGRAÇÃO
  // ─────────────────────────────────────────────────────────────

  function share(text) {
    _call(() => {
      if (!_isNative()) {
        navigator.share?.({ text }).catch(() => _warn('share'));
        return;
      }
      _log('share', { text });
      _safe('share', () => _android().share(text));
    });
  }

  function addHomeShortcut() {
    _call(() => {
      if (!_isNative()) { _warn('addHomeShortcut'); return; }
      _log('addHomeShortcut');
      _safe('addHomeShortcut', () => _android().addHomeShortcut());
    });
  }

  function setBadgeCount(count) {
    _call(() => {
      if (!_isNative()) { _warn('setBadgeCount'); return; }
      _log('setBadgeCount', { count });
      _safe('setBadgeCount', () => _android().setBadgeCount(String(count)));
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 9. CALLBACKS VINDOS DO ANDROID → JS
  // ─────────────────────────────────────────────────────────────

  // Botão "Concluir" na notificação
  window._onNotifCompleteTask = (taskId) => {
    _log('_onNotifCompleteTask', { taskId });
    if (typeof completeTask === 'function') {
      completeTask(taskId);
      // Após completar, força resync
      setTimeout(() => syncAll(), 200);
    }
  };

  // Alarme disparou — atualiza UI, toca som extra se quiser
  window._onAlarmFired = (taskId) => {
    _log('_onAlarmFired', { taskId });
    const task = typeof state !== 'undefined'
      ? state.tasks.find(t => t.id === taskId)
      : null;

    if (typeof showXPToast === 'function') {
      showXPToast(task ? `⏰ ${task.title}` : '⏰ Hora da sua tarefa!');
    }
    // Limpa do cache pra permitir re-agendamento se for recorrente
    delete _scheduledAlarms[taskId];
    _saveAlarmsCache();
  };

  window._onNotifPermissionResult = window._onNotifPermissionResult || ((granted) => {
    _log('_onNotifPermissionResult', { granted });
  });

  window._onShortcutAddTask = () => {
    _log('_onShortcutAddTask');
    if (typeof openAddTask === 'function') openAddTask();
  };

  // ─────────────────────────────────────────────────────────────
  // 10. SYNC GERAL — debounced para evitar IPC excessivo
  // ─────────────────────────────────────────────────────────────

  const _syncAllImpl = () => {
    if (!_isNative()) return;
    if (typeof state === 'undefined') return;

    const today = (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0, 10);

    const pending = state.tasks.filter(t =>
      t.status !== 'done' &&
      (t.dueDate === today || t.dueDate < today)
    );

    const topTask =
      pending.find(t => t.importance === 'Obrigatório') ||
      pending.find(t => t.importance === 'Necessário')  ||
      pending[0];

    setBadgeCount(pending.length);
    updateWidget(pending);
    setTileState(
      pending.length > 0,
      `${pending.length} pendente${pending.length !== 1 ? 's' : ''}`
    );

    if (topTask) {
      updatePersistentNotification(
        topTask.id,
        `📌 ${topTask.title}`,
        `${topTask.importance} · ${pending.length} tarefa${pending.length !== 1 ? 's' : ''} hoje`
      );
    } else {
      dismissNotification('nxp_persistent');
    }
  };

  // Debounce de 250ms para não flood o bridge em renderAll consecutivos
  const syncAll = _debounce(_syncAllImpl, 250);

  /* ── API pública ───────────────────────────────────────────── */
  return {
    get isNative() { return _isNative(); },

    notify,
    showPersistentNotification,
    dismissNotification,
    updatePersistentNotification,

    scheduleAlarm,
    cancelAlarm,
    syncAllAlarms,

    startForegroundService,
    stopForegroundService,

    updateWidget,
    setTileState,

    vibrate,
    keepScreenOn,
    getBatteryLevel,
    isOnline,

    requestNotifPermission,
    requestExactAlarmPermission,
    openBatteryOptimizationSettings,

    share,
    addHomeShortcut,
    setBadgeCount,

    syncAll,
  };
})();
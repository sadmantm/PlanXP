
const SEASONAL_MSG_TEMPLATES = {

  // ── Com tarefa vinculada ──────────────────────────────────
  withTask: [
    ({ eventName, daysLeft, taskTitle }) => ({
      title: `Tarefa para ${eventName}`,
      body:  daysLeft === 0
        ? `Hoje é ${eventName}! Não esqueça: "${taskTitle}".`
        : `Em ${daysLeft} dia${daysLeft > 1 ? 's' : ''} é ${eventName}. Você tem "${taskTitle}" pendente — hora de agir!`,
    }),
    ({ eventName, daysLeft, taskTitle }) => ({
      title: `${eventName} chegando`,
      body:  `"${taskTitle}" vence ${daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`}, no ${eventName}. Não deixe para a última hora!`,
    }),
    ({ eventName, daysLeft, taskTitle }) => ({
      title: `Missão antes do feriado`,
      body:  `Faltam ${daysLeft} dia${daysLeft > 1 ? 's' : ''} para ${eventName}. Conclua "${taskTitle}" e ganhe XP antes do descanso!`,
    }),
    ({ eventName, daysLeft, taskTitle }) => ({
      title: `Pendência para ${eventName}`,
      body:  `Você ainda tem "${taskTitle}" em aberto. Com ${daysLeft} dia${daysLeft > 1 ? 's' : ''} até ${eventName}, o momento de resolver é agora.`,
    }),
    ({ eventName, daysLeft, taskTitle }) => ({
      title: `Não perca o prazo`,
      body:  `"${taskTitle}" precisa ser concluída antes de ${eventName}, que chega em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}. Coloque isso em primeiro lugar hoje.`,
    }),
    ({ eventName, daysLeft, taskTitle }) => ({
      title: `Compromisso antes de ${eventName}`,
      body:  daysLeft === 1
        ? `Amanhã é ${eventName} e "${taskTitle}" ainda está pendente. Reserve um tempo hoje para concluir.`
        : `Restam ${daysLeft} dias para ${eventName}. Aproveite para dar conta de "${taskTitle}" com antecedência.`,
    }),
    ({ eventName, daysLeft, taskTitle }) => ({
      title: `Prazo se aproximando`,
      body:  `${eventName} está a ${daysLeft} dia${daysLeft > 1 ? 's' : ''} de distância. Sua tarefa "${taskTitle}" ainda aguarda conclusão.`,
    }),
    ({ eventName, taskTitle }) => ({
      title: `Hoje é dia de agir`,
      body:  `É ${eventName} e você tem "${taskTitle}" na lista. Que tal fechar essa pendência e comemorar com XP extra?`,
    }),
  ],

  // ── Sem tarefa — incentivo a planejar ────────────────────
  noTask: [
    ({ eventName, daysLeft }) => ({
      title: `${eventName} em breve`,
      body:  daysLeft === 0
        ? `Hoje é ${eventName}! Aproveite o dia — e que tal planejar algo especial?`
        : `Faltam ${daysLeft} dia${daysLeft > 1 ? 's' : ''} para ${eventName}. Já planejou algo para aproveitar?`,
    }),
    ({ eventName, daysLeft }) => ({
      title: `Oportunidade de planejamento`,
      body:  `${eventName} chega em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}. Que tal criar uma tarefa especial para a data?`,
    }),
    ({ eventName, daysLeft }) => ({
      title: `${daysLeft === 1 ? 'Amanhã' : `Em ${daysLeft} dias`}: ${eventName}`,
      body:  `Você ainda não tem tarefas para ${eventName}. Aproveite para planejar e ganhar XP extra!`,
    }),
    ({ eventName, daysLeft }) => ({
      title: `Dica sazonal`,
      body:  `${eventName} está próximo (${daysLeft} dia${daysLeft > 1 ? 's' : ''}). Use esse momento para criar metas especiais!`,
    }),
    ({ eventName, daysLeft }) => ({
      title: `Que tal se preparar?`,
      body:  `Faltam ${daysLeft} dia${daysLeft > 1 ? 's' : ''} para ${eventName} e sua lista ainda está vazia para essa data. Comece a planejar agora.`,
    }),
    ({ eventName, daysLeft }) => ({
      title: `${eventName} merece atenção`,
      body:  `Em ${daysLeft} dia${daysLeft > 1 ? 's' : ''} chega ${eventName}. Defina uma tarefa significativa e transforme a data em conquista.`,
    }),
    ({ eventName, daysLeft }) => ({
      title: `Use a data a seu favor`,
      body:  `${eventName} se aproxima em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}. Datas especiais são ótimas para criar novos hábitos — que tal começar um?`,
    }),
    ({ eventName, daysLeft }) => ({
      title: `Planejamento preventivo`,
      body:  `Com ${daysLeft} dia${daysLeft > 1 ? 's' : ''} até ${eventName}, ainda há tempo de organizar sua semana e criar tarefas para o período.`,
    }),
    ({ eventName }) => ({
      title: `Sem planos para ${eventName}?`,
      body:  `Hoje é ${eventName} e sua lista está vazia. Registre o que você quer realizar hoje e mantenha o ritmo.`,
    }),
  ],

  // ── Hoje é o dia ─────────────────────────────────────────
  today: [
    ({ eventName }) => ({
      title: `Hoje é ${eventName}!`,
      body:  `Aproveite o dia especial. Você tem tarefas pendentes para hoje — bora conquistar XP!`,
    }),
    ({ eventName }) => ({
      title: `${eventName}`,
      body:  `Feliz ${eventName}! Marque suas tarefas de hoje como concluídas e mantenha o streak!`,
    }),
    ({ eventName }) => ({
      title: `Um dia para celebrar e produzir`,
      body:  `${eventName} chegou. Combine o descanso com uma pequena conquista — sua lista de hoje está esperando.`,
    }),
    ({ eventName }) => ({
      title: `${eventName} é dia de avanço`,
      body:  `Datas especiais também podem ser produtivas. Conclua ao menos uma tarefa hoje e ganhe XP nesse dia marcante.`,
    }),
    ({ eventName }) => ({
      title: `Aproveite o ${eventName}`,
      body:  `Hoje é ${eventName}. Descanse, recarregue — e se der, risque um item da lista. Cada passo conta.`,
    }),
  ],

  // ── Por tipo de evento ────────────────────────────────────
  byType: {
    national: ({ eventName, daysLeft }) => ({
      title: `Feriado Nacional: ${eventName}`,
      body:  daysLeft === 0
        ? `Hoje é feriado! Descanse, mas não esqueça suas tarefas importantes.`
        : `Em ${daysLeft} dia${daysLeft > 1 ? 's' : ''} é ${eventName}. Planeje o feriado com antecedência!`,
    }),
    optional: ({ eventName, daysLeft }) => ({
      title: `Ponto facultativo: ${eventName}`,
      body:  `${eventName} em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}. Verifique se há tarefas para adiantar antes da folga.`,
    }),
    state: ({ eventName, daysLeft }) => ({
      title: `Feriado Estadual: ${eventName}`,
      body:  `${eventName} está chegando (${daysLeft} dia${daysLeft > 1 ? 's' : ''}). Organize sua semana com antecedência!`,
    }),
    seasonal: ({ eventName, daysLeft }) => ({
      title: `${eventName}`,
      body:  daysLeft === 0
        ? `Começa hoje: ${eventName}! Uma nova estação, novos objetivos. Que tal definir metas sazonais?`
        : `Em ${daysLeft} dia${daysLeft > 1 ? 's' : ''} começa ${eventName}. Hora de planejar novos hábitos para a estação!`,
    }),
    commemorative: ({ eventName, daysLeft }) => ({
      title: `${eventName} em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`,
      body:  `Não deixe ${eventName} passar em branco. Planeje algo significativo!`,
    }),
    municipal: ({ eventName, daysLeft }) => ({
      title: `Feriado Municipal: ${eventName}`,
      body:  daysLeft === 0
        ? `Hoje sua cidade celebra ${eventName}. Aproveite a folga para adiantar o que ficou pendente.`
        : `Em ${daysLeft} dia${daysLeft > 1 ? 's' : ''} é ${eventName}. Um bom momento para reorganizar suas metas locais.`,
    }),
    religious: ({ eventName, daysLeft }) => ({
      title: `${eventName} se aproxima`,
      body:  daysLeft === 0
        ? `Hoje é ${eventName}. Reserve um momento para reflexão — e para suas tarefas mais importantes do dia.`
        : `Faltam ${daysLeft} dia${daysLeft > 1 ? 's' : ''} para ${eventName}. Que tal usar esse período para criar intenções e metas?`,
    }),
    cultural: ({ eventName, daysLeft }) => ({
      title: `${eventName}`,
      body:  daysLeft === 0
        ? `Hoje celebramos ${eventName}. Uma data para refletir e planejar com propósito.`
        : `Em ${daysLeft} dia${daysLeft > 1 ? 's' : ''} é ${eventName}. Registre na sua lista algo que honre essa data.`,
    }),
    awareness: ({ eventName, daysLeft }) => ({
      title: `${eventName}`,
      body:  `${eventName} chega em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}. Que tal criar uma tarefa alinhada ao tema da data?`,
    }),
  },
};

function _getBannerCacheKey(evDate) {
  return `cal_banner_msg_${todayISO()}_${evDate}`;
}

function _getCachedBannerMsg(evDate) {
  try {
    const raw = localStorage.getItem(_getBannerCacheKey(evDate));
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function _setCachedBannerMsg(evDate, msg) {
  try {
    localStorage.setItem(_getBannerCacheKey(evDate), JSON.stringify(msg));
  } catch(e) {}
}

function _pickSeasonalMessage(ev, daysLeft, taskTitle) {
  const params = { eventName: ev.name, daysLeft, taskTitle };

  // Só usa cache quando NÃO há tarefa vinculada
  // (mensagens com tarefa devem refletir o estado atual)
  if (!taskTitle) {
    const cached = _getCachedBannerMsg(ev.date);
    if (cached) return cached;
  }

  let msg;

  if (daysLeft === 0) {
    const pool = taskTitle
      ? SEASONAL_MSG_TEMPLATES.withTask
      : SEASONAL_MSG_TEMPLATES.today;
    msg = pool[Math.floor(Math.random() * pool.length)](params);
  } else if (taskTitle) {
    const pool = SEASONAL_MSG_TEMPLATES.withTask;
    msg = pool[Math.floor(Math.random() * pool.length)](params);
  } else {
    const useByType = Math.random() < 0.5 && SEASONAL_MSG_TEMPLATES.byType[ev.type];
    msg = useByType
      ? SEASONAL_MSG_TEMPLATES.byType[ev.type](params)
      : SEASONAL_MSG_TEMPLATES.noTask[Math.floor(Math.random() * SEASONAL_MSG_TEMPLATES.noTask.length)](params);
  }

  // Só persiste no cache se não há tarefa vinculada
  if (!taskTitle) _setCachedBannerMsg(ev.date, msg);

  return msg;
}

function getUpcomingSeasonalEvents(windowDays = 7) {
  const today = new Date(); today.setHours(0,0,0,0);
  const result = [];

  CALENDAR_2026.forEach(ev => {
    const evDate = new Date(ev.date + 'T00:00:00');
    const diff   = Math.round((evDate - today) / 86400000);
    if (diff >= 0 && diff <= windowDays) {
      result.push({ ...ev, daysLeft: diff });
    }
  });

  // Ordena por proximidade
  result.sort((a, b) => a.daysLeft - b.daysLeft);
  return result;
}

function _firstPendingTaskForDate(dateISO) {
  const t = state.tasks.find(t => t.dueDate === dateISO && t.status !== 'done');
  return t ? t.title : null;
}

function _alreadyRemindedToday(evDate) {
  const key = `cal_reminded_${todayISO()}_${evDate}`;
  return localStorage.getItem(key) === '1';
}

function _markRemindedToday(evDate) {
  const key = `cal_reminded_${todayISO()}_${evDate}`;
  try { localStorage.setItem(key, '1'); } catch(e) {}
}

function _cleanOldReminderKeys() {
  const today = todayISO();
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('cal_reminded_') && !k.includes(today)) {
        localStorage.removeItem(k);
      }
    });
  } catch(e) {}
}

async function checkSeasonalReminders() {
  _cleanOldReminderKeys();

  const today      = todayISO();
  const upcoming   = getUpcomingSeasonalEvents(7);
  if (upcoming.length === 0) return;

  const granted = await requestNotifPermission();

  upcoming.forEach(ev => {
    // Evita spam: apenas 1 lembrete por evento por dia
    if (_alreadyRemindedToday(ev.date)) return;

    const taskTitle = _firstPendingTaskForDate(ev.date);
    const msg       = _pickSeasonalMessage(ev, ev.daysLeft, taskTitle);

    // ── Notificação push (se permitido) ──
    if (granted) {
      sendNotif(msg.title, msg.body, `seasonal_${ev.date}`);
    }

    // ── Toast in-app (sempre, mas só para eventos próximos: ≤ 2 dias) ──
    if (ev.daysLeft <= 2) {
      showXPToast(msg.title);
    }

    _markRemindedToday(ev.date);
  });

  // ── Lembretes antecipados de tarefas (comportamento original) ──
  const earlyDue = state.tasks.filter(t =>
    t.remindDate === today && t.status !== 'done'
  );
  earlyDue.forEach(t => {
    if (granted) {
      sendNotif(
        'NextXP — Lembrete antecipado',
        `"${t.title}" vence em ${formatDate(t.dueDate)}. Não esqueça!`,
        `remind_${t.id}`
      );
    }
    showXPToast(`Lembrete: ${t.title}`);
  });
}

function renderSeasonalBanner(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
  
    const upcoming = getUpcomingSeasonalEvents(TempoParaMostrarEventosNoBanner);
    if (upcoming.length === 0) { el.innerHTML = ''; return; }
  
    const ev        = upcoming[0];
    const meta      = TYPE_META[ev.type] || TYPE_META.commemorative;
    const taskTitle = _firstPendingTaskForDate(ev.date);
    const msg       = _pickSeasonalMessage(ev, ev.daysLeft, taskTitle);
  
    el.innerHTML = `
      <div class="seasonal-banner" style="border-color:${meta.color}33; --banner-accent:${meta.color};"
           onclick="goToScreen('seasonal')">
        <div class="seasonal-banner-icon" style="background:${meta.bg}">
          <i class="fa-solid ${ev.icon}" style="color:${meta.color}"></i>
        </div>
        <div class="seasonal-banner-body">
          <span class="seasonal-banner-title">${msg.title}</span>
          <span class="seasonal-banner-desc">${msg.body}</span>
        </div>
        <i class="fa-solid fa-chevron-right seasonal-banner-arrow" style="color:${meta.color}"></i>
      </div>`;
}  

function bootSeasonalReminders() {
  checkSeasonalReminders();
  // Recheck a cada hora
  setInterval(checkSeasonalReminders, 60 * 60 * 1000);
}
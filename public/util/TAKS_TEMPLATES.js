const TASK_TEMPLATES = {

  perfil: {

    "Projetos Pessoais": [
      { title: "Definir a meta principal desta semana",         importance: "Obrigatório", energy: "high",   estimateMinutes: 20,  catId: "ideias"  }
    ],

    "Estudante": [
      { title: "Rever as anotações da aula de hoje",            importance: "Obrigatório", energy: "medium", estimateMinutes: 30,  catId: "pessoal" },
    ],

    "Trabalho": [
      { title: "Responder as mensagens e e-mails pendentes",    importance: "Obrigatório", energy: "medium", estimateMinutes: 20,  catId: "empresa" },
    ],

    "Saúde e Bem-estar": [
      { title: "Completar o treino de hoje",                    importance: "Obrigatório", energy: "high",   estimateMinutes: 60,  catId: "saude"   },
    ],

  },

  ritmo: {

    leve: [
      { title: "Escolher a única tarefa mais importante do dia", importance: "Necessário", energy: "low",   estimateMinutes: 5,   catId: "ideias"  },
    ],

    moderado: [
      { title: "Planejar as 3 tarefas principais do dia",        importance: "Obrigatório", energy: "medium", estimateMinutes: 10, catId: "ideias"  },
    ],

    intenso: [
      { title: "Fazer um bloco de foco profundo de 90 minutos",  importance: "Obrigatório", energy: "high",   estimateMinutes: 90,  catId: "empresa" },
    ],

  },

  nicho: {

    saude_fitness: [
      { title: "Completar o treino do dia",                     importance: "Obrigatório", energy: "high",   estimateMinutes: 60,  catId: "saude"   },
    ],

    financas_pessoais: [
      { title: "Registrar todos os gastos do dia",              importance: "Obrigatório", energy: "low",    estimateMinutes: 5,   catId: "pessoal" },
    ],

    desenvolvimento_pessoal: [
      { title: "Ler por 20 minutos",                            importance: "Obrigatório", energy: "low",    estimateMinutes: 20,  catId: "pessoal" },
    ],

    tecnologia_dev: [
      { title: "Resolver a issue em aberto no repositório",     importance: "Obrigatório", energy: "high",   estimateMinutes: 60,  catId: "empresa" },
    ],

    marketing_conteudo: [
      { title: "Escrever e publicar o post do dia",             importance: "Obrigatório", energy: "high",   estimateMinutes: 45,  catId: "empresa" },
    ],

    gestao_lideranca: [
      { title: "Fazer 1:1 com um membro do time",               importance: "Obrigatório", energy: "medium", estimateMinutes: 30,  catId: "empresa" },
    ],

    comercial_vendas: [
      { title: "Fazer pelo menos 5 prospecções ativas",         importance: "Obrigatório", energy: "high",   estimateMinutes: 45,  catId: "empresa" },
    ],

  },

  nivel: {

    iniciante: [
      { title: "Definir uma única meta para hoje — só uma",     importance: "Obrigatório", energy: "low",    estimateMinutes: 5,   catId: "ideias"  }
    ],

    avancado: [
      { title: "Planejar a semana com blocos de foco definidos",importance: "Obrigatório", energy: "medium", estimateMinutes: 20,  catId: "ideias"  }
    ],

  },

  streak: {

    emRisco: [
      { title: "Concluir qualquer tarefa para manter a sequência", importance: "Obrigatório", energy: "low", estimateMinutes: 10, catId: "pessoal" },
    ],

    alto: [
      { title: "Desafio do dia: faça algo fora da sua zona de conforto", importance: "Necessário", energy: "high", estimateMinutes: 30, catId: "ideias" },
    ],

  },

};

function getTemplatesForUser() {
  const templates = [];
  const perfil  = state.userProfile || "Projetos Pessoais";
  const ritmo   = state.userRhythm  || "moderado";
  const nicho   = state.userNicho   || null;
  const streak  = state.streak      || 0;
  const level   = state.level       || 1;

  const perfilTasks = TASK_TEMPLATES.perfil[perfil] || TASK_TEMPLATES.perfil["Projetos Pessoais"];
  templates.push(...perfilTasks);

  const ritmoTasks = TASK_TEMPLATES.ritmo[ritmo] || TASK_TEMPLATES.ritmo["moderado"];
  templates.push(...ritmoTasks);

  if (nicho && TASK_TEMPLATES.nicho[nicho]) {
    templates.push(...TASK_TEMPLATES.nicho[nicho]);
  }

  if (level <= 2) {
    templates.push(...TASK_TEMPLATES.nivel.iniciante);
  } else {
    templates.push(...TASK_TEMPLATES.nivel.avancado);
  }

  if (streak > 0 && streak <= 2) {
    templates.push(...TASK_TEMPLATES.streak.emRisco);
  } else if (streak >= 7) {
    templates.push(...TASK_TEMPLATES.streak.alto);
  }

  const seen = new Set();
  return templates.filter(t => {
    if (seen.has(t.title)) return false;
    seen.add(t.title);
    return true;
  });
}

function applyTemplatesForUser() {
  const templates = getTemplatesForUser();
  const today = todayISO();

  templates.forEach(tpl => {
    const alreadyExists = state.tasks.some(t => t.title === tpl.title);
    if (alreadyExists) return;

    state.tasks.push({
      id:              uid(),
      type:            "task",
      title:           tpl.title,
      notes:           "",
      catId:           tpl.catId || state.categories[0]?.id,
      importance:      tpl.importance || "Padrão",
      dueDate:         today,
      estimateMinutes: tpl.estimateMinutes || null,
      energy:          tpl.energy || "medium",
      repeat:          "none",
      status:          "todo",
      createdAt:       Date.now(),
      xpEarned:        0,
      lastCompleted:   null,
      remindBefore:    null,
      remindBeforeDays:null,
      remindDate:      null,
      insistent:       false,
      insistentMin:    null,
    });
  });

  save();
  renderAll();
}
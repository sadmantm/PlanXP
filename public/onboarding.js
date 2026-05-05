
/* ── Partículas de fundo ───────────────────────────── */
function initObParticles() {
  const canvas = document.getElementById('ob-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles, raf;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function mkParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.8 + 0.4,
      dx: (Math.random() - 0.5) * 0.35,
      dy: -(Math.random() * 0.5 + 0.15),
      alpha: Math.random() * 0.5 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    };
  }

  function initParticles() {
    resize();
    particles = Array.from({ length: 60 }, mkParticle);
  }

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.pulse += 0.02;
      p.x  += p.dx;
      p.y  += p.dy;
      const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(124,111,205,${a})`;
      ctx.fill();
      if (p.y < -4) { Object.assign(p, mkParticle(), { y: H + 4 }); }
      if (p.x < -4 || p.x > W + 4) { Object.assign(p, mkParticle()); }
    });
    raf = requestAnimationFrame(drawParticles);
  }

  window.addEventListener('resize', () => { resize(); });
  initParticles();
  drawParticles();

  /* Para as partículas quando o onboarding some */
  return () => cancelAnimationFrame(raf);
}

/* ── Progresso ─────────────────────────────────────── */
const OB_TOTAL = 5; // steps 2–6 (step 1 = welcome, não conta)

function setObProgress(stepId) {
  const map = { 'ob-1': 0, 'ob-2': 1, 'ob-3': 2, 'ob-4': 3, 'ob-5': 4, 'ob-6': 5 };
  const n = map[stepId] ?? 0;
  const fill = document.getElementById('ob-progress-fill');
  if (fill) fill.style.width = (n / OB_TOTAL * 100) + '%';
}

/* ── Transição entre steps ─────────────────────────── */
function obGoTo(nextId) {
  const cur = document.querySelector('.ob-screen.active');
  if (!cur || cur.id === nextId) return;

  cur.classList.add('ob-exit');
  cur.addEventListener('animationend', () => {
    cur.classList.remove('active', 'ob-exit');
    const next = document.getElementById(nextId);
    if (next) {
      next.classList.add('active', 'ob-enter');
      next.addEventListener('animationend', () => next.classList.remove('ob-enter'), { once: true });
      setObProgress(nextId);
    }
  }, { once: true });
}

/* ── Meta diária (stepper) ─────────────────────────── */
let obDailyGoal = 5;
function initObStepper() {
  const valEl  = document.getElementById('ob-goal-val');
  const minus  = document.getElementById('ob-goal-minus');
  const plus   = document.getElementById('ob-goal-plus');
  if (!valEl || !minus || !plus) return;

  minus.addEventListener('click', () => {
    if (obDailyGoal > 1) { obDailyGoal--; valEl.textContent = obDailyGoal; }
  });
  plus.addEventListener('click', () => {
    if (obDailyGoal < 20) { obDailyGoal++; valEl.textContent = obDailyGoal; }
  });
}

/* ── Iniciar onboarding ────────────────────────────── */
let stopParticles = null;

function startOnboarding() {
  document.getElementById('onboarding').classList.remove('hidden');
  setObProgress('ob-1');
  stopParticles = initObParticles();
  initObStepper();

  /* Botões "Continuar" */
  document.querySelectorAll('.ob-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.next;
      if (!next) return;

      /* Validação step 2: nome */
      if (document.querySelector('.ob-screen.active')?.id === 'ob-2') {
        const v = document.getElementById('ob-name').value.trim();
        if (!v) {
          const inp = document.getElementById('ob-name');
          inp.style.borderColor = 'var(--danger, #e74c3c)';
          inp.focus();
          setTimeout(() => inp.style.borderColor = '', 1200);
          return;
        }
      }
      obGoTo(next);
    });
  });

  /* Seleção de opções (toggle) */
  document.querySelectorAll('.ob-options').forEach(group => {
    group.addEventListener('click', e => {
      const opt = e.target.closest('.ob-opt');
      if (!opt) return;
      group.querySelectorAll('.ob-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  /* Finish */
  document.getElementById('ob-finish')?.addEventListener('click', finishOnboarding);
}

/* ── Dados do tutorial ─────────────────────────────── */
const TUT_STEPS = [
  {
    label: '1 / 7',
    title: 'Tela de Hoje',
    desc:  'Veja todas as tarefas do dia divididas em "Agora", "Depois" e "Ideias". Conclua tarefas para ganhar XP.',
    visual: () => `
      <div class="tut-row">
        <div class="tut-icon-box" style="background:rgba(124,111,205,0.15);color:var(--accent)"><i class="fa-solid fa-circle-dot"></i></div>
        <div style="flex:1">
          <div class="tut-line" style="background:rgba(255,255,255,0.12);margin-bottom:6px"></div>
          <div class="tut-line short" style="background:rgba(255,255,255,0.07)"></div>
        </div>
        <div class="tut-badge" style="background:rgba(124,111,205,0.2);color:var(--accent)">+100 XP</div>
      </div>
      <div class="tut-row">
        <div class="tut-icon-box" style="background:rgba(78,205,196,0.12);color:#4ECDC4"><i class="fa-solid fa-circle-dot"></i></div>
        <div style="flex:1">
          <div class="tut-line" style="background:rgba(255,255,255,0.12);margin-bottom:6px"></div>
          <div class="tut-line short" style="background:rgba(255,255,255,0.07)"></div>
        </div>
        <div class="tut-badge" style="background:rgba(78,205,196,0.15);color:#4ECDC4">+60 XP</div>
      </div>
      <div class="tut-bar-track" style="margin-top:8px"><div class="tut-bar-fill" style="width:45%"></div></div>
      <div class="tut-highlight"></div>`,
  },
  {
    label: '2 / 7',
    title: 'Planejar',
    desc:  'Organize tarefas por data, categoria ou prioridade. Crie novas tarefas com # para categoria e ! para importância.',
    visual: () => `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        ${['Hoje','Amanhã','Semana','Atrasadas'].map((t,i) => `
          <div class="tut-badge" style="background:${i===0?'rgba(124,111,205,0.25)':'rgba(255,255,255,0.06)'};color:${i===0?'var(--accent)':'var(--text-sec)'};">${t}</div>
        `).join('')}
      </div>
      <div class="tut-row">
        <div class="tut-icon-box" style="background:rgba(255,255,255,0.06);color:var(--text-sec)"><i class="fa-solid fa-list-check"></i></div>
        <div style="flex:1"><div class="tut-line" style="background:rgba(255,255,255,0.12);margin-bottom:6px"></div><div class="tut-line xsmall" style="background:rgba(255,255,255,0.07)"></div></div>
      </div>
      <div class="tut-row">
        <div class="tut-icon-box" style="background:rgba(255,255,255,0.06);color:var(--text-sec)"><i class="fa-solid fa-list-check"></i></div>
        <div style="flex:1"><div class="tut-line" style="background:rgba(255,255,255,0.12);margin-bottom:6px"></div><div class="tut-line short" style="background:rgba(255,255,255,0.07)"></div></div>
      </div>
      <div class="tut-highlight"></div>`,
  },
  {
    label: '3 / 7',
    title: 'Modo Foco',
    desc:  'Use o timer Pomodoro para trabalhar com concentração total. Cada sessão concluída vira XP bônus.',
    visual: () => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0">
        <div style="position:relative;width:80px;height:80px">
          <svg viewBox="0 0 80 80" width="80" height="80" style="transform:rotate(-90deg)">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(124,111,205,0.12)" stroke-width="6"/>
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" stroke-width="6"
              stroke-linecap="round" stroke-dasharray="214" stroke-dashoffset="75"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;font-family:'Rajdhani',sans-serif">18:32</div>
        </div>
        <div style="display:flex;gap:12px">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;color:var(--text-sec)"><i class="fa-solid fa-rotate-left"></i></div>
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(124,111,205,0.2);display:flex;align-items:center;justify-content:center;color:var(--accent)"><i class="fa-solid fa-pause"></i></div>
        </div>
      </div>
      <div class="tut-highlight"></div>`,
  },
  {
    label: '4 / 7',
    title: 'Missões do Dia',
    desc:  'Desafios diários que renovam à meia-noite. Complete-os para ganhar XP extra e manter seu streak.',
    visual: () => `
      ${[
        { icon:'fa-solid fa-fire', label:'Completar 3 tarefas', pct:66, color:'var(--accent)' },
        { icon:'fa-solid fa-bolt', label:'Sessão de foco de 25 min', pct:100, color:'#4ECDC4' },
        { icon:'fa-solid fa-star', label:'0 tarefas atrasadas', pct:0, color:'rgba(255,200,0,0.8)' },
      ].map(m => `
        <div class="tut-row" style="margin-bottom:8px">
          <div class="tut-icon-box" style="background:rgba(255,255,255,0.06);color:${m.color}"><i class="${m.icon}"></i></div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text)">${m.label}</div>
            <div class="tut-bar-track"><div class="tut-bar-fill" style="width:${m.pct}%;background:${m.color}"></div></div>
          </div>
          ${m.pct===100?`<i class="fa-solid fa-circle-check" style="color:#4ECDC4;font-size:16px;margin-left:8px"></i>`:''}
        </div>
      `).join('')}
      <div class="tut-highlight"></div>`,
  },
  {
    label: '5 / 7',
    title: 'Conquistas',
    desc:  'Desbloqueie badges ao atingir marcos. Cada conquista revela uma nova habilidade ou título no seu perfil.',
    visual: () => `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:4px 0">
        ${[
          {icon:'fa-solid fa-fire',     color:'rgba(255,100,50,0.2)',  tc:'#FF6432', unlocked:true},
          {icon:'fa-solid fa-bolt',     color:'rgba(124,111,205,0.2)', tc:'var(--accent)', unlocked:true},
          {icon:'fa-solid fa-trophy',   color:'rgba(255,200,0,0.15)',  tc:'rgba(255,200,0,0.9)', unlocked:true},
          {icon:'fa-solid fa-brain',    color:'rgba(78,205,196,0.15)', tc:'#4ECDC4', unlocked:true},
          {icon:'fa-solid fa-star',     color:'rgba(255,255,255,0.05)',tc:'var(--text-sec)', unlocked:false},
          {icon:'fa-solid fa-rocket',   color:'rgba(255,255,255,0.05)',tc:'var(--text-sec)', unlocked:false},
          {icon:'fa-solid fa-crown',    color:'rgba(255,255,255,0.05)',tc:'var(--text-sec)', unlocked:false},
          {icon:'fa-solid fa-gem',      color:'rgba(255,255,255,0.05)',tc:'var(--text-sec)', unlocked:false},
        ].map(b => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <div style="width:44px;height:44px;border-radius:12px;background:${b.color};display:flex;align-items:center;justify-content:center;font-size:18px;color:${b.tc};${b.unlocked?'':'filter:grayscale(1);opacity:0.35'}">
              <i class="${b.icon}"></i>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="tut-highlight"></div>`,
  },
  {
    label: '6 / 7',
    title: 'Linha do Tempo',
    desc:  'Um histórico visual de tudo que você conquistou. Cada tarefa concluída e nível alcançado fica registrado aqui.',
    visual: () => `
      <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
        ${[
          {icon:'fa-solid fa-rocket',   color:'var(--accent)',  label:'Daily XP iniciado!',       time:'Hoje'},
          {icon:'fa-solid fa-check',    color:'#4ECDC4',        label:'Tarefa concluída',          time:'Hoje'},
          {icon:'fa-solid fa-trophy',   color:'rgba(255,200,0,0.9)', label:'Nível 2 atingido!',   time:'Hoje'},
          {icon:'fa-solid fa-fire',     color:'#FF6432',        label:'Streak de 3 dias!',         time:'Ontem'},
        ].map(e => `
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:13px;color:${e.color};flex-shrink:0">
              <i class="${e.icon}"></i>
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:var(--text)">${e.label}</div>
              <div style="font-size:11px;color:var(--text-sec)">${e.time}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="tut-highlight"></div>`,
  },
  {
    label: '7 / 7',
    title: 'XP e Níveis',
    desc:  'Cada tarefa concluída gera XP. Suba de nível, desbloqueie títulos e mantenha seu streak diário aceso!',
    visual: () => `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
        <div style="width:52px;height:52px;border-radius:50%;background:rgba(124,111,205,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;font-family:'Rajdhani',sans-serif;color:var(--accent)">1</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">Nível 1 → Nível 2</div>
          <div class="tut-bar-track"><div class="tut-bar-fill" style="width:60%"></div></div>
          <div style="font-size:11px;color:var(--text-sec);margin-top:4px">300 / 500 XP</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[
          {label:'Obrigatório',xp:'100 XP',color:'var(--accent)'},
          {label:'Necessário', xp:'60 XP', color:'#4ECDC4'},
          {label:'Padrão',     xp:'30 XP', color:'rgba(255,200,0,0.9)'},
          {label:'Ideia',      xp:'10 XP', color:'var(--text-sec)'},
        ].map(r => `
          <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:var(--text-sec)">${r.label}</span>
            <span style="font-size:12px;font-weight:800;color:${r.color}">${r.xp}</span>
          </div>
        `).join('')}
      </div>
      <div class="tut-highlight"></div>`,
  },
];

/* ── Animação de conclusão (step 7) ────────────────── */
function playFinishAnim(onDone) {
  obGoTo('ob-7');

  const arc    = document.getElementById('ob-ring-arc');
  const icon   = document.getElementById('ob-ring-icon');
  const label  = document.getElementById('ob-finish-label');
  const sub    = document.getElementById('ob-finish-sub');

  label.textContent = 'Tudo pronto!';
  sub.textContent   = 'Sua jornada começa agora.';

  /* SVG gradient inline */
  const svg = arc.closest('svg');
  if (!svg.querySelector('#ob-grad')) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = `<linearGradient id="ob-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#7C6FCD"/>
      <stop offset="100%" stop-color="#4ECDC4"/>
    </linearGradient>`;
    svg.prepend(defs);
  }

  /* 1. Completar o arco */
  setTimeout(() => arc.classList.add('complete'), 80);

  /* 2. Mostrar ícone */
  setTimeout(() => icon.classList.add('show'), 900);

  /* 3. Explodir */
  setTimeout(() => {
    icon.classList.add('explode');
    spawnBurst();
  }, 1300);

  /* 4. Mostrar textos */
  setTimeout(() => {
    label.classList.add('show');
  }, 1700);
  setTimeout(() => sub.classList.add('show'), 2200);

  /* 5. Avançar para tutorial */
  setTimeout(() => onDone(), 3200);
}

function spawnBurst() {
  const wrap = document.querySelector('.ob-ring-wrap');
  if (!wrap) return;
  const colors = ['#7C6FCD','#4ECDC4','#FF6432','#FFD166','#a29bfe'];
  const burst  = document.createElementNS ? document.createElement('div') : null;
  if (!burst) return;
  burst.className = 'ob-burst';
  wrap.appendChild(burst);

  for (let i = 0; i < 14; i++) {
    const dot   = document.createElement('div');
    dot.className = 'ob-burst-dot';
    const angle = (i / 14) * 360;
    const dist  = 55 + Math.random() * 30;
    const rad   = angle * Math.PI / 180;
    dot.style.cssText = `
      --bx: ${Math.cos(rad)*dist}px;
      --by: ${Math.sin(rad)*dist}px;
      background: ${colors[i % colors.length]};
      animation-delay: ${Math.random()*0.1}s;
    `;
    burst.appendChild(dot);
  }
  setTimeout(() => burst.remove(), 900);
}

/* ── Tutorial (step 8) ─────────────────────────────── */
let tutIdx = 0;

function initTutorial() {
  tutIdx = 0;
  renderTutStep();

  document.getElementById('ob-tut-next').addEventListener('click', () => {
    tutIdx++;
    if (tutIdx >= TUT_STEPS.length) {
      endOnboarding();
    } else {
      renderTutStep();
    }
  });

  document.getElementById('ob-tut-skip').addEventListener('click', endOnboarding);
}

function renderTutStep() {
  const step = TUT_STEPS[tutIdx];
  const isLast = tutIdx === TUT_STEPS.length - 1;

  /* Força re-trigger da animação typewriter clonando o elemento */
  function reAnimate(id, newText) {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    clone.textContent = newText;
    el.parentNode.replaceChild(clone, el);
  }

  reAnimate('ob-tut-step-label', step.label);
  reAnimate('ob-tut-title',      step.title);

  const desc = document.getElementById('ob-tut-desc');
  if (desc) {
    desc.style.opacity = '0';
    desc.textContent   = step.desc;
    setTimeout(() => desc.style.opacity = '1', 550);
  }

  /* Visual */
  const vis = document.getElementById('ob-tut-visual');
  if (vis) {
    vis.style.animation = 'none';
    vis.offsetHeight; /* reflow */
    vis.style.animation = '';
    vis.innerHTML = step.visual();
  }

  /* Dots */
  const dotsEl = document.getElementById('ob-tut-dots');
  if (dotsEl) {
    dotsEl.innerHTML = TUT_STEPS.map((_,i) =>
      `<div class="ob-tut-dot ${i===tutIdx?'active':''}"></div>`
    ).join('');
  }

  /* Botão */
  const btn = document.getElementById('ob-tut-next');
  if (btn) btn.textContent = isLast ? 'Começar!' : 'Próximo';
}

/* ── Encerrar tudo ─────────────────────────────────── */
function endOnboarding() {
  if (stopParticles) stopParticles();
  addTimelineItem('fa-solid fa-rocket', 'Daily XP iniciado!');
  applyTemplatesForUser();
  save();
  launchApp();

}

/* ── finishOnboarding: salva state e dispara animação ── */
function finishOnboarding() {
  const name = document.getElementById('ob-name').value.trim();
  if (name) state.userName = name;

  const profSel = document.querySelector('#ob-profile-opts .ob-opt.selected');
  if (profSel) state.userProfile = profSel.dataset.val;

  const rhythmSel = document.querySelector('#ob-rhythm-opts .ob-opt.selected');
  if (rhythmSel) state.userRhythm = rhythmSel.dataset.val;

  const peakSel = document.querySelector('#ob-peak-opts .ob-opt.selected');
  if (peakSel) state.userPeak = peakSel.dataset.val;

  const challengeSel = document.querySelector('#ob-challenge-opts .ob-opt.selected');
  if (challengeSel) state.userChallenge = challengeSel.dataset.val;

  state.dailyGoal      = obDailyGoal;
  state.onboardingDone = true;

  /* Animação → tutorial → app */
  playFinishAnim(() => {
    obGoTo('ob-8');
    initTutorial();
  });
}
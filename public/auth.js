const Auth = (() => {

  /* ── Estado ─────────────────────────────────────────── */
  let activePanel = 'login';

  /* ── Referências DOM ────────────────────────────────── */
  const screen        = () => document.getElementById('auth-screen');
  const tabs          = () => document.querySelectorAll('.auth-tab');
  const loginPanel    = () => document.getElementById('auth-login-panel');
  const registerPanel = () => document.getElementById('auth-register-panel');
  const feedback      = () => document.getElementById('auth-feedback');

  /* ── Helpers visuais ─────────────────────────────────── */
  function showFeedback(msg, type = 'error') {
    const el = feedback();
    el.textContent = msg;
    el.className = `auth-feedback ${type}`;
  }
  function hideFeedback() {
    feedback().className = 'auth-feedback hidden';
  }
  function setLoading(btn, on) {
    btn.classList.toggle('loading', on);
    btn.disabled = on;
  }
  function clearAuthStorage() {
    localStorage.removeItem('nxp_user_token');
    localStorage.removeItem('dxp2_lastopen');
  }

  /* ── Força da senha ──────────────────────────────────── */
  function calcStrength(pwd) {
    let score = 0;
    if (pwd.length >= 6)           score++;
    if (pwd.length >= 10)          score++;
    if (/[A-Z]/.test(pwd))         score++;
    if (/[0-9]/.test(pwd))         score++;
    if (/[^A-Za-z0-9]/.test(pwd))  score++;
    return score;
  }
  function renderStrength(score) {
    const fill  = document.getElementById('auth-strength-fill');
    const label = document.getElementById('auth-strength-label');
    const map = [
      { w: '0%',   color: '',                     text: ''       },
      { w: '25%',  color: 'var(--accent-danger)', text: 'Fraca'  },
      { w: '50%',  color: 'var(--accent-warn)',   text: 'Média'  },
      { w: '75%',  color: 'var(--accent-blue)',   text: 'Boa'    },
      { w: '90%',  color: 'var(--accent-teal)',   text: 'Forte'  },
      { w: '100%', color: 'var(--accent-teal)',   text: 'Ótima'  },
    ];
    const s = map[score] || map[0];
    fill.style.width      = s.w;
    fill.style.background = s.color;
    label.textContent     = s.text;
    label.style.color     = s.color;
  }

  /* ── Toggle visibilidade de senha ───────────────────── */
  function initEyeToggle(inputId, btnId) {
    const btn = document.getElementById(btnId);
    const inp = document.getElementById(inputId);
    if (!btn || !inp) return;
    btn.addEventListener('click', () => {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.querySelector('i').className = show
        ? 'fa-regular fa-eye-slash'
        : 'fa-regular fa-eye';
    });
  }

  /* ── Troca de painel ────────────────────────────────── */
  function switchPanel(tab) {
    activePanel = tab;
    hideFeedback();
    tabs().forEach(t => t.classList.toggle('active', t.dataset.auth === tab));
    loginPanel().classList.toggle('hidden',    tab !== 'login');
    registerPanel().classList.toggle('hidden', tab !== 'register');
  }

  /* ── Validação ───────────────────────────────────────── */
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /* ── API ─────────────────────────────────────────────── */
  async function apiPost(endpoint, body) {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro desconhecido.');
    return data;
  }

  /* ── Aplica state recebido do backend ───────────────── */
  function applyRemoteState(remoteState) {
    // Preenche campos novos que possam não existir no state salvo
    const def = defaultState();
    for (const k of Object.keys(def)) {
      if (remoteState[k] === undefined) remoteState[k] = def[k];
    }
    Object.assign(state, remoteState);
  }

  /* ── Login ───────────────────────────────────────────── */
  async function handleLogin() {
    const email = document.getElementById('auth-login-email').value.trim();
    const pass  = document.getElementById('auth-login-pass').value;
    const btn   = document.getElementById('auth-login-btn');

    hideFeedback();
    if (!validateEmail(email)) return showFeedback('Informe um e-mail válido.');
    if (!pass)                 return showFeedback('Informe sua senha.');

    setLoading(btn, true);
    try {
      const data = await apiPost('/api/auth/login', { email, password: pass });

      localStorage.setItem('nxp_user_token', data.token);
      applyRemoteState(data.state);

      hide();
      data.state.onboardingDone ? await launchApp(true) : startOnboarding();

    } catch (err) {
      clearAuthStorage();
      showFeedback(err.message);
    } finally {
      setLoading(btn, false);
    }
  }

  /* ── Registro ────────────────────────────────────────── */
  async function handleRegister() {
    const name  = document.getElementById('auth-reg-name').value.trim();
    const email = document.getElementById('auth-reg-email').value.trim();
    const pass  = document.getElementById('auth-reg-pass').value;
    const btn   = document.getElementById('auth-register-btn');

    hideFeedback();
    if (!name)                 return showFeedback('Informe seu nome.');
    if (!validateEmail(email)) return showFeedback('Informe um e-mail válido.');
    if (pass.length < 6)       return showFeedback('A senha deve ter pelo menos 6 caracteres.');

    setLoading(btn, true);
    try {
      const data = await apiPost('/api/auth/register', { name, email, password: pass });

      localStorage.setItem('nxp_user_token', data.token);
      applyRemoteState(data.state);

      hide();
      startOnboarding(); // conta nova → sempre onboarding

    } catch (err) {
      clearAuthStorage();
      showFeedback(err.message);
    } finally {
      setLoading(btn, false);
    }
  }

  /* ── Tagline rotativa ───────────────────────────────── */
function initTagline() {
  const msgs = [
    'Pare de procrastinar.',
    'Planeje sua vida.',
    'Complete missões. Ganhe XP.',
    'Suas metas, gamificadas.',
    'Pequenos hábitos. Grandes conquistas.',
    'Foco total. Recompensas reais.',
    'Sua versão mais produtiva começa aqui.',
  ];

  const el = document.querySelector('.auth-tagline-text');
  if (!el) return;

  let i = 0;
  function next() {
    /* saída */
    el.classList.remove('visible');
    el.classList.add('leaving');

    setTimeout(() => {
      /* troca o texto */
      i = (i + 1) % msgs.length;
      el.textContent = msgs[i];
      el.classList.remove('leaving');

      /* entrada */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('visible'));
      });
    }, 500); /* aguarda a transição de saída (0.5s) */
  }

  /* exibe o primeiro imediatamente */
  el.textContent = msgs[0];
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('visible'));
  });

  setInterval(next, 3200);
}

  /* ── Init ────────────────────────────────────────────── */
  function init() {
    function initParticles(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
      
        /* ── Configuração ─────────────────────────── */
        const PARTICLE_COUNT = 52;
        const SYMBOLS = ['⚔', '✦', '◈', '⬡', '✺', '⟡'];
        const COLORS  = [
          'rgba(124,111,205,',   // accent purple
          'rgba(78,205,196,',    // teal
          'rgba(255,209,102,',   // gold (XP)
          'rgba(239,71,111,',    // danger (boss)
        ];
      
        let W, H, particles = [], raf;
      
        /* ── Partícula ─────────────────────────────── */
        function mkParticle(forceBottom = false) {
          const color = COLORS[Math.floor(Math.random() * COLORS.length)];
          return {
            x:       Math.random() * W,
            y:       forceBottom ? H + 12 : Math.random() * H,
            size:    Math.random() * 11 + 5,
            speedY:  -(Math.random() * 0.28 + 0.10),
            speedX:  (Math.random() - 0.5) * 0.12,
            alpha:   0,
            alphaT:  Math.random() * 0.32 + 0.10,   // alvo de opacidade
            fadeIn:  true,
            symbol:  SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            color,
            rot:     Math.random() * Math.PI * 2,
            rotSpd:  (Math.random() - 0.5) * 0.008,
            drift:   Math.random() * Math.PI * 2,    // oscilação horizontal
            driftSpd:Math.random() * 0.012 + 0.004,
          };
        }
      
        /* ── Resize ─────────────────────────────────── */
        function resize() {
          W = canvas.width  = window.innerWidth;
          H = canvas.height = window.innerHeight;
        }
      
        /* ── Loop ───────────────────────────────────── */
        function tick() {
          ctx.clearRect(0, 0, W, H);
      
          for (const p of particles) {
            /* movimento */
            p.drift += p.driftSpd;
            p.x     += p.speedX + Math.sin(p.drift) * 0.22;
            p.y     += p.speedY;
            p.rot   += p.rotSpd;
      
            /* fade in / out */
            if (p.fadeIn) {
              p.alpha += 0.008;
              if (p.alpha >= p.alphaT) p.fadeIn = false;
            } else {
              p.alpha -= 0.0025;
            }
      
            /* recicla quando saiu da tela ou sumiu */
            if (p.y < -20 || p.alpha <= 0) {
              Object.assign(p, mkParticle(true));
              continue;
            }
      
            /* desenha */
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.font        = `${p.size}px sans-serif`;
            ctx.fillStyle   = p.color + p.alpha.toFixed(2) + ')';
            ctx.textAlign   = 'center';
            ctx.textBaseline= 'middle';
            ctx.fillText(p.symbol, 0, 0);
            ctx.restore();
          }
      
          raf = requestAnimationFrame(tick);
        }
      
        /* ── Init ───────────────────────────────────── */
        resize();
        window.addEventListener('resize', resize);
        particles = Array.from({ length: PARTICLE_COUNT }, () => mkParticle(false));
        tick();
        initTagline();
        /* Para a animação quando a tela de auth sair do DOM */
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
      }
    tabs().forEach(tab => {
      tab.addEventListener('click', () => switchPanel(tab.dataset.auth));
    });

    initEyeToggle('auth-login-pass', 'auth-login-eye');
    initEyeToggle('auth-reg-pass',   'auth-reg-eye');

    const regPass = document.getElementById('auth-reg-pass');
    regPass?.addEventListener('input', () => {
      renderStrength(regPass.value ? calcStrength(regPass.value) : 0);
    });

    document.getElementById('auth-login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('auth-register-btn')?.addEventListener('click', handleRegister);

    ['auth-login-email', 'auth-login-pass'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleLogin();
      });
    });
    ['auth-reg-name', 'auth-reg-email', 'auth-reg-pass'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleRegister();
      });
    });

    document.getElementById('auth-google-btn')?.addEventListener('click', () => {
      showFeedback('Login com Google em breve!', 'success');
    });
  }

  function show() { screen().classList.remove('hidden'); }
  function hide() { screen().classList.add('hidden'); }
  initTagline();
  return { init, show, hide };
})();
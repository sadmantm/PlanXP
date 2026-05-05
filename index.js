const express  = require('express');
const path     = require('path');
const { askGemini } = require('./gemini');
const multer = require('multer');
const os     = require('os');
const fs     = require('fs');
const { transcribeWithWhisperWeb } = require("./whisper");
const { execFile } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nextxp_dev_secret_troque_em_prod';
const SALT_ROUNDS = 10;
const cors = require('cors');

app.use(cors({
  origin: ['https://planxp.app.br', 'https://www.planxp.app.br'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* ── Banco de dados (SQLite) ─────────────────────────────── */
const db = new Database(path.join(__dirname, 'nextxp.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ── Middlewares ─────────────────────────────────────────── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── Multer ──────────────────────────────────────────────── */
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // FIX: Android WebView envia 'audio/webm;codecs=opus' — checar com startsWith/includes
    const mime = file.mimetype || '';
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
                     'audio/webm', 'audio/x-m4a', 'audio/aac', 'audio/mp3'];
    const ok = allowed.some(a => mime === a || mime.startsWith(a));
    if (ok) return cb(null, true);
    cb(new Error(`Tipo de arquivo não suportado: ${mime}`));
  },
});


// tabela de contas e usuários
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_state (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// tabela de empresas
db.exec(`
  CREATE TABLE IF NOT EXISTS empresas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT    NOT NULL,
    segmento   TEXT    NOT NULL DEFAULT 'Tecnologia',
    codigo     TEXT    NOT NULL UNIQUE,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS empresa_membros (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    grupo_id   INTEGER REFERENCES empresa_grupos(id)    ON DELETE SET NULL,
    is_admin   INTEGER NOT NULL DEFAULT 0,
    joined_at  TEXT    DEFAULT (datetime('now')),
    UNIQUE(empresa_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS empresa_grupos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome       TEXT    NOT NULL,
    finalidade TEXT    DEFAULT '',
    cor        TEXT    NOT NULL DEFAULT '#7C6FCD',
    icone      TEXT    NOT NULL DEFAULT 'fa-users',
    created_at TEXT    DEFAULT (datetime('now'))
  );
`);

// tabelas de tarefas atribuídas
db.exec(`
  CREATE TABLE IF NOT EXISTS empresa_tarefas_atribuidas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id    INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    assignee_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    assigned_by   INTEGER NOT NULL REFERENCES users(id),
    tarefa_json   TEXT    NOT NULL,
    concluida     INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    DEFAULT (datetime('now'))
  );
`);

// histórico diário para resumo do dia
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date          TEXT    NOT NULL,             -- YYYY-MM-DD
    xp_earned     INTEGER NOT NULL DEFAULT 0,
    tasks_done    INTEGER NOT NULL DEFAULT 0,
    focus_sessions INTEGER NOT NULL DEFAULT 0,
    updated_at    TEXT    DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
  );
`);

// #region Jobs
const jobs = new Map(); // jobId → { status, result, error, createdAt }

function createJob() {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(id, { status: "pending", result: null, error: null, createdAt: Date.now() });
  return id;
}

function setJobDone(id, result) {
  const j = jobs.get(id);
  if (j) jobs.set(id, { ...j, status: "done", result });
}

function setJobError(id, error) {
  const j = jobs.get(id);
  if (j) jobs.set(id, { ...j, status: "error", error });
}

// Limpeza automática de jobs antigos (>10min)
setInterval(() => {
  const limit = Date.now() - 10 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < limit) jobs.delete(id);
  }
}, 60_000);

// #endregion

function getEmpresaDoUsuario(userId) {
  return db.prepare(`
    SELECT e.*, em.is_admin, em.grupo_id AS meu_grupo_id
    FROM empresas e
    JOIN empresa_membros em ON em.empresa_id = e.id
    WHERE em.user_id = ?
    LIMIT 1
  `).get(userId);
}

/* ── Helper: monta payload completo da empresa ────────────── */
function empresaPayload(empresa, userId) {
  const grupos = db.prepare(`
    SELECT * FROM empresa_grupos WHERE empresa_id = ? ORDER BY id
  `).all(empresa.id);

  const membros = db.prepare(`
    SELECT em.user_id AS id, u.name AS nome,
           em.is_admin AS isAdmin, em.grupo_id AS grupoId,
           (em.user_id = ?) AS isMe
    FROM empresa_membros em
    JOIN users u ON u.id = em.user_id
    WHERE em.empresa_id = ?
    ORDER BY em.is_admin DESC, u.name
  `).all(userId, empresa.id);

  // Tarefas atribuídas — sempre carregadas (admin vê todas, membro vê as suas)
  const tarefasRows = db.prepare(`
    SELECT eta.id AS rowId, eta.assignee_id, eta.assigned_by,
           eta.tarefa_json, eta.concluida, eta.created_at,
           u.name AS assignee_nome
    FROM empresa_tarefas_atribuidas eta
    JOIN users u ON u.id = eta.assignee_id
    WHERE eta.empresa_id = ?
    ORDER BY eta.created_at DESC
  `).all(empresa.id);

  const tarefas = tarefasRows.map(r => {
    let t = {};
    try { t = JSON.parse(r.tarefa_json); } catch {}
    return {
      rowId:      r.rowId,
      assigneeId: r.assignee_id,
      concluida:  Boolean(r.concluida),
      titulo:     t.title     || '',
      dueDate:    t.dueDate   || null,
      importance: t.importance || 'Padrão',
    };
  });

  return {
    id:       empresa.id,
    nome:     empresa.nome,
    segmento: empresa.segmento,
    codigo:   empresa.codigo,
    isAdmin:  Boolean(empresa.is_admin),
    grupos:   grupos.map(g => ({
      id: g.id, nome: g.nome, finalidade: g.finalidade, cor: g.cor, icone: g.icone,
    })),
    membros: membros.map(m => ({
      id: m.id, nome: m.nome, isAdmin: Boolean(m.isAdmin), grupoId: m.grupoId, isMe: Boolean(m.isMe),
    })),
    tarefas,
  };
}

/* ── Helpers de auth ─────────────────────────────────────── */
function makeToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Token ausente.' }); return null; }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return null;
  }
}

function defaultState(name) {
  return {
    userName: name,
    userProfile: 'Projetos Pessoais',
    userRhythm: 'moderado',
    onboardingDone: false,
    tasks: [],
    categories: [
      { id: 'empresa', name: 'Empresa', icon: 'fa-solid fa-briefcase', color: '#7C6FCD' },
      { id: 'pessoal', name: 'Pessoal', icon: 'fa-solid fa-house',     color: '#5B8DEF' },
      { id: 'saude',   name: 'Saúde',   icon: 'fa-solid fa-heart',     color: '#EF476F' },
      { id: 'ideias',  name: 'Ideias',  icon: 'fa-solid fa-lightbulb', color: '#FFD166' },
    ],
    totalXP: 0, todayXP: 0, coins: 0, level: 1, streak: 0,
    lastActiveDate: null, tasksCompleted: 0, missionsCompleted: 0,
    focusSessions: 0, missions: [], missionsDate: null,
    timeline: [], dailyHistory: {}, gestureHintSeen: false,
    activeTab: 'today', planView: 'today', planCat: null,
  };
}

/* ── POST /api/auth/register ─────────────────────────────── */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Campos name, email e password são obrigatórios.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists)
    return res.status(409).json({ error: 'E-mail já cadastrado.' });

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const info = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
                   .run(name.trim(), email.toLowerCase(), hash);

    const userId = info.lastInsertRowid;
    const state  = defaultState(name.trim());

    db.prepare('INSERT INTO user_state (user_id, state_json) VALUES (?, ?)')
      .run(userId, JSON.stringify(state));

    return res.status(201).json({ token: makeToken(userId), state });
  } catch (err) {
    console.error('[auth/register]', err.message);
    return res.status(500).json({ error: 'Erro ao criar conta.' });
  }
});

/* ── POST /api/auth/login ────────────────────────────────── */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Campos email e password são obrigatórios.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

  const row   = db.prepare('SELECT state_json FROM user_state WHERE user_id = ?').get(user.id);
  const state = row ? JSON.parse(row.state_json) : defaultState(user.name);

  return res.json({ token: makeToken(user.id), state });
});

/* ── POST /api/auth/auto-login ───────────────────────────── */
app.post('/api/auth/auto-login', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(payload.sub);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });

  const row   = db.prepare('SELECT state_json FROM user_state WHERE user_id = ?').get(user.id);
  const state = row ? JSON.parse(row.state_json) : defaultState(user.name);

  return res.json({ state });
});

/* ── PUT /api/auth/state ─────────────────────────────────── */
app.put('/api/auth/state', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const { state } = req.body;
  if (!state) return res.status(400).json({ error: 'Campo "state" ausente.' });

  db.prepare(`
    INSERT INTO user_state (user_id, state_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).run(payload.sub, JSON.stringify(state));

  return res.json({ ok: true });
});

/* ── POST /api/expand-task ───────────────────────────────── */
app.post("/api/expand-task", async (req, res) => {
  const { task, user } = req.body;
  if (!task || !user)
    return res.status(400).json({ error: 'Campos "task" e "user" são obrigatórios.' });

  const jobId = createJob();
  res.json({ jobId });

  askGemini(buildPrompt(task, user))
    .then(raw => setJobDone(jobId, extractJSON(raw)))
    .catch(err => {
      console.error("[expand-task] erro:", err.message);
      setJobError(jobId, err.message);
    });
});

// ─── POST /api/suggest-subtasks ───────────────────────────────────────────────

app.post("/api/suggest-subtasks", async (req, res) => {
  const { task, user, extraContext } = req.body;
  if (!task || !user)
    return res.status(400).json({ error: 'Campos "task" e "user" são obrigatórios.' });

  const jobId = createJob();
  res.json({ jobId });

  askGemini(buildSuggestPrompt(task, user, extraContext))
    .then(raw => setJobDone(jobId, extractJSON(raw)))
    .catch(err => {
      console.error("[suggest-subtasks] erro:", err.message);
      setJobError(jobId, err.message);
    });
});


/* ── POST /api/transcribe ────────────────────────────────── */
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(ffmpeg, ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-f', 'wav', outputPath],
      (err, _stdout, stderr) => {
        if (err) { console.error('[ffmpeg] stderr:', stderr); return reject(err); }
        resolve(outputPath);
      });
  });
}

/* ── POST /api/empresa — criar empresa ───────────────────── */
app.post('/api/empresa', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const { nome, segmento = 'Tecnologia' } = req.body;
  if (!nome?.trim())
    return res.status(400).json({ error: 'Campo "nome" obrigatório.' });

  const jaTemEmpresa = getEmpresaDoUsuario(payload.sub);
  if (jaTemEmpresa)
    return res.status(409).json({ error: 'Você já pertence a uma empresa.' });

  const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

  const criarEmpresa = db.transaction(() => {
    const { lastInsertRowid: empresaId } = db.prepare(
      'INSERT INTO empresas (nome, segmento, codigo) VALUES (?, ?, ?)'
    ).run(nome.trim(), segmento, codigo);

    db.prepare(
      'INSERT INTO empresa_membros (empresa_id, user_id, is_admin) VALUES (?, ?, 1)'
    ).run(empresaId, payload.sub);

    return db.prepare('SELECT *, 1 AS is_admin FROM empresas WHERE id = ?').get(empresaId);
  });

  const empresa = criarEmpresa();
  return res.status(201).json(empresaPayload(empresa, payload.sub));
});

/* ── POST /api/empresa/entrar — entrar pelo código ───────── */
app.post('/api/empresa/entrar', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const { codigo } = req.body;
  if (!codigo?.trim())
    return res.status(400).json({ error: 'Campo "codigo" obrigatório.' });

  const jaTemEmpresa = getEmpresaDoUsuario(payload.sub);
  if (jaTemEmpresa)
    return res.status(409).json({ error: 'Você já pertence a uma empresa.' });

  const empresa = db.prepare('SELECT * FROM empresas WHERE codigo = ?')
                    .get(codigo.trim().toUpperCase());
  if (!empresa)
    return res.status(404).json({ error: 'Código de convite inválido.' });

  db.prepare(
    'INSERT INTO empresa_membros (empresa_id, user_id, is_admin) VALUES (?, ?, 0)'
  ).run(empresa.id, payload.sub);

  empresa.is_admin = 0;
  return res.status(200).json(empresaPayload(empresa, payload.sub));
});

/* ── GET /api/empresa — dados da empresa do usuário ─────── */
app.get('/api/empresa', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa) return res.json(null);

  return res.json(empresaPayload(empresa, payload.sub));
});

/* ── PUT /api/empresa — atualizar nome/segmento ─────────── */
app.put('/api/empresa', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa)       return res.status(404).json({ error: 'Empresa não encontrada.' });
  if (!empresa.is_admin) return res.status(403).json({ error: 'Apenas admins podem editar.' });

  const { nome, segmento } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Campo "nome" obrigatório.' });

  db.prepare('UPDATE empresas SET nome = ?, segmento = ? WHERE id = ?')
    .run(nome.trim(), segmento || empresa.segmento, empresa.id);

  return res.json(empresaPayload(
    { ...empresa, nome: nome.trim(), segmento: segmento || empresa.segmento },
    payload.sub
  ));
});

/* ── DELETE /api/empresa — excluir empresa (admin) ──────── */
app.delete('/api/empresa', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa)       return res.status(404).json({ error: 'Empresa não encontrada.' });
  if (!empresa.is_admin) return res.status(403).json({ error: 'Apenas admins podem excluir.' });

  db.prepare('DELETE FROM empresas WHERE id = ?').run(empresa.id);
  return res.json({ ok: true });
});

/* ── DELETE /api/empresa/sair — sair da empresa ─────────── */
app.delete('/api/empresa/sair', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa) return res.status(404).json({ error: 'Você não está em nenhuma empresa.' });

  if (empresa.is_admin) {
    const outrosAdmins = db.prepare(`
      SELECT COUNT(*) AS c FROM empresa_membros
      WHERE empresa_id = ? AND user_id != ? AND is_admin = 1
    `).get(empresa.id, payload.sub).c;

    if (!outrosAdmins)
      return res.status(400).json({ error: 'Transfira o cargo de admin antes de sair.' });
  }

  db.prepare('DELETE FROM empresa_membros WHERE empresa_id = ? AND user_id = ?')
    .run(empresa.id, payload.sub);

  return res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════════
   GRUPOS
   ═══════════════════════════════════════════════════════════ */

/* ── POST /api/empresa/grupos ────────────────────────────── */
app.post('/api/empresa/grupos', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa)       return res.status(404).json({ error: 'Empresa não encontrada.' });
  if (!empresa.is_admin) return res.status(403).json({ error: 'Apenas admins podem criar grupos.' });

  const { nome, finalidade = '', cor = '#7C6FCD', icone = 'fa-users' } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Campo "nome" obrigatório.' });

  const { lastInsertRowid: id } = db.prepare(
    'INSERT INTO empresa_grupos (empresa_id, nome, finalidade, cor, icone) VALUES (?, ?, ?, ?, ?)'
  ).run(empresa.id, nome.trim(), finalidade, cor, icone);

  return res.status(201).json({ id, nome: nome.trim(), finalidade, cor, icone });
});

/* ── PUT /api/empresa/grupos/:id ─────────────────────────── */
app.put('/api/empresa/grupos/:id', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa)       return res.status(404).json({ error: 'Empresa não encontrada.' });
  if (!empresa.is_admin) return res.status(403).json({ error: 'Apenas admins podem editar grupos.' });

  const grupo = db.prepare('SELECT * FROM empresa_grupos WHERE id = ? AND empresa_id = ?')
                  .get(req.params.id, empresa.id);
  if (!grupo) return res.status(404).json({ error: 'Grupo não encontrado.' });

  const { nome, finalidade, cor, icone } = req.body;
  if (!nome?.trim()) return res.status(400).json({ error: 'Campo "nome" obrigatório.' });

  db.prepare('UPDATE empresa_grupos SET nome = ?, finalidade = ?, cor = ?, icone = ? WHERE id = ?')
    .run(nome.trim(), finalidade ?? grupo.finalidade, cor ?? grupo.cor, icone ?? grupo.icone, grupo.id);

  return res.json({ id: grupo.id, nome: nome.trim(), finalidade, cor, icone });
});

/* ── DELETE /api/empresa/grupos/:id ──────────────────────── */
app.delete('/api/empresa/grupos/:id', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa)       return res.status(404).json({ error: 'Empresa não encontrada.' });
  if (!empresa.is_admin) return res.status(403).json({ error: 'Apenas admins podem remover grupos.' });

  const grupo = db.prepare('SELECT id FROM empresa_grupos WHERE id = ? AND empresa_id = ?')
                  .get(req.params.id, empresa.id);
  if (!grupo) return res.status(404).json({ error: 'Grupo não encontrado.' });

  // ON DELETE SET NULL cuida dos membros automaticamente
  db.prepare('DELETE FROM empresa_grupos WHERE id = ?').run(grupo.id);
  return res.json({ ok: true });
});

/* ═══════════════════════════════════════════════════════════
   MEMBROS
   ═══════════════════════════════════════════════════════════ */

/* ── PUT /api/empresa/membros/:userId — atribuir grupo ───── */
app.put('/api/empresa/membros/:userId', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa)       return res.status(404).json({ error: 'Empresa não encontrada.' });
  if (!empresa.is_admin) return res.status(403).json({ error: 'Apenas admins podem editar membros.' });

  const { grupoId = null, isAdmin } = req.body;

  // Valida que o grupo pertence à mesma empresa (se informado)
  if (grupoId) {
    const grupo = db.prepare('SELECT id FROM empresa_grupos WHERE id = ? AND empresa_id = ?')
                    .get(grupoId, empresa.id);
    if (!grupo) return res.status(400).json({ error: 'Grupo não pertence a esta empresa.' });
  }

  // Impede o único admin de se rebaixar
  if (isAdmin === false && String(req.params.userId) === String(payload.sub)) {
    const outrosAdmins = db.prepare(`
      SELECT COUNT(*) AS c FROM empresa_membros
      WHERE empresa_id = ? AND user_id != ? AND is_admin = 1
    `).get(empresa.id, payload.sub).c;
    if (!outrosAdmins)
      return res.status(400).json({ error: 'Deve haver pelo menos um administrador.' });
  }

  const campos = ['grupo_id = ?'];
  const valores = [grupoId];
  if (isAdmin !== undefined) { campos.push('is_admin = ?'); valores.push(isAdmin ? 1 : 0); }
  valores.push(empresa.id, req.params.userId);

  db.prepare(`UPDATE empresa_membros SET ${campos.join(', ')} WHERE empresa_id = ? AND user_id = ?`)
    .run(...valores);

  return res.json({ ok: true });
});

/* ── DELETE /api/empresa/membros/:userId — remover membro ── */
app.delete('/api/empresa/membros/:userId', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa)       return res.status(404).json({ error: 'Empresa não encontrada.' });
  if (!empresa.is_admin) return res.status(403).json({ error: 'Apenas admins podem remover membros.' });

  if (String(req.params.userId) === String(payload.sub))
    return res.status(400).json({ error: 'Use /api/empresa/sair para sair da empresa.' });

  db.prepare('DELETE FROM empresa_membros WHERE empresa_id = ? AND user_id = ?')
    .run(empresa.id, req.params.userId);

  return res.json({ ok: true });
});

// Rota POST — atribuir tarefa
app.post('/api/empresa/membros/:userId/tarefas', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const empresa = getEmpresaDoUsuario(payload.sub);
  if (!empresa)          return res.status(404).json({ error: 'Empresa não encontrada.' });
  if (!empresa.is_admin) return res.status(403).json({ error: 'Apenas admins podem atribuir tarefas.' });

  const targetId = Number(req.params.userId);
  const membro = db.prepare(`
    SELECT user_id FROM empresa_membros WHERE empresa_id = ? AND user_id = ?
  `).get(empresa.id, targetId);
  if (!membro) return res.status(404).json({ error: 'Membro não encontrado nesta empresa.' });

  const body = req.body;

  if (!String(body.title || '').trim())
    return res.status(400).json({ error: 'Campo "title" obrigatório.' });

  const isMission = body.type === 'mission';

  const tarefa = {
    id:              `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,

    // ── Tipo: respeita o que o cliente manda ──
    type:            isMission ? 'mission' : 'task',

    title:           String(body.title  || '').trim().slice(0, 100),
    notes:           String(body.notes  || '').trim().slice(0, 500),
    catId:           body.catId    || null,
    importance:      ['Obrigatório','Necessário','Padrão','Ideia'].includes(body.importance)
                       ? body.importance : 'Padrão',
    dueDate:         body.dueDate  || null,

    // ── Hora: campo correto (não estimateMinutes) ──
    taskTime:        body.taskTime || null,

    estimateMinutes: body.estimateMinutes || null,
    repeat:          ['none','daily','weekdays','weekly'].includes(body.repeat)
                       ? body.repeat : 'none',
    energy:          ['low','medium','high'].includes(body.energy) ? body.energy : 'medium',

    // ── Lembrete antecipado ──
    remindBefore:     body.remindBefore     || null,
    remindBeforeDays: body.remindBeforeDays || null,
    remindDate:       body.remindDate       || null,

    // ── Modo insistente ──
    insistent:        Boolean(body.insistent),
    insistentMin:     body.insistent ? (Number(body.insistentMin) || 5) : null,

    // ── Missão: subtarefas geradas pela IA no cliente ──
    missionTitle:     isMission ? (body.missionTitle || body.title) : undefined,
    totalXP:          isMission ? (body.totalXP      || 0)          : undefined,
    estimatedMinutes: isMission ? (body.estimatedMinutes || 0)       : undefined,
    subtasks:         isMission ? (Array.isArray(body.subtasks) ? body.subtasks : []) : undefined,

    status:          'todo',
    createdAt:       Date.now(),
    xpEarned:        0,
    assignedBy:      String(body.assignedBy || 'Admin').slice(0, 40),
    empresaId:       empresa.id,
  };

  // Remove chaves undefined (missão fields em tarefas normais)
  Object.keys(tarefa).forEach(k => tarefa[k] === undefined && delete tarefa[k]);

  // Persiste na tabela dedicada
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO empresa_tarefas_atribuidas
      (empresa_id, assignee_id, assigned_by, tarefa_json, concluida)
    VALUES (?, ?, ?, ?, 0)
  `).run(empresa.id, targetId, payload.sub, JSON.stringify(tarefa));

  // Injeta no user_state do membro para ele ver no app
  const row = db.prepare('SELECT state_json FROM user_state WHERE user_id = ?').get(targetId);
  if (row) {
    let memberState;
    try { memberState = JSON.parse(row.state_json); } catch { memberState = {}; }
    if (!Array.isArray(memberState.tasks)) memberState.tasks = [];
    memberState.tasks.unshift({ ...tarefa, _empresaAtribuidaRowId: lastInsertRowid });
    db.prepare(`UPDATE user_state SET state_json = ?, updated_at = datetime('now') WHERE user_id = ?`)
      .run(JSON.stringify(memberState), targetId);
  }

  return res.status(201).json({ ok: true, tarefaId: tarefa.id });
});

/* ── PATCH /api/empresa/tarefas/:rowId/concluir ──────────────
Chamado pelo membro quando conclui uma tarefa atribuída.
Qualquer membro da empresa pode marcar sua própria tarefa.
─────────────────────────────────────────────────────────── */
app.patch('/api/empresa/tarefas/:rowId/concluir', (req, res) => {
const payload = verifyToken(req, res);
if (!payload) return;

const empresa = getEmpresaDoUsuario(payload.sub);
if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada.' });

const row = db.prepare(`
 SELECT id, assignee_id FROM empresa_tarefas_atribuidas
 WHERE id = ? AND empresa_id = ?
`).get(req.params.rowId, empresa.id);

if (!row) return res.status(404).json({ error: 'Tarefa não encontrada.' });

// Só o próprio assignee ou um admin pode marcar como concluída
const isAssignee = row.assignee_id === payload.sub;
if (!isAssignee && !empresa.is_admin)
 return res.status(403).json({ error: 'Sem permissão para concluir esta tarefa.' });

db.prepare(`
 UPDATE empresa_tarefas_atribuidas SET concluida = 1 WHERE id = ?
`).run(row.id);

return res.json({ ok: true });
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return res.status(401).json({ error: 'Token ausente.' });

  if (!req.file)
    return res.status(400).json({ error: 'Envie um arquivo de áudio no campo "audio".' });

  const id      = randomUUID();
  const rawPath = path.join(__dirname, `recording_${id}.webm`);
  const wavPath = path.join(__dirname, `recording_${id}.wav`);
  const cleanup = (...files) => files.forEach(f => fs.unlink(f, () => {}));

  try {
    fs.copyFileSync(req.file.path, rawPath);
  } catch (err) {
    cleanup(req.file.path);
    return res.status(500).json({ error: 'Falha ao processar áudio enviado.' });
  } finally {
    cleanup(req.file.path);
  }

  let transcription;
  try {
    await convertToWav(rawPath, wavPath);
    transcription = await transcribeWithWhisperWeb(wavPath);
  } catch (err) {
    console.error('[transcribe] erro:', err.message);
    return res.status(500).json({ error: 'Falha ao transcrever áudio.' });
  } finally {
    cleanup(rawPath, wavPath);
  }

  if (!transcription) return res.status(422).json({ error: 'Transcrição vazia.' });

  // Cria job do Gemini e responde imediatamente ao frontend
  const jobId = createJob();
  res.json({ transcription, jobId });

  // Tudo daqui para baixo roda no backend independente do frontend
  const { systemPrompt, userPrompt } = buildVoiceParsePrompt(transcription, payload.sub);
  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  console.log(`[transcribe] job ${jobId} iniciado para user ${payload.sub}`);

  askGemini(fullPrompt)
    .then(raw => {
      console.log(`[transcribe→gemini] job ${jobId} concluído (${raw.length} chars)`);
      setJobDone(jobId, { content: [{ type: 'text', text: raw }] });
      _saveVoiceTasksToState(payload.sub, raw);
    })
    .catch(err => {
      console.error(`[transcribe→gemini] job ${jobId} falhou:`, err.message);
      setJobError(jobId, err.message);
    });
});

function buildVoiceParsePrompt(transcription, userId) {
  const row = db.prepare('SELECT state_json FROM user_state WHERE user_id = ?').get(userId);
  const userState = row ? JSON.parse(row.state_json) : defaultState('');
  const catNames  = (userState.categories || []).map(c => c.name).join(', ') || 'Geral';

  const now         = new Date();
  const toLocalISO  = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayISO    = toLocalISO(now);
  const tomorrow    = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toLocalISO(tomorrow);
  const todayFmt    = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const systemPrompt =
    `Você é um assistente de produtividade. Sua única função é analisar transcrições de voz ` +
    `em português brasileiro e extrair tarefas estruturadas. ` +
    `Retorne APENAS um array JSON válido. Nenhum texto antes ou depois. Nenhum markdown.`;

  const userPrompt =
`CONTEXTO
- Hoje: ${todayFmt} (ISO: ${todayISO})
- Amanhã ISO: ${tomorrowISO}
- Ano atual: ${now.getFullYear()}
- Categorias disponíveis: ${catNames}

TRANSCRIÇÃO
"${transcription}"

REGRAS
1. CORREÇÃO FONÉTICA — corrija erros de reconhecimento de voz antes de interpretar.
2. MÚLTIPLAS TAREFAS — gere uma tarefa por ação identificada.
3. DATAS — "amanhã" = ${tomorrowISO}. Sem data mencionada = null.
4. HORA → campo taskTime (formato "HH:MM", 24h). Sem horário → null.
5. LEMBRETE → campo remindBefore: "1d", "7d", "30d", "custom". Sem menção → null.
6. MODO INSISTENTE → insistent: true se usuário pedir para ser cobrado. insistentMin: intervalo em minutos.
7. TÍTULO — máx 60 chars, descreve a ação no imperativo.
8. CAMPOS — importance: "Obrigatório"|"Necessário"|"Padrão"|"Ideia". energy: "low"|"medium"|"high". repeat: "none"|"daily"|"weekdays"|"weekly".

RETORNE APENAS O ARRAY JSON.`;

  return { systemPrompt, userPrompt };
}

app.get("/api/job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job não encontrado." });
  return res.json(job);
});
// Map de userId → jobId ativo
const userActiveJobs = new Map(); // userId → { jobId, preview }

// ─── POST /api/ask-ai 
app.post("/api/ask-ai", async (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const { prompt, system } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Campo "prompt" obrigatório.' });

  const jobId = createJob();
  res.json({ jobId });

  const fullPrompt = system ? `${system}\n\n---\n\n${prompt}` : prompt;
  console.log(`[ask-ai] job ${jobId} iniciado para user ${payload.sub}`);

  askGemini(fullPrompt)
    .then(raw => {
      console.log(`[ask-ai] job ${jobId} concluído (${raw.length} chars)`);
      setJobDone(jobId, { content: [{ type: "text", text: raw }] });

      // ── Persiste as tarefas no user_state independente do frontend ──
      _saveVoiceTasksToState(payload.sub, raw);
    })
    .catch(err => {
      console.error(`[ask-ai] job ${jobId} falhou:`, err.message);
      setJobError(jobId, err.message);
    });
});

function _saveVoiceTasksToState(userId, raw) {
  try {
    const cleaned = raw.replace(/```json|```/gi, '').trim();
    const match   = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return;

    const parsedArr = JSON.parse(match[0]);
    if (!Array.isArray(parsedArr) || parsedArr.length === 0) return;

    const row = db.prepare('SELECT state_json FROM user_state WHERE user_id = ?').get(userId);
    if (!row) return;

    const userState = JSON.parse(row.state_json);

    const validImportance = ['Obrigatório', 'Necessário', 'Padrão', 'Ideia'];
    const validRepeat     = ['none', 'daily', 'weekdays', 'weekly'];
    const validEnergy     = ['low', 'medium', 'high'];

    let added = 0;
    parsedArr.forEach((parsed, idx) => {
      const title = (parsed.title || '').trim().slice(0, 100);
      if (!title) return;

      const cat   = (userState.categories || []).find(
        c => parsed.category && c.name.toLowerCase() === parsed.category.toLowerCase()
      );
      const taskTime = /^\d{2}:\d{2}$/.test(parsed.taskTime || '') ? parsed.taskTime : null;

      const task = {
        id:              `task_voice_${Date.now()}_${idx}`,
        type:            parsed.type === 'mission' ? 'mission' : 'task',
        title,
        notes:           parsed.notes || '',
        catId:           cat?.id || userState.categories?.[0]?.id || null,
        importance:      validImportance.includes(parsed.importance) ? parsed.importance : 'Padrão',
        dueDate:         parsed.dueDate || null,
        taskTime,
        estimateMinutes: null,
        repeat:          validRepeat.includes(parsed.repeat) ? parsed.repeat : 'none',
        energy:          validEnergy.includes(parsed.energy) ? parsed.energy : 'medium',
        status:          'todo',
        createdAt:       Date.now() + idx,
        xpEarned:        0,
        lastCompleted:   null,
        remindBefore:    null,
        remindBeforeDays: null,
        remindDate:      null,
        insistent:       parsed.insistent === true,
        insistentMin:    parsed.insistent ? (parseInt(parsed.insistentMin) || 15) : null,
      };

      userState.tasks.unshift(task);
      added++;
    });

    if (added === 0) return;

    db.prepare(`
      INSERT INTO user_state (user_id, state_json, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).run(userId, JSON.stringify(userState));

    console.log(`[ask-ai] ${added} tarefa(s) salvas no state do user ${userId}`);
  } catch (err) {
    console.error('[ask-ai] falha ao salvar tarefas no state:', err.message);
  }
}

// Nova rota: retorna job ativo do usuário (se houver)
app.get("/api/ask-ai/active-job", (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const active = userActiveJobs.get(payload.sub);
  if (!active) return res.json({ jobId: null });

  const job = jobs.get(active.jobId);
  if (!job || job.status !== 'pending') {
    userActiveJobs.delete(payload.sub);
    return res.json({ jobId: null });
  }

  return res.json({ jobId: active.jobId });
});

/* ── POST /api/daily-history/complete ───────────────────────
   Chamado ao concluir tarefa ou subtarefa.
   Incrementa xp_earned e tasks_done do dia atual.
─────────────────────────────────────────────────────────── */
app.post('/api/daily-history/complete', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const { xp = 0, focusSession = false } = req.body;

  const date = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  db.prepare(`
    INSERT INTO daily_history (user_id, date, xp_earned, tasks_done, focus_sessions, updated_at)
    VALUES (?, ?, ?, 1, ?, datetime('now'))
    ON CONFLICT(user_id, date) DO UPDATE SET
      xp_earned      = xp_earned      + excluded.xp_earned,
      tasks_done     = tasks_done     + 1,
      focus_sessions = focus_sessions + excluded.focus_sessions,
      updated_at     = datetime('now')
  `).run(payload.sub, date, xp, focusSession ? 1 : 0);

  return res.json({ ok: true });
});

app.get('/api/day-summary', (req, res) => {
  const payload = verifyToken(req, res);
  if (!payload) return;

  const dateParam = req.query.date;
  const key = dateParam || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  // Lê o histórico do dia da tabela dedicada
  const hist = db.prepare(`
    SELECT xp_earned, tasks_done, focus_sessions
    FROM daily_history
    WHERE user_id = ? AND date = ?
  `).get(payload.sub, key);

  // Streak e nível ainda vêm do state_json
  const row = db.prepare('SELECT state_json FROM user_state WHERE user_id = ?').get(payload.sub);
  let streak = 0, level = 1, totalXP = 0;
  if (row) {
    try {
      const s = JSON.parse(row.state_json);
      streak  = s.streak   || 0;
      level   = s.level    || 1;
      totalXP = s.totalXP  || 0;
    } catch {}
  }

  return res.json({
    date:          key,
    xp:            hist?.xp_earned      ?? 0,
    completed:     hist?.tasks_done     ?? 0,
    focusSessions: hist?.focus_sessions ?? 0,
    streak,
    totalXP,
    level,
  });
});


/* ── Helpers de prompt ───────────────────────────────────── */
function buildPrompt(task, user) {
  const rhythmMap = {
    leve:     'prefere poucas tarefas e ritmo tranquilo',
    moderado: 'tem ritmo equilibrado',
    intenso:  'gosta de alta produtividade e muitas entregas',
  };
  const peakMap = {
    manha:   'manhã (6h–12h)',
    tarde:   'tarde (12h–18h)',
    noite:   'noite (após 18h)',
    variavel:'horário variável',
  };
  const energyMap = { low: 'baixa', medium: 'média', high: 'alta' };

  const prompt = {
    objective: "Quebrar uma tarefa principal em subtarefas menores, práticas e executáveis, respeitando o contexto e as notas fornecidas pelo usuário. Se as notas indicarem sub-objetivos, etapas ou itens específicos, esses DEVEM virar subtarefas — não ignore nenhuma instrução contida nas notas.",

    context: {
      background_info: {
        usuario: {
          nome:          user.name,
          perfil:        user.profile,
          ritmo:         rhythmMap[user.rhythm] || user.rhythm,
          pico_energia:  peakMap[user.peak]     || user.peak || 'variável',
          maior_desafio: user.challenge         || 'não informado',
          nivel:         user.level,
          streak_dias:   user.streak,
        },
        tarefa: {
          titulo:            task.title,
          importancia:       task.importance,
          categoria:         task.category,
          energia_necessaria: energyMap[task.energy] || task.energy || 'média',
          data_prevista:     task.dueDate            || 'não definida',
        },
      },
      source_material: task.notes?.trim()
        ? `Notas do usuário (leia com atenção — podem conter sub-objetivos, etapas obrigatórias ou itens específicos que DEVEM virar subtarefas):\n"${task.notes.trim()}"`
        : 'Nenhuma nota adicional fornecida.',
    },

    parameters: {
      tone: 'Profissional, direto e motivador. Evite linguagem genérica.',
      constraints: [
        'Gere entre 2 e 6 subtarefas ordenadas da mais simples à mais complexa.',
        'Cada subtarefa deve ser executável em menos de 30 minutos.',
        'XP entre 10 e 60 por subtarefa, proporcional à dificuldade.',
        'Se as notas indicarem etapas ou itens específicos, crie subtarefas para cada um deles — não os agrupe nem ignore.',
        'Não crie subtarefas genéricas como "Planejar" ou "Revisar" quando as notas já descrevem o que fazer.',
        'O missionTitle deve ser objetivo e específico, nunca genérico.',
      ],
      style_guide: 'Português brasileiro. Títulos de subtarefas no imperativo (ex: "Escrever introdução do relatório"). Tips curtas e práticas.',
    },

    output_format: {
      format_type: 'json',
      required_elements: [
        'missionTitle: título resumido e específico da missão',
        'totalXP: soma dos XP de todas as subtarefas',
        'estimatedMinutes: soma dos estimatedMinutes de todas as subtarefas',
        'subtasks: array com id, title, estimatedMinutes, xp, tip',
      ],
      schema: {
        missionTitle:       'string',
        totalXP:            'number',
        estimatedMinutes:   'number',
        subtasks: [{
          id:               'st_1, st_2 ...',
          title:            'string',
          estimatedMinutes: 'number',
          xp:               'number',
          tip:              'string — dica prática e específica para executar esta subtarefa',
        }],
      },
      strict: 'Responda SOMENTE com o JSON válido, sem markdown, sem explicações, sem texto fora do objeto JSON.',
    },
  };

  return JSON.stringify(prompt, null, 2);
}


function buildSuggestPrompt(task, user, extraContext) {
  const rhythmMap = {
    leve:     'prefere poucas tarefas e ritmo tranquilo',
    moderado: 'tem ritmo equilibrado',
    intenso:  'gosta de alta produtividade',
  };

  const prompt = {
    objective: "Sugerir NOVAS subtarefas complementares para uma missão em andamento, sem repetir o que já existe. Se um contexto adicional for fornecido, ele deve guiar diretamente as sugestões — trate-o como instrução prioritária.",

    context: {
      background_info: {
        usuario: {
          nome:        user.name,
          perfil:      user.profile,
          ritmo:       rhythmMap[user.rhythm] || user.rhythm,
          nivel:       user.level,
          streak_dias: user.streak,
        },
        missao: {
          titulo:     task.title,
          importancia: task.importance,
          categoria:  task.category,
        },
      },
      source_material: [
        task.existingSubtasks?.length
          ? `Subtarefas já existentes (NÃO repita nem varie minimamente nenhuma delas):\n${task.existingSubtasks.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
          : 'Nenhuma subtarefa existente.',
        extraContext?.trim()
          ? `Instrução/contexto adicional do usuário (prioridade máxima — oriente as sugestões por isso):\n"${extraContext.trim()}"`
          : '',
      ].filter(Boolean).join('\n\n'),
    },

    parameters: {
      tone: 'Profissional, direto e motivador.',
      constraints: [
        'Sugira entre 2 e 4 subtarefas novas e complementares.',
        'Cada subtarefa executável em menos de 30 minutos.',
        'XP entre 10 e 60, proporcional à dificuldade.',
        'Não repita, parafraseie nem varie minimamente as subtarefas já existentes.',
        'Se o contexto adicional indicar itens ou etapas específicas, crie subtarefas para cada um.',
      ],
      style_guide: 'Português brasileiro. Títulos no imperativo. Tips curtas e acionáveis.',
    },

    output_format: {
      format_type: 'json',
      required_elements: [
        'subtasks: array com id, title, estimatedMinutes, xp, tip',
      ],
      schema: {
        subtasks: [{
          id:               'st_new_1, st_new_2 ...',
          title:            'string',
          estimatedMinutes: 'number',
          xp:               'number',
          tip:              'string — dica prática e específica',
        }],
      },
      strict: 'Responda SOMENTE com o JSON válido, sem markdown, sem explicações, sem texto fora do objeto JSON.',
    },
  };

  return JSON.stringify(prompt, null, 2);
}

function extractJSON(raw) {
  const clean = raw.replace(/```json|```/gi, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Nenhum JSON encontrado na resposta da IA.');
  return JSON.parse(match[0]);
}

/* ── Inicialização ───────────────────────────────────────── */
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[APP] Servidor rodando em http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('[APP] Erro ao iniciar servidor:', err);
});

module.exports = { app };
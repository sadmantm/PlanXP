/* ═══════════════════════════════════════════════════════════
   empresa.js — Sistema de Empresa / Grupos / Membros
   (migrado para API — localStorage removido)
   ═══════════════════════════════════════════════════════════ */

'use strict';

const GRUPO_CORES = [
  '#7C6FCD','#5B8DEF','#4ECDC4','#FFD166',
  '#EF476F','#06D6A0','#F4A261','#A8DADC',
];
const GRUPO_ICONES = [
  'fa-code','fa-bullseye','fa-chart-line','fa-users',
  'fa-rocket','fa-graduation-cap','fa-heart-pulse',
  'fa-briefcase','fa-gear','fa-star','fa-bolt','fa-shield-halved',
];

// ── Estado em memória (sem localStorage) ────────────────────
let empresaState       = null;   // objeto completo vindo da API
let grupoSheetMode     = 'criar';
let grupoEditandoId    = null;
let membroEditandoId   = null;
let grupoCorSel        = GRUPO_CORES[0];
let grupoIconeSel      = GRUPO_ICONES[0];
let segmentoSel        = 'Tecnologia';
let membroGrupoSel     = null;
let empresaFilterAtivo = 'todos';
let _atribuindoParaId = null;
let _atribuindoBanner = null;

// ── Helper de fetch autenticado ──────────────────────────────
async function apiEmpresa(method, path, body) {
  // Usa a mesma chave que autoLogin salva no localStorage
  const token = window.appState?.token || localStorage.getItem('nxp_user_token');
  if (!token) throw new Error('Usuário não autenticado.');
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição.');
  return data;
}

// ── Init ─────────────────────────────────────────────────────
async function initEmpresa() {
  bindEmptyState();
  bindCriarEmpresaSheet();
  bindEntrarEmpresaSheet();
  bindGrupoSheet();
  bindMembroGrupoSheet();
  bindEmpresaSettingsSheet();
  bindDashboardTabs();
  bindCopyInvite();
  await carregarEmpresa();
}

async function carregarEmpresa() {
  // Aguarda token estar disponível (auto-login pode ainda estar em curso)
  const token = window.appState?.token || localStorage.getItem('nxp_user_token');
  if (!token) {
    renderEmpresa();
    return;
  }
  setEmpresaLoading(true);
  try {
    empresaState = await apiEmpresa('GET', '/empresa');
  } catch (e) {
    showSnackbar('Erro ao carregar empresa.');
    empresaState = null;
  } finally {
    setEmpresaLoading(false);
    renderEmpresa();
  }
}

function setEmpresaLoading(on) {
  document.getElementById('empresa-loading')?.classList.toggle('hidden', !on);
  document.getElementById('empresa-empty-state')?.classList.toggle('hidden', on);
  document.getElementById('empresa-dashboard')?.classList.toggle('hidden', on);
}

// ── Empty state ──────────────────────────────────────────────
function bindEmptyState() {
  document.getElementById('btn-criar-empresa')
    ?.addEventListener('click', () => openSheet('criar-empresa-sheet'));
  document.getElementById('btn-entrar-empresa')
    ?.addEventListener('click', () => openSheet('entrar-empresa-sheet'));
}

// ── Sheet: Criar Empresa ─────────────────────────────────────
function bindCriarEmpresaSheet() {
  document.querySelectorAll('.empresa-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.empresa-seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      segmentoSel = btn.dataset.seg;
    });
  });

  document.getElementById('btn-confirmar-criar-empresa')
    ?.addEventListener('click', async () => {
      const nome = document.getElementById('input-empresa-nome').value.trim();
      if (!nome) { shakeInput('input-empresa-nome'); return; }

      setBtnLoading('btn-confirmar-criar-empresa', true);
      try {
        empresaState = await apiEmpresa('POST', '/empresa', { nome, segmento: segmentoSel });
        closeSheet('criar-empresa-sheet');
        renderEmpresa();
        showSnackbar(`${nome} criada com sucesso!`);
      } catch (e) {
        showSnackbar(`${e.message}`);
      } finally {
        setBtnLoading('btn-confirmar-criar-empresa', false);
      }
    });
}

// ── Sheet: Entrar com Código ─────────────────────────────────
function bindEntrarEmpresaSheet() {
  document.getElementById('btn-confirmar-entrar-empresa')
    ?.addEventListener('click', async () => {
      const code = document.getElementById('input-codigo-convite').value.trim().toUpperCase();
      if (code.length < 4) { shakeInput('input-codigo-convite'); return; }

      setBtnLoading('btn-confirmar-entrar-empresa', true);
      try {
        empresaState = await apiEmpresa('POST', '/empresa/entrar', { codigo: code });
        closeSheet('entrar-empresa-sheet');
        renderEmpresa();
        showSnackbar(`Bem-vindo à ${empresaState.nome}!`);
      } catch (e) {
        showSnackbar(`${e.message}`);
      } finally {
        setBtnLoading('btn-confirmar-entrar-empresa', false);
      }
    });
}

// ── Sheet: Criar / Editar Grupo ──────────────────────────────
function bindGrupoSheet() {
  const colorPicker = document.getElementById('grupo-color-picker');
  GRUPO_CORES.forEach(cor => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (cor === grupoCorSel ? ' active' : '');
    sw.style.background = cor;
    sw.addEventListener('click', () => {
      colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      grupoCorSel = cor;
    });
    colorPicker.appendChild(sw);
  });

  const iconPicker = document.getElementById('grupo-icon-picker');
  GRUPO_ICONES.forEach(ic => {
    const btn = document.createElement('div');
    btn.className = 'icon-option' + (ic === grupoIconeSel ? ' active' : '');
    btn.innerHTML = `<i class="fa-solid ${ic}"></i>`;
    btn.addEventListener('click', () => {
      iconPicker.querySelectorAll('.icon-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      grupoIconeSel = ic;
    });
    iconPicker.appendChild(btn);
  });

  document.getElementById('btn-salvar-grupo')?.addEventListener('click', salvarGrupo);
  document.getElementById('btn-deletar-grupo')?.addEventListener('click', deletarGrupo);
  document.getElementById('btn-criar-grupo')?.addEventListener('click', () => abrirGrupoSheet('criar'));
}

function abrirGrupoSheet(mode, grupoId = null) {
  grupoSheetMode  = mode;
  grupoEditandoId = grupoId;

  const titleEl        = document.getElementById('grupo-sheet-title');
  const deleteBtn      = document.getElementById('btn-deletar-grupo');
  const membersSection = document.getElementById('grupo-members-section');

  if (mode === 'criar') {
    titleEl.textContent = 'Novo Grupo';
    document.getElementById('input-grupo-nome').value = '';
    document.getElementById('input-grupo-finalidade').value = '';
    grupoCorSel   = GRUPO_CORES[0];
    grupoIconeSel = GRUPO_ICONES[0];
    resetColorPicker('grupo-color-picker', grupoCorSel);
    resetIconPicker('grupo-icon-picker', grupoIconeSel);
    deleteBtn.style.display = 'none';
    membersSection?.classList.add('hidden');
  } else {
    const grupo = empresaState?.grupos.find(g => g.id == grupoId);
    if (!grupo) return;
    titleEl.textContent = 'Editar Grupo';
    document.getElementById('input-grupo-nome').value = grupo.nome;
    document.getElementById('input-grupo-finalidade').value = grupo.finalidade || '';
    grupoCorSel   = grupo.cor;
    grupoIconeSel = grupo.icone;
    resetColorPicker('grupo-color-picker', grupoCorSel);
    resetIconPicker('grupo-icon-picker', grupoIconeSel);
    deleteBtn.style.display = empresaState?.isAdmin ? '' : 'none';
    membersSection?.classList.remove('hidden');
    renderGrupoMembersList(grupoId);
  }

  openSheet('grupo-sheet');
}

async function salvarGrupo() {
  const nome = document.getElementById('input-grupo-nome').value.trim();
  if (!nome) { shakeInput('input-grupo-nome'); return; }
  const finalidade = document.getElementById('input-grupo-finalidade').value.trim();

  setBtnLoading('btn-salvar-grupo', true);
  try {
    if (grupoSheetMode === 'criar') {
      const novo = await apiEmpresa('POST', '/empresa/grupos', { nome, finalidade, cor: grupoCorSel, icone: grupoIconeSel });
      empresaState.grupos.push(novo);
    } else {
      const atualizado = await apiEmpresa('PUT', `/empresa/grupos/${grupoEditandoId}`, { nome, finalidade, cor: grupoCorSel, icone: grupoIconeSel });
      const idx = empresaState.grupos.findIndex(g => g.id == grupoEditandoId);
      if (idx !== -1) empresaState.grupos[idx] = atualizado;
    }
    closeSheet('grupo-sheet');
    renderDashboard(); // atualiza membros + meta
    renderGrupos();    // atualiza lista no settings sheet
    showSnackbar(grupoSheetMode === 'criar' ? 'Grupo criado!' : 'Grupo atualizado!');
  } catch (e) {
    showSnackbar(`${e.message}`);
  } finally {
    setBtnLoading('btn-salvar-grupo', false);
  }
}

async function deletarGrupo() {
  if (!grupoEditandoId) return;
  setBtnLoading('btn-deletar-grupo', true);
  try {
    await apiEmpresa('DELETE', `/empresa/grupos/${grupoEditandoId}`);
    empresaState.grupos = empresaState.grupos.filter(g => g.id != grupoEditandoId);
    empresaState.membros.forEach(m => { if (m.grupoId == grupoEditandoId) m.grupoId = null; });
    closeSheet('grupo-sheet');
    renderDashboard();
    renderGrupos();   // atualiza lista no settings sheet
    showSnackbar('Grupo removido.');
  } catch (e) {
    showSnackbar(`${e.message}`);
  } finally {
    setBtnLoading('btn-deletar-grupo', false);
  }
}


function renderGrupoMembersList(grupoId) {
  const container = document.getElementById('grupo-members-list');
  const countEl   = document.getElementById('grupo-members-count');
  if (!container) return;

  const membros = empresaState.membros.filter(m => m.grupoId == grupoId);
  countEl.textContent = `${membros.length} membro${membros.length !== 1 ? 's' : ''}`;

  if (!membros.length) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:4px 0">Nenhum membro neste grupo ainda.</p>';
    return;
  }
  container.innerHTML = membros.map(m => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div class="membro-avatar" style="width:32px;height:32px;font-size:12px">${m.nome[0].toUpperCase()}</div>
      <span style="font-size:13px;font-weight:700;flex:1">${m.nome}</span>
      ${m.isMe ? '<span style="font-size:10px;color:var(--accent)">Você</span>' : ''}
    </div>
  `).join('');
}

// ── Sheet: Membro → Atribuir Grupo ──────────────────────────
function bindMembroGrupoSheet() {
  document.getElementById('btn-salvar-membro-grupo')?.addEventListener('click', salvarMembroGrupo);
  document.getElementById('btn-remover-membro')?.addEventListener('click', removerMembro);
}

function abrirMembroSheet(membroId) {
  const m = empresaState?.membros.find(x => x.id == membroId);
  if (!m) return;
  membroEditandoId = membroId;
  membroGrupoSel   = m.grupoId;

  document.getElementById('membro-sheet-avatar').textContent = m.nome[0].toUpperCase();
  document.getElementById('membro-sheet-name').textContent   = m.nome;
  document.getElementById('membro-sheet-role').textContent   = m.isAdmin ? 'Administrador' : 'Membro';

  // Esconde botão remover para si mesmo
  const removeBtn = document.getElementById('btn-remover-membro');
  if (removeBtn) removeBtn.style.display = m.isMe ? 'none' : '';

  renderGrupoRadios();
  openSheet('membro-grupo-sheet');
}

function renderGrupoRadios() {
  const container = document.getElementById('membro-grupo-options');
  if (!container) return;
  const grupos = empresaState?.grupos || [];
  const opts   = [{ id: null, nome: 'Sem grupo', icone: 'fa-ban', cor: '#4E4E65' }, ...grupos];

  container.innerHTML = opts.map(g => `
    <div class="grupo-radio-option ${membroGrupoSel == g.id ? 'selected' : ''} ${g.id === null ? 'sem-grupo' : ''}"
         data-gid="${g.id ?? ''}">
      <div class="grupo-radio-icon" style="background:${g.id ? g.cor + '22' : 'rgba(255,255,255,0.05)'}; color:${g.cor || '#4E4E65'}">
        <i class="fa-solid ${g.icone}"></i>
      </div>
      <span class="grupo-radio-label">${g.nome}</span>
      <div class="grupo-radio-check"><i class="fa-solid fa-check"></i></div>
    </div>
  `).join('');

  container.querySelectorAll('.grupo-radio-option').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.grupo-radio-option').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      membroGrupoSel = el.dataset.gid || null;
    });
  });
}

async function salvarMembroGrupo() {
  setBtnLoading('btn-salvar-membro-grupo', true);
  try {
    await apiEmpresa('PUT', `/empresa/membros/${membroEditandoId}`, { grupoId: membroGrupoSel || null });
    const m = empresaState.membros.find(x => x.id == membroEditandoId);
    if (m) m.grupoId = membroGrupoSel || null;
    closeSheet('membro-grupo-sheet');
    renderDashboard();
    showSnackbar('Membro atualizado!');
  } catch (e) {
    showSnackbar(`${e.message}`);
  } finally {
    setBtnLoading('btn-salvar-membro-grupo', false);
  }
}

async function removerMembro() {
  setBtnLoading('btn-remover-membro', true);
  try {
    await apiEmpresa('DELETE', `/empresa/membros/${membroEditandoId}`);
    empresaState.membros = empresaState.membros.filter(m => m.id != membroEditandoId);
    closeSheet('membro-grupo-sheet');
    renderDashboard();
    showSnackbar('Membro removido.');
  } catch (e) {
    showSnackbar(`${e.message}`);
  } finally {
    setBtnLoading('btn-remover-membro', false);
  }
}

// ── Sheet: Configurações da Empresa ─────────────────────────
function bindEmpresaSettingsSheet() {
  document.getElementById('btn-empresa-settings')
    ?.addEventListener('click', () => {
      if (!empresaState) return;
      document.getElementById('settings-empresa-nome').value     = empresaState.nome;
      document.getElementById('settings-empresa-segmento').value = empresaState.segmento;

      const isAdmin = empresaState.isAdmin;
      document.getElementById('settings-empresa-nome').disabled     = !isAdmin;
      document.getElementById('settings-empresa-segmento').disabled = !isAdmin;

      const delBtn  = document.getElementById('btn-deletar-empresa');
      const saveBtn = document.getElementById('btn-salvar-empresa-settings');
      if (delBtn)  delBtn.style.display  = isAdmin ? '' : 'none';
      if (saveBtn) saveBtn.style.display = isAdmin ? '' : 'none';

      // ← renderiza grupos toda vez que o sheet abre
      renderGrupos();

      openSheet('empresa-settings-sheet');
    });

  document.getElementById('btn-salvar-empresa-settings')
    ?.addEventListener('click', async () => {
      const nome = document.getElementById('settings-empresa-nome').value.trim();
      if (!nome) { shakeInput('settings-empresa-nome'); return; }
      const segmento = document.getElementById('settings-empresa-segmento').value;

      setBtnLoading('btn-salvar-empresa-settings', true);
      try {
        const atualizada = await apiEmpresa('PUT', '/empresa', { nome, segmento });
        empresaState.nome     = atualizada.nome;
        empresaState.segmento = atualizada.segmento;
        closeSheet('empresa-settings-sheet');
        renderDashboard();
        showSnackbar('Empresa atualizada!');
      } catch (e) {
        showSnackbar(`${e.message}`);
      } finally {
        setBtnLoading('btn-salvar-empresa-settings', false);
      }
    });

  document.getElementById('btn-sair-empresa')
    ?.addEventListener('click', async () => {
      if (!confirm('Sair da empresa?')) return;
      try {
        await apiEmpresa('DELETE', '/empresa/sair');
        empresaState = null;
        closeSheet('empresa-settings-sheet');
        renderEmpresa();
      } catch (e) {
        showSnackbar(`${e.message}`);
      }
    });

  document.getElementById('btn-deletar-empresa')
    ?.addEventListener('click', async () => {
      if (!confirm(`Excluir "${empresaState?.nome}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await apiEmpresa('DELETE', '/empresa');
        empresaState = null;
        closeSheet('empresa-settings-sheet');
        renderEmpresa();
        showSnackbar('Empresa excluída.');
      } catch (e) {
        showSnackbar(`${e.message}`);
      }
    });
}

// ── Tabs internas ────────────────────────────────────────────
let tarefasFilterAtivo = 'todas';

function bindDashboardTabs() {
  document.querySelectorAll('.empresa-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.empresa-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.empresa-tab-content').forEach(c => {
        c.classList.remove('active');
        c.classList.add('hidden');
      });
      tab.classList.add('active');
      const content = document.getElementById(`etab-${tab.dataset.etab}`);
      content?.classList.remove('hidden');
      content?.classList.add('active');

      // ← renderiza tarefas ao entrar na tab
      if (tab.dataset.etab === 'tarefas') renderTarefas();
    });
  });
}

// ── Bind dos chips de filtro de tarefas ──────────────────────
function bindTarefasFilter() {
  const row = document.getElementById('tarefas-filter-row');
  if (!row) return;
  row.querySelectorAll('.empresa-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      tarefasFilterAtivo = chip.dataset.tfilter;
      row.querySelectorAll('.empresa-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderTarefas();
    });
  });
}

// ── Render principal de tarefas ──────────────────────────────
function renderTarefas() {
  const list       = document.getElementById('empresa-tarefas-list');
  const emptyEl    = document.getElementById('empresa-empty-tarefas');
  const naoadminEl = document.getElementById('empresa-tarefas-naoadmin');
  if (!list) return;

  // Garante que os chips tenham listener (idempotente via replace)
  bindTarefasFilter();

  const isAdmin  = empresaState?.isAdmin;
  const meuId    = empresaState?.membros.find(m => m.isMe)?.id;
  let   tarefas  = empresaState?.tarefas || [];

  // Não-admin vê só as próprias
  if (!isAdmin) tarefas = tarefas.filter(t => t.assigneeId == meuId);

  // Filtro de status
  if (tarefasFilterAtivo === 'pendente')  tarefas = tarefas.filter(t => !t.concluida);
  if (tarefasFilterAtivo === 'concluida') tarefas = tarefas.filter(t =>  t.concluida);

  // Mostra/oculta aviso não-admin (apenas informativo, não bloqueia)
  naoadminEl?.classList.toggle('hidden', isAdmin);

  if (!tarefas.length) {
    list.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }
  emptyEl?.classList.add('hidden');

  const hoje = new Date(); hoje.setHours(0,0,0,0);

  list.innerHTML = tarefas.map(t => {
    const assignee = empresaState.membros.find(m => m.id == t.assigneeId);
    const grupo    = assignee ? empresaState.grupos.find(g => g.id == assignee.grupoId) : null;

    let dataLabel = '';
    let atrasada  = false;
    if (t.dueDate) {
      const due = new Date(t.dueDate); due.setHours(0,0,0,0);
      atrasada   = !t.concluida && due < hoje;
      dataLabel  = due.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    }

    return `
    <div class="empresa-tarefa-card ${t.concluida ? 'concluida' : ''}">
      <div class="tarefa-status-dot ${t.concluida ? 'concluida' : 'pendente'}"></div>
      <div class="tarefa-info">
        <div class="tarefa-titulo">${t.titulo}</div>
        <div class="tarefa-meta">
          ${assignee ? `
            <div class="tarefa-assignee">
              <div class="tarefa-assignee-dot">${assignee.nome[0].toUpperCase()}</div>
              ${assignee.nome}${assignee.isMe ? ' <span style="color:var(--accent)">(você)</span>' : ''}
            </div>` : ''}
          ${grupo ? `
            <span class="tarefa-grupo-tag" style="background:${grupo.cor}22;color:${grupo.cor}">
              <i class="fa-solid ${grupo.icone}" style="font-size:9px;margin-right:3px"></i>${grupo.nome}
            </span>` : ''}
        </div>
      </div>
      ${dataLabel
        ? `<span class="tarefa-data ${atrasada ? 'atrasada' : ''}">${atrasada ? '⚠ ' : ''}${dataLabel}</span>`
        : ''}
    </div>`;
  }).join('');
}

// ── Copy invite code ─────────────────────────────────────────
function bindCopyInvite() {
  document.getElementById('btn-copy-invite')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(empresaState?.codigo || '')
      .then(() => showSnackbar('Código copiado!'));
  });
}

// ── Render principal ─────────────────────────────────────────
function renderEmpresa() {
  const empty = document.getElementById('empresa-empty-state');
  const dash  = document.getElementById('empresa-dashboard');

  if (!empresaState) {
    empty?.classList.remove('hidden');
    dash?.classList.add('hidden');
    document.getElementById('empresa-page-title').textContent = 'Minha Empresa';
    return;
  }

  empty?.classList.add('hidden');
  dash?.classList.remove('hidden');
  renderDashboard();
}

function renderDashboard() {
  if (!empresaState) return;

  document.getElementById('empresa-page-title').textContent      = empresaState.nome;
  document.getElementById('empresa-logo-display').textContent    = empresaState.nome[0].toUpperCase();
  document.getElementById('empresa-nome-display').textContent    = empresaState.nome;
  document.getElementById('empresa-meta-display').textContent    =
    `${empresaState.membros.length} membro${empresaState.membros.length !== 1 ? 's' : ''} · ${empresaState.grupos.length} grupo${empresaState.grupos.length !== 1 ? 's' : ''}`;
  document.getElementById('empresa-invite-code').textContent     = empresaState.codigo;

  // Esconde botões de admin para não-admins
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = empresaState.isAdmin ? '' : 'none';
  });

  renderMembros();
  renderGrupos();
  renderFilterChips();
}

// ── Context menu (clique longo) ──────────────────────────────
let ctxMenuTimeout = null;

function showMemberContextMenu(membroId, anchorEl) {
  removeMemberContextMenu();
  const m = empresaState.membros.find(x => x.id == membroId);
  if (!m || m.isMe) return;

  const menu = document.createElement('div');
  menu.id = 'membro-ctx-menu';
  menu.className = 'membro-ctx-menu';
  menu.innerHTML = `
    <button class="ctx-menu-item" data-action="tarefa">
      <i class="fa-solid fa-layer-group"></i> Atribuir tarefa
    </button>
    <button class="ctx-menu-item ${m.isAdmin ? 'danger' : ''}" data-action="admin">
      <i class="fa-solid fa-shield-halved"></i>
      ${m.isAdmin ? 'Remover admin' : 'Tornar administrador'}
    </button>
    <button class="ctx-menu-item danger" data-action="remover">
      <i class="fa-solid fa-user-minus"></i> Remover da empresa
    </button>`;

  // Posiciona próximo ao card
  const rect = anchorEl.getBoundingClientRect();
  menu.style.cssText = `
    position:fixed;
    top:${Math.min(rect.bottom + 6, window.innerHeight - 160)}px;
    left:${Math.max(rect.left, 12)}px;
    z-index:9999;
  `;
  document.body.appendChild(menu);

  // Anima entrada
  requestAnimationFrame(() => menu.classList.add('visible'));

  menu.querySelectorAll('.ctx-menu-item').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      removeMemberContextMenu();
      const action = btn.dataset.action;
      if (action === 'tarefa') {
        abrirAtribuirTarefa(membroId);
      } else if (action === 'admin') {
        await toggleAdmin(membroId, !m.isAdmin);
      } else if (action === 'remover') {
        if (!confirm(`Remover ${m.nome} da empresa?`)) return;
        try {
          await apiEmpresa('DELETE', `/empresa/membros/${membroId}`);
          empresaState.membros = empresaState.membros.filter(x => x.id != membroId);
          renderDashboard();
          showSnackbar('Membro removido.');
        } catch (e) { showSnackbar(`${e.message}`); }
      }
    });
  });

  // Fecha ao clicar fora
  setTimeout(() => {
    document.addEventListener('click', removeMemberContextMenu, { once: true });
  }, 50);
}

function removeMemberContextMenu() {
  const m = document.getElementById('membro-ctx-menu');
  if (!m) return;
  m.classList.remove('visible');
  setTimeout(() => m.remove(), 180);
}

async function toggleAdmin(membroId, tornarAdmin) {
  try {
    await apiEmpresa('PUT', `/empresa/membros/${membroId}`, { isAdmin: tornarAdmin });
    const m = empresaState.membros.find(x => x.id == membroId);
    if (m) m.isAdmin = tornarAdmin;
    renderDashboard();
    showSnackbar(tornarAdmin ? 'Admin concedido!' : 'Admin removido.');
  } catch (e) { showSnackbar(`${e.message}`); }
}

// ── Membros ──────────────────────────────────────────────────
function renderMembros(filtroGrupoId = empresaFilterAtivo) {
  const container = document.getElementById('empresa-member-list');
  if (!container) return;

  let membros = empresaState.membros;
  if (filtroGrupoId !== 'todos') {
    membros = membros.filter(m => String(m.grupoId) === String(filtroGrupoId));
  }

  if (!membros.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:32px 16px;color:var(--text-muted)">
        <i class="fa-solid fa-users" style="font-size:28px;opacity:.2;display:block;margin-bottom:10px"></i>
        <p style="font-size:13px">Nenhum membro encontrado.</p>
      </div>`;
    return;
  }

  container.innerHTML = membros.map(m => {
    const grupo = empresaState.grupos.find(g => g.id == m.grupoId);
    return `
    <div class="empresa-member-card" data-mid="${m.id}">
      <div class="membro-avatar">${m.nome[0].toUpperCase()}</div>
      <div class="membro-info">
        <div class="membro-nome">${m.nome}${m.isMe ? ' <span style="font-size:10px;color:var(--accent)">(você)</span>' : ''}</div>
        ${grupo
          ? `<span class="membro-grupo-tag" style="background:${grupo.cor}22;color:${grupo.cor}">
               <i class="fa-solid ${grupo.icone}" style="font-size:10px"></i>${grupo.nome}
             </span>`
          : `<span class="membro-no-grupo">Sem grupo</span>`
        }
      </div>
      <span class="membro-role-badge ${m.isAdmin ? 'admin' : ''}">${m.isAdmin ? 'Admin' : 'Membro'}</span>
    </div>`;
  }).join('');

  container.querySelectorAll('.empresa-member-card').forEach(card => {
    const mid = card.dataset.mid;

    // Clique simples → abre sheet de grupo (apenas admin)
    card.addEventListener('click', () => {
      if (!empresaState.isAdmin) return;
      abrirMembroSheet(mid);
    });

    // Clique longo → context menu (apenas admin, não em si mesmo)
    if (!empresaState.isAdmin) return;
    const m = empresaState.membros.find(x => x.id == mid);
    if (m?.isMe) return;

    card.addEventListener('pointerdown', () => {
      ctxMenuTimeout = setTimeout(() => {
        navigator.vibrate?.(40);
        showMemberContextMenu(mid, card);
      }, 500);
    });
    card.addEventListener('pointerup',    () => clearTimeout(ctxMenuTimeout));
    card.addEventListener('pointerleave', () => clearTimeout(ctxMenuTimeout));
    card.addEventListener('pointermove',  () => clearTimeout(ctxMenuTimeout));
    // Evita que o clique longo abra o sheet também
    card.addEventListener('contextmenu', e => e.preventDefault());
  });
}

// ── Grupos ───────────────────────────────────────────────────
function renderGrupos() {
  // ── Lista dentro do settings sheet ──
  const settingsList  = document.getElementById('settings-group-list');
  const settingsEmpty = document.getElementById('settings-empty-groups');

  if (settingsList) {
    if (!empresaState?.grupos.length) {
      settingsList.innerHTML = '';
      settingsEmpty?.classList.remove('hidden');
    } else {
      settingsEmpty?.classList.add('hidden');
      settingsList.innerHTML = empresaState.grupos.map(g => {
        const count = empresaState.membros.filter(m => m.grupoId == g.id).length;
        return `
        <div class="settings-grupo-card" data-gid="${g.id}">
          <div class="settings-grupo-icon" style="background:${g.cor}22;color:${g.cor}">
            <i class="fa-solid ${g.icone}"></i>
          </div>
          <div class="settings-grupo-info">
            <div class="settings-grupo-nome">${g.nome}</div>
            <div class="settings-grupo-count">${count} membro${count !== 1 ? 's' : ''}</div>
          </div>
          ${empresaState.isAdmin
            ? `<div class="settings-grupo-edit"><i class="fa-solid fa-pen"></i></div>`
            : ''}
        </div>`;
      }).join('');

      settingsList.querySelectorAll('.settings-grupo-card').forEach(card => {
        card.addEventListener('click', () => {
          if (!empresaState.isAdmin) return;
          abrirGrupoSheet('editar', card.dataset.gid);
        });
      });
    }
  }

  // ── Botão "criar grupo": oculto para não-admins ──
  const btnCriar = document.getElementById('btn-criar-grupo');
  if (btnCriar) btnCriar.style.display = empresaState?.isAdmin ? '' : 'none';
}


// ── Filter chips ─────────────────────────────────────────────
function renderFilterChips() {
  const row = document.getElementById('membros-filter-row');
  if (!row) return;

  row.innerHTML = [
    `<button class="empresa-filter-chip ${empresaFilterAtivo === 'todos' ? 'active' : ''}" data-filter="todos">Todos</button>`,
    ...(empresaState?.grupos.map(g =>
      `<button class="empresa-filter-chip ${empresaFilterAtivo == g.id ? 'active' : ''}" data-filter="${g.id}"
        style="${empresaFilterAtivo == g.id ? `border-color:${g.cor};color:${g.cor};background:${g.cor}22` : ''}">${g.nome}</button>`
    ) || [])
  ].join('');

  row.querySelectorAll('.empresa-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      empresaFilterAtivo = chip.dataset.filter;
      renderFilterChips();
      renderMembros(empresaFilterAtivo);
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────
function openSheet(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function closeSheet(id) { document.getElementById(id)?.classList.add('hidden'); }

function setBtnLoading(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled = on;
  el.style.opacity = on ? '0.6' : '';
}

function resetColorPicker(pickerId, activeCor) {
  document.querySelectorAll(`#${pickerId} .color-swatch`).forEach(sw => {
    sw.classList.toggle('active',
      sw.style.background === activeCor || sw.style.backgroundColor === activeCor);
  });
}
function resetIconPicker(pickerId, activeIc) {
  document.querySelectorAll(`#${pickerId} .icon-option`).forEach(opt => {
    opt.classList.toggle('active', opt.querySelector('i')?.classList.contains(activeIc));
  });
}

function shakeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--accent-danger)';
  el.animate([
    { transform: 'translateX(-4px)' },
    { transform: 'translateX(4px)' },
    { transform: 'translateX(-3px)' },
    { transform: 'translateX(0)' },
  ], { duration: 300, easing: 'ease-out' });
  setTimeout(() => { el.style.borderColor = ''; }, 1500);
}

function abrirAtribuirTarefa(membroId) {
  const m = empresaState?.membros.find(x => x.id == membroId);
  if (!m) return;
  _atribuindoParaId = membroId;

  // Injeta banner no sheet (só uma vez)
  const panel = document.querySelector('#add-task-sheet .sheet-panel');
  _atribuindoBanner = document.getElementById('atribuir-banner');
  if (!_atribuindoBanner && panel) {
    _atribuindoBanner = document.createElement('div');
    _atribuindoBanner.id = 'atribuir-banner';
    _atribuindoBanner.className = 'atribuir-banner';
    // Insere após o sheet-handle
    const handle = panel.querySelector('.sheet-handle');
    handle?.insertAdjacentElement('afterend', _atribuindoBanner);
  }

  if (_atribuindoBanner) {
    const grupo = empresaState.grupos.find(g => g.id == m.grupoId);
    _atribuindoBanner.innerHTML = `
      <div class="atribuir-banner-inner">
        <div class="atribuir-banner-avatar">${m.nome[0].toUpperCase()}</div>
        <div>
          <span class="atribuir-banner-label">Atribuindo para</span>
          <span class="atribuir-banner-nome">${m.nome}</span>
          ${grupo ? `<span class="atribuir-banner-grupo" style="color:${grupo.cor}">${grupo.nome}</span>` : ''}
        </div>
        <button class="atribuir-banner-clear" id="btn-cancelar-atribuir">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`;
    _atribuindoBanner.classList.remove('hidden');

    document.getElementById('btn-cancelar-atribuir')?.addEventListener('click', cancelarAtribuir);
  }

  // Abre o sheet normal reutilizando openAddTask existente
  openAddTask();
  document.getElementById('task-sheet-title').textContent = 'Nova Tarefa para Membro';
}

function cancelarAtribuir() {
  _atribuindoParaId = null;
  _atribuindoBanner?.classList.add('hidden');
  closeSheet('add-task-sheet');
}

function bindAtribuirTarefaSave() {
  const btn = document.getElementById('save-task-btn');
  if (!btn || btn._empresaHooked) return;
  btn._empresaHooked = true;

  btn.addEventListener('click', async (e) => {
    if (!_atribuindoParaId) return; // fluxo normal continua
    e.stopImmediatePropagation();   // bloqueia o saveTask original

    const rawTitle = document.getElementById('task-title-input').value.trim();
    if (!rawTitle) return;

    // ── Hora: lê o campo corretamente (mesmo padrão do saveTask corrigido) ──
    const taskTimeRaw = document.getElementById('task-time').value;
    const taskTime    = taskTimeRaw && taskTimeRaw.trim() !== '' ? taskTimeRaw.trim() : null;

    const dueDate  = document.getElementById('task-due-date').value  || todayISO();
    const repeat   = document.getElementById('task-repeat').value;
    const energy   = document.getElementById('task-energy').value;
    const notes    = document.getElementById('task-notes').value.trim();
    const imp      = document.querySelector('.imp-btn.active')?.dataset.imp || 'Padrão';
    const catId    = state?._newTaskCat || state?.categories[0]?.id || null;
    const isMission = (typeof _newTaskType !== 'undefined' ? _newTaskType : 'task') === 'mission';

    // Lembrete
    const remindBefore     = typeof _remindVal !== 'undefined' && _remindVal !== 'none' ? _remindVal : null;
    const remindBeforeDays = remindBefore === 'custom' ? (_remindCustom || 1) : null;
    const remindDate       = typeof calcRemindDate === 'function'
      ? calcRemindDate(dueDate, remindBefore, remindBeforeDays) : null;

    // Insistente
    const insistent    = typeof _insistentOn !== 'undefined' ? _insistentOn : false;
    const insistentMin = insistent && typeof _insistentMin !== 'undefined' ? _insistentMin : null;

    const tarefa = {
      id:              `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type:            isMission ? 'mission' : 'task',
      title:           rawTitle,
      notes,
      catId,
      importance:      imp,
      dueDate,
      taskTime,                  // ← campo correto
      estimateMinutes: null,     // preenchido pela IA se for missão
      repeat,
      energy,
      remindBefore,
      remindBeforeDays,
      remindDate,
      insistent,
      insistentMin,
      status:          'todo',
      createdAt:       Date.now(),
      xpEarned:        0,
      assignedBy:      state?.userName || empresaState?.membros?.find(m => m.isMe)?.nome || 'Admin',
    };

    // ── Captura o id ANTES de cancelarAtribuir() zerá-lo ──
    const membroDestino = _atribuindoParaId;

    setBtnLoading('save-task-btn', true);

    // ── Fecha o sheet imediatamente (não espera a IA) ──
    cancelarAtribuir();

    try {
      // ── Se for missão: chama a IA antes de enviar ao backend ──
      if (isMission) {
        showSnackbar('Gerando subtarefas com IA…');
        try {
          const cat = state?.categories?.find(c => c.id === catId);
          const payload = {
            task: {
              title:           rawTitle,
              notes,
              importance:      imp,
              category:        cat?.name || 'Geral',
              estimateMinutes: null,
              energy,
              dueDate,
            },
            user: {
              name:      state?.userName      || 'Admin',
              profile:   state?.userProfile   || 'Projetos Pessoais',
              rhythm:    state?.userRhythm    || 'moderado',
              peak:      state?.userPeak      || 'variavel',
              challenge: state?.userChallenge || 'foco',
              level:     state?.level         || 1,
              streak:    state?.streak        || 0,
            },
          };

          const res = await fetch('/api/expand-task', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
          });

          if (res.ok) {
            const data = await res.json();
            tarefa.missionTitle      = data.missionTitle     || rawTitle;
            tarefa.totalXP           = data.totalXP          || 0;
            tarefa.estimatedMinutes  = data.estimatedMinutes || 0;
            tarefa.subtasks          = (data.subtasks || []).map(st => ({ ...st, done: false }));
          }
        } catch (aiErr) {
          console.warn('[empresa] IA falhou ao expandir missão:', aiErr.message);
          // Continua sem subtarefas — não bloqueia a atribuição
        }
      }

      await apiEmpresa('POST', `/empresa/membros/${membroDestino}/tarefas`, tarefa);

      // Atualiza state local para renderTarefas()
      if (!empresaState.tarefas) empresaState.tarefas = [];
      empresaState.tarefas.unshift({
        ...tarefa,
        assigneeId: membroDestino,
        concluida:  false,
      });

      const nomeDestino = empresaState.membros.find(m => m.id == membroDestino)?.nome || 'membro';
      renderTarefas();
      showSnackbar(`${isMission ? 'Missão' : 'Tarefa'} atribuída a ${nomeDestino}!`);
    } catch (err) {
      showSnackbar(`Erro: ${err.message}`);
    } finally {
      setBtnLoading('save-task-btn', false);
    }
  }, true); // capture:true — roda antes do listener original
}

async function _syncTarefaEmpresaConcluida(rowId) {
  try {
    await apiEmpresa('PATCH', `/empresa/tarefas/${rowId}/concluir`);
    // Atualiza state local para refletir na tab Tarefas sem reload
    if (empresaState?.tarefas) {
      const t = empresaState.tarefas.find(t => t.rowId == rowId);
      if (t) t.concluida = true;
      // Re-renderiza só se a tab tarefas estiver ativa
      const tabAtiva = document.querySelector('.empresa-tab.active')?.dataset.etab;
      if (tabAtiva === 'tarefas') renderTarefas();
    }
  } catch (e) {
    console.warn('[empresa] falha ao sincronizar conclusão:', e.message);
    // Silencioso — não bloqueia o fluxo normal do usuário
  }
}

document.addEventListener('click', e => {
  const closeId = e.target.dataset?.close;
  if (closeId) closeSheet(closeId);
});
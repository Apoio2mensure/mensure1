// ============================================================
// SISTEMA GESTOR ANA PAULA — Core JS Compartilhado
// Arquivo: app.js
// ============================================================

// ── CONFIGURAÇÃO ─────────────────────────────────────────
// ⚠️ IMPORTANTE: Cole aqui a URL do seu Web App do Google Apps Script
const API_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbzK84RHWOK9IAPLOtVHrhggSDzLI0JGjTVepd89tXedZ_X2rMtnkYOesgOiB-sPqifgKw/exec';
const API_URL = localStorage.getItem('api_url') || API_URL_DEFAULT;

// ── ESTADO GLOBAL ────────────────────────────────────────
window.AppState = {
  clientes: [],
  recibos: [],
  config: {}
};

// ── API ──────────────────────────────────────────────────
async function apiPost(payload) {
  const url = localStorage.getItem('api_url') || API_URL_DEFAULT;
  if (!url) {
    showToast('URL da API não configurada. Acesse o Painel ADM.', 'error');
    throw new Error('API URL not set');
  }
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' }, // evita CORS preflight
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  return json;
}

async function loadData() {
  try {
    const data = await apiPost({ action: 'get_data' });
    window.AppState.clientes = data.clientes || [];
    window.AppState.recibos = data.recibos || [];
    window.AppState.config = data.config || {};
    return data;
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    throw err;
  }
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── MODAL ─────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── FORMATAÇÃO ────────────────────────────────────────────
function formatCurrency(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Remove qualquer sufixo de horário (ex: T00:00:00.000Z que vem do Google Sheets)
  const soData = String(dateStr).split('T')[0];
  const [y, m, d] = soData.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}
function formatCPF(cpf) {
  const c = String(cpf || '').replace(/\D/g, '').padStart(11, '0');
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
function cleanCPF(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}
function cpfComZeros(cpf) {
  return cleanCPF(cpf).padStart(11, '0');
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function monthLabel(dateStr) {
  if (!dateStr) return '';
  const [y, m] = String(dateStr).split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m) - 1]}/${y}`;
}

// ── VALIDAÇÃO DE CPF ──────────────────────────────────────
function validateCPF(cpf) {
  cpf = cleanCPF(cpf);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf[i - 1]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf[i - 1]) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(cpf[10]);
}

// ── MÁSCARA DE CPF ────────────────────────────────────────
function applyMaskCPF(input) {
  input.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
    this.value = v;
  });
}

// ── TRAVA DE COMPETÊNCIA (Frontend) ──────────────────────
function isDateLocked(dateStr) {
  const config = window.AppState.config;
  if (!config.data_trava || config.data_trava === '2000-01-01') return false;
  const dataTrava = new Date(config.data_trava + 'T00:00:00');
  const dataAtendimento = new Date(dateStr + 'T00:00:00');
  return dataAtendimento <= dataTrava;
}

// ── NAVBAR ────────────────────────────────────────────────
function initNavbar() {
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('navOverlay');
  if (!hamburger || !overlay) return;
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  // Fecha ao clicar em link
  overlay.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      overlay.classList.remove('open');
    });
  });
  // Marca link ativo
  const cur = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, #navOverlay a').forEach(a => {
    if (a.getAttribute('href') === cur) a.classList.add('active');
  });
}

// ── EXPORTAÇÃO CSV (Motor Carnê-Leão) ────────────────────
function exportarCSV(recibos, clientes, config, filtroMes) {
  let linhas = recibos;
  if (filtroMes) {
    linhas = recibos.filter(r => String(r.DATA_ATENDIMENTO || '').startsWith(filtroMes));
  }
  if (linhas.length === 0) {
    showToast('Nenhum recibo encontrado para exportar.', 'error');
    return;
  }

  const clienteMap = {};
  clientes.forEach(c => { clienteMap[String(c.ID)] = c; });

  const rows = linhas.map(r => {
    const data = String(r.DATA_ATENDIMENTO || '');
    const dataFmt = formatDate(data);
    // ✅ Valor com VÍRGULA como separador decimal (padrão BR: 100,00)
    const valorNum = Number(r.VALOR || 0);
    const valorCSV = valorNum.toFixed(2).replace('.', ',');    // ex: 150,00
    const valorHist = valorNum.toFixed(2).replace('.', ',');    // ex: 150,00
    const cliente = clienteMap[String(r.CLIENTE_ID)] || {};
    const cpf = cpfComZeros(cliente.CPF || '');
    const tipoFmt = String(r.TIPO_CONSULTA || '').toUpperCase(); // PRESENCIAL ou ONLINE
    const historico = `REFERENTE A SESSAO DE PSICOTERAPIA REALIZADA NA DATA ${dataFmt} NO VALOR DE R$ ${valorHist} DE FORMA ${tipoFmt}`;

    // 16 colunas posicionais
    return [
      dataFmt,                        // 1 - Data do Atendimento  (DD/MM/AAAA)
      config.codigo_rendimento || '', // 2 - Código do Rendimento
      config.codigo_ocupacao || '', // 3 - Código de Ocupação
      valorCSV,                       // 4 - Valor Recebido        (100,00)
      '',                             // 5 - Valor de Dedução (VAZIO)
      historico,                      // 6 - Histórico
      'PF',                           // 7 - Recebido de
      cpf,                            // 8 - CPF Titular Pagamento
      cpf,                            // 9 - CPF Beneficiário
      '',                             // 10 - Indicador CPF não inf. (VAZIO)
      '',                             // 11 - CNPJ (VAZIO)
      '',                             // 12 - Indicador IRRF (VAZIO)
      '',                             // 13 - Valor IRRF (VAZIO)
      'S',                            // 14 - Indicador de Recibo
      cpfComZeros(config.cpf_profissional || ''),   // 15 - CPF do Profissional
      config.registro_profissional || ''             // 16 - Registro Profissional
    ].join(';');
  });

  const csv = rows.join('\r\n');
  // ✅ BOM UTF-8 (\uFEFF) garante leitura correta no Carnê-Leão e Excel
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // ✅ Nome do arquivo: carneLeao_YYYY-MM.csv
  const nomeProfissional = (config.nome_profissional || 'Ana Paula').trim();
  const mesLabel = filtroMes || 'completo';
  a.download = `carneLeao_${mesLabel}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`CSV exportado com ${linhas.length} lançamento(s)! Arquivo: carneLeao_${mesLabel}.csv`, 'success');
}

// Inicializa navbar em toda página
document.addEventListener('DOMContentLoaded', initNavbar);

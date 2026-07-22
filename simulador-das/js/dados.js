/**
 * dados.js – Tabelas do Simples Nacional 2026 + carregamento do CSV de CNAEs
 * Mensure Assessoria Contábil
 */

"use strict";

// ── TABELAS DE ANEXOS 2026 ───────────────────────────────────────────────────
const ANEXOS = {
  I: {
    nome: "Anexo I – Comércio",
    cor: "#58A6FF",
    faixas: [
      { max: 180000,  al: 0.040, ded: 0 },
      { max: 360000,  al: 0.073, ded: 5940 },
      { max: 720000,  al: 0.095, ded: 13860 },
      { max: 1800000, al: 0.107, ded: 22500 },
      { max: 3600000, al: 0.143, ded: 87300 },
      { max: 4800000, al: 0.190, ded: 378000 },
    ],
  },
  II: {
    nome: "Anexo II – Indústria",
    cor: "#A5D6FF",
    faixas: [
      { max: 180000,  al: 0.045, ded: 0 },
      { max: 360000,  al: 0.078, ded: 5940 },
      { max: 720000,  al: 0.100, ded: 13860 },
      { max: 1800000, al: 0.112, ded: 22500 },
      { max: 3600000, al: 0.147, ded: 85500 },
      { max: 4800000, al: 0.300, ded: 720000 },
    ],
  },
  III: {
    nome: "Anexo III – Serviços",
    cor: "#3FB950",
    faixas: [
      { max: 180000,  al: 0.060, ded: 0 },
      { max: 360000,  al: 0.112, ded: 9360 },
      { max: 720000,  al: 0.135, ded: 17640 },
      { max: 1800000, al: 0.160, ded: 35640 },
      { max: 3600000, al: 0.210, ded: 125640 },
      { max: 4800000, al: 0.330, ded: 648000 },
    ],
  },
  IV: {
    nome: "Anexo IV – Serviços",
    cor: "#D29922",
    faixas: [
      { max: 180000,  al: 0.045, ded: 0 },
      { max: 360000,  al: 0.090, ded: 8100 },
      { max: 720000,  al: 0.102, ded: 12420 },
      { max: 1800000, al: 0.140, ded: 39780 },
      { max: 3600000, al: 0.220, ded: 183780 },
      { max: 4800000, al: 0.330, ded: 828000 },
    ],
  },
  V: {
    nome: "Anexo V – Serviços",
    cor: "#C9A84C",
    faixas: [
      { max: 180000,  al: 0.155, ded: 0 },
      { max: 360000,  al: 0.180, ded: 4500 },
      { max: 720000,  al: 0.195, ded: 9900 },
      { max: 1800000, al: 0.205, ded: 17100 },
      { max: 3600000, al: 0.230, ded: 62100 },
      { max: 4800000, al: 0.305, ded: 540000 },
    ],
  },
};

// Labels das faixas
const FAIXA_LABELS = ["1ª Faixa", "2ª Faixa", "3ª Faixa", "4ª Faixa", "5ª Faixa", "6ª Faixa"];

// ── CARREGAMENTO DO CSV DE CNAEs ─────────────────────────────────────────────

/**
 * Faz parse de uma linha CSV respeitando vírgulas dentro de aspas
 * (simples, sem biblioteca externa)
 */
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Carrega e parseia o arquivo cnaes.csv
 * Retorna Promise<Array<{codigo, descricao, anexo, fatorR}>>
 */
async function carregarCNAEs() {
  try {
    // Path relativo à página index.html (sempre na raiz do projeto)
    const csvPath = "data/cnaes.csv";

    const resp = await fetch(csvPath);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const text = await resp.text();
    const linhas = text.split("\n").map(l => l.trim()).filter(Boolean);

    // Pula o cabeçalho
    const dados = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = parseCsvLine(linhas[i]);
      if (cols.length < 4) continue;

      const [codigo, descricao, anexo, fatorR] = cols;
      if (!codigo || !descricao || !anexo) continue;

      dados.push({
        codigo: codigo.replace(/\D/g, ""), // só dígitos
        descricao: descricao.replace(/^"|"$/g, ""),
        anexo: anexo.toUpperCase().trim(),
        fatorR: fatorR.toLowerCase().trim() === "sim",
      });
    }

    return dados;
  } catch (err) {
    console.error("[CNAEs] Erro ao carregar CSV:", err);
    return [];
  }
}

// As variáveis ANEXOS, FAIXA_LABELS e carregarCNAEs ficam no escopo global
// (scripts carregados sem type="module" compartilham o escopo window)

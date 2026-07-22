/**
 * calculos.js – Lógica de cálculo do DAS e Fator R – Simples Nacional 2026
 * Mensure Assessoria Contábil
 */

"use strict";

// ── FORMATADORES ────────────────────────────────────────────────────────────

/** Formata número como moeda BRL */
function fmtBRL(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata número como percentual (ex: 6,00%) */
function fmtPct(valor) {
  return valor.toFixed(2).replace(".", ",") + "%";
}

/** Converte string de moeda BRL para número (ex: "30.000,00" → 30000) */
function parseMoeda(str) {
  if (!str && str !== 0) return 0;
  return (
    parseFloat(
      String(str)
        .replace(/\./g, "")   // remove separadores de milhar
        .replace(",", ".")     // vírgula → ponto decimal
    ) || 0
  );
}

// ── FATOR R ─────────────────────────────────────────────────────────────────

/**
 * Calcula o Fator R (percentual da folha sobre a RBT12)
 *
 * @param {number} folha12m  – Folha de pagamento acumulada 12 meses (R$)
 * @param {number} rbt12     – Receita bruta total dos últimos 12 meses (R$)
 * @returns {{ percentual: number, atingiu: boolean, faltaParaAtingir: number }}
 */
function calcularFatorR(folha12m, rbt12) {
  if (rbt12 <= 0 || folha12m < 0) {
    return { percentual: 0, atingiu: false, faltaParaAtingir: 0 };
  }

  const percentual = (folha12m / rbt12) * 100;
  const atingiu = percentual >= 28;

  // Quanto falta na folha para atingir 28%
  const metaFolha = rbt12 * 0.28;
  const faltaParaAtingir = Math.max(0, metaFolha - folha12m);

  return { percentual, atingiu, faltaParaAtingir };
}

// ── DETERMINAÇÃO DO ANEXO FINAL ──────────────────────────────────────────────

/**
 * Determina qual anexo a empresa vai usar com base no CNAE e Fator R.
 *
 * Regra:
 *  - Empresas sem Fator R → anexo fixo do CNAE
 *  - Empresas com Fator R → começa no Anexo V
 *      → se folha/RBT12 ≥ 28%, migra para Anexo III
 *
 * @param {object} cnae       – { anexo: string, fatorR: boolean }
 * @param {boolean} atingiuFR – Se o Fator R foi atingido (≥28%)
 * @returns {string} – chave do anexo: "I", "II", "III", "IV" ou "V"
 */
function determinarAnexoFinal(cnae, atingiuFR) {
  if (!cnae) return null;

  if (cnae.fatorR) {
    // Fator R: começa no V, migra para III se atingiu 28%
    return atingiuFR ? "III" : "V";
  }

  // Sem Fator R: anexo fixo
  return cnae.anexo;
}

// ── CÁLCULO DO DAS ───────────────────────────────────────────────────────────

/**
 * Calcula o DAS do mês com base na alíquota efetiva do Simples Nacional.
 *
 * Fórmula:
 *   Alíquota efetiva = (RBT12 × Alíquota nominal − Dedução) / RBT12
 *   DAS = Receita do mês × Alíquota efetiva
 *
 * @param {number} rbt12       – Receita bruta dos últimos 12 meses (R$)
 * @param {number} receitaMes  – Receita bruta do mês atual (R$)
 * @param {string} anexoKey    – Chave do anexo ("I" a "V")
 * @param {object} ANEXOS      – Tabela de anexos
 * @returns {{
 *   das: number,
 *   aliqEfetiva: number,
 *   aliqNominal: number,
 *   deducao: number,
 *   faixaIndex: number,
 *   faixaLabel: string,
 *   maxFaixa: number,
 *   anexoKey: string
 * } | null}
 */
function calcularDAS(rbt12, receitaMes, anexoKey, ANEXOS) {
  if (!rbt12 || !receitaMes || !anexoKey || !ANEXOS[anexoKey]) return null;

  const { faixas } = ANEXOS[anexoKey];

  // Encontra a faixa com base no RBT12
  let faixaIndex = faixas.findIndex((f) => rbt12 <= f.max);
  if (faixaIndex === -1) faixaIndex = faixas.length - 1; // 6ª faixa (limite)

  const faixa = faixas[faixaIndex];
  const aliqNominal  = faixa.al;
  const deducao      = faixa.ded;

  // Alíquota efetiva
  const aliqEfetiva = (rbt12 * aliqNominal - deducao) / rbt12;

  // DAS do mês
  const das = receitaMes * aliqEfetiva;

  return {
    das,
    aliqEfetiva: aliqEfetiva * 100,     // em %
    aliqNominal: aliqNominal * 100,     // em %
    deducao,
    faixaIndex,
    maxFaixa: faixa.max,
    anexoKey,
  };
}

// ── BUSCA DE CNAEs ───────────────────────────────────────────────────────────

/**
 * Filtra a lista de CNAEs com base em um termo de busca.
 * Busca por código numérico ou trecho da descrição.
 *
 * @param {string}  termo   – Texto digitado pelo usuário
 * @param {Array}   cnaes   – Lista completa de CNAEs
 * @param {number}  limite  – Máximo de resultados (padrão: 10)
 * @returns {Array}
 */
function buscarCNAEs(termo, cnaes, limite = 10) {
  if (!termo || termo.length < 2 || !cnaes) return [];

  const t = termo.toLowerCase().trim();
  const isNum = /^\d+$/.test(t);

  return cnaes
    .filter((c) =>
      isNum
        ? c.codigo.includes(t)
        : c.descricao.toLowerCase().includes(t)
    )
    .slice(0, limite);
}

// ── MÁSCARA DE MOEDA ─────────────────────────────────────────────────────────

/**
 * Aplica máscara de moeda BRL ao valor digitado num <input>
 * (sem biblioteca externa)
 *
 * @param {string} valor – Valor bruto digitado
 * @returns {string}     – Valor formatado (ex: "30.000,00")
 */
function mascaraMoeda(valor) {
  let num = valor.replace(/\D/g, ""); // só dígitos
  if (!num) return "";

  // Remove zeros à esquerda
  num = num.replace(/^0+/, "") || "0";

  // Formata como centavos
  while (num.length < 3) num = "0" + num;

  const centavos = num.slice(-2);
  let reais = num.slice(0, -2);

  // Adiciona separadores de milhar
  reais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return reais + "," + centavos;
}

// Todas as funções ficam no escopo global (scripts sem type="module")

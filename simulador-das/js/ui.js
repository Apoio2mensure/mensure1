/**
 * ui.js – Renderização e interatividade do Simulador Simples Nacional
 * Mensure Assessoria Contábil
 */

"use strict";

// ── ESTADO DA APLICAÇÃO ──────────────────────────────────────────────────────
const estado = {
  cnaes:       [],       // lista completa carregada do CSV
  cnaeSelected: null,    // CNAE selecionado pelo usuário
  tab:         "busca",  // "busca" | "manual"
  anexoManual: "I",      // anexo selecionado no modo manual
  // Valores dos inputs
  receitaMes:  0,
  rbt12:       0,
  folha12m:    0,
};

// ── ELEMENTOS DO DOM ─────────────────────────────────────────────────────────
let el = {};

function capturarElementos() {
  el = {
    // Loading
    loading:           document.getElementById("sim-loading"),
    app:               document.getElementById("sim-app"),

    // Tabs
    tabBusca:          document.getElementById("tab-busca"),
    tabManual:         document.getElementById("tab-manual"),
    panelBusca:        document.getElementById("panel-busca"),
    panelManual:       document.getElementById("panel-manual"),

    // Busca
    inputBusca:        document.getElementById("input-busca"),
    dropdown:          document.getElementById("sim-dropdown"),
    selectedWrap:      document.getElementById("selected-wrap"),
    selectedCode:      document.getElementById("selected-code"),
    selectedName:      document.getElementById("selected-name"),
    selectedBadges:    document.getElementById("selected-badges"),
    btnClear:          document.getElementById("btn-clear"),
    searchHint:        document.getElementById("search-hint"),

    // Manual
    anexoBtns:         document.querySelectorAll(".sim-anexo-btn"),
    anexoNome:         document.getElementById("anexo-nome"),

    // Receitas
    inputRm:           document.getElementById("input-rm"),
    inputRbt:          document.getElementById("input-rbt"),
    rbtEstimado:       document.getElementById("rbt-estimado"),

    // Fator R
    secaoFatorR:       document.getElementById("secao-fatorr"),
    inputFolha:        document.getElementById("input-folha"),
    frResultado:       document.getElementById("fr-resultado"),
    frPct:             document.getElementById("fr-pct"),
    frPctGauge:        document.getElementById("fr-pct-gauge"),
    frGaugeWrap:       document.getElementById("fr-gauge-wrap"),
    frMeta:            document.getElementById("fr-meta"),
    frStatus:          document.getElementById("fr-status"),
    frStatusTitle:     document.getElementById("fr-status-title"),
    frStatusDetail:    document.getElementById("fr-status-detail"),
    frProgressFill:    document.getElementById("fr-progress-fill"),

    // Resultado
    secaoResultado:    document.getElementById("secao-resultado"),
    resultAnexoLabel:  document.getElementById("result-anexo-label"),
    resultDas:         document.getElementById("result-das"),
    metricEfetiva:     document.getElementById("metric-efetiva"),
    metricNominal:     document.getElementById("metric-nominal"),
    metricFaixa:       document.getElementById("metric-faixa"),
    metricDeducao:     document.getElementById("metric-deducao"),
    tabelaAnexoNome:   document.getElementById("tabela-anexo-nome"),
    tabelaBody:        document.getElementById("tabela-body"),
  };
}

// ── ABAS ─────────────────────────────────────────────────────────────────────
function setTab(novaTab) {
  estado.tab = novaTab;
  estado.cnaeSelected = null;
  limparBusca();

  el.tabBusca.classList.toggle("active", novaTab === "busca");
  el.tabManual.classList.toggle("active", novaTab === "manual");
  el.panelBusca.classList.toggle("hidden", novaTab !== "busca");
  el.panelManual.classList.toggle("hidden", novaTab !== "manual");

  recalcular();
}

// ── BUSCA COM DEBOUNCE ────────────────────────────────────────────────────────
let debounceTimer = null;

function onInputBusca(e) {
  const val = e.target.value;

  if (estado.cnaeSelected) {
    // Se usuário edita após selecionar, deseleciona
    estado.cnaeSelected = null;
    esconderSelecionado();
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => renderDropdown(val), 180);
}

function renderDropdown(termo) {
  const hits = buscarCNAEs(termo, estado.cnaes, 10);

  el.dropdown.innerHTML = "";

  if (hits.length === 0 && termo.length > 1) {
    el.dropdown.innerHTML = `<div class="sim-empty">Nenhum CNAE encontrado. Tente outra palavra-chave.</div>`;
    el.dropdown.classList.remove("hidden");
    el.searchHint.classList.add("hidden");
    return;
  }

  if (hits.length === 0) {
    el.dropdown.classList.add("hidden");
    return;
  }

  hits.forEach((cnae) => {
    const item = document.createElement("div");
    item.className = "sim-dropdown-item";
    item.innerHTML = `
      <span class="sim-dropdown-code">${cnae.codigo}</span>
      <span class="sim-dropdown-desc" title="${cnae.descricao}">${cnae.descricao}</span>
      <span class="sim-dropdown-badges">
        ${badgeAnexo(cnae.anexo, cnae.fatorR)}
        ${cnae.fatorR ? '<span class="badge badge-gold">⚖ Fator R</span>' : ""}
      </span>
    `;
    item.addEventListener("click", () => selecionarCNAE(cnae));
    el.dropdown.appendChild(item);
  });

  el.dropdown.classList.remove("hidden");
  el.searchHint.classList.add("hidden");
}

function badgeAnexo(anexo, fatorR) {
  const cores = { I: "blue", II: "blue", III: "green", IV: "orange", V: "gold" };
  const cor = cores[anexo] || "gray";
  return `<span class="badge badge-${cor}">Anexo ${anexo}</span>`;
}

function selecionarCNAE(cnae) {
  estado.cnaeSelected = cnae;
  el.inputBusca.value = cnae.descricao;
  el.dropdown.classList.add("hidden");

  // Mostra painel de selecionado
  el.selectedCode.textContent = cnae.codigo;
  el.selectedName.textContent = cnae.descricao;

  const badges = [];
  if (cnae.fatorR) {
    badges.push(`<span class="badge badge-gold">⚖ Sujeito ao Fator R</span>`);
    badges.push(`<span class="badge badge-orange">Inicia no Anexo V</span>`);
    badges.push(`<span class="badge badge-green">Com folha ≥ 28% → Anexo III</span>`);
  } else {
    badges.push(`${badgeAnexo(cnae.anexo, false)} <span class="badge badge-gray">Anexo Fixo</span>`);
  }
  el.selectedBadges.innerHTML = badges.join(" ");

  el.selectedWrap.classList.remove("hidden");
  el.searchHint.classList.add("hidden");

  recalcular();
}

function limparBusca() {
  el.inputBusca.value = "";
  el.dropdown.classList.add("hidden");
  el.selectedWrap.classList.add("hidden");
  el.searchHint.classList.remove("hidden");
  estado.cnaeSelected = null;
  recalcular();
}

function esconderSelecionado() {
  el.selectedWrap.classList.add("hidden");
  el.searchHint.classList.remove("hidden");
  el.dropdown.classList.add("hidden");
  recalcular();
}

// Fecha dropdown ao clicar fora
document.addEventListener("click", (e) => {
  if (!el.inputBusca?.contains(e.target) && !el.dropdown?.contains(e.target)) {
    el.dropdown?.classList.add("hidden");
  }
});

// ── SELETOR MANUAL DE ANEXO ──────────────────────────────────────────────────
function setAnexoManual(ak) {
  estado.anexoManual = ak;
  el.anexoBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.anexo === ak);
  });
  if (el.anexoNome) {
    el.anexoNome.textContent = ANEXOS[ak].nome;
  }
  recalcular();
}

// ── INPUTS DE RECEITA ─────────────────────────────────────────────────────────
function onInputReceita(e) {
  const mascarado = mascaraMoeda(e.target.value);
  e.target.value = mascarado;

  const rmN  = parseMoeda(el.inputRm.value);
  const rbtN = parseMoeda(el.inputRbt.value);

  estado.receitaMes = rmN;
  estado.rbt12 = rbtN > 0 ? rbtN : rmN * 12;

  // Mostra estimativa de RBT12
  if (!el.inputRbt.value && rmN > 0) {
    el.rbtEstimado.textContent = `RBT12 estimado: ${fmtBRL(rmN * 12)}`;
    el.rbtEstimado.classList.remove("hidden");
  } else {
    el.rbtEstimado.classList.add("hidden");
  }

  recalcular();
}

// ── FATOR R INPUT ────────────────────────────────────────────────────────────
function onInputFolha(e) {
  const mascarado = mascaraMoeda(e.target.value);
  e.target.value = mascarado;
  estado.folha12m = parseMoeda(mascarado);
  recalcular();
}

// ── RECALCULAR ───────────────────────────────────────────────────────────────
function recalcular() {
  // Obtém a atividade corrente
  const ativ = estado.tab === "busca"
    ? estado.cnaeSelected
    : { anexo: estado.anexoManual, fatorR: false, descricao: ANEXOS[estado.anexoManual].nome };

  const temFatorR = ativ?.fatorR === true;

  // Exibe/oculta seção Fator R
  if (temFatorR) {
    el.secaoFatorR.classList.remove("hidden");
  } else {
    el.secaoFatorR.classList.add("hidden");
    el.frResultado.classList.add("hidden");
  }

  const rbt12     = estado.rbt12;
  const receitaMes = estado.receitaMes;
  const folha12m   = estado.folha12m;

  // Fator R
  let atingiuFR = false;
  if (temFatorR && rbt12 > 0 && folha12m > 0) {
    const fr = calcularFatorR(folha12m, rbt12);
    atingiuFR = fr.atingiu;
    renderFatorR(fr, folha12m, rbt12);
  } else if (temFatorR) {
    el.frResultado.classList.add("hidden");
  }

  // Anexo final
  const anexoFinal = ativ ? determinarAnexoFinal(ativ, atingiuFR) : null;

  // Resultado
  if (receitaMes > 0 && rbt12 > 0 && anexoFinal) {
    const res = calcularDAS(rbt12, receitaMes, anexoFinal, ANEXOS);
    if (res) {
      renderResultado(res, anexoFinal);
      return;
    }
  }

  el.secaoResultado.classList.add("hidden");
}

// ── RENDER FATOR R ────────────────────────────────────────────────────────────
function renderFatorR(fr, folha12m, rbt12) {
  el.frResultado.classList.remove("hidden");

  const pct    = fr.percentual;
  const atingiu = fr.atingiu;
  const cls    = atingiu ? "success" : "danger";

  // Gauge
  el.frPct.textContent = fmtPct(pct);
  el.frPct.className   = `sim-fatorr-pct ${cls}`;
  el.frPctGauge.className = `sim-fatorr-gauge ${cls}`;

  // Barra de progresso (clampa em 100%)
  const largura = Math.min(pct / 28 * 100, 100);
  el.frProgressFill.style.width = largura + "%";
  el.frProgressFill.className = `sim-progress-fill ${atingiu ? "success" : ""}`;

  // Status
  el.frStatus.className = `sim-fatorr-status ${cls}`;
  el.frStatusTitle.className = `sim-fatorr-status-title ${cls}`;

  if (atingiu) {
    el.frStatusTitle.textContent = "✅ Fator R atingido → Tributação pelo Anexo III (6%)";
    el.frStatusDetail.innerHTML = `
      Folha acumulada: <strong>${fmtBRL(folha12m)}</strong> = <strong>${fmtPct(pct)}</strong> da RBT12<br>
      Economia estimada vs Anexo V na 1ª faixa: <strong>9,5 pontos percentuais</strong>
    `;
  } else {
    el.frStatusTitle.textContent = "⚠️ Fator R não atingido → Tributação pelo Anexo V (15,5%)";
    const metaFolha = rbt12 * 0.28;
    const falta = Math.max(0, metaFolha - folha12m);
    el.frStatusDetail.innerHTML = `
      Folha atual: <strong>${fmtBRL(folha12m)}</strong> (${fmtPct(pct)} da RBT12)<br>
      💡 Para atingir 28%, a folha 12m precisa ser ≥ <strong>${fmtBRL(metaFolha)}</strong><br>
      Faltam: <strong>${fmtBRL(falta)}</strong>
    `;
  }
}

// ── RENDER RESULTADO ─────────────────────────────────────────────────────────
function renderResultado(res, anexoFinal) {
  el.secaoResultado.classList.remove("hidden");

  const anexo = ANEXOS[anexoFinal];

  el.resultAnexoLabel.textContent = `${anexo.nome} — DAS a recolher`;
  el.resultDas.textContent        = fmtBRL(res.das);
  el.metricEfetiva.textContent    = fmtPct(res.aliqEfetiva);
  el.metricNominal.textContent    = fmtPct(res.aliqNominal);
  el.metricFaixa.textContent      = FAIXA_LABELS[res.faixaIndex];
  el.metricDeducao.textContent    = fmtBRL(res.deducao);

  // Tabela de faixas
  el.tabelaAnexoNome.textContent = `${anexo.nome} — Faixas 2026`;
  renderTabelaFaixas(anexo.faixas, res.faixaIndex);
}

function renderTabelaFaixas(faixas, faixaAtiva) {
  el.tabelaBody.innerHTML = "";

  faixas.forEach((f, i) => {
    const anterior = i > 0 ? faixas[i - 1].max + 0.01 : 0;
    const faixaLabel = FAIXA_LABELS[i];
    const isAtiva = i === faixaAtiva;

    let faixaRange;
    if (i === 0) {
      faixaRange = `Até ${fmtBRL(f.max)}`;
    } else if (i === 5) {
      faixaRange = `${fmtBRL(anterior)} – ${fmtBRL(f.max)}`;
    } else {
      faixaRange = `${fmtBRL(anterior)} – ${fmtBRL(f.max)}`;
    }

    const tr = document.createElement("tr");
    if (isAtiva) tr.className = "active-row";

    tr.innerHTML = `
      <td>${faixaLabel}</td>
      <td>${faixaRange}</td>
      <td>${fmtPct(f.al * 100)}</td>
      <td>${fmtBRL(f.ded)}</td>
    `;
    el.tabelaBody.appendChild(tr);
  });
}

// ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────────
function inicializar(cnaes) {
  estado.cnaes = cnaes;

  capturarElementos();

  // Esconde loading, mostra app
  el.loading.classList.add("hidden");
  el.app.classList.remove("hidden");

  // Tabs
  el.tabBusca.addEventListener("click",  () => setTab("busca"));
  el.tabManual.addEventListener("click", () => setTab("manual"));

  // Busca
  el.inputBusca.addEventListener("input", onInputBusca);
  el.inputBusca.addEventListener("focus", () => {
    if (el.inputBusca.value.length > 1 && !estado.cnaeSelected) {
      renderDropdown(el.inputBusca.value);
    }
  });

  // Limpar seleção
  el.btnClear.addEventListener("click", limparBusca);

  // Seletor manual
  el.anexoBtns.forEach((btn) => {
    btn.addEventListener("click", () => setAnexoManual(btn.dataset.anexo));
  });

  // Inputs de receita
  el.inputRm.addEventListener("input",  onInputReceita);
  el.inputRbt.addEventListener("input", onInputReceita);

  // Folha de pagamento
  el.inputFolha.addEventListener("input", onInputFolha);

  // Estado inicial
  setAnexoManual("I");
}

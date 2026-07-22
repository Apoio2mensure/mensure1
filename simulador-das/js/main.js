/**
 * main.js – Ponto de entrada do Simulador Simples Nacional
 * Mensure Assessoria Contábil
 *
 * Orquestra o carregamento dos dados e inicialização da UI.
 */

"use strict";

(async function () {
  try {
    // Carrega o banco de CNAEs do CSV
    const cnaes = await carregarCNAEs();

    if (cnaes.length === 0) {
      // Fallback: mostra erro amigável
      const loading = document.getElementById("sim-loading");
      if (loading) {
        loading.innerHTML = `
          <div style="text-align:center; padding: 40px 20px; color: #F85149;">
            <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">Erro ao carregar os dados</div>
            <div style="font-size: 13px; color: #8B949E;">
              Abra o simulador via servidor web (ex: Live Server).<br>
              Navegadores bloqueiam fetch de arquivos locais por segurança.
            </div>
          </div>
        `;
      }
      return;
    }

    // Inicializa a UI com os dados carregados
    inicializar(cnaes);

  } catch (err) {
    console.error("[Simulador] Erro na inicialização:", err);
  }
})();

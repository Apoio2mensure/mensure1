/* Mensure: Google Analytics 4 (gtag) + eventos de conversão. Carregado UMA vez em todas as páginas.
   - Sem banner de cookies: medição de estatísticas liberada por padrão (anúncios/personalização seguem negados).
   - Google Tag (contêiner GTM-MVX2SM3R) carregado aqui, uma única vez, junto com o GA4.
   - Eventos enviados (sem dados pessoais): whatsapp_click, phone_click, email_click, form_submit,
     service_view, tool_use, client_login_click.
   - Todos os eventos também vão para window.dataLayer (compatível com Google Tag Manager, se for adotado depois).
   Para trocar o ID do GA4, edite GA_ID abaixo. */
(function () {
  'use strict';
  if (window.__mensureTracking) return;           // evita carregar duas vezes
  window.__mensureTracking = true;

  var GA_ID = 'G-Z0ZBCN0NXZ';
  var GTM_ID = 'GTM-MVX2SM3R';

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') window.gtag = function () { window.dataLayer.push(arguments); };

  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.mensureSetConsent = function () {};   // mantido por compatibilidade; não há mais banner

  if (!document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) {
    var g = document.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
    document.head.appendChild(g);
  }

  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  /* Grupo da página: ajuda a comparar quais áreas geram mais contatos */
  var path = location.pathname.replace(/index\.html$/, '');
  var grupo = 'institucional', servico = '';
  var m = path.match(/^\/servicos\/([^\/]+)\//i);
  if (path === '/') grupo = 'home';
  else if (m) { grupo = 'servico'; servico = m[1]; }
  else if (/^\/blog\//i.test(path)) grupo = 'blog';
  else if (/^\/simulador-das\//i.test(path) || /informacoes-cnpj/i.test(path)) grupo = 'ferramenta';
  else if (document.querySelector('meta[property="og:type"][content="article"]')) grupo = 'artigo';

  gtag('js', new Date());
  gtag('config', GA_ID, { page_group: grupo });

  function enviar(nome, extra) {
    var p = { page_group: grupo, page_path: path, service_name: servico || undefined };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) p[k] = extra[k];
    gtag('event', nome, p);
  }
  window.mensureTrack = enviar;

  function posicao(el) {
    if (el.closest('.site-header')) return 'cabecalho';
    if (el.closest('.pg-fabs, .b-fabs')) return 'botao_flutuante';
    if (el.closest('.pg-hero, .hero, .b-hero')) return 'topo';
    if (el.closest('.pg-cta, .b-cta, .contact-bg')) return 'chamada_contato';
    if (el.closest('footer')) return 'rodape';
    return 'conteudo';
  }

  var ultimo = { chave: '', t: 0 };
  function repetido(chave) {   // ignora o mesmo clique registrado duas vezes em menos de 700 ms
    var agora = Date.now(); var r = ultimo.chave === chave && agora - ultimo.t < 700;
    ultimo = { chave: chave, t: agora }; return r;
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest ? ev.target.closest('a[href]') : null;
    if (a) {
      var h = a.getAttribute('href') || '';
      var base = { link_url: h.length > 200 ? h.slice(0, 200) : h, link_text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || (a.getAttribute('aria-label') || ''), click_location: posicao(a), transport_type: 'beacon' };
      var nome = '';
      if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//i.test(h)) nome = 'whatsapp_click';
      else if (/^tel:/i.test(h)) nome = 'phone_click';
      else if (/^mailto:/i.test(h)) { nome = 'email_click'; base.link_url = 'mailto'; }
      else if (a.closest('#login') && /^https?:/i.test(h)) nome = 'client_login_click';
      else if (a.closest('.obrig-item, #obrig-body')) { nome = 'tool_use'; base.tool_name = base.link_text || 'ferramenta'; base.tool_action = 'abrir'; }
      else if (grupo === 'ferramenta' && /informacoes-cnpj/i.test(path) && /^https?:/i.test(h) && a.closest('main, section, .tools, body') && !a.closest('.site-header, footer')) { nome = 'tool_use'; base.tool_name = 'consulta_cnpj'; base.tool_action = 'consultar'; base.link_url = h.replace(/^(https?:\/\/[^\/]+).*/i, '$1'); }
      if (nome && !repetido(nome + h)) enviar(nome, base);
      return;
    }
    /* Botão "Enviar mensagem": só conta quando o formulário passou na validação (o botão fica desabilitado) */
    var b = ev.target.closest ? ev.target.closest('#form-submit-btn') : null;
    if (b) setTimeout(function () { if (b.disabled && !repetido('form')) enviar('form_submit', { form_id: 'contato', click_location: posicao(b), assunto: (document.getElementById('f-assunto') || {}).value || undefined }); }, 50);
  }, true);

  /* Formulários HTML comuns que venham a existir (exceto busca) */
  document.addEventListener('submit', function (ev) {
    var f = ev.target; if (!f || (f.getAttribute && f.getAttribute('role') === 'search')) return;
    if (!repetido('form-' + (f.id || ''))) enviar('form_submit', { form_id: f.id || 'formulario', click_location: posicao(f) });
  }, true);

  /* Página de serviço vista */
  if (grupo === 'servico') enviar('service_view', { service_title: (document.querySelector('h1') || {}).textContent ? document.querySelector('h1').textContent.trim() : servico });

  /* Simulador: primeira interação com a ferramenta */
  if (/^\/simulador-das\//i.test(path)) {
    var usou = false;
    var avisa = function (e) { if (usou || (e.target.closest && e.target.closest('.site-header, footer'))) return; usou = true; enviar('tool_use', { tool_name: 'simulador_das', tool_action: 'interacao' }); };
    document.addEventListener('input', avisa, true); document.addEventListener('click', avisa, true);
  }
})();

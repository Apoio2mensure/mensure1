'use strict';

var MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Proxies com fallback
var PROXIES = [
  function(url){ return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url); },
  function(url){ return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url); },
  function(url){ return 'https://corsproxy.io/?' + encodeURIComponent(url); }
];

async function fetchViaProxy(targetUrl, timeoutMs) {
  timeoutMs = timeoutMs || 5000;
  if (typeof Promise.any === 'function') {
    const promises = PROXIES.map(function(makeProxy) {
      return new Promise(function(resolve, reject) {
        var ctrl = new AbortController();
        var timer = setTimeout(function(){ ctrl.abort(); reject(new Error('Timeout')); }, timeoutMs);
        fetch(makeProxy(targetUrl), { signal: ctrl.signal })
          .then(function(resp){
            clearTimeout(timer);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.text();
          })
          .then(function(txt){
            if (txt && txt.trim().length > 0) resolve(txt);
            else throw new Error('Vazio');
          })
          .catch(function(err){
            clearTimeout(timer);
            reject(err);
          });
      });
    });
    try {
      return await Promise.any(promises);
    } catch(e) {
      throw new Error('Todos os proxies falharam (Promise.any)');
    }
  } else {
    var lastErr;
    for (var i = 0; i < PROXIES.length; i++) {
      try {
        var ctrl = new AbortController();
        var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs);
        var resp = await fetch(PROXIES[i](targetUrl), { signal: ctrl.signal });
        clearTimeout(timer);
        if (!resp.ok) { lastErr = new Error('HTTP ' + resp.status); continue; }
        var txt = await resp.text();
        if (txt && txt.trim().length > 0) return txt;
        throw new Error('Vazio');
      } catch(e) { lastErr = e; }
    }
    throw lastErr || new Error('Todos os proxies falharam');
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  timeoutMs = timeoutMs || 9000;
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs);
  try { var resp = await fetch(url, { signal: ctrl.signal }); clearTimeout(timer); return resp; }
  catch(e) { clearTimeout(timer); throw e; }
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  var t = url.trim();
  return /^https?:\/\//i.test(t) ? t : '#';
}

// ── Ferramentas ──────────────────────────────────────────────────────────────
function loadObrigacoes() {
  var body = document.getElementById('obrig-body');
  if (!body) return;
  var list = [
    { icon:'&#129518;', nome:'Simulador de Simples Nacional' },
    { icon:'&#128202;', nome:'Calculadora de IRPJ/CSLL' },
    { icon:'&#128203;', nome:'Gerador de Guias DAS' },
    { icon:'&#128188;', nome:'Planner Tribut&#225;rio Anual' },
    { icon:'&#128269;', nome:'Informa&#231;&#245;es do CNPJ', link:'infomacoes-cnpj.html' }
  ];
  body.innerHTML = list.map(function(f){
    if (f.link) {
      return '<a href="' + f.link + '" class="obrig-item" style="cursor:pointer;text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color=\'var(--teal)\'" onmouseout="this.style.color=\'var(--mid)\'">'
        + '<span style="display:flex;align-items:center;gap:8px;"><span style="font-size:1rem;">' + f.icon + '</span><span>' + f.nome + '</span></span>'
        + '<span style="font-size:.8rem;color:var(--teal);">&#8594;</span>'
        + '</a>';
    } else {
      return '<div class="obrig-item">'
        + '<span style="display:flex;align-items:center;gap:8px;"><span style="font-size:1rem;">' + f.icon + '</span><span>' + f.nome + '</span></span>'
        + '<span class="obrig-badge" style="background:#f0f9ff;color:#0369a1;opacity:.8;">Em breve</span>'
        + '</div>';
    }
  }).join('');
}

// ── Cotacoes ─────────────────────────────────────────────────────────────────
async function loadCotacoes() {
  var body = document.getElementById('cot-body');
  var updateEl = document.getElementById('cot-update');
  if (!body || !updateEl) return;
  try {
    var resp = await fetchWithTimeout('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,CHF-BRL,GBP-BRL');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    var moedas = [
      { key:'USDBRL', nome:'D&#243;lar Comercial' },
      { key:'EURBRL', nome:'Euro' },
      { key:'CHFBRL', nome:'Franco Su&#237;&#231;o' },
      { key:'GBPBRL', nome:'Libra Esterlina' }
    ];
    var rows = moedas.map(function(m){
      var d = data[m.key]; if (!d) return '';
      var buy  = isNaN(parseFloat(d.bid)) ? '&#8212;' : parseFloat(d.bid).toFixed(2);
      var sell = isNaN(parseFloat(d.ask)) ? '&#8212;' : parseFloat(d.ask).toFixed(2);
      var pct  = parseFloat(d.pctChange) || 0;
      var z = Math.abs(pct) < 0.005, up = pct > 0;
      var arrow = z ? '&#9473;' : up ? '&#9650;' : '&#9660;';
      var cls   = z ? 'cot-neutral' : up ? 'cot-up' : 'cot-dn';
      var ps    = z ? '0,00%' : (up?'+':'') + pct.toFixed(2).replace('.',',') + '%';
      return '<div class="cot-item"><div class="cot-name">' + m.nome
        + ' <span class="' + cls + '">' + arrow + ' ' + ps + '</span>'
        + ' <span class="live-dot"></span></div>'
        + '<div class="cot-vals">'
        + '<span class="cot-val">Compra <strong>R$ ' + esc(buy) + '</strong></span>'
        + '<span class="cot-val">Venda <strong>R$ ' + esc(sell) + '</strong></span>'
        + '</div></div>';
    }).join('');
    body.innerHTML = rows || '<div class="api-error">Dados n&#227;o dispon&#237;veis.</div>';
    var now = new Date();
    updateEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  } catch(e) {
    console.warn('[Cota&#231;&#245;es]', e.message);
    body.innerHTML = '<div class="api-error">&#9888; Cota&#231;&#245;es indispon&#237;veis no momento.</div>';
    updateEl.textContent = 'erro';
  }
}

// ── Noticias ─────────────────────────────────────────────────────────────────
var NEWS_ICONS = {
  Trabalhista:   '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(13,122,117,.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
  Tributario:    '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(13,122,117,.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>',
  Bancario:      '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(13,122,117,.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>',
  Economia:      '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(13,122,117,.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
  Contabilidade: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(13,122,117,.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M13 3h8m0 0v8m0-8l-11 11"/></svg>'
};

function categorizeNews(t, c) {
  var s = (t + ' ' + c).toLowerCase();
  if (/(trabalhist|esocial|fgts|inss|folha|clt|rescis|admiss)/.test(s)) return 'Trabalhista';
  if (/(tribut|imposto|irpf|irpj|sped|fiscal|receita|simples|icms|iss|cofins|pis|csll)/.test(s)) return 'Tributario';
  if (/(banco|feriado|pix|cr.dito|financ|empr.stimo)/.test(s)) return 'Bancario';
  if (/(economia|ipca|infla|pib|mercado|juros|selic|c.mbio|d.lar|euro)/.test(s)) return 'Economia';
  return 'Contabilidade';
}

function formatNewsDate(ds) {
  if (!ds) return '';
  try { var d = new Date(ds); if (isNaN(d)) return ''; return String(d.getDate()).padStart(2,'0') + ' ' + MESES_ABREV[d.getMonth()]; } catch(e) { return ''; }
}

function getRSSItemLink(item) {
  var el = item.querySelector('link');
  if (el && el.textContent && el.textContent.trim()) return safeUrl(el.textContent.trim());
  for (var i = 0; i < item.childNodes.length; i++) {
    var node = item.childNodes[i];
    if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === 'link') {
      var next = node.nextSibling;
      if (next && next.nodeType === 3 && next.textContent && next.textContent.trim()) return safeUrl(next.textContent.trim());
    }
  }
  var al = item.querySelector('[href]');
  return al ? safeUrl(al.getAttribute('href')) : '#';
}

function fallbackNews() {
  var now = new Date();
  var ds = String(now.getDate()).padStart(2,'0') + ' ' + MESES_ABREV[now.getMonth()];
  var items = [
    { cat:'Tribut&#225;rio', icon:NEWS_ICONS.Tributario, date:ds, title:'Agenda tribut&#225;ria do m&#234;s dispon&#237;vel', desc:'Confira os vencimentos de obriga&#231;&#245;es na se&#231;&#227;o de Agenda abaixo.', link:'https://www.contabeis.com.br/noticias/', cta:'Ver agenda &#8594;' },
    { cat:'Economia', icon:NEWS_ICONS.Economia, date:'', title:'Cota&#231;&#245;es atualizadas em tempo real', desc:'D&#243;lar, Euro e outras moedas com atualiza&#231;&#227;o autom&#225;tica a cada 5 minutos.', link:'https://www.contabeis.com.br/noticias/', cta:'Ver cota&#231;&#245;es &#8594;' },
    { cat:'Trabalhista', icon:NEWS_ICONS.Trabalhista, date:'', title:'eSocial: fique em dia com suas obriga&#231;&#245;es', desc:'Nossa equipe mant&#233;m tudo em conformidade com as exig&#234;ncias previdenci&#225;rias.', link:'https://www.contabeis.com.br/noticias/', cta:'Saiba mais &#8594;' },
    { cat:'Contabilidade', icon:NEWS_ICONS.Contabilidade, date:'', title:'Fale com nossa equipe especializada', desc:'Escla&#241;e&#231;a d&#250;vidas sobre obriga&#231;&#245;es fiscais, societ&#225;rias e trabalhistas.', link:'tel:1636337995', cta:'Ligar: (16) 3633-7995 &#8594;' }
  ];
  return items.map(function(i){
    return '<a href="' + i.link + '" ' + (i.link.indexOf('http')===0?'target="_blank" rel="noopener noreferrer" data-modal="1" data-news-title="'+esc(i.title)+'"':'') + ' class="news-card" style="display:block;">'
      + '<div class="news-img">' + i.icon + (i.date?'<div class="news-date">'+i.date+'</div>':'') + '</div>'
      + '<div class="news-body"><div class="news-cat">' + i.cat + '</div><h4>' + i.title + '</h4><p>' + i.desc + '</p><div class="news-leia">' + i.cta + '</div></div>'
      + '</a>';
  }).join('');
}

function parseRSS(contents) {
  if (!contents) throw new Error('vazio');
  var doc = (new DOMParser()).parseFromString(contents, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('xml invalido');
  var items = Array.from(doc.querySelectorAll('item')).slice(0, 4);
  if (!items.length) throw new Error('sem itens');
  return items.map(function(item){
    var rawT = item.querySelector('title') ? (item.querySelector('title').textContent || '').trim() : 'Sem t&#237;tulo';
    var title = esc(rawT);
    var link = getRSSItemLink(item);
    var rawD = item.querySelector('description') ? (item.querySelector('description').textContent || '') : '';
    var clean = rawD.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').replace(/Leia mais em https?:\/\/\S+/gi,'').trim();
    var desc = esc(clean.substring(0,120) + (clean.length>120?'\u2026':''));
    var pd = item.querySelector('pubDate') ? (item.querySelector('pubDate').textContent||'') : '';
    var catTxt = Array.from(item.querySelectorAll('category')).map(function(c){return c.textContent.trim();}).join(' ');
    var cat = catTxt || categorizeNews(rawT, '');
    var dl = esc(formatNewsDate(pd));
    var mel = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/','content')[0];
    var imgUrl = safeUrl(mel ? (mel.getAttribute('url')||'') : '');
    var icon = NEWS_ICONS[cat] || NEWS_ICONS.Contabilidade;
    var imgH = imgUrl !== '#' ? '<img src="'+imgUrl+'" alt="'+title+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">' : icon;
    return '<a href="' + link + '" target="_blank" rel="noopener noreferrer" class="news-card" data-modal="1" data-news-title="' + title + '" style="display:block;">'
      + '<div class="news-img" style="' + (imgUrl!=='#'?'padding:0;overflow:hidden;':'') + '">' + imgH + (dl?'<div class="news-date">'+dl+'</div>':'') + '</div>'
      + '<div class="news-body"><div class="news-cat">' + esc(cat) + '</div><h4>' + title + '</h4><p>' + desc + '</p><div class="news-leia">Leia mais &#8594;</div></div>'
      + '</a>';
  }).join('');
}

// Tenta carregar noticias com cache e retry automatico
var _newsLoaded = false;
async function loadNews() {
  if (_newsLoaded) return;
  var grid = document.getElementById('news-grid');
  if (!grid) return;
  var RSS = 'https://www.contabeis.com.br/rss/conteudo/';
  
  // 1. Tenta ler do cache primeiro (valido por 2 horas)
  try {
    var cached = localStorage.getItem('mensure_news_cache');
    var cacheTime = localStorage.getItem('mensure_news_time');
    if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 7200000) {
      grid.innerHTML = parseRSS(cached);
      _newsLoaded = true;
      return;
    }
  } catch(e) {}

  // 2. Tenta os proxies em paralelo (muito mais rápido, não trava a tela)
  try {
    var contents = await fetchViaProxy(RSS, 8000);
    var html = parseRSS(contents);
    grid.innerHTML = html;
    _newsLoaded = true;
    try {
      localStorage.setItem('mensure_news_cache', contents);
      localStorage.setItem('mensure_news_time', Date.now().toString());
    } catch(e) {}
    return;
  } catch(e) {
    console.warn('[News] falhou (proxies bloqueados ou lentos):', e.message);
  }
  
  // 3. Se falhou tudo, tenta usar o cache antigo (mesmo expirado)
  try {
    var oldCache = localStorage.getItem('mensure_news_cache');
    if (oldCache) {
      grid.innerHTML = parseRSS(oldCache);
      return;
    }
  } catch(e) {}
  
  // 4. Se não tem nada e proxies falharam, mostra fallback estático instantaneamente
  grid.innerHTML = fallbackNews();
}

// ── FIX 4: "Saiba mais" scroll + pre-seleciona assunto ───────────────────────
function initSvcLinks() {
  document.querySelectorAll('.svc-link[data-assunto]').forEach(function(link){
    link.addEventListener('click', function(){
      var assunto = this.dataset.assunto;
      setTimeout(function(){
        var sel = document.getElementById('f-assunto');
        if (sel && assunto) {
          Array.from(sel.options).forEach(function(o){ if (o.value === assunto) sel.value = o.value; });
        }
        var nomeEl = document.getElementById('f-nome');
        if (nomeEl) nomeEl.focus();
      }, 500);
    });
  });
}

// ── FIX 5: Formulario via mailto ─────────────────────────────────────────────
function initForm() {
  var btn = document.getElementById('form-submit-btn');
  if (!btn) return;
  btn.addEventListener('click', function(){
    var nome    = (document.getElementById('f-nome')    ||{value:''}).value.trim();
    var empresa = (document.getElementById('f-empresa') ||{value:''}).value.trim();
    var tel     = (document.getElementById('f-tel')     ||{value:''}).value.trim();
    var email   = (document.getElementById('f-email')   ||{value:''}).value.trim();
    var assunto = (document.getElementById('f-assunto') ||{value:''}).value;
    var msg     = (document.getElementById('f-msg')     ||{value:''}).value.trim();

    if (!nome) { showFErr(btn,'&#9888; Informe seu nome'); document.getElementById('f-nome').focus(); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFErr(btn,'&#9888; E-mail inv&#225;lido'); document.getElementById('f-email').focus(); return; }

    var linhas = ['Nome: '+nome];
    if (empresa) linhas.push('Empresa: '+empresa);
    if (tel)     linhas.push('Telefone: '+tel);
    linhas.push('E-mail: '+email);
    if (assunto) linhas.push('Assunto: '+assunto);
    if (msg)     linhas.push('\nMensagem:\n'+msg);

    var subject = 'Contato pelo site' + (assunto?' \u2013 '+assunto:'');
    window.location.href = 'mailto:Mensure@mensure.com.br'
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(linhas.join('\n'));

    btn.textContent = '\u2713 Abrindo seu e-mail\u2026';
    btn.style.background = '#16a34a';
    btn.disabled = true;
    setTimeout(function(){ btn.textContent='Enviar mensagem'; btn.style.background=''; btn.disabled=false; }, 4000);
  });
}

// ── Banner de cookies (LGPD) ─────────────────────────────────────────────────
function initCookieBanner() {
  var banner = document.getElementById('cookie-banner');
  if (!banner) return;

  var CHAVE = 'mensure_cookie_consent';
  var jaEscolheu;
  try { jaEscolheu = localStorage.getItem(CHAVE); } catch(e) { jaEscolheu = null; }

  if (!jaEscolheu) {
    setTimeout(function(){ banner.classList.add('active'); }, 600);
  }

  function fechar(valor) {
    try { localStorage.setItem(CHAVE, valor); } catch(e) {}
    banner.classList.remove('active');
  }

  var btnAceitar    = document.getElementById('cookie-accept-btn');
  var btnEssenciais = document.getElementById('cookie-essential-btn');
  if (btnAceitar)    btnAceitar.addEventListener('click', function(){ fechar('aceitou-todos'); });
  if (btnEssenciais) btnEssenciais.addEventListener('click', function(){ fechar('somente-essenciais'); });
}

// ── Modal de noticias: abre a materia por cima do site, fundo borrado ───────
function openNewsModal(url, title) {
  var overlay = document.getElementById('news-modal');
  var iframe  = document.getElementById('news-modal-iframe');
  var extLink = document.getElementById('news-modal-external');
  var titleEl = document.getElementById('news-modal-title');
  if (!overlay || !iframe || !extLink) return;
  iframe.src = url;
  extLink.href = url;
  titleEl.textContent = title || 'Not\u00edcia';
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeNewsModal() {
  var overlay = document.getElementById('news-modal');
  var iframe  = document.getElementById('news-modal-iframe');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  // libera a pagina carregada no iframe um pouco depois da transicao fechar
  setTimeout(function(){ if (iframe) iframe.src = 'about:blank'; }, 300);
}

function initNewsModal() {
  var overlay  = document.getElementById('news-modal');
  var closeBtn = document.getElementById('news-modal-close');
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', closeNewsModal);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) closeNewsModal(); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && overlay.classList.contains('active')) closeNewsModal();
  });

  // Delegado: qualquer card de noticia com data-modal abre por cima do site
  document.addEventListener('click', function(e){
    var link = e.target.closest('a.news-card[data-modal]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // deixa o usuario abrir em nova aba se quiser
    e.preventDefault();
    openNewsModal(link.getAttribute('href'), link.dataset.newsTitle);
  });
}

function showFErr(btn, msg) {
  var orig = btn.textContent;
  btn.textContent = msg; btn.style.background = '#c73d14';
  setTimeout(function(){ btn.textContent=orig; btn.style.background=''; }, 2500);
}

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  loadObrigacoes();
  loadCotacoes();
  loadNews();
  initForm();
  initSvcLinks();
  initNewsModal();
  initCookieBanner();
  setInterval(loadCotacoes, 5  * 60 * 1000);
  setInterval(loadNews,     30 * 60 * 1000);
});
// Gatilho secundario: se as noticias ainda nao carregaram quando a pagina
// terminar de carregar completamente (window.load), tenta de novo.
window.addEventListener('load', function(){
  if (!_newsLoaded) loadNews();
});

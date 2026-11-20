/* Blog Mensure: menu móvel, busca, filtro por área, "ver mais" e navegação entre artigos.
   Os links e os textos dos artigos já estão no HTML; este arquivo só melhora a experiência. */
(function () {
  var btn = document.querySelector('.nav-mobile-btn'), links = document.querySelector('.nav-links');
  if (btn && links) btn.addEventListener('click', function () {
    var on = btn.classList.toggle('active'); links.classList.toggle('active', on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  });

  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  var lista = document.getElementById('blog-lista');
  if (lista) {
    var POR_PAGINA = 9, cards = [].slice.call(lista.querySelectorAll('.js-card'));
    var busca = document.getElementById('busca'), filtroEl = document.getElementById('filtro-ativo');
    var vazio = document.getElementById('sem-resultado'), breve = document.getElementById('mais-em-breve');
    var mais = document.getElementById('ver-mais'), secDest = document.getElementById('destaque');
    var catBtns = [].slice.call(document.querySelectorAll('.cat-btn')), cat = '', visiveis = POR_PAGINA;
    var nomes = {}; catBtns.forEach(function (b) { nomes[b.dataset.cat] = b.querySelector('.cat-nome').textContent; });
    /* O artigo em destaque também precisa aparecer na lista quando há busca ou filtro: usamos uma cópia dele. */
    var destCards = secDest ? [].slice.call(secDest.querySelectorAll('.js-card')) : [];
    var copias = destCards.map(function (c) {
      var k = c.cloneNode(true); k.classList.remove('card-grande'); k.hidden = true; k.dataset.copia = '1';
      lista.appendChild(k); cards.push(k); return k;
    });

    function aplicar() {
      var q = norm(busca.value), ativo = !!(q || cat), achou = 0, naLista = 0, escondidosPorPagina = 0;
      cards.forEach(function (c) {
        var ok = (!cat || c.dataset.cat === cat) && (!q || q.split(' ').every(function (t) { return c.dataset.busca.indexOf(t) > -1; }));
        var ocultar = !ok;
        if (c.dataset.copia) { ocultar = !(ativo && ok); }
        else if (ok) { naLista++; if (!ativo && naLista > visiveis) { ocultar = true; escondidosPorPagina++; } }
        if (ok && (ativo || !c.dataset.copia)) achou++;
        c.hidden = ocultar;
      });
      if (secDest) secDest.hidden = ativo || !destCards.length;
      vazio.hidden = !(ativo && achou === 0);
      breve.hidden = ativo;
      mais.hidden = escondidosPorPagina === 0;
      filtroEl.hidden = !ativo;
      if (ativo) {
        filtroEl.innerHTML = '';
        filtroEl.appendChild(document.createTextNode(achou + (achou === 1 ? ' artigo encontrado' : ' artigos encontrados') + (cat ? ' em “' + nomes[cat] + '”' : '') + '.'));
        var x = document.createElement('button'); x.type = 'button'; x.textContent = 'Limpar filtros';
        x.addEventListener('click', function () { busca.value = ''; cat = ''; visiveis = POR_PAGINA; marcar(); aplicar(); });
        filtroEl.appendChild(x);
      }
    }
    function marcar() { catBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.cat === cat ? 'true' : 'false'); }); }
    busca.addEventListener('input', aplicar);
    catBtns.forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        cat = (cat === b.dataset.cat) ? '' : b.dataset.cat; marcar(); aplicar();
        if (cat) document.getElementById('artigos').scrollIntoView({ behavior: 'smooth' });
      });
    });
    mais.addEventListener('click', function () { visiveis += POR_PAGINA; aplicar(); });
    aplicar();
  }

  var nav = document.getElementById('post-nav');
  if (nav) {
    var atual = decodeURIComponent(location.pathname.split('/Blog/').pop() || '').replace(/index\.html$/, '');
    fetch('../posts.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      var l = d.posts, i = l.findIndex(function (p) { return p.url === atual; });
      if (i < 0) return;
      function a(p, t) { var e = document.createElement('a'); e.href = '../' + p.url; e.textContent = t; return e; }
      nav.appendChild(l[i + 1] ? a(l[i + 1], '← ' + l[i + 1].titulo) : document.createElement('span'));
      if (l[i - 1]) nav.appendChild(a(l[i - 1], l[i - 1].titulo + ' →'));
    }).catch(function () {});
  }
})();

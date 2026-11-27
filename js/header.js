/* Cabeçalho compartilhado: menu móvel, submenus (clique/teclado) e marcação da página atual. */
(function () {
  'use strict';
  var header = document.querySelector('.site-header');
  if (!header) return;
  /* Destino do link "Ir para o conteúdo": <main>, ou o primeiro título */
  var alvo = document.getElementById('conteudo') || document.querySelector('main') || document.querySelector('h1');
  if (alvo) { if (!alvo.id) alvo.id = 'conteudo'; if (alvo.id !== 'conteudo') { var sk = header.querySelector('.sh-skip'); if (sk) sk.setAttribute('href', '#' + alvo.id); } alvo.setAttribute('tabindex', '-1'); }
  var burger = header.querySelector('.sh-burger');
  var nav = header.querySelector('.sh-nav');
  var subs = [].slice.call(header.querySelectorAll('.sh-has-sub'));

  function fechaSubs(exceto) {
    subs.forEach(function (li) {
      if (li === exceto) return;
      li.classList.remove('is-open');
      var b = li.querySelector('.sh-sub-btn'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function fechaMenu() {
    if (!burger) return;
    burger.classList.remove('is-open'); nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menu');
    fechaSubs();
  }

  if (burger) burger.addEventListener('click', function () {
    var on = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', on); burger.classList.toggle('is-open', on);
    burger.setAttribute('aria-expanded', on ? 'true' : 'false');
    burger.setAttribute('aria-label', on ? 'Fechar menu' : 'Abrir menu');
    if (!on) fechaSubs();
  });

  subs.forEach(function (li) {
    var b = li.querySelector('.sh-sub-btn'); if (!b) return;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var abre = !li.classList.contains('is-open');
      fechaSubs(li); li.classList.toggle('is-open', abre); b.setAttribute('aria-expanded', abre ? 'true' : 'false');
    });
  });

  /* Clicar em um link fecha tudo (links com # na mesma página incluídos) */
  nav.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (a) fechaMenu();
  });
  document.addEventListener('click', function (e) { if (!header.contains(e.target)) { fechaSubs(); if (window.innerWidth <= 980) fechaMenu(); } });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var aberto = header.querySelector('.sh-has-sub.is-open .sh-sub-btn'); fechaMenu(); fechaSubs(); if (aberto) aberto.focus(); }
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 980) fechaMenu(); });

  /* Página atual: marca o link correspondente (aria-current) */
  var path = location.pathname.replace(/index\.html$/, '');
  if (path.charAt(path.length - 1) !== '/' && path.indexOf('.') === -1) path += '/';
  var ehArtigo = !!document.querySelector('meta[property="og:type"][content="article"]');
  var secao = '';
  if (/^\/servicos\//i.test(path)) secao = 'servicos';
  else if (/^\/blog\//i.test(path) || ehArtigo) secao = 'blog';
  [].slice.call(header.querySelectorAll('a[href]')).forEach(function (a) {
    var h = a.getAttribute('href');
    if (h.charAt(0) !== '/' || h.indexOf('#') !== -1) return;
    if (h === path || h.toLowerCase() === path.toLowerCase()) a.setAttribute('aria-current', 'page');
  });
  /* No blog, o link "Blog" fica marcado também nos artigos; o submenu mostra a página exata */
  if (secao) {
    var alvo = secao === 'blog' ? '/blog/' : '/servicos/';
    var li = header.querySelector('.sh-has-sub > a[href="' + (secao === 'blog' ? '/blog/' : '/#servicos') + '"]');
    if (li && !li.hasAttribute('aria-current')) li.setAttribute('aria-current', 'page');
  }
})();

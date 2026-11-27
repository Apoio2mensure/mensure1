#!/usr/bin/env python3
"""Atualiza o Blog a partir dos artigos publicados na pasta Blog.

Uso:  python gerar-indice.py      (ou dois cliques em atualizar-blog.bat)

O que faz
- Encontra os artigos: cada artigo é uma pasta na RAIZ do site (ex.: equiparacao-hospitalar/index.html,
  endereço portal.mensure.com.br/equiparacao-hospitalar/) cujo HTML tenha og:type "article".
  Pastas que começam com "_" ou "." e as pastas do sistema (Blog, css, js, fotos...) são ignoradas.
- Lê os dados de cada artigo (veja _modelo-post.html para os metadados).
- Grava blog/posts.json (usado pela navegação anterior/próximo dos artigos).
- Escreve os cartões, categorias e dados estruturados DIRETO no HTML de blog/index.html
  (entre os marcadores <!-- BLOG:... -->), para que o Google leia os links sem JavaScript.
- Atualiza o sitemap.xml com o Blog e os artigos indexáveis (os com "noindex" ficam de fora).

Categorias: edite blog/categorias.json.
"""
import html, json, re, sys, unicodedata
from datetime import datetime
from math import ceil
from pathlib import Path
from urllib.parse import quote

BLOG = Path(__file__).resolve().parent
SITE = BLOG.parent
BASE = "https://portal.mensure.com.br"
# Pastas da raiz que NÃO são artigos
IGNORAR = {"blog", "css", "js", "fotos", "RECIBOSAUDE", "simulador-das", "servicos", "sobre", "temp", "_includes"}
POR_PAGINA = 9


def esc(s):
    return html.escape(str(s), quote=True)


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def meta(src, *names):
    for n in names:
        for pat in (
            r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']*)["\']' % re.escape(n),
            r'<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']%s["\']' % re.escape(n),
        ):
            m = re.search(pat, src, re.I)
            if m and m.group(1).strip():
                return html.unescape(m.group(1).strip())
    return ""


def texto(frag):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", frag))).strip()


def data_iso(v, fallback):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", v or "")
    if m:
        return "%s-%s-%s" % m.groups()
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", v or "")
    return "%s-%s-%s" % (m.group(3), m.group(2), m.group(1)) if m else fallback


def br(d):
    return "%s/%s/%s" % (d[8:10], d[5:7], d[0:4])


def ler_post(f):
    rel = f.relative_to(SITE).as_posix()
    src = f.read_text(encoding="utf-8", errors="replace")
    titulo = meta(src, "og:title")
    if not titulo:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", src, re.I | re.S) or re.search(r"<title[^>]*>(.*?)</title>", src, re.I | re.S)
        titulo = texto(m.group(1)) if m else f.stem.replace("-", " ").title()
    resumo = meta(src, "description", "og:description")
    if not resumo:
        m = re.search(r"<p[^>]*>(.*?)</p>", src, re.I | re.S)
        resumo = texto(m.group(1)) if m else ""
    if len(resumo) > 240:
        resumo = resumo[:237].rsplit(" ", 1)[0] + "…"
    mt = re.search(r'<time[^>]+datetime=["\']([^"\']+)', src, re.I)
    hoje = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d")
    publicado = data_iso(meta(src, "article:published_time", "date") or (mt.group(1) if mt else ""), hoje)
    atualizado = data_iso(meta(src, "article:modified_time"), publicado)
    corpo = re.search(r"<main.*?</main>", src, re.I | re.S)
    corpo = corpo.group(0) if corpo else src
    corpo = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", corpo, flags=re.I | re.S)
    palavras = len(texto(corpo).split())
    url = re.sub(r"index\.html$", "", rel)
    return {
        "arquivo": rel,
        "url": url,
        "titulo": titulo,
        "resumo": resumo,
        "data": publicado,
        "atualizado": atualizado,
        "categoria": meta(src, "article:section"),
        "palavras_chave": meta(src, "keywords"),
        "imagem": meta(src, "og:image"),
        "destaque": meta(src, "blog:destaque").lower() in ("1", "true", "sim"),
        "noindex": "noindex" in meta(src, "robots").lower(),
        "leitura": max(1, ceil(palavras / 200)),
    }


def thumb(p, cats):
    if re.match(r"https?://", p["imagem"] or "") and "favicon" not in p["imagem"] and "og-mensure" not in p["imagem"]:
        return '<img src="%s" alt="" width="640" height="360" loading="lazy" decoding="async">' % esc(p["imagem"])
    nome = cats.get(slug(p["categoria"]), {}).get("nome", p["categoria"]) or "Blog Mensure"
    return ('<span class="thumb-ph" aria-hidden="true"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" '
            'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>'
            '<span>%s</span></span>' % esc(nome))


def cartao(p, cats, grande=False):
    cslug = slug(p["categoria"])
    cnome = cats.get(cslug, {}).get("nome", p["categoria"])
    busca = slug(" ".join([p["titulo"], p["resumo"], cnome, p["palavras_chave"]])).replace("-", " ")
    href = "/" + quote(p["url"])
    return (
        '<article class="card js-card%s" data-cat="%s" data-busca="%s">\n'
        '  <a class="card-thumb" href="%s" tabindex="-1" aria-hidden="true">%s</a>\n'
        '  <div class="card-body">\n'
        '    %s\n'
        '    <h%d class="card-title"><a href="%s">%s</a></h%d>\n'
        '    <p class="card-resumo">%s</p>\n'
        '    <p class="card-meta"><time datetime="%s">Atualizado em %s</time> · %d min de leitura</p>\n'
        '    <a class="card-link" href="%s">Ler artigo<span class="sr-only">: %s</span> &rarr;</a>\n'
        '  </div>\n</article>'
    ) % (" card-grande" if grande else "", esc(cslug), esc(busca), href, thumb(p, cats),
         ('<p class="card-cat">%s</p>' % esc(cnome)) if cnome else "",
         3, href, esc(p["titulo"]), 3, esc(p["resumo"]),
         esc(p["atualizado"]), br(p["atualizado"]), p["leitura"], href, esc(p["titulo"]))


def trocar(s, nome, conteudo):
    ini, fim = "<!-- BLOG:%s -->" % nome, "<!-- /BLOG:%s -->" % nome
    if ini not in s or fim not in s:
        print("aviso: marcador %s não encontrado em index.html" % nome)
        return s
    return re.sub(re.escape(ini) + r".*?" + re.escape(fim), lambda _: ini + "\n" + conteudo + "\n" + fim, s, flags=re.S)


def main():
    cats_lista = json.loads((BLOG / "categorias.json").read_text(encoding="utf-8"))
    cats = {c["slug"]: c for c in cats_lista}
    posts = []
    for pasta in sorted(SITE.iterdir()):
        if not pasta.is_dir() or pasta.name in IGNORAR or pasta.name[0] in "._":
            continue
        f = pasta / "index.html"
        if f.exists() and re.search(r'property=["\']og:type["\'][^>]*content=["\']article', f.read_text(encoding="utf-8", errors="replace")):
            posts.append(ler_post(f))
    posts.sort(key=lambda p: (p["data"], p["arquivo"]), reverse=True)
    for p in posts:  # categoria nova, fora do categorias.json, também aparece nos filtros
        sl = slug(p["categoria"])
        if sl and sl not in cats:
            cats[sl] = {"slug": sl, "nome": p["categoria"], "descricao": ""}
            cats_lista.append(cats[sl])

    (BLOG / "posts.json").write_text(
        json.dumps({"atualizado": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "posts": [{k: p[k] for k in ("arquivo", "url", "titulo", "resumo", "data", "categoria")} for p in posts]},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("posts.json atualizado: %d artigo(s)" % len(posts))

    idx = BLOG / "index.html"
    s = idx.read_text(encoding="utf-8")
    dest = next((p for p in posts if p["destaque"]), None)
    resto = [p for p in posts if p is not dest]

    s = trocar(s, "DESTAQUE", cartao(dest, cats, True) if dest else "")
    s = trocar(s, "LISTA", "\n".join(cartao(p, cats) for p in resto))
    cont = {}
    for p in posts:
        cont[slug(p["categoria"])] = cont.get(slug(p["categoria"]), 0) + 1
    s = trocar(s, "CATEGORIAS", "\n".join(
        '<li><button type="button" class="cat-btn" data-cat="%s"><span class="cat-nome">%s</span>'
        '<span class="cat-desc">%s</span><span class="cat-qtd">%s</span></button></li>' % (
            esc(c["slug"]), esc(c["nome"]), esc(c.get("descricao", "")),
            ("%d artigo%s" % (cont[c["slug"]], "" if cont[c["slug"]] == 1 else "s")) if cont.get(c["slug"]) else "Em breve")
        for c in cats_lista))

    indexaveis = [p for p in posts if not p["noindex"]]
    org = json.loads((BLOG / "organizacao.json").read_text(encoding="utf-8"))
    blog = {"@type": "Blog", "@id": BASE + "/blog/#blog", "name": "Blog Mensure", "url": BASE + "/blog/",
            "inLanguage": "pt-BR", "publisher": {"@id": BASE + "/#organization"}}
    if indexaveis:
        blog["blogPost"] = [{"@type": "BlogPosting", "headline": p["titulo"], "url": BASE + "/" + quote(p["url"]),
                             "@id": BASE + "/" + quote(p["url"]) + "#article", "datePublished": p["data"], "dateModified": p["atualizado"]} for p in indexaveis]
    faq = json.loads((BLOG / "faq.json").read_text(encoding="utf-8")) if (BLOG / "faq.json").exists() else []
    faq_ld = [{"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": x["q"], "acceptedAnswer": {"@type": "Answer", "text": x["a"]}} for x in faq]}] if faq else []
    faq_html = ('<section class="faq-mini" id="faq" aria-labelledby="faq-t"><div class="faq-mini-in">\n<h2 id="faq-t">Perguntas frequentes</h2>\n'
                + "\n".join('<details><summary>%s</summary><p>%s</p></details>' % (esc(x["q"]), esc(x["a"])) for x in faq)
                + '\n</div></section>') if faq else ""
    site = {"@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/", "name": "Mensure Assessoria Cont\u00e1bil",
            "inLanguage": "pt-BR", "publisher": {"@id": BASE + "/#organization"}}
    pagina = {"@type": "CollectionPage", "@id": BASE + "/blog/#webpage", "url": BASE + "/blog/", "name": "Blog Mensure", "inLanguage": "pt-BR",
              "isPartOf": {"@id": BASE + "/#website"}, "about": {"@id": BASE + "/#organization"}, "mainEntity": {"@id": BASE + "/blog/#blog"},
              "breadcrumb": {"@id": BASE + "/blog/#breadcrumb"},
              "primaryImageOfPage": {"@type": "ImageObject", "url": BASE + "/fotos/og-mensure.jpg", "width": 1200, "height": 630}}
    migalhas = {"@type": "BreadcrumbList", "@id": BASE + "/blog/#breadcrumb", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "In\u00edcio", "item": BASE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": BASE + "/blog/"}]}
    ld = {"@context": "https://schema.org", "@graph": [
        site, org, {"@type": "WebSite", "@id": BASE + "/blog/#website", "url": BASE + "/blog/", "name": "Blog Mensure",
         "inLanguage": "pt-BR", "publisher": {"@id": BASE + "/#organization"}}, pagina, migalhas, blog] + faq_ld}
    s = trocar(s, "JSONLD", '<script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False, indent=2) + "\n</script>")
    s = trocar(s, "FAQ", faq_html)
    idx.write_text(s, encoding="utf-8")
    print("index.html do Blog atualizado")

    # Páginas internas do Blog: /blog/artigos/ (todos os artigos) e /blog/areas-de-interesse/ (artigos por assunto)
    art = BLOG / "artigos" / "index.html"
    if art.exists():
        a = art.read_text(encoding="utf-8")
        a = trocar(a, "ARTIGOS", "\n".join(cartao(p, cats) for p in posts) or '<p class="b-vazio">Os artigos ser\u00e3o publicados aqui em breve.</p>')
        art.write_text(a, encoding="utf-8")
        print("Blog/artigos atualizado")
    are = BLOG / "areas-de-interesse" / "index.html"
    if are.exists():
        grupos = {}  # categorias com o mesmo nome viram um s\u00f3 cart\u00e3o
        for c in cats_lista:
            g = grupos.setdefault(slug(c["nome"]), {"nome": c["nome"], "descricao": c.get("descricao", ""), "slugs": set(), "posts": []})
            g["slugs"].add(c["slug"])
            if not g["descricao"]:
                g["descricao"] = c.get("descricao", "")
        for p in posts:
            for g in grupos.values():
                if slug(p["categoria"]) in g["slugs"]:
                    g["posts"].append(p)
                    break
        blocos = []
        for g in grupos.values():
            lista = ("<ul>" + "".join('<li><a href="/%s">%s</a></li>' % (quote(p["url"]), esc(p["titulo"])) for p in g["posts"]) + "</ul>") if g["posts"] else '<p class="area-soon">Em breve</p>'
            blocos.append('<article class="area-card" id="%s"><h3>%s</h3>%s%s</article>' % (
                esc(sorted(g["slugs"])[0]), esc(g["nome"]), ("<p>%s</p>" % esc(g["descricao"])) if g["descricao"] else "", lista))
        a = are.read_text(encoding="utf-8")
        a = trocar(a, "AREAS", "\n".join(blocos))
        are.write_text(a, encoding="utf-8")
        print("Blog/areas-de-interesse atualizado")

    sm = SITE / "sitemap.xml"
    if sm.exists():
        t = sm.read_text(encoding="utf-8")
        ultimo = max([p["atualizado"] for p in indexaveis] or [""])
        urls = [(BASE + "/blog/", "weekly", "0.7", ultimo)] + [(BASE + "/blog/" + sub + "/", "weekly", "0.6", ultimo) for sub in ("artigos", "areas-de-interesse", "sobre") if (BLOG / sub / "index.html").exists()] + [(BASE + "/" + quote(p["url"]), "monthly", "0.6", p["atualizado"]) for p in indexaveis]
        bloco = "<!-- BLOG-INICIO -->\n" + "".join(
            "  <url>\n    <loc>%s</loc>\n%s    <changefreq>%s</changefreq>\n    <priority>%s</priority>\n  </url>\n" % (esc(u), ("    <lastmod>%s</lastmod>\n" % lm) if lm else "", c, pr)
            for u, c, pr, lm in urls) + "  <!-- BLOG-FIM -->"
        if "<!-- BLOG-INICIO -->" in t:
            t = re.sub(r"<!-- BLOG-INICIO -->.*?<!-- BLOG-FIM -->", lambda _: bloco, t, flags=re.S)
        else:
            t = t.replace("</urlset>", "  " + bloco + "\n</urlset>")
        sm.write_text(t, encoding="utf-8")
        print("sitemap.xml atualizado (%d URL)" % len(urls))

    llms = SITE / "llms-full.txt"
    if llms.exists():
        t = llms.read_text(encoding="utf-8")
        ini, fim = "<!-- BLOG-INICIO -->", "<!-- BLOG-FIM -->"
        linhas = ["## Blog da Mensure", "Artigos informativos sobre impostos, contabilidade e gestão empresarial: " + BASE + "/blog/", ""]
        for p in indexaveis:
            linhas.append("- %s (atualizado em %s): %s %s/%s" % (p["titulo"], br(p["atualizado"]), p["resumo"], BASE, quote(p["url"])))
        bloco = ini + "\n" + "\n".join(linhas) + "\n" + fim
        if ini in t:
            t = re.sub(re.escape(ini) + r".*?" + re.escape(fim), lambda _: bloco, t, flags=re.S)
        else:
            t = t.rstrip("\n") + "\n\n---\n\n" + bloco + "\n"
        llms.write_text(t, encoding="utf-8")
        print("llms-full.txt atualizado")

    llm = SITE / "llms.txt"
    if llm.exists():
        t = llm.read_text(encoding="utf-8")
        ini, fim = "<!-- BLOG-INICIO -->", "<!-- BLOG-FIM -->"
        linhas = ["## Blog", "", "- [Blog da Mensure](%s/blog/): artigos informativos sobre impostos, contabilidade e gest\u00e3o empresarial" % BASE]
        for p in indexaveis:
            linhas.append("- [%s](%s/%s): %s" % (p["titulo"], BASE, quote(p["url"]), p["resumo"]))
        bloco = ini + "\n" + "\n".join(linhas) + "\n" + fim
        if ini in t:
            t = re.sub(re.escape(ini) + r".*?" + re.escape(fim), lambda _: bloco, t, flags=re.S)
        else:
            t = t.rstrip("\n") + "\n\n" + bloco + "\n"
        llm.write_text(t, encoding="utf-8")
        print("llms.txt atualizado")


if __name__ == "__main__":
    sys.exit(main())

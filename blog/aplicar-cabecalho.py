#!/usr/bin/env python3
"""Aplica o cabeçalho compartilhado (temp/_includes/header.html) em todas as páginas do site.

Uso:  python aplicar-cabecalho.py     (também é chamado por atualizar-blog.bat e pelo GitHub Actions)

Como funciona
- O cabeçalho é editado em UM lugar: temp/_includes/header.html (menu, links, textos).
- Em cada página ele fica entre os marcadores <!-- SITE:HEADER --> e <!-- /SITE:HEADER -->.
  Este script reescreve o conteúdo entre os marcadores, então todas as páginas ficam idênticas.
- Na primeira execução em uma página antiga (sem marcadores), ele troca o menu antigo pelo novo
  e inclui css/header.css e js/header.js no <head>.
- Rodapés das páginas novas (serviços, Sobre Nós, páginas do Blog) usam o mesmo mecanismo:
  <!-- SITE:FOOTER --> (temp/_includes/footer.html) e <!-- SITE:FOOTER-BLOG --> (temp/_includes/footer-blog.html).
- Páginas novas: copie blog/_modelo-post.html ou qualquer página existente (já vêm com os marcadores).
- Ignora: temp, RECIBOSAUDE (sistema interno de recibos), _includes, .github, backups e 404.html.
"""
import re, sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
INCL = SITE / "temp" / "_includes"      # fica em temp/ (não vai para o GitHub)
if not (INCL / "header.html").exists():
    print("temp/_includes não encontrada (normal no GitHub Actions): nada a aplicar.")
    sys.exit(0)
HEADER = (INCL / "header.html").read_text(encoding="utf-8").strip("\r\n")
INI, FIM = "<!-- SITE:HEADER -->", "<!-- /SITE:HEADER -->"
IGNORAR_DIRS = {"temp", "RECIBOSAUDE", "_includes", ".github", ".git", "node_modules"}
IGNORAR_ARQ = {"404.html"}
CSS = '<link rel="stylesheet" href="/css/header.css">'
JS = '<script src="/js/header.js" defer></script>'
JS_AN = '<script src="/js/analytics.js" defer></script>'

RE_PARTE = re.compile(r"<!-- SITE:([A-Z-]+) -->.*?<!-- /SITE:\1 -->", re.S)
RE_SIM = re.compile(r'<!--[^>]*HEADER[^>]*-->\s*<header class="sim-header".*?</header>\s*(?:<script>\s*// Menu mobile do header.*?</script>)?', re.S)
RE_NAV = re.compile(r'(?:<!--\s*NAV\s*-->\s*)?<nav\b[^>]*>.*?</nav>', re.S)


def paginas():
    for f in sorted(SITE.rglob("*.html")):
        rel = f.relative_to(SITE).parts
        if any(p in IGNORAR_DIRS or p.startswith("_backup") for p in rel[:-1]) or f.name in IGNORAR_ARQ:
            continue
        yield f


def aplicar(f):
    raw = f.read_bytes().decode("utf-8")
    crlf = "\r\n" in raw
    s = raw.replace("\r\n", "\n")
    if "<body" not in s or 'http-equiv="refresh"' in s:
        return "ignorada (redirecionamento)"
    bloco = "%s\n%s\n%s" % (INI, HEADER, FIM)
    if INI in s and FIM in s:
        s = re.sub(re.escape(INI) + r".*?" + re.escape(FIM), lambda _: bloco, s, flags=re.S)
        acao = "atualizada"
    else:
        corpo_ini = s.index("<body")
        pre, pos = s[:corpo_ini], s[corpo_ini:]
        if 'class="sim-header"' in pos:
            pos, n = RE_SIM.subn(lambda _: bloco + "\n", pos, count=1)
        else:
            pos, n = RE_NAV.subn(lambda _: bloco, pos, count=1)
        if not n:
            return "AVISO: cabeçalho antigo não encontrado"
        s = pre + pos
        acao = "migrada"
    def parte(m):
        nome = m.group(1)
        arq = INCL / (nome.lower() + ".html")
        if nome == "HEADER" or not arq.exists():
            return m.group(0)
        return "<!-- SITE:%s -->\n%s\n<!-- /SITE:%s -->" % (nome, arq.read_text(encoding="utf-8").strip("\r\n"), nome)
    s = RE_PARTE.sub(parte, s)
    if "fonts.googleapis.com" in s and "fonts.gstatic.com\" crossorigin" not in s:
        s = re.sub(r'([ \t]*)(<link rel="preconnect" href="https://fonts.googleapis.com">)', lambda m: m.group(1) + m.group(2) + "\n" + m.group(1) + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>', s, count=1)
    if "js/analytics.js" not in s:
        s = s.replace("</head>", "  " + JS_AN + "\n</head>", 1)
    if "css/header.css" not in s:
        s = s.replace("</head>", "  " + CSS + "\n  " + JS + "\n</head>", 1)
    out = s.replace("\n", "\r\n") if crlf else s
    if out != raw:
        f.write_bytes(out.encode("utf-8"))
        return acao
    return "sem mudanças"


def main():
    for f in paginas():
        print("%-60s %s" % (f.relative_to(SITE).as_posix(), aplicar(f)))


if __name__ == "__main__":
    sys.exit(main())

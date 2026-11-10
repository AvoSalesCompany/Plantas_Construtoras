#!/usr/bin/env python3
"""
Monta a versão de publicação (Artifact do Claude) de um empreendimento.

O site em empreendimentos/<nome>/site/ é um HTML completo, que abre direto no navegador
ou no GitHub Pages. O Artifact envolve a página com o próprio <!doctype>/<head>/<body>,
então aqui tiramos essas tags da página principal e copiamos o resto como está.

Uso:
    python3 ferramentas/montar_artifact.py residencial-milao
Saída:
    dist/<nome>/  (index.html + arquivos de apoio, com os mesmos caminhos relativos)
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def tirar_esqueleto(html: str) -> str:
    html = re.sub(r'^\s*<!doctype html>\s*', '', html, flags=re.I)
    for tag in (r'<html[^>]*>', r'</html>', r'<head>', r'</head>', r'<body[^>]*>', r'</body>'):
        html = re.sub(r'^\s*' + tag + r'\s*\n?', '', html, flags=re.I | re.M)
    # o esqueleto do Artifact já traz charset e viewport
    html = re.sub(r'^<meta charset="utf-8">\n', '', html, flags=re.M)
    html = re.sub(r'^<meta name="viewport"[^>]*>\n', '', html, flags=re.M)
    return html.strip() + '\n'


def checar_js(pasta: Path) -> None:
    if not shutil.which('node'):
        print('node não encontrado: pulando a checagem de sintaxe')
        return
    for js in sorted(pasta.rglob('*.js')):
        r = subprocess.run(['node', '--check', str(js)], capture_output=True, text=True)
        if r.returncode:
            sys.exit(f'erro de sintaxe em {js.relative_to(RAIZ)}:\n{r.stderr}')
    print('sintaxe dos scripts: ok')


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    nome = sys.argv[1]
    site = RAIZ / 'empreendimentos' / nome / 'site'
    if not (site / 'index.html').exists():
        sys.exit(f'não achei {site / "index.html"}')
    checar_js(site)
    destino = RAIZ / 'dist' / nome
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(site, destino)
    pagina = destino / 'index.html'
    pagina.write_text(tirar_esqueleto(pagina.read_text(encoding='utf-8')), encoding='utf-8')
    arquivos = sorted(p.relative_to(destino).as_posix() for p in destino.rglob('*') if p.is_file())
    print(f'pronto: {destino.relative_to(RAIZ)}')
    print('arquivos de apoio:', ', '.join(a for a in arquivos if a != 'index.html'))


if __name__ == '__main__':
    main()

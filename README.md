# Plantas_Construtoras

Sites e maquetes 3D interativas de empreendimentos de construtoras, feitos pela AVO.
Cada empreendimento tem um site onde a pessoa gira o prédio em 3D, escolhe a torre, o andar e o apartamento, e entra no apartamento por dentro.

## Empreendimentos

| Empreendimento | Construtora | Cidade | Site | O que tem |
| --- | --- | --- | --- | --- |
| [Residencial Milão](empreendimentos/residencial-milao/) | Baliza | São Leopoldo/RS | [`site/`](empreendimentos/residencial-milao/site/) | 2 torres lado a lado em 3D, escolha por andar, andar aberto com cada apto em miniatura 3D, dois cliques para entrar no apto no lugar dele no bloco, visita a pé com saída para o corredor do andar |

## Estrutura

```
Plantas_Construtoras/
├── empreendimentos/
│   └── residencial-milao/
│       ├── README.md              ficha do empreendimento, fontes e o que foi estimado
│       └── site/
│           ├── index.html         página principal (torres 3D + seções)
│           ├── css/site.css       visual da página
│           ├── js/dados.js        dados do empreendimento (fonte única: preços, plantas, lazer)
│           ├── js/predio3d.js     torres em 3D (Three.js / WebGL)
│           ├── js/app.js          painel de andares, ficha do apto, visita 3D, mensagem
│           └── apartamento/       maquete 3D do apartamento por dentro (abre dentro da cena do prédio ou sozinha)
│               ├── index.html
│               ├── estilo.css
│               ├── app.js                 motor da maquete: AptEngine.create (visita, física, luzes, objetos interativos)
│               ├── planta-sem-sacada.js   paredes, portas, janelas e cômodos medidos da planta de meio
│               ├── planta-com-sacada.js   o mesmo para a planta de canto, com a sacada
│               └── planta-*.jpg           plantas oficiais (sobreposição no 3D)
├── ferramentas/
│   ├── montar_artifact.py         checa, testa e gera a versão de publicação em dist/
│   ├── teste_fumaca.js            roda os scripts com um 3D e um DOM falsos e acusa erros de JavaScript
│   ├── capturas.js                fotos reais do 3D num Chromium sem janela (entrar no apto, corredor, voltar)
│   └── roteiros/milao-site.js     cliques simulados no site (abrir andar, dois cliques no apto, corredor, apto espelhado, sair)
└── dist/                          (gerado, fora do git)
```

## Linguagens usadas em cada parte

| Parte | Linguagem | Por quê |
| --- | --- | --- |
| Estrutura das páginas | HTML | É o que o navegador abre direto, sem build |
| Visual e responsivo | CSS (com variáveis para tema claro e escuro) | Roda nativo, funciona no celular |
| Prédio e apartamento em 3D | JavaScript + [Three.js](https://threejs.org) r128 (WebGL) | O 3D roda no próprio navegador, sem instalar nada |
| Dados do empreendimento | JavaScript (objeto em `dados.js`) | Um só lugar para trocar preços, plantas e textos; abre até sem servidor |
| Montagem da publicação | Python 3 | Script simples, sem dependências, para copiar, checar e montar `dist/` |
| Testes | Node.js | Roda o mesmo JavaScript do navegador, com um 3D e um DOM falsos, para pegar erros antes de publicar |

## Como abrir

**No computador (recomendado):** dentro da pasta do site, rode um servidor simples e abra o endereço.

```bash
cd empreendimentos/residencial-milao/site
python3 -m http.server 8000
# abra http://localhost:8000
```

Abrir o `index.html` com dois cliques também funciona, mas alguns navegadores bloqueiam a imagem da planta na sobreposição do 3D quando a página vem do disco.

**No GitHub Pages:** em *Settings → Pages*, escolha a branch `main` e a pasta `/ (root)`. O site fica em
`https://avosalescompany.github.io/plantas_construtoras/empreendimentos/residencial-milao/site/`.

**Como Artifact do Claude:**

```bash
python3 ferramentas/montar_artifact.py residencial-milao
# publica dist/residencial-milao/index.html com os arquivos de apoio
```

## Novo empreendimento

1. Copie `empreendimentos/residencial-milao/` com o nome do novo empreendimento.
2. Troque os dados em `site/js/dados.js` (endereço, preços, plantas, lazer, número de torres e andares).
3. Ajuste a fachada e a implantação em `site/js/predio3d.js` (constantes `BAYS`, `TOWERS`, `PARKING`, `POOL`).
4. Para a visita por dentro, meça cada planta e crie um `apartamento/planta-<tipo>.js` (paredes, portas, janelas, cômodos) e os móveis em `apartamento/app.js`.
5. Rode `python3 ferramentas/montar_artifact.py <nome>`: ele checa a sintaxe, roda o teste de fumaça e monta `dist/`.

## Testes

```bash
node ferramentas/teste_fumaca.js empreendimentos/residencial-milao/site/index.html "" 6 ferramentas/roteiros/milao-site.js
node ferramentas/teste_fumaca.js empreendimentos/residencial-milao/site/apartamento/index.html "#tipo=com-sacada&embed=1&andar=8"
```

O teste não desenha o 3D: ele confirma que os scripts rodam sem erro.

Para ver o 3D de verdade sem abrir o navegador na mão, `ferramentas/capturas.js` abre o site num Chromium sem janela
(Playwright), abre o 8º andar, entra no apto com dois cliques e tira fotos de cada vista, do corredor e da volta ao andar:

```bash
npm i -D playwright && npx playwright install chromium     # uma vez
node ferramentas/capturas.js empreendimentos/residencial-milao/site capturas
# sem internet: --libs <clone do three.js na tag r128>
```

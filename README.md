# Plantas_Construtoras

Sites e maquetes 3D interativas de empreendimentos de construtoras, feitos pela AVO.
Cada empreendimento tem um site onde a pessoa gira o prédio em 3D, escolhe a torre, o andar e o apartamento, e entra no apartamento por dentro.

## Empreendimentos

| Empreendimento | Construtora | Cidade | Site | O que tem |
| --- | --- | --- | --- | --- |
| [Residencial Milão](empreendimentos/residencial-milao/) | Baliza | São Leopoldo/RS | [`site/`](empreendimentos/residencial-milao/site/) | 2 torres em 3D, escolha por andar, planta do andar, ficha do apto, visita 3D do apto sem sacada |

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
│           └── apartamento/       maquete 3D do apartamento por dentro
│               ├── index.html
│               ├── estilo.css
│               ├── planta-dados.js    paredes, portas, janelas e cômodos medidos da planta
│               ├── app.js             motor da maquete (visita, física, objetos interativos)
│               └── planta-sem-sacada.jpg
├── ferramentas/
│   └── montar_artifact.py         gera a versão de publicação em dist/
└── dist/                          (gerado, fora do git)
```

## Linguagens usadas em cada parte

| Parte | Linguagem | Por quê |
| --- | --- | --- |
| Estrutura das páginas | HTML | É o que o navegador abre direto, sem build |
| Visual e responsivo | CSS (com variáveis para tema claro e escuro) | Roda nativo, funciona no celular |
| Prédio e apartamento em 3D | JavaScript + [Three.js](https://threejs.org) r128 (WebGL) | O 3D roda no próprio navegador, sem instalar nada |
| Dados do empreendimento | JavaScript (objeto em `dados.js`) | Um só lugar para trocar preços, plantas e textos; abre até sem servidor |
| Ferramentas | Python 3 | Montar a versão de publicação e checar a sintaxe dos scripts |

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
4. Para a visita por dentro, meça a planta e preencha `apartamento/planta-dados.js`.

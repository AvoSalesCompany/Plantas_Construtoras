# Residencial Milão

Site conceito com as torres em 3D, escolha por andar e visita 3D ao apartamento.
Não é o site oficial da construtora.

## Ficha

| | |
| --- | --- |
| Construtora | Baliza Construtora |
| Endereço | Rua Marieta Fialho Blessmann, 276 · Feitoria · São Leopoldo/RS |
| Perto de | Parque Imperatriz, Casa do Imigrante, Avenida Feitoria |
| Unidades | 288 apartamentos de 2 dormitórios |
| Plantas | Sem sacada (apto de meio) 47,08 m² · Com sacada (apto de canto) 49,69 m² |
| Elevadores | 2 por torre |
| Vagas | 288 descobertas, uma escriturada por apartamento |
| Lazer | Salão de festas e quiosques com churrasqueira, piscinas adulto e infantil, playground, espaço pet e pet care, bicicletário, portaria |
| Acabamentos | Piso laminado, plafons, persianas nos quartos, gás central, medidor de água individual |
| Condições | Minha Casa Minha Vida, financiamento até 100%, renda a partir de R$ 3.500, parcelas a partir de R$ 999, entrada em até 80x |
| Preços de referência | Sem sacada a partir de R$ 230.703,00 · Com sacada a partir de R$ 238.094,31 |
| Obra | Em construção · contrato desde jan/2026 · 36 meses a partir do desembolso da Caixa · entrega prevista jan/2029 |
| Incorporação | R-5/116.632 |

Fonte: [balizaconstrutora.com.br/empreendimentos/residencial-milao](https://balizaconstrutora.com.br/empreendimentos/residencial-milao/), consultado em nov/2026.

### Cômodos

| Cômodo | Sem sacada | Com sacada |
| --- | ---: | ---: |
| Estar / Jantar | 10,00 m² | 10,29 m² |
| Dormitório 1 | 10,24 m² | 10,24 m² |
| Dormitório 2 | 7,50 m² | 7,50 m² |
| Cozinha / Á. Serv. | 4,00 m² | 6,24 m² |
| Banho | 3,53 m² | 3,18 m² |
| Circulação | 5,27 m² | 2,65 m² |
| Sacada | — | 2,48 m² |

## O que foi estimado

A construtora não publica o número de torres, andares e apartamentos por andar. Pelas fachadas e fotos aéreas, o site usa:

- **2 torres lado a lado** (A à esquerda, B à direita e um pouco recuada), de frente para a rua, com estacionamento na frente e lazer nos fundos;
- **térreo + 12 andares**, **12 apartamentos por andar** = 288 unidades;
- apartamentos `n01` a `n12` em cada andar `n` (101 a 1212), batendo com as plantas publicadas: **Apto Canto-101** (com sacada) e **Apto Meio-103** (sem sacada);
- posições 1 a 6 na frente e 7 a 12 nos fundos; os 4 cantos (1, 6, 7, 12) têm sacada, na ponta do prédio;
- as pontas do prédio são paredes cegas (a sala do apto de canto não tem janela na lateral, como na planta);
- piso a piso de 2,84 m.

A disponibilidade (disponível, reservado, vendido) é ilustrativa e sempre a mesma para cada apartamento. No site em produção ela viria do sistema de vendas.

## Maquete do apartamento (`site/apartamento/`)

As duas plantas foram medidas pixel a pixel e calibradas pelas cotas impressas:

| Planta | Arquivo | Escala | Cotas usadas |
| --- | --- | --- | --- |
| Sem sacada (meio) | `planta-sem-sacada.js` | 105,43 px/m | 2,37 · 2,39 · 4,32 · 3,14 · 3,74 · 2,10 · 4,04 |
| Com sacada (canto) | `planta-com-sacada.js` | 101,9 px/m | 2,39 · 2,36 · 4,34 · 3,14 · 2,25 · 2,61 · 1,46 · 5,09 |

As duas têm giro 360°, vista de planta com a planta oficial sobreposta, visita em primeira pessoa com colisão e câmera livre.
Dá para abrir portas, roupeiros, armários e geladeira, abrir janelas e baixar persianas, acender as luzes (interruptor ao lado da porta ou no plafon), abajures, TVs, ar-condicionado, videogame, torneiras, tanque, chuveiro e fogão, abrir o box, dar descarga e deitar ou sentar.
A luz de cada cômodo não atravessa as paredes, e a claridade muda com janela, persiana e porta.

Só na planta com sacada: porta de correr da sala para a sacada (fechada, não dá para passar), guarda-corpo de vidro, sacadas dos andares de baixo vistas de cima, janela basculante no banho, cozinha americana com balcão e banquetas.

A decoração da sem sacada segue os pedidos do cliente: parede de destaque azul-marinho, TV de 65" na sala, videogame na estante, ar-condicionado sobre as TVs, árvore de Natal, espelhos que refletem e dormitório 2 só com o roupeiro. A com sacada segue a planta decorada da Baliza, com os mesmos itens funcionando.

Parâmetros do endereço: `apartamento/index.html#tipo=com-sacada&andar=8&apto=801&torre=A` (`tipo` escolhe a planta; a vista da janela fica na altura do andar). Com `embed=1`, a maquete esconde os próprios botões e o site do prédio controla a visita por mensagens (`apt:cmd`, `apt:room`; ela responde `apt:ready`, `apt:state`, `apt:error`).

## Site (`site/`)

- O prédio abre girando devagar; passar o mouse acende o andar e clicar abre a laje com os 12 apartamentos, coloridos por disponibilidade.
- Ao escolher um apartamento e clicar em **Ver por dentro em 3D**, a câmera chega perto do apto, uma cortina com o número do apto cobre o palco e a maquete abre ali mesmo, no lugar do prédio. O painel ao lado vira o controle da visita (3D, planta, visitar, voar, opções e cômodos) e **voltar** leva de novo ao andar.
- Mesmas cores e fontes no prédio e na maquete; no tema escuro as torres aparecem à noite.

## Próximos passos

- Ligar a disponibilidade ao sistema de vendas da construtora.
- Confirmar com a construtora o número de torres, andares e aptos por andar e a numeração.
- Espelhar a maquete para os aptos do lado esquerdo e dos fundos (hoje todos abrem na orientação da planta oficial).

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
- cada apartamento encosta na fachada no tamanho real da planta; a torre tem 15,6 m de profundidade para caber o apto de canto (7,15 m com o hall de entrada) dos dois lados de um corredor central, que fica com 2,7 m na frente dos aptos de meio e 1,3 m entre os halls dos aptos de canto;
- dois dos cantos (6 e 12) são a planta espelhada, para a sacada ficar na ponta do prédio;
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
Dá para abrir portas, roupeiros, armários e geladeira, abrir janelas e baixar persianas, acender as luzes (interruptor ao lado da porta ou no plafon), abajures, TVs, torneiras, tanque, chuveiro e fogão, abrir o box, dar descarga e deitar ou sentar.
A luz de cada cômodo não atravessa as paredes, e a claridade muda com janela, persiana e porta.

Os móveis das duas seguem a planta decorada oficial da Baliza, sem personalização:

- **Sem sacada:** cama de casal com TV na parede, roupeiro em L, duas camas de solteiro com criado-mudo e tapete listrado no dormitório 2, sofá, rack com TV, mesa de jantar de 4 lugares e a parede amarela da sala.
- **Com sacada:** cama de casal com TV, roupeiro em L, cama de solteiro e cantinho infantil no dormitório 2, sofá, mesa de centro oval, rack com TV, mesa de 4 lugares, cozinha americana com 3 banquetas, porta de correr para a sacada (fechada, não dá para passar), guarda-corpo de vidro, sacadas dos andares de baixo vistas de cima e janela basculante no banho.

A maquete é um módulo (`AptEngine.create(opts)` em `apartamento/app.js`) que funciona de dois jeitos:

- **Dentro do site do prédio** (`opts.integrated`): usa o mesmo renderizador e o mesmo canvas das torres. O prédio informa a matriz que leva a maquete para o lugar do apto no bloco (girada 180° nos aptos da frente e espelhada nos cantos 6 e 12), o sol, as paredes do corredor e a câmera atual. A cada quadro a maquete desenha primeiro o prédio e depois o apartamento com a mesma câmera, então tudo se encaixa, inclusive a profundidade. As luzes de cada cômodo continuam sem atravessar paredes (o shader converte a posição de volta para a planta). Ao sair, `dispose()` solta os ouvintes e libera a memória da placa de vídeo.
- **Sozinha** (`apartamento/index.html#tipo=com-sacada&andar=8&apto=801&torre=A`): com a paisagem própria em volta, como antes. Com `embed=1` ainda aceita ser controlada por mensagens (`apt:cmd`, `apt:room`; responde `apt:ready`, `apt:state`, `apt:error`).

## Site (`site/`)

- O prédio abre girando devagar; passar o mouse acende o andar e clicar abre a laje com os 12 apartamentos em miniatura 3D (paredes e móveis), acesos se disponíveis e apagados se reservados ou vendidos.
- **Dois cliques** num apartamento (no 3D, no número sobre ele ou na planta do painel), ou **Ver por dentro em 3D** na ficha: a miniatura vira a maquete completa no mesmo lugar e a câmera voa do ponto onde está até o apartamento. Não abre outra tela.
- Dentro do apto, o painel vira o controle da visita: 3D, planta, visitar (a pé, com colisão) e voar (câmera livre pelo prédio e pelo condomínio), as opções e os cômodos.
- A porta de entrada dá para o **corredor do andar**: paredes, portas dos vizinhos com o número, elevadores, escada, forro e luz. O corredor também aparece na lista de cômodos. Na visita a pé, os andares de cima voltam a aparecer, então pela janela e pela sacada o prédio está inteiro em volta.
- **Voltar** no painel tira a câmera de onde a visita parou e voa de volta ao andar.
- Mesmas cores e fontes no prédio e na maquete; no tema escuro as torres aparecem à noite e as luzes do apto ficam acesas.

## Próximos passos

- Ligar a disponibilidade ao sistema de vendas da construtora.
- Confirmar com a construtora o número de torres, andares e aptos por andar e a numeração.
- Confirmar com a construtora a largura real do corredor e quais aptos são espelhados.

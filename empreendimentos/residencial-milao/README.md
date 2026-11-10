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

- **2 torres** (A e B), **térreo + 12 andares**, **12 apartamentos por andar** = 288 unidades;
- apartamentos `n01` a `n12` em cada andar `n` (101 a 1212);
- posições 1 a 6 na frente e 7 a 12 nos fundos; os 4 cantos (1, 6, 7, 12) têm sacada;
- piso a piso de 2,84 m.

A disponibilidade (disponível, reservado, vendido) é ilustrativa e sempre a mesma para cada apartamento. No site em produção ela viria do sistema de vendas.

## Maquete do apartamento (`site/apartamento/`)

Planta sem sacada medida pixel a pixel e calibrada pelas cotas impressas. Tem giro 360°, vista de planta com a planta oficial sobreposta, visita em primeira pessoa com colisão e câmera livre.
Dá para abrir portas, roupeiros e geladeira, janelas e persianas, ligar luzes, TVs, ar-condicionado, videogame, torneiras, chuveiro e fogão, dar descarga e deitar ou sentar.

A decoração segue os pedidos do cliente: parede de destaque azul-escuro, TV maior na sala, videogame na estante, ar-condicionado sobre as TVs, árvore de Natal, espelhos que refletem e dormitório 2 só com o roupeiro.

Abre no andar escolhido pelo endereço: `apartamento/index.html#andar=8&apto=803&torre=A` (a vista da janela fica na altura do andar).

## Próximos passos

- Maquete 3D da planta **com sacada** (apto de canto).
- Ligar a disponibilidade ao sistema de vendas da construtora.
- Confirmar com a construtora o número de torres, andares e aptos por andar.

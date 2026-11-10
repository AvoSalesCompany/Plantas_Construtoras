/*
 * Dados do Residencial Milão — fonte única para o site.
 * Origem: site da Baliza Construtora (balizaconstrutora.com.br/empreendimentos/residencial-milao/), consultado em nov/2026.
 * O número de torres, andares e aptos por andar NÃO é publicado pela construtora:
 * foi estimado pelas fachadas e fotos aéreas (2 torres x 12 andares x 12 aptos = 288 unidades).
 * A disponibilidade (livre / reservado / vendido) é ilustrativa; no site final ela viria do sistema de vendas.
 */
window.MILAO = {
  nome: 'Residencial Milão',
  endereco: 'Rua Marieta Fialho Blessmann, 276',
  bairro: 'Feitoria',
  cidade: 'São Leopoldo/RS',
  referencias: ['Parque Imperatriz', 'Casa do Imigrante', 'Avenida Feitoria'],
  mapa: 'https://www.google.com/maps/search/?api=1&query=Rua+Marieta+Fialho+Blessmann+276+Feitoria+Sao+Leopoldo+RS',
  incorporacao: 'R-5/116.632',

  unidades: 288,
  torres: ['A', 'B'],
  andares: 12,                 // acima do térreo
  aptosPorAndar: 12,
  peDireitoAndar: 2.84,        // piso a piso, em metros
  elevadoresPorTorre: 2,
  vagas: '288 vagas descobertas, uma escriturada por apartamento',

  obra: {
    status: 'Em construção',
    entrega: 'jan/2029',
    prazo: '36 meses a partir do desembolso da Caixa',
    inicioContrato: 'jan/2026'
  },

  // posições no andar: 1–6 na fachada da frente (esq. → dir.), 7–12 nos fundos (dir. → esq.)
  // cantos (1, 6, 7, 12) têm sacada; os outros são de meio, sem sacada
  tipos: {
    'sem-sacada': {
      nome: 'Sem sacada',
      planta: 'Apartamento de meio',
      area: 47.08,
      preco: 230703.00,
      posicoes: [2, 3, 4, 5, 8, 9, 10, 11],
      tour3d: true,
      comodos: [
        ['Estar / Jantar', 10.00],
        ['Dormitório 1', 10.24],
        ['Dormitório 2', 7.50],
        ['Circulação', 5.27],
        ['Cozinha / Á. Serv.', 4.00],
        ['Banho', 3.53]
      ]
    },
    'com-sacada': {
      nome: 'Com sacada',
      planta: 'Apartamento de canto',
      area: 49.69,
      preco: 238094.31,
      posicoes: [1, 6, 7, 12],
      tour3d: false,
      comodos: [
        ['Estar / Jantar', 10.29],
        ['Dormitório 1', 10.24],
        ['Dormitório 2', 7.50],
        ['Cozinha / Á. Serv.', 6.24],
        ['Banho', 3.18],
        ['Circulação', 2.65],
        ['Sacada', 2.48]
      ]
    }
  },

  financiamento: {
    programa: 'Minha Casa Minha Vida',
    financiamento: 'até 100%',
    rendaMinima: 3500,
    parcelaMinima: 999,
    entrada: 'em até 80 vezes'
  },

  lazer: [
    ['festas', 'Salão de festas', 'com churrasqueira'],
    ['quiosque', 'Quiosques', 'com churrasqueira'],
    ['piscina', 'Piscinas', 'adulto e infantil'],
    ['playground', 'Playground', 'para as crianças'],
    ['pet', 'Espaço pet', 'e pet care'],
    ['bike', 'Bicicletário', 'na área comum'],
    ['portaria', 'Portaria', 'condomínio fechado'],
    ['elevador', '2 elevadores', 'em cada torre']
  ],

  acabamentos: [
    'Piso laminado nos quartos, estar e circulação',
    'Luminárias tipo plafon',
    'Persianas nas janelas dos quartos',
    'Gás central',
    'Medidor de água individual'
  ]
};

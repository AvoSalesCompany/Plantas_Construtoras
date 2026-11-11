// Roteiro do site do Residencial Milão: abre um andar, entra com dois cliques num apto de meio (a maquete abre no lugar dele,
// dentro da cena do prédio), troca a vista, vai para o corredor, vai ao hall do elevador, chama o elevador e usa o painel da cabine,
// vai direto ao térreo, sai; depois entra num apto de canto espelhado pelo botão da ficha.
module.exports = function (t) {
  t.clicar('listaAndares', { dataset: { andar: '8' } });
  t.avancar(3); t.esperar();
  t.disparar('planta', 'dblclick', { dataset: { pos: '3' } });      // apto 803, sem sacada: dois cliques na planta do painel
  t.avancar(2); t.esperar(); t.avancar(6);
  t.clicar('aptoComodos', { dataset: { room: 'corredor' } });
  t.avancar(4);
  t.clicar('aptoComodos', { dataset: { room: 'elevador' } });        // hall do elevador do andar
  t.avancar(4);
  t.clicar('aptLiftBtn');                                            // chama o elevador
  t.avancar(6); t.esperar();
  t.clicar('aptCab', { dataset: { lift: '0' } });                    // painel da cabine: térreo
  t.clicar('aptCab', { dataset: { lift: 'open' } });
  t.avancar(6); t.esperar();
  t.clicar('aptoComodos', { dataset: { room: 'terreo' } });          // atalho: direto ao térreo do condomínio
  t.esperar(); t.avancar(4); t.esperar(); t.avancar(3);
  t.clicar('btnSairApto');
  t.esperar(); t.avancar(3);
  t.clicar('planta', { dataset: { pos: '6' } });                     // apto 806, com sacada, planta espelhada
  t.clicar('btnTour');
  t.avancar(2); t.esperar(); t.avancar(6);
  t.clicar('btnSairApto');
  t.esperar();
  t.clicar('btnVoltar');
  t.clicar('torreB');
  t.clicar('filtroTipo', { value: 'com-sacada' });
  t.clicar('formMsg');
  t.avancar(3);
};

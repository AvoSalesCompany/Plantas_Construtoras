// Roteiro do site do Residencial Milão: abre um andar, escolhe um apto de meio e um de canto,
// entra na visita 3D, recebe as mensagens da maquete, troca a vista e volta ao prédio.
module.exports = function (t) {
  const andar = { dataset: { andar: '8' } };
  t.clicar('listaAndares', andar);
  t.avancar(3); t.esperar();
  t.clicar('planta', { dataset: { pos: '3' } });                // apto 803, sem sacada
  t.clicar('btnTour');
  t.esperar(); t.avancar(3);
  const maquete = t.el('aptFrame').contentWindow;
  t.mensagem({ type: 'apt:ready', tipo: 'sem-sacada', comodos: '40,54', rooms: [{ id: 'd1', name: 'Dormitório 1', area: '10,24', dims: '2,37 × 4,32' }] }, maquete);
  t.mensagem({ type: 'apt:state', view: 'walk', imm: true, room: 'd1', rotate: false, wallsLow: false, furniture: true, labels: true, doorsOpen: true, overlay: false, hint: '' }, maquete);
  t.clicar('btnSairApto');
  t.esperar(); t.avancar(3);
  t.clicar('planta', { dataset: { pos: '1' } });                // apto 801, com sacada
  t.clicar('btnTour');
  t.esperar();
  t.mensagem({ type: 'apt:error' }, t.el('aptFrame').contentWindow);
  t.clicar('btnSairApto');
  t.esperar();
  t.clicar('btnVoltar');
  t.clicar('torreB');
  t.clicar('filtroTipo', { value: 'com-sacada' });
  t.clicar('formMsg');
  t.avancar(3);
};

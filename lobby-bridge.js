/* Keep the colleague's original lobby isolated from feature-page styles. */
(() => {
  const shell = document.querySelector('.app');
  const lobby = document.createElement('iframe');
  lobby.id = 'originalLobby';
  lobby.title = 'Gogo original lobby';
  lobby.src = 'lobby.html';
  lobby.setAttribute('translate', 'no');
  document.body.append(lobby);
  const style = document.createElement('style');
  style.textContent = '#originalLobby{position:fixed;inset:0;width:100%;height:100dvh;border:0;background:#10291c;z-index:10}body.originalLobbyOpen>.app{display:none}body.originalLobbyOpen{overflow:hidden}body:not(.originalLobbyOpen) #originalLobby{display:none}';
  document.head.append(style);
  const featureRender = render;
  function showLobby() {
    closeDialog();
    current = 'HOME';
    document.body.classList.add('originalLobbyOpen');
  }
  render = function(route = 'HOME') {
    if (route === 'HOME' || route === 'PROMO') return showLobby();
    document.body.classList.remove('originalLobbyOpen');
    featureRender(route);
    window.scrollTo(0, 0);
  };
  window.addEventListener('message', event => {
    if(event.origin !== location.origin || event.source !== lobby.contentWindow || event.data?.type !== 'dd-open-feature') return;
    const route = event.data.route;
    if(!['SHOP','EARN','GULLAK','DEPOSIT_WHEEL','RANKING','SUPPORT','LOTTERY'].includes(route)) return;
    if(route === 'LOTTERY'){lobby.src='lobby.html?view=lottery';document.body.classList.add('originalLobbyOpen');return;}
    document.body.classList.remove('originalLobbyOpen');
    if(route === 'SHOP') openShop();
    else if(route === 'DEPOSIT_WHEEL') openDepositWheel();
    else render(route);
    window.scrollTo(0,0);
  });
  showLobby();
})();

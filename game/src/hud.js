// DOM HUD for Solmar City: wanted stars, health, money, ammo, speed and
// car, objective bar, dialogue box and centre banners. Page elements,
// never 3D, so they read clearly in screenshots.
export function buildHud(doc) {
  const hud = doc.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div id="hud-top">
      <div id="wanted"></div>
      <div id="money">$120</div>
    </div>
    <div id="health-wrap"><div id="health-bar"></div><span id="health-num">100</span></div>
    <div id="ammo">AMMO 48</div>
    <div id="speed">0 <span>km/h</span><div id="car-name"></div></div>
    <div id="objective"></div>
    <div id="dialogue"></div>
    <div id="banner"></div>
    <div id="title-screen">
      <h1>SOLMAR CITY</h1>
      <p>An open-world crime story in the sun</p>
      <p class="keys">WASD walk &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; E enter car &nbsp;·&nbsp; F punch &nbsp;·&nbsp; Click shoot<br>Space handbrake &nbsp;·&nbsp; Drag mouse to look &nbsp;·&nbsp; Esc pause &nbsp;·&nbsp; M mute</p>
      <p class="press">PRESS ENTER TO PLAY</p>
    </div>
    <div id="pause-screen"><h2>PAUSED</h2><p>Press Esc or P to resume</p></div>
    <div id="over-screen"><h2 id="over-title">WASTED</h2><p id="over-text"></p><p class="press">PRESS ENTER TO RESPAWN</p></div>`;
  doc.body.appendChild(hud);
  return {
    root: hud,
    wanted: hud.querySelector('#wanted'),
    money: hud.querySelector('#money'),
    healthBar: hud.querySelector('#health-bar'),
    healthNum: hud.querySelector('#health-num'),
    ammo: hud.querySelector('#ammo'),
    speed: hud.querySelector('#speed'),
    carName: hud.querySelector('#car-name'),
    objective: hud.querySelector('#objective'),
    dialogue: hud.querySelector('#dialogue'),
    banner: hud.querySelector('#banner'),
    title: hud.querySelector('#title-screen'),
    pause: hud.querySelector('#pause-screen'),
    over: hud.querySelector('#over-screen'),
    overTitle: hud.querySelector('#over-title'),
    overText: hud.querySelector('#over-text'),
  };
}
// Brief scale pulse on the wanted stars when the heat rises.
export function flashWanted(h) {
  h.wanted.style.transform = 'scale(1.25)';
  setTimeout(() => { h.wanted.style.transform = 'scale(1)'; }, 180);
}
export function renderHud(h, s) {
  h.wanted.textContent = '★'.repeat(s.stars) + '☆'.repeat(Math.max(0, 5 - s.stars));
  h.wanted.style.color = s.stars >= 3 ? '#ff5040' : '#ffd76a';
  if (s.stars > (renderHud.lastStars ?? 0)) flashWanted(h);
  renderHud.lastStars = s.stars;
  h.money.textContent = '$' + s.money.toLocaleString('en-US');
  h.healthBar.style.width = Math.max(0, s.health) + '%';
  h.healthBar.style.background = s.health > 50 ? '#37d67a' : (s.health > 25 ? '#ffb020' : '#ff4030');
  h.healthNum.textContent = Math.round(s.health);
  h.ammo.textContent = 'AMMO ' + s.ammo;
  h.speed.firstChild.textContent = Math.round(Math.abs(s.speed) * 0.9) + ' ';
  h.carName.textContent = s.carName || 'ON FOOT';
  h.objective.textContent = '◆ ' + s.objective;
  if (s.dialogue) {
    h.dialogue.style.display = 'block';
    h.dialogue.textContent = s.dialogue;
  } else h.dialogue.style.display = 'none';
  if (s.banner) {
    h.banner.style.display = 'block';
    h.banner.textContent = s.banner;
  } else h.banner.style.display = 'none';
  h.title.style.display = s.screen === 'title' ? 'flex' : 'none';
  h.pause.style.display = s.screen === 'pause' ? 'flex' : 'none';
  h.over.style.display = s.screen === 'over' ? 'flex' : 'none';
  if (s.screen === 'over') {
    h.overTitle.textContent = s.overKind === 'busted' ? 'BUSTED' : 'WASTED';
    h.overText.textContent = s.overKind === 'busted'
      ? 'The cops dragged you in. Fine: $150.'
      : 'You blacked out at Solmar General. Fine: $150.';
  }
}

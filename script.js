// Journey top-down, manual drive - script.js
// Works with index.html and style.css above

/* ---------- elements ---------- */
const startEngine = document.getElementById('startEngine');
const driveNext = document.getElementById('driveNext');
const revBtn = document.getElementById('rev');
const confettiBtn = document.getElementById('confettiBtn');
const partyBtn = document.getElementById('partyBtn');
const secretBtn = document.getElementById('secretBtn');
const musicToggle = document.getElementById('musicToggle');
const partyMusic = document.getElementById('partyMusic');


const stopsList = Array.from(document.querySelectorAll('#stopsList .stop'));
const roadCanvas = document.getElementById('road');
const carEl = document.getElementById('car');
const statusEl = document.getElementById('status');
const popup = document.getElementById('popup');
const popupTitle = document.getElementById('popupTitle');
const popupImg = document.getElementById('popupImg');
const popupText = document.getElementById('popupText');
const popupNext = document.getElementById('popupNext');
const popupClose = document.getElementById('popupClose');

const bgMusic = document.getElementById('bgMusic');
const revSound = document.getElementById('revSound');
const confettiCanvas = document.getElementById('confetti');
const confettiCtx = confettiCanvas.getContext && confettiCanvas.getContext('2d');

const needle = document.getElementById('needle');
const gaugeCenter = document.querySelector('.gauge-center');
const speedNum = document.getElementById('speedNum');

let visited = new Set();
let currentStop = -1; // start before first
let isEngineOn = false;

/* ---------- Agent Verification ---------- */
window.addEventListener('load', () => {
  const overlay = document.getElementById('agentOverlay');
  const input = document.getElementById('agentCode');
  const btn = document.getElementById('verifyBtn');
  const msg = document.getElementById('verifyMsg');

  const correctCode = 'Y12SAR';

  function verify() {
    const val = input.value.trim();
    if (val === correctCode) {
      msg.style.color = '#00ffcc';
      msg.textContent = 'AGENT RI24MO12 VERIFIED — ACCESS GRANTED ✅';
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 2000);
    } else {
      msg.style.color = '#ff4444';
      msg.textContent = 'ACCESS DENIED — UNAUTHORIZED ENTRY ❌';
      input.value = '';
    }
  }

  btn.addEventListener('click', verify);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verify();
  });
});


/* ---------- canvas sizing ---------- */
function sizeCanvases(){
  roadCanvas.width = roadCanvas.clientWidth;
  roadCanvas.height = roadCanvas.clientHeight;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', sizeCanvases);
sizeCanvases();

/* ---------- draw road & stops (top-down vertical layout) ---------- */
const ctx = roadCanvas.getContext('2d');
function drawRoad(){
  const w = roadCanvas.width, h = roadCanvas.height;
  ctx.clearRect(0,0,w,h);
  // sky gradient
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, '#001a1a'); g.addColorStop(1, '#000');
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

  // road: vertical center
  const roadW = Math.min(420, w*0.6);
  const rx = (w - roadW)/2;
  ctx.fillStyle = '#272626be';
  ctx.fillRect(rx, 0, roadW, h);

  // lane markings center vertical dashed
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.53)';
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 24]);
  ctx.beginPath();
  ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h); ctx.stroke();
  ctx.setLineDash([]);

  // place stops vertically (top = earliest, bottom = start)
  const padding = 120;
  const usable = h - padding*2;
  const n = stopsList.length;
  stopsList.forEach((li, idx) => {
    // map index to y: bottom (start) is h - padding, top is padding
    const y = (h - padding) - (usable * idx) / Math.max(1, n-1);
    const cx = w/2;
    // draw marker
    ctx.beginPath();
    ctx.fillStyle = visited.has(idx) ? '#1c4d4cff' : '#93b9c9ff';
    ctx.arc(cx, y, 16, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,240,230,0.06)';
    ctx.stroke();
    // number
    ctx.fillStyle = '#001';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(idx+1, cx, y+4);
  });

  // position car at currentStop (if >=0) else at bottom
  positionCar();
}
function yForIndex(idx){
  const h = roadCanvas.height;
  const padding = 120;
  const usable = h - padding*2;
  return (h - padding) - (usable * idx) / Math.max(1, stopsList.length-1);
}
function positionCar(){
  const x = roadCanvas.width/2;
  const y = (currentStop >= 0) ? yForIndex(currentStop) + 30 : (roadCanvas.height - 60);
  // place car centered horizontally
  carEl.style.left = (x - carEl.clientWidth/2) + 'px';
  carEl.style.top = (y - carEl.clientHeight/2) + 'px';
}

/* ---------- gauge helpers ---------- */
function setGaugePercent(percent){ // percent 0..120 etc.
  const angle = -90 + (percent/100)*130;
  if (needle) needle.setAttribute('transform', `rotate(${angle} 100 110)`);
  if (gaugeCenter) {
    const display = (percent/100)*20;
    gaugeCenter.textContent = (display % 1 === 0) ? Math.round(display) : display.toFixed(1);
  }
  if (speedNum) speedNum.textContent = Math.round((percent/100)*200); // playful scaling
}

/* ---------- confetti ---------- */
// Robust confetti controller
function makeConfetti({ count = 180, duration = 8000, colors = ['#35e158', '#00b7f0', '#ffd166', '#ff6b6b'] } = {}) {
  if (!confettiCtx) return () => {};
  // limit count to avoid freezing
  count = Math.min(Math.max(20, count), 1000);

  const w = confettiCanvas.width = window.innerWidth;
  const h = confettiCanvas.height = window.innerHeight;

  const pieces = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * -h,
    vx: (Math.random() - 0.5) * 6,
    vy: Math.random() * 3 + 2,
    r: Math.random() * 6 + 3,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.2,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  let running = true;
  let opacity = 1;
  let rafId = null;
  const tStart = performance.now();

  function drawFrame() {
    confettiCtx.clearRect(0, 0, w, h);
    confettiCtx.globalAlpha = opacity;

    for (let p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;       // gravity
      p.rot += p.vr;
      // wrap horizontally
      if (p.x < -50) p.x = w + 50;
      if (p.x > w + 50) p.x = -50;
      // draw rectangle rotated
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.r/2, -p.r/2, p.r, p.r * 0.6);
      confettiCtx.restore();
    }

    confettiCtx.globalAlpha = 1;
    const elapsed = performance.now() - tStart;

    // if still in spawn/duration phase keep animating
    if (running || opacity > 0.03) {
      rafId = requestAnimationFrame(drawFrame);
    } else {
      // final clear and cancel
      confettiCtx.clearRect(0,0,w,h);
      cancelAnimationFrame(rafId);
    }
  }

  // start drawing
  rafId = requestAnimationFrame(drawFrame);

  // stop spawning after `duration`, then fade for 1s
  const stopTimeout = setTimeout(() => {
    running = false;
    // fade over 1000ms
    const fadeStart = performance.now();
    const fadeTick = () => {
      const fElapsed = performance.now() - fadeStart;
      opacity = Math.max(0, 1 - fElapsed / 1000);
      if (opacity > 0) requestAnimationFrame(fadeTick);
    };
    requestAnimationFrame(fadeTick);
  }, duration);

  // return a function to cancel immediately
  function stopNow() {
    running = false;
    clearTimeout(stopTimeout);
    opacity = 0;
    confettiCtx.clearRect(0,0,w,h);
    if (rafId) cancelAnimationFrame(rafId);
  }

  return stopNow;
}


/* ---------- popup ---------- */
function openPopupFor(index){
  const li = stopsList[index];
  const title = li.dataset.title || `Stop ${index+1}`;
  const text = li.dataset.text || '';
  const img = li.dataset.img || '';
  popupTitle.textContent = title;
  popupText.textContent = text;
  if (img) { popupImg.src = img; popupImg.style.display = 'block'; }
  else { popupImg.style.display = 'none'; }
  popup.classList.remove('hidden');

  // popupNext goes to next stop
  popupNext.onclick = ()=> {
    popup.classList.add('hidden');
    driveTo(index+1);
  };
  popupClose.onclick = ()=> popup.classList.add('hidden');
}

/* ---------- drive manually to next stop ---------- */
let animating = false;
function driveTo(targetIndex){
  if (animating) return;
  if (targetIndex < 0) targetIndex = 0;
  if (targetIndex >= stopsList.length) {
    // reached beyond last
    statusEl.textContent = 'You reached the end of the journey.';
    return;
  }
  // enable drive button only if engine on
  if (!isEngineOn) {
    statusEl.textContent = 'Start engine first.';
    return;
  }

  const startY = parseFloat(carEl.style.top) || (roadCanvas.height - 60 - carEl.clientHeight/2);
  const endY = yForIndex(targetIndex) - carEl.clientHeight/2 + 30;
  const distance = Math.abs(endY - startY);
  const duration = Math.max(600, Math.min(2200, distance * 0.9)); // ms
  const t0 = performance.now();
  animating = true;
  statusEl.textContent = `Driving to stop ${targetIndex+1}...`;
  driveNext.disabled = true;

  // animate gauge in sync (speed rises then falls)
  const maxPercent = 120;

  function frame(t){
    const dt = t - t0;
    const p = Math.min(1, dt/duration);
    const eased = 1 - Math.pow(1-p,3);
    const y = startY + (endY - startY) * eased;
    carEl.style.top = y + 'px';

    // speed simulation: ping in middle
    const speedPct = Math.sin(Math.PI * eased) * maxPercent;
    setGaugePercent(speedPct);

    if (p < 1) requestAnimationFrame(frame);
    else {
      // arrival
      animating = false;
      currentStop = targetIndex;
      visited.add(currentStop);
      drawRoad(); // redraw to show visited marker styles
      // small settle
      setGaugePercent(30);
      statusEl.textContent = `Arrived at stop ${currentStop+1}: ${stopsList[currentStop].dataset.title || ''}`;
      // open popup for this stop
      openPopupFor(currentStop);
      driveNext.disabled = false;
      // check secret unlock
      checkSecret();
    }
  }
  requestAnimationFrame(frame);
}

/* ---------- check secret unlock ---------- */
function checkSecret(){
  // secret unlock when visited all stops (we use index set)
  if (visited.size >= stopsList.length) {
    secretBtn.disabled = false;
    secretBtn.textContent = 'Secret Message 🔓';
    secretBtn.onclick = ()=> {
      popupTitle.textContent = 'Secret for Prattay';
      popupText.textContent = 'You found it! 20 is just the beginning — here’s to the best rides ahead! No matter how fast the drive goes and how bad the roads might be, you’ll always have someone who believes in you. 🖤 ❤️';
      popupImg.style.display = 'none';
      popup.classList.remove('hidden');
    };
  }
}

/* ---------- button wiring ---------- */
startEngine.addEventListener('click', ()=> {
  if (!isEngineOn) {
    isEngineOn = true;
    startEngine.textContent = 'Engine On 🔥';
    if (bgMusic.paused) bgMusic.play().catch(()=>{});
    revSound.currentTime = 0; revSound.play().catch(()=>{});
    statusEl.textContent = 'Engine started — press Drive to go!';
    driveNext.disabled = false;
    makeConfetti(40);
  } else {
    isEngineOn = false;
    startEngine.textContent = 'Start Engine';
    bgMusic.pause();
    statusEl.textContent = 'Parked — engine stopped.';
    driveNext.disabled = true;
  }
});

driveNext.addEventListener('click', ()=> {
  const next = Math.min(currentStop+1, stopsList.length-1);
  driveTo(next);
});

revBtn.addEventListener('click', ()=> {
  revSound.currentTime = 0; revSound.play().catch(()=>{});
  // quick gauge spike
  setGaugePercent(140);
  setTimeout(()=> setGaugePercent(20), 400);
});

confettiBtn.addEventListener('click', ()=> makeConfetti(150));



partyBtn.addEventListener('click', () => {
  const engineSound = revSound;
  const bgMusic = document.getElementById('bgMusic');
  const partyMusic = document.getElementById('partyMusic');

  // Stop other sounds first
  if (bgMusic) { bgMusic.pause(); bgMusic.currentTime = 0; }
  if (engineSound) { engineSound.pause(); engineSound.currentTime = 0; }

  // Play only the dance/party track
  partyMusic.currentTime = 0;
  partyMusic.play().catch(() => {});

  // Show confetti for as long as the music plays
  makeConfetti(200);

  // Keep refreshing confetti every few seconds for fun
  const confettiInterval = setInterval(() => makeConfetti(150), 4000);

  // Fun color flashing background
  let flashes = 0;
  const flashInterval = setInterval(() => {
    document.body.style.background = `radial-gradient(circle, hsl(${Math.random()*360},80%,10%), #111 80%)`;
    flashes++;
  }, 150);

  // Stop everything when the music ends
  partyMusic.onended = () => {
    clearInterval(flashInterval);
    clearInterval(confettiInterval);
    const ctx = confettiCanvas.getContext("2d");
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    document.body.style.background = '';
  };
});


musicToggle.addEventListener('click', ()=> {
  if (bgMusic.paused) { bgMusic.play().catch(()=>{}); musicToggle.textContent='Pause Music'; }
  else { bgMusic.pause(); musicToggle.textContent='Play / Pause Music'; }
});

/* click stops in list to jump (manual) */
stopsList.forEach((li, idx) => {
  li.addEventListener('click', ()=> {
    // immediate move without animation if engine off, else drive
    if (!isEngineOn) {
      currentStop = idx;
      positionCar();
      drawRoad();
      openPopupFor(idx);
      visited.add(idx);
      checkSecret();
    } else {
      driveTo(idx);
    }
  });
});

/* popup close handlers */
popupClose.addEventListener('click', ()=> popup.classList.add('hidden'));
popup.querySelector('#popupClose')?.addEventListener('click', ()=> popup.classList.add('hidden'));
popup.querySelector('#popupNext')?.addEventListener('click', ()=> {
  popup.classList.add('hidden');
  const next = Math.min(currentStop+1, stopsList.length-1);
  driveTo(next);
});

/* ---------- initial setup ---------- */
drawRoad();
positionCar();
setGaugePercent(0);

/* resize confetti */
window.addEventListener('resize', ()=> {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
});
confettiCanvas.width = window.innerWidth;
confettiCanvas.height = window.innerHeight;

console.log('Journey page ready — edit stops in HTML to customise images/text.');


// ---------------------------
// 🎮 Catch the Cake Mini Game
// ---------------------------
const gameBtn = document.getElementById("gameBtn");
const gameSection = document.getElementById("gameSection");
const gameCanvas = document.getElementById("gameCanvas");
const gameOverlay = document.getElementById("gameOverlay");
const gameMessage = document.getElementById("gameMessage");
const gameClose = document.getElementById("gameClose");

let gameActive = false;

gameBtn.addEventListener("click", startGame);
gameClose.addEventListener("click", endGame);

function startGame() {
  gameSection.classList.remove("hidden");
  gameOverlay.classList.add("hidden");
  gameActive = true;
  runGame();
}

function endGame() {
  gameActive = false;
  gameSection.classList.add("hidden");
}

function runGame() {
  const ctx = gameCanvas.getContext("2d");
  const w = gameCanvas.width = window.innerWidth * 0.9;
  const h = gameCanvas.height = window.innerHeight * 0.8;
  
  const car = { x: w / 2 - 40, y: h - 100, width: 80, height: 60 };
  const cakes = [];
  const cakeImg = new Image();
  cakeImg.src = "images/cake.png";
  const boyImg = new Image();
boyImg.src = "images/boy.png";

  
  let score = 0;
  let timeLeft = 20;
  let gameInterval, timerInterval;

  // Keyboard control
  const keys = {};
  document.addEventListener("keydown", e => keys[e.key] = true);
  document.addEventListener("keyup", e => keys[e.key] = false);

  // Create falling cakes
  function spawnCake() {
    cakes.push({ x: Math.random() * (w - 40), y: -40, speed: 3 + Math.random() * 2 });
  }

  function update() {
    if (!gameActive) return;

    // Move car
    if (keys["ArrowLeft"]) car.x -= 8;
    if (keys["ArrowRight"]) car.x += 8;
    car.x = Math.max(0, Math.min(w - car.width, car.x));

    // Move cakes
    cakes.forEach(c => c.y += c.speed);

    // Collision check
    cakes.forEach((c, i) => {
      if (
        c.x < car.x + car.width &&
        c.x + 40 > car.x &&
        c.y < car.y + car.height &&
        c.y + 40 > car.y
      ) {
        score++;
        cakes.splice(i, 1);
      }
    });

    // Remove off-screen cakes
    for (let i = cakes.length - 1; i >= 0; i--) {
      if (cakes[i].y > h) cakes.splice(i, 1);
    }

    // Draw everything
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(cakeImg, 10, 10, 40, 40);
    ctx.fillStyle = "#fff";
    ctx.fillText(`Score: ${score}`, 60, 40);
    ctx.fillText(`Time: ${timeLeft}s`, w - 100, 40);
    const boyImg = new Image();
boyImg.src = "images/boy.png";
ctx.drawImage(boyImg, car.x, car.y, car.width, car.height);

    cakes.forEach(c => ctx.drawImage(cakeImg, c.x, c.y, 40, 40));
  }

  // Timers
  gameInterval = setInterval(() => {
    update();
    if (Math.random() < 0.05) spawnCake();
  }, 30);

  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) finishGame();
  }, 1000);

  function finishGame() {
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    gameActive = false;
    gameOverlay.classList.remove("hidden");
    gameMessage.textContent =
      score >= 10 ? `🎉 You Won! ${score} cakes caught! 🍰` : `😅 You got only ${score}! Try again!`;
  }
}

/* =======================
   🔫 SECRET MISSION GAME
   ======================= */
// ----- Secret Mission (clean) -----
const missionBtn = document.getElementById('missionBtn');
const missionGame = document.getElementById('missionGame');
const missionCanvas = document.getElementById('missionCanvas');
const exitMission = document.getElementById('exitMission');
const mCtx = missionCanvas.getContext('2d');

// ensure fixed resolution
missionCanvas.width = 800;
missionCanvas.height = 500;

let missionRunning = false;
let missionReqId = null;
let missionState = {
  soldier: { x: 360, y: 400, w: 80, h: 80 },
  bullets: [],
  enemies: [],
  explosions: [],
};
let killCount = 0;

// load images
const solImg = new Image();
const terrImg = new Image();
const boomImg = new Image();
solImg.src = 'images/sol.png';
terrImg.src = 'images/TERR.png';
boomImg.src = 'images/boom.png';

// sounds
const shootSnd = new Audio('musics/shoot.mp3');
const explodeSnd = new Audio('musics/explode.mp3');

// spawn enemy interval handle
let spawnInterval = null;

function startMission() {
  missionGame.classList.remove('hidden');
  missionGame.setAttribute('aria-hidden', 'false');
  missionRunning = true;
  missionState.soldier.x = (missionCanvas.width/2) - 40;
  missionState.bullets = [];
  missionState.enemies = [];
  missionState.explosions = [];
  
  
  // start spawning
    let spawnCount = 0;
  spawnInterval = setInterval(() => {
    if (spawnCount >= 10) return; // only 10 terrorists total
    spawnCount++;
    missionState.enemies.push({
      x: Math.random() * (missionCanvas.width - 70),
      y: -80,
      w: 70, h: 70,
      speed: 0.5 + Math.random()*0.5  // slower
    });
  }, 3500); // spawn slower

  // start game loop
  missionLoop();
    // End game after 30 seconds
  setTimeout(() => {
    if (missionRunning) {
  missionRunning = false;
  missionState.gameOver = true;
  missionState.endMessage = `🎖️ Congrats Agent RI24MO12 — You neutralized ${killCount} terrorists!`;
  drawMission(); // force draw message
  setTimeout(() => stopMission(), 4000); // show for 4s
}

  }, 30000);

}
function stopMission() {
  missionRunning = false;
  if (spawnInterval) { clearInterval(spawnInterval); spawnInterval = null; }
  if (missionReqId) cancelAnimationFrame(missionReqId);

  // Wait 4 seconds before hiding so end message can show
  setTimeout(() => {
    missionGame.classList.add('hidden');
    missionGame.setAttribute('aria-hidden', 'true');
  }, 4000);
}


// basic input
const mKeys = {};
window.addEventListener('keydown', (e) => {
  if (!missionRunning) return;
  mKeys[e.code] = true;
  if (e.code === 'Space') shootBullet();
});
window.addEventListener('keyup', (e) => { mKeys[e.code] = false; });

function shootBullet(){
  missionState.bullets.push({
    x: missionState.soldier.x + missionState.soldier.w/2 - 4,
    y: missionState.soldier.y,
    w: 8, h: 20, speed: 10
  });
  shootSnd.currentTime = 0;
  shootSnd.play().catch(()=>{});
}

function updateMission(dt){
  // soldier move
  if (mKeys['ArrowLeft']) missionState.soldier.x -= 6;
  if (mKeys['ArrowRight']) missionState.soldier.x += 6;
  if (mKeys['ArrowUp']) missionState.soldier.y -= 6;
  if (mKeys['ArrowDown']) missionState.soldier.y += 6;
  missionState.soldier.x = Math.max(0, Math.min(missionCanvas.width - missionState.soldier.w, missionState.soldier.x));
  missionState.soldier.y = Math.max(0, Math.min(missionCanvas.height - missionState.soldier.h, missionState.soldier.y));

  // bullets
  for (let b of missionState.bullets) b.y -= b.speed;
  missionState.bullets = missionState.bullets.filter(b => b.y > -b.h);

  // enemies
  for (let e of missionState.enemies) e.y += e.speed;
  missionState.enemies = missionState.enemies.filter(e => e.y < missionCanvas.height + 100);

  // collisions
  for (let ei = missionState.enemies.length -1; ei >=0; ei--) {
    const e = missionState.enemies[ei];
    for (let bi = missionState.bullets.length -1; bi >=0; bi--) {
      const b = missionState.bullets[bi];
      if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
        missionState.explosions.push({ x: e.x, y: e.y, t: Date.now() });
        explodeSnd.currentTime = 0; explodeSnd.play().catch(()=>{});
        killCount++;

        missionState.enemies.splice(ei,1);
        missionState.bullets.splice(bi,1);
        break;
      }
    }
  }

  // cleanup explosions older than 400ms
  missionState.explosions = missionState.explosions.filter(ex => Date.now() - ex.t < 400);
}

function drawMission(){
  const ctx = mCtx;
  ctx.clearRect(0,0,missionCanvas.width, missionCanvas.height);
  // background
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,missionCanvas.width, missionCanvas.height);

  // soldier
  ctx.drawImage(solImg, missionState.soldier.x, missionState.soldier.y, missionState.soldier.w, missionState.soldier.h);

  // enemies
  for (let e of missionState.enemies) ctx.drawImage(terrImg, e.x, e.y, e.w, e.h);

  // bullets
  ctx.fillStyle = 'yellow';
  for (let b of missionState.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

  // explosions
  for (let ex of missionState.explosions) ctx.drawImage(boomImg, ex.x, ex.y, 80, 80);

  ctx.fillStyle = 'white';
ctx.font = '20px Arial';
ctx.fillText('Kills: ' + killCount, 10, 25);


if (missionState.gameOver) {
  mCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
  mCtx.fillRect(0, missionCanvas.height/2 - 50, missionCanvas.width, 100);
  mCtx.fillStyle = "lime";
  mCtx.font = "24px Arial";
  mCtx.textAlign = "center";
  mCtx.fillText(missionState.endMessage, missionCanvas.width / 2, missionCanvas.height / 2);
  mCtx.textAlign = "left";
}



}


function missionLoop(time){
  if (!missionRunning) return;
  updateMission();
  drawMission();
  missionReqId = requestAnimationFrame(missionLoop);
}

// wire buttons
missionBtn.addEventListener('click', () => {
  // ensure images are loaded at least once before starting
  if (!solImg.complete || !terrImg.complete || !boomImg.complete) {
    // wait for them to load
    let loadCount = 0;
    solImg.onload = terrImg.onload = boomImg.onload = () => {
      loadCount++;
      if (loadCount >= 3) startMission();
    };
  } else startMission();
});

exitMission.addEventListener('click', () => stopMission());


/* ---------------- HACKING SIMULATOR ---------------- */
const hackBtn = document.getElementById('hackBtn');
const hackOverlay = document.getElementById('hackOverlay');
const hackTerminal = document.getElementById('hackTerminal');
const hackClose = document.getElementById('hackClose');
const hackSound = document.getElementById('hackSound');


const hackLines = [
  "INITIALIZING SECURE CHANNEL...",
  "CONNECTING TO RAW-IB NODE [███░░░░░░░░] 32%",
  "AUTH TOKEN: ***********",
  "TRACE ROUTE: /intel/agent/prattay",
  "DOWNLOADING MEMORIES...",
  "DECRYPTING: █████████░ 78%",
  "ACCESSING: Personal/20th_bday/Surprise",
  "COMPILING MESSAGE...",
];

function runHackingSim(){
  hackSound.currentTime = 0;
hackSound.play();

  hackTerminal.innerHTML = '';
  hackOverlay.classList.remove('hidden');
  hackOverlay.setAttribute('aria-hidden','false');

  let i = 0, char = 0;
  function typeLoop(){
    if (i >= hackLines.length) {
      // final reveal
      // final reveal with glitch image + message
const img = document.getElementById("hackImage");
const msg = document.getElementById("hackMsg");

setTimeout(() => {
  img.classList.remove("hidden");
  img.classList.add("glitch-in");

  setTimeout(() => {
    msg.textContent = "Your curiosity level is high… Found this here lmao 🤣";
    msg.classList.remove("hidden");
  }, 600);
}, 400);

return;

    }
    const line = hackLines[i];
    if (char <= line.length) {
      hackTerminal.innerHTML = hackTerminal.innerHTML.replace(/\u2588$/, ''); // remove block
      hackTerminal.innerHTML += line.charAt(char) || '';
      hackTerminal.innerHTML += '<span style="opacity:0.9">\u2588</span>';
      hackTerminal.scrollTop = hackTerminal.scrollHeight;
      char++;
      setTimeout(typeLoop, 28 + Math.random()*40);
    } else {
      // finish line then next
      hackTerminal.innerHTML = hackTerminal.innerHTML.replace(/\u2588$/, '');
      hackTerminal.innerHTML += '\n';
      char = 0;
      i++;
      setTimeout(typeLoop, 300);
    }
  }
  typeLoop();
}

hackBtn?.addEventListener('click', runHackingSim);
hackClose?.addEventListener('click', ()=> {
  hackSound.pause();

  hackOverlay.classList.add('hidden');
  hackOverlay.setAttribute('aria-hidden','true');
});

/* ---------------- SPIN WHEEL ---------------- */
const wheelBtn = document.getElementById('wheelBtn');
const wheelOverlay = document.getElementById('wheelOverlay');
const wheelCanvas = document.getElementById('wheelCanvas');
const spinBtn = document.getElementById('spinBtn');
const wheelClose = document.getElementById('wheelClose');
const wheelResult = document.getElementById('wheelResult');

const wCtx = wheelCanvas.getContext('2d');
const wheelSize = wheelCanvas.width;
const center = wheelSize/2;
const radius = center - 8;

const segments = [
  { label: "🥵", prize: "🥵" },
  { label: "🧿", prize: "🧿" },
  { label: "😎", prize: "😎" },
  { label: "🤪", prize: "🤪" },
  { label: "😏", prize: "😏" },
  { label: "🤗", prize: "🤗" },
];

function drawWheel(){
  const seg = segments.length;
  const angle = (2*Math.PI)/seg;
  wCtx.clearRect(0,0,wheelSize,wheelSize);
  for(let i=0;i<seg;i++){
    const start = i*angle;
    const end = start+angle;
    wCtx.beginPath();
    wCtx.moveTo(center,center);
    wCtx.arc(center,center,radius,start,end);
    wCtx.closePath();
    wCtx.fillStyle = i%2===0 ? 'rgba(0,183,240,0.12)' : 'rgba(0,240,230,0.06)';
    wCtx.fill();
    // text
    wCtx.save();
    wCtx.translate(center,center);
    wCtx.rotate(start + angle/2);
    wCtx.textAlign = "right";
    wCtx.fillStyle = "#cff";
    wCtx.font = "50px sans-serif";
    wCtx.fillText(segments[i].label, radius - 10, 6);
    wCtx.restore();
  }
  // center circle
  wCtx.beginPath();
  wCtx.arc(center,center,48,0,Math.PI*2);
  wCtx.fillStyle = "#001b17";
  wCtx.fill();
  wCtx.lineWidth = 3;
  wCtx.strokeStyle = "rgba(0,240,230,0.12)";
  wCtx.stroke();
}

// spin logic
let spinning = false;
let spinAngle = 0;
let spinVel = 0;
let spinReq = null;

function startSpin(){
  if (spinning) return;
  spinning = true;
  wheelResult.textContent = '';
  // random target segment
  const segCount = segments.length;
  const randSeg = Math.floor(Math.random()*segCount);
  // compute velocity so wheel lands near randSeg
  const rotations = 4 + Math.random()*2; // full rotations
const targetAngle = (2*Math.PI)*rotations + (randSeg * (2*Math.PI/segCount));
  // set initial velocity
  spinVel = targetAngle / 120; // frames estimate
  function spinFrame(){
    if (!spinning) return cancelAnimationFrame(spinReq);
    spinAngle += spinVel;
    spinVel *= 0.985; // friction
    // draw rotated wheel
    wCtx.save();
    wCtx.clearRect(0,0,wheelSize,wheelSize);
    wCtx.translate(center,center);
    wCtx.rotate(spinAngle);
    wCtx.translate(-center,-center);
    drawWheel();
    wCtx.restore();
    // indicator triangle
    wCtx.fillStyle = "#ffeb00";
    wCtx.beginPath();
    wCtx.moveTo(center, 6);
    wCtx.lineTo(center - 10, 26);
    wCtx.lineTo(center + 10, 26);
    wCtx.closePath();
    wCtx.fill();
    
    if (spinVel < 0.002) {
  spinning = false;

  // robust selection: compare each segment center angle to pointer angle (top)
  const TWO_PI = Math.PI * 2;
  const segCount = segments.length;
  const segAngle = TWO_PI / segCount;

  // Normalize rotation to 0..2PI
  const rot = (spinAngle % TWO_PI + TWO_PI) % TWO_PI;

  // pointer is at the top: angle = -Math.PI/2 (or 3*PI/2 normalized)
  const pointerAngle = (TWO_PI - Math.PI / 2) % TWO_PI; // equals 3π/2

  // Find segment whose center (after rotation) is closest to pointerAngle
  let bestIndex = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < segCount; i++) {
    // center angle of segment i BEFORE rotation (0 is to the right, increasing CCW)
    const segCenter = i * segAngle + segAngle / 2;

    // AFTER we rotate the wheel by `rot`, the segment center angle moves by +rot
    let rotatedCenter = (segCenter + rot) % TWO_PI;

    // compute minimal angular distance to pointerAngle
    let diff = Math.abs(((rotatedCenter - pointerAngle + Math.PI) % TWO_PI) - Math.PI);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  const prize = segments[bestIndex];
  showWheelPrize(prize);
  return;
}


    spinReq = requestAnimationFrame(spinFrame);
  }
  spinReq = requestAnimationFrame(spinFrame);
}

function showWheelPrize(prize){
  // default
  wheelResult.textContent = prize.label;

  if (prize.prize === '🥵') {
    wheelResult.textContent = "FREE PASS: For a ahem ahem spicy hickeyyyy!!";
    launchEmojiConfetti("🔥");

  } else if (prize.prize === '🧿') {
    wheelResult.textContent = "My lovely angel, tereko kisi ki nazar na lage! ";
    launchEmojiConfetti("💋");

  } else if (prize.prize === '😏') {
    wheelResult.textContent = "FREE PASS: Wanna drink again??";
    launchEmojiConfetti("😈");

  } else if (prize.prize === '😎') {
    wheelResult.textContent = "Love you my handsome smartyyyy!";
    launchEmojiConfetti("🥰");

  } else if (prize.prize === '🤗') {
    wheelResult.textContent = "FREE PASS: For a warm hug(unlimites passes actually, you can redeem anytime)!!";
    launchEmojiConfetti("🫂");

  } else if (prize.prize === '🤪') {
    wheelResult.textContent = "My crazyyy partner in crimeeee!!";
    launchEmojiConfetti("👻");
  }
}

function launchEmojiConfetti(emoji) {
  const count = 15; // how many to spawn
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    span.textContent = emoji;
    span.style.position = "fixed";
    span.style.left = Math.random() * window.innerWidth + "px";
    span.style.top = "-20px";
    span.style.fontSize = (30 + Math.random() * 20) + "px";
    span.style.pointerEvents = "none";
    span.style.zIndex = "999999";
    span.style.opacity = "1";
    span.style.transition = "transform 2s linear, opacity 2s ease-out";

    document.body.appendChild(span);

    setTimeout(() => {
      span.style.transform = `translateY(${window.innerHeight + 50}px) rotate(${Math.random()*360}deg)`;
      span.style.opacity = "0";
    }, 10);

    setTimeout(() => span.remove(), 2200);
  }
}




wheelBtn?.addEventListener('click', () => {
  wheelOverlay.classList.remove('hidden');
  wheelOverlay.setAttribute('aria-hidden','false');
  drawWheel();
});
wheelClose?.addEventListener('click', () => {
  wheelOverlay.classList.add('hidden');
  wheelOverlay.setAttribute('aria-hidden','true');
  if (spinReq) cancelAnimationFrame(spinReq);
});
spinBtn?.addEventListener('click', startSpin);

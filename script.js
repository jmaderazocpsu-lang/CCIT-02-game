
// --- AUDIO SYNTHESIZER (Web Audio API) ---
class SoundController {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playHit(freq = 300, type = 'sine', duration = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  playSpike() {
    this.playHit(600, 'triangle', 0.18);
  }
  playScore() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }
}

const sounds = new SoundController();

// --- GAME STATE VARIABLES ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.4;
const GROUND_Y = 440;
const NET_X = canvas.width / 2;
const NET_HEIGHT = 120;
const NET_WIDTH = 12;

let gameMode = 'ai'; // 'ai' or '2p'
let isPaused = false;
let gameOver = false;
let animationFrameId = null;

// Avatars (Image Objects)
let p1Image = null;
let p2Image = null;

// Controls State
const keys = {};

// Players Setup
const p1 = {
  x: 200,
  y: GROUND_Y,
  vx: 0,
  vy: 0,
  radius: 30,
  speed: 6,
  jumpPower: -11,
  isGrounded: true,
  score: 0,
  color: '#ef4444',
  name: 'Player 1',
  spiking: false
};

const p2 = {
  x: 700,
  y: GROUND_Y,
  vx: 0,
  vy: 0,
  radius: 30,
  speed: 6,
  jumpPower: -11,
  isGrounded: true,
  score: 0,
  color: '#3b82f6',
  name: 'Sandy Bot',
  spiking: false
};

// Ball Setup
const ball = {
  x: 200,
  y: 200,
  vx: 3,
  vy: 0,
  radius: 18,
  rotation: 0,
  rotSpeed: 0.05,
  lastHitBy: null
};

// Particles (for sand hits & spikes)
let particles = [];

// --- EVENT LISTENERS (UI & CONTROLS) ---
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Photo Upload Handlers
document.getElementById('p1-photo-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const img = new Image();
      img.onload = function() {
        p1Image = img;
        document.getElementById('p1-avatar-preview').style.backgroundImage = `url(${evt.target.result})`;
        document.getElementById('p1-avatar-preview').innerHTML = '';
        document.getElementById('score-p1-img').style.backgroundImage = `url(${evt.target.result})`;
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('p2-photo-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const img = new Image();
      img.onload = function() {
        p2Image = img;
        document.getElementById('p2-avatar-preview').style.backgroundImage = `url(${evt.target.result})`;
        document.getElementById('p2-avatar-preview').innerHTML = '';
        document.getElementById('score-p2-img').style.backgroundImage = `url(${evt.target.result})`;
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Mode Toggle
document.querySelectorAll('input[name="gameMode"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    gameMode = e.target.value;
    const p2Title = document.getElementById('p2-card-title');
    const p2Tag = document.getElementById('p2-tag-label');
    const p2Hint = document.getElementById('p2-controls-hint');
    const p2NameInput = document.getElementById('p2-name');

    if (gameMode === '2p') {
      p2Title.innerText = 'Player 2';
      p2Tag.innerText = 'P2';
      p2Hint.innerHTML = '<strong>Controls:</strong> <br><kbd>←</kbd> <kbd>→</kbd> Move | <kbd>↑</kbd> Jump | <kbd>↓</kbd> Spike';
      if (p2NameInput.value === 'Sandy Bot') p2NameInput.value = 'Player 2';
    } else {
      p2Title.innerText = 'Bot Opponent';
      p2Tag.innerText = 'AI';
      p2Hint.innerHTML = '<strong>Controls:</strong> <br><em>AI Auto Controller Active</em>';
      if (p2NameInput.value === 'Player 2') p2NameInput.value = 'Sandy Bot';
    }
  });
});

// Start Game
document.getElementById('start-game-btn').addEventListener('click', () => {
  sounds.init();
  p1.name = document.getElementById('p1-name').value || 'Player 1';
  p2.name = document.getElementById('p2-name').value || (gameMode === 'ai' ? 'Sandy Bot' : 'Player 2');

  document.getElementById('score-p1-name').innerText = p1.name;
  document.getElementById('score-p2-name').innerText = p2.name;

  document.getElementById('login-overlay').classList.add('hidden');
  resetMatch();
  gameLoop();
});

// Pause Button
document.getElementById('pause-btn').addEventListener('click', () => {
  isPaused = !isPaused;
  document.getElementById('pause-btn').innerText = isPaused ? '▶️ Resume' : '⏸️ Pause';
  if (!isPaused) gameLoop();
});

// Restart & Menu Buttons
document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('game-over-overlay').classList.add('hidden');
  resetMatch();
  gameLoop();
});

document.getElementById('menu-btn').addEventListener('click', () => {
  document.getElementById('game-over-overlay').classList.add('hidden');
  document.getElementById('login-overlay').classList.remove('hidden');
});

// --- GAME LOGIC & PHYSICS ---

function resetPoint(server = 1) {
  p1.x = 200;
  p1.y = GROUND_Y;
  p1.vx = 0;
  p1.vy = 0;

  p2.x = 700;
  p2.y = GROUND_Y;
  p2.vx = 0;
  p2.vy = 0;

  ball.x = server === 1 ? 200 : 700;
  ball.y = 180;
  ball.vx = server === 1 ? 2 : -2;
  ball.vy = -3;
}

function resetMatch() {
  p1.score = 0;
  p2.score = 0;
  gameOver = false;
  updateScoreUI();
  resetPoint(1);
}

function updateScoreUI() {
  document.getElementById('score-p1-val').innerText = p1.score;
  document.getElementById('score-p2-val').innerText = p2.score;
}

function addParticles(x, y, count = 12, color = '#fef08a') {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      radius: Math.random() * 4 + 2,
      color: color,
      life: 1
    });
  }
}

function updateAI() {
  const targetX = ball.x;
  const dist = targetX - p2.x;

  // Horizontal Movement
  if (Math.abs(dist) > 15) {
    p2.vx = dist > 0 ? p2.speed * 0.75 : -p2.speed * 0.75;
  } else {
    p2.vx = 0;
  }

  // Jump Logic
  if (ball.x > NET_X && ball.y < GROUND_Y - 50 && ball.x - p2.x < 80 && p2.isGrounded && Math.random() < 0.1) {
    p2.vy = p2.jumpPower;
    p2.isGrounded = false;
  }
}

function update() {
  if (isPaused || gameOver) return;

  // --- 1. PLAYER 1 CONTROLS ---
  if (keys['a'] || keys['A']) p1.vx = -p1.speed;
  else if (keys['d'] || keys['D']) p1.vx = p1.speed;
  else p1.vx = 0;

  if ((keys['w'] || keys['W']) && p1.isGrounded) {
    p1.vy = p1.jumpPower;
    p1.isGrounded = false;
  }

  p1.spiking = (keys['s'] || keys['S']) && !p1.isGrounded;

  // --- 2. PLAYER 2 CONTROLS / AI ---
  if (gameMode === '2p') {
    if (keys['ArrowLeft']) p2.vx = -p2.speed;
    else if (keys['ArrowRight']) p2.vx = p2.speed;
    else p2.vx = 0;

    if (keys['ArrowUp'] && p2.isGrounded) {
      p2.vy = p2.jumpPower;
      p2.isGrounded = false;
    }

    p2.spiking = keys['ArrowDown'] && !p2.isGrounded;
  } else {
    updateAI();
  }

  // --- 3. MOVEMENT & BOUNDARIES ---
  [p1, p2].forEach((p, idx) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY;

    // Ground Collision
    if (p.y >= GROUND_Y) {
      p.y = GROUND_Y;
      p.vy = 0;
      p.isGrounded = true;
    }

    // Side Boundaries & Net
    const minX = idx === 0 ? p.radius : NET_X + NET_WIDTH / 2 + p.radius;
    const maxX = idx === 0 ? NET_X - NET_WIDTH / 2 - p.radius : canvas.width - p.radius;

    if (p.x < minX) p.x = minX;
    if (p.x > maxX) p.x = maxX;
  });

  // --- 4. BALL PHYSICS ---
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vy += GRAVITY * 0.65;
  ball.rotation += ball.vx * 0.03;

  // Ball & Wall Collisions
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.vx *= -0.8;
  }
  if (ball.x + ball.radius > canvas.width) {
    ball.x = canvas.width - ball.radius;
    ball.vx *= -0.8;
  }

  // Ball & Net Collision
  const netTop = GROUND_Y - NET_HEIGHT;
  if (ball.x + ball.radius > NET_X - NET_WIDTH / 2 && ball.x - ball.radius < NET_X + NET_WIDTH / 2) {
    if (ball.y + ball.radius > netTop) {
      if (ball.y < netTop) {
        ball.y = netTop - ball.radius;
        ball.vy *= -0.7;
      } else {
        if (ball.vx > 0) ball.x = NET_X - NET_WIDTH / 2 - ball.radius;
        else ball.x = NET_X + NET_WIDTH / 2 + ball.radius;
        ball.vx *= -0.6;
      }
    }
  }

  // Ball & Player Collisions
  [p1, p2].forEach((p) => {
    const dx = ball.x - p.x;
    const dy = ball.y - (p.y - p.radius);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ball.radius + p.radius) {
      const angle = Math.atan2(dy, dx);
      let power = p.spiking ? 14 : 9;

      ball.vx = Math.cos(angle) * power + p.vx * 0.3;
      ball.vy = Math.sin(angle) * power;

      if (p.spiking) {
        sounds.playSpike();
        addParticles(ball.x, ball.y, 15, '#f59e0b');
      } else {
        sounds.playHit();
      }
    }
  });

  // --- 5. GROUND IMPACT (SCORING) ---
  if (ball.y + ball.radius >= GROUND_Y + 15) {
    addParticles(ball.x, GROUND_Y + 15, 20, '#fde047');
    sounds.playScore();

    if (ball.x < NET_X) {
      p2.score++;
      updateScoreUI();
      if (p2.score >= 7) triggerGameOver(p2.name);
      else resetPoint(1);
    } else {
      p1.score++;
      updateScoreUI();
      if (p1.score >= 7) triggerGameOver(p1.name);
      else resetPoint(2);
    }
  }

  // Update Particles
  particles.forEach((p, idx) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    if (p.life <= 0) particles.splice(idx, 1);
  });
}

function triggerGameOver(winnerName) {
  gameOver = true;
  document.getElementById('winner-title').innerText = `${winnerName.toUpperCase()} WINS!`;
  document.getElementById('game-over-overlay').classList.remove('hidden');
}

// --- RENDERING ---

function drawBeachBackground() {
  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 300);
  skyGrad.addColorStop(0, '#38bdf8');
  skyGrad.addColorStop(1, '#bae6fd');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Sun
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(120, 80, 40, 0, Math.PI * 2);
  ctx.fill();

  // Ocean
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 260, canvas.width, 80);

  // Ocean Wave Shore Line
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, 330, canvas.width / 2, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sand Court
  const sandGrad = ctx.createLinearGradient(0, 330, 0, canvas.height);
  sandGrad.addColorStop(0, '#fef08a');
  sandGrad.addColorStop(1, '#eab308');
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, 330, canvas.width, canvas.height - 330);

  // Court Lines
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(50, GROUND_Y + 15);
  ctx.lineTo(canvas.width - 50, GROUND_Y + 15);
  ctx.stroke();

  // Net Post & Mesh
  ctx.fillStyle = '#64748b';
  ctx.fillRect(NET_X - NET_WIDTH / 2, GROUND_Y - NET_HEIGHT, NET_WIDTH, NET_HEIGHT + 15);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = GROUND_Y - NET_HEIGHT; y < GROUND_Y; y += 12) {
    ctx.moveTo(NET_X - NET_WIDTH / 2, y);
    ctx.lineTo(NET_X + NET_WIDTH / 2, y);
  }
  ctx.stroke();
}

function drawPlayer(p, img) {
  ctx.save();
  ctx.translate(p.x, p.y - p.radius);

  // Shadows
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, p.radius, p.radius * 0.8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body/Torso (Beach Shorts & Body)
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 10, p.radius * 0.7, 0, Math.PI);
  ctx.fill();

  // Head (Photo Avatar or Circle Color)
  ctx.beginPath();
  ctx.arc(0, -10, p.radius * 0.75, 0, Math.PI * 2);
  ctx.clip();

  if (img) {
    ctx.drawImage(img, -p.radius * 0.75, -10 - p.radius * 0.75, p.radius * 1.5, p.radius * 1.5);
  } else {
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name[0].toUpperCase(), 0, -10);
  }

  ctx.restore();

  // Outline for Head Circle
  ctx.save();
  ctx.translate(p.x, p.y - p.radius);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -10, p.radius * 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.rotation);

  // Ball Base
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  // Beach Volleyball Stripes (Yellow & Blue)
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI / 2);
  ctx.lineTo(0, 0);
  ctx.fill();

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, Math.PI, (3 * Math.PI) / 2);
  ctx.lineTo(0, 0);
  ctx.fill();

  // Ball Outline
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBeachBackground();
  drawPlayer(p1, p1Image);
  drawPlayer(p2, p2Image);
  drawBall();

  // Render Particles
  particles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  });
}

function gameLoop() {
  update();
  render();
  if (!isPaused && !gameOver) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}
// UI elements
const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const bestMovesEl = document.getElementById("best-moves");
const timeEl = document.getElementById("time");
const bestTimeEl = document.getElementById("best-time");
const statusEl = document.getElementById("status");
const newBtn = document.getElementById("new");
const sizeSelect = document.getElementById("size");
const themeBtn = document.getElementById("theme");
const hintBtn = document.getElementById("hint");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const autoHintEl = document.getElementById("auto-hint");

// Theme toggle
themeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("isDarkTheme", document.body.classList.contains("dark"));
});

// Game state
let size = 5; // board size N (NxN)
let state = []; // flat array of booleans; true = ON, false = OFF
let moves = 0;

// Move history (indices of applied moves)
let history = [];
let ptr = -1;

// Best stats per size
let bestMoves = null;
let bestTime = null;

// Timer
let startTime = 0;
let elapsed = 0;
let timerId = null;
function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms));
  const tenths = Math.floor((total % 1000) / 100);
  const secs = Math.floor(total / 1000) % 60;
  const mins = Math.floor(total / 60000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}.${tenths}`;
}
function updateTimeUI() {
  timeEl.textContent = formatTime(elapsed);
}
function startTimer() {
  stopTimer();
  startTime = performance.now();
  elapsed = 0;
  updateTimeUI();
  timerId = setInterval(() => {
    elapsed = performance.now() - startTime;
    updateTimeUI();
  }, 100);
}
function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

// Storage helpers
function bestMovesKey() {
  return `bestMoves-${size}`;
}
function bestTimeKey() {
  return `bestTime-${size}`;
}

function loadBests() {
  const mv = localStorage.getItem(bestMovesKey());
  bestMoves = mv != null ? parseInt(mv, 10) : null;
  bestMovesEl.textContent = bestMoves == null ? "–" : String(bestMoves);

  const tm = localStorage.getItem(bestTimeKey());
  bestTime = tm != null ? parseInt(tm, 10) : null;
  bestTimeEl.textContent = bestTime == null ? "–" : formatTime(bestTime);
}
function saveBestMoves(n) {
  bestMoves = n;
  localStorage.setItem(bestMovesKey(), String(n));
  bestMovesEl.textContent = String(n);
}
function saveBestTime(ms) {
  bestTime = ms;
  localStorage.setItem(bestTimeKey(), String(ms));
  bestTimeEl.textContent = formatTime(ms);
}

// Helpers
function idx(r, c) {
  return r * size + c;
}
function inBounds(r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

// Pure state ops
function toggle(i) {
  state[i] = !state[i];
}

function applyMove(i) {
  // Toggle cell + orthogonal neighbors
  const r = Math.floor(i / size);
  const c = i % size;
  toggle(i);
  const deltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dr, dc] of deltas) {
    const rr = r + dr,
      cc = c + dc;
    if (inBounds(rr, cc)) toggle(idx(rr, cc));
  }
}

function isWin() {
  return state.every((v) => !v);
}

// Rendering and sizing
function render() {
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.innerHTML = "";

  for (let i = 0; i < size * size; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tile${state[i] ? " on" : ""}`;
    btn.dataset.index = String(i);
    btn.setAttribute("aria-pressed", state[i] ? "true" : "false");
    const row = Math.floor(i / size) + 1;
    const col = (i % size) + 1;
    btn.setAttribute(
      "aria-label",
      `Row ${row}, column ${col}, ${state[i] ? "on" : "off"}`
    );
    boardEl.appendChild(btn);
  }

  movesEl.textContent = String(moves);

  // Fit board to viewport after DOM updates
  requestAnimationFrame(resizeBoardToViewport);
}

function resizeBoardToViewport() {
  const rect = boardEl.getBoundingClientRect();
  const availableHeight = Math.max(0, window.innerHeight - rect.top - 16);
  const parent = boardEl.parentElement;
  const availableWidth = parent ? parent.clientWidth : rect.width;
  const side = Math.floor(Math.min(availableWidth, availableHeight));
  boardEl.style.width = side + "px";
  boardEl.style.height = side + "px";
}
window.addEventListener("resize", () => {
  requestAnimationFrame(resizeBoardToViewport);
});

// Controls enable/disable
function enableControls() {
  hintBtn.disabled = false;
  undoBtn.disabled = false;
  redoBtn.disabled = false;
}
function disableControls() {
  hintBtn.disabled = true;
  undoBtn.disabled = true;
  redoBtn.disabled = true;
}

function unhighlightAll() {
  for (const el of boardEl.querySelectorAll(".tile.highlight")) {
    el.classList.remove("highlight");
  }
}

// Shuffle to a solvable random board by applying random moves from solved
function shuffle() {
  state = new Array(size * size).fill(false);
  const shuffleMoves = size * size * 3;
  for (let k = 0; k < shuffleMoves; k++) {
    const i = Math.floor(Math.random() * state.length);
    applyMove(i);
  }
  moves = 0;
  history = [];
  ptr = -1;
  statusEl.textContent = "";
  enableControls();
  render();
  stopTimer();
  startTimer();
}

// History push (trims redo)
function pushMove(i) {
  if (ptr < history.length - 1) history = history.slice(0, ptr + 1);
  history.push(i);
  ptr += 1;
}

// Solver (Gaussian elimination over GF(2))
let A = null; // coefficient matrix for current size (N^2 x N^2)
function buildMatrix() {
  const n = size * size;
  A = Array.from({ length: n }, () => new Uint8Array(n));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const j = idx(r, c); // press at (r,c)
      const cells = [
        [r, c],
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      for (const [rr, cc] of cells) {
        if (inBounds(rr, cc)) {
          const i = idx(rr, cc); // affected cell
          A[i][j] = 1;
        }
      }
    }
  }
}

function solvePresses() {
  // Solve A x = b (mod 2), b=state (1=ON)
  const n = size * size;
  const M = Array.from({ length: n }, (_, r) => Uint8Array.from(A[r]));
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = state[i] ? 1 : 0;

  let row = 0;
  const pivotCol = new Int16Array(n).fill(-1);
  for (let col = 0; col < n && row < n; col++) {
    let sel = row;
    while (sel < n && M[sel][col] === 0) sel++;
    if (sel === n) continue;
    if (sel !== row) {
      const tmp = M[sel];
      M[sel] = M[row];
      M[row] = tmp;
      const tb = b[sel];
      b[sel] = b[row];
      b[row] = tb;
    }
    pivotCol[row] = col;
    for (let r2 = row + 1; r2 < n; r2++) {
      if (M[r2][col] === 1) {
        for (let c2 = col; c2 < n; c2++) M[r2][c2] ^= M[row][c2];
        b[r2] ^= b[row];
      }
    }
    row++;
  }
  for (let r2 = row; r2 < n; r2++) {
    let allZero = true;
    for (let c2 = 0; c2 < n; c2++) {
      if (M[r2][c2] === 1) {
        allZero = false;
        break;
      }
    }
    if (allZero && b[r2] === 1) return null;
  }
  const x = new Uint8Array(n);
  for (let r2 = row - 1; r2 >= 0; r2--) {
    const col = pivotCol[r2];
    if (col < 0) continue;
    let sum = 0;
    for (let c2 = col + 1; c2 < n; c2++) sum ^= M[r2][c2] & x[c2];
    x[col] = b[r2] ^ sum;
  }
  return x;
}

// Events
boardEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tile");
  if (!btn) return;
  unhighlightAll();

  const i = Number(btn.dataset.index);
  applyMove(i);
  pushMove(i);
  moves += 1;
  render();

  if (isWin()) {
    statusEl.textContent = "You solved it! 🎉";
    disableControls();
    stopTimer();
    if (bestMoves == null || moves < bestMoves) saveBestMoves(moves);
    if (bestTime == null || elapsed < bestTime) saveBestTime(elapsed);
  } else {
    statusEl.textContent = "";
  }
});

// Keyboard: Space/Enter toggles, arrow keys move focus
boardEl.addEventListener("keydown", (e) => {
  const btn = e.target.closest(".tile");
  if (!btn) return;
  unhighlightAll();

  const i = Number(btn.dataset.index);
  const r = Math.floor(i / size),
    c = i % size;

  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    btn.click();
    return;
  }

  let target = null;
  if (e.key === "ArrowUp" && r > 0) target = idx(r - 1, c);
  else if (e.key === "ArrowDown" && r < size - 1) target = idx(r + 1, c);
  else if (e.key === "ArrowLeft" && c > 0) target = idx(r, c - 1);
  else if (e.key === "ArrowRight" && c < size - 1) target = idx(r, c + 1);

  if (target != null) {
    e.preventDefault();
    const next = boardEl.querySelector(`.tile[data-index="${target}"]`);
    next?.focus();
  }
});

newBtn.addEventListener("click", () => {
  loadBests();
  shuffle();
});

sizeSelect.addEventListener("change", () => {
  size = Number(sizeSelect.value);
  buildMatrix();
  loadBests();
  shuffle();
});

hintBtn.addEventListener("click", () => {
  unhighlightAll();
  if (isWin()) return;
  const x = solvePresses();
  if (!x) return;
  const n = size * size;
  let pick = -1;
  for (let i = 0; i < n; i++) {
    if (x[i] === 1) {
      pick = i;
      break;
    }
  }
  if (pick === -1) return;
  const target = boardEl.querySelector(`.tile[data-index="${pick}"]`);
  if (!target) return;

  if (autoHintEl?.checked) {
    target.click(); // auto-play the suggested move
  } else {
    target.classList.add("highlight");
    target.focus();
  }
});

undoBtn.addEventListener("click", () => {
  if (ptr < 0) return;
  const i = history[ptr];
  applyMove(i); // same move undoes it (self-inverse)
  ptr -= 1;
  moves = Math.max(0, moves - 1);
  statusEl.textContent = "";
  render();
});

redoBtn.addEventListener("click", () => {
  if (ptr >= history.length - 1) return;
  const i = history[ptr + 1];
  applyMove(i);
  ptr += 1;
  moves += 1;
  statusEl.textContent = "";
  render();
});

function init() {
  // Theme
  const storedTheme = localStorage.getItem("isDarkTheme");
  if (storedTheme === "true") document.body.classList.add("dark");

  // Populate size options 3–7
  const sizes = [3, 4, 5, 6, 7];
  sizeSelect.innerHTML = sizes
    .map(
      (n) =>
        `<option value="${n}" ${
          n === size ? "selected" : ""
        }>${n}×${n}</option>`
    )
    .join("");

  buildMatrix();
  loadBests();
  shuffle();
}

init();

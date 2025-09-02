// UI elements
const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const bestMovesEl = document.getElementById("best-moves");
const statusEl = document.getElementById("status");
const newBtn = document.getElementById("new");
const sizeSelect = document.getElementById("size");
const themeBtn = document.getElementById("theme");
const hintBtn = document.getElementById("hint");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");

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

// Best moves per size
let bestMoves = null;
function bestKey() {
  return `bestMoves-${size}`;
}
function loadBestMoves() {
  const v = localStorage.getItem(bestKey());
  bestMoves = v != null ? parseInt(v, 10) : null;
}
function saveBestMoves(n) {
  bestMoves = n;
  localStorage.setItem(bestKey(), String(n));
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
  bestMovesEl.textContent = bestMoves == null ? "–" : String(bestMoves);

  // Fit board to viewport after DOM updates
  requestAnimationFrame(resizeBoardToViewport);
}

function resizeBoardToViewport() {
  // Compute the largest square we can fit without scrolling:
  // limited by parent width and remaining viewport height below the board's top.
  const rect = boardEl.getBoundingClientRect();
  const availableHeight = Math.max(0, window.innerHeight - rect.top - 16); // 16px breathing room
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
}

// History push (trims redo)
function pushMove(i) {
  if (ptr < history.length - 1) history = history.slice(0, ptr + 1);
  history.push(i);
  ptr += 1;
}

// Solver (Gaussian elimination over GF(2))
let A = null; // coefficient matrix for current size (N^2 x N^2), A[row][col] in {0,1}

function buildMatrix() {
  const n = size * size;
  A = Array.from({ length: n }, () => new Uint8Array(n));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const j = idx(r, c); // column = press at (r,c)
      // Press toggles itself and 4-neighbors
      const cells = [
        [r, c],
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      for (const [rr, cc] of cells) {
        if (inBounds(rr, cc)) {
          const i = idx(rr, cc); // row = affected cell
          A[i][j] = 1;
        }
      }
    }
  }
}

function solvePresses() {
  // Solve A x = b (mod 2), where b = current state (1=ON)
  // Returns one solution vector x (0/1) of length n, or null if none (shouldn't happen for our shuffles).
  const n = size * size;
  // Copy A and build augmented vector b
  const M = Array.from({ length: n }, (_, r) => Uint8Array.from(A[r]));
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = state[i] ? 1 : 0;

  let row = 0;
  const pivotCol = new Int16Array(n).fill(-1);
  for (let col = 0; col < n && row < n; col++) {
    // find pivot
    let sel = row;
    while (sel < n && M[sel][col] === 0) sel++;
    if (sel === n) continue;
    // swap rows
    if (sel !== row) {
      const tmp = M[sel];
      M[sel] = M[row];
      M[row] = tmp;
      const tb = b[sel];
      b[sel] = b[row];
      b[row] = tb;
    }
    pivotCol[row] = col;
    // eliminate below
    for (let r2 = row + 1; r2 < n; r2++) {
      if (M[r2][col] === 1) {
        for (let c2 = col; c2 < n; c2++) M[r2][c2] ^= M[row][c2];
        b[r2] ^= b[row];
      }
    }
    row++;
  }
  // check inconsistency (0 ... 0 | 1)
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
  // back substitution (free vars assumed 0)
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
    if (bestMoves == null || moves < bestMoves) {
      saveBestMoves(moves);
      render();
    }
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
    btn.click(); // delegates to click handler (updates history/moves/render)
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
  loadBestMoves();
  shuffle();
});

sizeSelect.addEventListener("change", () => {
  size = Number(sizeSelect.value);
  buildMatrix();
  loadBestMoves();
  shuffle();
});

hintBtn.addEventListener("click", () => {
  unhighlightAll();
  if (isWin()) return;
  const x = solvePresses();
  if (!x) return; // should not happen for our generated boards
  const n = size * size;
  // pick the first suggested press from the solution
  let pick = -1;
  for (let i = 0; i < n; i++) {
    if (x[i] === 1) {
      pick = i;
      break;
    }
  }
  if (pick === -1) return;
  const target = boardEl.querySelector(`.tile[data-index="${pick}"]`);
  target?.classList.add("highlight");
  target?.focus();
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
  loadBestMoves();
  shuffle();
}

init();

// UI elements
const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const statusEl = document.getElementById("status");
const newBtn = document.getElementById("new");
const sizeSelect = document.getElementById("size");
const themeBtn = document.getElementById("theme");

// Theme toggle
themeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

// Game state
let size = 5; // board size N (NxN)
let state = []; // flat array of booleans; true = ON, false = OFF
let moves = 0;

function idx(r, c) {
  return r * size + c;
}
function inBounds(r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function toggle(i) {
  state[i] = !state[i];
}

function applyMove(i) {
  // Toggle clicked cell + orthogonal neighbors
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
  // Win when all lights are OFF
  return state.every((v) => !v);
}

function render() {
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.innerHTML = "";

  for (let i = 0; i < size * size; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tile${state[i] ? " on" : ""}`;
    btn.dataset.index = String(i);
    // ARIA: treat tiles as toggles to announce ON/OFF
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
}

function shuffle() {
  // Start from solved; apply random valid moves so it's solvable
  state = new Array(size * size).fill(false);
  const shuffleMoves = size * size * 3; // plenty of randomness
  for (let k = 0; k < shuffleMoves; k++) {
    const i = Math.floor(Math.random() * state.length);
    applyMove(i);
  }
  moves = 0;
  statusEl.textContent = "";
  render();
}

function disableBoard() {
  for (let index = 0; index < boardEl.children.length; index++) {
    boardEl.children[index].disabled = true;
  }
}

// Events
boardEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tile");
  if (!btn) return;
  const i = Number(btn.dataset.index);
  applyMove(i);
  moves += 1;
  render();
  if (isWin()) {
    statusEl.textContent = "You solved it! 🎉";
    disableBoard();
  } else {
    statusEl.textContent = "";
  }
});

// Keyboard: Space/Enter toggles, arrow keys move focus
boardEl.addEventListener("keydown", (e) => {
  const btn = e.target.closest(".tile");
  if (!btn) return;

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

newBtn.addEventListener("click", shuffle);

sizeSelect.addEventListener("change", () => {
  size = Number(sizeSelect.value);
  shuffle();
});

function init() {
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

  shuffle(); // sets state and renders
}

init();

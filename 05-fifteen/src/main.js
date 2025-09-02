import "./style.css";

// Elements
const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const bestMovesEl = document.getElementById("best-moves");
const timeEl = document.getElementById("time");
const bestTimeEl = document.getElementById("best-time");
const statusEl = document.getElementById("status");
const newBtn = document.getElementById("new");
const sizeSelect = document.getElementById("size");
const themeBtn = document.getElementById("theme");

// Theme persistence
const storedTheme = localStorage.getItem("isDarkTheme");
if (storedTheme === "true") document.body.classList.add("dark");
themeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("isDarkTheme", document.body.classList.contains("dark"));
});

// State
let size = Number(sizeSelect.value || 4);
let tiles = []; // numbers 1..n^2-1 with 0 as empty
let moves = 0;

// Timer
let startTime = 0;
let elapsed = 0;
let timerId = null;
function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms));
  const tenths = Math.floor((total % 1000) / 100);
  const secs = Math.floor(total / 1000) % 60;
  const mins = Math.floor(total / 60000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}
function startTimer() {
  clearInterval(timerId);
  startTime = performance.now();
  elapsed = 0;
  timeEl.textContent = formatTime(elapsed);
  timerId = setInterval(() => {
    elapsed = performance.now() - startTime;
    timeEl.textContent = formatTime(elapsed);
  }, 100);
}
function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

// Best stats (per size)
function bestMovesKey() {
  return `15p-bestMoves-${size}`;
}
function bestTimeKey() {
  return `15p-bestTime-${size}`;
}
function loadBests() {
  const mv = localStorage.getItem(bestMovesKey());
  const tm = localStorage.getItem(bestTimeKey());
  bestMovesEl.textContent = mv != null ? String(parseInt(mv, 10)) : "–";
  bestTimeEl.textContent = tm != null ? formatTime(parseInt(tm, 10)) : "–";
}
function saveBestMoves(n) {
  localStorage.setItem(bestMovesKey(), String(n));
  bestMovesEl.textContent = String(n);
}
function saveBestTime(ms) {
  localStorage.setItem(bestTimeKey(), String(ms));
  bestTimeEl.textContent = formatTime(ms);
}

// Helpers
function indexToRC(i) {
  return { r: Math.floor(i / size), c: i % size };
}
function rcToIndex(r, c) {
  return r * size + c;
}
function findEmpty() {
  return tiles.indexOf(0);
}
function isSolved() {
  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] !== i + 1) return false;
  }
  return tiles[tiles.length - 1] === 0;
}
function inversions(arr) {
  let inv = 0;
  const a = arr.filter((v) => v !== 0);
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (a[i] > a[j]) inv++;
    }
  }
  return inv;
}
function blankRowFromBottom(arr) {
  const idx = arr.indexOf(0);
  const rowFromTop = Math.floor(idx / size); // 0-based
  return size - rowFromTop; // 1-based from bottom
}
function isSolvable(arr) {
  const inv = inversions(arr);
  if (size % 2 === 1) {
    // odd grid: inversions must be even
    return inv % 2 === 0;
  } else {
    // even grid: blank row from bottom parity matters
    const blankFromBottom = blankRowFromBottom(arr);
    if (blankFromBottom % 2 === 0) {
      // blank on even row from bottom => inversions must be odd
      return inv % 2 === 1;
    } else {
      // blank on odd row from bottom => inversions must be even
      return inv % 2 === 0;
    }
  }
}
function isSolvedArray(arr) {
  for (let i = 0; i < arr.length - 1; i++) if (arr[i] !== i + 1) return false;
  return arr[arr.length - 1] === 0;
}
function shuffledSolvableTiles() {
  const n = size * size;
  const arr = Array.from({ length: n }, (_, i) => (i + 1) % n); // [1..n-1, 0]
  // Fisher–Yates shuffle until solvable and not solved
  do {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  } while (!isSolvable(arr) || isSolvedArray(arr));
  return arr;
}
function canSlide(tileIndex, emptyIndex) {
  const { r: tr, c: tc } = indexToRC(tileIndex);
  const { r: er, c: ec } = indexToRC(emptyIndex);
  const dr = Math.abs(tr - er);
  const dc = Math.abs(tc - ec);
  return dr + dc === 1; // adjacent
}
function slide(tileIndex) {
  const emptyIndex = findEmpty();
  if (tiles[tileIndex] === 0) return false;
  if (!canSlide(tileIndex, emptyIndex)) return false;
  [tiles[tileIndex], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[tileIndex]];
  return true;
}

// Render + sizing
function render() {
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.innerHTML = "";
  for (let i = 0; i < size * size; i++) {
    const val = tiles[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile";
    btn.dataset.index = String(i);
    if (val === 0) {
      btn.classList.add("is-empty");
      btn.setAttribute("aria-label", "Empty");
      btn.textContent = "";
    } else {
      btn.textContent = String(val);
      btn.setAttribute("aria-label", `Tile ${val}`);
    }
    boardEl.appendChild(btn);
  }
  movesEl.textContent = String(moves);

  // Fit board to viewport after DOM updates
  requestAnimationFrame(resizeBoardToViewport);
}

// Size the board to fit the viewport (call sparingly)
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

function unhighlightAll() {
  for (const el of boardEl.querySelectorAll(".tile.highlight")) {
    el.classList.remove("highlight");
  }
}

// Game control
function newGame() {
  tiles = shuffledSolvableTiles();
  moves = 0;
  statusEl.textContent = "";
  render();
  stopTimer();
  startTimer();
  loadBests();
  // Do not focus the board automatically; avoids scroll + default ring
  // After first render, size it once
  // // requestAnimationFrame(resizeBoardToViewport);
}

// Events
newBtn.addEventListener("click", newGame);
sizeSelect.addEventListener("change", () => {
  size = Number(sizeSelect.value);
  newGame();
});

function disableTiles() {
  for (const el of boardEl.querySelectorAll(".tile")) {
    el.disabled = true;
  }
}

boardEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tile");
  if (!btn) return;
  unhighlightAll();
  const i = Number(btn.dataset.index);
  if (slide(i)) {
    moves += 1;
    render();
    if (isSolved()) {
      disableTiles();
      statusEl.textContent = "You solved it! 🎉";
      stopTimer();
      const currentBestMoves = localStorage.getItem(bestMovesKey());
      if (currentBestMoves == null || moves < parseInt(currentBestMoves, 10)) {
        saveBestMoves(moves);
      }
      const currentBestTime = localStorage.getItem(bestTimeKey());
      if (currentBestTime == null || elapsed < parseInt(currentBestTime, 10)) {
        saveBestTime(elapsed);
      }
    } else {
      statusEl.textContent = "";
    }
  }
});

boardEl.addEventListener("keydown", (e) => {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const active = document.activeElement;
  const insideBoard = active && typeof active.closest === "function" && active.closest("#board");
  if (!insideBoard) return;

  const empty = findEmpty();
  const { r, c } = indexToRC(empty);
  let target = null;
  if (e.key === "ArrowUp" && r < size - 1) target = rcToIndex(r + 1, c);
  else if (e.key === "ArrowDown" && r > 0) target = rcToIndex(r - 1, c);
  else if (e.key === "ArrowLeft" && c < size - 1) target = rcToIndex(r, c + 1);
  else if (e.key === "ArrowRight" && c > 0) target = rcToIndex(r, c - 1);

  if (target != null) {
    e.preventDefault();
    if (slide(target)) {
      moves += 1;
      render();
      if (isSolved()) {
        disableTiles();
        statusEl.textContent = "You solved it! 🎉";
        stopTimer();
        const mv = localStorage.getItem(bestMovesKey());
        if (mv == null || moves < parseInt(mv, 10)) saveBestMoves(moves);
        const tm = localStorage.getItem(bestTimeKey());
        if (tm == null || elapsed < parseInt(tm, 10)) saveBestTime(elapsed);
      } else {
        statusEl.textContent = "";
      }
    }
  }
});

// Init
newGame();

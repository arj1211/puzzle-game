import "./style.css";

// Basic theme toggle and board sizing, plus a placeholder render.
// Next module: implement 15 Puzzle logic.

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

// Board state (placeholder)
let size = Number(sizeSelect.value || 4);
let tiles = []; // array of numbers 1..(n*n-1) plus 0 for empty
let moves = 0;

// Timer placeholders
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

function resizeBoardToViewport() {
  const rect = boardEl.getBoundingClientRect();
  const availableHeight = Math.max(0, window.innerHeight - rect.top - 16);
  const parent = boardEl.parentElement;
  const availableWidth = parent ? parent.clientWidth : rect.width;
  const side = Math.floor(Math.min(availableWidth, availableHeight));
  boardEl.style.width = side + "px";
  boardEl.style.height = side + "px";
}
window.addEventListener("resize", () => requestAnimationFrame(resizeBoardToViewport));

function render() {
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  boardEl.innerHTML = "";
  for (let i = 0; i < size * size; i++) {
    const val = tiles[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile";
    btn.dataset.index = String(i);
    if (val === 0) btn.classList.add("is-empty");
    btn.textContent = val === 0 ? "" : String(val);
    boardEl.appendChild(btn);
  }
  movesEl.textContent = String(moves);
  requestAnimationFrame(resizeBoardToViewport);
}

// Temporary: generate a solved board with the empty at the end
function resetBoard() {
  tiles = [];
  for (let v = 1; v < size * size; v++) tiles.push(v);
  tiles.push(0);
  moves = 0;
  render();
  stopTimer();
  startTimer();
}

newBtn.addEventListener("click", resetBoard);
sizeSelect.addEventListener("change", () => {
  size = Number(sizeSelect.value);
  resetBoard();
});

// Click handler placeholder (no real moves yet)
boardEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tile");
  if (!btn) return;
  // Next module: implement slide if clicked tile is adjacent to empty
});

resetBoard();

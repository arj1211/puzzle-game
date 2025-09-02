// A tiny script to verify JS is wired up and to preview basic DOM updates.
let count = 0;

const statusEl = document.querySelector("#status");
const btn = document.querySelector("#btn");
const themeBtn = document.querySelector("#theme");

function render() {
  statusEl.textContent = `Clicked ${count} time${count === 1 ? "" : "s"}.`;
}

btn.addEventListener("click", () => {
  count += 1;
  render();
});

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

render();
console.log("Hello from main.js");

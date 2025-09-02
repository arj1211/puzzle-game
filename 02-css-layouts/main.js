// Toggle theme (supports multiple buttons with id="theme" on a page)
const themeButtons = document.querySelectorAll("#theme");
themeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });
});

// Toggle .selected on tiles (ignore disabled tiles)
document.addEventListener("click", (e) => {
  const tile = e.target.closest(".tile");
  if (!tile) return;
  if (tile.matches(":disabled")) return;
  tile.classList.toggle("selected");
});

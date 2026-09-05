const canvas = document.getElementById("game-canvas");
let game;
function showBootError(error) {
  console.error("Pepsiman Runner:", error);
  const el = document.getElementById("boot-error");
  el.classList.remove("hidden");
  el.textContent =
    "The game could not start. Check that hardware acceleration is enabled in your browser, then try again.";
  const button = document.createElement("button");
  button.textContent = "Try again";
  button.onclick = () => location.reload();
  el.appendChild(button);
  const start = document.getElementById("btn-start");
  start.disabled = true;
  document.getElementById("start-label").textContent = "Unable to start";
}
import("./game/Game.js")
  .then(({ Game }) => {
    game = new Game(canvas);
    window.__pepsimanGame = game;
  })
  .catch(showBootError);
if (import.meta.hot) import.meta.hot.dispose(() => game?.dispose());

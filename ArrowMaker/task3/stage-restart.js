(() => {
  "use strict";

  const chip = document.querySelector(".stage-chip");
  const controls = document.createElement("div");
  controls.className = "stage-controls";
  chip.before(controls);
  controls.appendChild(chip);

  const button = document.createElement("button");
  button.className = "stage-restart";
  button.type = "button";
  button.textContent = "처음 단계부터";
  controls.appendChild(button);

  button.addEventListener("click", () => {
    try {
      localStorage.removeItem("savedStageFile");
    } catch (error) {
      console.error("저장된 단계를 초기화하지 못했습니다.", error);
      window.alert("저장된 단계를 초기화하지 못했습니다. 다시 시도해주세요.");
      return;
    }
    window.top.location.href = new URL("arrowgame.html", window.location.href).href;
  });
})();

"use strict";

class StageUI {
  constructor(reducedMotion) {
    this.reducedMotion = reducedMotion;
    this.dialog = document.getElementById("stage-intro-dialog");
    this.card = this.dialog.querySelector(".stage-intro-card");
    this.confirm = document.getElementById("stage-intro-confirm");
    this.track = document.getElementById("stage-progress-track");
    this.items = [];
    const container = document.getElementById("stage-progress-items");
    for (let index = 1; index <= 14; index++) {
      const item = document.createElement("div");
      item.className = "stage-progress-item";
      item.setAttribute("role", "progressbar");
      item.setAttribute("aria-label", `${index}단계`);
      item.setAttribute("aria-valuemin", "0");
      item.setAttribute("aria-valuemax", "100");
      item.setAttribute("aria-valuenow", "0");
      item.textContent = String(index);
      container.appendChild(item);
      this.items.push(item);
    }
    this.dialog.addEventListener("cancel", event => event.preventDefault());
    this.confirm.addEventListener("click", () => this.confirmIntro());
    this.layoutObserver = new ResizeObserver(() => this.scheduleLayout());
    for (const selector of [".hud-header", ".hud-bottom", ".winding-info", ".continuation-header", ".continuation-progress", "#stage-progress-track"]) {
      document.querySelectorAll(selector).forEach(element => this.layoutObserver.observe(element));
    }
    window.addEventListener("resize", () => this.scheduleLayout());
  }

  scheduleLayout() {
    if (this.layoutFrame) return;
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = null;
      const early = !document.getElementById("stage-panel").hidden;
      const header = document.querySelector(early ? ".hud-header" : ".continuation-header");
      if (this.track.hidden || !header.getClientRects().length) return;
      const headerBottom = header.getBoundingClientRect().bottom;
      const trackTop = headerBottom + 8;
      const trackHeight = this.track.getBoundingClientRect().height;
      const root = document.documentElement.style;
      root.setProperty("--progress-top", `${trackTop}px`);
      root.setProperty("--controls-gap", `${trackHeight + 16}px`);
      root.setProperty("--guide-top", `${trackTop + trackHeight + 8}px`);
      root.setProperty("--winding-info-height", `${document.getElementById("winding-info").getBoundingClientRect().height}px`);
      const bottom = document.querySelector(early ? ".hud-bottom" : "#continuation-progress").getBoundingClientRect().top;
      root.setProperty("--guide-max-height", `${Math.max(44, bottom - trackTop - trackHeight - 16)}px`);
    });
  }

  showIntro(number, title, description, rule, target, onConfirm) {
    if (this.dialog.open) throw new Error("이전 단계 안내가 아직 열려 있습니다.");
    document.getElementById("stage-intro-step").textContent = `STEP ${String(number).padStart(2, "0")} / 14`;
    document.getElementById("stage-intro-title").textContent = title;
    document.getElementById("stage-intro-description").textContent = description;
    const ruleElement = document.getElementById("stage-intro-rule");
    ruleElement.textContent = rule;
    ruleElement.hidden = !rule;
    this.target = target;
    this.onConfirm = onConfirm;
    this.confirm.disabled = false;
    this.scheduleLayout();
    this.dialog.showModal();
    this.confirm.focus();
  }

  confirmIntro() {
    if (this.confirm.disabled) return;
    this.confirm.disabled = true;
    const finish = () => {
      this.dialog.close();
      const callback = this.onConfirm;
      this.onConfirm = null;
      callback();
    };
    if (this.reducedMotion.matches) { finish(); return; }
    const from = this.card.getBoundingClientRect();
    const to = this.target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = Math.min(to.width / from.width, to.height / from.height, 0.6);
    const animation = this.card.animate([
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 }
    ], { duration: 280, easing: "ease-in-out" });
    animation.onfinish = finish;
  }

  updateProgress(current, completed, progress = 0) {
    const wasHidden = this.track.hidden;
    this.track.hidden = false;
    if (wasHidden) this.scheduleLayout();
    const key = `${current}:${completed}:${Math.floor(progress)}`;
    if (!wasHidden && this.progressKey === key) return;
    this.progressKey = key;
    this.items.forEach((item, index) => {
      const isCurrent = index + 1 === current;
      const value = index < completed ? 100 : isCurrent ? Math.max(0, Math.min(100, Math.floor(progress))) : 0;
      item.style.setProperty("--fill", `${value}%`);
      item.setAttribute("aria-valuenow", String(value));
      item.classList.toggle("completed", index < completed);
      if (isCurrent) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
  }

  showPraise(score) {
    const label = score >= 95 ? "Perfect!" : score >= 80 ? "Good!" : "";
    if (!label) return;
    clearTimeout(this.praiseTimer);
    for (const sticker of document.querySelectorAll(".praise-sticker")) {
      sticker.textContent = label;
      sticker.classList.remove("show", "perfect");
      void sticker.offsetWidth;
      sticker.classList.toggle("perfect", label === "Perfect!");
      sticker.classList.add("show");
    }
    this.praiseTimer = setTimeout(() => {
      document.querySelectorAll(".praise-sticker").forEach(sticker => sticker.classList.remove("show"));
    }, 1600);
  }
}

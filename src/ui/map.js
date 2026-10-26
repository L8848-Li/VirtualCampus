(function (root) {
  const anchors = [
    { x: 17, y: 24 },
    { x: 50, y: 24 },
    { x: 24, y: 79 },
    { x: 83, y: 24 },
    { x: 77, y: 79 },
  ];
  const buildings = [
    { cls: "dorm", title: "梧桐宿舍", sub: "DORMITORY", icon: "⌂" },
    { cls: "classroom", title: "明理教学楼", sub: "CLASSROOM", icon: "▦" },
    { cls: "canteen", title: "一日食堂", sub: "CANTEEN", icon: "♨" },
    { cls: "library", title: "知秋图书馆", sub: "LIBRARY", icon: "▤" },
    { cls: "club", title: "有光社团中心", sub: "CLUB HOUSE", icon: "✧" },
  ];
  function personSvg(id) {
    const p = Campus.profiles[id];
    return `<svg viewBox="0 0 40 48" aria-hidden="true"><ellipse cx="20" cy="45" rx="12" ry="3" fill="#263d3720"/><path d="M7 41V30Q7 23 20 23Q33 23 33 30V41Z" fill="${p.color}"/><path d="M14 40V45M26 40V45" stroke="#354f48" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="15" r="11" fill="#f0d7b7"/><path d="M9 15Q7 2 20 3Q34 3 31 16L27 10Q19 13 13 9Z" fill="${id % 3 === 0 ? "#5e4c43" : id % 3 === 1 ? "#374c48" : "#7e6254"}"/><path d="M16 16h.1M24 16h.1" stroke="#35443e" stroke-width="2.4" stroke-linecap="round"/><path d="M18 21q2 2 4 0" fill="none" stroke="#af7566" stroke-width="1"/></svg>`;
  }
  class MapView {
    constructor(element) {
      this.element = element;
      this.positions = new Map();
      this.lastTick = -1;
      element.innerHTML = `<div class="campus-ground"><svg class="campus-paths" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><path d="M170 150V345H830V150M500 150V345M240 345V500M770 345V500"/></svg><div class="quad"><span>✳</span><small>梧桐广场</small></div><div class="tree t1">♣</div><div class="tree t2">♣</div><div class="tree t3">♣</div><div class="tree t4">♣</div>${buildings.map((b, i) => `<section class="campus-building ${b.cls}"><div class="roof"><span>${b.icon} ${b.title}</span><small id="occupancy-${i}"></small></div><div class="building-floor"><span class="building-sub">${b.sub}</span><div class="furniture"><i></i><i></i><i></i></div></div></section>`).join("")}<div class="map-people"></div><div class="follow-bubble" id="follow-bubble" hidden></div></div>`;
      this.people = element.querySelector(".map-people");
      for (const n of Campus.profiles.map((p, id) => ({ ...p, id }))) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "map-person";
        button.dataset.person = n.id;
        button.style.setProperty("--c", n.color);
        button.innerHTML = `${personSvg(n.id)}<span class="person-name">${n.name}</span><small class="person-mood"></small>`;
        this.people.append(button);
      }
    }
    render(world, selected, watched, follow, duration = 650) {
      const scene = world.tick ? (world.tick - 1) % 4 : 0;
      this.element.dataset.scene = ["morning", "noon", "afternoon", "night"][
        scene
      ];
      for (let loc = 0; loc < 5; loc++) {
        const occupants = world.npcs.filter((n) => n.loc === loc);
        this.element.querySelector(`#occupancy-${loc}`).textContent =
          `${occupants.length} 人`;
        occupants.forEach((n, index) => {
          const button = this.people.children[n.id];
          const anchor = anchors[loc];
          const next = {
            x: anchor.x + ((index % 5) - 2) * 4.1,
            y: anchor.y + Math.floor(index / 5) * 10,
          };
          const previous = this.positions.get(n.id);
          button.style.left = `${next.x}%`;
          button.style.top = `${next.y}%`;
          button.classList.toggle("selected", n.id === selected);
          button.classList.toggle("watched", watched.includes(n.id));
          button.classList.toggle("followed", follow && n.id === selected);
          button.setAttribute(
            "aria-label",
            `查看${n.name}，${Campus.places[n.loc]}，${n.action}`,
          );
          button.setAttribute("aria-pressed", String(n.id === selected));
          button.title = `${n.name} · ${n.action} · ${n.interaction}`;
          button.querySelector(".person-mood").textContent =
            n.interaction.includes("尴尬")
              ? "…"
              : n.intent
                ? "↗"
                : n.action === "休息"
                  ? "z"
                  : n.loc === 2
                    ? "♨"
                    : n.loc === 3
                      ? "▤"
                      : "·";
          if (
            this.lastTick !== world.tick &&
            previous &&
            (Math.abs(previous.x - next.x) > 8 ||
              Math.abs(previous.y - next.y) > 12) &&
            !matchMedia("(prefers-reduced-motion: reduce)").matches &&
            button.animate
          ) {
            button.getAnimations().forEach((a) => a.cancel());
            button.animate(
              [
                { left: `${previous.x}%`, top: `${previous.y}%` },
                { left: `${previous.x}%`, top: "57%" },
                { left: `${next.x}%`, top: "57%" },
                { left: `${next.x}%`, top: `${next.y}%` },
              ],
              { duration, easing: "ease-in-out" },
            );
          }
          this.positions.set(n.id, next);
        });
      }
      const bubble = this.element.querySelector("#follow-bubble");
      bubble.hidden = !follow;
      bubble.textContent = `◎ 跟随 ${world.npcs[selected].name} · ${world.npcs[selected].interaction}`;
      this.lastTick = world.tick;
    }
  }
  root.CampusMap = { MapView, personSvg };
})(window);

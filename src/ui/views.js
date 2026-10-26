(function (root) {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const clock = (tick) =>
    `第 ${Math.min(7, Math.floor(tick / 4) + 1)} 天 · ${Campus.slots[tick % 4]}`;
  const labels = {
    friendship: "新默契",
    crush: "心动",
    misunderstanding: "误解",
    repair: "澄清",
    rivalry: "竞争",
    invitation: "邀约",
    accepted: "接受",
    declined: "婉拒",
    missed: "擦肩",
    action: "日常",
    intervention: "环境",
    summary: "手记",
    system: "开始",
  };
  function portrait(n) {
    return `<span class="portrait" style="--c:${Campus.profiles[n.id].color}">${CampusMap.personSvg(n.id)}</span>`;
  }
  function relationLabel(r) {
    return r.crush > 0
      ? "悄悄在意"
      : r.aff < -6
        ? "有些紧张"
        : r.aff >= 25
          ? "越来越亲近"
          : r.aff > 0
            ? "渐渐熟悉"
            : "尚待相识";
  }
  function profile(world, selected, watched) {
    const n = world.npcs[selected];
    const relationships = n.rel
      .map((r, i) => ({ r, i }))
      .filter((x) => x.i !== n.id)
      .sort(
        (a, b) => Math.abs(b.r.aff) + b.r.crush - Math.abs(a.r.aff) - a.r.crush,
      )
      .slice(0, 3);
    return `<div class="identity">${portrait(n)}<div><span class="eyebrow">${n.role}</span><h3>${n.name}</h3><p>${Campus.places[n.loc]} · ${n.action}</p></div><button class="watch-button ${watched.includes(n.id) ? "active" : ""}" data-watch="${n.id}" aria-label="${watched.includes(n.id) ? "取消关注" : "关注"}${n.name}">${watched.includes(n.id) ? "★" : "☆"}</button></div><div class="tags"><span>${n.interest}</span><span>${n.ext > 0.55 ? "外向" : "慢热"}</span><span>${n.sensitive > 0.6 ? "细腻" : "豁达"}</span></div><p class="quirk">“${n.quirk}。”</p><div class="thought"><small>此刻为什么这么做</small><p>${esc(n.why)}</p><strong>${esc(n.interaction)}</strong></div><div class="needs">${[
      ["精力", n.energy, "energy"],
      ["饥饿", n.hunger, "hunger"],
      ["社交需求", n.social, "social"],
    ]
      .map(
        ([key, value, cls]) =>
          `<div class="stat"><span>${key}</span><div class="bar ${cls}"><i style="width:${value}%"></i></div><b>${Math.round(value)}</b></div>`,
      )
      .join(
        "",
      )}</div><div class="minor-stats"><span>目标 ${n.goal}</span><span>学业 ${n.progress}</span><span>宿舍 ${world.rooms[n.id] + 1} · 小组 ${world.groups[n.id] + 1}</span></div><h4>关系近况</h4>${relationships.map(({ r, i }) => `<button class="relationship-row" data-person="${i}"><span>${world.npcs[i].name}</span><small>${relationLabel(r)}</small><b>${r.aff > 0 ? "+" : ""}${r.aff}</b></button>`).join("")}<h4>记得的片段 <small>按重要程度保留 · 最多 8 条</small></h4><div class="memory-list">${
      n.memory
        .map((id) => {
          const e = world.events[id - 1];
          return `<button class="memory" data-event="${id}"><small>${clock(e.tick)} · ${labels[e.type]}</small><span>${esc(e.text)}</span></button>`;
        })
        .join("") || '<p class="empty">还在等第一次相遇。</p>'
    }</div><details class="knowledge"><summary>TA 最近亲眼见到的人</summary>${
      Object.entries(n.known)
        .filter(([, k]) => world.tick - k.tick <= 4)
        .map(
          ([id, k]) =>
            `<p>${world.npcs[id].name} · ${Campus.places[k.loc]}<small>${clock(k.tick)}${k.missed ? " · 再去时已不在" : ""}</small></p>`,
        )
        .join("") || "<p>还没有新的目击。</p>"
    }</details>`;
  }
  function roster(world, selected) {
    return world.npcs
      .map(
        (n) =>
          `<button class="roster-person ${selected === n.id ? "selected" : ""}" data-person="${n.id}" aria-label="选择${n.name}" aria-pressed="${selected === n.id}">${portrait(n)}<span>${n.name}<small>${Campus.places[n.loc]}</small></span></button>`,
      )
      .join("");
  }
  function graph(world, selected, direction) {
    const center = world.npcs[selected];
    const others = world.npcs.filter((n) => n.id !== selected);
    let edges = "",
      nodes = "";
    const rows = [];
    others.forEach((n, i) => {
      const angle = (i * Math.PI * 2) / 9 - Math.PI / 2,
        x = 175 + Math.cos(angle) * 116,
        y = 145 + Math.sin(angle) * 105;
      const r = direction === "out" ? center.rel[n.id] : n.rel[selected];
      const color =
        r.crush > 0
          ? "#bf8198"
          : r.aff < 0
            ? "#b57d68"
            : r.aff > 0
              ? "#68977d"
              : "#d6dece";
      const width = 1 + Math.min(4, Math.abs(r.aff) / 15 + r.crush / 20);
      const x1 = direction === "out" ? 175 : x,
        y1 = direction === "out" ? 145 : y,
        x2 = direction === "out" ? x : 175,
        y2 = direction === "out" ? y : 145;
      const distance = Math.hypot(x2 - x1, y2 - y1),
        ux = (x2 - x1) / distance,
        uy = (y2 - y1) / distance;
      const startRadius = direction === "out" ? 31 : 20,
        endRadius = direction === "out" ? 22 : 33;
      const sx = x1 + ux * startRadius,
        sy = y1 + uy * startRadius,
        tx = x2 - ux * endRadius,
        ty = y2 - uy * endRadius;
      edges += `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="${width}" ${r.aff < 0 ? 'stroke-dasharray="4 4"' : ""}/><path d="M${tx} ${ty}L${tx - ux * 7 - uy * 3} ${ty - uy * 7 + ux * 3}L${tx - ux * 7 + uy * 3} ${ty - uy * 7 - ux * 3}Z" fill="${color}"/>`;
      nodes += `<g role="button" tabindex="0" data-person="${n.id}" aria-label="查看${n.name}的关系"><circle cx="${x}" cy="${y}" r="17" fill="${Campus.profiles[n.id].color}"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="white" font-size="11">${n.name.slice(-1)}</text><text x="${x}" y="${y + 32}" text-anchor="middle" fill="#52665b" font-size="10">${n.name}</text></g>`;
      if (r.aff || r.crush || r.trust) rows.push({ n, r });
    });
    return `<svg viewBox="0 0 350 300" class="relationship-graph" aria-label="${center.name}${direction === "out" ? "看待别人的关系" : "在别人眼中的关系"}">${edges}${nodes}<circle cx="175" cy="145" r="28" fill="${Campus.profiles[selected].color}"/><text x="175" y="149" text-anchor="middle" fill="white" font-size="12">${center.name}</text></svg><div class="graph-legend"><span>● 亲近</span><span>┄ 紧张</span><span>♡ 心动</span></div><div class="relation-values">${
      rows
        .sort(
          (a, b) =>
            Math.abs(b.r.aff) + b.r.crush - Math.abs(a.r.aff) - a.r.crush,
        )
        .slice(0, 5)
        .map(
          ({ n, r }) =>
            `<button data-person="${n.id}"><b>${n.name}</b><span>好感 ${r.aff} · 信任 ${r.trust} · 心动 ${r.crush}</span></button>`,
        )
        .join("") || '<p class="empty">第一段关系，正等待一次相遇。</p>'
    }</div>`;
  }
  function timeline(world, filter, selected, watched) {
    const events = world.events
      .filter(
        (e) =>
          filter === "all" ||
          (filter === "important" && e.importance >= 3) ||
          (filter === "selected" && e.people.includes(selected)) ||
          (filter === "watched" &&
            e.people.some((id) => watched.includes(id))) ||
          (filter === "stories" &&
            [
              "friendship",
              "crush",
              "misunderstanding",
              "repair",
              "rivalry",
              "invitation",
              "accepted",
              "declined",
              "missed",
            ].includes(e.type)),
      )
      .reverse();
    return (
      events
        .map(
          (e) =>
            `<article class="event type-${e.type}"><div class="event-stamp"><span>${labels[e.type] || e.type}</span><time>${e.type === "summary" ? `第 ${e.data.day} 天手记` : clock(e.tick)}</time></div><p>${esc(e.text)}</p><button class="text-button" data-event="${e.id}">为什么发生 ↗</button></article>`,
        )
        .join("") ||
      '<p class="empty">这里会留下值得留意的变化。先推进一个时段吧。</p>'
    );
  }
  function wall(world) {
    return (
      world.events
        .filter((e) => e.type === "summary")
        .reverse()
        .map(
          (e) =>
            `<article class="wallitem"><div class="eyebrow">DAY ${String(e.data.day).padStart(2, "0")} / 校园手记</div><h3>${e.data.counts.crushes ? "有些期待，藏在下一次见面里。" : e.data.counts.misunderstandings ? "有些话，还在等一个解释的机会。" : "普通的一天，也在慢慢靠近。"}</h3><p>${e.data.counts.meetings} 次交集 · ${e.data.counts.invitations} 次邀约 · ${e.data.counts.crushes} 次心动</p>${e.parents.map((id) => `<button class="memory" data-event="${id}">${esc(world.events[id - 1].text)}</button>`).join("")}</article>`,
        )
        .join("") ||
      '<div class="empty wall-empty"><span>✎</span><p>等今天结束，再把故事写下来。</p><small>每四个时段，留下一页校园手记。</small></div>'
    );
  }
  root.CampusViews = {
    esc,
    clock,
    labels,
    portrait,
    profile,
    roster,
    graph,
    timeline,
    wall,
  };
})(window);

const { World, places, slots } = Campus;
let world = new World(),
  selected = 0,
  timer = null;
const $ = (id) => document.getElementById(id),
  colors = [
    "#b87c68",
    "#628d9c",
    "#8e8aaf",
    "#c39855",
    "#849b61",
    "#5d9688",
    "#c2829a",
    "#778caa",
    "#ad936d",
    "#7b9a8a",
  ];
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function avatar(n) {
  return `<button class="avatar ${selected === n.id ? "selected" : ""}" style="--c:${colors[n.id]}" data-person="${n.id}" title="${n.name} · ${n.action}" aria-label="查看${n.name}">${n.name.slice(-1)}</button>`;
}
function time(t) {
  return `D${Math.min(7, Math.floor(t / 4) + 1)} · ${slots[t % 4]}`;
}
function render() {
  const n = world.npcs[selected];
  $("day").textContent = String(
    Math.min(7, Math.floor(world.tick / 4) + 1),
  ).padStart(2, "0");
  $("slot").textContent =
    world.tick === 28
      ? "七日观察结束"
      : slots[world.tick % 4] +
        " · " +
        ["07:00", "12:00", "16:00", "21:00"][world.tick % 4];
  $("count").textContent = `已推进 ${world.tick} / 28 个时段`;
  $("play").textContent = timer ? "Ⅱ 暂停" : "▶ 继续";
  $("play").disabled = $("step").disabled = world.tick >= 28;
  document
    .querySelectorAll("[data-do]")
    .forEach((b) => (b.disabled = world.tick >= 28));
  document.querySelectorAll(".building").forEach((x) => x.remove());
  places.forEach((p, i) => {
    let d = document.createElement("div");
    d.className = "building";
    let people = world.npcs.filter((n) => n.loc === i);
    d.innerHTML = `<div class="title"><b>${["⌂", "▦", "♨", "▤", "✧"][i]} ${p}</b><small>${people.length} 人</small></div><div class="occupants">${people.map(avatar).join("")}</div>`;
    $("map").append(d);
  });
  $("roster").innerHTML = world.npcs.map(avatar).join("");
  $("person-index").textContent =
    String(selected + 1).padStart(2, "0") + " / 10";
  $("profile").innerHTML =
    `<div class="identity">${avatar(n)}<div><h3>${n.name}</h3><small>${places[n.loc]} · ${n.action}</small></div></div><span class="tag">${n.ext > 0.5 ? "外向" : "内敛"}</span><span class="tag">${n.sensitive > 0.5 ? "敏感" : "豁达"}</span><span class="tag">${n.ambition > 0.5 ? "进取" : "随性"}</span><div class="quote">目标：${n.goal}<br>此刻的选择：${n.why}</div>${[
      ["精力", n.energy],
      ["饥饿", n.hunger],
      ["社交需求", n.social],
      ["学业进度", n.progress],
    ]
      .map(
        ([k, v]) =>
          `<div class="stat"><span>${k}</span><div class="bar"><i style="width:${Math.min(100, v)}%"></i></div><b>${Math.round(v)}</b></div>`,
      )
      .join(
        "",
      )}<small>宿舍 ${world.rooms[n.id] + 1} · 课程小组 ${world.groups[n.id] + 1}</small><h4>TA 眼中的关系 <small>单向 · 好感 / 信任 / 心动</small></h4>${n.rel
      .map((r, i) => ({ r, i }))
      .filter((x) => x.i !== n.id)
      .sort(
        (a, b) => Math.abs(b.r.aff) + b.r.crush - Math.abs(a.r.aff) - a.r.crush,
      )
      .map(
        ({ r, i }) =>
          `<div class="relation"><button data-person="${i}">${world.npcs[i].name}</button><span>${r.aff} / ${r.trust} / ${r.crush}${r.crush > 0 ? " ♡" : ""}</span></div>`,
      )
      .join(
        "",
      )}<h4>有限记忆 <small>最近 8 条</small></h4>${n.memory.map((id) => `<button class="memory" data-event="${id}">#${id} ${esc(world.events[id - 1].text)}</button>`).join("") || "<p>记忆还在等第一次相遇。</p>"}`;
  let filter = $("filter").value;
  let events = world.events
    .filter(
      (e) =>
        filter === "all" ||
        (filter === "selected" && e.people.includes(selected)) ||
        (filter === "intervention" && e.type === "intervention") ||
        (filter === "stories" && e.people.length === 2),
    )
    .reverse();
  $("events").innerHTML =
    events
      .map(
        (e) =>
          `<div class="event"><time>${time(e.tick)}</time><span class="dot">${e.type === "crush" ? "♡" : "●"}</span><span>${esc(e.text)}</span><button data-event="${e.id}">查看因果 ↗</button></div>`,
      )
      .join("") ||
    '<div class="empty">世界已就绪。点击「下一时段」，看看第一场相遇。</div>';
  $("wall").innerHTML =
    world.events
      .filter((e) => e.type === "summary")
      .reverse()
      .map(
        (e) =>
          `<div class="wallitem"><small>校园观察日志 · #${e.id}</small><br>${e.text}<br>${e.parents
            .slice(0, 3)
            .map(
              (id) =>
                `<button class="memory" data-event="${id}">${esc(world.events[id - 1].text)}</button>`,
            )
            .join("")}</div>`,
      )
      .join("") || '<div class="empty">一天结束后，这里会留下故事手记。</div>';
}
function stop() {
  clearInterval(timer);
  timer = null;
}
function advance() {
  world.step();
  if (world.tick === 28) stop();
  render();
}
function start() {
  stop();
  timer = setInterval(advance, Number($("speed").value));
  render();
}
$("play").onclick = () => {
  if (timer) {
    stop();
    render();
  } else start();
};
$("step").onclick = () => {
  stop();
  advance();
};
$("speed").onchange = () => {
  if (timer) start();
};
$("reset").onclick = () => {
  stop();
  world = new World($("seed").value || "campus-2026");
  $("notice").textContent =
    "干预立即记录；结果由角色自主选择，不保证特定剧情。";
  render();
};
$("replay").onclick = () => {
  stop();
  let before = JSON.stringify(world);
  world = world.replay();
  $("notice").textContent =
    JSON.stringify(world) === before
      ? "✓ 重放校验一致：相同种子 + 同时段干预 = 相同世界。"
      : "重放不一致，请导出记录。";
  render();
};
$("filter").onchange = render;
document.addEventListener("click", (e) => {
  let p = e.target.closest("[data-person]"),
    x = e.target.closest("[data-event]"),
    d = e.target.closest("[data-do]");
  if (p) {
    selected = Number(p.dataset.person);
    render();
  }
  if (x) showEvent(Number(x.dataset.event));
  if (d) {
    world.intervene(d.dataset.do);
    $("notice").textContent = world.events.at(-1).text;
    render();
  }
});
function showEvent(id) {
  let e = world.events[id - 1];
  $("detailbody").innerHTML =
    `<h2>事件 #${e.id} · ${time(e.tick)}</h2><p>${esc(e.text)}</p><h4>为什么发生</h4><p>${esc(e.data.reason || "世界初始化或玩家改变了环境。")}</p><pre>${esc(JSON.stringify(e.data, null, 2))}</pre><h4>前置事件 · 点击追溯</h4>${e.parents.map((id) => `<button class="memory" data-event="${id}">#${id} ${esc(world.events[id - 1].text)}</button>`).join("") || "<p>这是因果链的起点。</p>"}`;
  if (!$("detail").open) $("detail").showModal();
}
$("close").onclick = () => $("detail").close();
$("help").onclick = () => {
  $("detailbody").innerHTML =
    "<h2>你是观察者，也是半个上帝。</h2><p>1. 选择种子，创建一个十人的校园。点击继续自动推进，或单步观察。</p><p>2. 点击地图小人查看需求、目标、单向关系与最近八条记忆。地图呈现上一步执行后的去处。</p><p>3. 在下一步之前重排宿舍、随机分组或举办开放日。你只能改变环境，角色自己做决定。</p><p>4. 点击故事的「查看因果」，追溯相遇、行动评分及干预来源。每天四个时段结束后生成校园手记。</p><p>5. 七天结束后可查看全部记录。「重放」从相同种子重新执行到当前时刻，并恢复所有原时段干预；「新建世界」清除本轮干预。</p><p>无需联网或大模型密钥。规则故事采用模板，尚无自由对话；关闭页面前可导出记录留存。</p>";
  $("detail").showModal();
};
$("export").onclick = () => {
  let a = document.createElement("a");
  let url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            seed: world.seed,
            tick: world.tick,
            interventions: world.inputs,
            world,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  a.href = url;
  a.download = "campus-replay.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
render();

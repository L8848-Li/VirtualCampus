const { World, profiles, places, slots, TOTAL_TICKS } = Campus;
const V = CampusViews,
  $ = (id) => document.getElementById(id);
const STORAGE_KEY = "virtualcampus.save.v2";
let world = new World(),
  selected = 0,
  watched = [],
  follow = false,
  direction = "out",
  timer = null;
const mapView = new CampusMap.MapView($("map"));
const isId = (x) => Number.isInteger(x) && x >= 0 && x < 10;
function viewState() {
  return {
    selected,
    watched: [...watched],
    follow,
    direction,
    filter: $("filter").value,
  };
}
function loadView(view) {
  if (!view || typeof view !== "object") return;
  selected = isId(view.selected) ? view.selected : 0;
  watched = Array.isArray(view.watched)
    ? [...new Set(view.watched.filter(isId))].slice(0, 3)
    : [];
  follow = view.follow === true;
  direction = view.direction === "in" ? "in" : "out";
  if (
    ["important", "stories", "watched", "selected", "all"].includes(view.filter)
  )
    $("filter").value = view.filter;
}
function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ world: world.toSave(), view: viewState() }),
    );
    $("save-state").textContent = "✓ 已自动保存到本机";
  } catch {
    $("save-state").textContent = "自动保存不可用，请导出留存";
  }
}
function notice(text) {
  $("notice").textContent = text;
}
function render() {
  const done = world.tick >= TOTAL_TICKS;
  $("day").textContent = String(
    Math.min(7, Math.floor(world.tick / 4) + 1),
  ).padStart(2, "0");
  $("slot").textContent = done
    ? "七日观察结束"
    : `下一步 · ${slots[world.tick % 4]}`;
  $("count").textContent = `${world.tick} / ${TOTAL_TICKS} 时段`;
  $("play").textContent = timer ? "Ⅱ 暂停" : "▶ 继续";
  $("play").disabled = $("step").disabled = done;
  document
    .querySelectorAll("[data-do]")
    .forEach(
      (b) => (b.disabled = done || world.inputs.length >= Campus.MAX_INPUTS),
    );
  $("follow").classList.toggle("active", follow);
  $("follow").setAttribute("aria-pressed", String(follow));
  $("map-time").textContent = world.tick
    ? `画面记录：${V.clock(world.tick - 1)} · ${world.npcs.filter((n) => n.intent).length} 人主动寻找熟人`
    : "新的一周，大家正在整理开学行李。";
  $("week-progress").innerHTML = Array.from(
    { length: 7 },
    (_, day) =>
      `<div class="day-progress ${world.tick >= (day + 1) * 4 ? "complete" : ""}"><span>D${day + 1}</span><div>${Array.from({ length: 4 }, (_, slot) => `<i class="${world.tick > day * 4 + slot ? "done" : ""}"></i>`).join("")}</div></div>`,
  ).join("");
  mapView.render(
    world,
    selected,
    watched,
    follow,
    timer ? Math.min(650, Number($("speed").value) * 0.85) : 650,
  );
  $("watchlist").innerHTML = watched.length
    ? watched
        .map((id) => {
          const n = world.npcs[id];
          return `<button data-person="${id}" class="watch-chip" style="--c:${profiles[id].color}"><i></i><b>${n.name}</b><span>${places[n.loc]} · ${n.interaction}</span></button>`;
        })
        .join("")
    : "<small>在角色档案点 ☆，留意你关心的人。</small>";
  $("roster").innerHTML = V.roster(world, selected);
  $("person-index").textContent =
    String(selected + 1).padStart(2, "0") + " / 10";
  $("profile").innerHTML = V.profile(world, selected, watched);
  $("graph").innerHTML = V.graph(world, selected, direction);
  document.querySelectorAll("[data-direction]").forEach((b) => {
    b.classList.toggle("active", b.dataset.direction === direction);
    b.setAttribute("aria-pressed", String(b.dataset.direction === direction));
  });
  $("events").innerHTML = V.timeline(
    world,
    $("filter").value,
    selected,
    watched,
  );
  $("wall").innerHTML = V.wall(world);
}
function commit() {
  render();
  persist();
}
function stop() {
  clearInterval(timer);
  timer = null;
}
function advance() {
  if (world.step()) {
    if (world.tick === TOTAL_TICKS) {
      stop();
      notice("七日观察结束。可以回看关系、导出存档，或重放这一周。");
    }
    commit();
  }
}
function start() {
  if (world.tick >= TOTAL_TICKS) return;
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
  try {
    const next = new World($("seed").value || "campus-2026");
    stop();
    world = next;
    notice("新的一周开始了。性格、兴趣和新的相遇会慢慢改变这座校园。");
    commit();
  } catch (error) {
    notice(error.message);
  }
};
$("replay").onclick = () => {
  stop();
  const before = world.checksum();
  world = world.replay();
  notice(
    world.checksum() === before
      ? "✓ 重放校验一致：同一规则版本、种子与干预序列，得到完全相同的世界。"
      : "重放不一致，请导出存档反馈问题。",
  );
  commit();
};
$("filter").onchange = commit;
$("follow").onclick = () => {
  follow = !follow;
  commit();
};
document.addEventListener("click", (event) => {
  const person = event.target.closest("[data-person]"),
    detail = event.target.closest("[data-event]"),
    intervention = event.target.closest("[data-do]"),
    watch = event.target.closest("[data-watch]"),
    dir = event.target.closest("[data-direction]");
  if (person) {
    selected = Number(person.dataset.person);
    commit();
  }
  if (detail) showEvent(Number(detail.dataset.event));
  if (intervention) {
    if (world.intervene(intervention.dataset.do)) {
      notice(world.events.at(-1).text);
      commit();
    }
  }
  if (watch) {
    const id = Number(watch.dataset.watch);
    if (watched.includes(id)) watched = watched.filter((x) => x !== id);
    else if (watched.length < 3) watched.push(id);
    else {
      notice("最多关注 3 人。先取消一位，再选择新的关注对象。");
      return;
    }
    commit();
  }
  if (dir) {
    direction = dir.dataset.direction;
    commit();
  }
});
document.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("g[data-person]")
  ) {
    event.preventDefault();
    selected = Number(event.target.dataset.person);
    commit();
  }
});
function showEvent(id) {
  const e = world.events[id - 1];
  if (!e) return;
  const scores = e.data.scores;
  $("detailbody").innerHTML =
    `<span class="eyebrow">${e.type === "summary" ? `第 ${e.data.day} 天日终` : V.clock(e.tick)} / 事件 #${e.id}</span><h2>${V.labels[e.type] || "校园片段"}</h2><p class="event-quote">${V.esc(e.text)}</p><h4>为什么发生</h4><p>${V.esc(e.data.reason || "世界初始化、环境变化或日终汇总。")}</p>${e.data.delta !== undefined ? `<p class="change-pill">发起者好感 ${e.data.delta > 0 ? "+" : ""}${e.data.delta} · 对方好感 ${e.data.otherDelta > 0 ? "+" : ""}${e.data.otherDelta}</p>` : ""}${scores ? `<h4>行动评分 · 最高分被选中</h4><div class="table-wrap"><table><thead><tr><th>候选行动</th><th>需求/目标</th><th>习惯</th><th>回避</th><th>生理负担</th><th>波动</th><th>总分</th></tr></thead><tbody>${scores.map((s) => `<tr><td>${s.action}${s.target !== null ? ` · ${world.npcs[s.target].name}` : ""}</td><td>${s.needAndGoal}</td><td>+${s.habit}</td><td>−${s.avoidance}</td><td>−${s.exhaustion + s.urgentMeal}</td><td>+${s.noise}</td><td>${s.total}</td></tr>`).join("")}</tbody></table></div>` : ""}${e.data.perspectives?.length ? `<h4>观察者视角 · 两种解释</h4>${e.data.perspectives.map((p) => `<p>${world.npcs[p.person].name}：${V.esc(p.interpretation)}</p>`).join("")}` : ""}${e.data.observedPeople?.length ? `<h4>这个时段亲眼看见的人</h4><p>${e.data.observedPeople.map((id) => world.npcs[id].name).join("、")}</p>` : ""}<h4>此前发生了什么 · 点击继续追溯</h4>${e.parents.map((parent) => `<button class="memory" data-event="${parent}"><small>#${parent} · ${V.clock(world.events[parent - 1].tick)}</small>${V.esc(world.events[parent - 1].text)}</button>`).join("") || '<p class="empty">这是这一条因果链的起点。</p>'}<details class="raw-data"><summary>展开规则记录</summary><pre>${V.esc(JSON.stringify(e.data, null, 2))}</pre></details>`;
  if (!$("detail").open) $("detail").showModal();
}
$("close").onclick = () => $("detail").close();
$("help").onclick = () => {
  $("detailbody").innerHTML =
    '<span class="eyebrow">欢迎来到七日观察室</span><h2>你改变环境，他们决定怎么生活。</h2><p>点击继续自动推进，或单步观察。每步一个时段，一周共 28 步。移动动画只是呈现，不改变模拟结果。</p><p>点击小人选择角色，用 ☆ 关注最多三人，开启跟随观察可持续高亮当前角色。关系图支持切换 TA 看别人 / 别人看 TA。</p><p>角色会根据需求、兴趣、习惯和已知关系选择行动。找熟人只依据自己曾亲眼看到的位置，可能找不到；邀约也可能被对方拒绝。</p><p>改变宿舍、课程分组或举办开放日，可以改变相遇的机会。没有任何干预保证特定关系结果。</p><p>每天结束会选出重要片段。点击「为什么发生」查看行动评分、双方解释和前置事件；记忆按显著性保留，最多八条。</p><p>每次推进和干预会自动保存到当前浏览器。关闭再打开会暂停恢复。导出 / 导入用于换浏览器或留存；存档有版本与校验，旧版 v0.1 存档暂不兼容。</p><p>底层是固定时段的多角色模拟与效用评分决策，加上带种子的随机检定。所有故事来自规则，无需模型 API 密钥。</p>';
  $("detail").showModal();
};
$("export").onclick = () => {
  const data = JSON.stringify(
    { world: world.toSave(), view: viewState() },
    null,
    2,
  );
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `campus-v${Campus.ENGINE_VERSION}-day${Math.min(7, Math.floor(world.tick / 4) + 1)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice("已导出可重放的存档，包含规则版本、种子、干预与校验信息。");
};
$("import").onclick = () => $("save-file").click();
$("save-file").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 256 * 1024)
      throw new Error("存档超过 256 KB，请选择本游戏导出的 JSON 文件。");
    const payload = JSON.parse(await file.text());
    const next = World.fromSave(payload.world || payload);
    stop();
    world = next;
    loadView(payload.view);
    $("seed").value = world.seed;
    notice(`✓ 已导入并验证存档，恢复到 ${world.tick} / 28 时段，模拟已暂停。`);
    commit();
  } catch (error) {
    notice(
      `导入失败：${error instanceof SyntaxError ? "文件不是有效的 JSON。" : error.message}`,
    );
  } finally {
    event.target.value = "";
  }
};
try {
  const text = localStorage.getItem(STORAGE_KEY);
  if (text) {
    const payload = JSON.parse(text);
    world = World.fromSave(payload.world);
    loadView(payload.view);
    $("seed").value = world.seed;
    notice(`已恢复本机存档：${world.tick} / 28 时段，模拟已暂停。`);
    $("save-state").textContent = "✓ 已恢复本机存档";
  }
} catch {
  $("save-state").textContent = "本机存档不可用，可导入其他记录";
}
render();

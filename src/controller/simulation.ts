import { computed, reactive, ref, shallowRef } from "vue";
import { World, TOTAL_TICKS, MAX_INPUTS } from "../engine.ts";
import type { WorldSnapshot, ViewState } from "../core/types.ts";
const STORAGE_KEY = "virtualcampus.save.v5";
const isId = (id: unknown): id is number =>
  Number.isInteger(id) && Number(id) >= 0 && Number(id) < 10;
export function createSimulation() {
  let world = new World();
  let timer: ReturnType<typeof setInterval> | null = null;
  const capture = (): WorldSnapshot =>
    JSON.parse(
      JSON.stringify({
        version: world.version,
        seed: world.seed,
        tick: world.tick,
        npcs: world.npcs,
        events: world.events,
        rooms: world.rooms,
        groups: world.groups,
        party: world.party,
        inputs: world.inputs,
        tasks: world.tasks,
        activities: world.activities,
      }),
    );
  const snapshot = shallowRef(capture());
  const view = reactive<ViewState>({
    selected: 0,
    watched: [],
    follow: false,
    direction: "out",
    filter: "important",
  });
  const seed = ref(world.seed),
    speed = ref(2200),
    running = ref(false),
    notice = ref("干预改变环境；每个人依然有自己的打算。");
  const saveState = ref("本机自动保存"),
    detailId = ref<number | null>(null),
    helpOpen = ref(false);
  function loadView(input: unknown) {
    if (!input || typeof input !== "object") return;
    const v = input as Partial<ViewState>;
    view.selected = isId(v.selected) ? v.selected : 0;
    view.watched = Array.isArray(v.watched)
      ? [...new Set(v.watched.filter(isId))].slice(0, 3)
      : [];
    view.follow = v.follow === true;
    view.direction = v.direction === "in" ? "in" : "out";
    if (
      v.filter &&
      ["important", "stories", "watched", "selected", "all"].includes(v.filter)
    )
      view.filter = v.filter;
  }
  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ world: world.toSave(), view }),
      );
      saveState.value = "✓ 已自动保存到本机";
    } catch {
      saveState.value = "自动保存不可用，请导出留存";
    }
  }
  function publish() {
    snapshot.value = capture();
    persist();
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    running.value = false;
  }
  function step() {
    if (world.step()) {
      if (world.tick === TOTAL_TICKS) {
        stop();
        notice.value = "七日观察结束，可以回看关系、导出存档或重放。";
      }
      publish();
    }
  }
  function start() {
    if (world.tick >= TOTAL_TICKS) return;
    stop();
    running.value = true;
    timer = setInterval(step, speed.value);
  }
  function togglePlayback() {
    if (running.value) stop();
    else start();
  }
  function changeSpeed(value: number) {
    speed.value = value;
    if (running.value) start();
  }
  function singleStep() {
    stop();
    step();
  }
  function reset() {
    try {
      const next = new World(seed.value || "campus-2026");
      stop();
      world = next;
      detailId.value = null;
      notice.value = "新的一周开始了，故事会从新的相遇慢慢生长。";
      publish();
    } catch (e) {
      notice.value = (e as Error).message;
    }
  }
  function intervene(kind: string) {
    if (world.intervene(kind)) {
      notice.value = world.events.at(-1)!.text;
      publish();
    }
  }
  function replay() {
    stop();
    const before = world.checksum();
    world = world.replay();
    notice.value =
      before === world.checksum()
        ? "✓ 重放校验一致：同一版本、种子和干预序列得到相同世界。"
        : "重放不一致，请导出反馈。";
    publish();
  }
  function select(id: number) {
    if (isId(id)) {
      view.selected = id;
      persist();
    }
  }
  function watch(id: number) {
    if (view.watched.includes(id))
      view.watched = view.watched.filter((x) => x !== id);
    else if (view.watched.length < 3) view.watched.push(id);
    else notice.value = "最多关注 3 人，请先取消一位。";
    persist();
  }
  function setFollow() {
    view.follow = !view.follow;
    persist();
  }
  function setDirection(value: "in" | "out") {
    view.direction = value;
    persist();
  }
  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ world: world.toSave(), view }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `campus-${world.version}-day${Math.min(7, Math.floor(world.tick / 4) + 1)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice.value = "已导出带版本与校验信息的可重放存档。";
  }
  async function importFile(file: File) {
    try {
      if (file.size > 256 * 1024) throw new Error("存档超过 256 KB。");
      const payload = JSON.parse(await file.text());
      const next = World.fromSave(payload.world || payload);
      stop();
      world = next;
      loadView(payload.view);
      seed.value = world.seed;
      detailId.value = null;
      notice.value = `✓ 已导入并验证：${world.tick} / 28 时段，模拟已暂停。`;
      publish();
    } catch (e) {
      notice.value = `导入失败：${e instanceof SyntaxError ? "无效的 JSON 文件" : (e as Error).message}`;
    }
  }
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) {
      const payload = JSON.parse(text);
      world = World.fromSave(payload.world);
      loadView(payload.view);
      seed.value = world.seed;
      snapshot.value = capture();
      notice.value = `已恢复本机存档：${world.tick} / 28 时段，模拟已暂停。`;
      saveState.value = "✓ 已恢复本机存档";
    }
  } catch {
    saveState.value = "本机存档不可用，可导入其他记录";
  }
  const selected = computed(() => snapshot.value.npcs[view.selected]);
  const done = computed(() => snapshot.value.tick >= TOTAL_TICKS);
  const canIntervene = computed(
    () => !done.value && snapshot.value.inputs.length < MAX_INPUTS,
  );
  return {
    snapshot,
    view,
    seed,
    speed,
    running,
    notice,
    saveState,
    detailId,
    helpOpen,
    selected,
    done,
    canIntervene,
    togglePlayback,
    changeSpeed,
    singleStep,
    reset,
    intervene,
    replay,
    select,
    watch,
    setFollow,
    setDirection,
    persist,
    exportFile,
    importFile,
    stop,
  };
}
export type SimulationController = ReturnType<typeof createSimulation>;

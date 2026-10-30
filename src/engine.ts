import { enrollStudents, type Enrollment } from './core/enrollment.ts';
import { createClubs } from './core/clubs.ts';
import { createLivingStates, type LivingState } from './core/livingExperiment.ts';
import type { Parcel, Laundry } from './core/parcelLaundry.ts';
import type { MealDelivery } from './core/mealDelivery.ts';
import { dormLocation, isPrivateDorm } from './core/campusLife.ts';
import { createAssessments } from './core/assessment.ts';
import { createLibrary } from './core/library.ts';
import { createTasks } from './core/tasks.ts';
import * as config from './core/config.ts';
import { Random, hash } from './core/random.ts';
import { clamp } from './core/math.ts';
import { EventLog } from './core/eventLog.ts';
import { advanceWorld, publishSummary } from './core/tick.ts';
import type {
  AgentState,
  CampusEvent,
  EventType,
  EventData,
  Intervention,
  InterventionKind,
  LocationId,
  SaveData,
  CampusTask,
  CampusActivity,
  Homework,
  LibraryState,
  Assessment,
  WorldState,
  ScoredAction,
} from "./core/types.ts";
const {
  ENGINE_VERSION,
  SCHEMA_VERSION,
  TOTAL_TICKS,
  MAX_INPUTS,
  profiles,
  places,
} = config;
export * from "./core/config.ts";
export type * from "./core/types.ts";
const kinds = ["rooms", "groups", "party"];
export class World implements WorldState {
  #history = new EventLog();
  declare version: string;
  declare seed: string;
  declare random: Random;
  declare tick: number;
  get events(): readonly CampusEvent[] { return this.#history.events; }
  declare inputs: Intervention[];
  declare rooms: number[];
  declare groups: number[];
  declare party: number;
  declare tasks: CampusTask[];
  declare activities: CampusActivity[];
  clubs = createClubs();
  declare homework: Homework[];
  declare library: LibraryState;
  declare assessments: Assessment[];
  declare enrollments: Enrollment[];
  declare deliveries: MealDelivery[];
  declare livingEnabled: boolean;
  declare living: LivingState[];
  declare parcels: Parcel[];
  declare laundry: Laundry[];
  declare environment: Record<InterventionKind, number | null>;
  declare npcs: AgentState[];
  constructor(seed: string | number = "campus-2026", options: { livingEnabled?: boolean } = {}) {
    this.version = ENGINE_VERSION;
    this.seed = String(seed);
    if (!this.seed.length || this.seed.length > 128)
      throw new Error("世界种子应为 1–128 个字符。");
    this.random = new Random(this.seed);
    this.tick = 0;
    this.inputs = [];
    this.rooms = Array.from({ length: profiles.length }, (_, i) => Math.floor(i / 2));
    this.groups = Array.from({ length: profiles.length }, (_, i) => i % 3);
    this.party = -1;
    this.environment = { rooms: null, groups: null, party: null };
    this.activities = [];
    this.homework = [];
    this.library = createLibrary();
    this.assessments = createAssessments();
    this.deliveries = [];
    this.livingEnabled = options.livingEnabled === true;
    this.living = [];
    this.parcels = [];
    this.laundry = [];
    this.npcs = profiles.map<AgentState>((p, id) => ({
      id,
      education: p.education ?? "undergraduate",
      name: p.name,
      role: p.role,
      interest: p.interest,
      quirk: p.quirk,
      home: p.home,
      habit: p.habit,
      goal: p.goal,
      ext: clamp(p.ext + (this.rand() - 0.5) * 0.18, 0, 1),
      sensitive: clamp(p.sensitive + (this.rand() - 0.5) * 0.18, 0, 1),
      ambition: clamp(p.ambition + (this.rand() - 0.5) * 0.18, 0, 1),
      energy: 65 + this.rand() * 25,
      hunger: 20 + this.rand() * 25,
      social: 25 + this.rand() * 35,
      progress: 0,
      loc: dormLocation(this.rooms[id]),
      previousLoc: dormLocation(this.rooms[id]),
      action: "整理开学行李",
      why: "新的一周，先熟悉校园",
      interaction: "还没有新的相遇",
      intent: null,
      memory: [],
      known: {},
      rel: Array.from({ length: profiles.length }, () => ({ aff: 0, trust: 0, crush: 0 })),
      last: null,
      plan: null,
      lastPlanTick: -9,
      beliefs: [],
      accounts: [],
      activityInvitations: [],
    }));
    if (this.livingEnabled) this.living = createLivingStates(this.npcs);
    this.log(
      `开学了。${profiles.length} 个人带着各自的习惯，走进了同一座校园。`,
      "system",
      [],
      [],
      { seed: this.seed, engineVersion: ENGINE_VERSION },
      1,
    );
    this.enrollments = enrollStudents(this);
    this.assessments = createAssessments(this.enrollments);
    this.tasks = createTasks(this);
    this.#history.seal();
  }
  rand() {
    return this.random.next();
  }
  sample(purpose: string, ...keys: (number | string)[]) {
    return new Random(JSON.stringify([this.seed, purpose, ...keys])).next();
  }
  shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  log(
    text: string,
    type: EventType,
    people: number[] = [],
    parents: (number | null | undefined)[] = [],
    data: EventData = {},
    importance = 1,
  ) {
    const id = this.events.length + 1;
    this.#history.append({
      id,
      tick: this.tick,
      text,
      type,
      people,
      parents: [
        ...new Set(
          parents.filter(
            (p): p is number => Number.isInteger(p) && p! > 0 && p! < id,
          ),
        ),
      ],
      data,
      importance,
    });
    return id;
  }
  remember(n: AgentState, id: number) {
    n.last = id;
    const score = (eventId: number) => {
      const e = this.events[eventId - 1];
      return e.importance - (this.tick - e.tick) * 0.16;
    };
    n.memory = [...new Set([id, ...n.memory])]
      .sort((a, b) => score(b) - score(a) || b - a)
      .slice(0, 8);
  }
  environmentParents(loc: LocationId) {
    return [
      isPrivateDorm(loc) ? this.environment.rooms : null,
      loc === 1 ? this.environment.groups : null,
      loc === 4 && this.party === this.tick ? this.environment.party : null,
    ].filter((id): id is number => id !== null);
  }
  intervene(kind: string) {
    if (
      this.tick >= TOTAL_TICKS ||
      !kinds.includes(kind) ||
      this.inputs.length >= MAX_INPUTS
    )
      return false;
    this.inputs.push({ tick: this.tick, kind: kind as InterventionKind });
    let text = "";
    if (kind === "rooms") {
      const undergraduates = this.npcs.filter((n) => n.education === "undergraduate");
      const graduates = this.npcs.filter((n) => n.education === "graduate");
      for (const cohort of [undergraduates, graduates]) {
        const assignments = this.shuffle(cohort.map((n) => this.rooms[n.id]));
        cohort.forEach((n, i) => { this.rooms[n.id] = assignments[i]; });
      }
      // Reassignment represents the move itself for those currently in a
      // dorm. People elsewhere remain where they are until their next choice.
      for (const n of this.npcs) if (isPrivateDorm(n.loc)) {
        n.previousLoc = n.loc;
        n.loc = dormLocation(this.rooms[n.id]);
        n.action = "搬到新宿舍";
        n.why = "宿舍调整时搬入新分配的房间";
        n.interaction = "在新宿舍安顿下来";
        n.intent = null;
      }
      text = "宿舍重排：在宿舍的人已搬到新房间，其他人将在回来后入住。";
    }
    if (kind === "groups") {
      const undergraduates = this.npcs.filter((n) => n.education === "undergraduate");
      const assignments = this.shuffle(undergraduates.map((n) => this.groups[n.id]));
      undergraduates.forEach((n, i) => { this.groups[n.id] = assignments[i]; });
      text = "课程分组更新：一起完成课堂任务的人发生了变化。";
    }
    if (kind === "party") {
      this.party = this.tick;
      text = "社团开放日已准备好，下一时段大家可以自主决定是否参加。";
    }
    this.environment[kind as InterventionKind] = this.log(
      text,
      "intervention",
      [],
      [this.environment[kind as InterventionKind]],
      { kind, rooms: [...this.rooms], groups: [...this.groups] },
      3,
    );
    if (kind === "groups")
      for (const task of this.tasks.filter((item) => item.status === "open" && item.id.startsWith("report-"))) {
        const group = Number(task.id.split("-")[1]);
        task.members = this.npcs.filter((n) => n.education === "undergraduate" && this.groups[n.id] === group).map((n) => n.id);
        const previous = task.lastEvent;
        task.lastEvent = this.log(`${task.title}随课程分组更新了组员，已完成的资料仍然保留。`,
          "task_announced", task.members, [previous, this.environment.groups],
          { reason: "公开的课程分组改变了共同任务的参与人，历史工作仍可追溯", taskId: task.id, progress: task.progress, required: task.required }, 2);
        for (const n of this.npcs.filter((n) => task.members.includes(n.id))) this.remember(n, task.lastEvent);
      }
    this.#history.seal();
    return true;
  }
  /** One complete deterministic operation; only its finished events are published. */
  step() {
    if (this.tick >= TOTAL_TICKS) return false;
    advanceWorld(this);
    this.#history.seal();
    return true;
  }
  summarize() { publishSummary(this); }
  /** @internal Only the running tick may amend an uncommitted event. */
  pendingEvent(id: number) { return this.#history.draft(id); }
  /** @internal The UI obtains a decoded table with getActionScores(). */
  recordActionScores(id: number, options: readonly ScoredAction[]) { this.#history.attachOptions(id, options); }
  replay() {
    const world = new World(this.seed, { livingEnabled: this.livingEnabled });
    while (world.tick < this.tick) {
      for (const input of this.inputs.filter((x) => x.tick === world.tick))
        world.intervene(input.kind);
      world.step();
    }
    for (const input of this.inputs.filter((x) => x.tick === this.tick))
      world.intervene(input.kind);
    return world;
  }
  checksum() {
    return hash(JSON.stringify([this.getState(), this.#history.digest])).toString(16).padStart(8, "0");
  }
  getState(): WorldState {
    return {
      version: this.version, seed: this.seed, random: { state: this.random.state }, tick: this.tick,
      inputs: this.inputs, rooms: this.rooms, groups: this.groups, party: this.party,
      tasks: this.tasks, activities: this.activities, clubs: this.clubs, homework: this.homework,
      library: this.library, assessments: this.assessments, enrollments: this.enrollments,
      deliveries: this.deliveries, livingEnabled: this.livingEnabled, living: this.living,
      parcels: this.parcels, laundry: this.laundry, environment: this.environment, npcs: this.npcs,
    };
  }
  getCommittedEvents() { return this.#history.committed(); }
  getActionScores(eventId: number) { return this.#history.getActionScores(eventId); }
  getEncodedActionScores(eventId: number) { return this.#history.encodedScores(eventId); }
  checksumFromScratch() {
    return hash(JSON.stringify([this.getState(), this.#history.recomputeDigest()])).toString(16).padStart(8, '0');
  }
  encodedHistoryBytes() { return this.#history.encodedBytes();
  }
  toSave(): SaveData {
    return {
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      seed: this.seed,
      tick: this.tick,
      inputs: this.inputs.map((x) => ({ ...x })),
      checksum: this.checksum(),
      livingEnabled: this.livingEnabled,
    };
  }
  static fromSave(input: unknown) {
    const save = input as SaveData;
    if (
      !save ||
      typeof save !== "object" ||
      save.schemaVersion !== SCHEMA_VERSION
    )
      throw new Error(`存档格式不兼容，请使用 v${ENGINE_VERSION} 导出的记录。`);
    if (save.engineVersion !== ENGINE_VERSION)
      throw new Error(
        `存档来自引擎 ${String(save.engineVersion).slice(0, 24)}，当前为 ${ENGINE_VERSION}，暂不支持跨版本重放。`,
      );
    if (
      typeof save.seed !== "string" ||
      typeof save.livingEnabled !== "boolean" ||
      !save.seed.length ||
      save.seed.length > 128 ||
      !Number.isInteger(save.tick) ||
      save.tick < 0 ||
      save.tick > TOTAL_TICKS ||
      !Array.isArray(save.inputs) ||
      save.inputs.length > MAX_INPUTS ||
      !/^[a-f0-9]{8}$/.test(save.checksum)
    )
      throw new Error("存档内容不完整或超出了允许范围。");
    let previous = -1;
    for (const input of save.inputs) {
      if (
        !input ||
        !Number.isInteger(input.tick) ||
        input.tick < previous ||
        input.tick < 0 ||
        input.tick >= TOTAL_TICKS ||
        input.tick > save.tick ||
        !kinds.includes(input.kind)
      )
        throw new Error("存档中的干预顺序或内容无效。");
      previous = input.tick;
    }
    // Reconstruct from validated inputs rather than trusting imported NPC state.
    const world = new World(save.seed, { livingEnabled: save.livingEnabled });
    for (let tick = 0; tick <= save.tick; tick++) {
      for (const input of save.inputs.filter((x) => x.tick === tick))
        world.intervene(input.kind);
      if (tick < save.tick) world.step();
    }
    if (world.checksum() !== save.checksum)
      throw new Error("重放校验失败，文件可能被修改或来自不同的规则版本。");
    return world;
  }
}

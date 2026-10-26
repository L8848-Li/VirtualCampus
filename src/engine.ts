import * as config from './core/config.ts';
import { Random, hash } from './core/random.ts';
import { chooseAction, clamp } from './core/decision.ts';
import { runSocial } from './core/social.ts';
import type { AgentState, CampusEvent, EventType, EventData, Intervention, InterventionKind, LocationId, SaveData } from './core/types.ts';
const { ENGINE_VERSION, SCHEMA_VERSION, TOTAL_TICKS, MAX_INPUTS, profiles, places } = config;
export * from './core/config.ts';
export type * from './core/types.ts';
const kinds = ["rooms", "groups", "party"];
export class World {
  declare version: string; declare seed: string; declare random: Random;
  declare tick: number; declare events: CampusEvent[]; declare inputs: Intervention[];
  declare rooms: number[]; declare groups: number[]; declare party: number;
  declare environment: Record<InterventionKind, number | null>; declare npcs: AgentState[];
  constructor(seed: string | number = "campus-2026") {
    this.version = ENGINE_VERSION;
    this.seed = String(seed);
    if (!this.seed.length || this.seed.length > 128)
      throw new Error("世界种子应为 1–128 个字符。");
    this.random = new Random(this.seed);
    this.tick = 0;
    this.events = [];
    this.inputs = [];
    this.rooms = Array.from({ length: 10 }, (_, i) => Math.floor(i / 2));
    this.groups = Array.from({ length: 10 }, (_, i) => i % 3);
    this.party = -1;
    this.environment = { rooms: null, groups: null, party: null };
    this.npcs = profiles.map<AgentState>((p, id) => ({
      id,
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
      loc: 0,
      previousLoc: 0,
      action: "整理开学行李",
      why: "新的一周，先熟悉校园",
      interaction: "还没有新的相遇",
      intent: null,
      memory: [],
      known: {},
      rel: Array.from({ length: 10 }, () => ({ aff: 0, trust: 0, crush: 0 })),
      last: null,
    }));
    this.log(
      "开学了。十个人带着各自的习惯，走进了同一座校园。",
      "system",
      [],
      [],
      { seed: this.seed, engineVersion: ENGINE_VERSION },
      1,
    );
  }
  rand() {
    return this.random.next();
  }
  shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  log(text: string, type: EventType, people: number[] = [], parents: (number | null | undefined)[] = [], data: EventData = {}, importance = 1) {
    const id = this.events.length + 1;
    this.events.push({
      id,
      tick: this.tick,
      text,
      type,
      people,
      parents: [
        ...new Set(
          parents.filter((p): p is number => Number.isInteger(p) && p! > 0 && p! < id),
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
      loc === 0 ? this.environment.rooms : null,
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
      this.rooms = this.shuffle(
        Array.from({ length: 10 }, (_, i) => Math.floor(i / 2)),
      );
      text = "宿舍重排：新的室友改变了回宿舍后的相遇机会。";
    }
    if (kind === "groups") {
      this.groups = this.shuffle(Array.from({ length: 10 }, (_, i) => i % 3));
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
    return true;
  }
  step() {
    if (this.tick >= TOTAL_TICKS) return false;
    // Decay all needs first. Decisions then use the same pre-movement phase;
    // no earlier agent can leak its new location to the following agent.
    for (const n of this.npcs) {
      n.hunger = clamp(n.hunger + 17);
      n.energy = clamp(n.energy - 12);
      n.social = clamp(n.social + 11);
    }
    const decisions = this.npcs.map((n) =>
      chooseAction(
        n,
        {
          tick: this.tick,
          slot: this.tick % 4,
          party: this.party === this.tick,
          memories: n.memory.map((id) => this.events[id - 1]),
          roommates: this.npcs
            .filter((p) => this.rooms[p.id] === this.rooms[n.id])
            .map((p) => p.id),
        },
        () => this.rand(),
      ),
    );
    for (const n of this.npcs) {
      const { chosen, options } = decisions[n.id];
      n.previousLoc = n.loc;
      n.loc = chosen.loc;
      n.action = chosen.action;
      n.why = chosen.reason;
      n.interaction = "按自己的节奏生活";
      n.intent = chosen.kind
        ? {
            kind: chosen.kind,
            target: chosen.target!,
            evidence: chosen.evidence,
          }
        : null;
      n.energy = clamp(n.energy + (n.loc === 0 ? 42 : 0));
      n.hunger = clamp(n.hunger - (n.loc === 2 ? 65 : 0));
      if (n.loc === 1 || n.loc === 3)
        n.progress += 4 + Math.round(n.ambition * 5);
      const id = this.log(
        `${n.name}前往${places[n.loc]}${chosen.kind ? `，${chosen.action}` : chosen.action}。`,
        "action",
        [n.id],
        [n.last, ...chosen.evidence, ...this.environmentParents(n.loc)],
        {
          reason: chosen.reason,
          target: chosen.target ?? null,
          location: n.loc,
          observedPeople: [],
          scores: options.map((o) => ({
            action: o.action,
            location: o.loc,
            target: o.target ?? null,
            total: +o.score.toFixed(2),
            needAndGoal: +o.base.toFixed(2),
            habit: o.habit,
            avoidance: +o.avoidance.toFixed(2),
            exhaustion: o.exhaustion,
            urgentMeal: o.urgentMeal,
            noise: +o.noise.toFixed(2),
          })),
        },
        1,
      );
      this.remember(n, id);
    }
    // Observation is local and timestamped. Old sightings may be wrong later.
    for (const n of this.npcs)
      for (const p of this.npcs) {
        if (
          p.id !== n.id &&
          p.loc === n.loc &&
          (n.loc !== 0 || this.rooms[p.id] === this.rooms[n.id])
        ) {
          this.events[n.last! - 1].data.observedPeople!.push(p.id);
          const sighting = {
            loc: p.loc,
            tick: this.tick,
            event: n.last!,
            missed: false,
          };
          n.known[p.id] = {
            ...sighting,
            routine: { ...n.known[p.id]?.routine, [this.tick % 4]: sighting },
          };
        }
      }
    runSocial(this);
    this.tick++;
    if (this.tick % 4 === 0) this.summarize();
    return true;
  }
  summarize() {
    const stories = this.events.filter(
      (e) =>
        e.tick >= this.tick - 4 &&
        e.tick < this.tick &&
        [
          "friendship",
          "crush",
          "misunderstanding",
          "repair",
          "rivalry",
        ].includes(e.type),
    );
    const pairs = new Set<string>(),
      highlights: number[] = [];
    for (const e of [...stories].sort(
      (a, b) => b.importance - a.importance || b.tick - a.tick || b.id - a.id,
    )) {
      const pair = [...e.people].sort((a, b) => a - b).join("-");
      if (pairs.has(pair)) continue;
      pairs.add(pair);
      highlights.push(e.id);
      if (highlights.length === 3) break;
    }
    const counts = {
      meetings: stories.length,
      crushes: stories.filter((e) => e.type === "crush").length,
      misunderstandings: stories.filter((e) => e.type === "misunderstanding")
        .length,
      invitations: this.events.filter(
        (e) =>
          e.tick >= this.tick - 4 &&
          e.tick < this.tick &&
          e.type === "invitation",
      ).length,
    };
    this.log(
      `第 ${this.tick / 4} 天，有些关系悄悄近了，也有人还在等下一次解释的机会。`,
      "summary",
      [],
      highlights,
      { day: this.tick / 4, highlights, counts },
      2,
    );
  }
  replay() {
    const world = new World(this.seed);
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
    return hash(JSON.stringify(this)).toString(16).padStart(8, "0");
  }
  toSave(): SaveData {
    return {
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      seed: this.seed,
      tick: this.tick,
      inputs: this.inputs.map((x) => ({ ...x })),
      checksum: this.checksum(),
    };
  }
  static fromSave(input: unknown) {
    const save = input as SaveData;
    if (
      !save ||
      typeof save !== "object" ||
      save.schemaVersion !== SCHEMA_VERSION
    )
      throw new Error("存档格式不兼容，请使用 v0.2 导出的记录。");
    if (save.engineVersion !== ENGINE_VERSION)
      throw new Error(
        `存档来自引擎 ${String(save.engineVersion).slice(0, 24)}，当前为 ${ENGINE_VERSION}，暂不支持跨版本重放。`,
      );
    if (
      typeof save.seed !== "string" ||
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
    const world = new World(save.seed);
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

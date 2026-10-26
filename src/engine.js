(function (root) {
  const names = [
    "林夏",
    "周屿",
    "陈默",
    "许知遥",
    "沈星",
    "陆川",
    "苏棠",
    "江野",
    "温言",
    "顾北",
  ];
  const places = ["宿舍", "教学楼", "食堂", "图书馆", "社团中心"];
  const slots = ["清晨", "午间", "午后", "夜晚"];
  class World {
    constructor(seed = "campus-2026") {
      this.seed = String(seed);
      this.rng = 2166136261;
      for (const c of this.seed)
        this.rng = Math.imul(this.rng ^ c.charCodeAt(0), 16777619) >>> 0;
      this.tick = 0;
      this.events = [];
      this.inputs = [];
      this.rooms = Array.from({ length: 10 }, (_, i) => Math.floor(i / 2));
      this.groups = Array.from({ length: 10 }, (_, i) => i % 3);
      this.party = -1;
      this.npcs = names.map((name, id) => ({
        id,
        name,
        ext: this.rand(),
        sensitive: this.rand(),
        ambition: this.rand(),
        goal: ["结交朋友", "争取奖学金", "寻找归属"][id % 3],
        energy: 65 + this.rand() * 25,
        hunger: 20 + this.rand() * 25,
        social: 25 + this.rand() * 35,
        progress: 0,
        loc: 0,
        action: "刚刚醒来",
        why: "新的一周开始了",
        memory: [],
        rel: Array.from({ length: 10 }, () => ({ aff: 0, trust: 0, crush: 0 })),
        last: null,
      }));
      this.log("开学了。十个人的七天，开始交织。", "system", [], [], {
        seed: this.seed,
      });
    }
    rand() {
      this.rng = (this.rng + 0x6d2b79f5) >>> 0;
      let t = this.rng;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    log(text, type, people = [], parents = [], data = {}) {
      let e = {
        id: this.events.length + 1,
        tick: this.tick,
        text,
        type,
        people,
        parents: parents.filter(Boolean),
        data,
      };
      this.events.push(e);
      return e.id;
    }
    remember(n, id) {
      n.memory.unshift(id);
      n.memory = n.memory.slice(0, 8);
      n.last = id;
    }
    intervene(kind, record = true) {
      if (this.tick >= 28) return false;
      if (record) this.inputs.push({ tick: this.tick, kind });
      let text;
      if (kind === "rooms") {
        this.rooms = this.shuffle(
          Array.from({ length: 10 }, (_, i) => Math.floor(i / 2)),
        );
        text = "宿舍重新分配：新的室友将改变夜间相遇机会。";
      } else if (kind === "groups") {
        this.groups = this.shuffle(Array.from({ length: 10 }, (_, i) => i % 3));
        text = "课程随机分组：新的小组将影响下次课堂合作。";
      } else if (kind === "party") {
        this.party = this.tick;
        text = "社团开放日：下一时段，社团中心对所有人开放。";
      } else return false;
      this.envEvent = this.log(text, "intervention", [], [], {
        kind,
        rooms: [...this.rooms],
        groups: [...this.groups],
      });
      return true;
    }
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        let j = Math.floor(this.rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    step() {
      if (this.tick >= 28) return false;
      const slot = this.tick % 4;
      for (const n of this.npcs) {
        n.hunger = Math.min(100, n.hunger + 17);
        n.energy = Math.max(0, n.energy - 12);
        n.social = Math.min(100, n.social + 11);
        let options = [
          {
            loc: 0,
            action: "休息",
            score: (100 - n.energy) * 0.85 + (slot === 3 ? 30 : 0),
            reason: "精力不足，需要休息",
          },
          { loc: 2, action: "吃饭", score: n.hunger, reason: "饥饿需求优先" },
          {
            loc: 1,
            action: "上课",
            score: (slot === 0 ? 65 : 10) + n.ambition * 22,
            reason: "课程安排与学业目标",
          },
          {
            loc: 3,
            action: "自习",
            score: 30 + n.ambition * 28 + (n.goal === "争取奖学金" ? 20 : 0),
            reason: "学业目标与进取心",
          },
          {
            loc: 4,
            action: "参加社团",
            score:
              n.social * 0.6 + n.ext * 28 + (this.party === this.tick ? 65 : 0),
            reason:
              this.party === this.tick
                ? "开放日提高了社交吸引力"
                : "社交需求与外向性",
          },
        ];
        options.forEach((o) => (o.score += this.rand() * 18));
        options.sort((a, b) => b.score - a.score);
        const a = options[0];
        let prev = n.last;
        n.loc = a.loc;
        n.action = a.action;
        n.why = a.reason;
        n.energy = clamp(n.energy + (a.loc === 0 ? 42 : 0));
        n.hunger = clamp(n.hunger - (a.loc === 2 ? 65 : 0));
        if (a.loc === 1 || a.loc === 3)
          n.progress += 4 + Math.round(n.ambition * 5);
        let e = this.log(
          `${n.name}前往${places[a.loc]}${a.action}。`,
          "action",
          [n.id],
          [prev, this.envEvent],
          {
            reason: a.reason,
            scores: options.map((o) => ({
              action: o.action,
              score: +o.score.toFixed(1),
            })),
          },
        );
        this.remember(n, e);
      }
      const order = this.shuffle([...this.npcs]);
      const paired = new Set();
      for (const a of order) {
        if (paired.has(a.id)) continue;
        let peers = order.filter(
          (b) =>
            b.id !== a.id &&
            !paired.has(b.id) &&
            b.loc === a.loc &&
            (a.loc !== 0 || this.rooms[a.id] === this.rooms[b.id]),
        );
        if (!peers.length) continue;
        let b = peers[Math.floor(this.rand() * peers.length)];
        paired.add(a.id);
        paired.add(b.id);
        let r = a.rel[b.id],
          s = b.rel[a.id];
        let bias = a.memory.filter((id) => {
          let e = this.events[id - 1];
          return e.people.includes(b.id) && e.type === "misunderstanding";
        }).length;
        let chance = 0.13 + a.sensitive * 0.17 + bias * 0.055;
        let roll = this.rand();
        let type, delta, story, reason;
        if (r.aff < 0 && roll > 0.48) {
          type = "repair";
          delta = 9;
          story = "把之前的话说开了";
          reason = "再次相遇且关系紧张，获得澄清机会";
        } else if (roll < chance) {
          type = "misunderstanding";
          delta = -9;
          story = "因一句没说清的话产生误解";
          reason = `敏感度与负面记忆形成误读概率 ${Math.round(chance * 100)}%`;
        } else if (
          (a.loc === 1 || a.loc === 3) &&
          Math.abs(a.ambition - b.ambition) > 0.35
        ) {
          type = "rivalry";
          delta = -4;
          story = "为学业表现暗暗较劲";
          reason = "同处学习地点，进取心差异大于 0.35";
        } else if (r.aff > 14 && a.ext > 0.35 && roll > 0.48) {
          type = "crush";
          delta = 7;
          r.crush = clamp(r.crush + 16);
          story = "开始在意对方的每一个小动作";
          reason = "熟悉度超过 14，外向性与本次随机检定触发单向心动";
        } else {
          type = "friendship";
          delta = 7;
          story =
            a.loc === 1 && this.groups[a.id] === this.groups[b.id]
              ? "在小组合作中找到了默契"
              : "聊了一会儿，发现彼此有点合拍";
          reason = "同地点相遇，未触发冲突或竞争规则";
        }
        let bonus =
          a.loc === 1 && this.groups[a.id] === this.groups[b.id] && delta > 0
            ? 4
            : 0;
        r.aff = clamp(r.aff + delta + bonus, -100);
        s.aff = clamp(s.aff + delta + bonus, -100);
        r.trust = clamp(r.trust + (delta > 0 ? 4 : -6), -100);
        s.trust = clamp(s.trust + (delta > 0 ? 3 : -4), -100);
        a.social = clamp(a.social - 30);
        b.social = clamp(b.social - 30);
        let e = this.log(
          `${a.name}与${b.name}${story}。`,
          type,
          [a.id, b.id],
          [a.last, b.last, this.envEvent],
          {
            reason,
            delta: delta + bonus,
            roll: +roll.toFixed(3),
            location: places[a.loc],
          },
        );
        this.remember(a, e);
        this.remember(b, e);
      }
      this.envEvent = null;
      this.tick++;
      if (this.tick % 4 === 0) {
        let day = this.tick / 4,
          stories = this.events.filter(
            (e) =>
              e.tick >= this.tick - 4 &&
              e.tick < this.tick &&
              e.people.length === 2,
          );
        this.log(
          `第 ${day} 天手记：${stories.length} 次交集，${stories.filter((e) => e.type === "crush").length} 次心动，${stories.filter((e) => e.type === "misunderstanding").length} 次误解。`,
          "summary",
          [],
          stories.map((e) => e.id),
        );
      }
      return true;
    }
    replay() {
      let w = new World(this.seed);
      while (w.tick < this.tick) {
        for (const x of this.inputs.filter((x) => x.tick === w.tick))
          w.intervene(x.kind);
        w.step();
      }
      for (const x of this.inputs.filter((x) => x.tick === this.tick))
        w.intervene(x.kind);
      return w;
    }
  }
  function clamp(v, min = 0) {
    return Math.max(min, Math.min(100, v));
  }
  const api = { World, names, places, slots };
  if (typeof module !== "undefined") module.exports = api;
  else root.Campus = api;
})(typeof window !== "undefined" ? window : globalThis);

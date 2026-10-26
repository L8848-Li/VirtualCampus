<script setup lang="ts">
import { computed } from "vue";
import { places, profiles } from "../core/config.ts";
import type { WorldSnapshot } from "../core/types.ts";
import { clock, labels, relationLabel } from "../ui/format.ts";
import AvatarIcon from "./AvatarIcon.vue";
const props = defineProps<{
  world: WorldSnapshot;
  selected: number;
  watched: number[];
}>();
defineEmits<{
  select: [id: number];
  watch: [id: number];
  event: [id: number];
}>();
const n = computed(() => props.world.npcs[props.selected]);
const relationships = computed(() =>
  n.value.rel
    .map((r, i) => ({ r, i }))
    .filter((x) => x.i !== n.value.id)
    .sort(
      (a, b) => Math.abs(b.r.aff) + b.r.crush - Math.abs(a.r.aff) - a.r.crush,
    )
    .slice(0, 3),
);
const planLabels = {
  pending: "记在心里",
  waiting: "正在等人",
  working: "专注进行",
  fulfilled: "已经兑现",
  cancelled: "改了安排",
  expired: "这次错过了",
};
const observations = computed(() =>
  Object.entries(n.value.known).filter(
    ([, k]) => props.world.tick - k.tick <= 4,
  ),
);
const beliefs = computed(() => [...n.value.beliefs].sort((a, b) =>
  Number(a.status === 'revised') - Number(b.status === 'revised') || b.updatedTick - a.updatedTick).slice(0, 3));
</script>
<template>
  <aside class="panel person-panel">
    <div class="panelhead">
      <h2>他们是谁 <small>TEN LITTLE WORLDS</small></h2>
      <span>{{ String(selected + 1).padStart(2, "0") }} / 10</span>
    </div>
    <div id="roster">
      <button
        v-for="person in world.npcs"
        :key="person.id"
        class="roster-person"
        :class="{ selected: person.id === selected }"
        :aria-label="`选择${person.name}`"
        :aria-pressed="person.id === selected"
        @click="$emit('select', person.id)"
      >
        <span class="portrait" :style="{ '--c': profiles[person.id].color }"
          ><AvatarIcon :id="person.id" /></span
        ><span
          >{{ person.name }}<small>{{ places[person.loc] }}</small></span
        >
      </button>
    </div>
    <div id="profile">
      <div class="identity">
        <span class="portrait" :style="{ '--c': profiles[n.id].color }"
          ><AvatarIcon :id="n.id"
        /></span>
        <div>
          <span class="eyebrow">{{ n.role }}</span>
          <h3>{{ n.name }}</h3>
          <p>{{ places[n.loc] }} · {{ n.action }}</p>
        </div>
        <button
          class="watch-button"
          :class="{ active: watched.includes(n.id) }"
          :aria-label="`${watched.includes(n.id) ? '取消关注' : '关注'}${n.name}`"
          @click="$emit('watch', n.id)"
        >
          {{ watched.includes(n.id) ? "★" : "☆" }}
        </button>
      </div>
      <div class="tags">
        <span>{{ n.interest }}</span
        ><span>{{ n.ext > 0.55 ? "外向" : "慢热" }}</span
        ><span>{{ n.sensitive > 0.6 ? "细腻" : "豁达" }}</span>
      </div>
      <p class="quirk">“{{ n.quirk }}。”</p>
      <div class="thought">
        <small>此刻为什么这么做</small>
        <p>{{ n.why }}</p>
        <strong>{{ n.interaction }}</strong>
      </div>
      <div class="needs">
        <div
          v-for="stat in [
            { name: '精力', value: n.energy, cls: 'energy' },
            { name: '饥饿', value: n.hunger, cls: 'hunger' },
            { name: '社交需求', value: n.social, cls: 'social' },
          ]"
          :key="stat.cls"
          class="stat"
        >
          <span>{{ stat.name }}</span>
          <div class="bar" :class="stat.cls">
            <i :style="{ width: stat.value + '%' }"></i>
          </div>
          <b>{{ Math.round(stat.value) }}</b>
        </div>
      </div>
      <div class="minor-stats">
        <span>目标 {{ n.goal }}</span
        ><span>学业 {{ n.progress }}</span
        ><span
          >宿舍 {{ world.rooms[n.id] + 1 }} · 小组
          {{ world.groups[n.id] + 1 }}</span
        >
      </div>
      <div v-if="n.plan" class="personal-plan" :class="n.plan.stage">
        <small>心里挂着的小计划 · {{ planLabels[n.plan.stage] }}</small>
        <p>
          {{
            n.plan.kind === "appointment"
              ? `与${world.npcs[n.plan.target!].name}在${clock(n.plan.dueTick)}一起吃饭`
              : "给自己留两个时段，整理小组报告资料"
          }}
        </p>
        <button class="text-button" @click="$emit('event', n.plan.lastEvent)">
          它是怎么开始的 ↗
        </button>
      </div>
      <h4>关系近况</h4>
      <button
        v-for="{ r, i } in relationships"
        :key="i"
        class="relationship-row"
        @click="$emit('select', i)"
      >
        <span>{{ world.npcs[i].name }}</span
        ><small>{{ relationLabel(r) }}</small
        ><b>{{ r.aff > 0 ? "+" : "" }}{{ r.aff }}</b>
      </button>
      <template v-if="beliefs.length">
        <h4>TA 心里的理解 <small>可能有误，也会改变</small></h4>
        <button v-for="belief in beliefs" :key="belief.id" class="memory belief-memory" @click="$emit('event', belief.evidence.at(-1) || belief.sourceEvent)">
          <small>{{ belief.status === 'revised' ? '重新理解' : '仍有疑问' }} · {{ clock(belief.updatedTick) }}</small>
          <span>{{ belief.resolution || belief.claim }}</span>
        </button>
      </template>
      <h4>记得的片段 <small>按重要程度保留 · 最多 8 条</small></h4>
      <div class="memory-list">
        <button
          v-for="id in n.memory"
          :key="id"
          class="memory"
          @click="$emit('event', id)"
        >
          <small
            >{{ clock(world.events[id - 1].tick) }} ·
            {{ labels[world.events[id - 1].type] }}</small
          ><span>{{ world.events[id - 1].text }}</span>
        </button>
        <p v-if="!n.memory.length" class="empty">还在等第一次相遇。</p>
      </div>
      <details class="knowledge">
        <summary>TA 最近亲眼见到的人</summary>
        <p v-for="[id, k] in observations" :key="id">
          {{ world.npcs[Number(id)].name }} · {{ places[k.loc]
          }}<small
            >{{ clock(k.tick) }}{{ k.missed ? " · 再去时已不在" : "" }}</small
          >
        </p>
        <p v-if="!observations.length">还没有新的目击。</p>
      </details>
    </div>
  </aside>
</template>

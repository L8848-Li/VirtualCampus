<script setup lang="ts">
import { computed } from "vue";
import type { WorldSnapshot } from "../core/types.ts";
import { profiles } from "../core/config.ts";
const props = defineProps<{
  world: WorldSnapshot;
  selected: number;
  direction: "in" | "out";
}>();
defineEmits<{ select: [id: number]; direction: [value: "in" | "out"] }>();
const center = computed(() => props.world.npcs[props.selected]);
const nodes = computed(() =>
  props.world.npcs
    .filter((n) => n.id !== props.selected)
    .map((n, i) => {
      const angle = (i * Math.PI * 2) / (props.world.npcs.length - 1) - Math.PI / 2,
        x = 175 + Math.cos(angle) * 116,
        y = 145 + Math.sin(angle) * 105,
        r =
          props.direction === "out"
            ? center.value.rel[n.id]
            : n.rel[props.selected],
        color =
          r.crush > 0
            ? "#bf8198"
            : r.aff < 0
              ? "#b57d68"
              : r.aff > 0
                ? "#68977d"
                : "#d6dece",
        width = 1 + Math.min(4, Math.abs(r.aff) / 15 + r.crush / 20),
        x1 = props.direction === "out" ? 175 : x,
        y1 = props.direction === "out" ? 145 : y,
        x2 = props.direction === "out" ? x : 175,
        y2 = props.direction === "out" ? y : 145,
        distance = Math.hypot(x2 - x1, y2 - y1),
        ux = (x2 - x1) / distance,
        uy = (y2 - y1) / distance,
        start = props.direction === "out" ? 31 : 20,
        end = props.direction === "out" ? 22 : 33,
        tx = x2 - ux * end,
        ty = y2 - uy * end;
      return {
        n,
        r,
        x,
        y,
        color,
        width,
        sx: x1 + ux * start,
        sy: y1 + uy * start,
        tx,
        ty,
        arrow: `M${tx} ${ty}L${tx - ux * 7 - uy * 3} ${ty - uy * 7 + ux * 3}L${tx - ux * 7 + uy * 3} ${ty - uy * 7 - ux * 3}Z`,
      };
    }),
);
const rows = computed(() =>
  nodes.value
    .filter((x) => x.r.aff || x.r.crush || x.r.trust)
    .sort(
      (a, b) => Math.abs(b.r.aff) + b.r.crush - Math.abs(a.r.aff) - a.r.crush,
    )
    .slice(0, 5),
);
</script>
<template>
  <section class="panel relations-panel">
    <div class="panelhead">
      <h2>关系的形状 <small>CONNECTIONS</small></h2>
    </div>
    <div class="graph-controls">
      <button
        :class="{ active: direction === 'out' }"
        :aria-pressed="direction === 'out'"
        @click="$emit('direction', 'out')"
      >
        TA 看别人</button
      ><button
        :class="{ active: direction === 'in' }"
        :aria-pressed="direction === 'in'"
        @click="$emit('direction', 'in')"
      >
        别人看 TA
      </button>
    </div>
    <div id="graph">
      <svg
        viewBox="0 0 350 300"
        class="relationship-graph"
        :aria-label="`${center.name}${direction === 'out' ? '看待别人的关系' : '在别人眼中的关系'}`"
      >
        <g v-for="n in nodes" :key="`line${n.n.id}`">
          <line
            :x1="n.sx"
            :y1="n.sy"
            :x2="n.tx"
            :y2="n.ty"
            :stroke="n.color"
            :stroke-width="n.width"
            :stroke-dasharray="n.r.aff < 0 ? '4 4' : undefined"
          />
          <path :d="n.arrow" :fill="n.color" />
        </g>
        <g
          v-for="n in nodes"
          :key="n.n.id"
          role="button"
          tabindex="0"
          :aria-label="`查看${n.n.name}的关系`"
          @click="$emit('select', n.n.id)"
          @keydown.enter.prevent="$emit('select', n.n.id)"
          @keydown.space.prevent="$emit('select', n.n.id)"
        >
          <circle :cx="n.x" :cy="n.y" r="17" :fill="profiles[n.n.id].color" />
          <text
            :x="n.x"
            :y="n.y + 4"
            text-anchor="middle"
            fill="white"
            font-size="11"
          >
            {{ n.n.name.slice(-1) }}
          </text>
          <text
            :x="n.x"
            :y="n.y + 32"
            text-anchor="middle"
            fill="#52665b"
            font-size="10"
          >
            {{ n.n.name }}
          </text>
        </g>
        <circle cx="175" cy="145" r="28" :fill="profiles[selected].color" />
        <text x="175" y="149" text-anchor="middle" fill="white" font-size="12">
          {{ center.name }}
        </text>
      </svg>
      <div class="graph-legend">
        <span>● 亲近</span><span>┄ 紧张</span><span>♡ 心动</span>
      </div>
      <div class="relation-values">
        <button
          v-for="n in rows"
          :key="n.n.id"
          @click="$emit('select', n.n.id)"
        >
          <b>{{ n.n.name }}</b
          ><span
            >好感 {{ n.r.aff }} · 信任 {{ n.r.trust }} · 心动
            {{ n.r.crush }}</span
          >
        </button>
        <p v-if="!rows.length" class="empty">第一段关系，正等待一次相遇。</p>
      </div>
    </div>
  </section>
</template>

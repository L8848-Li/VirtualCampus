<script setup lang="ts">
import { computed } from "vue";
import type { WorldSnapshot } from "../core/types.ts";
const props = defineProps<{ world: WorldSnapshot }>();
defineEmits<{ event: [id: number] }>();
const summaries = computed(() =>
  props.world.events
    .filter((e) => e.type === "summary")
    .slice()
    .reverse(),
);
</script>
<template>
  <section class="panel wall-panel">
    <div class="panelhead">
      <h2>校园墙 <small>DAY BY DAY</small></h2>
      <span>每日片段</span>
    </div>
    <div id="wall">
      <article v-for="e in summaries" :key="e.id" class="wallitem">
        <div class="eyebrow">
          DAY {{ String(e.data.day).padStart(2, "0") }} / 校园手记
        </div>
        <h3>
          {{
            e.data.counts?.crushes
              ? "有些期待，藏在下一次见面里。"
              : e.data.counts?.misunderstandings
                ? "有些话，还在等一个解释的机会。"
                : "普通的一天，也在慢慢靠近。"
          }}
        </h3>
        <p>
          {{ e.data.counts?.meetings }} 次交集 ·
          {{ e.data.counts?.invitations }} 次邀约 ·
          {{ e.data.counts?.crushes }} 次心动 ·
          {{ e.data.counts?.plansFulfilled || 0 }} 次兑现 ·
          {{ e.data.counts?.tasksCompleted || 0 }} 份报告完成
        </p>
        <button
          v-for="id in e.parents"
          :key="id"
          class="memory"
          @click="$emit('event', id)"
        >
          {{ world.events[id - 1].text }}
        </button>
      </article>
      <div v-if="!summaries.length" class="empty wall-empty">
        <span>✎</span>
        <p>等今天结束，再把故事写下来。</p>
        <small>每四个时段，留下一页校园手记。</small>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { WorldSnapshot, EventFilter } from "../core/types.ts";
import { filterEvents, clock, labels } from "../ui/format.ts";
const props = defineProps<{
  world: WorldSnapshot;
  filter: EventFilter;
  selected: number;
  watched: number[];
}>();
defineEmits<{ event: [id: number]; filter: [value: EventFilter] }>();
const events = computed(() =>
  filterEvents(props.world.events, props.filter, props.selected, props.watched),
);
</script>
<template>
  <section class="panel timeline">
    <div class="panelhead">
      <h2>故事正在发生 <small>THE LITTLE THINGS</small></h2>
      <select
        :value="filter"
        aria-label="事件筛选"
        @change="
          $emit(
            'filter',
            ($event.target as HTMLSelectElement).value as EventFilter,
          )
        "
      >
        <option value="important">值得留意</option>
        <option value="stories">所有关系故事</option>
        <option value="watched">我关注的人</option>
        <option value="selected">所选角色</option>
        <option value="all">全部事件</option>
      </select>
    </div>
    <div id="events">
      <article
        v-for="e in events"
        :key="e.id"
        class="event"
        :class="`type-${e.type}`"
      >
        <div class="event-stamp">
          <span>{{ labels[e.type] }}</span
          ><time>{{
            e.type === "summary" ? `第 ${e.data.day} 天手记` : clock(e.tick)
          }}</time>
        </div>
        <p>{{ e.text }}</p>
        <button class="text-button" @click="$emit('event', e.id)">
          为什么发生 ↗
        </button>
      </article>
      <p v-if="!events.length" class="empty">
        这里会留下值得留意的变化。先推进一个时段吧。
      </p>
    </div>
  </section>
</template>

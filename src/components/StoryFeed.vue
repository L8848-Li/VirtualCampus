<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { WorldSnapshot, EventFilter } from "../core/types.ts";
import { filterEvents, clock, labels } from "../ui/format.ts";
import { EVENT_PAGE_SIZE, pageIndex, pageItems, pageContaining } from '../ui/pagination.ts';
const props = defineProps<{
  world: WorldSnapshot;
  filter: EventFilter;
  selected: number;
  watched: number[];
  focusId?: number | null;
}>();
const page = ref(0), root = ref<HTMLElement>();
const navigationFilter = ref<EventFilter | null>(null);
const returnPosition = ref<{ page: number; scroll: number } | null>(null);
defineEmits<{ event: [id: number]; filter: [value: EventFilter] }>();
const events = computed(() =>
  filterEvents(props.world.events, navigationFilter.value ?? props.filter, props.selected, props.watched),
);
const currentPage = computed(() => pageIndex(page.value, events.value.length, EVENT_PAGE_SIZE));
const visible = computed(() => pageItems(events.value, currentPage.value, EVENT_PAGE_SIZE));
const pages = computed(() => Math.max(1, Math.ceil(events.value.length / EVENT_PAGE_SIZE)));
function resetNavigation() { page.value = 0; returnPosition.value = null; navigationFilter.value = null; }
watch(() => [props.filter, props.selected, props.watched.join(',')] as const, resetNavigation);
watch(() => props.world.events[0], resetNavigation);
watch(() => props.focusId, async id => {
  if (!id) return;
  returnPosition.value ??= { page: currentPage.value, scroll: window.scrollY };
  if (!events.value.some(event => event.id === id)) navigationFilter.value = 'all';
  const target = pageContaining(events.value.map(event => event.id), id, EVENT_PAGE_SIZE);
  if (target === undefined) return;
  page.value = target;
  await nextTick();
  root.value?.querySelector<HTMLElement>(`[data-event-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
});
async function goBack() {
  if (!returnPosition.value) return;
  page.value = returnPosition.value.page;
  navigationFilter.value = null;
  const scroll = returnPosition.value.scroll;
  returnPosition.value = null;
  await nextTick(); window.scrollTo({ top: scroll });
}
</script>
<template>
  <section ref="root" class="panel timeline">
    <div class="panelhead">
      <h2>故事正在发生 <small>THE LITTLE THINGS</small></h2>
      <select
        :value="navigationFilter ?? filter"
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
        v-for="e in visible"
        :key="e.id"
        :data-event-id="e.id"
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
    <nav class="pagination" aria-label="事件分页">
      <button :disabled="currentPage === 0" @click="page = currentPage - 1">上一页</button>
      <span>第 {{ currentPage + 1 }} / {{ pages }} 页 · {{ events.length }} 条</span>
      <button :disabled="currentPage + 1 >= pages" @click="page = currentPage + 1">下一页</button>
      <button v-if="returnPosition" @click="goBack">返回原位置</button>
      <small v-if="navigationFilter">因果定位 · 临时显示全部事件</small>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { LocationId, WorldSnapshot } from "../core/types.ts";
import { profiles } from "../core/config.ts";
import { MIN_ZOOM, MAX_ZOOM, clampPan, clampZoom, zoomAround, type Point, type Size } from "../ui/mapViewport.ts";
import AvatarIcon from "./AvatarIcon.vue";

const props = defineProps<{
  world: WorldSnapshot;
  selected: number;
  watched: number[];
  follow: boolean;
  duration: number;
}>();
const emit = defineEmits<{ select: [id: number] }>();
const mapImage = `${import.meta.env.BASE_URL}maps/shahe-campus-2025.jpg`;
// Positions are percentages of the full, unmodified 2132 × 1600 source image.
const locations: { id: LocationId; name: string; x: number; y: number }[] = [
  { id: 0, name: "学生公寓（雁南园）", x: 34.2, y: 77.1 },
  { id: 1, name: "公共教学楼", x: 48.4, y: 67.1 },
  { id: 2, name: "学生餐厅", x: 45.3, y: 87.4 },
  { id: 3, name: "图书馆", x: 65.9, y: 46.6 },
  { id: 4, name: "学生活动中心", x: 52.6, y: 50.5 },
];
const viewport = ref<HTMLElement>();
const zoom = ref(MIN_ZOOM);
const pan = ref<Point>({ x: 0, y: 0 });
const selectedLocation = ref<LocationId | null>(null);
const dragging = ref(false);
let dragStart: { pointer: number; x: number; y: number; pan: Point } | null = null;
let observer: ResizeObserver | undefined;
const groups = computed(() => locations.map((location) => {
  const members = props.world.npcs.filter((n) => n.loc === location.id);
  const featured = members.find((n) => n.id === props.selected) || members[0];
  return { ...location, members, featured };
}));
const currentGroup = computed(() => groups.value.find((group) => group.id === selectedLocation.value));
const size = (): Size => ({ width: viewport.value?.clientWidth || 0, height: viewport.value?.clientHeight || 0 });
function setZoom(value: number, pivot?: Point) {
  const dimensions = size();
  if (!dimensions.width || !dimensions.height) return;
  const next = clampZoom(value);
  const focus = pivot || { x: dimensions.width / 2, y: dimensions.height / 2 };
  pan.value = zoomAround(pan.value, zoom.value, next, dimensions, focus);
  zoom.value = next;
}
function resetMap() { zoom.value = MIN_ZOOM; pan.value = { x: 0, y: 0 }; }
function focusLocation(id: LocationId, scrollToMap = false) {
  const dimensions = size();
  if (!dimensions.width || !dimensions.height) return;
  const location = locations[id];
  zoom.value = Math.max(zoom.value, 2);
  pan.value = clampPan({ x: dimensions.width * (0.5 - location.x / 100 * zoom.value),
    y: dimensions.height * (0.5 - location.y / 100 * zoom.value) }, zoom.value, dimensions);
  if (scrollToMap) viewport.value?.scrollIntoView({ behavior: "auto", block: "center" });
}
function onWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const rect = viewport.value!.getBoundingClientRect();
  setZoom(zoom.value + (event.deltaY < 0 ? 0.25 : -0.25), { x: event.clientX - rect.left, y: event.clientY - rect.top });
}
function startDrag(event: PointerEvent) {
  if (event.button !== 0 || zoom.value <= MIN_ZOOM || (event.target instanceof Element && event.target.closest("button"))) return;
  dragStart = { pointer: event.pointerId, x: event.clientX, y: event.clientY, pan: { ...pan.value } };
  dragging.value = true;
  viewport.value?.setPointerCapture(event.pointerId);
}
function moveDrag(event: PointerEvent) {
  if (!dragStart || dragStart.pointer !== event.pointerId) return;
  pan.value = clampPan({ x: dragStart.pan.x + event.clientX - dragStart.x, y: dragStart.pan.y + event.clientY - dragStart.y }, zoom.value, size());
}
function endDrag(event: PointerEvent) {
  if (dragStart?.pointer !== event.pointerId) return;
  if (viewport.value?.hasPointerCapture(event.pointerId)) viewport.value.releasePointerCapture(event.pointerId);
  dragStart = null;
  dragging.value = false;
}
function cancelDrag() { dragStart = null; dragging.value = false; }
function moveWithKeyboard(event: KeyboardEvent) {
  const direction: Record<string, Point> = { ArrowLeft: { x: 55, y: 0 }, ArrowRight: { x: -55, y: 0 },
    ArrowUp: { x: 0, y: 55 }, ArrowDown: { x: 0, y: -55 } };
  if (zoom.value <= MIN_ZOOM || !direction[event.key] || event.target !== viewport.value) return;
  event.preventDefault();
  pan.value = clampPan({ x: pan.value.x + direction[event.key].x, y: pan.value.y + direction[event.key].y }, zoom.value, size());
}
watch(() => [props.follow, props.selected, props.world.npcs[props.selected]?.loc] as const, ([follow, , location]) => {
  if (follow && location !== undefined) {
    selectedLocation.value = location;
    if (zoom.value > MIN_ZOOM) focusLocation(location);
  }
}, { immediate: true });
onMounted(() => {
  if (!viewport.value || typeof ResizeObserver === "undefined") return;
  observer = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width && entry.contentRect.height) pan.value = clampPan(pan.value, zoom.value, size());
  });
  observer.observe(viewport.value);
});
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div class="campus-viewer">
    <div class="map-tools" aria-label="地图缩放控制">
      <div><strong>沙河校区</strong><small>点击地点查看在场人物</small></div>
      <div class="zoom-controls">
        <button type="button" :disabled="zoom <= MIN_ZOOM" aria-label="缩小地图" @click="setZoom(zoom - 0.5)">−</button>
        <span aria-live="polite">{{ zoom.toFixed(1) }}×</span>
        <button type="button" :disabled="zoom >= MAX_ZOOM" aria-label="放大地图" @click="setZoom(zoom + 0.5)">＋</button>
        <button type="button" @click="resetMap">查看全图</button>
      </div>
    </div>
    <div ref="viewport" id="map" class="shahe-viewport" :class="{ pannable: zoom > MIN_ZOOM, dragging }"
      tabindex="0" aria-label="沙河校区地图：放大后可拖动或使用方向键平移，按住 Ctrl 或 Command 并滚动可以缩放"
      @wheel="onWheel" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="cancelDrag" @keydown="moveWithKeyboard">
      <div class="shahe-map-stage" :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }">
        <img class="shahe-reference" :src="mapImage" draggable="false" alt="北京邮电大学沙河校区示意图，北邮人团队 2025 年 8 月制" />
        <button v-for="group in groups.filter((item) => item.members.length > 0)" :key="group.id" type="button" class="location-marker"
          :class="{ active: selectedLocation === group.id, watched: group.members.some((n) => watched.includes(n.id)) }"
          :style="{ left: `${group.x}%`, top: `${group.y}%`, transform: `scale(${1 / zoom}) translate(-50%, -50%)` }"
          :aria-label="`${group.name}，${group.members.length} 人，展开在场名单`"
          :aria-pressed="selectedLocation === group.id" :title="`${group.name} · ${group.members.length} 人`"
          @click.stop="selectedLocation = group.id">
          <span v-if="group.featured" class="marker-avatar" :style="{ '--c': profiles[group.featured.id].color }"><AvatarIcon :id="group.featured.id" /></span>
          <span class="marker-count">{{ group.members.length }} 人</span>
        </button>
      </div>
    </div>
    <p class="map-help">放大后拖动地图；按住 Ctrl 或 Command 滚动也可缩放。圈点上的人数会随人物行动变化。</p>
    <div class="place-list" aria-label="模拟地点">
      <button v-for="group in groups" :key="group.id" type="button" :class="{ active: selectedLocation === group.id }"
        :aria-pressed="selectedLocation === group.id" @click="selectedLocation = group.id">
        {{ group.name }} <small>{{ group.members.length }} 人</small>
      </button>
    </div>
    <section v-if="currentGroup" class="place-detail" :aria-label="`${currentGroup.name}在场人物`">
      <div class="place-detail-head"><div><strong>{{ currentGroup.name }}</strong><small>此刻 {{ currentGroup.members.length }} 人</small></div>
        <div><button type="button" class="text-button" @click="focusLocation(currentGroup.id, true)">定位并放大</button><button type="button" class="text-button" aria-label="收起地点名单" @click="selectedLocation = null">收起 ×</button></div></div>
      <div v-if="currentGroup.members.length" class="place-roster">
        <button v-for="person in currentGroup.members" :key="person.id" type="button" :class="{ selected: selected === person.id }" @click="emit('select', person.id)">
          <span class="place-avatar" :style="{ '--c': profiles[person.id].color }"><AvatarIcon :id="person.id" /></span>
          <span><strong>{{ person.name }}</strong><small>{{ person.action }} · {{ person.interaction }}</small></span>
          <span v-if="watched.includes(person.id)" aria-label="已关注">★</span>
        </button>
      </div>
      <p v-else class="place-empty">这里暂时没有人物。过一会儿再来看看。</p>
    </section>
  </div>
</template>

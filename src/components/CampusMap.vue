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
  selectedPlace: LocationId | null;
}>();
const emit = defineEmits<{ place: [id: LocationId] }>();
const mapImage = `${import.meta.env.BASE_URL}maps/shahe-campus-2025.jpg`;
// Positions are percentages of the full, unmodified 2132 × 1600 source image.
const locations: { id: LocationId; name: string; x: number; y: number }[] = [
  { id: 0, name: "雁南园学生公寓", x: 34.2, y: 77.1 },
  { id: 1, name: "公共教学楼", x: 48.4, y: 67.1 },
  { id: 2, name: "学生餐厅", x: 45.3, y: 87.4 },
  { id: 3, name: "图书馆", x: 65.9, y: 46.6 },
  { id: 4, name: "学生活动中心", x: 52.6, y: 50.5 },
  { id: 6, name: "风味餐厅", x: 44, y: 41 },
  { id: 7, name: "运动场", x: 24.1, y: 45 },
  { id: 8, name: "教学实验综合楼", x: 65.6, y: 67 },
  { id: 9, name: "智慧教学楼", x: 81.3, y: 62 },
  { id: 10, name: "理学楼", x: 82, y: 88 },
  { id: 11, name: "综合办公楼", x: 52.5, y: 40 },
];
const viewport = ref<HTMLElement>();
const zoom = ref(MIN_ZOOM);
const pan = ref<Point>({ x: 0, y: 0 });

const dragging = ref(false);
let dragStart: { pointer: number; x: number; y: number; pan: Point } | null = null;
let observer: ResizeObserver | undefined;
const groups = computed(() => locations.map((location) => {
  const members = props.world.npcs.filter((n) => n.loc === location.id);
  const featured = members.find((n) => n.id === props.selected) || members[0];
  return { ...location, members, featured };
}));

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
  const location = locations.find((item) => item.id === id);
  if (!location) return;
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
        <button v-for="group in groups" :key="group.id" type="button" class="location-marker"
          :class="{ active: selectedPlace === group.id, watched: group.members.some((n) => watched.includes(n.id)) }"
          :style="{ left: `${group.x}%`, top: `${group.y}%`, transform: `scale(${1 / zoom}) translate(-50%, -50%)` }"
          :aria-label="`${group.name}，${group.members.length} 人，展开在场名单`"
          :aria-pressed="selectedPlace === group.id" :title="`${group.name} · ${group.members.length} 人`"
          @click.stop="emit('place', group.id)">
          <span v-if="group.featured" class="marker-avatar" :style="{ '--c': profiles[group.featured.id].color }"><AvatarIcon :id="group.featured.id" /></span>
          <span class="marker-count">{{ group.members.length ? `${group.members.length} 人` : "·" }}</span>
        </button>
      </div>
    </div>
    <p class="map-help">放大后拖动地图；按住 Ctrl 或 Command 滚动也可缩放。圈点上的人数会随人物行动变化。</p>
  </div>
</template>

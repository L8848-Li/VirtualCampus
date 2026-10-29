<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { LocationId, WorldSnapshot } from "../core/types.ts";
import { profiles } from "../core/config.ts";
import { MIN_ZOOM, MAX_ZOOM, clampPan, clampZoom, zoomAround, type Point, type Size } from "../ui/mapViewport.ts";
import { campusLocations as locations } from "../ui/campusLocations.ts";
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
const mapImage = `${import.meta.env.BASE_URL}maps/youyou-campus.svg`;
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
defineExpose({ zoomIn: () => setZoom(zoom.value + 0.5), zoomOut: () => setZoom(zoom.value - 0.5), resetMap });
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
  if (follow && location !== undefined) focusLocation(location);
}, { immediate: true });
onMounted(() => {
  if (props.follow && props.world.npcs[props.selected]) focusLocation(props.world.npcs[props.selected].loc);
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
      <div><strong>邮邮大学</strong><small>点击地点查看在场人物</small></div>
      <div class="zoom-controls">
        <button type="button" :disabled="zoom <= MIN_ZOOM" aria-label="缩小地图" @click="setZoom(zoom - 0.5)">−</button>
        <span aria-live="polite">{{ zoom.toFixed(1) }}×</span>
        <button type="button" :disabled="zoom >= MAX_ZOOM" aria-label="放大地图" @click="setZoom(zoom + 0.5)">＋</button>
        <button type="button" @click="resetMap">查看全图</button>
      </div>
    </div>
    <div ref="viewport" id="map" class="shahe-viewport" :class="{ pannable: zoom > MIN_ZOOM, dragging }"
      tabindex="0" aria-label="邮邮大学地图：放大后可拖动或使用方向键平移，按住 Ctrl 或 Command 并滚动可以缩放"
      @wheel="onWheel" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="cancelDrag" @keydown="moveWithKeyboard">
      <div class="shahe-map-stage" :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }">
        <img class="shahe-reference" :src="mapImage" draggable="false" alt="邮邮大学校园地图，根据沙河校区示意布局重新绘制" />
        <button v-for="group in groups" :key="group.id" type="button" class="location-marker"
          :class="{ active: selectedPlace === group.id, empty: !group.members.length, watched: group.members.some((n) => watched.includes(n.id)) }"
          :style="{ left: `${group.x}%`, top: `${group.y}%`, transform: group.members.length ? `scale(${1 / zoom}) translate(-50%, -50%)` : `scale(${1 / zoom}) translate(calc(-50% + 18px), calc(-50% - 14px))` }"
          :aria-label="`${group.name}，${group.members.length} 人，展开在场名单`"
          :aria-pressed="selectedPlace === group.id" :title="`${group.name} · ${group.members.length} 人`"
          @click.stop="emit('place', group.id)">
          <span v-if="group.featured" class="marker-avatar" :style="{ '--c': profiles[group.featured.id].color }"><AvatarIcon :id="group.featured.id" /></span>
          <span class="marker-count">{{ group.members.length ? `${group.members.length} 人` : "·" }}</span>
        </button>
      </div>
    </div>
    <p class="map-help">放大后拖动地图；按住 Ctrl 或 Command 滚动也可缩放。圈点上的人数会随人物行动变化。</p>
    <details class="map-directory">
      <summary>查看全部地点 · {{ groups.length }} 处</summary>
      <div class="place-list">
        <button v-for="group in groups" :key="group.id" type="button" :class="{ active: selectedPlace === group.id }"
          @click="focusLocation(group.id); emit('place', group.id)">{{ group.name }} <small>{{ group.members.length }} 人</small></button>
      </div>
    </details>
  </div>
</template>

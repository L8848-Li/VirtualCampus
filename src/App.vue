<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { createSimulation } from "./controller/simulation.ts";
import { places } from "./core/config.ts";
import { springCampusDay } from "./core/calendar.ts";
import { foodFestival } from "./core/foodFestival.ts";
import type { LocationId } from "./core/types.ts";
import { clock } from "./ui/format.ts";
import LibraryScene from "./components/LibraryScene.vue";
import BuildingScene from "./components/BuildingScene.vue";
import CampusMap from "./components/CampusMap.vue";
import PersonPanel from "./components/PersonPanel.vue";
import RelationshipGraph from "./components/RelationshipGraph.vue";
import CampusWall from "./components/CampusWall.vue";
import StoryFeed from "./components/StoryFeed.vue";
import TaskBoard from "./components/TaskBoard.vue";
import EventDialog from "./components/EventDialog.vue";
import StoryDeck from "./components/StoryDeck.vue";
import ActivityBoard from "./components/ActivityBoard.vue";
import { weatherAt } from "./core/weather.ts";
import { courses } from "./core/academics.ts";
const sim = createSimulation();
const {
  snapshot: world,
  view,
  seed,
  livingEnabled,
  speed,
  running,
  notice,
  saveState,
  detailId,
  helpOpen,
  done,
  canIntervene,
} = sim;
const fileInput = ref<HTMLInputElement>();
const page = ref<"campus" | "stories" | "academics">("campus");
const mapRef = ref<InstanceType<typeof CampusMap>>();
const toolPanel = ref<"events" | "watched" | "intervene" | null>(null);
function toggleTool(name: "events" | "watched" | "intervene") {
  toolPanel.value = toolPanel.value === name ? null : name;
}
function switchPage(name: "campus" | "stories" | "academics") {
  page.value = name;
  toolPanel.value = null;
}
const todayEvents = computed(() => {
  const currentDay = Math.floor(Math.max(0, world.value.tick - 1) / 4);
  return world.value.events.filter((event) => Math.floor(event.tick / 4) === currentDay && event.tick < world.value.tick && event.importance >= 3).slice(-8).reverse();
});
const selectedPlace = ref<LocationId | null>(null);
const sideView = ref<"overview" | "place" | "person">("overview");
const placePeople = computed(() => world.value.npcs.filter((n) => n.loc === selectedPlace.value));
function showPlace(id: LocationId) { selectedPlace.value = id; sideView.value = "place"; }
function selectPerson(id: number) { sim.select(id); sideView.value = "person"; }

const focusStoryId = ref<string | null>(null);
function showPerson(id: number) {
  selectPerson(id);
  page.value = "campus";
  window.scrollTo({ top: 0, behavior: "auto" });
}
const day = computed(() =>
  String(Math.min(42, Math.floor(world.value.tick / 4) + 1)).padStart(2, "0"),
);
const selectedEvent = computed(() =>
  detailId.value ? world.value.events[detailId.value - 1] || null : null,
);
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await sim.importFile(file);
  input.value = "";
}
function closeToolsOnEscape(event: KeyboardEvent) {
  if (event.key === "Escape") toolPanel.value = null;
}
onMounted(() => window.addEventListener("keydown", closeToolsOnEscape));
onUnmounted(() => { window.removeEventListener("keydown", closeToolsOnEscape); sim.stop(); });
</script>
<template>
  <header class="app-header desktop-header">
    <a class="brand" href="#" @click.prevent="switchPage('campus')"><span>✳</span><b>邮邮大学<small>CAMPUS OBSERVATORY</small></b></a>
    <nav class="top-navigation" aria-label="主导航">
      <button :class="{ active: page === 'campus' }" :aria-current="page === 'campus' ? 'page' : undefined" @click="switchPage('campus')">校园观察</button>
      <button :class="{ active: page === 'stories' }" :aria-current="page === 'stories' ? 'page' : undefined" @click="switchPage('stories')">人物故事</button>
      <button :class="{ active: page === 'academics' }" :aria-current="page === 'academics' ? 'page' : undefined" @click="switchPage('academics')">学业</button>
    </nav>
    <div class="header-actions">
      <button class="text-button" @click="helpOpen = true">玩法说明</button>
      <details class="world-settings">
        <summary>存档与设置</summary>
        <div class="world-tools">
          <label>世界种子<input v-model="seed" maxlength="128" aria-label="世界种子" /></label>
          <label><input v-model="livingEnabled" type="checkbox" /> 新建世界启用预算、兼职与压力实验（默认关闭）</label>
          <div class="settings-buttons"><button @click="sim.reset">新建世界</button><button @click="sim.replay">↺ 重放</button><button @click="sim.exportFile">导出存档</button><button @click="fileInput?.click()">导入存档</button></div>
          <small>{{ saveState }}</small>
        </div>
      </details>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importFile" />
    </div>
  </header>
  <section class="world-status" aria-label="世界状态和模拟控制">
    <div class="status-location"><span class="status-orb"></span><div><b>邮邮大学</b><small>六周模拟观察 · {{ weatherAt(world.seed, Math.max(0, world.tick - 1)) }}（模拟）</small></div></div>
    <div class="status-time"><span>当前画面</span><strong>{{ world.tick ? clock(world.tick - 1) : '新的一周 · 开始前' }}</strong></div>
    <div class="status-next"><span>{{ done ? '观察已结束' : `下一步 · ${clock(world.tick)}` }}</span><small>{{ world.tick }} / 168 时段 · {{ running ? '播放中' : '已暂停' }}</small></div>
    <div class="status-playback playback">
      <button class="primary" :disabled="done" @click="sim.togglePlayback">{{ running ? 'Ⅱ 暂停' : '▶ 继续' }}</button>
      <button :disabled="done" @click="sim.singleStep">下一时段 →</button>
      <select :value="speed" aria-label="播放速度" @change="sim.changeSpeed(Number(($event.target as HTMLSelectElement).value))"><option value="2200">1×</option><option value="900">2×</option><option value="350">4×</option></select>
    </div>
  </section>
  <main>
    <p v-if="notice !== '干预改变环境；每个人依然有自己的打算。' && !notice.startsWith('已恢复本机存档')" id="notice" role="status">{{ notice }}</p>
    <div v-show="page === 'campus'" class="workspace">
      <section class="world-column">
        <section class="panel map-panel">
          <div class="panelhead">
            <h2>
              <span class="status-dot"></span>邮邮校园
              <small>校园观察</small>
            </h2>
            <span>点击地点，观察此刻的校园生活</span>
          </div>
          <CampusMap
            ref="mapRef"
            :world="world"
            :selected="view.selected"
            :watched="view.watched"
            :follow="view.follow"
            :duration="running ? Math.min(650, speed * 0.85) : 650"
            :selected-place="selectedPlace"
            @place="showPlace"
          />
          <div class="map-caption">
            <span>{{
              world.tick
                ? `画面记录：${clock(world.tick - 1)} · ${world.npcs.filter((n) => n.intent).length} 人正为具体的事行动`
                : "新的一周，大家正在整理开学行李。"
            }}</span
            ><span id="count">{{ world.tick }} / 168 时段</span>
          </div>
          <p class="map-reference">地图参考沙河校区示意布局重新绘制；校园内建筑按虚构已建状态呈现，圆点为开放的模拟地点。</p>
        </section>
      </section>
      <aside class="context-column">
        <div v-if="sideView === 'overview'" class="panel context-panel">
          <span class="context-kicker">CAMPUS OBSERVATION</span>
          <h2>从这里开始观察</h2>
          <p>点击地图上的地点，看看谁在这里，再走进他们的故事。</p>
          <div class="context-section"><h3>此刻在校园里</h3>
            <button v-for="person in world.npcs.slice(0, 4)" :key="person.id" class="context-person" @click="selectPerson(person.id)">
              <span><strong>{{ person.name }}</strong><small>{{ places[person.loc] }} · {{ person.action }}</small></span><b>→</b>
            </button>
          </div>
          <button class="context-link" @click="showPlace(0)">从学生公寓开始 →</button>
        </div>
        <div v-else-if="sideView === 'place' && selectedPlace !== null" class="panel context-panel">
          <button class="back-link" @click="sideView = 'overview'">← 校园概览</button>
          <span class="context-kicker">校园地点 / PLACE</span>
          <h2>{{ places[selectedPlace] }}</h2>
          <p>{{ placePeople.length ? `此刻有 ${placePeople.length} 人在这里，点开一个人看看。` : '此刻还没有人，时间向前走，也许会有人经过。' }}</p>
          <LibraryScene v-if="selectedPlace === 3" :world="world" @select="selectPerson" @event="detailId = $event" />
          <p v-if="selectedPlace === 2 || selectedPlace === 6 || selectedPlace === 13" class="dining-status">本时段在场 {{ placePeople.length }} 人 · 排队时间因取餐人数而变化，座位通常充足</p>
          <BuildingScene v-if="selectedPlace !== 3" :place="selectedPlace" :people="placePeople" :tick="Math.max(0, world.tick - 1)" @select="selectPerson" />
        </div>
        <template v-else>
          <button class="back-link side-back" @click="selectedPlace !== null ? sideView = 'place' : sideView = 'overview'">← {{ selectedPlace !== null ? places[selectedPlace] : '校园概览' }}</button>
          <PersonPanel :world="world" :selected="view.selected" :watched="view.watched"
            @select="selectPerson" @watch="sim.watch" @event="detailId = $event" />
        </template>
      </aside>
    </div>
    <section v-if="page === 'stories'" class="stories-view" aria-label="人物故事视图">
      <StoryDeck :world="world" :watched="view.watched" :focus-id="focusStoryId" @event="detailId = $event" @select="showPerson" />
      <ActivityBoard :world="world" @event="detailId = $event" />
      <TaskBoard :world="world" @event="detailId = $event" />
      <div class="observation-grid">
        <RelationshipGraph :world="world" :selected="view.selected" :direction="view.direction" @select="showPerson" @direction="sim.setDirection" />
        <CampusWall :world="world" @event="detailId = $event" />
      </div>
      <StoryFeed
      :world="world"
      :filter="view.filter"
      :selected="view.selected"
      :watched="view.watched"
      @event="detailId = $event"
      @filter="
        view.filter = $event;
        sim.persist();
      "
      />
    </section>
    <section v-if="page === 'academics'" class="academic-overview" aria-label="学业总览">
      <div class="academic-heading"><div><span class="eyebrow">SIX-WEEK SCENARIO</span><h1>六周的学业</h1><p>课程和练习均为模拟设定。人物会根据自己的状态安排时间。</p></div><span>第 {{ day }} / 42 天</span></div>
      <section class="panel semester-calendar"><h2>模拟学期日历</h2><div class="calendar-phases"><span v-for="week in 6" :key="week" :class="{ current: Math.floor(Math.min(world.tick, 167) / 28) + 1 === week }">第 {{ week }} 周 · {{ week === 3 ? '教学 · 测验与活动日' : week <= 4 ? '教学与作业' : week === 5 ? '考试' : '补考与重修' }}</span></div><p>第 {{ springCampusDay.day }} 天{{ springCampusDay.slot }} · {{ springCampusDay.name }}：{{ springCampusDay.description }} 地点：学生活动中心。</p><p>第 {{ Math.floor(foodFestival.tick / 4) + 1 }} 天午后 · {{ foodFestival.name }}：{{ foodFestival.description }}</p><p>这是六周压缩场景，日期、活动和课程为游戏设定，并非现实节假日。</p></section>
      <div class="academic-grid">
        <section class="panel academic-overview-card"><span class="context-kicker">WEEKLY SCHEDULE</span><h2>本周课程</h2><div v-for="course in courses" :key="course.id" class="academic-row"><div><strong>{{ course.name }}</strong><small>{{ course.id === 'programming' ? '部分人物修读' : '本科生修读' }} · 个人课表见人物档案</small></div><span>计划 {{ course.credits }} 学分</span></div><p>六周为压缩的虚构教学与考核场景；成绩和学分只代表游戏规则。</p></section>
        <section class="panel academic-overview-card"><span class="context-kicker">COURSEWORK</span><h2>课程练习</h2><p v-if="!world.homework.length">第一天上课后发布练习。</p><button v-for="item in world.homework" :key="item.id" class="academic-row academic-person" @click="showPerson(item.owner)"><div><strong>{{ world.npcs[item.owner].name }} · {{ item.title }}</strong><small>截止 {{ clock(item.deadline) }}</small></div><span>{{ item.status === 'completed' ? '已提交' : item.status === 'expired' ? '未按时完成' : `${item.progress} / ${item.required}` }}</span></button></section>
      </div>
    </section>
  </main>
  <aside v-if="toolPanel" class="tool-popover" :aria-label="toolPanel === 'events' ? '今日事件' : toolPanel === 'watched' ? '我的关注' : '世界干预'">
    <div class="tool-popover-head"><div><span class="context-kicker">{{ toolPanel === 'events' ? 'CAMPUS MOMENTS' : toolPanel === 'watched' ? 'FOLLOWING' : 'A LITTLE NUDGE' }}</span><h2>{{ toolPanel === 'events' ? '今日事件' : toolPanel === 'watched' ? '我的关注' : '轻轻拨动世界' }}</h2></div><button class="text-button" aria-label="关闭工具面板" @click="toolPanel = null">关闭 ×</button></div>
    <template v-if="toolPanel === 'events'"><p>这里记录已经发生的片段。</p><button v-for="event in todayEvents" :key="event.id" class="popover-row" @click="detailId = event.id; toolPanel = null"><small>{{ clock(event.tick) }}</small><span>{{ event.text }}</span></button><p v-if="!todayEvents.length" class="context-empty">今天还没有值得留意的事件。</p></template>
    <template v-else-if="toolPanel === 'watched'"><p>最多关注 3 人，可在人物档案中添加或取消。</p><button v-for="id in view.watched" :key="id" class="popover-row" @click="showPerson(id); toolPanel = null"><strong>{{ world.npcs[id].name }}</strong><span>{{ places[world.npcs[id].loc] }} · {{ world.npcs[id].action }}</span></button><p v-if="!view.watched.length" class="context-empty">还没有关注的人。点击地图或人物档案中的 ☆ 开始关注。</p></template>
    <template v-else><p>改变相遇机会，人物仍会自己决定。</p><button v-for="item in [{kind:'rooms',name:'宿舍重排',sub:'换一个室友，重新认识彼此'}, {kind:'groups',name:'课程随机分组',sub:'让不同的人尝试合作'}, {kind:'party',name:'社团开放日',sub:'下一时段多一个相遇理由'}]" :key="item.kind" class="popover-row" :disabled="!canIntervene" @click="sim.intervene(item.kind); toolPanel = null"><strong>{{ item.name }} →</strong><span>{{ item.sub }}</span></button></template>
  </aside>
  <nav class="bottom-bar" aria-label="观察工具">
    <div class="bottom-location"><span>✳</span><div><strong>校园观察室</strong><small>{{ saveState }}</small></div></div>
    <div class="bottom-tools">
      <div class="bottom-zoom" aria-label="地图缩放"><button aria-label="缩小地图" :disabled="page !== 'campus'" @click="mapRef?.zoomOut()">−</button><button aria-label="放大地图" :disabled="page !== 'campus'" @click="mapRef?.zoomIn()">＋</button><button :disabled="page !== 'campus'" @click="mapRef?.resetMap()">全图</button></div>
      <button :class="{ selected: view.follow }" :aria-pressed="view.follow" @click="sim.setFollow">◎ <span>跟随人物</span></button>
      <button :class="{ selected: toolPanel === 'events' }" :aria-expanded="toolPanel === 'events'" @click="toggleTool('events')">◷ <span>今日事件</span></button>
      <button :class="{ selected: toolPanel === 'watched' }" :aria-expanded="toolPanel === 'watched'" @click="toggleTool('watched')">☆ <span>我的关注</span><small v-if="view.watched.length">{{ view.watched.length }}</small></button>
      <button :class="{ selected: toolPanel === 'intervene' }" :aria-expanded="toolPanel === 'intervene'" @click="toggleTool('intervene')">✧ <span>世界干预</span></button>
    </div>
    <span class="bottom-version">六周观察 · {{ world.version }}</span>
  </nav>
  <EventDialog
    :event="selectedEvent"
    :help="helpOpen"
    :world="world"
    @close="
      detailId = null;
      helpOpen = false;
    "
    @event="detailId = $event"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from "vue";
import { createSimulation } from "./controller/simulation.ts";
import { slots, profiles, places } from "./core/config.ts";
import { clock } from "./ui/format.ts";
import CampusMap from "./components/CampusMap.vue";
import PersonPanel from "./components/PersonPanel.vue";
import RelationshipGraph from "./components/RelationshipGraph.vue";
import CampusWall from "./components/CampusWall.vue";
import StoryFeed from "./components/StoryFeed.vue";
import TaskBoard from "./components/TaskBoard.vue";
import EventDialog from "./components/EventDialog.vue";
import StoryDeck from "./components/StoryDeck.vue";
import ActivityBoard from "./components/ActivityBoard.vue";
import { buildStories } from "./core/stories.ts";
const sim = createSimulation();
const {
  snapshot: world,
  view,
  seed,
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
const page = ref<"campus" | "stories">("campus");
const focusStoryId = ref<string | null>(null);
const highlights = computed(() => buildStories(world.value).slice(0, 2));
async function openStory(id: string) {
  page.value = "stories";
  focusStoryId.value = null;
  await nextTick();
  focusStoryId.value = id;
}
function showPerson(id: number) {
  sim.select(id);
  page.value = "campus";
  window.scrollTo({ top: 0, behavior: "auto" });
}
const day = computed(() =>
  String(Math.min(7, Math.floor(world.value.tick / 4) + 1)).padStart(2, "0"),
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
onUnmounted(sim.stop);
</script>
<template>
  <header class="app-header">
    <a class="brand" href="#"
      ><span>✳</span><b>赛博校园<small>THE CAMPUS OBSERVATORY</small></b></a
    ><span class="edition">七日观察 / VOL. 004</span
    ><button class="text-button" @click="helpOpen = true">玩法与机制 ↗</button>
  </header>
  <main>
    <section class="intro">
      <div>
        <span class="eyebrow">北京邮电大学 · 沙河校区的校园生活</span>
        <h1>今天，谁会等谁一起走？</h1>
        <p>你可以改变环境。剩下的，让他们自己决定。</p>
      </div>
      <div class="calendar">
        <strong>{{ day }}</strong
        ><span
          >/ 07 天<b>{{
            done ? "七日观察结束" : `下一步 · ${slots[world.tick % 4]}`
          }}</b></span
        >
      </div>
    </section>
    <nav class="view-switch" aria-label="选择观察视图">
      <button type="button" :class="{ active: page === 'campus' }" :aria-pressed="page === 'campus'" @click="page = 'campus'">⌂ 校园观察</button>
      <button type="button" :class="{ active: page === 'stories' }" :aria-pressed="page === 'stories'" @click="page = 'stories'">✎ 人物故事</button>
    </nav>
    <section class="control-deck" aria-label="模拟控制">
      <div class="playback">
        <button class="primary" :disabled="done" @click="sim.togglePlayback">
          {{ running ? "Ⅱ 暂停" : "▶ 继续" }}</button
        ><button :disabled="done" @click="sim.singleStep">下一时段 →</button
        ><select
          :value="speed"
          aria-label="播放速度"
          @change="
            sim.changeSpeed(Number(($event.target as HTMLSelectElement).value))
          "
        >
          <option value="2200">1× 正常</option>
          <option value="900">2× 快速</option>
          <option value="350">4× 加速</option>
        </select>
      </div>
      <details class="world-settings">
        <summary>存档与设置</summary>
      <div class="world-tools">
        <label
          >种子
          <input v-model="seed" maxlength="128" aria-label="世界种子" /></label
        ><button @click="sim.reset">新建世界</button
        ><button @click="sim.replay">↺ 重放</button
        ><button @click="sim.exportFile">导出</button
        ><button @click="fileInput?.click()">导入</button
        ><input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          hidden
          @change="importFile"
        />
      </div>
      </details>
    </section>
    <p v-if="notice !== '干预改变环境；每个人依然有自己的打算。' && !notice.startsWith('已恢复本机存档')" id="notice" role="status">{{ notice }}</p>
    <div class="progress-row">
      <div class="week-progress" aria-label="七天模拟进度">
        <div
          v-for="d in 7"
          :key="d"
          class="day-progress"
          :class="{ complete: world.tick >= d * 4 }"
        >
          <span>D{{ d }}</span>
          <div>
            <i
              v-for="s in 4"
              :key="s"
              :class="{ done: world.tick > (d - 1) * 4 + s - 1 }"
            ></i>
          </div>
        </div>
      </div>
      <span>{{ saveState }}</span>
    </div>
    <div v-if="view.watched.length" class="watch-strip">
      <span>★ 我的关注 <small>最多 3 人</small></span>
      <div id="watchlist">
        <button
          v-for="id in view.watched"
          :key="id"
          class="watch-chip"
          :style="{ '--c': profiles[id].color }"
          @click="sim.select(id)"
        >
          <i></i><b>{{ world.npcs[id].name }}</b
          ><span
            >{{ places[world.npcs[id].loc] }} ·
            {{ world.npcs[id].interaction }}</span
          ></button
        >
      </div>
    </div>
    <div v-show="page === 'campus'" class="workspace">
      <section class="world-column">
        <section class="panel map-panel">
          <div class="panelhead">
            <h2>
              <span class="status-dot"></span>沙河校园
              <small>校园观察</small>
            </h2>
            <button
              :class="{ active: view.follow }"
              :aria-pressed="view.follow"
              @click="sim.setFollow"
            >
              ◎ 跟随观察
            </button>
          </div>
          <CampusMap
            :world="world"
            :selected="view.selected"
            :watched="view.watched"
            :follow="view.follow"
            :duration="running ? Math.min(650, speed * 0.85) : 650"
            @select="sim.select"
          />
          <div class="map-caption">
            <span>{{
              world.tick
                ? `画面记录：${clock(world.tick - 1)} · ${world.npcs.filter((n) => n.intent).length} 人正为具体的事行动`
                : "新的一周，大家正在整理开学行李。"
            }}</span
            ><span id="count">{{ world.tick }} / 28 时段</span>
          </div>
          <p class="map-reference">地图使用你提供的 2025 年沙河校区示意图，保留原图标注与署名；五个模拟地点暂以代表点呈现，宿舍统一映射到雁南园。</p>
        </section>
        <section class="panel story-glimpse" aria-label="值得留意的故事">
          <div class="panelhead"><h2>正在发生 <small>一起来看看</small></h2><button class="text-button" @click="page = 'stories'">全部人物故事 →</button></div>
          <div class="glimpse-cards">
            <button v-for="story in highlights" :key="story.id" type="button" @click="openStory(story.id)">
              <small>{{ story.status }}</small><strong>{{ story.title }}</strong><span>{{ story.summary }}</span>
            </button>
          </div>
        </section>
        <section class="panel intervention">
          <div class="panelhead">
            <h2>轻轻拨动世界 <small>A LITTLE NUDGE</small></h2>
            <span>改变相遇机会</span>
          </div>
          <div class="intervention-cards">
            <button
              v-for="item in [
                {
                  kind: 'rooms',
                  icon: '⌂',
                  name: '宿舍重排',
                  sub: '换一个室友，重新认识彼此',
                },
                {
                  kind: 'groups',
                  icon: '▦',
                  name: '课程随机分组',
                  sub: '让不同的人尝试一起合作',
                },
                {
                  kind: 'party',
                  icon: '✧',
                  name: '社团开放日',
                  sub: '下一时段，多一个相遇理由',
                },
              ]"
              :key="item.kind"
              :disabled="!canIntervene"
              @click="sim.intervene(item.kind)"
            >
              <em>{{ item.icon }}</em>
              <div>
                <b>{{ item.name }}</b
                ><small>{{ item.sub }}</small>
              </div>
              <span>↗</span>
            </button>
          </div>
        </section>
      </section>
      <PersonPanel
        :world="world"
        :selected="view.selected"
        :watched="view.watched"
        @select="sim.select"
        @watch="sim.watch"
        @event="detailId = $event"
      />
    </div>
    <section v-show="page === 'stories'" class="stories-view" aria-label="人物故事视图">
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
    <footer>
      <span>七天不是结局，只是一次观察。</span
      ><span>LOCAL SIMULATION · v{{ world.version }} · 无需 API</span>
    </footer>
  </main>
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

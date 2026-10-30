<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import type { WorldSnapshot } from "../core/types.ts";
import { buildStories } from "../core/stories.ts";
import { clock, labels } from "../ui/format.ts";
import { HISTORY_PAGE_SIZE, STORY_PAGE_SIZE, pageContaining, pageIndex, pageItems } from '../ui/pagination.ts';
const props = defineProps<{ world: WorldSnapshot; watched: number[]; focusId?: string | null }>();
defineEmits<{ event: [id: number]; select: [id: number] }>();
const filter = ref("all");
const page = ref(0);
const openStories = reactive(new Set<string>()), openHistories = reactive(new Set<string>());
const historyPages = reactive<Record<string, number>>({});
const root = ref<HTMLElement>();
watch(() => props.focusId, async (id) => {
  if (!id) return;
  filter.value = "all";
  page.value = pageContaining(stories.value.map(story => story.id), id, STORY_PAGE_SIZE) ?? 0;
  openStories.add(id);
  await nextTick();
  const target = [...(root.value?.querySelectorAll<HTMLDetailsElement>(".story-card") || [])]
    .find((element) => element.dataset.storyId === id);
  if (target) {
    target.open = true;
    target.scrollIntoView({ behavior: "auto", block: "start" });
  }
});
const allStories = computed(() => buildStories(props.world));
const stories = computed(() => allStories.value.filter((story) =>
  filter.value === "open" ? story.active : filter.value === "watched" ? story.people.some((id) => props.watched.includes(id)) : true));
const currentPage = computed(() => pageIndex(page.value, stories.value.length, STORY_PAGE_SIZE));
const visible = computed(() => pageItems(stories.value, currentPage.value, STORY_PAGE_SIZE));
const pages = computed(() => Math.max(1, Math.ceil(stories.value.length / STORY_PAGE_SIZE)));
watch(filter, () => { page.value = 0; });
watch(() => props.world.events[0], () => {
  page.value = 0; openStories.clear(); openHistories.clear();
  for (const key of Object.keys(historyPages)) delete historyPages[key];
});
function toggle(set: Set<string>, id: string, event: Event) {
  if ((event.target as HTMLDetailsElement).open) set.add(id); else set.delete(id);
}
const historyPage = (id: string, count: number) => pageIndex(historyPages[id] ?? 0, count, HISTORY_PAGE_SIZE);
const kindLabels = { task: "共同事务", appointment: "一次约定", activity: "一个小愿望", relationship: "彼此的理解" };
</script>
<template>
  <section ref="root" class="panel story-deck" aria-label="持续追看的故事">
    <div class="panelhead">
      <h2>那些还惦记着的事 <small>STORIES TO FOLLOW</small></h2>
      <select v-model="filter" aria-label="故事筛选">
        <option value="all">全部故事</option>
        <option value="open">仍有牵挂</option>
        <option value="watched">我关注的人</option>
      </select>
    </div>
    <p class="story-intro">从一个约定、一件共同的事，跟着看它怎样留下后来的影响。</p>
    <div class="story-cards">
      <details v-for="story in visible" :key="`${world.seed}:${story.id}`" class="story-card" :data-story-id="story.id" :class="{ ongoing: story.active }" :open="openStories.has(story.id)" @toggle="toggle(openStories, story.id, $event)">
        <summary>
          <span class="story-topline"><small>{{ kindLabels[story.kind] }}</small><span>{{ story.status }}</span></span>
          <strong>{{ story.title }}</strong>
          <span class="story-preview">{{ story.summary }}</span>
          <span class="story-open">展开来龙去脉 <i>↗</i></span>
        </summary>
        <div v-if="openStories.has(story.id)" class="story-body">
          <div class="story-people">
            <button v-for="id in story.people" :key="id" class="text-button" @click="$emit('select', id)">{{ world.npcs[id].name }}</button>
          </div>
          <div class="story-facts">
            <h3>确实发生过的事</h3>
            <button v-for="event in story.facts" :key="event.id" class="story-evidence" @click="$emit('event', event.id)">
              <small>{{ clock(event.tick) }}</small><span>{{ event.text }}</span>
            </button>
          </div>
          <div v-if="story.perspectives.length" class="story-perspectives">
            <h3>各自怎么理解 <small>人物的判断，可能有误</small></h3>
            <article v-for="{ person, belief } in story.perspectives" :key="belief.id" :class="belief.status">
              <b>{{ world.npcs[person].name }} <small>{{ belief.status === 'revised' ? '调整了判断' : '尚未放下的疑问' }}</small></b>
              <p>{{ belief.resolution || belief.claim }}</p>
              <small v-if="belief.resolution">原先猜测：{{ belief.claim }}</small>
              <button class="text-button" @click="$emit('event', belief.sourceEvent)">这份想法从哪里来 ↗</button>
            </article>
          </div>
          <div class="story-next"><small>{{ story.active ? '接下来值得留意' : '这段经历留下了什么' }}</small><p>{{ story.next }}</p>
            <span v-if="story.active && story.dueTick !== undefined">约定节点 · {{ clock(story.dueTick) }}</span>
          </div>
          <details class="story-history" :open="openHistories.has(story.id)" @toggle="toggle(openHistories, story.id, $event)">
            <summary>完整经过 · {{ story.events.length }} 个片段</summary>
            <template v-if="openHistories.has(story.id)">
              <ol :start="historyPage(story.id, story.events.length) * HISTORY_PAGE_SIZE + 1"><li v-for="event in pageItems(story.events, historyPages[story.id] ?? 0, HISTORY_PAGE_SIZE)" :key="event.id"><button @click="$emit('event', event.id)"><small>{{ clock(event.tick) }} · {{ labels[event.type] }}</small><span>{{ event.text }}</span></button></li></ol>
              <nav class="pagination" :aria-label="`${story.title}经过分页`">
                <button :disabled="historyPage(story.id, story.events.length) === 0" @click="historyPages[story.id] = historyPage(story.id, story.events.length) - 1">上一页</button>
                <span>第 {{ historyPage(story.id, story.events.length) + 1 }} / {{ Math.max(1, Math.ceil(story.events.length / HISTORY_PAGE_SIZE)) }} 页</span>
                <button :disabled="(historyPage(story.id, story.events.length) + 1) * HISTORY_PAGE_SIZE >= story.events.length" @click="historyPages[story.id] = historyPage(story.id, story.events.length) + 1">下一页</button>
              </nav>
            </template>
          </details>
        </div>
      </details>
    </div>
    <p v-if="!stories.length" class="empty">{{ filter === 'watched' ? '先在人物档案关注几个人，再来追看他们的故事。' : '暂时没有悬而未决的事，留一点时间给他们自己的生活。' }}</p>
    <nav class="pagination" aria-label="故事分页">
      <button :disabled="currentPage === 0" @click="page = currentPage - 1">上一页</button>
      <span>第 {{ currentPage + 1 }} / {{ pages }} 页 · {{ stories.length }} 段故事</span>
      <button :disabled="currentPage + 1 >= pages" @click="page = currentPage + 1">下一页</button>
    </nav>
  </section>
</template>

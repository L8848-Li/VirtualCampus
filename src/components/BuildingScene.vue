<script setup lang="ts">
import { computed } from 'vue';
import { profiles } from '../core/config.ts';
import type { AgentState, LocationId } from '../core/types.ts';
import AvatarIcon from './AvatarIcon.vue';
const props = defineProps<{ place: LocationId; people: AgentState[] }>();
defineEmits<{ select: [id: number] }>();
// A visual grouping of recorded actions, not a claim about exact indoor coordinates.
function area(person: AgentState) {
  if (person.intent?.kind === 'task') return '小组事务';
  if (person.intent?.kind === 'homework') return '课程练习';
  if (person.action.includes('上') && person.action.includes('课程')) return '课堂';
  if (person.action.includes('休息')) return '休息';
  if (person.action.includes('吃饭') || person.action.includes('餐')) return '用餐';
  if (person.action.includes('自习') || person.action.includes('学习') || person.action.includes('练习')) return '学习';
  if (person.action.includes('社团') || person.action.includes('活动')) return '活动';
  return '其他日常';
}
const groups = computed(() => {
  const byArea = new Map<string, AgentState[]>();
  for (const person of props.people) {
    const name = area(person);
    byArea.set(name, [...(byArea.get(name) || []), person]);
  }
  return [...byArea].map(([name, members]) => ({ name, members }));
});
</script>
<template>
  <section class="indoor-scene" aria-label="建筑内活动">
    <div class="indoor-title"><strong>建筑里的这一刻</strong><small>按实际行动分组 · 位置为示意</small></div>
    <div v-if="groups.length" class="indoor-areas">
      <div v-for="group in groups" :key="group.name" class="indoor-area">
        <span class="indoor-area-name">{{ group.name }} <small>{{ group.members.length }} 人</small></span>
        <div class="indoor-people">
          <button v-for="person in group.members" :key="person.id" @click="$emit('select', person.id)">
            <span class="indoor-avatar" :style="{ '--c': profiles[person.id].color }"><AvatarIcon :id="person.id" /></span>
            <span><strong>{{ person.name }}</strong><small>{{ person.action }}</small></span>
          </button>
        </div>
      </div>
    </div>
    <p v-else class="context-empty">这里暂时没有人，等待他们的下一次到来。</p>
  </section>
</template>

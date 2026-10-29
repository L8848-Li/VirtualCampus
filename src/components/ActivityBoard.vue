<script setup lang="ts">
import type { WorldSnapshot } from "../core/types.ts";
import { clock } from "../ui/format.ts";
import { places } from "../core/config.ts";
defineProps<{ world: WorldSnapshot }>();
defineEmits<{ event: [id: number] }>();
</script>
<template>
  <section class="panel activity-board" aria-label="人物自主筹办的活动">
    <div class="panelhead"><h2>想和大家做点什么 <small>A PERSONAL WISH</small></h2><span>他们自己发起</span></div>
    <div class="academic-card"><h3>校园社团</h3><p>每周前两天公开招新；成员可选择参加每周活动或提议跨周作品，参与以实际到场为准。</p>
      <p v-for="club in world.clubs.clubs" :key="club.id"><strong>{{ club.name }}</strong> · {{ club.description }} · {{ places[club.meetingLocation] }} · 每周第 {{ Math.floor(club.meetingSlot / 4) + 1 }} 天{{ club.meetingSlot % 4 === 0 ? '上午' : '午后' }} · 成员 {{ club.members.filter(m => m.leftTick === null).length }} 人</p>
    </div>
    <div v-if="!world.activities.length" class="activity-empty"><span>✧</span><p>聊到喜欢的事时，有人可能会冒出一个点子。<small>谁会先试着把它变成一次小聚？</small></p></div>
    <article v-for="activity in world.activities" :key="activity.id" class="activity-card" :class="activity.status">
      <div class="activity-heading"><div><small>{{ world.npcs[activity.organizer].name }}发起</small><h3>{{ activity.title }}</h3></div><span class="activity-status">{{ activity.status === 'held' ? '真的办成了' : activity.status === 'cancelled' ? '这次没办成' : '正在筹备' }}</span></div>
      <p>{{ activity.kind === 'project' ? `${places[activity.preparationLocation ?? activity.location]}筹备 · 学生活动中心展示` : '学生活动中心' }} · {{ clock(activity.dueTick) }}</p>
      <div class="task-progress"><i :style="{ width: `${activity.progress / activity.required * 100}%` }"></i></div>
      <div class="activity-meta"><span>材料准备 {{ activity.progress }}/{{ activity.required }}</span><span>{{ activity.members.length }} 人答应 · {{ activity.status === 'preparing' ? '到场尚未确定' : `${activity.attendees.length} 人实际到场` }}</span></div>
      <p class="activity-members">答应一起参加：{{ activity.members.map((id) => world.npcs[id].name).join('、') }}</p>
      <button class="text-button" @click="$emit('event', activity.lastEvent)">看看它走到了哪一步 ↗</button>
    </article>
  </section>
</template>

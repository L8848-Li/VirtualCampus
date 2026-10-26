<script setup lang="ts">
import type { WorldSnapshot } from "../core/types.ts";
import { clock } from "../ui/format.ts";
defineProps<{ world: WorldSnapshot }>();
defineEmits<{ event: [id: number] }>();
</script>
<template>
  <section class="panel task-board">
    <div class="panelhead">
      <h2>这周一起做的事 <small>SHARED ENDEAVORS</small></h2>
      <span>共同目标，各有打算</span>
    </div>
    <div class="task-cards">
      <article v-for="task in world.tasks" :key="task.id" :class="task.status">
        <div class="task-heading">
          <b>{{ task.title }}</b
          ><span>{{
            task.status === "completed"
              ? "已完成"
              : task.status === "expired"
                ? "未完成"
                : "整理中"
          }}</span>
        </div>
        <p>{{ task.members.map((id) => world.npcs[id].name).join(" · ") }}</p>
        <div class="task-progress">
          <i
            :style="{ width: (task.progress / task.required) * 100 + '%' }"
          ></i>
        </div>
        <div class="task-meta">
          <span
            >{{ task.progress }} / {{ task.required }} · 截止
            {{ clock(task.deadline) }}</span
          ><button class="text-button" @click="$emit('event', task.lastEvent)">
            查看经过 ↗
          </button>
        </div>
      </article>
    </div>
    <p class="task-footnote">
      角色可以参加、暂停或错过截止；进度来自实际整理资料的行动。
    </p>
  </section>
</template>

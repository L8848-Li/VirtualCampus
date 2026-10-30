<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { ActionScore, CampusEvent, WorldSnapshot } from "../core/types.ts";
import { ENGINE_VERSION } from "../core/config.ts";
import { clock, labels } from "../ui/format.ts";
const props = defineProps<{
  event: CampusEvent | null;
  help: boolean;
  world: WorldSnapshot;
  scores?: readonly Readonly<ActionScore>[];
}>();
const emit = defineEmits<{ close: []; event: [id: number] }>();
const dialog = ref<HTMLDialogElement>();
watch(
  () => [props.event?.id, props.help],
  async () => {
    await nextTick();
    if (props.event || props.help) {
      if (!dialog.value?.open) dialog.value?.showModal();
    } else dialog.value?.close();
  },
  { immediate: true },
);
</script>
<template>
  <dialog id="detail" ref="dialog" @cancel="emit('close')">
    <button class="dialog-close" @click="emit('close')">关闭 ×</button>
    <div id="detailbody">
      <template v-if="help"
        ><span class="eyebrow">欢迎来到校园观察室</span>
        <h2>你改变环境，他们决定怎么生活。</h2>
        <p>每步一个时段，六周试验场景共 168 步。动画只负责呈现，不改变模拟结果。</p>
        <p>首页使用参考沙河校区布局重新绘制的邮邮大学地图。点击地图圈点可在右侧查看完整人物名单；使用底部加减按钮缩放，放大后拖动地图；人物故事与学业可在顶部切换查看。</p>
        <p>
          点击角色档案的 ☆
          关注最多三人，跟随观察持续高亮角色；关系图支持切换双方视角。
        </p>
        <p>
          角色依据自身需求、习惯、关系和亲历信息做选择。寻找可能扑空，邀约也可能被拒绝。
        </p>
        <p>
          在“那些还惦记着的事”展开一个约定，能分清确实发生的事与各人的猜测。人物可能因短暂的回应或失约产生疑问，只有实际交流才能听到当事人的解释，也可能仍然不信。
        </p>
        <p>
          有人会在正向相处后自主发起兴趣小聚，邀请伙伴、准备材料。答应参加的人仍需自己腾出时间；准备不足或没有到场，活动也会落空。小组报告、个人作业与饭约同样按实际行动推进。
        </p>
        <p>
          每次推进与干预都会本机保存。导入会校验后暂停恢复，游玩无需模型密钥。v{{ ENGINE_VERSION }} 使用独立存档空间，保留旧版本机记录，暂不支持跨版本导入。
        </p></template
      ><template v-else-if="event"
        ><span class="eyebrow"
          >{{
            event.type === "summary"
              ? `第 ${event.data.day} 天日终`
              : clock(event.tick)
          }}
          / 事件 #{{ event.id }}</span
        >
        <h2>{{ labels[event.type] }}</h2>
        <p class="event-quote">{{ event.text }}</p>
        <h4>为什么发生</h4>
        <p>{{ event.data.reason || "世界初始化、环境变化或日终汇总。" }}</p>
        <div v-if="event.data.claim" class="event-belief"><h4>人物的判断 · 尚需和事实区分</h4><p>{{ event.data.claim }}</p><p v-if="event.data.confidence !== undefined">当时对这份猜测的确信程度：{{ Math.round(event.data.confidence * 100) }}%</p></div>
        <p v-if="event.data.delta !== undefined" class="change-pill">
          发起者好感 {{ event.data.delta > 0 ? "+" : ""
          }}{{ event.data.delta }} · 对方好感
          {{ (event.data.otherDelta || 0) > 0 ? "+" : ""
          }}{{ event.data.otherDelta }}
        </p>
        <template v-if="scores"
          ><h4>行动评分 · 最高分被选中</h4>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>候选行动</th>
                  <th>需求/目标</th>
                  <th>习惯</th>
                  <th>承诺</th>
                  <th>切换</th>
                  <th>回避</th>
                  <th>生理负担</th>
                  <th>波动</th>
                  <th>总分</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, i) in scores" :key="i">
                  <td>
                    {{ s.action
                    }}{{
                      s.target !== null ? ` · ${world.npcs[s.target].name}` : ""
                    }}
                  </td>
                  <td>{{ s.needAndGoal }}</td>
                  <td>+{{ s.habit }}</td>
                  <td>+{{ s.commitment }}</td>
                  <td>−{{ s.switching }}</td>
                  <td>−{{ s.avoidance }}</td>
                  <td>−{{ s.exhaustion + s.urgentMeal }}</td>
                  <td>+{{ s.noise }}</td>
                  <td>{{ s.total }}</td>
                </tr>
              </tbody>
            </table>
          </div></template
        ><template v-if="event.data.perspectives?.length"
          ><h4>观察者视角 · 两种解释</h4>
          <p v-for="p in event.data.perspectives" :key="p.person">
            {{ world.npcs[p.person].name }}：{{ p.interpretation }}
          </p></template
        ><template v-if="event.data.observedPeople?.length"
          ><h4>这个时段亲眼看见的人</h4>
          <p>
            {{
              event.data.observedPeople
                .map((id) => world.npcs[id].name)
                .join("、")
            }}
          </p></template
        >
        <p v-if="event.data.dueTick !== undefined" class="change-pill">
          约定时间：{{ clock(event.data.dueTick) }}
        </p>
        <p
          v-if="event.data.progress !== undefined && event.data.required"
          class="change-pill"
        >
          共同事务进度：{{ event.data.progress }} / {{ event.data.required }}
        </p>
        <h4>此前发生了什么 · 点击继续追溯</h4>
        <button
          v-for="id in event.parents"
          :key="id"
          class="memory"
          @click="emit('event', id)"
        >
          <small>#{{ id }} · {{ clock(world.events[id - 1].tick) }}</small
          >{{ world.events[id - 1].text }}
        </button>
        <p v-if="!event.parents.length" class="empty">
          这是这一条因果链的起点。
        </p>
        <details class="raw-data">
          <summary>展开规则记录</summary>
          <pre>{{ JSON.stringify({ ...event.data, ...(scores ? { scores } : {}) }, null, 2) }}</pre>
        </details></template
      >
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { activeDormLoans } from "../core/dorm.ts";
import { attendance, courseAt, timetableWeek, courses } from "../core/academics.ts";
import { courseCapacity, coursePeriods, courseTags } from "../core/enrollment.ts";
import { places, profiles } from "../core/config.ts";
import type { WorldSnapshot } from "../core/types.ts";
import { clock, labels, relationLabel } from "../ui/format.ts";
import AvatarIcon from "./AvatarIcon.vue";
const props = defineProps<{
  world: WorldSnapshot;
  selected: number;
  watched: number[];
}>();
defineEmits<{
  select: [id: number];
  watch: [id: number];
  event: [id: number];
}>();
const n = computed(() => props.world.npcs[props.selected]);
const living = computed(() => props.world.livingEnabled ? props.world.living[props.selected] : undefined);
const delivery = computed(() => [...props.world.deliveries].reverse().find((item) => item.owner === props.selected));
const parcel = computed(() => [...props.world.parcels].reverse().find((item) => item.owner === props.selected));
const laundry = computed(() => [...props.world.laundry].reverse().find((item) => item.owner === props.selected));
const dormLoans = computed(() => activeDormLoans(props.world.events).filter((event) => event.people.includes(props.selected)));
const loan = computed(() => props.world.library.loans.find((item) => item.owner === props.selected && item.returnedTick === null));
const bookWait = computed(() => [...props.world.library.waitlist].reverse().find((item) => item.owner === props.selected));
const waitingBookTitle = computed(() => props.world.library.books.find(book => book.id === bookWait.value?.bookId)?.title);
const borrowedBook = computed(() => props.world.library.books.find((book) => book.id === loan.value?.bookId));
const homework = computed(() => props.world.homework.filter((item) => item.owner === props.selected));
const courseIds = computed(() => props.world.enrollments.find(e => e.owner === props.selected)?.courseIds || []);
const classHistory = computed(() => attendance(props.world.events, props.selected, props.world.tick, courseIds.value));
const nextClass = computed(() => Array.from({ length: 168 - props.world.tick }, (_, i) => props.world.tick + i)
  .map((tick) => ({ tick, course: courseAt(tick, props.selected, courseIds.value) })).find((item) => item.course));
const lastAction = computed(() => [...props.world.events].reverse().find((event) => event.type === 'action' && event.people[0] === props.selected));
const relationships = computed(() =>
  n.value.rel
    .map((r, i) => ({ r, i }))
    .filter((x) => x.i !== n.value.id)
    .sort(
      (a, b) => Math.abs(b.r.aff) + b.r.crush - Math.abs(a.r.aff) - a.r.crush,
    )
    .slice(0, 3),
);
const planLabels = {
  pending: "记在心里",
  waiting: "正在等人",
  working: "专注进行",
  fulfilled: "已经兑现",
  cancelled: "改了安排",
  expired: "这次错过了",
};
const observations = computed(() =>
  Object.entries(n.value.known).filter(
    ([, k]) => props.world.tick - k.tick <= 4,
  ),
);
const beliefs = computed(() => [...n.value.beliefs].sort((a, b) =>
  Number(a.status === 'revised') - Number(b.status === 'revised') || b.updatedTick - a.updatedTick).slice(0, 3));
</script>
<template>
  <aside class="panel person-panel">
    <div class="panelhead">
      <h2>人物观察 <small>PERSON</small></h2>
      <span>{{ String(selected + 1).padStart(2, "0") }} / {{ world.npcs.length }}</span>
    </div>
    <div id="profile">
      <div class="identity">
        <span class="portrait" :style="{ '--c': profiles[n.id].color }"
          ><AvatarIcon :id="n.id"
        /></span>
        <div>
          <span class="eyebrow">{{ n.role }}</span>
          <h3>{{ n.name }}</h3>
          <p>{{ places[n.loc] }} · {{ n.action }}</p><p v-if="n.holidayReturnTick !== undefined">预计返校：{{ clock(n.holidayReturnTick) }}</p>
        </div>
        <button
          class="watch-button"
          :class="{ active: watched.includes(n.id) }"
          :aria-label="`${watched.includes(n.id) ? '取消关注' : '关注'}${n.name}`"
          @click="$emit('watch', n.id)"
        >
          {{ watched.includes(n.id) ? "★" : "☆" }}
        </button>
      </div>
      <div class="tags">
        <span>{{ n.interest }}</span
        ><span>{{ n.ext > 0.55 ? "外向" : "慢热" }}</span
        ><span>{{ n.sensitive > 0.6 ? "细腻" : "豁达" }}</span>
      </div>
      <p class="quirk">“{{ n.quirk }}。”</p>
      <div class="thought">
        <small>此刻为什么这么做</small>
        <p>{{ n.why }}</p>
        <strong>{{ n.interaction }}</strong>
      </div>
      <p v-if="lastAction && lastAction.data.travelMinutes" class="quirk">上次跨地点约 {{ lastAction.data.travelMinutes }} 分钟（示意）<span v-if="lastAction.data.nextCourse"> · 接下来有 {{ lastAction.data.nextCourse }}</span></p>
      <div v-if="n.plan" class="personal-plan" :class="n.plan.stage">
        <small>心里挂着的小计划 · {{ planLabels[n.plan.stage] }}</small>
        <p>
          {{
            n.plan.kind === "appointment"
              ? `与${world.npcs[n.plan.target!].name}在${clock(n.plan.dueTick)}一起吃饭`
              : "给自己留两个时段，整理小组报告资料"
          }}
        </p>
        <button class="text-button" @click="$emit('event', n.plan.lastEvent)">
          它是怎么开始的 ↗
        </button>
      </div>
      <div v-for="item in dormLoans" :key="item.id" class="library-person-loan"><small>室友间的借物</small><strong>{{ world.npcs[item.people[0]].name }}借用了{{ world.npcs[item.people[1]].name }}的{{ item.data.item }}</strong><button class="text-button" @click="$emit('event', item.id)">查看经过 →</button></div>
      <div v-if="delivery" class="library-person-loan"><small>食堂订餐 · 模拟价格与时间</small><strong>{{ delivery.status === 'ordered' ? '已下单，等待送达' : delivery.status === 'ready' ? '已送到楼下，等待本人取餐' : delivery.status === 'collected' ? '已取餐用餐' : '超过领取时间' }}</strong><span>{{ places[delivery.dorm] }}楼下 · 预计 {{ delivery.estimatedMinutes }} 分钟 · {{ delivery.simulatedPrice }} 元（模拟）</span><span v-if="delivery.status === 'ordered' || delivery.status === 'ready'">{{ clock(delivery.dueTick) }} 起可取，{{ clock(delivery.expiresTick) }} 后失效</span><button v-if="delivery.lastEvent" class="text-button" @click="$emit('event', delivery.lastEvent)">查看经过 →</button></div>
      <div v-if="parcel" class="library-person-loan"><small>包裹</small><strong>{{ parcel.status === 'collected' ? '已领取' : parcel.status === 'overdue' ? '已逾期，仍待领取' : '等待本人取件' }}</strong><span>学生活动中心 · 期限 {{ clock(parcel.deadline) }}</span><button class="text-button" @click="$emit('event', parcel.lastEvent)">查看经过 →</button></div>
      <div v-if="living" class="library-person-loan"><small>生活实验 · 虚构数值</small><strong>余额 {{ living.balance }} · 压力 {{ living.stress }}</strong><span>压力为可恢复的游戏状态；基础餐免费提供。</span></div>
      <div v-if="bookWait" class="library-person-loan"><small>图书候补</small><strong>{{ waitingBookTitle }} · {{ ({ waiting: '排队中', notified: '到书待领取', borrowed: '已借阅', expired: '通知过期', cancelled: '已取消' })[bookWait.status] }}</strong><span v-if="bookWait.status === 'notified' && bookWait.expiresTick !== undefined">{{ clock(bookWait.expiresTick) }} 前到馆领取</span><button class="text-button" @click="$emit('event', bookWait.lastEvent)">查看经过 →</button></div>
      <div v-if="laundry" class="library-person-loan"><small>宿舍洗衣</small><strong>{{ laundry.status === 'collected' ? '已取回衣物' : '衣物在原楼等待领取' }}</strong><span>{{ places[laundry.dorm] }} · {{ clock(laundry.startedTick) }} 开始</span><button class="text-button" @click="$emit('event', laundry.lastEvent)">查看经过 →</button></div>
      <div v-if="loan" class="library-person-loan"><small>图书馆借阅中</small><strong>《{{ borrowedBook?.title }}》</strong><span>计划归还 · {{ clock(Math.min(loan.dueTick, 167)) }}{{ loan.dueTick > 167 ? '之后' : '' }}</span><button class="text-button" @click="$emit('event', loan.lastEvent)">借阅记录 →</button></div>
      <section v-if="n.education === 'graduate'" class="academic-card">
        <small>研究生 · 虚构科研安排</small><h4>科研与研讨</h4>
        <p>教学周每周第 3 天午后有研讨，地点为{{ n.id % 2 === 0 ? "科研楼" : "智能工程学院楼" }}；是否参加由本人决定。</p>
        <div v-for="task in world.tasks.filter((item) => item.id.startsWith('research-') && item.members.includes(n.id))" :key="task.id"><p>{{ task.title }} · {{ task.research?.stage }} · {{ task.progress }}/{{ task.required }} · {{ places[task.location] }} · {{ task.status }} · 组会：{{ task.research?.feedback || "尚未举行" }}</p><button class="text-button" @click="$emit('event', task.lastEvent)">科研记录 →</button><button v-if="task.research?.meetingEvent" class="text-button" @click="$emit('event', task.research.meetingEvent)">组会记录 →</button></div>
      </section>
      <section v-if="n.education === 'undergraduate'" class="academic-card">
        <small>个人考核 · 虚构规则</small>
        <h4>成绩与学分</h4>
        <p v-for="record in world.assessments.filter((item) => item.owner === selected)" :key="record.courseId">
          {{ record.title }} · {{ record.status === 'scheduled' ? `考试：${clock(record.examTick)}` : ['pending', 'makeup_pending', 'deferred_pending', 'retake_pending'].includes(record.status) ? '已参加，等待公布' : record.status === 'deferred' ? `已批准模拟缓考：${clock(record.makeupTick)}` : record.status === 'missed' ? `未参加考试 · 模拟重修考试：${clock(record.retakeTick)} · 已复习 ${record.retakeWork} 时段` : record.status === 'passed' ? `通过 ${record.score} 分 · 获得 ${record.earnedCredits} 学分` : record.status === 'failed' ? `未通过 ${record.score} 分 · 补考：${clock(record.makeupTick)}` : world.tick > record.retakeTick ? '本轮重修未通过或未参加' : `未通过或未参加 · 重修考试：${clock(record.retakeTick)} · 已复习 ${record.retakeWork} 时段` }}
          <button v-if="record.lastEvent" class="text-button" @click="$emit('event', record.lastEvent)">经过 →</button>
        </p>
      </section>
      <section v-if="n.education === 'undergraduate'" class="academic-card">
        <small>六周试验 · 模拟课程</small>
        <h4>学业日程</h4>
        <p v-if="nextClass">下次：{{ clock(nextClass.tick) }} · {{ nextClass.course?.name }}</p>
        <p v-else>教学周课程已经结束。</p>
        <p>已上 {{ classHistory.filter((item) => item.attended).length }} 次 · 未到 {{ classHistory.filter((item) => !item.attended).length }} 次</p>
        <div v-for="item in homework" :key="item.id" class="homework-item">
          <strong>{{ item.title }}</strong><span>{{ item.status === 'completed' ? '已提交' : item.status === 'expired' ? '未按时完成' : `进行中 ${item.progress}/${item.required}` }}</span>
          <p>截止 {{ clock(item.deadline) }}</p>
          <button class="text-button" @click="$emit('event', item.lastEvent)">查看经过 →</button>
        </div>
        <p v-if="!homework.length">{{ courseIds.includes("math") ? "数学练习将在教学周发布。" : "未选数学，本人不会收到数学练习。" }}</p>
        <details><summary>查看公开课程与个人选课</summary>
          <p v-for="course in courses" :key="course.id">{{ course.name }} · 公共教学楼 · 容量 {{ courseCapacity[course.id] }} · 兴趣：{{ courseTags[course.id] }} · 每周时段 {{ coursePeriods[course.id].map(period => `第 ${Math.floor(period / 4) + 1} 天${period % 4 === 0 ? '上午' : '午后'}`).join('、') }} · {{ courseIds.includes(course.id) ? '已选' : '未选' }}</p>
          <button v-for="event in (world.enrollments.find(e => e.owner === selected)?.events || [])" :key="event" class="text-button" @click="$emit('event', event)">查看选课结果 →</button>
        </details>
        <details><summary>查看本周课表与出勤</summary>
          <p v-if="!timetableWeek(selected, world.tick, courseIds).length">本周无常规教学安排，考试按个人考表进行。</p>
          <p v-for="day in timetableWeek(selected, world.tick, courseIds)" :key="day.day"><strong>第 {{ day.day }} 天</strong> · <span v-for="period in day.periods" :key="period.tick">{{ period.tick % 4 === 0 ? '上午' : '午后' }}：{{ period.course?.name || (period.lab ? '' : '空档') }}{{ period.course && period.lab ? ' / 时间冲突 / ' : '' }}{{ period.lab ? `${period.lab.name}实验` : '' }}{{ period.course || period.lab ? '（约两节）' : '' }}；</span></p>
          <p v-for="item in classHistory" :key="item.tick">{{ clock(item.tick) }} · {{ item.course?.name }} · {{ item.attended ? (item.lateMinutes ? `迟到 ${item.lateMinutes} 分钟` : '已上课') : '未到课' }}</p>
          <p>成绩在考后下一时段公布，学分只有通过后取得。</p>
        </details>
      </section>
      <details class="profile-details">
        <summary>更多档案、关系与记忆</summary>
        <div class="needs">
          <div
            v-for="stat in [
              { name: '精力', value: n.energy, cls: 'energy' },
              { name: '饥饿', value: n.hunger, cls: 'hunger' },
              { name: '社交需求', value: n.social, cls: 'social' },
            ]"
            :key="stat.cls"
            class="stat"
          >
            <span>{{ stat.name }}</span>
            <div class="bar" :class="stat.cls">
              <i :style="{ width: stat.value + '%' }"></i>
            </div>
            <b>{{ Math.round(stat.value) }}</b>
          </div>
        </div>
        <div class="minor-stats">
          <span>目标 {{ n.goal }}</span
          ><span>学业 {{ n.progress }}</span
          ><span
            >宿舍 {{ world.rooms[n.id] + 1 }} · 小组
            {{ world.groups[n.id] + 1 }}</span
          >
        </div>
        <h4>关系近况</h4>
        <button
          v-for="{ r, i } in relationships"
          :key="i"
          class="relationship-row"
          @click="$emit('select', i)"
        >
          <span>{{ world.npcs[i].name }}</span
          ><small>{{ relationLabel(r) }}</small
          ><b>{{ r.aff > 0 ? "+" : "" }}{{ r.aff }}</b>
        </button>
        <template v-if="beliefs.length">
          <h4>TA 心里的理解 <small>可能有误，也会改变</small></h4>
          <button v-for="belief in beliefs" :key="belief.id" class="memory belief-memory" @click="$emit('event', belief.evidence.at(-1) || belief.sourceEvent)">
            <small>{{ belief.status === 'revised' ? '重新理解' : '仍有疑问' }} · {{ clock(belief.updatedTick) }}</small>
            <span>{{ belief.resolution || belief.claim }}</span>
          </button>
        </template>
        <h4>记得的片段 <small>按重要程度保留 · 最多 8 条</small></h4>
        <div class="memory-list">
          <button
            v-for="id in n.memory"
            :key="id"
            class="memory"
            @click="$emit('event', id)"
          >
            <small
              >{{ clock(world.events[id - 1].tick) }} ·
              {{ labels[world.events[id - 1].type] }}</small
            ><span>{{ world.events[id - 1].text }}</span>
          </button>
          <p v-if="!n.memory.length" class="empty">还在等第一次相遇。</p>
        </div>
        <details class="knowledge">
          <summary>TA 最近亲眼见到的人</summary>
          <p v-for="[id, k] in observations" :key="id">
            {{ world.npcs[Number(id)].name }} · {{ places[k.loc]
            }}<small
              >{{ clock(k.tick) }}{{ k.missed ? " · 再去时已不在" : "" }}</small
            >
          </p>
          <p v-if="!observations.length">还没有新的目击。</p>
        </details>
      </details>
    </div>
  </aside>
</template>

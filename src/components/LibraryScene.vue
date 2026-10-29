<script setup lang="ts">
import { computed } from 'vue';
import type { WorldSnapshot } from '../core/types.ts';
import { profiles } from '../core/config.ts';
import { clock } from '../ui/format.ts';
import AvatarIcon from './AvatarIcon.vue';
const props = defineProps<{ world: WorldSnapshot }>();
defineEmits<{ select: [id: number]; event: [id: number] }>();
const currentTick = computed(() => props.world.tick - 1);
const room = computed(() => props.world.library.reservations.find((entry) => entry.dueTick === currentTick.value && entry.status === 'used'));
const printing = computed(() => props.world.events.filter((event) => event.tick === currentTick.value && event.type === 'library_print'));
const groups = computed(() => {
  const people = props.world.npcs.filter((person) => person.loc === 3);
  return [
    { id: 'study', name: '自习与开放讨论', icon: '▤', people: people.filter((person) => !printing.value.some((event) => event.people.includes(person.id)) && !room.value?.attendees.includes(person.id) && person.intent?.kind !== 'library_borrow' && person.intent?.kind !== 'library_return' && person.intent?.kind !== 'library_book_room') },
    { id: 'print', name: '二层 · 自助文印', icon: '▧', people: people.filter((person) => printing.value.some((event) => event.people.includes(person.id))) },
    { id: 'room', name: '三层 · 研讨间', icon: '▦', people: people.filter((person) => room.value?.attendees.includes(person.id)) },
    { id: 'desk', name: '借还与预约服务', icon: '⌑', people: people.filter((person) => ['library_borrow', 'library_return', 'library_book_room'].includes(person.intent?.kind || '')) },
  ];
});
const nextReservation = computed(() => props.world.library.reservations.find((entry) => entry.status === 'reserved' && entry.dueTick === props.world.tick));
</script>
<template>
  <section class="library-scene" aria-label="图书馆内部">
    <div class="library-intro"><span>LIBRARY · 邮邮大学</span><h3>书页之间的校园</h3><p>二层文印、三层研讨等空间参考沙河馆功能；人物按实际行动显示。</p></div>
    <div class="library-rooms">
      <div v-for="group in groups" :key="group.id" class="library-zone">
        <div class="library-zone-head"><span>{{ group.icon }}</span><strong>{{ group.name }}</strong><small>{{ group.people.length }} 人</small></div>
        <div v-if="group.people.length" class="library-people">
          <button v-for="person in group.people" :key="person.id" @click="$emit('select', person.id)">
            <span class="indoor-avatar" :style="{ '--c': profiles[person.id].color }"><AvatarIcon :id="person.id" /></span>
            <span><strong>{{ person.name }}</strong><small>{{ person.action }}</small></span>
          </button>
        </div>
        <p v-else>此刻没有人。</p>
      </div>
    </div>
    <div class="library-detail"><strong>研讨间预约</strong>
      <button v-if="nextReservation" class="text-button" @click="$emit('event', nextReservation.lastEvent)">{{ clock(nextReservation.dueTick) }} · {{ world.npcs[nextReservation.organizer].name }}已预约 →</button>
      <span v-else>下一时段暂无预约</span>
      <button v-if="room" class="text-button" @click="$emit('event', room.lastEvent)">查看本时段使用记录 →</button>
    </div>
    <div class="library-detail"><strong>虚构馆藏 · 当前可借</strong>
      <span v-for="book in world.library.books" :key="book.id">{{ book.title }} · {{ book.copies - world.library.loans.filter((loan) => loan.bookId === book.id && loan.returnedTick === null).length - world.library.waitlist.filter((entry) => entry.bookId === book.id && entry.status === 'notified').length }} / {{ book.copies }}</span>
    </div>
  </section>
</template>

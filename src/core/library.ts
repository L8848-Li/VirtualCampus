import type { World } from '../engine.ts';
import { queryEvents } from './eventIndex.ts';
import type { LibraryState } from './types.ts';

export function createLibrary(): LibraryState {
  return {
    books: [
      { id: 'math-notes', title: '数学与问题求解', copies: 3 },
      { id: 'maker', title: '智能硬件实践', copies: 3 },
      { id: 'humanities', title: '阅读与校园生活', copies: 3 },
    ],
    loans: [], reservations: [], waitlist: [],
  };
}

/** Expire holds and reserve each available copy for the oldest waiting reader. */
export function advanceLibraryWaitlist(world: World, cause?: { bookId: string; event: number }) {
  const library = world.library;
  const released = new Map<string, number>();
  for (const entry of library.waitlist) if (entry.status === 'notified' && world.tick > entry.expiresTick!) {
    entry.status = 'expired'; const n = world.npcs[entry.owner];
    entry.lastEvent = world.log(`${n.name}的图书候补通知已过期，保留的副本重新开放。`, 'library_hold_expired', [n.id], [entry.lastEvent], { bookId: entry.bookId, location: 3, reason: '超过领取期限仍未到馆，不会自动借阅' }, 2); world.remember(n, entry.lastEvent); released.set(entry.bookId, entry.lastEvent);
  }
  for (const book of library.books) {
    const active = library.loans.filter(l => l.bookId === book.id && l.returnedTick === null).length;
    const held = library.waitlist.filter(e => e.bookId === book.id && e.status === 'notified').length;
    const waiting = library.waitlist.filter(e => e.bookId === book.id && e.status === 'waiting').sort((a,b) => a.createdTick - b.createdTick || a.lastEvent - b.lastEvent);
    for (const entry of waiting.slice(0, Math.max(0, book.copies - active - held))) {
      entry.status = 'notified'; entry.expiresTick = world.tick + 6; const n = world.npcs[entry.owner];
      entry.lastEvent = world.log(`${n.name}收到《${book.title}》候补到书通知。`, 'library_hold_notified', [n.id], [entry.lastEvent, released.get(book.id), cause?.bookId === book.id ? cause.event : undefined], { bookId: book.id, dueTick: entry.expiresTick, location: 3, reason: '按候补顺序保留一本，仍需本人在期限内到馆借阅' }, 2); world.remember(n, entry.lastEvent);
    }
  }
}

// Only actual choices at the library create loans and reservations. The
// library catalogue is public; personal loans stay with their owner.
export function resolveLibrary(world: World) {
  const library = world.library;
  for (const n of world.npcs) {
    if (n.intent?.kind === 'library_cancel') {
      const entry = library.waitlist.find(e => e.owner === n.id && (e.status === 'waiting' || e.status === 'notified'));
      if (entry) { entry.status = 'cancelled'; entry.lastEvent = world.log(`${n.name}取消了自己的图书候补。`, 'library_wait_cancelled', [n.id], [entry.lastEvent, n.last], { bookId: entry.bookId, reason: '本人自主取消，保留的副本释放' }, 2); world.remember(n, entry.lastEvent); advanceLibraryWaitlist(world, { bookId: entry.bookId, event: entry.lastEvent }); }
    }
    if (n.loc !== 3) continue;
    if (n.intent?.kind === 'homework' && n.intent.homeworkId) {
      const homework = world.homework.find((item) => item.id === n.intent!.homeworkId && item.owner === n.id && item.status === 'open');
      // Only the owner's own actual visit can produce a print; don't print the
      // same assignment repeatedly or treat printed pages as completed work.
      const alreadyPrinted = homework && queryEvents(world.events, { type: 'library_print', person: n.id }).some(event => event.people[0] === n.id && event.data.homeworkId === homework.id);
      if (homework && !alreadyPrinted && world.sample('library-print', homework.id, n.id) < 0.45) {
        const pages = 2 + Math.floor(world.sample('library-print-pages', homework.id, n.id) * 5);
        const minutes = 2 + Math.floor(world.sample('library-print-wait', world.tick, n.id) * 7);
        const event = world.log(`${n.name}在图书馆二层自助打印了${homework.title}的 ${pages} 页资料，约花 ${minutes} 分钟。`,
          'library_print', [n.id], [n.last, homework.lastEvent],
          { location: 3, homeworkId: homework.id, pages, minutes, floor: 2,
            reason: '本人到馆并选择完成自己的练习，打印是准备资料，不代表作业已完成；页数和耗时为模拟值' }, 2);
        world.remember(n, event);
        n.interaction = '打印资料后继续完成练习';
      }
    }
    if (n.intent?.kind === 'library_borrow') {
      const hold = library.waitlist.find(e => e.owner === n.id && e.status === 'notified');
      const book = library.books.find(b => b.id === hold?.bookId) || library.books[n.id % library.books.length];
      const active = library.loans.filter((loan) => loan.bookId === book.id && loan.returnedTick === null).length;
      const held = library.waitlist.filter(e => e.bookId === book.id && e.status === 'notified').length;
      const hasBook = library.loans.some((loan) => loan.owner === n.id && loan.returnedTick === null);
      if (!hasBook && (hold ? active < book.copies : active + held < book.copies)) {
        const event = world.log(`${n.name}在图书馆借走了《${book.title}》。`, 'library_borrow', [n.id], [n.last, hold?.lastEvent],
          { bookId: book.id, location: 3, reason: '本人选择到馆借阅，馆藏尚有可借副本' }, 2);
        if (hold) { hold.status = 'borrowed'; hold.lastEvent = event; }
        library.loans.push({ owner: n.id, bookId: book.id, borrowedTick: world.tick, dueTick: world.tick + 6, returnedTick: null, lastEvent: event });
        world.remember(n, event); n.interaction = '借到了一本书';
      } else {
        const event = world.log(`${n.name}想借《${book.title}》，但此刻无法借到。`, 'library_unavailable', [n.id], [n.last],
          { bookId: book.id, location: 3, reason: hasBook ? '本人已有一本未归还的书' : '同一时段其他人已借走可用副本' }, 2);
        world.remember(n, event); n.interaction = '想借的书暂时借不到';
        if (!hasBook && !library.waitlist.some(e => e.owner === n.id && (e.status === 'waiting' || e.status === 'notified')) && world.sample('library-waitlist', world.tick, n.id, book.id) < 0.8) {
          const joined = world.log(`${n.name}选择候补《${book.title}》。`, 'library_waitlisted', [n.id], [event], { bookId: book.id, location: 3, reason: '本人到馆发现无可借副本后自主加入候补' }, 2);
          library.waitlist.push({ owner: n.id, bookId: book.id, createdTick: world.tick, status: 'waiting', lastEvent: joined }); world.remember(n, joined);
        }
      }
    }
    if (n.intent?.kind === 'library_return') {
      const loan = library.loans.find((item) => item.owner === n.id && item.returnedTick === null);
      if (!loan) continue;
      const book = library.books.find((item) => item.id === loan.bookId)!;
      const event = world.log(`${n.name}归还了《${book.title}》。`, 'library_return', [n.id], [loan.lastEvent, n.last],
        { bookId: book.id, location: 3, reason: '本人选择到图书馆归还已借图书' }, 2);
      loan.returnedTick = world.tick; loan.lastEvent = event;
      world.remember(n, event); n.interaction = '归还了借阅的书';
      advanceLibraryWaitlist(world, { bookId: loan.bookId, event });
    }
    if (n.intent?.kind === 'library_book_room' && n.intent.taskId) {
      const task = world.tasks.find((item) => item.id === n.intent!.taskId && item.status === 'open' && item.members.includes(n.id));
      const dueTick = world.tick + 1;
      if (!task || dueTick >= 168) continue;
      const occupied = library.reservations.some((item) => item.dueTick === dueTick && item.status !== 'rejected');
      const event = world.log(occupied ? `${n.name}想预约下一时段的图书馆研讨间，但该时段已被预约。` : `${n.name}为${task.title}预约了下一时段的图书馆研讨间。`,
        occupied ? 'library_room_rejected' : 'library_room_reserved', [n.id], [n.last, task.lastEvent],
        { taskId: task.id, dueTick, location: 3, reason: occupied ? '游戏中设有一间研讨室，同一时段只能预约一次' : '本人实际到馆预约；其他组员仍自行决定是否到场' }, 3);
      library.reservations.push({ taskId: task.id, organizer: n.id, createdTick: world.tick, dueTick,
        status: occupied ? 'rejected' : 'reserved', attendees: [], lastEvent: event });
      world.remember(n, event); n.interaction = occupied ? '研讨间已被预约' : '预约了研讨间';
    }
  }
  advanceLibraryWaitlist(world);
  for (const room of library.reservations) {
    if (room.status !== 'reserved' || room.dueTick !== world.tick) continue;
    const task = world.tasks.find((item) => item.id === room.taskId);
    const attendees = world.npcs.filter((n) => n.loc === 3 && task?.members.includes(n.id) && n.intent?.kind === 'task' && n.intent.taskId === room.taskId);
    room.attendees = attendees.map((n) => n.id);
    room.status = attendees.length ? 'used' : 'missed';
    const event = world.log(attendees.length ? `${attendees.map((n) => n.name).join('、')}在预约的研讨间整理小组报告。` : '到了预约时间，研讨间里没有这组实际到场的人。',
      attendees.length ? 'library_room_used' : 'library_room_missed', room.attendees, [room.lastEvent, ...attendees.map((n) => n.last)],
      { taskId: room.taskId, dueTick: room.dueTick, location: 3, reason: attendees.length ? '只记录实际选择小组任务并到场的人' : '预约不保证人物一定会前往' }, 3);
    room.lastEvent = event;
    for (const n of attendees) { world.remember(n, event); n.interaction = '在研讨间整理小组报告'; }
  }
}

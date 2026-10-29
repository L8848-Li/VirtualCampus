import { describe, expect, it } from 'vitest';
import { World } from '../src/engine.ts';
import { courseAt, labAt } from '../src/core/academics.ts';
import { dormLocation } from '../src/core/campusLife.ts';

describe('研究生核心闭环', () => {
  it('入住、学业隔离、调宿以及完整重放', () => {
    const w = new World('graduate');
    const grads = w.npcs.filter(n => n.education === 'graduate');
    expect(grads).toHaveLength(2);
    expect(grads.every(n => n.loc === 21 && dormLocation(w.rooms[n.id]) === 21)).toBe(true);
    expect(grads.every(n => !courseAt(0, n.id) && !labAt(6, n.id))).toBe(true);
    expect(w.assessments.every(a => w.npcs[a.owner].education === 'undergraduate')).toBe(true);
    expect(w.tasks.filter(t => t.id.startsWith('research-'))).toHaveLength(2);
    expect(w.tasks.filter(t => t.id.startsWith('report-')).every(t => t.members.every(id => w.npcs[id].education === 'undergraduate'))).toBe(true);
    w.intervene('rooms'); w.intervene('groups');
    expect(grads.every(n => dormLocation(w.rooms[n.id]) === 21)).toBe(true);
    expect(w.npcs.filter(n => n.education === 'undergraduate').every(n => dormLocation(w.rooms[n.id]) !== 21)).toBe(true);
    while (w.tick < 168) w.step();
    expect(w.homework.every(h => w.npcs[h.owner].education === 'undergraduate')).toBe(true);
    const research = w.events.filter(e => e.type === 'task_progress' && String(e.data.taskId).startsWith('research-'));
    expect(research.length).toBeGreaterThan(0);
    expect(research.every(e => [12, 18].includes(Number(e.data.location)))).toBe(true);
    expect(World.fromSave(w.toSave()).checksum()).toBe(w.checksum());
  });
});

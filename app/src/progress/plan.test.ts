import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayChapters, daysBetween, makePlan, projectedFinish, replan, splitDays, status, streak, key } from './plan.ts';

const chapters = (counts: number[], book = 'b') => counts.map((verses, i) => ({ book, chapter: i + 1, verses }));

test('splitDays covers every chapter exactly once, in order, with a non-decreasing end', () => {
  const ch = chapters(Array.from({ length: 150 }, (_, i) => 5 + ((i * 7) % 40)));
  for (const days of [1, 7, 30, 90, 149, 150]) {
    const ends = splitDays(ch, days);
    assert.equal(ends.length, days);
    assert.equal(ends.at(-1), 150);
    for (let i = 1; i < ends.length; i++) assert.ok(ends[i] >= ends[i - 1]);
    if (days <= 150) assert.ok(ends.every((e, i) => e > (ends[i - 1] ?? 0)), `no empty day with ${days} days`);
  }
});

test('more days than chapters gives rest days at the end, never negative work', () => {
  const ends = splitDays(chapters([3, 3, 3]), 10);
  assert.equal(ends.at(-1), 3);
  assert.deepEqual(ends.slice(0, 3), [1, 2, 3]);
});

test('days are balanced by verses, not chapter count', () => {
  const ends = splitDays(chapters([100, 1, 1, 1, 1, 100]), 2);
  assert.deepEqual(ends, [3, 6]);
});

test('invalid days are rejected', () => {
  assert.throws(() => splitDays(chapters([1]), 0));
  assert.throws(() => splitDays(chapters([1]), 1.5));
  assert.throws(() => splitDays(chapters([1]), 99999));
});

test('status: behind / on track / ahead / done', () => {
  const plan = makePlan(chapters([10, 10, 10, 10, 10, 10]), 'all', 3, '2026-01-01');
  assert.deepEqual(plan.ends, [2, 4, 6]);
  const read = (n: number) => new Set(plan.chapters.slice(0, n));
  assert.equal(status(plan, read(0), '2025-12-31').pace, 'notStarted');
  assert.equal(status(plan, read(0), '2026-01-01').pace, 'onTrack');
  assert.equal(status(plan, read(1), '2026-01-02').pace, 'behind');
  assert.equal(status(plan, read(2), '2026-01-02').pace, 'onTrack');
  assert.equal(status(plan, read(5), '2026-01-02').pace, 'ahead');
  assert.equal(status(plan, read(6), '2026-01-02').pace, 'done');
  assert.equal(status(plan, read(3), '2026-01-09').pace, 'ended');
  assert.deepEqual(status(plan, read(0), '2026-01-02').overdue, plan.chapters.slice(0, 4));
});

test('dayChapters is empty outside the plan', () => {
  const plan = makePlan(chapters([1, 1]), 'all', 2, '2026-01-01');
  assert.deepEqual(dayChapters(plan, -1), []);
  assert.deepEqual(dayChapters(plan, 2), []);
  assert.deepEqual(dayChapters(plan, 0), [key('b', 1)]);
});

test('replan only schedules unread chapters, starting today', () => {
  const plan = makePlan(chapters([5, 5, 5, 5]), 'all', 4, '2026-01-01');
  const next = replan(plan, new Set([key('b', 1), key('b', 3)]), 2, '2026-02-01', () => 5);
  assert.deepEqual(next.chapters, [key('b', 2), key('b', 4)]);
  assert.equal(next.start, '2026-02-01');
  assert.throws(() => replan(plan, new Set(plan.chapters), 2, '2026-02-01', () => 1));
});

test('dates: DST-safe differences and month rollover', () => {
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('streak counts back from today or yesterday', () => {
  assert.equal(streak(['2026-05-10', '2026-05-09', '2026-05-08'], '2026-05-10'), 3);
  assert.equal(streak(['2026-05-09', '2026-05-08'], '2026-05-10'), 2);
  assert.equal(streak(['2026-05-07'], '2026-05-10'), 0);
  assert.equal(streak([], '2026-05-10'), 0);
});

test('projectedFinish uses recent pace and handles no pace', () => {
  assert.equal(projectedFinish([], 10, '2026-05-10'), null);
  assert.equal(projectedFinish(['2026-05-10'], 0, '2026-05-10'), '2026-05-10');
  // 14 reads in 14 days = 1/day -> 10 left finishes in 10 days
  const dates = Array.from({ length: 14 }, (_, i) => addDays('2026-05-10', -i));
  assert.equal(projectedFinish(dates, 10, '2026-05-10'), '2026-05-20');
});

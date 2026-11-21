import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SEATS, MIN_SEATS, minSeatDistance, planLayout, toPercent, ROOM, type LayoutKind } from './seating.ts';

const LAYOUTS: LayoutKind[] = ['round', 'rect', 'u_shape', 'theatre', 'majlis'];

for (const layout of LAYOUTS) {
  test(`${layout}: ranks are 1..n, unique, inside the room, chairs never overlap`, () => {
    for (let n = MIN_SEATS; n <= MAX_SEATS[layout]; n++) {
      const plan = planLayout(layout, n);
      assert.equal(plan.seats.length, n, `${layout} n=${n} count`);
      const ranks = plan.seats.map((s) => s.rank).sort((a, b) => a - b);
      assert.deepEqual(ranks, Array.from({ length: n }, (_, i) => i + 1), `${layout} n=${n} ranks`);
      for (const s of plan.seats) {
        const p = toPercent(s.x, s.y);
        assert.ok(p.x >= 5 && p.x <= 95 && p.y >= 5 && p.y <= 95, `${layout} n=${n} seat ${s.rank} in bounds`);
        assert.ok(s.x > 30 && s.x < ROOM.w - 30 && s.y > 30 && s.y < ROOM.h - 20, `${layout} n=${n} seat ${s.rank} inside frame`);
      }
      assert.ok(minSeatDistance(plan.seats) >= 44, `${layout} n=${n} min distance ${minSeatDistance(plan.seats).toFixed(1)}`);
    }
  });

  test(`${layout}: counts are clamped to the supported range`, () => {
    assert.equal(planLayout(layout, 1).seats.length, MIN_SEATS);
    assert.equal(planLayout(layout, 99).seats.length, MAX_SEATS[layout]);
  });
}

test('the chief guest (rank 2) sits on the host\'s right = screen-left in head-table layouts', () => {
  for (const layout of ['round', 'u_shape', 'theatre', 'majlis'] as LayoutKind[]) {
    const seats = planLayout(layout, 8).seats;
    const r1 = seats.find((s) => s.rank === 1)!;
    const r2 = seats.find((s) => s.rank === 2)!;
    const r3 = seats.find((s) => s.rank === 3)!;
    assert.ok(r2.x < r1.x, `${layout}: rank 2 is left of rank 1`);
    assert.ok(r3.x > r1.x || layout === 'theatre' || layout === 'round', `${layout}: rank 3 mirrors on the other side`);
  }
});

test('round: host is at the top, facing the door at the bottom', () => {
  const seats = planLayout('round', 10).seats;
  const host = seats.find((s) => s.rank === 1)!;
  assert.ok(Math.abs(host.x - 400) < 1 && host.y < 255);
  assert.ok(Math.abs(((host.facing % 360) + 360) % 360 - 90) < 1, 'host faces south');
});

test('rect: principals face each other across the table; host side takes odd ranks', () => {
  const seats = planLayout('rect', 8).seats;
  const host = seats.find((s) => s.rank === 1)!;
  const guest = seats.find((s) => s.rank === 2)!;
  assert.ok(Math.abs(host.x - guest.x) < 1 && host.y < guest.y);
  for (const s of seats) assert.equal(s.side, s.rank % 2 === 1 ? 'host' : 'guest');
});

test('majlis: host at the head (far wall), guests flow along the walls', () => {
  const seats = planLayout('majlis', 14).seats;
  const host = seats.find((s) => s.rank === 1)!;
  assert.ok(host.y < 130 && Math.abs(host.x - 400) < 1);
  assert.ok(seats.some((s) => s.x < 120) && seats.some((s) => s.x > 680), 'both side walls are used');
});

test('toPercent clamps to the SeatNode schema range', () => {
  assert.deepEqual(toPercent(0, 0), { x: 5, y: 5 });
  assert.deepEqual(toPercent(ROOM.w, ROOM.h), { x: 95, y: 95 });
});

import assert from "node:assert/strict";
import test from "node:test";
import { daySeries, hourSeries, niceMax, scanTotals } from "../src/features/dashboard/model.js";

test("niceMax rounds up to a readable axis top", () => {
  assert.equal(niceMax(0), 10);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(75), 100);
  assert.equal(niceMax(140), 200);
  assert.equal(niceMax(908), 1000);
});

test("hourSeries shows the shift and widens it for scans outside", () => {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, scans: hour === 9 ? 5 : 0 }));
  const shift = hourSeries(hours, new Date(2026, 10, 23, 9, 30));
  assert.equal(shift.labels[0], "08");
  assert.equal(shift.labels.at(-1), "19");
  assert.equal(shift.values[1], 5);
  assert.equal(shift.highlight, 1);
  hours[21].scans = 2;
  const late = hourSeries(hours, new Date(2026, 10, 23, 3));
  assert.equal(late.labels.at(-1), "21");
  assert.equal(late.highlight, -1);
});

test("daySeries labels dates and highlights today", () => {
  const series = daySeries([
    { date: "2026-11-22", scans: 3 },
    { date: "2026-11-23", scans: 140 },
  ]);
  assert.deepEqual(series.labels, ["22.11", "23.11"]);
  assert.equal(series.highlight, 1);
  assert.equal(series.scale, 200);
});

test("scanTotals sums today and the week", () => {
  const totals = scanTotals({
    hours: [{ hour: 9, scans: 4 }, { hour: 10, scans: 6 }],
    days: [{ date: "2026-11-22", scans: 4 }, { date: "2026-11-23", scans: 10 }],
  });
  assert.deepEqual(totals, { today: 10, week: 14, average: 7 });
  assert.equal(scanTotals(null), null);
});

import { previewWorkerRows, queueTotal, workerRows } from "../src/features/dashboard/model.js";

test("workerRows turns the workers report into rows", () => {
  const [row] = workerRows([
    {
      id: 3, name: "Іван", email: "i@x.ua", warehouse_name: "Склад Київ", online: false,
      scans_today: 12, pending: 2, last_activity_at: "2026-11-23T09:12:00",
    },
  ]);
  assert.equal(row.subtitle, "Склад Київ · i@x.ua");
  assert.equal(row.status, "Офлайн");
  assert.equal(row.time, "09:12");
  assert.equal(row.date, "23.11");
  assert.deepEqual(workerRows(undefined), []);
});

test("queueTotal sums documents queued on phones", () => {
  assert.deepEqual(queueTotal([{ pending: 3 }, { pending: 0 }, { pending: 2 }]), { pending: 5, workers: 2 });
  assert.equal(queueTotal(undefined), null);
});

test("previewWorkerRows keeps the demo people in order", () => {
  const users = [5, 6, 7, 9].map((id) => ({ id, name: `U${id}`, warehouse: id === 9 ? 2 : 1, code: `W-${id}` }));
  const rows = previewWorkerRows(users, "");
  assert.deepEqual(rows.map((r) => r.id), [5, 7, 9, 6]);
  assert.equal(rows[3].online, false);
  assert.equal(rows[0].subtitle, "Склад №1 · W-5");
  assert.deepEqual(previewWorkerRows(users, "2").map((r) => r.id), [9]);
});

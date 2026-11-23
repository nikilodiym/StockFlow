/**
 * Scan statistics → chart series. A series is
 * { labels, values, highlight (index of the green column), scale (value of a full-height column), ticks: [top, middle] }.
 */
import { fmt } from "../../shared/lib/format.js";

/** Working shift shown on the hourly chart; widened when there are scans outside it. */
export const SHIFT = [8, 19];

const pad = (n) => String(n).padStart(2, "0");

/** Round the maximum up to 1/2/2.5/5 × 10ⁿ so the axis has readable numbers. */
export function niceMax(max) {
  if (!(max > 0)) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((x) => x * magnitude >= max);
  return step * magnitude;
}

function withAxis(series) {
  const top = niceMax(Math.max(...series.values, 0));
  return { ...series, scale: top, ticks: [fmt(top), fmt(top / 2)] };
}

/** [{hour, scans}] for one day → shift hours (08–19 or wider), current hour highlighted. */
export function hourSeries(hours, now = new Date()) {
  const counts = new Map(hours.map((h) => [h.hour, h.scans]));
  const used = hours.filter((h) => h.scans > 0).map((h) => h.hour);
  const from = Math.min(SHIFT[0], ...used),
    to = Math.max(SHIFT[1], ...used);
  const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return withAxis({
    labels: range.map(pad),
    values: range.map((h) => counts.get(h) || 0),
    highlight: range.indexOf(now.getHours()),
  });
}

/** [{date: "YYYY-MM-DD", scans}] oldest first → "dd.mm" labels, today (the last day) highlighted. */
export function daySeries(days) {
  return withAxis({
    labels: days.map((d) => `${d.date.slice(8, 10)}.${d.date.slice(5, 7)}`),
    values: days.map((d) => d.scans),
    highlight: days.length - 1,
  });
}

/** Numbers for the metric tiles. */
export function scanTotals(stats) {
  if (!stats) return null;
  const sum = (rows) => rows.reduce((total, row) => total + row.scans, 0);
  const week = sum(stats.days);
  return {
    today: sum(stats.hours),
    week,
    average: Math.round(week / Math.max(1, stats.days.length)),
  };
}

/** Demo series of the preview mode (?preview=1) — the same picture as before real data existed. */
export function previewScanSeries(manager) {
  return {
    today: {
      labels: ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"],
      values: [manager ? 38 : 44, manager ? 64 : 75, manager ? 46 : 54, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      highlight: 2,
      scale: 85,
      ticks: ["80", "40"],
    },
    week: {
      labels: ["16.10", "17.10", "18.10", "19.10", "20.10", "21.10", "22.10"],
      values: [790, 0, 0, 750, 805, 908, 174],
      highlight: 6,
      scale: 1000,
      ticks: ["1 000", "500"],
    },
  };
}

/**
 * "Активні комірники" rows. A row is
 * { id, name, subtitle, online, status, scans, pending, time, date }.
 */
export function workerRows(workers) {
  return (workers || []).map((w) => {
    const at = w.last_activity_at ? new Date(w.last_activity_at) : null;
    return {
      id: w.id,
      name: w.name,
      subtitle: `${w.warehouse_name || "Без складу"} · ${w.email}`,
      online: w.online,
      status: w.online ? "Онлайн" : "Офлайн",
      scans: w.scans_today,
      pending: w.pending,
      time: at ? at.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) : "—",
      date: at ? at.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }) : "",
    };
  });
}

/** Documents still queued on phones, from the workers report. */
export function queueTotal(workers) {
  if (!workers) return null;
  return {
    pending: workers.reduce((sum, w) => sum + (w.pending || 0), 0),
    workers: workers.filter((w) => w.pending > 0).length,
  };
}

/** Demo rows of the preview mode: the same people and numbers as before. */
export function previewWorkerRows(users, warehouse) {
  const order = [5, 7, 9, 6];
  return users
    .filter((u) => order.includes(u.id))
    .sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id))
    .filter((u) => !warehouse || String(u.warehouse) === warehouse)
    .map((u) => ({
      id: u.id,
      name: u.name,
      subtitle: `Склад №${u.warehouse || u.memberships?.[0]?.warehouse} · ${u.code || u.id}`,
      online: u.id !== 6,
      status: u.id === 6 ? "Зміна з 14:00" : "Онлайн",
      scans: { 5: 148, 7: 14, 9: 12, 6: 0 }[u.id] || 0,
      pending: { 5: 26, 7: 2 }[u.id] || 0,
      time: { 5: "09:12", 7: "09:12", 9: "10:02", 6: "19:48" }[u.id],
      date: "22.10",
    }));
}

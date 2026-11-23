/** Labels of roles, document types and statuses (same values as the API). */
export const roles = {
  admin: "Адміністратор",
  manager: "Менеджер складу",
  worker: "Комірник",
};
export const types = {
  receipt: "Прихід",
  writeoff: "Списання",
  inventory: "Інвентаризація",
  transfer: "Переміщення",
};
export const statuses = {
  draft: "Чернетка",
  posted: "Проведено",
  synced: "Синхронізовано",
  conflict: "Конфлікт",
  cancelled: "Скасовано",
};

/** Document rules shared by the documents page, the document drawer and the dashboard. */
import { ArrowDownToLine, ArrowLeftRight, FileText, Trash2 } from "lucide-react";

/** A document with an open sync conflict is shown with the "conflict" status. */
export function markConflicts(documents, conflicts) {
  return documents.map((doc) => ({
    ...doc,
    status: conflicts.some(
      (c) => String(c.entity_id) === String(doc.id) && c.status === "open",
    )
      ? "conflict"
      : doc.status,
  }));
}

export const openConflictOf = (conflicts, document) =>
  conflicts.find(
    (c) => String(c.entity_id) === String(document.id) && c.status === "open",
  );

export const statusTone = (status) =>
  status === "conflict"
    ? "red"
    : status === "draft"
      ? "gray"
      : status === "posted"
        ? "yellow"
        : "green";

export const typeIcon = (type) =>
  type === "writeoff"
    ? Trash2
    : type === "transfer"
      ? ArrowLeftRight
      : type === "receipt"
        ? ArrowDownToLine
        : FileText;

export const firstConflict = (documents) =>
  documents.find((d) => d.status === "conflict");

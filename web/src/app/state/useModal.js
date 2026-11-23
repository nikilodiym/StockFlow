/**
 * Which dialog is open (modal.kind + the item it edits), its form values and error.
 * The dialogs themselves live in features/<name>/modals and are listed in app/modals/registry.js.
 */
import { useState } from "react";

export default function useModal(isBusy) {
  const [modal, setModal] = useState(null),
    [form, setForm] = useState({}),
    [error, setError] = useState("");

  function open(kind, item = null, values = {}, extra = {}) {
    setModal({ kind, item, ...extra });
    setForm(values);
    setError("");
  }

  function close() {
    if (!isBusy()) {
      setModal(null);
      setError("");
    }
  }

  return { modal, setModal, form, setForm, error, setError, open, close };
}

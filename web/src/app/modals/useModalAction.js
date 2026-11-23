/**
 * Runs a dialog action with the shared busy/error handling:
 * busy while running, error shown in the dialog, dialog closed on success.
 * Return KEEP_OPEN from the action to keep (or replace) the dialog yourself.
 */
import { useAdmin } from "../state/AdminProvider";

export const KEEP_OPEN = Symbol("keep-open");

export default function useModalAction() {
  const { setError, setLoading, setModal } = useAdmin();
  return async function run(action, { fallbackError = "", onFinally } = {}) {
    setError("");
    setLoading(true);
    try {
      if ((await action()) !== KEEP_OPEN) setModal(null);
    } catch (err) {
      setError(err.message || fallbackError);
    } finally {
      setLoading(false);
      onFinally?.();
    }
  };
}

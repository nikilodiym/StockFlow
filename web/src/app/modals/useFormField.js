/** `patch("name", value)` — update one field of the open dialog's form. */
import { useAdmin } from "../state/AdminProvider";

export default function useFormField() {
  const { setForm } = useAdmin();
  return (key, value) => setForm((f) => ({ ...f, [key]: value }));
}

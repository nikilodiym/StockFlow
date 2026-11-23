/** Short confirmation message at the bottom of the screen; hides after 4.5 s. */
import { useCallback, useEffect, useState } from "react";

export default function useToast() {
  const [toast, setToast] = useState("");
  const say = useCallback(setToast, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, say };
}

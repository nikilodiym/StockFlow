/** Current page synced with the URL hash (#catalog), so reload and Back keep the page. */
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PAGE, PAGE_IDS } from "../routes";

const pageFromHash = () => {
  const id = location.hash.slice(1);
  return PAGE_IDS.includes(id) ? id : null;
};

export default function useNavigation(onNavigate) {
  const [page, setPage] = useState(() => pageFromHash() || DEFAULT_PAGE);

  const go = useCallback(
    (next) => {
      setPage(next);
      location.hash = next;
      onNavigate();
    },
    [onNavigate],
  );

  useEffect(() => {
    const fn = () => {
      const next = pageFromHash();
      if (next) {
        setPage(next);
        onNavigate();
      }
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, [onNavigate]);

  return { page, go };
}

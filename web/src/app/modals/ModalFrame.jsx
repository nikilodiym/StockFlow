/**
 * Dialog chrome shared by every modal: overlay, focus trap, Esc, close button,
 * confirmation icon, title and error. The body comes from the feature modal.
 */
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Tile } from "../../shared/ui";
import { useAdmin } from "../state/AdminProvider";

export default function ModalFrame({ kind, variant, title, icon: Icon, children }) {
  const { modal, error, loading, close } = useAdmin();
  const dialogRef = useRef(),
    lastFocus = useRef(),
    busy = useRef(false);
  busy.current = loading;

  useEffect(() => {
    lastFocus.current = document.activeElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(
      () =>
        (
          dialogRef.current?.querySelector(
            'input:not(:disabled):not([type="file"]),select:not(:disabled)',
          ) || dialogRef.current?.querySelector("button:not(:disabled)")
        )?.focus(),
      0,
    );
    const key = (e) => {
      if (e.key === "Escape" && !busy.current) close();
      if (e.key === "Tab") {
        const els = [
          ...dialogRef.current.querySelectorAll(
            'button:not(:disabled),input:not(:disabled):not([type="file"]),select:not(:disabled),[tabindex="0"]',
          ),
        ];
        if (!els.length) return;
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", key);
      document.body.style.overflow = before;
      lastFocus.current?.focus();
    };
  }, [modal?.kind, modal?.item?.id]);

  const drawer = variant === "drawer",
    confirmation = variant === "confirmation";
  return (
    <div
      className={`modal-overlay ${drawer ? "drawer-overlay" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={dialogRef}
        className={`modal kind-${kind} ${drawer ? "drawer" : ""} ${confirmation ? "confirmation" : ""} ${variant === "import" ? "import-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button className="modal-close" onClick={close} disabled={loading} aria-label="Закрити">
          <X size={19} />
        </button>
        {confirmation && (
          <Tile tone={kind === "created" ? "" : "red"}>
            <Icon />
          </Tile>
        )}
        {title !== null && <h2 id="dialog-title">{title}</h2>}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {children}
      </section>
    </div>
  );
}

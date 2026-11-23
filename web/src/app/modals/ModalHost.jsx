/** Renders the open dialog (if any) from the registry inside the shared frame. */
import { useAdmin } from "../state/AdminProvider";
import ModalFrame from "./ModalFrame";
import { MODALS } from "./registry";

export default function ModalHost() {
  const { modal } = useAdmin();
  if (!modal) return null;
  const entry = MODALS[modal.kind];
  if (!entry) return null;
  const { component: Body, variant, icon } = entry;
  const title = typeof entry.title === "function" ? entry.title(modal) : entry.title;
  return (
    <ModalFrame kind={modal.kind} variant={variant} title={title} icon={icon}>
      <Body />
    </ModalFrame>
  );
}

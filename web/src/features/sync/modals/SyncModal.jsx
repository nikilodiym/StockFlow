/** "Журнал синхронізацій" drawer. */
import { useAdmin } from "../../../app/state/AdminProvider";
import SyncEvents from "../components/SyncEvents";

export default function SyncModal() {
  const { preview } = useAdmin();
  return (
    <>
      <div className="note">
        {preview
          ? "Не синхронізовано зараз: Склад №1 · 26, Склад №2 · 2, Склад №3 · 0"
          : "Історія синхронізацій за даними сервера"}
      </div>
      <SyncEvents compact />
    </>
  );
}

/**
 * All dialogs: modal kind → body component, title and look.
 * Open one anywhere with open("<kind>", item, formValues).
 *   variant: "form" (default) | "confirmation" (icon on top) | "drawer" (side panel) | "import"
 *   title:   string or (modal) => string; null = the body renders its own heading
 */
import { Ban, CircleCheck, LogOut, Trash2 } from "lucide-react";
import LogoutModal from "../../features/auth/modals/LogoutModal";
import CategoryModal from "../../features/catalog/modals/CategoryModal";
import ImportModal from "../../features/catalog/modals/ImportModal";
import ProductModal from "../../features/catalog/modals/ProductModal";
import UnitModal from "../../features/catalog/modals/UnitModal";
import DocumentDrawer from "../../features/documents/modals/DocumentDrawer";
import NotificationModal from "../../features/notifications/modals/NotificationModal";
import SyncModal from "../../features/sync/modals/SyncModal";
import BlockModal from "../../features/users/modals/BlockModal";
import CreatedModal from "../../features/users/modals/CreatedModal";
import PasswordModal from "../../features/users/modals/PasswordModal";
import UserModal from "../../features/users/modals/UserModal";
import WarehouseModal from "../../features/warehouses/modals/WarehouseModal";
import DeleteModal from "./DeleteModal";

const edit = (create, update) => ({ item }) => (item ? update : create);

export const MODALS = {
  product: { component: ProductModal, title: edit("Новий товар", "Редагувати товар") },
  category: { component: CategoryModal, title: edit("Нова категорія", "Редагувати категорію") },
  unit: { component: UnitModal, title: edit("Нова одиниця виміру", "Редагувати одиницю виміру") },
  import: { component: ImportModal, title: "Імпорт номенклатури", variant: "import" },
  warehouse: { component: WarehouseModal, title: edit("Новий склад", "Редагувати склад") },
  user: { component: UserModal, title: edit("Новий акаунт", "Редагувати акаунт") },
  password: { component: PasswordModal, title: "Змінити пароль" },
  created: { component: CreatedModal, title: "Акаунт створено", variant: "confirmation", icon: CircleCheck },
  delete: {
    component: DeleteModal,
    title: (m) => (m.collection === "products" ? "Видалити товар?" : "Видалити запис?"),
    variant: "confirmation",
    icon: Trash2,
  },
  block: {
    component: BlockModal,
    title: (m) => (m.item?.is_active ? "Заблокувати акаунт?" : "Розблокувати акаунт?"),
    variant: "confirmation",
    icon: Ban,
  },
  logout: { component: LogoutModal, title: "Вийти з акаунта?", variant: "confirmation", icon: LogOut },
  sync: { component: SyncModal, title: "Журнал синхронізацій", variant: "drawer" },
  notification: { component: NotificationModal, title: (m) => m.item?.title },
  document: { component: DocumentDrawer, title: null, variant: "drawer" },
};

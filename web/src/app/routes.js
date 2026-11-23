/**
 * Pages of the admin panel: hash URL (#catalog), sidebar entry, title, component, access.
 * Add a page here — the sidebar, the title and the router pick it up.
 */
import CatalogPage from "../features/catalog/pages/CatalogPage";
import DashboardPage from "../features/dashboard/pages/DashboardPage";
import DocumentsPage from "../features/documents/pages/DocumentsPage";
import ReportsPage from "../features/reports/pages/ReportsPage";
import UsersPage from "../features/users/pages/UsersPage";
import WarehousesPage from "../features/warehouses/pages/WarehousesPage";
import {
  DocumentIcon,
  HomeIcon,
  PackageIcon,
  ReportsIcon,
  UserIcon,
  WarehouseIcon,
} from "../shared/ui/ReferenceIcon";

export const ROUTES = [
  { id: "dashboard", label: "Дашборд", title: "Дашборд", icon: HomeIcon, component: DashboardPage },
  { id: "catalog", label: "Номенклатура", title: "Номенклатура товарів", icon: PackageIcon, component: CatalogPage },
  { id: "documents", label: "Документи", title: "Складські документи", icon: DocumentIcon, component: DocumentsPage },
  { id: "users", label: "Користувачі", title: "Користувачі", icon: UserIcon, component: UsersPage, adminOnly: true },
  { id: "warehouses", label: "Склади", title: "Склади", icon: WarehouseIcon, component: WarehousesPage },
  { id: "reports", label: "Звіти", title: "Аналітика та звіти", icon: ReportsIcon, component: ReportsPage },
];

export const DEFAULT_PAGE = "dashboard";
export const PAGE_IDS = ROUTES.map((r) => r.id);
export const routeById = (id) => ROUTES.find((r) => r.id === id);

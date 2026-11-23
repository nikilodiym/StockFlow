/** Page title, search, warehouse filter, notifications and profile. */
import { Menu } from "lucide-react";
import NotificationsMenu from "../../features/notifications/components/NotificationsMenu";
import { Select } from "../../shared/ui";
import { routeById } from "../routes";
import { useAdmin } from "../state/AdminProvider";
import GlobalSearch from "./GlobalSearch";
import ProfileMenu from "./ProfileMenu";

export default function Topbar({ menus, setMenus, onToggleNav }) {
  const { page, user, admin, data, warehouse, setWarehouse } = useAdmin();
  const toggle = (name) => setMenus((m) => ({ notice: name === "notice" && !m.notice, profile: name === "profile" && !m.profile }));
  return (
    <header className="topbar">
      <button className="mobile-menu" aria-label="Меню" onClick={onToggleNav}>
        <Menu />
      </button>
      <h1>{routeById(page)?.title}</h1>
      <div className="header-tools">
        <GlobalSearch />
        <Select
          value={warehouse}
          disabled={!admin && user.memberships?.length === 1}
          label="Склад"
          onChange={(e) => setWarehouse(e.target.value)}
        >
          <option value="">Усі склади</option>
          {data.warehouses.map((w) => (
            <option value={w.id} key={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
        <NotificationsMenu
          isOpen={menus.notice}
          onToggle={() => toggle("notice")}
          onClose={() => setMenus((m) => ({ ...m, notice: false }))}
        />
        <ProfileMenu
          isOpen={menus.profile}
          onToggle={() => toggle("profile")}
          onClose={() => setMenus((m) => ({ ...m, profile: false }))}
        />
      </div>
    </header>
  );
}

/** Avatar with name and role; menu: reload data, log out. */
import { ChevronDown, LogOut, RefreshCw } from "lucide-react";
import { roles } from "../../shared/lib/dictionaries";
import { initials } from "../../shared/lib/format";
import { roleOf } from "../../shared/lib/roles";
import { useAdmin } from "../state/AdminProvider";

export default function ProfileMenu({ isOpen, onToggle, onClose }) {
  const { user, preview, load, open } = useAdmin();
  return (
    <div className="profile-anchor">
      <button className="profile" onClick={onToggle} aria-expanded={isOpen}>
        <span className="avatar-yellow">{initials(user.name)}</span>
        <span>
          {user.name}
          <small>{roles[roleOf(user)]}</small>
        </span>
        <ChevronDown size={22} />
      </button>
      {isOpen && (
        <div className="profile-menu">
          {preview && <small>Режим перегляду макетів</small>}
          <button
            onClick={() => {
              load();
              onClose();
            }}
          >
            <RefreshCw size={18} />
            Оновити дані
          </button>
          <button onClick={() => open("logout")}>
            <LogOut size={18} />
            Вийти з акаунта
          </button>
        </div>
      )}
    </div>
  );
}

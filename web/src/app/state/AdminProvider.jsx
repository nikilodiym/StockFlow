/**
 * Composes the panel state from small hooks and shares it through context.
 * Pages and dialogs read it with useAdmin() instead of receiving one big prop.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { roleOf } from "../../shared/lib/roles";
import { categoriesWithStats } from "../../features/catalog/model";
import { isPreview, previewRole, previewUser } from "./preview";
import useAdminData from "./useAdminData";
import useFilters from "./useFilters";
import useModal from "./useModal";
import useNavigation from "./useNavigation";
import useToast from "./useToast";

const AdminContext = createContext(null);

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem("sf_user") || "null");
  } catch {
    return null;
  }
}

export function AdminProvider({ children }) {
  const [preview] = useState(isPreview);
  const [user, setUser] = useState(() => (preview ? previewUser() : storedUser()));
  const admin = roleOf(user) === "admin";

  const filters = useFilters({
    user,
    initialWarehouse: preview && previewRole() === "manager" ? "1" : "",
  });
  const { setQuery, setPagination } = filters;
  const onNavigate = useCallback(() => {
    setQuery("");
    setPagination(1);
  }, [setQuery, setPagination]);
  const { page, go } = useNavigation(onNavigate);

  const { toast, say } = useToast();
  const store = useAdminData({ preview, user, setUser, admin, warehouse: filters.warehouse });
  const modal = useModal(() => store.loading);

  // The users page is for administrators only.
  useEffect(() => {
    if (user && !admin && page === "users") go("dashboard");
  }, [page, user, admin, go]);

  const categories = useMemo(
    () => categoriesWithStats(store.data.categories, store.data.products, preview),
    [store.data.categories, store.data.products, preview],
  );

  const value = {
    preview,
    user,
    setUser,
    admin,
    page,
    go,
    ...filters,
    ...store,
    ...modal,
    toast,
    say,
    categories,
  };
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside AdminProvider");
  return value;
}

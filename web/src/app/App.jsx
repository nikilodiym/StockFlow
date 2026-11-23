/** Login gate + layout + the page for the current URL hash. */
import LoginPage from "../features/auth/pages/LoginPage";
import AppLayout from "./layout/AppLayout";
import { routeById } from "./routes";
import { AdminProvider, useAdmin } from "./state/AdminProvider";

function CurrentPage() {
  const { page, admin } = useAdmin();
  const route = routeById(page);
  if (!route || (route.adminOnly && !admin)) return null;
  const Page = route.component;
  return <Page />;
}

function Shell() {
  const { user, setUser } = useAdmin();
  if (!user) return <LoginPage onLogin={setUser} />;
  return (
    <AppLayout>
      <CurrentPage />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <Shell />
    </AdminProvider>
  );
}

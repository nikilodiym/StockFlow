import home from "./icons/home.svg?raw";
import packageIcon from "./icons/package.svg?raw";
import documentIcon from "./icons/document.svg?raw";
import user from "./icons/user.svg?raw";
import warehouse from "./icons/warehouse.svg?raw";
import reports from "./icons/reports.svg?raw";
const vectors = {
  home,
  package: packageIcon,
  document: documentIcon,
  user,
  warehouse,
  reports,
};
export default function ReferenceIcon({ name }) {
  return (
    <span
      className="reference-icon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: vectors[name] }}
    />
  );
}
export const HomeIcon = () => <ReferenceIcon name="home" />;
export const PackageIcon = () => <ReferenceIcon name="package" />;
export const DocumentIcon = () => <ReferenceIcon name="document" />;
export const UserIcon = () => <ReferenceIcon name="user" />;
export const WarehouseIcon = () => <ReferenceIcon name="warehouse" />;
export const ReportsIcon = () => <ReferenceIcon name="reports" />;

/** Top search: quick results across products, documents and (admins) users; Enter searches the catalog. */
import { useState } from "react";
import { Search } from "lucide-react";
import { types } from "../../shared/lib/dictionaries";
import { useAdmin } from "../state/AdminProvider";

export default function GlobalSearch() {
  const { data, admin, go, setQuery } = useAdmin();
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const results = search
    ? [
        ["catalog", data.products.filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q)).slice(0, 4)],
        ["documents", data.documents.filter((d) => d.number.toLowerCase().includes(q)).slice(0, 3)],
        ["users", admin ? data.users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q)).slice(0, 3) : []],
      ]
    : [];
  return (
    <form
      className="global-search"
      onSubmit={(e) => {
        e.preventDefault();
        go("catalog");
        setQuery(search);
        setSearch("");
      }}
    >
      <input
        aria-label="Пошук товару, документа або людини"
        placeholder="Товар, документ або людина"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button aria-label="Шукати">
        <Search size={25} strokeWidth={1.5} />
      </button>
      {search && (
        <div className="search-results">
          {results.flatMap(([target, rows]) =>
            rows.map((r) => (
              <button
                key={target + r.id}
                type="button"
                onClick={() => {
                  go(target);
                  setQuery(r.name || r.number);
                  setSearch("");
                }}
              >
                <span>{r.name || r.number}</span>
                <small>{r.sku || r.email || types[r.type]}</small>
              </button>
            )),
          )}
          <small className="search-hint">Enter — знайти у номенклатурі</small>
        </div>
      )}
    </form>
  );
}

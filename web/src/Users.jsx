import { useEffect, useState } from "react";
import { Plus, PencilLine, KeyRound, Ban, CircleCheck } from "lucide-react";
import { roles } from "./data";
import {
  Tabs,
  Button,
  Select,
  Table,
  Tile,
  IconButton,
  Badge,
  Pagination,
  initials,
  roleOf,
  dateParts,
} from "./ui";
export default function Users({ a }) {
  const {
    data,
    setData,
    user,
    preview,
    userTab,
    setUserTab,
    warehouse,
    query,
    setQuery,
    pagination,
    setPagination,
    open,
    editUser,
    say,
  } = a;
  const [role, setRole] = useState(""),
    [state, setState] = useState("");
  useEffect(() => setPagination(1), [userTab, role, state, setPagination]);
  const visible = data.users.filter(
    (u) =>
      `${u.name} ${u.email} ${u.code || u.id}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!role || roleOf(u) === role) &&
      (!state || String(u.is_active) === state) &&
      (!warehouse ||
        u.is_staff ||
        u.memberships?.some((m) => String(m.warehouse) === warehouse)),
  );
  return (
    <>
      <div className="toolbar">
        <Tabs
          items={[
            ["accounts", `Акаунти ${data.users.length}`],
            ["permissions", "Права доступу"],
            ["requests", `Запити на відновлення${data.requests.length || ""}`],
          ]}
          value={userTab}
          onChange={setUserTab}
        />
        <Button tone="yellow" icon={Plus} onClick={() => editUser()}>
          Створити акаунт
        </Button>
      </div>
      {userTab === "accounts" && (
        <>
          <div className="filters">
            <input
              placeholder="Ім’я, email або код"
              aria-label="Пошук користувачів"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              value={role}
              label="Роль"
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Усі ролі</option>
              {Object.entries(roles).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={state}
              label="Стан акаунта"
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">Усі стани</option>
              <option value="true">Активний</option>
              <option value="false">Заблоковано</option>
            </Select>
          </div>
          <section className="panel users-table">
            <Table
              headers={[
                "Користувач",
                "Код",
                "Роль",
                "Склад",
                "Активність",
                "Стан",
                "Дії",
              ]}
              empty={!visible.length}
            >
              {visible
                .slice((pagination - 1) * 10, pagination * 10)
                .map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-title">
                        <Tile tone={u.is_active ? "" : "gray"}>
                          {initials(u.name)}
                        </Tile>
                        <span>
                          {u.name}
                          <small>{u.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{u.code || String(u.id).slice(0, 8)}</td>
                    <td>
                      <Badge
                        tone={
                          roleOf(u) === "admin"
                            ? "blue"
                            : roleOf(u) === "manager"
                              ? "yellow"
                              : "green"
                        }
                      >
                        {roles[roleOf(u)]}
                      </Badge>
                    </td>
                    <td>
                      {u.is_staff
                        ? "Усі склади"
                        : u.memberships
                            ?.map(
                              (m) =>
                                m.warehouse_name ||
                                data.warehouses.find(
                                  (w) => String(w.id) === String(m.warehouse),
                                )?.name,
                            )
                            .join(", ") || "—"}
                    </td>
                    <td>
                      {u.activity ||
                        (u.last_login
                          ? dateParts(u.last_login).join(", ")
                          : "Ще не входив")}
                    </td>
                    <td>
                      <Badge tone={u.is_active ? "green" : "red"}>
                        {u.is_active ? "Активний" : "Заблоковано"}
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <IconButton
                          icon={PencilLine}
                          label={`Редагувати ${u.name}`}
                          onClick={() => editUser(u)}
                        />
                        <IconButton
                          icon={KeyRound}
                          label={`Змінити пароль ${u.name}`}
                          onClick={() => open("password", u, { password: "" })}
                        />
                        <IconButton
                          icon={u.is_active ? Ban : CircleCheck}
                          danger={u.is_active}
                          disabled={u.id === user.id}
                          label={`${u.is_active ? "Заблокувати" : "Розблокувати"} ${u.name}`}
                          onClick={() => open("block", u)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </Table>
            <Pagination
              total={visible.length}
              page={pagination}
              onChange={setPagination}
            />
          </section>
        </>
      )}
      {userTab === "permissions" && (
        <>
          <section className="panel permissions-table">
            <Table
              headers={["Дія", "Комірник", "Менеджер складу", "Адміністратор"]}
            >
              {[
                ["Сканування та документи на пристрої", 1, 1, 1],
                ["Видимість своїх чернеток", 1, 1, 1],
                ["Віддалене проведення документів", 0, 1, 1],
                ["Контроль складів і звітів", 0, 1, 1],
                ["Вибір варіанту в конфліктах на сервері", 0, 1, 1],
                ["Керування номенклатурою", 0, 0, 1],
                ["Керування складами", 0, 0, 1],
                ["Користувачі та права доступу", 0, 0, 1],
                ["Налаштування сервера", 0, 0, 1],
              ].map(([label, ...values]) => (
                <tr key={label}>
                  <td>{label}</td>
                  {values.map((v, i) => (
                    <td key={i} className="permission-cell">
                      {v ? <CircleCheck size={23} /> : <span>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </Table>
            <div className="table-bottom-space" />
          </section>
          <small className="footnote">
            Ролі такі самі, як у мобільному застосунку: Комірник — рівень 1,
            Менеджер — рівень 2, Адміністратор — рівень 3.
          </small>
        </>
      )}
      {userTab === "requests" && (
        <>
          <section className="panel request-panel">
            <Table
              headers={["Користувач", "Склад", "Коли надійшов", "Дії"]}
              empty={!data.requests.length}
            >
              {data.requests.map((r) => {
                const u = data.users.find((u) => u.id === r.user);
                return (
                  u && (
                    <tr key={r.id}>
                      <td>
                        <div className="cell-title">
                          <Tile>{initials(u.name)}</Tile>
                          <span>
                            {u.name}
                            <small>{u.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        {data.warehouses.find((w) => w.id === u.warehouse)
                          ?.name || "—"}
                      </td>
                      <td>{r.created_at}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setData((d) => ({
                                ...d,
                                requests: d.requests.filter(
                                  (x) => x.id !== r.id,
                                ),
                              }));
                              say("Запит відхилено");
                            }}
                          >
                            Відхилити
                          </button>
                          <Button
                            tone="primary"
                            onClick={() =>
                              open(
                                "password",
                                u,
                                { password: "" },
                                { requestId: r.id },
                              )
                            }
                          >
                            Скинути пароль
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                );
              })}
            </Table>
          </section>
          <small className="footnote">
            {preview
              ? "Запит приходить із кнопки «Забули пароль?» на екрані входу в мобільному застосунку."
              : "API запитів на відновлення ще не підключено. Пароль можна змінити у вкладці «Акаунти»."}
          </small>
        </>
      )}
    </>
  );
}

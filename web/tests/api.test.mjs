import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { request, getAll, clearSession, exportCSV } from "../src/api.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.location = { origin: "http://localhost:5176" };
const response = (data, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => storage.clear());

test("JWT expiry refreshes the token and retries the original request", async () => {
  storage.set("sf_token", "expired");
  storage.set("sf_refresh", "refresh-token");
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/refresh/"))
      return response({ access: "new-access", refresh: "new-refresh" });
    return options.headers.Authorization === "Bearer new-access"
      ? response({ id: 12 })
      : response({ detail: "expired" }, 401);
  };
  assert.deepEqual(await request("/products/12/"), { id: 12 });
  assert.equal(calls.length, 3);
  assert.equal(storage.get("sf_token"), "new-access");
  assert.equal(storage.get("sf_refresh"), "new-refresh");
});
test("concurrent expired requests share one refresh", async () => {
  storage.set("sf_token", "expired");
  storage.set("sf_refresh", "refresh-token");
  let refreshes = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/auth/refresh/")) {
      refreshes++;
      return response({ access: "renewed" });
    }
    return options.headers.Authorization === "Bearer renewed"
      ? response([])
      : response({}, 401);
  };
  await Promise.all([request("/products/"), request("/warehouses/")]);
  assert.equal(refreshes, 1);
});
test("rejected refresh clears the session", async () => {
  storage.set("sf_token", "expired");
  storage.set("sf_refresh", "revoked");
  storage.set("sf_user", "{}");
  globalThis.fetch = async () => response({ detail: "Invalid token" }, 401);
  await assert.rejects(request("/products/"), (e) => e.status === 401);
  assert.equal(storage.size, 0);
});
test("login does not send a stale JWT or attempt refresh", async () => {
  storage.set("sf_token", "expired");
  storage.set("sf_refresh", "revoked");
  let count = 0;
  globalThis.fetch = async (url, options) => {
    count++;
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.auth, undefined);
    return response({ detail: "Невірний email або пароль" }, 401);
  };
  await assert.rejects(
    request("/auth/login/", { auth: false, method: "POST", body: "{}" }),
    /Невірний/,
  );
  assert.equal(count, 1);
});
test("pagination loads every API page and preserves query parameters", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return calls.length === 1
      ? response({
          results: [{ id: 1 }],
          next: "http://localhost:8000/api/products/?page=2&warehouse=1",
        })
      : response({ results: [{ id: 2 }], next: null });
  };
  assert.deepEqual(await getAll("/products/?warehouse=1"), [
    { id: 1 },
    { id: 2 },
  ]);
  assert.equal(calls[1], "/api/products/?page=2&warehouse=1");
});
test("multipart CSV uploads retain browser-generated boundaries", async () => {
  const body = new FormData();
  body.append("file", new Blob(["sku;name"]), "test.csv");
  globalThis.fetch = async (url, options) => {
    assert.equal(options.body, body);
    assert.equal(options.headers["Content-Type"], undefined);
    return response({ id: 1 });
  };
  await request("/imports/", { method: "POST", body });
});
test("field validation is returned to the form and DELETE handles 204", async () => {
  globalThis.fetch = async () => response({ sku: ["SKU вже існує"] }, 400);
  await assert.rejects(
    request("/products/", { method: "POST", body: "{}" }),
    /SKU вже існує/,
  );
  globalThis.fetch = async () => response(null, 204);
  assert.equal(await request("/products/1/", { method: "DELETE" }), null);
});
test("CSV export preserves Ukrainian text, quotes and semicolons", async () => {
  let saved;
  globalThis.document = { createElement: () => ({ click() {} }) };
  const oldCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    saved = blob;
    return "blob:test";
  };
  const oldRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = () => {};
  exportCSV("test.csv", ["Назва", "SKU"], [['Фарба; "біла"', "PNT-01"]]);
  assert.match(await saved.text(), /"Фарба; ""біла""";"PNT-01"/);
  URL.createObjectURL = oldCreate;
  URL.revokeObjectURL = oldRevoke;
});

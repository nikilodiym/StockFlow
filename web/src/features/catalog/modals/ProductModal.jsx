/** "Новий товар" / "Редагувати товар": name, SKU, minimum, category, unit, barcodes. */
import { Plus, X } from "lucide-react";
import FormFooter, { saveLabel } from "../../../app/modals/FormFooter";
import useFormField from "../../../app/modals/useFormField";
import useModalAction from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { Button, Field, Select } from "../../../shared/ui";
import { syncProductBarcodes } from "../api";
import { BARCODE_PATTERN } from "../model";

export default function ProductModal() {
  const { modal, form, setForm, setError, data, preview, mutate, load, say } = useAdmin();
  const patch = useFormField();
  const run = useModalAction();
  const item = modal.item;

  const save = (e) => {
    e.preventDefault();
    run(
      async () => {
        const codes = [...(form.barcodesList || [])];
        if (form.barcodeInput) {
          if (!BARCODE_PATTERN.test(form.barcodeInput))
            throw new Error("Штрихкод має містити від 8 до 14 цифр");
          if (!codes.includes(form.barcodeInput)) codes.push(form.barcodeInput);
        }
        const payload = {
          name: form.name.trim(),
          sku: form.sku.trim(),
          min_stock: Number(form.min_stock),
          category_id: form.category_id || null,
          unit: form.unit,
          barcode: codes[0] || "",
        };
        const saved = await mutate(
          "products",
          item,
          preview
            ? {
                ...payload,
                barcodes: codes.map((code, i) => ({
                  id: i,
                  code,
                  is_active: true,
                  is_primary: i === 0,
                })),
                category:
                  data.categories.find((c) => String(c.id) === String(form.category_id))
                    ?.name || "",
                stock: item?.stock || 0,
              }
            : payload,
          item ? "PATCH" : "POST",
        );
        if (!preview) {
          try {
            await syncProductBarcodes(saved, item, codes);
          } catch (err) {
            await load();
            throw new Error("Товар збережено, але не всі штрихкоди оновлено: " + err.message);
          }
          await load();
        }
        say(item ? "Товар оновлено" : "Товар створено");
      },
      { fallbackError: "Не вдалося зберегти зміни" },
    );
  };

  const addBarcode = () => {
    if (!BARCODE_PATTERN.test(form.barcodeInput || "")) {
      setError("Введіть від 8 до 14 цифр");
      return;
    }
    if (form.barcodesList.includes(form.barcodeInput)) {
      setError("Штрихкод уже додано");
      return;
    }
    setForm((f) => ({
      ...f,
      barcodesList: [...f.barcodesList, f.barcodeInput],
      barcodeInput: "",
    }));
    setError("");
  };

  return (
    <form onSubmit={save} className="modal-form">
      <Field label="Назва">
        <input
          placeholder="Наприклад, Фарба акрилова біла 2.5л"
          required
          value={form.name || ""}
          onChange={(e) => patch("name", e.target.value)}
        />
      </Field>
      <div className="form-grid">
        <Field label="SKU">
          <input
            required
            placeholder="PNT-0140"
            value={form.sku || ""}
            onChange={(e) => patch("sku", e.target.value)}
          />
        </Field>
        <Field label="Мінімум на склад">
          <input
            type="number"
            min="0"
            step="0.001"
            required
            value={form.min_stock ?? 5}
            onChange={(e) => patch("min_stock", e.target.value)}
          />
        </Field>
        <Field label="Категорія">
          <Select value={form.category_id || ""} onChange={(e) => patch("category_id", e.target.value)}>
            <option value="">Без категорії</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Одиниця виміру">
          <Select value={form.unit || ""} onChange={(e) => patch("unit", e.target.value)}>
            {data.units.map((u) => (
              <option key={u.id} value={u.code}>
                {u.code} · {u.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="field">
        <span>Штрихкоди</span>
        {form.barcodesList?.length ? (
          <div className="barcode-list">
            {form.barcodesList.map((code) => (
              <span key={code}>
                {code}
                <button
                  type="button"
                  aria-label={`Прибрати ${code}`}
                  onClick={() =>
                    patch(
                      "barcodesList",
                      form.barcodesList.filter((c) => c !== code),
                    )
                  }
                >
                  <X size={15} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <small>Штрихкодів ще немає</small>
        )}
      </div>
      <div className="barcode-input">
        <input
          placeholder="13 цифр"
          aria-label="Новий штрихкод"
          inputMode="numeric"
          value={form.barcodeInput || ""}
          onChange={(e) => patch("barcodeInput", e.target.value)}
        />
        <Button icon={Plus} onClick={addBarcode}>
          Додати
        </Button>
      </div>
      <FormFooter submitLabel={saveLabel(item)} />
    </form>
  );
}

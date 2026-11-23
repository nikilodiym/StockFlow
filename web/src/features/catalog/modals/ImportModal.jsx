/** "Імпорт номенклатури": upload a CSV file of products. */
import { useRef } from "react";
import { Upload } from "lucide-react";
import useModalAction from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { importPreviewCsv } from "../../../mocks/previewImport";
import { Button } from "../../../shared/ui";
import { uploadImport } from "../api";

export default function ImportModal() {
  const { data, setData, preview, loading, close, load, say } = useAdmin();
  const run = useModalAction();
  const fileRef = useRef();

  const importFile = (file) => {
    if (!file) return;
    run(
      async () => {
        if (preview) {
          const { products, added } = await importPreviewCsv(file, data);
          setData((d) => ({ ...d, products }));
          say(`Імпортовано ${added} рядків`);
          return;
        }
        const job = await uploadImport(file);
        await load();
        if (job.rows_failed || job.status === "failed")
          throw new Error(
            `Імпорт: ${job.rows_created || 0} створено, ${job.rows_failed || 0} помилок. ${JSON.stringify(job.errors || [])}`,
          );
        say(`Імпорт: ${job.rows_created || 0} створено, ${job.rows_updated || 0} оновлено`);
      },
      {
        onFinally: () => {
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  };

  return (
    <>
      <p>
        Завантажте файл CSV з полями: штрихкод, SKU, назва, категорія, одиниця. Роздільник «;» або
        кома. Нові SKU буде додано, наявні оновлено.
      </p>
      <div className="note">4820119020001;PNT-0101;Фарба акрилова біла 2.5л;PNT;шт</div>
      <input
        type="file"
        accept=".csv,text/csv"
        hidden
        ref={fileRef}
        onChange={(e) => importFile(e.target.files[0])}
      />
      <div className="modal-footer">
        <Button onClick={close} disabled={loading}>
          Скасувати
        </Button>
        <Button icon={Upload} tone="yellow" onClick={() => fileRef.current.click()} disabled={loading}>
          {loading ? "Імпорт…" : "Обрати файл"}
        </Button>
      </div>
    </>
  );
}

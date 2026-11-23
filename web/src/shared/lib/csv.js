/** Download rows as a CSV file (UTF-8 with BOM, ";" separator — opens correctly in Excel). */
export function exportCSV(filename, headers, rows) {
  const cell = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
  const blob = new Blob(
    [
      "\uFEFF" +
        [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import type { DocumentItem } from '../types/document.types';

export type PrintableDocument = {
    title: string;
    warehouse: string;
    status: string;
    createdAt: string;
    note?: string;
    items: DocumentItem[];
};
export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );
}
export function documentHtml(document: PrintableDocument): string {
    const rows = document.items
        .map(
            (item, index) =>
                `<tr><td>${index + 1}</td><td>${escapeHtml(item.name)}<small>${escapeHtml(item.sku)}</small></td><td>${escapeHtml(item.barcode)}</td><td class="number">${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.unit)}</td></tr>`,
        )
        .join('');
    return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title><style>
    @page{size:A4;margin:16mm}body{font:12px Arial,sans-serif;color:#182021}header{border-bottom:2px solid #12715B;padding-bottom:12px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}.brand{color:#12715B;font-size:24px;font-weight:bold}h1{font-size:22px}p{line-height:1.6}.meta{color:#59636C}table{width:100%;border-collapse:collapse;margin-top:20px}thead{display:table-header-group}th{background:#E4F4EB;text-align:left}td,th{padding:9px 6px;border-bottom:1px solid #DDE4E0}tr{break-inside:avoid}small{display:block;color:#606876;margin-top:4px}.number{text-align:right}footer{margin-top:28px;font-size:11px;color:#606876}.signatures{display:flex;justify-content:space-between;margin-top:48px}
    </style></head><body><header><span class="brand">WareGo</span><span>Складський облік</span></header><h1>${escapeHtml(document.title)}</h1><p class="meta">Склад: ${escapeHtml(document.warehouse)}<br>Стан: ${escapeHtml(document.status)}<br>Дата: ${escapeHtml(new Date(document.createdAt).toLocaleString('uk-UA'))}</p>${document.note ? `<p>${escapeHtml(document.note)}</p>` : ''}<table><thead><tr><th>№</th><th>Товар / SKU</th><th>Штрихкод</th><th class="number">Кількість</th><th>Од.</th></tr></thead><tbody>${rows}</tbody></table><p>Позицій: ${document.items.length}</p><div class="signatures"><span>Відпустив(ла): __________________</span><span>Прийняв(ла): __________________</span></div><footer>Сформовано у WareGo</footer></body></html>`;
}
export async function printDocument(document: PrintableDocument): Promise<void> {
    const Print = await import('expo-print');
    await Print.printAsync({ html: documentHtml(document) });
}

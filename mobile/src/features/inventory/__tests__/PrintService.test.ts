import { documentHtml, escapeHtml } from '../services/PrintService';
it('prints the selected document with escaped product names, codes and quantities', () => {
    const html = documentHtml({
        title: 'ПР-0001',
        warehouse: 'Склад №1',
        status: 'Чернетка',
        createdAt: '2026-11-08T00:00:00Z',
        items: [
            {
                id: 1,
                sku: 'SKU-1',
                barcode: '123456',
                name: '<script>test</script>',
                stock: 0,
                unit: 'шт',
                quantity: 12,
            },
        ],
    });
    expect(html).toContain('ПР-0001');
    expect(html).toContain('SKU-1');
    expect(html).toContain('123456');
    expect(html).toContain('&lt;script&gt;test&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('>12</td>');
    expect(html).toContain('table-header-group');
});
it('escapes quotes and ampersands in document data', () =>
    expect(escapeHtml(`"<&'>`)).toBe('&quot;&lt;&amp;&#39;&gt;'));

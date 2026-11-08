import { isValidEan, normalizeBarcode, stepQuantity } from '../services/BarcodeService';

describe('isValidEan', () => {
    it('accepts valid EAN-13 and EAN-8', () => {
        expect(isValidEan('4820000000017')).toBe(true);
        expect(isValidEan('96385074')).toBe(true);
    });
    it('rejects a wrong check digit, letters or length', () => {
        expect(isValidEan('4820000000018')).toBe(false);
        expect(isValidEan('48200000000AB')).toBe(false);
        expect(isValidEan('12345')).toBe(false);
    });
});

it('normalizeBarcode strips whitespace', () => expect(normalizeBarcode(' 4820 0000 00017\n')).toBe('4820000000017'));

describe('stepQuantity', () => {
    it('adds +1 and +10', () => {
        expect(stepQuantity('1', '+1')).toBe('2');
        expect(stepQuantity('5', '+10')).toBe('15');
    });
    it('never goes below 1', () => {
        expect(stepQuantity('1', '-1')).toBe('1');
        expect(stepQuantity('abc', '-1')).toBe('1');
    });
});

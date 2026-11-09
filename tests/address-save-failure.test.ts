import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const SAVE_FAILURE = 'Gagal menyimpan alamat. Periksa koneksi lalu coba lagi.';

test('updateAddress melaporkan kegagalan sebagai false, bukan menelan galat', () => {
    const source = read('hooks/use-addresses.ts');
    assert.ok(source.includes('const updateAddress = useCallback(async (id: string, values: AddressFormValues): Promise<boolean>'));
    assert.ok(source.includes('gagal memperbarui alamat'));
    assert.ok(source.includes('return false;'));
});

test('addAddress mengembalikan null saat gagal', () => {
    const source = read('hooks/use-addresses.ts');
    assert.ok(source.includes('const addAddress = useCallback(async (values: AddressFormValues): Promise<DeliveryAddress | null>'));
    assert.ok(source.includes('gagal menambah alamat'));
});

test('formulir alamat menampilkan pesan gagal dan tidak memanggil onDone', () => {
    const source = read('app/components/checkout/address-form-view.tsx');
    const failureIndex = source.indexOf(SAVE_FAILURE);
    const doneIndex = source.lastIndexOf('onDone()');
    assert.notEqual(failureIndex, -1, 'pesan gagal simpan tidak ditemukan');
    assert.ok(doneIndex > failureIndex, 'onDone() harus berada setelah jalur gagal supaya dialog tidak menutup saat simpan gagal');
    assert.ok(source.includes('await saveUpdate(editing.id, values)'));
    assert.ok(source.includes('await saveAdd(values)'));
});

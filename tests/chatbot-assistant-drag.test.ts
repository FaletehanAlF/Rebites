import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const SOURCE = readProjectFile('app/components/chatbot/chatbot-widget.tsx');
test('tidak ada penyimpanan posisi tombol di localStorage', () => {
    assert.doesNotMatch(SOURCE, /POSITION_KEY/, 'kunci posisi tidak boleh ada');
    assert.doesNotMatch(SOURCE, /readStoredPosition/, 'pembaca posisi tidak boleh ada');
    assert.doesNotMatch(SOURCE, /storePosition/, 'penulis posisi tidak boleh ada');
});
test('tidak ada event pointer untuk menangkap geseran', () => {
    assert.doesNotMatch(SOURCE, /onPointerDown=\{handlePointerDown\}/);
    assert.doesNotMatch(SOURCE, /onPointerMove=\{handlePointerMove\}/);
    assert.doesNotMatch(SOURCE, /onPointerUp=\{handlePointerUp\}/);
    assert.doesNotMatch(SOURCE, /clampToViewport/, 'fungsi pembatas posisi tombol tidak boleh ada');
    assert.doesNotMatch(SOURCE, /draggedRef/, 'penanda geseran tidak boleh ada');
});
test('tombol menempel di sudut kanan bawah di semua ukuran layar', () => {
    const buttonClass = SOURCE.slice(SOURCE.indexOf("'fixed bottom-20 right-4"));
    const classText = buttonClass.slice(0, 200);
    assert.match(classText, /fixed bottom-20 right-4/, 'kelas dasar ponsel');
    assert.match(classText, /lg:bottom-6 lg:right-6/, 'kelas layar besar');
    assert.doesNotMatch(buttonClass.slice(0, 60), /style=\{/, 'tombol tidak boleh memakai style inline');
});
test('panel menempel di sudut kanan bawah di semua ukuran layar', () => {
    const panelClass = SOURCE.slice(SOURCE.indexOf("'fixed bottom-36 right-4"));
    const classText = panelClass.slice(0, 300);
    assert.match(classText, /fixed bottom-36 right-4/, 'kelas dasar ponsel');
    assert.match(classText, /lg:bottom-24 lg:right-6/, 'kelas layar besar');
});
test('panel tidak mengikuti posisi tombol', () => {
    assert.doesNotMatch(SOURCE, /panelPositionFor/, 'fungsi letak panel relatif tombol tidak boleh ada');
    assert.doesNotMatch(SOURCE, /const panelPos =/, 'state panelPos tidak boleh ada');
    assert.doesNotMatch(SOURCE, /const \[screen, setScreen\] = useState/, 'state layar tidak boleh ada');
});
test('ukuran panel di kode sama dengan kelasnya', () => {
    const classes = SOURCE.slice(SOURCE.indexOf("'fixed bottom-36 right-4"));
    const classText = classes.slice(0, 300);
    assert.match(classText, /max-w-\[400px\]/, 'kelas lebar maksimum');
    assert.match(classText, /max-h-\[560px\]/, 'kelas tinggi maksimum');
    assert.match(classText, /h-\[70vh\]/, 'kelas tinggi relatif');
});

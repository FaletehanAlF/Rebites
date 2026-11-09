import type { Metadata } from 'next';
import { LegalList, LegalSection, LegalShell, } from '@/app/components/legal/legal-shell';
export const metadata: Metadata = {
    title: 'Syarat Penggunaan — ReBites',
    description: 'Ketentuan penggunaan layanan ReBites bagi pembeli, penjual UMKM, dan pengelola marketplace makanan surplus.',
};
export default function TermsPage() {
    return (<LegalShell title="Syarat Penggunaan" summary="Dengan mengakses atau memakai ReBites, kamu menyetujui ketentuan berikut. Bacalah dengan saksama, khususnya bagian tanggung jawab penjual dan penyangkalan." updatedAt="3 November 2026">

      <LegalSection id="penerimaan" title="1. Penerimaan ketentuan">

        <p>

          ReBites adalah platform yang mempertemukan penjual UMKM dengan pembeli

          makanan surplus. Dengan membuat akun, memesan, atau menjual melalui

          ReBites, kamu menyetujui Syarat Penggunaan ini beserta Kebijakan

          Privasi.

        </p>

        <p>

          Kamu harus berusia minimal 17 tahun, atau memakai layanan ini dengan

          persetujuan orang tua atau wali. Dengan mendaftar, kamu menyatakan

          bahwa data yang kamu berikan benar dan kamu berwenang bertindak atas

          nama usaha yang kamu daftarkan.

        </p>

      </LegalSection>



      <LegalSection id="akun" title="2. Akun pengguna">

        <LegalList items={[
            'Satu akun mewakili satu pengguna. Kamu bertanggung jawab menjaga kerahasiaan kata sandi dan seluruh aktivitas yang terjadi pada akunmu.',
            'Kamu tidak boleh menggunakan akun orang lain, atau membuat akun dengan identitas palsu.',
            'Segera beri tahu kami melalui halo@rebites.id bila kamu menduga akunmu diakses tanpa izin.',
            'Peran akun (pembeli, UMKM, atau pengelola) ditetapkan sistem dan tidak dapat diubah sendiri oleh pengguna.',
        ]}/>

      </LegalSection>



      <LegalSection id="penjual" title="3. Kewajiban penjual">

        <p>

          Penjual bertanggung jawab penuh atas produk yang dijualnya. Khususnya:

        </p>

        <LegalList items={[
            'Makanan yang dijual adalah makanan surplus yang masih layak konsumsi, disimpan dan ditangani dengan higienis, serta memenuhi ketentuan keamanan pangan yang berlaku.',
            'Deskripsi produk, komposisi, alergen, masa simpan, foto, harga, berat, dan ketersediaan stok diisi dengan benar. Informasi yang menyesatkan dapat mengakibatkan sanksi.',
            'Alamat dan titik lokasi toko diisi dengan benar, karena keduanya menentukan perhitungan ongkir dan penugasan kurir.',
            'Pesanan yang masuk disiapkan dan diserahkan kepada kurir sesuai jadwal yang ditampilkan pada dashboard penjual.',
            'Penjual menangani keluhan pembeli atas kualitas produk secara langsung dan dengan iktikad baik.',
        ]}/>

      </LegalSection>



      <LegalSection id="pembeli" title="4. Kewajiban pembeli">

        <LegalList items={[
            'Alamat, nama, dan nomor telepon penerima diisi dengan benar agar pesanan dapat dikirim tanpa hambatan.',
            'Pembayaran diselesaikan dalam batas waktu yang ditampilkan pada halaman pembayaran; pesanan yang tidak dibayar dapat dibatalkan otomatis.',
            'Pembeli tidak menyalahgunakan fitur ulasan, laporan, atau koin ReBites, termasuk memberi ulasan palsu atau menyerang pengguna lain.',
            'Pesanan yang sudah dibatalkan sendiri oleh pembeli mengikuti aturan pembatalan yang berlaku pada pesanan tersebut.',
        ]}/>

      </LegalSection>



      <LegalSection id="pembayaran" title="5. Harga, pembayaran, dan ongkir">

        <LegalList items={[
            'Harga produk ditetapkan oleh penjual. Biaya pengiriman dihitung sistem berdasarkan jarak dan berat, lalu ditampilkan sebelum kamu membayar.',
            'Pembayaran pesanan dan langganan diproses oleh penyedia pembayaran pihak ketiga. ReBites tidak menyimpan data kartu atau kredensial pembayaranmu.',
            'Status pembayaran diperbarui berdasarkan pemberitahuan resmi dari penyedia pembayaran. Bila status belum berubah padahal kamu sudah membayar, hubungi halo@rebites.id dengan bukti pembayaran.',
            'Koin ReBites adalah kredit layanan di dalam platform, bukan alat pembayaran yang dapat diuangkan, dan hanya dapat dipakai sesuai ketentuan yang ditampilkan di aplikasi.',
        ]}/>

      </LegalSection>



      <LegalSection id="pengiriman" title="6. Pengiriman dan pengambilan">

        <LegalList items={[
            'Pesanan dapat dikirim melalui kurir atau diambil sendiri di toko, sesuai metode yang kamu pilih saat memesan.',
            'Selama pengiriman berlangsung, lokasi kurir ditampilkan kepada pembeli agar pesanan mudah dilacak.',
            'Waktu pengiriman bersifat perkiraan dan dapat berubah karena jarak, kondisi lalu lintas, cuaca, atau keadaan di luar kendali.',
            'Pesanan berstatus diantar atau siap diambil dapat diselesaikan otomatis setelah melewati perkiraan waktu tiba, bila tidak ada tindakan lebih lanjut dari pembeli.',
        ]}/>

      </LegalSection>



      <LegalSection id="larangan" title="7. Perilaku yang dilarang">

        <LegalList items={[
            'Menjual makanan tidak layak konsumsi, kedaluwarsa, atau berbahaya bagi kesehatan.',
            'Menyesatkan pengguna lain, memalsukan identitas, atau memanipulasi ulasan, laporan, dan koin ReBites.',
            'Mengganggu, merusak, atau mencoba mengakses sistem dan data ReBites tanpa izin.',
            'Mengirim spam, konten kebencian, ancaman, atau konten yang melanggar hukum melalui chat, ulasan, atau laporan.',
            'Memakai layanan untuk kegiatan yang melanggar hukum yang berlaku di Indonesia.',
        ]}/>

        <p>

          Pelanggaran dapat mengakibatkan peringatan, pembatasan fitur,

          penonaktifan toko, hingga penangguhan akun, sesuai tingkat

          pelanggarannya.

        </p>

      </LegalSection>



      <LegalSection id="asisten" title="8. Asisten otomatis">

        <p>

          ReBites menyediakan asisten otomatis berbasis model bahasa. Jawabannya

          bersifat informatif dan dapat keliru. Asisten bukan sumber kebenaran

          atas harga, ketersediaan stok, status pesanan, maupun ketentuan

          layanan — selalu periksa informasi tersebut pada halaman aplikasi yang

          bersangkutan. Jangan mengirimkan kata sandi, data pembayaran, atau data

          pribadi sensitif melalui chat asisten.

        </p>

      </LegalSection>



      <LegalSection id="kekayaan-intelektual" title="9. Kekayaan intelektual">

        <p>

          Nama, logo, dan tampilan ReBites merupakan milik pengelola platform.

          Konten yang kamu unggah — foto produk, deskripsi toko, ulasan — tetap

          milikmu, dan kamu memberikan izin kepada ReBites untuk menampilkannya

          di dalam layanan sejauh diperlukan agar fitur marketplace berjalan.

        </p>

      </LegalSection>



      <LegalSection id="penyangkalan" title="10. Penyangkalan">

        <p>

          ReBites menyediakan platform untuk mempertemukan penjual dan pembeli.

          Kualitas, keamanan, dan legalitas produk sepenuhnya menjadi tanggung

          jawab penjual. ReBites tidak menjamin bahwa seluruh produk bebas dari

          alergen atau sesuai ekspektasi pembeli.

        </p>

        <p>

          Layanan disediakan apa adanya. Kami berupaya menjaga ketersediaan dan

          ketepatan sistem, tetapi tidak menjamin layanan bebas gangguan, dan

          tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari

          penggunaan layanan sejauh diizinkan hukum yang berlaku.

        </p>

      </LegalSection>



      <LegalSection id="perubahan-layanan" title="11. Perubahan dan penghentian layanan">

        <p>

          Kami dapat menambah, mengubah, atau menghentikan fitur layanan, serta

          memperbarui Syarat Penggunaan ini. Perubahan penting akan ditampilkan

          melalui aplikasi. Kamu dapat berhenti memakai layanan kapan saja, dan

          dapat meminta penghapusan akun melalui halo@rebites.id.

        </p>

      </LegalSection>



      <LegalSection id="hukum" title="12. Hukum yang berlaku">

        <p>

          Syarat Penggunaan ini tunduk pada hukum yang berlaku di Republik

          Indonesia. Sengketa diupayakan diselesaikan secara musyawarah terlebih

          dahulu melalui halo@rebites.id.

        </p>

      </LegalSection>

    </LegalShell>);
}

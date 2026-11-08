import type { Metadata } from 'next';
import { LegalList, LegalSection, LegalShell, } from '@/app/components/legal/legal-shell';
export const metadata: Metadata = {
    title: 'Kebijakan Privasi — ReBites',
    description: 'Bagaimana ReBites mengumpulkan, memakai, menyimpan, dan melindungi data pengguna pada marketplace makanan surplus.',
};
export default function PrivacyPage() {
    return (<LegalShell title="Kebijakan Privasi" summary="Kebijakan ini menjelaskan data apa yang ReBites kumpulkan saat kamu memakai layanan, mengapa data itu diperlukan, dengan siapa data dibagikan, dan bagaimana kamu dapat mengendalikannya." updatedAt="3 November 2026">
      <LegalSection id="ruang-lingkup" title="1. Ruang lingkup">
        <p>
          ReBites adalah marketplace yang mempertemukan pelaku UMKM kuliner
          dengan pembeli untuk menjual makanan surplus yang masih layak
          konsumsi. Kebijakan ini berlaku untuk situs dan aplikasi web ReBites,
          baik saat kamu membuka katalog sebagai pengunjung maupun saat kamu
          masuk sebagai pembeli, penjual (UMKM), atau pengelola.
        </p>
        <p>
          Layanan ini ditujukan untuk pelaku usaha dan pembeli di Indonesia.
          Layanan tidak diarahkan kepada anak di bawah 17 tahun; bila kamu belum
          berusia 17 tahun, kamu hanya boleh memakainya dengan persetujuan orang
          tua atau wali.
        </p>
      </LegalSection>

      <LegalSection id="data-yang-dikumpulkan" title="2. Data yang kami kumpulkan">
        <p>
          Kami hanya mengumpulkan data yang diperlukan agar pesanan, pengiriman,
          dan pembayaran dapat berjalan.
        </p>
        <LegalList items={[
            <>
              <strong>Data akun.</strong> Alamat email, nama lengkap, peran akun
              (pembeli, UMKM, atau pengelola), nomor telepon bila kamu
              mengisinya, dan URL foto profil. Bila kamu masuk dengan Google,
              kami menerima alamat email, nama, dan foto profil dari akun Google
              tersebut.
            </>,
            <>
              <strong>Data usaha (khusus penjual).</strong> Nama toko, deskripsi,
              kategori, jam operasional, foto toko dan produk, harga, berat, serta
              alamat dan titik koordinat lokasi toko. Titik koordinat dipakai
              untuk menghitung ongkir dan menampilkan lokasi toko pada peta.
            </>,
            <>
              <strong>Data pesanan.</strong> Produk yang dipesan, jumlah, harga,
              status pesanan, riwayat perubahan status, serta jadwal
              pengiriman atau pengambilan.
            </>,
            <>
              <strong>Alamat pengiriman.</strong> Label alamat, nama dan nomor
              telepon penerima, provinsi, kota, kecamatan, alamat lengkap, dan
              catatan tambahan bila kamu mengisinya.
            </>,
            <>
              <strong>Lokasi kurir saat pengiriman.</strong> Selama sebuah
              pesanan berstatus diantar, aplikasi kurir mengirim titik koordinat
              (lintang, bujur, dan tingkat akurasi) secara berkala agar pembeli
              dapat memantau perjalanan pesanan.
            </>,
            <>
              <strong>Ulasan dan interaksi.</strong> Penilaian dan komentar atas
              pesanan, toko yang kamu ikuti, produk yang kamu simpan, serta
              percakapan dengan kurir dan dengan asisten otomatis ReBites.
            </>,
            <>
              <strong>Riwayat koin.</strong> Saldo dan mutasi koin ReBites beserta
              keterangan transaksinya.
            </>,
            <>
              <strong>Catatan moderasi.</strong> Laporan yang kamu kirim atau
              terima, peringatan, sanksi, dan catatan tindakan pengelola. Catatan
              ini disimpan untuk menegakkan aturan layanan dan menyelesaikan
              sengketa.
            </>,
        ]}/>
      </LegalSection>

      <LegalSection id="data-teknis" title="3. Data teknis yang disimpan di perangkatmu">
        <p>
          ReBites menyimpan beberapa data di browser untuk menjaga sesi dan
          mengingat pilihanmu:
        </p>
        <LegalList items={[
            <>
              <strong>Sesi masuk.</strong> Token sesi autentikasi Supabase
              disimpan agar kamu tidak perlu masuk ulang di setiap halaman.
              Token ini dihapus saat kamu keluar.
            </>,
            <>
              <strong>Preferensi tampilan.</strong> Status navigasi yang
              diperkecil atau diperbesar, dan preferensi panel serupa, disimpan
              agar tampilan tetap seperti yang kamu atur.
            </>,
            <>
              <strong>Email yang diingat.</strong> Bila kamu memilih opsi
              mengingat email pada formulir masuk, alamat email itu disimpan di
              browser agar terisi otomatis. Kamu dapat menghapusnya dengan
              menghilangkan centang opsi tersebut saat masuk.
            </>,
        ]}/>
        <p>
          ReBites tidak memasang cookie iklan dan tidak menjual data pengguna
          kepada pihak ketiga.
        </p>
      </LegalSection>

      <LegalSection id="penggunaan" title="4. Bagaimana data dipakai">
        <LegalList items={[
            'Membuat dan mengamankan akun, termasuk memverifikasi email dan memulihkan kata sandi.',
            'Memproses pesanan: menghitung ongkir, menugaskan kurir, memperbarui status, dan mengirim notifikasi.',
            'Memproses pembayaran dan langganan, termasuk menerbitkan tagihan dan mencatat status pembayarannya.',
            'Menampilkan katalog, toko, ulasan, dan rekomendasi makanan surplus.',
            'Menjalankan asisten otomatis ReBites agar dapat menjawab pertanyaan dan membantu tugas di dalam aplikasi.',
            'Menjaga keamanan layanan: mendeteksi penyalahgunaan, menangani laporan, dan menegakkan aturan.',
            'Memenuhi kewajiban hukum yang berlaku di Indonesia.',
        ]}/>
      </LegalSection>

      <LegalSection id="pembagian" title="5. Dengan siapa data dibagikan">
        <p>
          Kami tidak menjual data pengguna. Data hanya dibagikan sejauh
          diperlukan kepada penyedia layanan yang membuat ReBites berjalan:
        </p>
        <LegalList items={[
            <>
              <strong>Supabase</strong> — autentikasi, basis data, dan
              penyimpanan berkas. Seluruh data akun, pesanan, dan chat berada di
              sini.
            </>,
            <>
              <strong>Google</strong> — hanya bila kamu memilih masuk dengan
              Google, untuk memverifikasi identitas akun Google-mu.
            </>,
            <>
              <strong>Xendit</strong> — pemroses pembayaran untuk pesanan dan
              langganan. ReBites tidak menyimpan nomor kartu atau kredensial
              pembayaranmu.
            </>,
            <>
              <strong>Biteship</strong> — perhitungan tarif pengiriman dan
              pelacakan kurir, sehingga nama, nomor telepon, dan alamat
              pengiriman dibagikan sebatas kebutuhan pengiriman.
            </>,
            <>
              <strong>Penyedia email transaksional</strong> — pengiriman email
              verifikasi, pemulihan kata sandi, dan pemberitahuan pesanan.
            </>,
            <>
              <strong>Penyedia model bahasa</strong> — percakapan dengan asisten
              otomatis diproses agar asisten dapat menyusun jawaban. Jangan
              kirimkan kata sandi, data pembayaran, atau data pribadi sensitif
              melalui chat asisten.
            </>,
        ]}/>
        <p>
          Kami juga dapat mengungkapkan data bila diwajibkan oleh hukum, atau
          bila diperlukan untuk menanggapi laporan penyalahgunaan dan melindungi
          pengguna lain.
        </p>
      </LegalSection>

      <LegalSection id="keamanan" title="6. Penyimpanan dan keamanan">
        <p>
          Data disimpan pada basis data Supabase dengan aturan akses tingkat
          baris (Row Level Security), sehingga satu pengguna tidak dapat membaca
          data pengguna lain. Kata sandi tidak pernah disimpan dalam bentuk
          terbaca — autentikasi ditangani Supabase Auth. Kunci rahasia layanan
          hanya tersedia di sisi server dan tidak pernah dikirim ke browser.
        </p>
        <p>
          Data disimpan selama akunmu aktif dan selama diperlukan untuk
          menyelesaikan pesanan, menangani sengketa, serta memenuhi kewajiban
          hukum. Catatan moderasi dan log tindakan pengelola dapat disimpan lebih
          lama untuk keperluan audit keamanan.
        </p>
      </LegalSection>

      <LegalSection id="hakmu" title="7. Hakmu atas data">
        <p>
          Sesuai peraturan pelindungan data pribadi yang berlaku di Indonesia,
          kamu berhak:
        </p>
        <LegalList items={[
            'Melihat dan memperbarui data profil serta alamatmu melalui halaman pengaturan akun.',
            'Meminta salinan data pribadimu yang kami simpan.',
            'Meminta perbaikan data yang tidak akurat.',
            'Meminta penghapusan akun beserta data pribadinya, sepanjang tidak bertentangan dengan kewajiban hukum atau penyelesaian sengketa yang masih berjalan.',
            'Menarik persetujuan penggunaan data untuk keperluan tertentu.',
        ]}/>
        <p>
          Permintaan dapat dikirim ke{' '}
          <a href="mailto:halo@rebites.id" className="font-semibold text-primary underline underline-offset-2">
            halo@rebites.id
          </a>
          . Kami akan menanggapi dalam waktu yang wajar setelah memverifikasi
          bahwa permintaan benar-benar datang dari pemilik akun.
        </p>
      </LegalSection>

      <LegalSection id="perubahan" title="8. Perubahan kebijakan">
        <p>
          Kebijakan ini dapat diperbarui bila fitur layanan atau aturan yang
          berlaku berubah. Tanggal pembaruan terakhir selalu ditampilkan di
          bagian atas halaman ini. Perubahan penting akan diberitahukan melalui
          aplikasi atau email terdaftar.
        </p>
      </LegalSection>
    </LegalShell>);
}

# BeeStation — pratinjau 0.1

Aplikasi Windows dan controller web di HP pada LAN privat. UI dibundel lokal. Tidak memerlukan akun, CDN, development server, APK, atau aplikasi iOS.

**Status: dalam pengembangan dan uji pengguna.** BeeStation belum dinyatakan selesai untuk bermain bersama. Satu sesi dibatasi maksimal **4 pemain**, termasuk pemain yang menunggu persetujuan atau sedang dalam reservasi reconnect. Kapasitas sesi berbeda dari jumlah pemain yang didukung game.

## Apa itu BeeStation?

BeeStation membantu teman-teman bermain game di satu PC dengan memakai HP sebagai controller. Host memilih game dan menyiapkan sesi di PC; pemain memindai QR dengan browser HP pada jaringan yang sama, lalu host menyetujui mereka.

- Menambahkan game ke koleksi dan memilih preset controller.
- Menghubungkan hingga empat pemain HP dalam satu sesi melalui jaringan lokal.
- Mengirim input HP melalui controller virtual Xbox atau DualShock 4, dengan kompatibilitas yang masih perlu diuji pada masing-masing game.
- Mengatur layout dan pemetaan kontrol, termasuk mengimpor dan mengekspor profil.
- Menghentikan semua input atau mengakhiri sesi dari PC.

## Lisensi

Kode BeeStation tersedia di bawah [lisensi MIT](LICENSE). Komponen pihak ketiga tetap mengikuti lisensinya masing-masing; lihat berkas lisensi di `docs/` dan `ui/public/fonts/`.

## Menjalankan

1. Ekstrak seluruh ZIP rilis ke satu folder; buka `BeeStation.exe`. Pertahankan folder `wwwroot` dan semua berkas pendamping. Rilis membawa runtime .NET, sehingga SDK tidak diperlukan untuk memakainya.
2. Prasyarat terpisah: Windows x64, Microsoft WebView2 Runtime, dan ViGEmBus 1.22.0 resmi. Driver ViGEmBus EOL; lihat `docs/PRASYARAT.md`. BeeStation sendiri belum ditandatangani dengan sertifikat penerbit.
3. Klik **Tambah game**. Pilih executable/shortcut yang sah atau temukan instalasi Steam/Epic lalu pilih entri. Penemuan tidak mengimpor seluruh library secara otomatis. Launcher Steam memakai `steam://rungameid/...`.
4. Pilih preset dan keluaran Xbox atau DS4. Xbox mempunyai empat slot total, termasuk controller fisik. Xbox dan DS4 sama-sama dibatasi maksimal empat pemain.
5. Di **Games**, pilih poster dengan scroll wheel, lalu klik dua kali poster (atau tekan Enter) untuk membuka halaman game. Klik **Siapkan sesi**. Profil Windows **Umum/Public maupun Private dapat dipakai**; tidak perlu mengubah kategori jaringan. Jika HP tidak dapat membuka alamat, buka **Pengaturan → Izinkan akses HP di Windows** lalu setujui UAC. Izin itu khusus executable BeeStation dan port TCP host, hanya dari subnet lokal.
6. Di PC, arahkan kursor atau klik tombol QR bercahaya pada halaman sesi untuk menampilkan kode. Pindai QR dari HP di Wi-Fi yang sama. Isi nama, lalu host menekan **Setujui** di PC. Sentuh tombol/stik untuk melihat input pada kartu pemain.
7. **Buka game**, kemudian ikuti prosedur bergabung game. Pada Minecraft Dungeons pertama yang diuji, LS membuka pilihan P2, lalu A memilih karakter. Tombol LS pada layout Dungeons mengirim klik analog kiri untuk bergabung. Host tidak mematikan atau mengulang game otomatis.
8. Gunakan **Hentikan semua input** untuk menetralkan dan menahan input; **Akhiri sesi** melepaskan perangkat virtual BeeStation dan mencabut token sesi.

Selama tes game boleh dibuka manual dengan suara dimatikan. Peluncuran normal melalui BeeStation tidak menambahkan `-nosound`. Percobaan Dungeons sebelumnya memakai opsi tanpa suara hanya untuk proses uji itu; tutup dan buka normal dari Steam untuk memulihkan audio.

## Controller Studio di PC

Tab **Controller Studio** menggantikan Layout dan hanya mengatur **default game**. Pilih game, lalu gunakan **Muat ulang profil** untuk mengambil default terbaru. Profil pribadi dan preset bernama milik pemain tetap terpisah.

Atur **Lebar layar × Tinggi layar (px)** sesuai viewport browser HP dalam CSS px, misalnya 844 × 390 atau 390 × 844. Ukuran ini mengatur kanvas preview; layout tetap menyimpan posisi proporsional untuk HP. Preview memakai renderer, bentuk tombol, ukuran sentuh, dan rotasi yang sama dengan controller HP. Skala tampilan otomatis disesuaikan dengan ruang PC, sedangkan angka posisi/ukuran tetap mengikuti px kanvas.

Geser tombol di preview, atau pilih kontrol dan isi posisi X/Y serta ukuran dasar dalam px. Ukuran tampil juga ditunjukkan; target sentuh minimum 44 px tetap berlaku. D-pad menyatu digeser/diperbesar sebagai grup. Pemetaan, kontrol aktif, mode kidal, stik mengikuti sentuhan, dead zone, sensitivitas, dan transparansi dapat diatur dari panel kanan. Preview tidak mengirim input ke game.

Katalog kontrol dikelompokkan menjadi **D-pad**, **Analog kiri**, **Analog kanan**, dan **Tombol aksi**. D-pad dapat menyatu, terpisah, atau dinonaktifkan. Setiap analog dapat memakai gerakan bebas, **8 arah**, atau dinonaktifkan. Analog 8 arah mengunci sudut ke delapan arah sambil mempertahankan kekuatan gerak, dead zone, dan sensitivitas. Menonaktifkan kontrol mempertahankan posisi serta ukurannya; model dapat diaktifkan kembali. Grup yang belum tersedia dapat ditambahkan selama jumlah kontrol tidak melampaui 32.

**Terapkan default** menyimpan default game, termasuk saat sesi sedang aktif. HP tanpa profil pribadi mengambilnya saat halaman dimuat ulang. HP yang sudah menyimpan layout tetap memakai layout miliknya. Untuk memakai default PC terbaru, pemain memilih **Edit layout → Gunakan default game → Simpan** di HP. Reset ini masih berupa draft hingga Simpan; Batal memulihkan layout sebelumnya, dan preset bernama tetap tersimpan. **Batal perubahan** di Studio memulihkan versi terakhir dimuat/disimpan. Pergantian tab/game meminta konfirmasi bila ada draft. **Kembalikan preset** di PC mengambil preset bawaan aplikasi.

## Galeri game

Halaman Games khusus menampilkan galeri poster vertikal dengan tepi sejajar, judul game terpilih, dan navigasi koleksi. Pilih melalui klik, geser, scroll di area kartu, atau tombol ←/→, Home dan End. Pemilihan tidak meluncurkan game atau membuat sesi otomatis. Trailer 1080p dan suara latar mengikuti game terpilih melalui cache media yang sudah ada; jika trailer tidak tersedia, sampul menjadi latar. Kontrol suara dan jeda tetap berada di header.

Klik dua kali poster di **Games** untuk masuk ke halaman sesi dengan transisi. Di halaman tersebut, **Siapkan sesi**, QR, pemain, dan **Buka game** tersedia. Tombol **← Games** kembali ke galeri tanpa mengakhiri sesi. Edit dan keluarkan game tersedia di **Kelola game**. Referensi publik dan bukti REA dijelaskan dalam `docs/DESKTOP_DESIGN.md`.

## Layout dan simpanan

Preset Minecraft Dungeons memakai **satu layout controller** untuk bermain, inventory, dan menu. D-pad Up tetap mengirim Up untuk inventory; B dapat kembali, dan Menu mengirim Start. Tombol tersebut tidak mengganti layout HP. A/B/X/Y, LB/RB, LT/RT, LS/RS, Menu, D-pad, dan kedua analog tersedia bersamaan. Back lama dihapus sesuai permintaan pengguna; tombol View/Friends tidak disediakan terpisah.

Tombol diberi nama controller: A untuk serang/interaksi, LB untuk heal, RB untuk forward roll, RT untuk serangan jarak jauh. X/Y/B memakai artefak 1/2/3 saat bermain. Fungsi dapat berubah di inventory/menu; **Edit layout → Pengaturan → Fungsi** menjelaskan kegunaannya. Field Label dihapus; nama tombol mengikuti pemetaan ketika diubah. Urutan tombol kecil di kiri atas adalah Menu → LS → RS → LT, dengan ukuran dan jarak yang sama. LS untuk bergabung, RS untuk klik analog kanan/teleport, dan LT untuk chat wheel.

**Analog Roll arah** berukuran kecil di sebelah X mengirim sumbu analog kanan untuk directional roll. RB tetap tersedia sebagai roll biasa; tombol RS terpisah mengirim klik analog untuk teleport. Analog roll tetap di tempatnya agar sentuhan area kosong tidak memicu roll. Analog kiri, analog roll, dan tombol aksi dapat dipakai bersamaan. Perilaku roll dan teleport tetap perlu diuji di game dengan pengaturan controller pengguna.

Untuk mematikan tombol atau analog, pilih kontrol di editor, hilangkan centang **Kontrol aktif**, lalu Simpan. Kontrol tersimpan dan dapat diaktifkan lagi di editor, tetapi disembunyikan dan tidak mengirim input saat bermain. Preview memberi tanda OFF dan daftar kontrol menandai nonaktif. Ini juga berlaku untuk analog Roll arah.

Default Dungeons dirapikan dari JSON pengguna: analog kiri, D-pad di kanan analog, tombol aksi di kanan, baris LB/RB, serta Menu/LS/RS/LT yang sejajar dengan jarak seragam lebih lebar. LB/RT/analog roll berada pada kolom yang sama dengan celah lebih lega terhadap RB/Y/X; A/B dijauhkan sedikit ke kanan dan D-pad dijauhkan dari analog kiri. Dead zone 0, sensitivitas 1, opasitas 90%, dan analog kiri mengikuti sentuhan. Definisi default tunggal di `src/BeeHooks.Core/Presets/dungeons.json` dipakai host dan UI. **Profil pribadi tidak ditimpa susunannya secara otomatis**; pilih **Edit layout → Gunakan default game → Simpan** untuk memakai susunan baru. Berkas default disertakan di folder rilis sebagai `BeeStation-Dungeons-default.json`.

Pada **Edit layout → Pengaturan → Tampilan D-pad**, pilih **Menyatu** atau **Terpisah**. D-pad Menyatu mempertahankan sudut bentuk silang saat ditekan/hover, dengan sorotan warna pemain mengisi seluruh arah yang ditekan. Menggeser satu arah memindahkan seluruh silang; mengubah ukuran berlaku untuk keempat arah. Saat bermain, D-pad dapat diketuk atau disentuh lalu digeser antararah tanpa mengangkat jari. Arah aktif dan sorotan mengikuti posisi jari; arah sebelumnya dilepas saat berpindah. Titik tengah, celah antar tombol terpisah, area di luar D-pad, atau arah yang dinonaktifkan bersifat netral. Jari dapat digeser masuk lagi selama masih ditahan; lepas/batalkan sentuhan untuk menetralkan. Pada D-pad Menyatu, sentuhan juga boleh dimulai dari titik tengah netral lalu digeser ke arah yang diinginkan. Fungsi ini mengikuti pemetaan arah yang disimpan, tetap bisa dipakai bersamaan dengan tombol lain, dan tidak mengubah perilaku drag posisi dalam editor. Pilihan ikut simpan, duplikasi, ekspor, dan impor. Profil lama tanpa `dpadStyle` tetap Terpisah.

RTT jaringan, waktu proses host, dan status koneksi berada di tengah header bersama tombol edit/fullscreen. Header dipadatkan menjadi 36 px (garis pemisah naik 8 px); area sentuh ikon tetap 44 px. Bilah bawah dihapus untuk memperluas area kontrol.

Editor berupa **satu halaman yang bisa digulir**: preview controller di atas untuk memilih dan menggeser tombol, lalu pengaturan kontrol di bawah untuk mengubah pemetaan, ukuran, dead zone, sensitivitas, transparansi, mode kidal, dan stik mengikuti sentuhan. Geser di area kosong preview atau panel pengaturan untuk menggulir ke bawah/atas; menyeret tombol pada preview tetap mengubah posisinya. Simpan/Batal berada di bagian paling bawah pengaturan dan ikut tergulir bersama halaman. Bilah tambahan di atas preview dihapus sehingga preview memakai tinggi area bermain yang sama. Input game dinetralkan selama mengedit. Simpan menyimpan profil pribadi di PC per identitas browser/per game; Batal mengembalikan versi sebelum diedit. Gunakan default game mengambil default terbaru dari PC sebagai draft. Duplikasi profil menyimpan salinan bernama yang bisa dipilih lagi; desktop dapat menyalin profil ke game lain.

Aktifkan **Stik mengikuti sentuhan**, lalu Simpan. Sentuh area kosong di sisi analog kiri untuk memunculkannya di titik sentuh, mulai netral, lalu geser untuk bergerak. Tombol aksi tetap diprioritaskan; analog kembali setelah dilepas/dibatalkan dan sentuhan kedua tidak mengambil alih. Mode kidal memindahkan sisi aktif. Pada Dungeons, pengaturan ini berlaku untuk analog kiri; analog roll tetap di tempatnya.

Ekspor/impor menerima JSON versi 1, maksimal 32 KB dan 32 kontrol. Profil Dungeons lama mengambil layout utama, membuang mode Menu/Inventory, Back, dan duplikat Inv/Map bila D-pad terkait sudah ada. Kontrol LT/LS/RS/analog kanan yang belum ada ditambahkan bila kapasitas tersedia; posisi, ukuran, pemetaan, dan status aktif kontrol yang dipertahankan tidak direset. Nama tombol mengikuti pemetaan. **Simpan** menetapkan hasil migrasi; berkas impor asli tidak diubah. Profil yang sudah penuh 32 kontrol dipertahankan tanpa menambah kontrol; reset preset untuk mengambil susunan lengkap. Host masih menerima struktur mode lama untuk kompatibilitas impor, tetapi UI Dungeons hanya menggunakan satu layout. Preset game lain mempertahankan kontrolnya. Target launcher tidak boleh dimasukkan ke JSON layout.

Nama produk sekarang BeeStation. Folder data lama `%LOCALAPPDATA%\BeeHooks` dan kunci browser tetap dipakai agar koleksi serta layout pribadi tidak hilang.

Controller kini memakai bentuk bundar halus dan font Manrope lokal, menggantikan tampilan piksel. Warna tetap mengikuti pemetaan: A hijau, B merah, X biru, Y kuning. Profil Overcooked lama juga menampilkan huruf controller tersebut tanpa menulis ulang posisi, ukuran, atau pemetaannya.

Galeri desktop mengambil sampul game Steam dari cache instalasi Steam di PC. Saat game dipilih, pratinjau trailer resmi Steam diputar jelas sebagai latar, tanpa blur dan berulang, dengan target kualitas 1080p. Cache versi 480p lama tidak dipakai oleh pratinjau baru. Lapisan gelap diarahkan ke area teks agar adegan tetap terlihat. Tombol jeda/putar tersedia di kanan atas; preferensi kurangi gerakan menonaktifkan putar otomatis.

Memilih game atau menekan ikon speaker mengaktifkan suara trailer pada volume 30%. Perpindahan game melalui klik atau keyboard juga memakai efek nada singkat. Ikon speaker mematikan/mengaktifkan suara trailer dan efek tersebut sekaligus. Audio mengikuti jeda, putaran ulang dan pergantian video; trek sebelumnya dihentikan. Halaman tersembunyi menjeda video beserta audio. Saat pertama dibuka halaman tetap senyap sampai interaksi tersebut. Pengaturan suara tidak memengaruhi volume game Windows.

Pratinjau pertama memerlukan internet, kemudian video dan audio disimpan di folder `covers` untuk pemakaian berikutnya. Audio dimuat terpisah agar pengambilan suara tidak menunda video yang sudah tersedia. Jika video tidak tersedia, sampul tetap tampil; game tanpa sampul memakai inisial. Sampul pilihan pengguna tetap didahulukan. Pengambilan media tidak mengubah koleksi atau layout tersimpan.

Simpanan: `%LOCALAPPDATA%\BeeHooks\library.json`, dengan cadangan `.bak`. Penulisan atomik mempertahankan data lama jika gagal. Berkas rusak tidak otomatis ditimpa/reset. Sampul disalin ke subfolder `covers`. Mengeluarkan kartu hanya mengubah library BeeStation, bukan instalasi/save game.

Jangan membuka dua BeeStation bersamaan untuk simpanan yang sama. Menghapus aplikasi: tutup BeeStation, lalu hapus folder rilis. Simpanan di LocalAppData dipertahankan. Jangan menghapus driver bersama bila dipakai aplikasi lain.

## Jaringan dan masalah sambungan

- Host administrasi hanya menerima permintaan dari loopback PC. HP tidak diberi endpoint untuk meluncurkan program atau menulis file bebas.
- Host memakai alamat IPv4 LAN (10.x, 172.16–31.x, atau 192.168.x), menerima kategori Windows Public/Private, dan menolak klien dari luar subnet. Port HP diutamakan 32100; jika sudah dipakai, port kosong dipilih dan QR diperbarui. Pilih alamat adaptor yang sama dengan jaringan HP pada kartu QR.
- Tombol izin firewall meminta UAC untuk membuat/memperbarui satu aturan **executable BeeStation yang tepat**, inbound TCP, port host saat ini, profil **Public dan Private**, remote address **LocalSubnet**. Kategori jaringan, aturan aplikasi lain, dan firewall global tidak diubah. Jika lokasi/nama EXE atau port fallback berubah, ulangi tombol izin. Penggantian BeeHooks.exe ke BeeStation.exe memerlukan aturan untuk EXE baru. Untuk membatalkan, hapus hanya aturan bernama `BeeStation LAN ...` dalam kelompok BeeStation melalui Windows Firewall with Advanced Security.
- HTTP/WebSocket LAN ini tidak terenkripsi. Token acak berlaku per sesi/perangkat dan tidak dicatat ke access log. Angka waktu di HP adalah RTT jaringan dan pemrosesan host, bukan latensi sentuh ke gambar game.
- Saat putus/halaman tersembunyi, input dinetralkan. Watchdog mulai menetralkan pada 400 ms, diperiksa tiap 50 ms untuk memberi ruang terhadap batas 500 ms. Windows bukan sistem real-time; uji Wi-Fi/layar terkunci tetap diperlukan.
- Reservasi perangkat 60 detik setelah sambungan putus; sesi baru/kick mencabut token. Browser lama tidak dapat menimpa koneksi pengganti.
- Identitas layout berada di penyimpanan browser. Menghapus data browser, mengganti browser/port/IP PC membuat identitas origin berubah. Ekspor layout untuk memindahkan pengaturan. Port tetap dipakai kembali selama tersedia.
- `startup-error.txt` dalam folder data menjelaskan kegagalan awal; tidak berisi token sesi. Catatan uji tidak boleh memuat token.

## Build ulang

Dependency UI dikunci dalam `ui/package-lock.json`; NuGet dalam `packages.lock.json`. Node.js 24.21.0 dan SDK .NET 10.0.403 digunakan saat implementasi. SDK ditentukan oleh `global.json`.

```powershell
.\build.ps1
```

Setelah build dan pengemasan berhasil, skrip otomatis membuat/memperbarui **BeeStation** di Desktop agar membuka `release/BeeStation-win-x64/BeeStation.exe` terbaru. Shortcut yang sama dipakai setiap pembaruan; pengaturan dan layout pribadi tetap tersimpan di lokasi data aplikasi.

Untuk pengembangan, jalankan build UI lalu `dotnet run --project src/BeeHooks.App`. Tidak perlu development server. Paket rilis adalah satu folder aplikasi, bukan klaim satu EXE tanpa prasyarat.

## Tes

```powershell
dotnet run --project tests/BeeHooks.Checks
dotnet run --project tests/BeeHooks.Checks -- --probe
dotnet run --project tests/BeeHooks.Checks -- --probe --ds4 --four
```

Probe membuat perangkat nyata lalu melepaskannya; tutup game sebelum tes terpisah jika tidak ingin slot sesi game berubah. `--interactive` menerima input terbatas maksimal 1000 ms untuk bukti game, bukan macro produk.

Tes browser menggunakan host terisolasi dan driver palsu, tidak membuktikan driver atau game:

```powershell
dotnet run --project tests/BeeHooks.Checks -- --serve-test
# Gunakan alamat yang dicetak pada terminal kedua:
$env:BEEHOOKS_TEST_URL='http://127.0.0.1:PORT'
cd ui
node tests/desktop.mjs
node tests/smoke.mjs
node tests/studio.mjs
node tests/audio.mjs
```

Tes audio memakai host FakePad terisolasi yang kosong, mengunduh pratinjau resmi Dungeons/Overcooked, lalu menguji decoding 1080p, sampel audio, efek navigasi, sinkronisasi, mute dan jeda.

Chrome terpasang dipakai dalam mode tanpa tampilan dengan audio dimatikan. Hasil pengujian lokal tidak disertakan dalam repository.

Tampilan controller otomatis mendatar, termasuk saat viewport browser portrait. Halaman diputar secara visual; pengaturan orientasi sistem HP tidak diubah.

Galeri kini memakai ikon aplikasi game yang ditampilkan utuh. Ikon Steam diambil dari ICO instalasi atau cache lokal, dan executable/shortcut lokal memakai ikon Windows. Jika ikon tidak tersedia, kartu menampilkan inisial. Resolusi mengikuti ikon asli. Grid interaktif transparan mengisi seluruh background desktop, sedangkan trailer tetap mengikuti game. Efek berhenti saat diam/tersembunyi dan mengikuti pengaturan kurangi gerakan.

Galeri terbaru memakai sampul poster game tegak dengan proporsi 2:3, ditampilkan utuh dan berjajar pada tinggi yang sama. Sampul vertikal Steam diambil dari cache lokal terpisah. Jika tidak tersedia, sampul pilihan pengguna atau ikon/inisial menjadi pengganti. Kotak grid latar kini sekitar 32 px agar gerak pointer lebih terlihat.

Tampilan awal Games kini khusus galeri tanpa bilah sesi di bawahnya. Wheel di area galeri memilih game, termasuk saat kursor berada di luar poster; galeri tidak menggulir halaman. Detail game memakai scroll biasa. Latar PC kembali memakai Halftone Trail: jejak titik muncul mengikuti kursor, lebih besar saat ditekan, lalu memudar. Area jejak kini 10% lebih lebar dari versi Halftone sebelumnya; ukuran titik tetap dan jejak kini memudar sekitar dua kali lebih cepat (sekitar satu detik). Trailer tetap tersedia, dan pengaturan kurangi gerakan menonaktifkan jejak serta transisi halaman.

QR sambungan pada aplikasi PC memakai tombol bulat bergaya Nova QR. Hover/fokus menampilkan kartu QR; klik dapat menahannya terbuka. Escape, klik di luar, atau pindah fokus menutupnya. QR tetap berukuran 208 px dengan bidang putih dan mengikuti adaptor LAN serta undangan sesi aktif. Tombol nonaktif sebelum sesi disiapkan atau bila alamat LAN belum tersedia. Perubahan ini khusus PC; controller HP tetap memakai layout yang sudah ada.


Halaman ruang game memakai poster besar dan tombol Siapkan sesi/Play di kiri, pemain yang disetujui di bawah, serta panel QR dan ruang tunggu persetujuan di kanan. QR langsung tampil setelah sesi siap dan selalu terlihat selama sesi aktif, tanpa tombol buka/tutup. Tombol Setujui/Tolak berada di ruang tunggu. Membuka halaman game tidak otomatis menyiapkan sesi atau menjalankan game.


Footer galeri menampilkan tulisan BeeStation besar dari titik halftone yang bereaksi terhadap kursor dan klik. Scroll wheel di atas footer tetap memilih game. Footer mengikuti reduced motion dan hanya tampil di galeri. Susunan ruang game serta QR yang langsung terlihat berlaku untuk semua game.


Layar penuh PC: klik ikon di kanan atas atau tekan F11. Escape keluar dari layar penuh; ukuran dan mode jendela sebelumnya dipulihkan. Berlaku pada semua halaman. Logo aplikasi memakai tiga sel sarang madu kuning pada latar hitam; favicon, header, PNG, EXE/jendela dan shortcut berasal dari desain yang sama.


Tombol suara di kanan atas hanya mengaktifkan/mematikan audio trailer. Efek geser dan pilih game tetap terdengar setelah interaksi pengguna, termasuk ketika trailer dibisukan. Tidak ada tombol mute efek tambahan.


Geser kamera: pada profil Umum, geser area kosong di sisi kanan controller HP untuk mengirim arah analog kanan. Bisa berjalan dan menekan tombol bersamaan. Kamera berhenti saat geseran berhenti atau jari dilepas. Aktif/nonaktifkan per game lewat Controller Studio → Geser kanan untuk kamera; pemain juga bisa mengaturnya di editor HP. Sensitivitas mengikuti pengaturan layout. Dungeons tetap memakai analog kanan untuk roll, sehingga gestur kamera tidak aktif otomatis di profil itu. Perubahan default PC tidak menimpa preset pribadi; pilih Gunakan default game lalu Simpan di HP untuk mengadopsinya.

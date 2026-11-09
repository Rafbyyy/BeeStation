# Prasyarat driver — 7 November 2026

Sumber resmi: https://github.com/nefarius/ViGEmBus/releases/tag/v1.22.0

Installer: `tools/ViGEmBus_1.22.0_x64_x86_arm64.exe`.

SHA-256 lokal: `89220A7865076B342892F98865F3499FB7C4CFD673159E89D352C360FD014C6A`.

Authenticode: Valid; Nefarius Software Solutions e.U.; DigiCert timestamp 2023. Hash merupakan hasil ukur lokal, bukan hash terbitan upstream (API rilis tidak menyediakannya).

ViGEmBus sudah EOL. Gunakan installer resmi ini, tanpa updater lama atau domain vigem.org. Pemasangan perlu UAC pengguna. Jangan ubah Secure Boot, Memory Integrity, anti-cheat, atau test-signing.

Pemulihan: tutup BeeStation; Settings → Apps → Installed apps → Nefarius Virtual Gamepad Emulation Bus → Uninstall. Restart bila diminta. Jangan hapus driver bersama jika aplikasi lain masih memakainya.

SDK .NET 10.0.403 dipasang lokal di `%LOCALAPPDATA%/BeeHooks/sdk`, tanpa mengubah PATH. Microsoft WebView2 Runtime ditemukan versi 157.0.4341.42.

Atas keputusan pengguna terbaru, profil Windows **Umum/Public tetap didukung**. Tidak perlu mengganti kategori jaringan. BeeStation hanya bind alamat IPv4 LAN dan memeriksa subnet klien. Tombol Pengaturan → Izinkan akses HP di Windows meminta UAC pengguna; aturannya dibatasi executable BeeStation yang sedang dipakai, port TCP host aktif, Public/Private, dan LocalSubnet. Tidak ada perubahan firewall global, aturan aplikasi lain, atau Steam global. Pembuatan aturan nyata belum diklaim lulus sampai UAC pengguna dan tes HP selesai.

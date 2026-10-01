# SPARTA di GitHub Pages (database tetap Spreadsheet + Google Drive)

```
Browser  ──►  GitHub Pages (index.html, app.js, style.css)
                    │  fetch POST (JSON)
                    ▼
        Google Apps Script Web App (Kode.gs)  ──►  Google Spreadsheet + Google Drive
```

Folder:

* `github-pages/`  → di-upload ke repository GitHub (frontend)
* `apps-script/Kode.gs` → ditempel di Apps Script (backend). **JANGAN di-commit ke repo publik** (berisi konfigurasi/token WA).

## Catatan

* Fungsi yang bisa dipanggil dari internet dibatasi daftar `FUNGSI\_API` di `Kode.gs`.
* Jika akun Google Workspace instansi melarang akses "Anyone", minta admin domain mengizinkan, atau deploy dari akun Gmail biasa yang memiliki spreadsheet-nya.
* Batas kuota Apps Script (eksekusi/hari) tetap berlaku seperti sebelumnya.


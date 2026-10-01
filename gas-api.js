/**
 * Pengganti google.script.run untuk dipakai di luar Apps Script (mis. GitHub Pages).
 * Semua pemanggilan google.script.run.namaFungsi(...) diteruskan lewat HTTP POST
 * ke Web App Apps Script, yang tetap membaca/menulis Spreadsheet & Google Drive.
 *
 * Mendukung pola yang dipakai aplikasi:
 *   google.script.run.withSuccessHandler(fn).withFailureHandler(fn).namaFungsi(arg1, arg2)
 *
 * Tambahan (anti "data kosong tanpa sebab"):
 *  - Pemanggilan BACA (nama fungsi berawalan "get") diulang otomatis hingga 2x bila gagal
 *    karena jaringan / respons server tidak valid (Apps Script kadang membalas halaman error HTML).
 *  - Setiap kegagalan ditampilkan sebagai kotak merah kecil di kanan bawah beserta pesan aslinya,
 *    sehingga penyebab daftar kosong langsung terlihat (sesi habis, server error, URL API salah, dst).
 */
(function () {
  var MAKS_ULANG_BACA = 2;      // jumlah pengulangan tambahan untuk fungsi get*
  var JEDA_ULANG_MS   = 1500;   // jeda antar pengulangan (dikali nomor percobaan)

  /* ---------- Kotak pesan galat (kanan bawah) ---------- */
  var terakhir = { pesan: '', waktu: 0 };
  function tampilkanGalat(nama, pesan) {
    try {
      var sekarang = Date.now();
      var teks = '⚠️ Gagal memuat data (' + nama + '): ' + pesan;
      if (terakhir.pesan === teks && sekarang - terakhir.waktu < 8000) return; // hindari tumpukan
      terakhir = { pesan: teks, waktu: sekarang };

      var el = document.getElementById('apiGalatBanner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'apiGalatBanner';
        el.style.cssText = 'position:fixed;right:16px;bottom:16px;max-width:420px;z-index:3000;' +
          'background:#b3261e;color:#fff;font:13px/1.45 system-ui,sans-serif;padding:12px 38px 12px 14px;' +
          'border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);';
        var x = document.createElement('button');
        x.type = 'button'; x.textContent = '×';
        x.style.cssText = 'position:absolute;top:4px;right:8px;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;';
        x.onclick = function () { el.style.display = 'none'; };
        el.appendChild(x);
        var t = document.createElement('div'); t.id = 'apiGalatTeks'; el.appendChild(t);
        (document.body || document.documentElement).appendChild(el);
      }
      document.getElementById('apiGalatTeks').textContent = teks;
      el.style.display = 'block';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, 20000);
    } catch (e) { /* abaikan */ }
  }

  /* ---------- Pengiriman satu panggilan ---------- */
  function kirim(nama, args, url, percobaan, onOk, gagal) {
    var boleh_ulang = /^get/.test(nama) && percobaan < MAKS_ULANG_BACA;

    fetch(url, {
      method: 'POST',
      // text/plain = "simple request" -> tidak memicu preflight CORS (Apps Script tidak mendukung OPTIONS).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: nama, args: args }),
      redirect: 'follow'
    })
      .then(function (r) {
        if (!r.ok) throw { ulang: true, pesan: 'Server mengembalikan status ' + r.status };
        return r.text();
      })
      .then(function (teks) {
        var res;
        try { res = JSON.parse(teks); }
        catch (e) {
          var cuplikan = String(teks || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
          throw { ulang: true, pesan: 'Respons server bukan data yang valid (bisa karena error/kuota Apps Script atau deploy belum diperbarui). ' + (cuplikan ? '“' + cuplikan + '”' : '') };
        }
        if (res && res.ok) {
          if (typeof onOk === 'function') onOk(res.data);
        } else {
          // Galat resmi dari server (mis. sesi habis): tidak diulang.
          gagal((res && res.message) || 'Terjadi kesalahan pada server.');
        }
      })
      .catch(function (e) {
        var pesan, ulang = false;
        if (e && typeof e === 'object' && 'pesan' in e) { pesan = e.pesan; ulang = !!e.ulang; }
        else if (e && e.message === 'Failed to fetch') { pesan = 'Tidak dapat terhubung ke server. Periksa koneksi internet / URL API.'; ulang = true; }
        else { pesan = (e && e.message) || 'Kesalahan jaringan.'; ulang = true; }

        if (ulang && boleh_ulang) {
          setTimeout(function () { kirim(nama, args, url, percobaan + 1, onOk, gagal); },
                     JEDA_ULANG_MS * (percobaan + 1));
        } else {
          gagal(pesan);
        }
      });
  }

  function buat(onOk, onFail) {
    return new Proxy({}, {
      get: function (_, nama) {
        if (nama === 'withSuccessHandler') return function (fn) { return buat(fn, onFail); };
        if (nama === 'withFailureHandler') return function (fn) { return buat(onOk, fn); };
        if (nama === 'withUserObject')     return function ()   { return buat(onOk, onFail); };
        if (typeof nama !== 'string' || nama === 'then') return undefined;

        return function () {
          var args = Array.prototype.slice.call(arguments);
          var url = (window.SPARTA_CONFIG || {}).API_URL;

          var gagal = function (pesan) {
            console.error('[API] ' + nama + ':', pesan);
            tampilkanGalat(nama, pesan);
            var err = new Error(pesan);
            if (typeof onFail === 'function') onFail(err);
          };

          if (!url || url.indexOf('GANTI_DENGAN') !== -1) {
            gagal('API_URL belum diisi pada config.js');
            return;
          }
          kirim(nama, args, url, 0, onOk, gagal);
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = { run: buat() };
})();

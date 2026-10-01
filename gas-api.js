/**
 * Pengganti google.script.run untuk dipakai di luar Apps Script (mis. GitHub Pages).
 * Semua pemanggilan google.script.run.namaFungsi(...) diteruskan lewat HTTP POST
 * ke Web App Apps Script, yang tetap membaca/menulis Spreadsheet & Google Drive.
 *
 * Mendukung pola yang dipakai aplikasi:
 *   google.script.run.withSuccessHandler(fn).withFailureHandler(fn).namaFungsi(arg1, arg2)
 */
(function () {
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
            var err = new Error(pesan);
            if (typeof onFail === 'function') onFail(err);
            else console.error('[API] ' + nama + ':', pesan);
          };

          if (!url || url.indexOf('GANTI_DENGAN') !== -1) {
            gagal('API_URL belum diisi pada config.js');
            return;
          }

          // Content-Type text/plain = "simple request" -> tidak memicu preflight CORS
          // (Apps Script tidak mendukung request OPTIONS).
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ fn: nama, args: args }),
            redirect: 'follow'
          })
            .then(function (r) {
              if (!r.ok) throw new Error('Server mengembalikan status ' + r.status);
              return r.json();
            })
            .then(function (res) {
              if (res && res.ok) {
                if (typeof onOk === 'function') onOk(res.data);
              } else {
                gagal((res && res.message) || 'Terjadi kesalahan pada server.');
              }
            })
            .catch(function (e) {
              gagal(e && e.message === 'Failed to fetch'
                ? 'Tidak dapat terhubung ke server. Periksa koneksi internet / URL API.'
                : (e && e.message) || 'Kesalahan jaringan.');
            });
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = { run: buat() };
})();

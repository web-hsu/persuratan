/* SPARTA Android (versi web) - tambahan kecil di atas app.js: tombol lihat password & menu bawah. */
(function () {
  'use strict';

  /* ---- Lihat / sembunyikan password ---- */
  var btnMata = document.getElementById('btnLihatPassword');
  var inpPass = document.getElementById('loginPassword');
  if (btnMata && inpPass) {
    btnMata.addEventListener('click', function () {
      var tampil = inpPass.type === 'password';
      inpPass.type = tampil ? 'text' : 'password';
      btnMata.textContent = tampil ? '🙈' : '👁';
      btnMata.setAttribute('aria-label', tampil ? 'Sembunyikan password' : 'Tampilkan password');
    });
  }

  /* ---- Menu bawah (bottom navigation): cerminan dari menu samping yang dibuat app.js sesuai role ---- */
  var PRIORITAS = ['dashboard', 'disposisi', 'registrasi', 'semuasurat', 'tracking', 'suratselesai'];
  var navAsli = document.getElementById('navTabs');
  var bar = document.getElementById('bottomNav');
  var appPage = document.getElementById('appPage');
  if (!navAsli || !bar || !appPage) return;

  function pecahLabel(teks) {               // "📊 Dashboard" -> ["📊", "Dashboard"]
    var t = (teks || '').trim();
    var m = /^(\S+)\s+(.*)$/.exec(t);
    return m ? [m[1], m[2]] : ['•', t];
  }

  function bangunBar() {
    var item = {};
    navAsli.querySelectorAll('.nav-item[data-page]').forEach(function (el) {
      if (!el.classList.contains('has-sub')) item[el.dataset.page] = el;
    });
    var terpilih = PRIORITAS.filter(function (p) { return item[p]; }).slice(0, 4);
    if (!terpilih.length) { bar.innerHTML = ''; return; }

    var html = '';
    terpilih.forEach(function (p) {
      var l = pecahLabel(item[p].textContent);
      var pendek = l[1].replace('Menunggu Persetujuan', 'Persetujuan').replace('Daftar Surat Masuk', 'Surat')
                       .replace('Registrasi Surat', 'Registrasi').replace('Tracking Surat', 'Tracking');
      html += '<button type="button" class="bn-item" data-page="' + p + '"><span class="bn-ikon">' + l[0] + '</span><span class="bn-teks">' + pendek + '</span></button>';
    });
    html += '<button type="button" class="bn-item" data-menu="1"><span class="bn-ikon">☰</span><span class="bn-teks">Menu</span></button>';
    bar.innerHTML = html;

    bar.querySelectorAll('.bn-item[data-page]').forEach(function (b) {
      b.addEventListener('click', function () { item[b.dataset.page].click(); window.scrollTo({ top: 0 }); });
    });
    bar.querySelector('[data-menu]').addEventListener('click', function () {
      var t = document.getElementById('btnToggleSidebar');
      if (t) t.click();
    });
    sinkronAktif();
  }

  function sinkronAktif() {
    var aktif = navAsli.querySelector('.nav-item.active');
    var p = aktif ? aktif.dataset.page : '';
    bar.querySelectorAll('.bn-item[data-page]').forEach(function (b) {
      b.classList.toggle('aktif', b.dataset.page === p);
    });
  }

  function tampilkanBarBila() {
    var login = appPage.style.display !== 'none';
    bar.style.display = login ? 'flex' : 'none';
    document.body.classList.toggle('sudah-login', login);
    if (!login) bar.innerHTML = '';
  }

  new MutationObserver(function (m) {
    // daftar menu dibuat ulang (login) -> bangun menu bawah; hanya kelas berubah -> sinkron aktif
    var dibuatUlang = m.some(function (x) { return x.type === 'childList'; });
    if (dibuatUlang) bangunBar(); else sinkronAktif();
  }).observe(navAsli, { childList: true, attributes: true, attributeFilter: ['class'], subtree: true });

  new MutationObserver(tampilkanBarBila).observe(appPage, { attributes: true, attributeFilter: ['style'] });
  tampilkanBarBila();
})();

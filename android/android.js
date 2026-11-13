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

/* ---------- Dashboard gaya widget: widget sapaan di bagian atas ---------- */
(function () {
  'use strict';
  var halaman = document.getElementById('page-dashboard');
  var grid = document.getElementById('statsGrid');
  var navAsli = document.getElementById('navTabs');
  if (!halaman || !grid) return;

  var hero = document.createElement('div');
  hero.className = 'w-hero';
  hero.id = 'widgetSapaan';
  hero.innerHTML =
    '<div class="w-hero-atas"><div><div class="w-sapa" id="wSapa">Halo</div><div class="w-nama" id="wNama">-</div></div>' +
    '<div class="w-avatar" id="wAvatar">-</div></div>' +
    '<div class="w-meta"><span id="wRole"></span><span id="wTanggal"></span></div>' +
    '<div class="w-ringkas" id="wRingkas" style="display:none;"></div>' +
    '<div class="w-aksi" id="wAksi"></div>';
  halaman.insertBefore(hero, halaman.firstChild);

  function teks(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; }

  function perbarui() {
    var jam = new Date().getHours();
    var sapa = jam < 11 ? 'Selamat pagi' : (jam < 15 ? 'Selamat siang' : (jam < 18 ? 'Selamat sore' : 'Selamat malam'));
    var nama = teks('userNamaLabel') || '-';
    document.getElementById('wSapa').textContent = sapa;
    document.getElementById('wNama').textContent = nama;
    document.getElementById('wAvatar').textContent = (nama.charAt(0) || '?').toUpperCase();
    document.getElementById('wRole').textContent = teks('userRoleLabel');
    try {
      document.getElementById('wTanggal').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) { /* abaikan */ }

    // Ringkasan: angka pada papan berwarna amber (Menunggu Persetujuan / Dalam Proses)
    var amber = grid.querySelector('.stat-box.amber .num');
    var label = grid.querySelector('.stat-box.amber .label');
    var r = document.getElementById('wRingkas');
    if (amber && /^\d+$/.test(amber.textContent.trim())) {
      r.style.display = '';
      r.innerHTML = '<b>' + amber.textContent.trim() + '</b> surat ' + (label ? label.textContent.trim().toLowerCase() : 'dalam proses');
    }
  }

  function aksiCepat() {
    var wadah = document.getElementById('wAksi');
    var daftar = [['registrasi', '📝', 'Registrasi'], ['disposisi', '✅', 'Persetujuan'], ['tracking', '🔎', 'Tracking']];
    var html = '';
    daftar.forEach(function (d) {
      if (navAsli && navAsli.querySelector('.nav-item[data-page="' + d[0] + '"]')) {
        html += '<button type="button" class="w-aksi-btn" data-ke="' + d[0] + '"><span>' + d[1] + '</span>' + d[2] + '</button>';
      }
    });
    wadah.innerHTML = html;
    wadah.querySelectorAll('.w-aksi-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = navAsli.querySelector('.nav-item[data-page="' + b.dataset.ke + '"]');
        if (t) t.click();
        window.scrollTo({ top: 0 });
      });
    });
  }

  new MutationObserver(perbarui).observe(grid, { childList: true, subtree: true, characterData: true });
  if (navAsli) new MutationObserver(function () { perbarui(); aksiCepat(); }).observe(navAsli, { childList: true });
  perbarui(); aksiCepat();
})();

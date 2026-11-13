/* SPARTA Android (versi web) - tambahan di atas app.js: lihat password, menu bawah gaya kaca, widget sapaan. */
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

  var navAsli = document.getElementById('navTabs');
  var bar = document.getElementById('bottomNav');
  var appPage = document.getElementById('appPage');
  if (!navAsli || !bar || !appPage) return;

  /* ---- Ikon garis (SVG) untuk menu bawah ---- */
  function svg(isi) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + isi + '</svg>';
  }
  var IKON = {
    dashboard:    svg('<rect x="3.5" y="3.5" width="7" height="8.5" rx="2"/><rect x="13.5" y="3.5" width="7" height="5" rx="2"/><rect x="13.5" y="11.5" width="7" height="9" rx="2"/><rect x="3.5" y="15" width="7" height="5.5" rx="2"/>'),
    registrasi:   svg('<path d="M14 3.5H7.5A2 2 0 0 0 5.5 5.5v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M14 3.5V8h4.5"/><path d="M12 11.5v5M9.5 14h5"/>'),
    semuasurat:   svg('<path d="M3.5 13.5l2.4-7.2A2 2 0 0 1 7.8 5h8.4a2 2 0 0 1 1.9 1.3l2.4 7.2"/><path d="M3.5 13.5V17a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3.5h-5l-1.2 2h-5.6l-1.2-2z"/>'),
    suratselesai: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.4l2.7 2.7 4.8-5.2"/>'),
    disposisi:    svg('<rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 4.5V3.5h6v1"/><path d="M9 12.5l2 2 4-4.2"/>'),
    keluar:       svg('<path d="M9.5 20.5h-4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4"/><path d="M15.5 16.5L20 12l-4.5-4.5"/><path d="M20 12H9.5"/>')
  };

  /* ---- Menu bawah: Dashboard, Registrasi, Surat Masuk, Selesai, Keluar ---- */
  var URUTAN = [
    { p: 'dashboard',    teks: 'Dashboard' },
    { p: 'registrasi',   teks: 'Registrasi' },
    { p: 'semuasurat',   teks: 'Surat Masuk' },
    { p: 'suratselesai', teks: 'Selesai' }
  ];

  function item(p) { return navAsli.querySelector('.nav-item[data-page="' + p + '"]'); }

  function bangunBar() {
    var html = '';
    URUTAN.forEach(function (u) {
      if (!item(u.p)) return;
      html += '<button type="button" class="bn-item" data-page="' + u.p + '"><span class="bn-ikon">' + IKON[u.p] + '</span><span class="bn-teks">' + u.teks + '</span></button>';
    });
    html += '<button type="button" class="bn-item bn-keluar" data-keluar="1"><span class="bn-ikon">' + IKON.keluar + '</span><span class="bn-teks">Keluar</span></button>';
    bar.innerHTML = html;

    bar.querySelectorAll('.bn-item[data-page]').forEach(function (b) {
      b.addEventListener('click', function () { var t = item(b.dataset.page); if (t) t.click(); window.scrollTo({ top: 0 }); });
    });
    bar.querySelector('[data-keluar]').addEventListener('click', function () {
      var k = document.getElementById('btnKembaliLanding');
      if (k) k.click();
    });
    sinkronAktif();
  }

  function sinkronAktif() {
    var aktif = navAsli.querySelector('.nav-item.active');
    var p = aktif ? aktif.dataset.page : '';
    bar.querySelectorAll('.bn-item[data-page]').forEach(function (b) { b.classList.toggle('aktif', b.dataset.page === p); });
  }

  function tampilkanBarBila() {
    var login = appPage.style.display !== 'none';
    bar.style.display = login ? 'flex' : 'none';
    document.body.classList.toggle('sudah-login', login);
    if (!login) bar.innerHTML = '';
  }

  new MutationObserver(function (m) {
    if (m.some(function (x) { return x.type === 'childList'; })) bangunBar(); else sinkronAktif();
  }).observe(navAsli, { childList: true, attributes: true, attributeFilter: ['class'], subtree: true });
  new MutationObserver(tampilkanBarBila).observe(appPage, { attributes: true, attributeFilter: ['style'] });
  tampilkanBarBila();

  /* ---------- Dashboard: widget sapaan (ringkas) ---------- */
  var halaman = document.getElementById('page-dashboard');
  var grid = document.getElementById('statsGrid');
  if (!halaman || !grid) return;

  var hero = document.createElement('div');
  hero.className = 'w-hero';
  hero.id = 'widgetSapaan';
  hero.innerHTML =
    '<div class="w-hero-atas"><div><div class="w-sapa" id="wSapa">Halo</div><div class="w-nama" id="wNama">-</div></div>' +
    '<div class="w-avatar" id="wAvatar">-</div></div>' +
    '<div class="w-meta"><span id="wRole"></span><span id="wTanggal"></span></div>' +
    '<button type="button" class="w-ringkas" id="wRingkas" style="display:none;"></button>';
  halaman.insertBefore(hero, halaman.firstChild);

  function teks(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; }

  function bukaPersetujuan() {
    var t = item('disposisi');
    if (t) { t.click(); window.scrollTo({ top: 0 }); }
  }
  document.getElementById('wRingkas').addEventListener('click', bukaPersetujuan);

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

    // Pintasan ke "Menunggu Persetujuan" (menu ini tidak ada di menu bawah)
    var amber = grid.querySelector('.stat-box.amber .num');
    var r = document.getElementById('wRingkas');
    if (amber && /^\d+$/.test(amber.textContent.trim()) && item('disposisi')) {
      r.style.display = '';
      r.innerHTML = '✅ <b>' + amber.textContent.trim() + '</b> surat menunggu persetujuan <span class="w-panah">›</span>';
    }
  }
  new MutationObserver(perbarui).observe(grid, { childList: true, subtree: true, characterData: true });
  new MutationObserver(perbarui).observe(navAsli, { childList: true });
  perbarui();
})();

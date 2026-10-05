/* ============================================================
   *  CLIENT-SIDE LOGIC
   * ============================================================ */

  // Urutan baku tahap alur persetujuan (harus sama dengan URUTAN_TAHAP_BAKU di Code.gs)
  const URUTAN_TAHAP_BAKU_CLIENT = ['Paraf Asisten', 'Paraf Staf Ahli', 'Paraf Sekda', 'Tanda Tangan Sekda', 'Tanda Tangan Wakil Bupati', 'Tanda Tangan Bupati'];

  // Tab yang tersedia untuk masing-masing role
  const TAB_PER_ROLE = {
    'Admin TU'      : [
      {p:'dashboard', label:'📊 Dashboard', group:'Persuratan'},
      {p:'registrasi', label:'📝 Registrasi Surat Masuk', group:'Persuratan'},
      {p:'tracking', label:'🔍 Tracking Surat', group:'Persuratan'},
      {p:'disposisi', label:'✅ Menunggu Persetujuan (Super Admin)', group:'Persuratan'},
      {p:'semuasurat', label:'📋 Daftar Surat Masuk', group:'Persuratan'},
      {p:'suratselesai', label:'✔️ Surat Selesai', group:'Persuratan'},
      {p:'laporan', label:'📁 Laporan', group:'Persuratan'},
      {p:'dashboardarsip', label:'📊 Dashboard Arsip', group:'Pengarsipan'},
      {p:'arsip', label:'🗄️ Pengarsipan', group:'Pengarsipan'},
      {p:'carilokasi', label:'🔎 Cari Dokumen', group:'Pengarsipan'},
      {p:'lokasiarsip', label:'📦 Lokasi Penyimpanan', group:'Pengarsipan'}
    ],
    'Asisten'       : [ {p:'dashboard', label:'📊 Dashboard'}, {p:'registrasi', label:'📝 Registrasi Surat Masuk'}, {p:'tracking', label:'🔍 Tracking Surat'}, {p:'disposisi', label:'✅ Menunggu Persetujuan'}, {p:'semuasurat', label:'📋 Daftar Surat Masuk'}, {p:'suratselesai', label:'✔️ Surat Selesai'}, {p:'laporan', label:'📁 Laporan'} ],
    'Staf Ahli'     : [ {p:'dashboard', label:'📊 Dashboard'}, {p:'registrasi', label:'📝 Registrasi Surat Masuk'}, {p:'tracking', label:'🔍 Tracking Surat'}, {p:'disposisi', label:'✅ Menunggu Persetujuan'}, {p:'semuasurat', label:'📋 Daftar Surat Masuk'}, {p:'suratselesai', label:'✔️ Surat Selesai'}, {p:'laporan', label:'📁 Laporan'} ],
    'Sekda'         : [ {p:'dashboard', label:'📊 Dashboard'}, {p:'registrasi', label:'📝 Registrasi Surat Masuk'}, {p:'tracking', label:'🔍 Tracking Surat'}, {p:'disposisi', label:'✅ Menunggu Persetujuan'}, {p:'semuasurat', label:'📋 Daftar Surat Masuk'}, {p:'suratselesai', label:'✔️ Surat Selesai'}, {p:'laporan', label:'📁 Laporan'} ],
    'Wakil Bupati'  : [ {p:'dashboard', label:'📊 Dashboard'}, {p:'registrasi', label:'📝 Registrasi Surat Masuk'}, {p:'tracking', label:'🔍 Tracking Surat'}, {p:'disposisi', label:'✅ Menunggu Persetujuan'}, {p:'semuasurat', label:'📋 Daftar Surat Masuk'}, {p:'suratselesai', label:'✔️ Surat Selesai'}, {p:'laporan', label:'📁 Laporan'} ],
    'Bupati'        : [ {p:'dashboard', label:'📊 Dashboard'}, {p:'registrasi', label:'📝 Registrasi Surat Masuk'}, {p:'tracking', label:'🔍 Tracking Surat'}, {p:'disposisi', label:'✅ Menunggu Persetujuan'}, {p:'semuasurat', label:'📋 Daftar Surat Masuk'}, {p:'suratselesai', label:'✔️ Surat Selesai'}, {p:'laporan', label:'📁 Laporan'} ],
    'Petugas Arsip' : [ {p:'dashboardarsip', label:'📊 Dashboard Arsip'}, {p:'arsip', label:'🗄️ Pengarsipan'}, {p:'carilokasi', label:'🔎 Cari Dokumen'}, {p:'lokasiarsip', label:'📦 Lokasi Penyimpanan'} ]
  };

  // Role dengan hak Super Admin: bisa memproses tahap persetujuan apa pun
  const SUPER_ADMIN_ROLES = ['Admin TU'];

  let CURRENT_USER = null;

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('tahunFooter').textContent = new Date().getFullYear();

    initLandingTracking();
    initLoginModal();
    initSidebarToggle();
    initEditSuratModal();
    initNotifWaModal();
    initArsipkanModal();
    initArsipManualModal();
    initLokasiArsipModal();
    cobaPulihkanSesi();

    // Grid statistik dashboard pakai auto-fit (jumlah kolom berubah sesuai lebar layar) -
    // sesuaikan ulang lebar kotak "Persentase Selesai" setiap layar di-resize.
    window.addEventListener('resize', sesuaikanLebarKotakPersentase);

    document.getElementById('btnKembaliLanding').addEventListener('click', function () {
      keluarDariAplikasi();
    });
  });

  /* ---------- TOAST ---------- */
  function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(function () { t.className = 'toast'; }, 3500);
  }

  /* ============================================================
   *  LOGIN (Username / Password) & HALAMAN DEPAN
   * ============================================================ */

  const SESSION_KEY = 'persuratan_token';

  function initLoginModal() {
    const btnOpen = document.getElementById('btnBukaLogin');
    const overlay = document.getElementById('loginModalOverlay');
    const btnClose = document.getElementById('btnTutupLogin');
    const form = document.getElementById('formLogin');
    const errBox = document.getElementById('loginErrorBox');

    btnOpen.addEventListener('click', function () {
      errBox.style.display = 'none';
      overlay.classList.add('show');
      document.getElementById('loginUsername').focus();
    });
    btnClose.addEventListener('click', function () { overlay.classList.remove('show'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('show'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const btn = document.getElementById('btnSubmitLogin');

      errBox.style.display = 'none';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Memeriksa...';

      google.script.run
        .withSuccessHandler(function (res) {
          btn.disabled = false;
          btn.innerHTML = 'Masuk';
          if (!res.success) {
            errBox.textContent = res.message;
            errBox.style.display = 'block';
            return;
          }
          sessionStorage.setItem(SESSION_KEY, res.token);
          overlay.classList.remove('show');
          form.reset();
          masukKeAplikasi(res);
        })
        .withFailureHandler(function (err) {
          btn.disabled = false;
          btn.innerHTML = 'Masuk';
          errBox.textContent = 'Terjadi kesalahan: ' + err.message;
          errBox.style.display = 'block';
        })
        .loginUser(username, password);
    });
  }

  // Jika ada token tersimpan (mis. setelah refresh halaman), coba validasi ke server.
  function cobaPulihkanSesi() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return;

    google.script.run
      .withSuccessHandler(function (res) {
        if (res.found) {
          masukKeAplikasi({ token: token, username: res.username, nama: res.nama, role: res.role });
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      })
      .withFailureHandler(function () {
        sessionStorage.removeItem(SESSION_KEY);
      })
      .getSessionUser(token);
  }

  function masukKeAplikasi(info) {
    CURRENT_USER = info; // { token, username, nama, role }

    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('appPage').style.display = 'block';

    document.getElementById('userNamaLabel').textContent = info.nama;
    document.getElementById('userRoleLabel').textContent = info.role + (info.role === 'Admin TU' ? ' • Super Admin' : '');
    document.getElementById('avatarInisial').textContent = (info.nama || '?').charAt(0).toUpperCase();

    buildNavTabs(info.role);

    if (info.role === 'Petugas Arsip') {
      // Role ini punya menu & dashboard sendiri, terpisah total dari manajemen persuratan.
      loadDashboardArsip();
      loadHalamanArsip();
      loadDaftarLokasiArsip();
    } else {
      populateJenisSurat();
      populateDaftarSkpd();
      populateFilterTahunJenis();
      loadDashboard();
      loadKotakMasukSaya(); // semua role persuratan (termasuk Super Admin) langsung melihat kotak masuknya
      initRegistrasiForm();
    }
  }

  function keluarDariAplikasi() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (token) {
      google.script.run.logoutUser(token);
      sessionStorage.removeItem(SESSION_KEY);
    }
    CURRENT_USER = null;
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('landingPage').style.display = 'block';
  }

  function buildNavTabs(role) {
    const tabs = TAB_PER_ROLE[role] || TAB_PER_ROLE['Admin TU'];
    const nav = document.getElementById('navTabs');

    // Kelompokkan tab sesuai propertinya "group" (kalau ada) sambil menjaga urutan asli.
    const groupOrder = [];
    const groupItems = {};
    let adaGrup = false;
    tabs.forEach(function (t) {
      const g = t.group || '__default__';
      if (t.group) adaGrup = true;
      if (!groupItems[g]) { groupItems[g] = []; groupOrder.push(g); }
      groupItems[g].push(t);
    });

    let html = '';
    groupOrder.forEach(function (g, gi) {
      const grupAktif = gi === 0; // grup pertama terbuka secara default
      if (adaGrup && g !== '__default__') {
        html += '<div class="nav-group-label' + (grupAktif ? ' active-group' : '') + '" data-group="' + g + '">' + g + '</div>';
      }
      html += '<div class="nav-group-items" data-group-items="' + g + '"' + (adaGrup && !grupAktif ? ' style="display:none;"' : '') + '>';
      groupItems[g].forEach(function (t, ti) {
        html += '<div class="nav-item' + (gi === 0 && ti === 0 ? ' active' : '') + '" data-page="' + t.p + '">' + t.label + '</div>';
      });
      html += '</div>';
    });
    nav.innerHTML = html;

    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    document.getElementById('page-' + tabs[0].p).classList.add('active');

    // Klik label grup -> tampilkan grup itu saja, sembunyikan grup lainnya (akordeon).
    nav.querySelectorAll('.nav-group-label').forEach(function (labelEl) {
      labelEl.addEventListener('click', function () {
        const targetGroup = labelEl.dataset.group;
        nav.querySelectorAll('.nav-group-label').forEach(function (l) { l.classList.remove('active-group'); });
        labelEl.classList.add('active-group');
        nav.querySelectorAll('.nav-group-items').forEach(function (giEl) {
          giEl.style.display = (giEl.dataset.groupItems === targetGroup) ? 'flex' : 'none';
        });
      });
    });

    nav.querySelectorAll('.nav-item').forEach(function (tabEl) {
      tabEl.addEventListener('click', function () {
        nav.querySelectorAll('.nav-item').forEach(function (t) { t.classList.remove('active'); });
        tabEl.classList.add('active');

        // Kalau menu yang diklik ada di grup yang sedang disembunyikan (mis. navigasi programatis
        // dari kartu dashboard), otomatis pindahkan grup yang terlihat supaya tetap konsisten.
        const parentGroupEl = tabEl.closest('.nav-group-items');
        if (parentGroupEl) {
          const g = parentGroupEl.dataset.groupItems;
          nav.querySelectorAll('.nav-group-label').forEach(function (l) { l.classList.toggle('active-group', l.dataset.group === g); });
          nav.querySelectorAll('.nav-group-items').forEach(function (giEl) { giEl.style.display = (giEl.dataset.groupItems === g) ? 'flex' : 'none'; });
        }

        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        document.getElementById('page-' + tabEl.dataset.page).classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        tutupSidebarMobile(); // di layar sempit, sidebar otomatis tertutup setelah memilih menu

        if (tabEl.dataset.page === 'dashboard') loadDashboard();
        if (tabEl.dataset.page === 'disposisi') loadKotakMasukSaya();
        if (tabEl.dataset.page === 'semuasurat') loadDaftarSuratMasuk();
        if (tabEl.dataset.page === 'suratselesai') loadSuratSelesai();
        if (tabEl.dataset.page === 'arsip') loadHalamanArsip();
        if (tabEl.dataset.page === 'dashboardarsip') loadDashboardArsip();
        if (tabEl.dataset.page === 'lokasiarsip') loadDaftarLokasiArsip();
        if (tabEl.dataset.page === 'laporan') { loadLaporanHarian(); loadLaporanBulanan(); }
      });
    });
  }

  /* ============================================================
   *  SIDEBAR MOBILE (drawer off-canvas)
   * ============================================================ */

  function initSidebarToggle() {
    const btnToggle = document.getElementById('btnToggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!btnToggle || !sidebar || !overlay) return;

    btnToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
    overlay.addEventListener('click', tutupSidebarMobile);
  }

  function tutupSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }

  /* ============================================================
   *  TRACKING PUBLIK (halaman depan) - tanpa login
   * ============================================================ */

  function initLandingTracking() {
    document.getElementById('btnCariLanding').addEventListener('click', function () {
      const noReg = document.getElementById('inputNoRegLanding').value.trim();
      const box = document.getElementById('hasilTrackingLanding');
      if (!noReg) { showToast('Masukkan No Registrasi terlebih dahulu', 'error'); return; }
      box.innerHTML = '<div class="empty-state">Mencari data...</div>';

      google.script.run
        .withSuccessHandler(function (res) {
          if (!res.found) {
            box.innerHTML = '<div class="empty-state">No Registrasi tidak ditemukan.</div>';
            return;
          }
          renderTrackingResult(res, box);
        })
        .withFailureHandler(function (err) {
          box.innerHTML = '<div class="empty-state">Terjadi kesalahan: ' + err.message + '</div>';
        })
        .getTrackingPublik(noReg);
    });

    document.getElementById('inputNoRegLanding').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('btnCariLanding').click();
    });
  }

  /* ============================================================
   *  REGISTRASI (Admin TU)
   * ============================================================ */

  function populateJenisSurat() {
    google.script.run.withSuccessHandler(function (list) {
      const sel = document.getElementById('jenisSurat');
      if (!sel) return;
      sel.innerHTML = '<option value="">-- Pilih Jenis Surat --</option>';
      list.forEach(function (j) {
        const opt = document.createElement('option');
        opt.value = j; opt.textContent = j;
        sel.appendChild(opt);
      });
      const selFilter = document.getElementById('filterJenis');
      if (selFilter) {
        list.forEach(function (j) {
          const opt = document.createElement('option');
          opt.value = j; opt.textContent = j;
          selFilter.appendChild(opt);
        });
      }
    }).getJenisSuratList();
  }

  let SKPD_LIST_CACHE = [];

  function populateDaftarSkpd() {
    google.script.run
      .withSuccessHandler(function (list) {
        SKPD_LIST_CACHE = list || [];
      })
      .withFailureHandler(function () { /* diamkan - field tetap bisa diketik manual */ })
      .getMasterSKPD();
  }

  // Komponen autocomplete kustom (menggantikan <datalist> bawaan browser yang membatasi
  // jumlah saran yang ditampilkan). Menampilkan SEMUA hasil yang cocok, bisa digulir.
  function initSkpdAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.acBound === '1') return;
    input.dataset.acBound = '1';

    const parent = input.parentElement;
    parent.style.position = 'relative';

    const box = document.createElement('div');
    box.className = 'skpd-suggest-box';
    parent.appendChild(box);

    function render(filterText) {
      const kw = (filterText || '').trim().toLowerCase();
      const matches = SKPD_LIST_CACHE.filter(function (n) {
        return !kw || n.toLowerCase().indexOf(kw) !== -1;
      });
      if (!matches.length) {
        box.innerHTML = '<div class="skpd-suggest-empty">Tidak ada SKPD yang cocok — bebas diketik manual.</div>';
        box.classList.add('show');
        return;
      }
      box.innerHTML = matches.map(function (n) {
        return '<div class="skpd-suggest-item">' + n.replace(/</g, '&lt;') + '</div>';
      }).join('');
      box.classList.add('show');
    }

    input.addEventListener('focus', function () { render(input.value); });
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('blur', function () { setTimeout(function () { box.classList.remove('show'); }, 150); });

    box.addEventListener('mousedown', function (e) {
      const item = e.target.closest('.skpd-suggest-item');
      if (!item) return;
      input.value = item.textContent;
      box.classList.remove('show');
    });
  }

  function populateFilterTahunJenis() {
    const selTahun = document.getElementById('filterTahun');
    if (!selTahun) return;
    const now = new Date().getFullYear();
    let html = '<option value="">Semua Tahun</option>';
    for (let y = now; y >= now - 4; y--) html += '<option value="' + y + '">' + y + '</option>';
    selTahun.innerHTML = html;
  }

  let registrasiInit = false;
  function initRegistrasiForm() {
    if (registrasiInit) return;
    registrasiInit = true;

    initSkpdAutocomplete('suratDariNama');

    const jenisSel = document.getElementById('jenisSurat');
    const undanganBox = document.getElementById('undanganFields');
    const alurPersetujuanBox = document.getElementById('alurPersetujuanBox');
    const tujuanInformasiBox = document.getElementById('tujuanInformasiBox');
    const alurBox = document.getElementById('alurInfoBox');
    const alurText = document.getElementById('alurInfoText');
    const chkAlur = document.querySelectorAll('.chk-alur');
    const chkTujuan = document.querySelectorAll('.chk-tujuan');
    const btnTipePersetujuan = document.getElementById('btnTipePersetujuan');
    const btnTipeInformasi = document.getElementById('btnTipeInformasi');

    let tipeTerpilih = ''; // 'PERSETUJUAN' atau 'INFORMASI'

    function pilihTipe(tipe) {
      tipeTerpilih = tipe;
      btnTipePersetujuan.classList.toggle('active', tipe === 'PERSETUJUAN');
      btnTipeInformasi.classList.toggle('active', tipe === 'INFORMASI');
      updateUI();
    }
    btnTipePersetujuan.addEventListener('click', function () { pilihTipe('PERSETUJUAN'); });
    btnTipeInformasi.addEventListener('click', function () { pilihTipe('INFORMASI'); });

    function updateUI() {
      const jenis = jenisSel.value;
      const pakaiAlur = tipeTerpilih === 'PERSETUJUAN';
      const tanpaAlur = tipeTerpilih === 'INFORMASI';

      undanganBox.style.display = (jenis === 'Undangan') ? 'block' : 'none';
      alurPersetujuanBox.style.display = pakaiAlur ? 'block' : 'none';
      tujuanInformasiBox.style.display = tanpaAlur ? 'block' : 'none';

      if (pakaiAlur) {
        const terpilih = Array.prototype.filter.call(chkAlur, function (c) { return c.checked; }).map(function (c) { return c.value; });
        const alurUrut = URUTAN_TAHAP_BAKU_CLIENT.filter(function (t) { return terpilih.indexOf(t) !== -1; });
        if (alurUrut.length) {
          alurBox.style.display = 'block';
          alurText.innerHTML = alurUrut.map(function (a, i) {
            return '<span class="item"><strong>' + (i + 1) + '.</strong> ' + a + '</span>';
          }).join('');
        } else {
          alurBox.style.display = 'block';
          alurText.innerHTML = '<span class="item" style="color:var(--muted);">Belum ada tahap yang dicentang.</span>';
        }
      } else {
        alurBox.style.display = 'none';
      }
    }

    jenisSel.addEventListener('change', updateUI);
    chkAlur.forEach(function (c) { c.addEventListener('change', updateUI); });

    document.getElementById('formRegistrasi').addEventListener('submit', function (e) {
      e.preventDefault();

      if (!tipeTerpilih) {
        showToast('Pilih dulu Tipe Tracking Surat: Perlu Persetujuan atau Hanya Informasi.', 'error');
        return;
      }

      const jenis = jenisSel.value;
      const form = {
        suratDariTipe: document.getElementById('suratDariTipe').value,
        suratDariNama: document.getElementById('suratDariNama').value,
        noSurat: document.getElementById('noSurat').value,
        perihal: document.getElementById('perihal').value,
        jenisSurat: jenis,
        tipeTracking: tipeTerpilih,
        tindakLanjut: document.getElementById('tindakLanjut').value,
        noWhatsApp: document.getElementById('noWhatsApp').value,
        isiDisposisi: document.getElementById('isiDisposisi').value
      };

      if (tipeTerpilih === 'PERSETUJUAN') {
        form.alurTerpilih = Array.prototype.filter.call(chkAlur, function (c) { return c.checked; }).map(function (c) { return c.value; });
        if (!form.alurTerpilih.length) {
          showToast('Pilih minimal satu tahap pada Alur Persetujuan.', 'error');
          return;
        }
      } else {
        form.tujuanTerpilih = Array.prototype.filter.call(chkTujuan, function (c) { return c.checked; }).map(function (c) { return c.value; });
        if (!form.tujuanTerpilih.length) {
          showToast('Pilih minimal satu Tujuan Surat.', 'error');
          return;
        }
      }

      if (jenis === 'Undangan') {
        form.tanggalAcara = document.getElementById('tanggalAcara').value;
        form.waktuAcara = document.getElementById('waktuAcara').value;
        form.tempatAcara = document.getElementById('tempatAcara').value;
        form.keteranganAcara = document.getElementById('keteranganAcara').value;
      }

      const btn = document.getElementById('btnSimpanRegistrasi');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

      google.script.run
        .withSuccessHandler(function (res) {
          btn.disabled = false;
          btn.innerHTML = '💾 Simpan Registrasi';
          showToast('Surat berhasil diregistrasi dengan No: ' + res.noRegistrasi, 'success');
          document.getElementById('formRegistrasi').reset();
          pilihTipe('');
          loadDashboard();

          if (res.waInfo) {
            setTimeout(function () { tampilkanKonfirmasiNotifWa(res.waInfo, res.noRegistrasi); }, 300);
          }
        })
        .withFailureHandler(function (err) {
          btn.disabled = false;
          btn.innerHTML = '💾 Simpan Registrasi';
          showToast('Gagal menyimpan: ' + err.message, 'error');
        })
        .registerSuratMasuk(CURRENT_USER.token, form);
    });
  }

  /* ============================================================
   *  TRACKING (dalam aplikasi)
   * ============================================================ */

  function statusPillClass(status) {
    if (status === 'Selesai / Disetujui' || status === 'Disetujui') return 'pill-selesai';
    if (status === 'Ditolak') return 'pill-ditolak';
    if (status === 'Perlu Perbaikan') return 'pill-perbaikan';
    if (status === 'Informasi (Tanpa Persetujuan)') return 'pill-info';
    return 'pill-proses';
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnCariTracking') cariTracking();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'inputNoRegTracking' && e.key === 'Enter') cariTracking();
  });

  function cariTracking() {
    const noReg = document.getElementById('inputNoRegTracking').value.trim();
    const box = document.getElementById('hasilTracking');
    if (!noReg) { showToast('Masukkan No Registrasi terlebih dahulu', 'error'); return; }
    box.innerHTML = '<div class="empty-state">Mencari data...</div>';

    google.script.run
      .withSuccessHandler(function (res) {
        if (!res.found) {
          box.innerHTML = '<div class="card"><div class="empty-state">No Registrasi tidak ditemukan.</div></div>';
          return;
        }
        renderTrackingResult(res, box);
      })
      .withFailureHandler(function (err) {
        box.innerHTML = '<div class="card"><div class="empty-state">Terjadi kesalahan: ' + err.message + '</div></div>';
      })
      .getTrackingByNoRegistrasi(noReg);
  }

  function renderTrackingResult(res, box) {
    const s = res.surat;
    let html = '';

    html += '<div class="no-reg-result">';
    html += '  <div class="no">' + s.noRegistrasi + '</div>';
    if (s.perihal) {
      html += '  <div class="perihal">' + s.perihal + '</div>';
    } else if (s.perihalCuplikan) {
      html += '  <div class="perihal">' + s.perihalCuplikan + '</div>';
    }
    html += '  <div class="field-row">';
    if (s.jenisSurat) {
      html += '    <span class="item"><strong>Jenis:</strong> ' + s.jenisSurat + '</span>';
    }
    if (s.suratDariNama) {
      html += '    <span class="item"><strong>Dari:</strong> ' + s.suratDariNama + (s.suratDariTipe ? ' (' + s.suratDariTipe + ')' : '') + '</span>';
    }
    html += '    <span class="item"><strong>Tanggal Masuk:</strong> ' + s.tanggalMasuk + '</span>';
    if (s.tujuanSurat) {
      html += '    <span class="item"><strong>Tujuan:</strong> ' + s.tujuanSurat + '</span>';
    }
    html += '  </div>';
    html += '</div>';

    html += '<div class="card">';
    html += '  <h2>Status Saat Ini</h2>';
    html += '  <p style="font-size:14px;"><span class="pill ' + statusPillClass(s.statusAkhir) + '">' + s.statusAkhir + '</span></p>';
    html += '  <p style="font-size:13px;color:var(--muted);">Posisi surat: <strong>' + res.posisiSaatIni + '</strong></p>';
    html += '</div>';

    if (res.arsipInfo && res.arsipInfo.sudahDiarsipkan) {
      html += '<div class="card" style="background:#eef4fb;">';
      html += '  <h2>📦 Surat Sudah Diarsipkan</h2>';
      html += '  <div class="field-row">';
      html += '    <span class="item"><strong>Tanggal Diarsipkan:</strong> ' + res.arsipInfo.tanggalArsip + '</span>';
      if (res.arsipInfo.kodeLokasi) {
        html += '    <span class="item"><strong>Kode Lokasi:</strong> ' + res.arsipInfo.kodeLokasi + '</span>';
      }
      if (res.arsipInfo.nomorArsip) {
        html += '    <span class="item"><strong>Nomor Arsip:</strong> ' + res.arsipInfo.nomorArsip + '</span>';
      }
      html += '  </div>';
      html += '</div>';
    }

    if (res.undangan) {
      html += '<div class="card">';
      html += '  <h2>Detail Undangan</h2>';
      html += '  <div class="field-row">';
      html += '    <span class="item"><strong>Tanggal:</strong> ' + (res.undangan.tanggalAcara || '-') + '</span>';
      html += '    <span class="item"><strong>Waktu:</strong> ' + (res.undangan.waktu || '-') + '</span>';
      html += '    <span class="item"><strong>Tempat:</strong> ' + (res.undangan.tempat || '-') + '</span>';
      html += '    <span class="item"><strong>Keterangan:</strong> ' + (res.undangan.keterangan || '-') + '</span>';
      html += '  </div>';
      html += '</div>';
    }

    if (res.tracking && res.tracking.length) {
      html += '<div class="card">';
      html += '  <h2>Riwayat &amp; Alur Persetujuan Pimpinan</h2>';
      html += '  <ul class="timeline">';
      res.tracking.forEach(function (t) {
        let dotClass = 'wait';
        if (t.status === 'Disetujui') dotClass = 'done';
        if (t.status === 'Ditolak' || t.status === 'Perlu Perbaikan') dotClass = 'reject';

        html += '<li>';
        html += '  <div class="dot ' + dotClass + '"></div>';
        html += '  <div class="tahap-title">' + t.tahap + ' <span class="pill ' + statusPillClass(t.status) + '" style="margin-left:6px;">' + t.status + '</span></div>';
        html += '  <div class="tahap-meta">' + (t.tanggalProses ? 'Diproses: ' + t.tanggalProses + (t.diprosesOleh ? ' oleh ' + t.diprosesOleh : '') : 'Belum diproses') + '</div>';
        if (t.catatan) html += '<div class="tahap-catatan">' + t.catatan + '</div>';
        html += '</li>';
      });
      html += '  </ul>';
      html += '</div>';
    } else if (s.statusAkhir === 'Informasi (Tanpa Persetujuan)') {
      html += '<div class="card">';
      html += '  <h2>Riwayat &amp; Alur Persetujuan Pimpinan</h2>';
      html += '  <div class="info-box">Surat jenis ini bersifat murni informasi dan tidak memerlukan alur persetujuan pimpinan.</div>';
      html += '</div>';
    }

    if (s.statusAkhir === 'Selesai / Disetujui' || s.statusAkhir === 'Informasi (Tanpa Persetujuan)') {
      html += '<div class="card">';
      html += '  <h2>📦 Konfirmasi Tanda Terima</h2>';
      if (res.tandaTerima && res.tandaTerima.sudahDiambil) {
        html += '  <div class="success-box">✅ Surat telah dikonfirmasi diterima oleh <strong>' + res.tandaTerima.namaPenerima + '</strong> pada tanggal <strong>' + res.tandaTerima.tanggalPengambilan + '</strong>.</div>';
      } else {
        const todayStr = new Date().toLocaleDateString('id-ID');
        html += '  <div class="desc">Surat ini sudah selesai diproses dan siap diambil. Mohon isi konfirmasi berikut saat surat diterima.</div>';
        html += '  <div class="form-grid">';
        html += '    <div><label>Nama Penerima</label><input type="text" class="input-nama-penerima" placeholder="Nama lengkap penerima surat"></div>';
        html += '    <div><label>Tanggal Pengambilan</label><input type="text" value="' + todayStr + '" disabled></div>';
        html += '  </div>';
        html += '  <div class="warn-box tanda-terima-error" style="display:none;margin-top:12px;"></div>';
        html += '  <button type="button" class="btn btn-primary btn-konfirmasi-terima" data-noreg="' + s.noRegistrasi + '" style="margin-top:14px;">✔ Konfirmasi Tanda Terima</button>';
      }
      html += '</div>';
    }

    box.innerHTML = html;
  }

  // Delegasi klik tombol konfirmasi tanda terima (dipakai baik di halaman depan maupun tracking dalam aplikasi)
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-konfirmasi-terima');
    if (!btn) return;

    const noRegistrasi = btn.dataset.noreg;
    const card = btn.closest('.card');
    const inputNama = card.querySelector('.input-nama-penerima');
    const errBox = card.querySelector('.tanda-terima-error');
    const nama = inputNama.value.trim();

    errBox.style.display = 'none';
    if (!nama) {
      errBox.textContent = 'Nama penerima wajib diisi.';
      errBox.style.display = 'block';
      return;
    }

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    google.script.run
      .withSuccessHandler(function (res) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        if (!res.success) {
          errBox.textContent = res.message;
          errBox.style.display = 'block';
          return;
        }
        card.innerHTML =
          '<h2>📦 Konfirmasi Tanda Terima</h2>' +
          '<div class="success-box">✅ Surat telah dikonfirmasi diterima oleh <strong>' + res.namaPenerima + '</strong> pada tanggal <strong>' + res.tanggalPengambilan + '</strong>.</div>';
        showToast('Tanda terima berhasil dikonfirmasi.', 'success');
      })
      .withFailureHandler(function (err) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        errBox.textContent = 'Terjadi kesalahan: ' + err.message;
        errBox.style.display = 'block';
      })
      .simpanTandaTerima(noRegistrasi, nama);
  });

  /* ============================================================
   *  UPDATE DISPOSISI (PIMPINAN)
   * ============================================================ */

  function loadKotakMasukSaya() {
    const box = document.getElementById('kotakMasukSaya');
    const counter = document.getElementById('jumlahKotakMasuk');
    box.innerHTML = '<div class="empty-state">Memuat data...</div>';
    if (counter) counter.textContent = '';

    google.script.run
      .withSuccessHandler(function (list) {
        if (!list.length) {
          box.innerHTML = '<div class="empty-state">Tidak ada surat yang menunggu persetujuan Anda saat ini. 🎉</div>';
          return;
        }
        if (counter) counter.textContent = '(' + list.length + ')';
        box.innerHTML = list.map(function (s) {
          return '<div class="kotak-masuk-row" onclick="bukaDariKotakMasuk(\'' + s.NoRegistrasi + '\')">' +
            '  <div class="kotak-masuk-main">' +
            '    <span class="kotak-masuk-noreg">' + s.NoRegistrasi + '</span>' +
            '    <span class="kotak-masuk-perihal">' + s.Perihal + '</span>' +
            '  </div>' +
            '  <div class="kotak-masuk-side">' +
            '    <span class="pill pill-proses">' + s.TahapMenunggu + '</span>' +
            '    <span class="kotak-masuk-tanggal">' + s.TanggalMasuk + '</span>' +
            '  </div>' +
            '</div>';
        }).join('');
      })
      .withFailureHandler(function (err) {
        box.innerHTML = '<div class="empty-state">Terjadi kesalahan: ' + err.message + '</div>';
      })
      .getSuratMenungguPersetujuan(CURRENT_USER.token);
  }

  function bukaDariKotakMasuk(noReg) {
    document.getElementById('inputNoRegDisposisi').value = noReg;
    cariDisposisi();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnCariDisposisi') cariDisposisi();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'inputNoRegDisposisi' && e.key === 'Enter') cariDisposisi();
  });

  function cariDisposisi() {
    const noReg = document.getElementById('inputNoRegDisposisi').value.trim();
    const box = document.getElementById('hasilDisposisi');
    if (!noReg) { showToast('Masukkan No Registrasi terlebih dahulu', 'error'); return; }
    box.innerHTML = '<div class="empty-state">Mencari data...</div>';

    google.script.run
      .withSuccessHandler(function (res) {
        if (!res.found) {
          box.innerHTML = '<div class="card"><div class="empty-state">No Registrasi tidak ditemukan.</div></div>';
          return;
        }
        renderDisposisiForm(res, box);
      })
      .withFailureHandler(function (err) {
        box.innerHTML = '<div class="card"><div class="empty-state">Terjadi kesalahan: ' + err.message + '</div></div>';
      })
      .getTrackingByNoRegistrasi(noReg);
  }

  function renderDisposisiForm(res, box) {
    const s = res.surat;
    const myRole = CURRENT_USER ? CURRENT_USER.role : '';
    let html = '';

    html += '<div class="no-reg-result">';
    html += '  <div class="no">' + s.noRegistrasi + '</div>';
    html += '  <div class="perihal">' + s.perihal + ' &mdash; ' + s.jenisSurat + '</div>';
    html += '</div>';

    html += '<div class="card"><h2>Tahapan Persetujuan</h2><div class="desc">Tombol aksi aktif untuk tahap yang sesuai dengan role login Anda saat ini (<strong>' + myRole + '</strong>)' + (SUPER_ADMIN_ROLES.indexOf(myRole) !== -1 ? ' &mdash; sebagai <strong>Super Admin</strong>, Anda dapat memproses tahap apa pun.' : '.') + '</div>';

    res.tracking.forEach(function (t) {
      const isMenunggu = (t.status === 'Menunggu');
      const idSafe = t.tahap.replace(/\s+/g,'_') + '-' + s.noRegistrasi.replace(/[^a-zA-Z0-9]/g,'');
      const bolehProses = isMenunggu && tahapCocokDenganRole(t.tahap, myRole);

      html += '<div class="card" style="background:#f8fafc;box-shadow:none;margin-bottom:10px;">';
      html += '  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
      html += '    <div><strong style="color:var(--navy);">' + t.tahap + '</strong> <span class="pill ' + statusPillClass(t.status) + '" style="margin-left:6px;">' + t.status + '</span></div>';
      html += '    <div style="font-size:12px;color:var(--muted);">' + (t.tanggalProses ? 'Diproses: ' + t.tanggalProses : '') + '</div>';
      html += '  </div>';

      if (t.catatan) html += '<div class="tahap-catatan" style="margin-top:8px;">' + t.catatan + '</div>';

      if (isMenunggu) {
        if (bolehProses) {
          html += '  <div style="margin-top:12px;">';
          html += '    <textarea placeholder="Catatan (opsional)" id="catatan-' + idSafe + '"></textarea>';
          html += '    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">';
          html += '      <button class="btn btn-approve" onclick="prosesDisposisi(\'' + s.noRegistrasi + '\',\'' + t.tahap + '\',\'Disetujui\',this)">✔ Setujui</button>';
          html += '      <button class="btn btn-fix" onclick="prosesDisposisi(\'' + s.noRegistrasi + '\',\'' + t.tahap + '\',\'Perlu Perbaikan\',this)">✎ Perlu Perbaikan</button>';
          html += '      <button class="btn btn-reject" onclick="prosesDisposisi(\'' + s.noRegistrasi + '\',\'' + t.tahap + '\',\'Ditolak\',this)">✖ Tolak</button>';
          html += '    </div>';
          html += '  </div>';
        } else {
          html += '  <div class="info-box" style="margin-top:10px;">Tahap ini menunggu persetujuan role <strong>' + (ROLE_UNTUK_TAHAP_CLIENT[t.tahap] || t.tahap) + '</strong>. Tombol aksi tidak aktif untuk role Anda.</div>';
        }
      }
      html += '</div>';
    });

    html += '</div>';
    box.innerHTML = html;
  }

  const ROLE_UNTUK_TAHAP_CLIENT = {
    // Versi baru (registrasi manual)
    'Paraf Asisten': 'Asisten',
    'Paraf Staf Ahli': 'Staf Ahli',
    'Paraf Sekda': 'Sekda',
    'Tanda Tangan Sekda': 'Sekda',
    'Tanda Tangan Wakil Bupati': 'Wakil Bupati',
    'Tanda Tangan Bupati': 'Bupati',
    // Versi lama (kompatibilitas surat yang sudah diregistrasi sebelumnya)
    'Staf Ahli': 'Staf Ahli',
    'Sekda': 'Sekda',
    'Wakil Bupati': 'Wakil Bupati',
    'Bupati': 'Bupati'
  };

  function tahapCocokDenganRole(tahap, role) {
    if (SUPER_ADMIN_ROLES.indexOf(role) !== -1) return true; // Super Admin boleh memproses tahap apa pun
    return ROLE_UNTUK_TAHAP_CLIENT[tahap] === role;
  }

  function prosesDisposisi(noRegistrasi, tahap, status, btnEl) {
    const idSuffix = tahap.replace(/\s+/g,'_') + '-' + noRegistrasi.replace(/[^a-zA-Z0-9]/g,'');
    const catatanEl = document.getElementById('catatan-' + idSuffix);
    const catatan = catatanEl ? catatanEl.value : '';

    const container = btnEl.parentElement;
    const buttons = container ? container.querySelectorAll('button') : [btnEl];
    buttons.forEach(function(b){ b.disabled = true; });

    const payload = { noRegistrasi: noRegistrasi, tahap: tahap, status: status, catatan: catatan };
    kirimProsesDisposisi(payload, buttons);
  }

  // Mengirim permintaan proses disposisi ke server. Dipakai baik untuk klik pertama
  // maupun saat user memilih "Lanjutkan" pada modal konfirmasi lewati tahap.
  function kirimProsesDisposisi(payload, buttons) {
    google.script.run
      .withSuccessHandler(function (res) {
        if (res.perluKonfirmasi) {
          buttons.forEach(function(b){ b.disabled = false; });
          tampilkanKonfirmasiSkip(res, payload, buttons);
          return;
        }

        showToast('Status berhasil diperbarui: ' + payload.status, 'success');

        cariDisposisi();
        loadKotakMasukSaya();
        loadDashboard();

        if (res.waInfo) {
          setTimeout(function () { tampilkanKonfirmasiNotifWa(res.waInfo, payload.noRegistrasi); }, 300);
        }
      })
      .withFailureHandler(function (err) {
        showToast('Gagal memperbarui status: ' + err.message, 'error');
        buttons.forEach(function(b){ b.disabled = false; });
      })
      .updateTrackingStatus(CURRENT_USER.token, payload);
  }

  // Menampilkan modal konfirmasi ketika ada tahap sebelumnya yang belum diproses.
  function tampilkanKonfirmasiSkip(res, payload, buttons) {
    const overlay = document.getElementById('skipConfirmModalOverlay');
    const msg = document.getElementById('skipConfirmMessage');
    msg.textContent = 'Tahap "' + res.tahapTerlewat.join('", "') + '" pada surat ' + payload.noRegistrasi + ' belum diproses oleh pemegang wewenangnya.';

    const btnLanjutkan = document.getElementById('btnLanjutkanSkip');
    const btnBatal = document.getElementById('btnBatalSkip');
    const btnClose = document.getElementById('btnTutupSkipConfirm');

    function tutup() { overlay.classList.remove('show'); }

    // Ganti tombol Lanjutkan dengan salinan baru agar listener lama tidak menumpuk tiap dibuka ulang
    const btnLanjutkanBaru = btnLanjutkan.cloneNode(true);
    btnLanjutkan.parentNode.replaceChild(btnLanjutkanBaru, btnLanjutkan);

    btnLanjutkanBaru.addEventListener('click', function () {
      tutup();
      buttons.forEach(function(b){ b.disabled = true; });
      const payloadLanjut = Object.assign({}, payload, { lewatiKonfirmasi: true });
      kirimProsesDisposisi(payloadLanjut, buttons);
    });
    btnBatal.onclick = tutup;
    btnClose.onclick = tutup;

    overlay.classList.add('show');
  }

  /* ============================================================
   *  MODAL KONFIRMASI NOTIFIKASI WHATSAPP KE PEMOHON
   * ============================================================ */

  function initNotifWaModal() {
    const overlay = document.getElementById('notifWaModalOverlay');
    const btnClose = document.getElementById('btnTutupNotifWa');
    const btnAbaikan = document.getElementById('btnAbaikanNotifWa');
    const btnKirim = document.getElementById('btnKirimNotifWa');
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    function tutup() { overlay.classList.remove('show'); }
    btnClose.addEventListener('click', tutup);
    btnAbaikan.addEventListener('click', tutup);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) tutup(); });

    btnKirim.addEventListener('click', function () {
      const link = btnKirim.dataset.walink;
      if (link) window.open(link, '_blank');
      tutup();
    });
  }

  function tampilkanKonfirmasiNotifWa(waInfo, noRegistrasi) {
    const overlay = document.getElementById('notifWaModalOverlay');
    const btnKirim = document.getElementById('btnKirimNotifWa');
    const warning = document.getElementById('notifWaNoHpWarning');

    document.getElementById('notifWaNoRegistrasi').textContent = noRegistrasi;
    document.getElementById('notifWaPreview').textContent = waInfo.pesan;

    if (waInfo.waLink) {
      btnKirim.dataset.walink = waInfo.waLink;
      btnKirim.disabled = false;
      btnKirim.style.display = 'flex';
      warning.style.display = 'none';
    } else {
      btnKirim.disabled = true;
      btnKirim.style.display = 'none';
      warning.style.display = 'block';
    }

    overlay.classList.add('show');
  }

  /* ============================================================
   *  DASHBOARD (grafik berbasis HTML/CSS murni - tanpa library eksternal)
   * ============================================================ */

  const SPARTA_CHART_PALETTE = ['#0a2540', '#b8862e', '#7a1f24', '#1c6b46', '#1c4570', '#9c6b12', '#a02e26', '#dfb45f', '#4a6b8a', '#c98f6f'];

  // Grafik batang VERTIKAL sederhana (dipakai untuk "Surat Masuk per Bulan").
  function renderVBarChart(container, items, warna) {
    if (!items.length) {
      container.innerHTML = '<div class="empty-state">Belum ada data.</div>';
      return;
    }
    const maks = Math.max.apply(null, items.map(function (i) { return i.jumlah; }).concat([1]));
    const bars = items.map(function (i) {
      const pct = Math.max(Math.round((i.jumlah / maks) * 100), i.jumlah > 0 ? 4 : 0);
      return '<div class="vbar-item" style="height:' + pct + '%;background:' + (warna || 'linear-gradient(180deg, var(--navy-light), var(--navy))') + ';">' +
        '<span class="vbar-value">' + i.jumlah + '</span>' +
        '</div>';
    }).join('');
    const labels = items.map(function (i) { return '<span>' + i.label + '</span>'; }).join('');
    container.innerHTML =
      '<div class="vbar-chart">' +
      '  <div class="vbar-chart-bars">' + bars + '</div>' +
      '  <div class="vbar-chart-labels">' + labels + '</div>' +
      '</div>';
  }

  // Grafik DONAT (conic-gradient CSS) dengan legenda - dipakai untuk distribusi kategori.
  function renderDonutChart(container, items, labelKey, jumlahKey) {
    if (!items.length) {
      container.innerHTML = '<div class="empty-state">Belum ada data.</div>';
      return;
    }
    const total = items.reduce(function (sum, i) { return sum + i[jumlahKey]; }, 0);
    let kumulatif = 0;
    const stops = items.map(function (i, idx) {
      const warna = SPARTA_CHART_PALETTE[idx % SPARTA_CHART_PALETTE.length];
      const awal = total > 0 ? (kumulatif / total) * 100 : 0;
      kumulatif += i[jumlahKey];
      const akhir = total > 0 ? (kumulatif / total) * 100 : 0;
      return warna + ' ' + awal.toFixed(2) + '% ' + akhir.toFixed(2) + '%';
    }).join(', ');

    const legend = items.map(function (i, idx) {
      const warna = SPARTA_CHART_PALETTE[idx % SPARTA_CHART_PALETTE.length];
      return '<div class="donut-legend-item"><span class="dot" style="background:' + warna + ';"></span>' + i[labelKey] + ' (' + i[jumlahKey] + ')</div>';
    }).join('');

    container.innerHTML =
      '<div class="donut-chart-wrap">' +
      '  <div class="donut-chart" style="background:conic-gradient(' + stops + ');">' +
      '    <div class="donut-hole">' + total + '<br>Total</div>' +
      '  </div>' +
      '  <div class="donut-legend">' + legend + '</div>' +
      '</div>';
  }

  // Grafik batang HORIZONTAL - dipakai untuk "Tahap Menunggu" dan "Kapasitas Lokasi".
  // getWarna(item) opsional: fungsi untuk menentukan warna batang per baris (mis. sesuai persentase kapasitas).
  function renderHBarChart(container, items, labelFn, valueFn, displayFn, getWarna) {
    if (!items.length) {
      container.innerHTML = '<div class="empty-state">Belum ada data.</div>';
      return;
    }
    const maks = Math.max.apply(null, items.map(valueFn).concat([1]));
    container.innerHTML = items.map(function (i) {
      const nilai = valueFn(i);
      const pct = Math.max(Math.round((nilai / maks) * 100), nilai > 0 ? 3 : 0);
      const warna = getWarna ? getWarna(i) : 'var(--navy)';
      return '<div class="hbar-row">' +
        '  <div class="hbar-label">' + labelFn(i) + '</div>' +
        '  <div class="hbar-track"><div class="hbar-fill" style="width:' + pct + '%;background:' + warna + ';"></div></div>' +
        '  <div class="hbar-value">' + displayFn(i) + '</div>' +
        '</div>';
    }).join('');
  }

  // Grid #statsGrid pakai auto-fit (grid-template-columns:repeat(auto-fit,minmax(...))),
  // jadi jumlah kolom yang benar-benar dirender itu dinamis sesuai lebar layar - tidak bisa
  // diandalkan lewat trik CSS "grid-column:auto/-1" saja (tidak konsisten di grid implisit).
  // Di sini kita baca langsung grid-template-columns yang SUDAH dihitung peramban, lalu
  // rentangkan kotak "Persentase Selesai" (selalu elemen terakhir) sampai ke ujung baris.
  function sesuaikanLebarKotakPersentase() {
    const grid = document.getElementById('statsGrid');
    if (!grid) return;
    const box = grid.querySelector('.progress-stat-box');
    if (!box) return;

    // "grid-column: auto / N" TERNYATA bukan berarti "rentangkan dari posisi alami sampai
    // kolom N" - kalau start-nya auto dan end-nya angka pasti, CSS Grid otomatis memakai
    // span 1 (cuma selebar 1 kolom, pas sebelum garis N). Supaya benar-benar merentang
    // mengisi sisa baris, harus pakai "span N" dengan N dihitung manual dari posisi kotak
    // ini di barisnya (bukan lewat garis akhir eksplisit).
    const lebarTrack = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).map(parseFloat);
    const kolom = lebarTrack.filter(function (w) { return w > 1; }).length;
    if (kolom <= 1) { box.style.gridColumn = ''; return; }

    const semuaKotak = Array.prototype.slice.call(grid.children);
    const indexKotak = semuaKotak.indexOf(box); // kotak ini selalu elemen terakhir yang ditambahkan
    const posisiDiBaris = indexKotak % kolom;    // 0 = awal baris
    const sisaKolom = kolom - posisiDiBaris;     // berapa kolom tersisa di baris itu

    box.style.gridColumn = 'span ' + sisaKolom;
  }

  function loadDashboard() {
    const grid = document.getElementById('statsGrid');

    google.script.run
      .withSuccessHandler(function (stats) {
        grid.innerHTML =
          '<div class="stat-box stat-box-clickable" onclick="bukaDaftarSuratStatus(null)"><div class="num">' + stats.total + '</div><div class="label">Total Surat</div></div>' +
          '<div class="stat-box amber stat-box-clickable" onclick="bukaDaftarSuratStatus(\'Dalam Proses\')"><div class="num">' + stats.dalamProses + '</div><div class="label">Dalam Proses</div></div>' +
          '<div class="stat-box green stat-box-clickable" onclick="bukaDaftarSuratStatus(\'Selesai / Disetujui\')"><div class="num">' + stats.disetujui + '</div><div class="label">Selesai / Disetujui</div></div>' +
          '<div class="stat-box red stat-box-clickable" onclick="bukaDaftarSuratStatus(\'DITOLAK_PERBAIKAN\')"><div class="num">' + (stats.ditolak + stats.perbaikan) + '</div><div class="label">Ditolak / Perlu Perbaikan</div></div>' +
          '<div class="stat-box stat-box-clickable" style="border-left-color:var(--navy-light);" onclick="bukaDaftarSuratStatus(\'Informasi (Tanpa Persetujuan)\')"><div class="num" style="color:var(--navy-light);">' + (stats.informasi || 0) + '</div><div class="label">Informasi (Undangan/Lainnya)</div></div>';

        // Admin TU juga mengelola Pengarsipan, jadi tampilkan ringkasan "Siap Diarsipkan" di dashboard utama.
        if (CURRENT_USER && CURRENT_USER.role === 'Admin TU') {
          grid.innerHTML += '<div class="stat-box stat-box-clickable" style="border-left-color:var(--gold);" onclick="bukaMenuArsip(\'arsip\')"><div class="num" style="color:var(--gold);" id="statSiapArsipNum">-</div><div class="label">🗄️ Siap Diarsipkan</div></div>';
          google.script.run
            .withSuccessHandler(function (arsipStats) {
              const el = document.getElementById('statSiapArsipNum');
              if (el) el.textContent = arsipStats.siapDiarsipkan;
            })
            .withFailureHandler(function () { /* diamkan - tidak kritikal untuk dashboard utama */ })
            .getDashboardArsipStats(CURRENT_USER.token);
        }

        // Kotak "Persentase Penyelesaian" versi ringkas - seukuran kotak statistik lain,
        // supaya sejajar rapi dengan "Siap Diarsipkan" alih-alih jadi kartu besar terpisah.
        const persen = stats.total > 0 ? Math.round((stats.disetujui / stats.total) * 100) : 0;
        grid.innerHTML +=
          '<div class="stat-box progress-stat-box" style="border-left-color:var(--gold);">' +
          '  <div class="progress-mini-header"><span class="label">Persentase Selesai</span><span class="progress-percent-mini">' + persen + '%</span></div>' +
          '  <div class="progress-track-mini"><div class="progress-fill-mini" style="width:' + persen + '%;"></div></div>' +
          '  <div class="tahap-meta" style="margin-top:8px;">' + stats.disetujui + ' dari ' + stats.total + ' surat selesai</div>' +
          '</div>';

        // Grid ini pakai auto-fit, jadi jumlah kolom sebenarnya berubah-ubah sesuai lebar layar.
        // Hitung langsung dari kolom yang benar-benar dirender, baru rentangkan kotak persentase
        // (elemen terakhir) sampai ke ujung baris - supaya tidak ada ruang kosong tersisa.
        requestAnimationFrame(function () { sesuaikanLebarKotakPersentase(); });

        const boxBulan = document.getElementById('chartBulanSurat');
        if (boxBulan) renderVBarChart(boxBulan, stats.perBulan.map(function (b) { return { label: b.label, jumlah: b.jumlah }; }));

        const boxJenis = document.getElementById('chartJenisSurat');
        if (boxJenis) renderDonutChart(boxJenis, stats.perJenisSurat, 'jenis', 'jumlah');

        const boxTahap = document.getElementById('chartTahapMenunggu');
        if (boxTahap) {
          if (!stats.tahapMenunggu.length) {
            boxTahap.innerHTML = '<div class="empty-state">Tidak ada surat yang sedang menunggu persetujuan. 🎉</div>';
          } else {
            renderHBarChart(
              boxTahap, stats.tahapMenunggu,
              function (t) { return t.tahap; },
              function (t) { return t.jumlah; },
              function (t) { return t.jumlah; },
              function () { return 'var(--gold)'; }
            );
          }
        }
      })
      .withFailureHandler(function (err) {
        grid.innerHTML = '<div class="warn-box">Gagal memuat statistik: ' + err.message + '</div>';
      })
      .getDashboardStats(CURRENT_USER.token);
  }

  /* ============================================================
   *  DAFTAR SURAT MASUK (semua data, bisa dicari)
   * ============================================================ */

  let DAFTAR_SURAT_CACHE = [];
  let FILTER_BULAN_SEMUA_SURAT = ''; // '' = semua | 'yyyy-M' (mis. '2026-7') | 'kosong' = tanggal tidak terbaca
  const NAMA_BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  let STATUS_FILTER_AKTIF = null; // null | 'Dalam Proses' | 'Selesai / Disetujui' | 'DITOLAK_PERBAIKAN' | 'Informasi (Tanpa Persetujuan)'

  // Kunci bulan 'yyyy-M' sebuah surat. Memakai BulanKey dari server; bila belum ada (data cache lama), turunkan dari teks d/M/yyyy.
  function bulanKeySurat(s) {
    if (s.BulanKey !== undefined) return s.BulanKey || '';
    const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s.TanggalMasuk || '');
    return m ? (m[3] + '-' + Number(m[2])) : '';
  }

  // Isi pilihan Filter Bulan dari SELURUH data yang diterima dari server (bukan dari baris yang tampil).
  function isiOpsiFilterBulanSemuaSurat() {
    const sel = document.getElementById('filterBulanSemuaSurat');
    if (!sel) return;
    const ada = {}; let adaKosong = false;
    DAFTAR_SURAT_CACHE.forEach(function (s) {
      const k = bulanKeySurat(s);
      if (k) ada[k] = true; else adaKosong = true;
    });
    const keys = Object.keys(ada).sort(function (a, b) {
      const pa = a.split('-'), pb = b.split('-');
      return (Number(pb[0]) - Number(pa[0])) || (Number(pb[1]) - Number(pa[1]));
    });
    let html = '<option value="">Semua Bulan</option>';
    keys.forEach(function (k) {
      const p = k.split('-');
      html += '<option value="' + k + '">' + NAMA_BULAN_ID[Number(p[1]) - 1] + ' ' + p[0] + '</option>';
    });
    if (adaKosong) html += '<option value="kosong">(Tanggal tidak terbaca)</option>';
    sel.innerHTML = html;
    if (FILTER_BULAN_SEMUA_SURAT && (ada[FILTER_BULAN_SEMUA_SURAT] || (FILTER_BULAN_SEMUA_SURAT === 'kosong' && adaKosong))) {
      sel.value = FILTER_BULAN_SEMUA_SURAT;
    } else {
      FILTER_BULAN_SEMUA_SURAT = '';
      sel.value = '';
    }
  }

  function loadDaftarSuratMasuk() {
    const tbody = document.querySelector('#tabelSemuaSurat tbody');
    const counter = document.getElementById('jumlahSemuaSurat');
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Memuat data...</td></tr>';

    google.script.run
      .withSuccessHandler(function (list) {
        DAFTAR_SURAT_CACHE = list || [];
        isiOpsiFilterBulanSemuaSurat();
        terapkanFilterSemuaSurat();
      })
      .withFailureHandler(function (err) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Gagal memuat data: ' + err.message + '</td></tr>';
        if (counter) counter.textContent = '';
      })
      .getAllSurat(CURRENT_USER.token);
  }

  // Dipanggil dari kartu statistik Dashboard - membuka Daftar Surat Masuk dengan status tertentu terfilter.
  function bukaDaftarSuratStatus(statusFilter) {
    STATUS_FILTER_AKTIF = statusFilter;
    const navItem = document.querySelector('.nav-item[data-page="semuasurat"]');
    if (navItem) navItem.click();
  }

  function labelFilterStatus(f) {
    if (f === 'DITOLAK_PERBAIKAN') return 'Ditolak / Perlu Perbaikan';
    return f;
  }

  function terapkanFilterSemuaSurat() {
    const counter = document.getElementById('jumlahSemuaSurat');
    const chip = document.getElementById('filterStatusChip');
    const searchInput = document.getElementById('cariSemuaSurat');

    let list = DAFTAR_SURAT_CACHE;
    if (STATUS_FILTER_AKTIF === 'DITOLAK_PERBAIKAN') {
      list = list.filter(function (s) { return s.StatusAkhir === 'Ditolak' || s.StatusAkhir === 'Perlu Perbaikan'; });
    } else if (STATUS_FILTER_AKTIF) {
      list = list.filter(function (s) { return s.StatusAkhir === STATUS_FILTER_AKTIF; });
    }

    // Filter Bulan
    if (FILTER_BULAN_SEMUA_SURAT === 'kosong') {
      list = list.filter(function (s) { return !bulanKeySurat(s); });
    } else if (FILTER_BULAN_SEMUA_SURAT) {
      list = list.filter(function (s) { return bulanKeySurat(s) === FILTER_BULAN_SEMUA_SURAT; });
    }

    // Terapkan juga kata kunci pencarian teks (kalau ada) di atas hasil filter status
    const kw = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (kw) {
      list = list.filter(function (s) {
        return (s.NoRegistrasi + ' ' + s.Perihal + ' ' + s.SuratDariNama + ' ' + s.NoSurat + ' ' + s.JenisSurat + ' ' + s.StatusAkhir)
          .toLowerCase().indexOf(kw) !== -1;
      });
    }

    if (chip) {
      if (STATUS_FILTER_AKTIF) {
        chip.style.display = 'inline-flex';
        chip.querySelector('.chip-label').textContent = labelFilterStatus(STATUS_FILTER_AKTIF);
      } else {
        chip.style.display = 'none';
      }
    }
    if (counter) counter.textContent = 'Total: ' + list.length + ' surat' + ((STATUS_FILTER_AKTIF || FILTER_BULAN_SEMUA_SURAT) ? ' (terfilter)' : '');

    renderTabelSemuaSurat(list);
  }

  function renderTabelSemuaSurat(list) {
    const tbody = document.querySelector('#tabelSemuaSurat tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Tidak ada data yang cocok.</td></tr>';
      return;
    }
    const bisaKelola = CURRENT_USER && CURRENT_USER.role === 'Admin TU';
    tbody.innerHTML = list.map(function (s) {
      const noRegEsc = s.NoRegistrasi.replace(/'/g, "\\'");
      const aksi = bisaKelola
        ? '<div style="display:flex;gap:6px;">' +
            '<button class="btn btn-outline btn-sm" onclick="bukaEditSurat(\'' + noRegEsc + '\')">✏️ Edit</button>' +
            '<button class="btn btn-reject btn-sm" onclick="hapusSuratMasuk(\'' + noRegEsc + '\')">🗑️ Hapus</button>' +
          '</div>'
        : '<span class="tahap-meta">-</span>';
      return '<tr>' +
        '<td>' + s.NoRegistrasi + '</td>' +
        '<td>' + s.TanggalMasuk + '</td>' +
        '<td>' + s.SuratDariNama + ' <span class="tahap-meta">(' + s.SuratDariTipe + ')</span></td>' +
        '<td>' + s.NoSurat + '</td>' +
        '<td>' + s.Perihal + '</td>' +
        '<td>' + s.JenisSurat + '</td>' +
        '<td>' + s.TujuanSurat + '</td>' +
        '<td><span class="pill ' + statusPillClass(s.StatusAkhir) + '">' + s.StatusAkhir + '</span></td>' +
        '<td>' + aksi + '</td>' +
        '</tr>';
    }).join('');
  }

  /* ============================================================
   *  SURAT SELESAI (tanggal selesai & status pengambilan)
   * ============================================================ */

  let SURAT_SELESAI_CACHE = [];

  function loadSuratSelesai() {
    const tbody = document.querySelector('#tabelSuratSelesai tbody');
    const counter = document.getElementById('jumlahSuratSelesai');
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Memuat data...</td></tr>';
    if (counter) counter.textContent = '';

    google.script.run
      .withSuccessHandler(function (list) {
        try {
          SURAT_SELESAI_CACHE = list || [];
          if (counter) counter.textContent = 'Total: ' + SURAT_SELESAI_CACHE.length + ' surat';
          renderTabelSuratSelesai(SURAT_SELESAI_CACHE);
        } catch (clientErr) {
          console.error('Error render Surat Selesai:', clientErr);
          tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Terjadi kesalahan saat menampilkan data: ' + clientErr.message + '</td></tr>';
        }
      })
      .withFailureHandler(function (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Gagal memuat data: ' + err.message + '</td></tr>';
        if (counter) counter.textContent = '';
      })
      .getSuratSelesai(CURRENT_USER.token);
  }

  function renderTabelSuratSelesai(list) {
    const tbody = document.querySelector('#tabelSuratSelesai tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Belum ada surat yang selesai.</td></tr>';
      return;
    }
    const isAdmin = CURRENT_USER && CURRENT_USER.role === 'Admin TU';
    tbody.innerHTML = list.map(function (s) {
      const pengambilan = s.SudahDiambil
        ? '<span class="pill pill-selesai">Sudah Diambil</span>'
        : '<span class="pill pill-proses">Belum Diambil</span>';
      const noRegEsc = s.NoRegistrasi.replace(/'/g, "\\'");
      const perihalEsc = s.Perihal.replace(/'/g, "\\'");

      let aksi = '';
      if (isAdmin) {
        const tombol = [];
        if (!s.SudahDiambil) {
          tombol.push('<button class="btn btn-primary btn-sm" onclick="bukaKonfirmasiDiambilAdmin(\'' + noRegEsc + '\')">📦 Sudah Diambil</button>');
        }
        // Arsipkan hanya untuk surat berstatus Selesai (bukan Informasi/Undangan/Lainnya),
        // dan hanya kalau belum diarsipkan maupun belum diambil - sama seperti aturan di menu Pengarsipan.
        if (s.StatusAkhir === 'Selesai / Disetujui' && !s.SudahArsipkan && !s.SudahDiambil) {
          tombol.push('<button class="btn btn-outline btn-sm" onclick="bukaModalArsipkan(\'' + noRegEsc + '\', \'' + perihalEsc + '\')">🗄️ Arsipkan</button>');
        }
        if (s.SudahArsipkan) {
          tombol.push('<span class="pill pill-info">Sudah Diarsipkan</span>');
        }
        aksi = tombol.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + tombol.join('') + '</div>' : '<span class="tahap-meta">-</span>';
      } else {
        aksi = '<span class="tahap-meta">-</span>';
      }

      return '<tr>' +
        '<td>' + s.NoRegistrasi + '</td>' +
        '<td>' + s.Perihal + '</td>' +
        '<td>' + s.JenisSurat + '</td>' +
        '<td><span class="pill ' + statusPillClass(s.StatusAkhir) + '">' + s.StatusAkhir + '</span></td>' +
        '<td>' + s.TanggalSelesai + '</td>' +
        '<td>' + pengambilan + '</td>' +
        '<td>' + s.NamaPenerima + (s.SudahDiambil ? ' <span class="tahap-meta">(' + s.TanggalPengambilan + ')</span>' : '') + '</td>' +
        '<td class="col-aksi">' + aksi + '</td>' +
        '</tr>';
    }).join('');
  }

  // Admin TU bisa langsung mencatat "sudah diambil" dari sini (mis. pemohon mengambil langsung
  // secara fisik di kantor), tanpa mengharuskan pemohon konfirmasi sendiri lewat halaman Tracking publik.
  function bukaKonfirmasiDiambilAdmin(noRegistrasi) {
    const nama = window.prompt('Nama penerima yang mengambil surat ' + noRegistrasi + ':');
    if (nama === null) return; // dibatalkan
    if (!nama.trim()) { showToast('Nama penerima wajib diisi.', 'error'); return; }

    google.script.run
      .withSuccessHandler(function (res) {
        if (!res.success) { showToast(res.message || 'Gagal menyimpan konfirmasi.', 'error'); return; }
        showToast('Tanda terima berhasil dicatat.', 'success');
        loadSuratSelesai();
        loadDashboard();
      })
      .withFailureHandler(function (err) {
        showToast('Gagal menyimpan konfirmasi: ' + err.message, 'error');
      })
      .simpanTandaTerima(noRegistrasi, nama.trim());
  }

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'cariSuratSelesai') {
      const kw = e.target.value.trim().toLowerCase();
      if (!kw) { renderTabelSuratSelesai(SURAT_SELESAI_CACHE); return; }
      const filtered = SURAT_SELESAI_CACHE.filter(function (s) {
        return (s.NoRegistrasi + ' ' + s.Perihal + ' ' + s.NamaPenerima + ' ' + s.JenisSurat)
          .toLowerCase().indexOf(kw) !== -1;
      });
      renderTabelSuratSelesai(filtered);
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnRefreshSuratSelesai') loadSuratSelesai();
  });

  /* ============================================================
   *  ARSIP DOKUMEN (khusus role "Petugas Arsip")
   * ============================================================ */

  let SIAP_ARSIP_CACHE = [];
  let DAFTAR_ARSIP_CACHE = [];
  let KATEGORI_ARSIP_CACHE = [];
  let LOKASI_ARSIP_CACHE = [];

  function loadHalamanArsip() {
    loadSuratSiapArsip();
    loadDaftarArsip();
    google.script.run
      .withSuccessHandler(function (list) { KATEGORI_ARSIP_CACHE = list || []; })
      .withFailureHandler(function () { /* diamkan - field tetap bisa diketik manual */ })
      .getMasterKategoriArsip(CURRENT_USER.token);
  }

  function loadSuratSiapArsip() {
    const tbody = document.querySelector('#tabelSiapArsip tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Memuat data...</td></tr>';

    google.script.run
      .withSuccessHandler(function (list) {
        SIAP_ARSIP_CACHE = list || [];
        renderTabelSiapArsip(SIAP_ARSIP_CACHE);
      })
      .withFailureHandler(function (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Gagal memuat data: ' + err.message + '</td></tr>';
      })
      .getSuratSiapArsip(CURRENT_USER.token);
  }

  function renderTabelSiapArsip(list) {
    const tbody = document.querySelector('#tabelSiapArsip tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Semua surat yang sudah selesai sudah diarsipkan. 🎉</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (s) {
      const noRegEsc = s.NoRegistrasi.replace(/'/g, "\\'");
      const perihalEsc = s.Perihal.replace(/'/g, "\\'");
      const aksi = '<button class="btn btn-primary btn-sm" onclick="bukaModalArsipkan(\'' + noRegEsc + '\', \'' + perihalEsc + '\')">🗄️ Arsipkan</button>';
      return '<tr>' +
        '<td>' + s.NoRegistrasi + '</td>' +
        '<td>' + s.Perihal + '</td>' +
        '<td>' + s.JenisSurat + '</td>' +
        '<td><span class="pill ' + statusPillClass(s.StatusAkhir) + '">' + s.StatusAkhir + '</span></td>' +
        '<td>' + s.TanggalMasuk + '</td>' +
        '<td>' + aksi + '</td>' +
        '</tr>';
    }).join('');
  }

  function loadDaftarArsip() {
    const tbody = document.querySelector('#tabelArsip tbody');
    const counter = document.getElementById('jumlahArsip');
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Memuat data...</td></tr>';
    if (counter) counter.textContent = '';

    google.script.run
      .withSuccessHandler(function (list) {
        DAFTAR_ARSIP_CACHE = list || [];
        if (counter) counter.textContent = 'Total: ' + DAFTAR_ARSIP_CACHE.length + ' arsip';
        renderTabelArsip(DAFTAR_ARSIP_CACHE);
      })
      .withFailureHandler(function (err) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Gagal memuat data: ' + err.message + '</td></tr>';
        if (counter) counter.textContent = '';
      })
      .getDaftarArsip(CURRENT_USER.token);
  }

  function renderTabelArsip(list) {
    const tbody = document.querySelector('#tabelArsip tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Belum ada surat yang diarsipkan.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (s) {
      const arsipIdEsc = s.ArsipId.replace(/'/g, "\\'");
      const aksi = '<button class="btn btn-reject btn-sm" onclick="batalkanArsipUi(\'' + arsipIdEsc + '\')">↩️ Batalkan</button>';
      const sumberPill = s.Sumber === 'Manual'
        ? '<span class="pill pill-info">Manual</span>'
        : '<span class="pill pill-selesai">Sistem</span>';
      return '<tr>' +
        '<td>' + (s.NoRegistrasi || '-') + '</td>' +
        '<td>' + (s.NomorArsip || '-') + '</td>' +
        '<td>' + s.Perihal + '</td>' +
        '<td>' + s.KategoriArsip + '</td>' +
        '<td>' + (s.KodeLokasi || '-') + '</td>' +
        '<td>' + s.TanggalArsip + '</td>' +
        '<td>' + sumberPill + '</td>' +
        '<td>' + s.DiarsipkanOleh + '</td>' +
        '<td>' + aksi + '</td>' +
        '</tr>';
    }).join('');
  }

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'cariArsip') {
      const kw = e.target.value.trim().toLowerCase();
      if (!kw) { renderTabelArsip(DAFTAR_ARSIP_CACHE); return; }
      const filtered = DAFTAR_ARSIP_CACHE.filter(function (s) {
        return (s.NoRegistrasi + ' ' + s.Perihal + ' ' + s.NomorArsip + ' ' + s.KategoriArsip + ' ' + s.KodeLokasi)
          .toLowerCase().indexOf(kw) !== -1;
      });
      renderTabelArsip(filtered);
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnRefreshArsip') loadDaftarArsip();
  });

  // Mengisi ulang dropdown "Kode Lokasi" pada kedua modal (Arsipkan & Tambah Manual) dari cache terbaru.
  function isiPilihanLokasiArsip() {
    const opsi = '<option value="">-- Belum ditentukan --</option>' + LOKASI_ARSIP_CACHE.map(function (l) {
      return '<option value="' + l.KodeLokasi + '">' + l.KodeLokasi + ' - ' + l.NamaLokasi + ' (' + l.Terpakai + '/' + l.KapasitasMaksimal + ')</option>';
    }).join('');
    const selArsip = document.getElementById('arsipKodeLokasi');
    const selManual = document.getElementById('manualKodeLokasi');
    if (selArsip) selArsip.innerHTML = opsi;
    if (selManual) selManual.innerHTML = opsi;
  }

  // Dipanggil dari tombol "Arsipkan" pada tabel Surat Siap Diarsipkan.
  function bukaModalArsipkan(noRegistrasi, perihal) {
    const overlay = document.getElementById('arsipkanModalOverlay');
    document.getElementById('arsipNoRegistrasi').value = noRegistrasi;
    document.getElementById('arsipkanInfoSurat').textContent = noRegistrasi + ' — ' + perihal;
    document.getElementById('arsipNomorArsip').value = '';
    document.getElementById('arsipKodeLokasi').value = '';
    document.getElementById('arsipKategoriArsip').value = '';
    document.getElementById('arsipKeterangan').value = '';

    // Kalau modal ini dibuka dari halaman yang belum pernah memuat data lokasi/kategori
    // (mis. Admin TU langsung dari Surat Selesai, tanpa mampir ke menu Pengarsipan dulu),
    // pastikan cache-nya dimuat dulu supaya dropdown Kode Lokasi & saran kategori tidak kosong.
    if (!LOKASI_ARSIP_CACHE.length) loadDaftarLokasiArsip();
    if (!KATEGORI_ARSIP_CACHE.length) {
      google.script.run
        .withSuccessHandler(function (list) { KATEGORI_ARSIP_CACHE = list || []; })
        .withFailureHandler(function () { /* diamkan - field tetap bisa diketik manual */ })
        .getMasterKategoriArsip(CURRENT_USER.token);
    }

    isiPilihanLokasiArsip();
    initKategoriArsipAutocomplete('arsipKategoriArsip');
    overlay.classList.add('show');
  }

  // Komponen autocomplete kustom untuk Kategori Arsip (mirip pola SKPD) - saran berdasarkan
  // kategori yang pernah dipakai sebelumnya, tapi tetap bebas diketik manual.
  function initKategoriArsipAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.acBound === '1') return;
    input.dataset.acBound = '1';

    const parent = input.parentElement;
    parent.style.position = 'relative';

    const box = document.createElement('div');
    box.className = 'skpd-suggest-box';
    parent.appendChild(box);

    function render(filterText) {
      const kw = (filterText || '').trim().toLowerCase();
      const matches = KATEGORI_ARSIP_CACHE.filter(function (n) {
        return !kw || n.toLowerCase().indexOf(kw) !== -1;
      });
      if (!matches.length) { box.classList.remove('show'); return; }
      box.innerHTML = matches.map(function (n) {
        return '<div class="skpd-suggest-item">' + n.replace(/</g, '&lt;') + '</div>';
      }).join('');
      box.classList.add('show');
    }

    input.addEventListener('focus', function () { render(input.value); });
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('blur', function () { setTimeout(function () { box.classList.remove('show'); }, 150); });

    box.addEventListener('mousedown', function (e) {
      const item = e.target.closest('.skpd-suggest-item');
      if (!item) return;
      input.value = item.textContent;
      box.classList.remove('show');
    });
  }

  function initArsipkanModal() {
    const overlay = document.getElementById('arsipkanModalOverlay');
    const btnClose = document.getElementById('btnTutupArsipkan');
    const btnBatal = document.getElementById('btnBatalArsipkan');
    const btnSimpan = document.getElementById('btnSimpanArsip');
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    function tutup() { overlay.classList.remove('show'); }
    btnClose.addEventListener('click', tutup);
    btnBatal.addEventListener('click', tutup);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) tutup(); });

    btnSimpan.addEventListener('click', function () {
      const kategori = document.getElementById('arsipKategoriArsip').value.trim();
      if (!kategori) {
        showToast('Kategori arsip wajib diisi.', 'error');
        return;
      }

      const payload = {
        noRegistrasi: document.getElementById('arsipNoRegistrasi').value,
        nomorArsip: document.getElementById('arsipNomorArsip').value.trim(),
        kategoriArsip: kategori,
        kodeLokasi: document.getElementById('arsipKodeLokasi').value,
        keterangan: document.getElementById('arsipKeterangan').value.trim()
      };

      btnSimpan.disabled = true;
      btnSimpan.innerHTML = '<span class="spinner"></span> Menyimpan...';

      google.script.run
        .withSuccessHandler(function () {
          btnSimpan.disabled = false;
          btnSimpan.innerHTML = '💾 Simpan Arsip';
          showToast('Surat berhasil diarsipkan.', 'success');
          tutup();
          loadSuratSiapArsip();
          loadDaftarArsip();
          loadDaftarLokasiArsip();
          loadSuratSelesai();
          loadDashboard();
        })
        .withFailureHandler(function (err) {
          btnSimpan.disabled = false;
          btnSimpan.innerHTML = '💾 Simpan Arsip';
          showToast('Gagal menyimpan arsip: ' + err.message, 'error');
        })
        .arsipkanSurat(CURRENT_USER.token, payload);
    });
  }

  function batalkanArsipUi(arsipId) {
    if (!window.confirm('Batalkan/hapus data arsip ini? Kalau berasal dari sistem persuratan, suratnya akan kembali muncul di daftar "Siap Diarsipkan".')) return;

    google.script.run
      .withSuccessHandler(function (res) {
        showToast(res.message || 'Arsip berhasil dibatalkan.', 'success');
        loadSuratSiapArsip();
        loadDaftarArsip();
        loadDaftarLokasiArsip();
      })
      .withFailureHandler(function (err) {
        showToast('Gagal membatalkan arsip: ' + err.message, 'error');
      })
      .batalkanArsip(CURRENT_USER.token, arsipId);
  }

  /* ============================================================
   *  CARI DOKUMEN (mengetahui lokasi penyimpanan fisik arsip)
   * ============================================================ */

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnCariLokasi') jalankanCariLokasi();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'cariLokasiKeyword' && e.key === 'Enter') jalankanCariLokasi();
  });

  function jalankanCariLokasi() {
    const kw = document.getElementById('cariLokasiKeyword').value.trim().toLowerCase();
    const box = document.getElementById('hasilCariLokasi');
    if (!kw) { showToast('Ketik kata kunci pencarian terlebih dahulu.', 'error'); return; }

    // Pastikan data arsip & lokasi terbaru sebelum mencari (kalau belum sempat termuat).
    if (!DAFTAR_ARSIP_CACHE.length) {
      box.innerHTML = '<div class="empty-state">Memuat data...</div>';
      google.script.run
        .withSuccessHandler(function (list) {
          DAFTAR_ARSIP_CACHE = list || [];
          renderHasilCariLokasi(kw, box);
        })
        .withFailureHandler(function (err) {
          box.innerHTML = '<div class="empty-state">Gagal memuat data: ' + err.message + '</div>';
        })
        .getDaftarArsip(CURRENT_USER.token);
    } else {
      renderHasilCariLokasi(kw, box);
    }
  }

  function renderHasilCariLokasi(kw, box) {
    const hasil = DAFTAR_ARSIP_CACHE.filter(function (s) {
      return (s.NoRegistrasi + ' ' + s.Perihal + ' ' + s.NomorArsip + ' ' + s.KategoriArsip + ' ' + s.NoSurat)
        .toLowerCase().indexOf(kw) !== -1;
    });

    if (!hasil.length) {
      box.innerHTML = '<div class="empty-state">Tidak ditemukan dokumen yang cocok dengan kata kunci tersebut.</div>';
      return;
    }

    const lokasiMap = {};
    LOKASI_ARSIP_CACHE.forEach(function (l) { lokasiMap[l.KodeLokasi] = l.NamaLokasi; });

    box.innerHTML = '<div class="desc" style="margin-bottom:12px;">Ditemukan ' + hasil.length + ' dokumen.</div>' +
      hasil.map(function (s) {
        const punyaLokasi = !!s.KodeLokasi;
        const namaLokasi = punyaLokasi ? (lokasiMap[s.KodeLokasi] || '') : '';
        return '<div class="card" style="background:#f8fafc;box-shadow:none;margin-bottom:12px;">' +
          '  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:flex-start;">' +
          '    <div>' +
          '      <div style="font-weight:700;color:var(--navy);">' + s.Perihal + '</div>' +
          '      <div class="tahap-meta" style="margin-top:4px;">' + (s.NoRegistrasi ? 'No Registrasi: ' + s.NoRegistrasi + ' &middot; ' : '') + 'Nomor Arsip: ' + (s.NomorArsip || '-') + ' &middot; Kategori: ' + s.KategoriArsip + '</div>' +
          '    </div>' +
          '    <span class="pill ' + (s.Sumber === 'Manual' ? 'pill-info' : 'pill-selesai') + '">' + s.Sumber + '</span>' +
          '  </div>' +
          '  <div style="margin-top:12px;padding:12px 14px;background:#fff;border:1.5px solid var(--gold);border-radius:9px;">' +
          (punyaLokasi
            ? '    <div style="font-size:12px;color:var(--muted);">📍 Lokasi Penyimpanan</div><div style="font-size:16px;font-weight:800;color:var(--navy);margin-top:2px;">' + s.KodeLokasi + (namaLokasi ? ' — ' + namaLokasi : '') + '</div>'
            : '    <div style="font-size:13px;color:var(--muted);">📍 Kode lokasi belum ditentukan untuk arsip ini.</div>') +
          '  </div>' +
          '</div>';
      }).join('');
  }

  /* ============================================================
   *  TAMBAH ARSIP MANUAL (surat lama, tidak ada di sistem persuratan)
   * ============================================================ */

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnBukaArsipManual') bukaModalArsipManual();
  });

  function bukaModalArsipManual() {
    const overlay = document.getElementById('arsipManualModalOverlay');
    document.getElementById('manualNoSurat').value = '';
    document.getElementById('manualTanggalSurat').value = '';
    document.getElementById('manualPerihal').value = '';
    document.getElementById('manualJenisSurat').value = '';
    document.getElementById('manualSuratDariNama').value = '';
    document.getElementById('manualNomorArsip').value = '';
    document.getElementById('manualKodeLokasi').value = '';
    document.getElementById('manualKategoriArsip').value = '';
    document.getElementById('manualKeterangan').value = '';
    isiPilihanLokasiArsip();
    initKategoriArsipAutocomplete('manualKategoriArsip');
    overlay.classList.add('show');
  }

  function initArsipManualModal() {
    const overlay = document.getElementById('arsipManualModalOverlay');
    const btnClose = document.getElementById('btnTutupArsipManual');
    const btnBatal = document.getElementById('btnBatalArsipManual');
    const btnSimpan = document.getElementById('btnSimpanArsipManual');
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    function tutup() { overlay.classList.remove('show'); }
    btnClose.addEventListener('click', tutup);
    btnBatal.addEventListener('click', tutup);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) tutup(); });

    btnSimpan.addEventListener('click', function () {
      const perihal = document.getElementById('manualPerihal').value.trim();
      const kategori = document.getElementById('manualKategoriArsip').value.trim();
      if (!perihal) { showToast('Perihal wajib diisi.', 'error'); return; }
      if (!kategori) { showToast('Kategori arsip wajib diisi.', 'error'); return; }

      const payload = {
        noSurat: document.getElementById('manualNoSurat').value.trim(),
        tanggalSurat: document.getElementById('manualTanggalSurat').value,
        perihal: perihal,
        jenisSurat: document.getElementById('manualJenisSurat').value.trim(),
        suratDariNama: document.getElementById('manualSuratDariNama').value.trim(),
        nomorArsip: document.getElementById('manualNomorArsip').value.trim(),
        kodeLokasi: document.getElementById('manualKodeLokasi').value,
        kategoriArsip: kategori,
        keterangan: document.getElementById('manualKeterangan').value.trim()
      };

      btnSimpan.disabled = true;
      btnSimpan.innerHTML = '<span class="spinner"></span> Menyimpan...';

      google.script.run
        .withSuccessHandler(function () {
          btnSimpan.disabled = false;
          btnSimpan.innerHTML = '💾 Simpan Arsip Manual';
          showToast('Arsip manual berhasil disimpan.', 'success');
          tutup();
          loadDaftarArsip();
          loadDaftarLokasiArsip();
        })
        .withFailureHandler(function (err) {
          btnSimpan.disabled = false;
          btnSimpan.innerHTML = '💾 Simpan Arsip Manual';
          showToast('Gagal menyimpan arsip manual: ' + err.message, 'error');
        })
        .tambahArsipManual(CURRENT_USER.token, payload);
    });
  }

  /* ============================================================
   *  LOKASI PENYIMPANAN ARSIP
   * ============================================================ */

  function loadDaftarLokasiArsip() {
    const tbody = document.querySelector('#tabelLokasiArsip tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Memuat data...</td></tr>';

    google.script.run
      .withSuccessHandler(function (list) {
        LOKASI_ARSIP_CACHE = list || [];
        renderTabelLokasiArsip(LOKASI_ARSIP_CACHE);
        isiPilihanLokasiArsip();
      })
      .withFailureHandler(function (err) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Gagal memuat data: ' + err.message + '</td></tr>';
      })
      .getDaftarLokasiArsip(CURRENT_USER.token);
  }

  function renderTabelLokasiArsip(list) {
    const tbody = document.querySelector('#tabelLokasiArsip tbody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada lokasi penyimpanan. Klik "Tambah Lokasi" untuk membuat yang pertama.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (l) {
      const sisa = l.KapasitasMaksimal - l.Terpakai;
      const kodeEsc = l.KodeLokasi.replace(/'/g, "\\'");
      const namaEsc = l.NamaLokasi.replace(/'/g, "\\'");
      const ketEsc = (l.Keterangan || '').replace(/'/g, "\\'");
      let warnaBar = 'var(--green)';
      if (l.Persentase >= 100) warnaBar = 'var(--red)';
      else if (l.Persentase >= 80) warnaBar = 'var(--amber)';
      return '<tr>' +
        '<td><strong>' + l.KodeLokasi + '</strong></td>' +
        '<td>' + l.NamaLokasi + '</td>' +
        '<td>' + l.KapasitasMaksimal + '</td>' +
        '<td>' + l.Terpakai + '</td>' +
        '<td>' + sisa + '</td>' +
        '<td>' + (l.Keterangan || '-') + '</td>' +
        '<td>' +
        '  <div style="display:flex;gap:6px;">' +
        '    <button class="btn btn-outline btn-sm" onclick="bukaEditLokasiArsip(\'' + kodeEsc + '\', \'' + namaEsc + '\', ' + l.KapasitasMaksimal + ', \'' + ketEsc + '\')">✏️ Edit</button>' +
        '    <button class="btn btn-reject btn-sm" onclick="hapusLokasiArsipUi(\'' + kodeEsc + '\')">🗑️ Hapus</button>' +
        '  </div>' +
        '</td>' +
        '</tr>';
    }).join('');
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnBukaTambahLokasi') bukaModalLokasiArsip();
  });

  function bukaModalLokasiArsip() {
    document.getElementById('lokasiArsipModalTitle').textContent = '📦 Tambah Lokasi Penyimpanan';
    document.getElementById('lokasiKodeLokasi').value = '';
    document.getElementById('lokasiKodeLokasi').disabled = false;
    document.getElementById('lokasiNamaLokasi').value = '';
    document.getElementById('lokasiKapasitasMaksimal').value = '';
    document.getElementById('lokasiKeterangan').value = '';
    document.getElementById('lokasiArsipModalOverlay').classList.add('show');
  }

  // Dipanggil dari tombol Edit pada tabel Lokasi Penyimpanan.
  function bukaEditLokasiArsip(kode, nama, kapasitas, keterangan) {
    document.getElementById('lokasiArsipModalTitle').textContent = '✏️ Edit Lokasi: ' + kode;
    document.getElementById('lokasiKodeLokasi').value = kode;
    document.getElementById('lokasiKodeLokasi').disabled = true; // Kode Lokasi tidak boleh diubah setelah dibuat (jadi rujukan arsip)
    document.getElementById('lokasiNamaLokasi').value = nama;
    document.getElementById('lokasiKapasitasMaksimal').value = kapasitas;
    document.getElementById('lokasiKeterangan').value = keterangan;
    document.getElementById('lokasiArsipModalOverlay').classList.add('show');
  }

  function initLokasiArsipModal() {
    const overlay = document.getElementById('lokasiArsipModalOverlay');
    const btnClose = document.getElementById('btnTutupLokasiArsip');
    const btnBatal = document.getElementById('btnBatalLokasiArsip');
    const btnSimpan = document.getElementById('btnSimpanLokasiArsip');
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    function tutup() { overlay.classList.remove('show'); }
    btnClose.addEventListener('click', tutup);
    btnBatal.addEventListener('click', tutup);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) tutup(); });

    btnSimpan.addEventListener('click', function () {
      const payload = {
        kodeLokasi: document.getElementById('lokasiKodeLokasi').value.trim(),
        namaLokasi: document.getElementById('lokasiNamaLokasi').value.trim(),
        kapasitasMaksimal: document.getElementById('lokasiKapasitasMaksimal').value,
        keterangan: document.getElementById('lokasiKeterangan').value.trim()
      };
      if (!payload.kodeLokasi) { showToast('Kode Lokasi wajib diisi.', 'error'); return; }
      if (!payload.namaLokasi) { showToast('Nama Lokasi wajib diisi.', 'error'); return; }
      if (!payload.kapasitasMaksimal || Number(payload.kapasitasMaksimal) <= 0) { showToast('Kapasitas Maksimal harus lebih dari 0.', 'error'); return; }

      btnSimpan.disabled = true;
      btnSimpan.innerHTML = '<span class="spinner"></span> Menyimpan...';

      google.script.run
        .withSuccessHandler(function (res) {
          btnSimpan.disabled = false;
          btnSimpan.innerHTML = '💾 Simpan Lokasi';
          showToast(res.message || 'Lokasi berhasil disimpan.', 'success');
          tutup();
          loadDaftarLokasiArsip();
        })
        .withFailureHandler(function (err) {
          btnSimpan.disabled = false;
          btnSimpan.innerHTML = '💾 Simpan Lokasi';
          showToast('Gagal menyimpan lokasi: ' + err.message, 'error');
        })
        .simpanLokasiArsip(CURRENT_USER.token, payload);
    });
  }

  function hapusLokasiArsipUi(kodeLokasi) {
    if (!window.confirm('Hapus lokasi "' + kodeLokasi + '"? Hanya bisa dihapus kalau tidak ada arsip yang memakainya.')) return;

    google.script.run
      .withSuccessHandler(function (res) {
        showToast(res.message || 'Lokasi berhasil dihapus.', 'success');
        loadDaftarLokasiArsip();
      })
      .withFailureHandler(function (err) {
        showToast('Gagal menghapus lokasi: ' + err.message, 'error');
      })
      .hapusLokasiArsip(CURRENT_USER.token, kodeLokasi);
  }

  /* ============================================================
   *  DASHBOARD ARSIP
   * ============================================================ */

  // Dipanggil dari kartu statistik Dashboard Arsip - membuka menu Arsip yang relevan.
  function bukaMenuArsip(page) {
    const navItem = document.querySelector('.nav-item[data-page="' + page + '"]');
    if (navItem) navItem.click();
  }

  function loadDashboardArsip() {
    const grid = document.getElementById('statsGridArsip');

    google.script.run
      .withSuccessHandler(function (stats) {
        if (grid) {
          grid.innerHTML =
            '<div class="stat-box stat-box-clickable" onclick="bukaMenuArsip(\'arsip\')"><div class="num">' + stats.totalArsip + '</div><div class="label">Total Arsip</div></div>' +
            '<div class="stat-box amber stat-box-clickable" onclick="bukaMenuArsip(\'arsip\')"><div class="num">' + stats.siapDiarsipkan + '</div><div class="label">Siap Diarsipkan</div></div>' +
            '<div class="stat-box stat-box-clickable" onclick="bukaMenuArsip(\'lokasiarsip\')"><div class="num">' + stats.jumlahLokasi + '</div><div class="label">Jumlah Lokasi</div></div>' +
            '<div class="stat-box green stat-box-clickable" onclick="bukaMenuArsip(\'lokasiarsip\')"><div class="num">' + stats.persentaseTerpakai + '%</div><div class="label">Kapasitas Terpakai (' + stats.terpakaiTotal + '/' + stats.kapasitasTotal + ')</div></div>';
        }

        const boxKategori = document.getElementById('chartKategoriArsip');
        if (boxKategori) renderDonutChart(boxKategori, stats.perKategori, 'kategori', 'jumlah');

        const boxLokasi = document.getElementById('chartLokasiArsip');
        if (boxLokasi) {
          if (!stats.perLokasi.length) {
            boxLokasi.innerHTML = '<div class="empty-state">Belum ada lokasi penyimpanan. Buat dulu di menu "Lokasi Penyimpanan".</div>';
          } else {
            renderHBarChart(
              boxLokasi, stats.perLokasi,
              function (l) { return l.kodeLokasi; },
              function (l) { return l.persentase; },
              function (l) { return l.terpakai + '/' + l.kapasitas + ' (' + l.persentase + '%)'; },
              function (l) {
                if (l.persentase >= 100) return 'var(--red)';
                if (l.persentase >= 80) return 'var(--amber)';
                return 'var(--green)';
              }
            );
          }
        }
      })
      .withFailureHandler(function (err) {
        if (grid) grid.innerHTML = '<div class="warn-box">Gagal memuat statistik: ' + err.message + '</div>';
      })
      .getDashboardArsipStats(CURRENT_USER.token);
  }


  /* ============================================================
   *  EDIT & HAPUS SURAT MASUK (Admin TU / Super Admin)
   * ============================================================ */

  function initEditSuratModal() {
    const overlay = document.getElementById('editSuratModalOverlay');
    const btnClose = document.getElementById('btnTutupEditSurat');
    const btnBatal = document.getElementById('btnBatalEditSurat');
    const form = document.getElementById('formEditSurat');
    if (!overlay || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    initSkpdAutocomplete('editSuratDariNama');

    function tutup() { overlay.classList.remove('show'); }
    btnClose.addEventListener('click', tutup);
    btnBatal.addEventListener('click', tutup);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) tutup(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const errBox = document.getElementById('editSuratErrorBox');
      errBox.style.display = 'none';

      const payload = {
        noRegistrasi: document.getElementById('editNoRegistrasi').value,
        suratDariTipe: document.getElementById('editSuratDariTipe').value,
        suratDariNama: document.getElementById('editSuratDariNama').value,
        noSurat: document.getElementById('editNoSurat').value,
        perihal: document.getElementById('editPerihal').value,
        tindakLanjut: document.getElementById('editTindakLanjut').value,
        noWhatsApp: document.getElementById('editNoWhatsApp').value,
        isiDisposisi: document.getElementById('editIsiDisposisi').value
      };
      if (document.getElementById('editUndanganFields').style.display !== 'none') {
        payload.tanggalAcara = document.getElementById('editTanggalAcara').value;
        payload.waktuAcara = document.getElementById('editWaktuAcara').value;
        payload.tempatAcara = document.getElementById('editTempatAcara').value;
        payload.keteranganAcara = document.getElementById('editKeteranganAcara').value;
      }

      const btn = document.getElementById('btnSimpanEditSurat');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

      google.script.run
        .withSuccessHandler(function () {
          btn.disabled = false;
          btn.innerHTML = '💾 Simpan Perubahan';
          tutup();
          showToast('Surat berhasil diperbarui.', 'success');
          loadDaftarSuratMasuk();
          loadDashboard();
        })
        .withFailureHandler(function (err) {
          btn.disabled = false;
          btn.innerHTML = '💾 Simpan Perubahan';
          errBox.textContent = err.message;
          errBox.style.display = 'block';
        })
        .updateSuratMasuk(CURRENT_USER.token, payload);
    });
  }

  function bukaEditSurat(noRegistrasi) {
    const overlay = document.getElementById('editSuratModalOverlay');
    const errBox = document.getElementById('editSuratErrorBox');
    errBox.style.display = 'none';

    google.script.run
      .withSuccessHandler(function (res) {
        if (!res.found) { showToast('Surat tidak ditemukan.', 'error'); return; }
        const s = res.surat;
        document.getElementById('editNoRegistrasi').value = s.NoRegistrasi;
        document.getElementById('editNoRegistrasiLabel').textContent = s.NoRegistrasi;
        document.getElementById('editJenisSuratLabel').textContent = s.JenisSurat;
        document.getElementById('editTujuanSuratLabel').textContent = s.TujuanSurat;
        document.getElementById('editSuratDariTipe').value = s.SuratDariTipe;
        document.getElementById('editSuratDariNama').value = s.SuratDariNama;
        document.getElementById('editNoSurat').value = s.NoSurat;
        document.getElementById('editPerihal').value = s.Perihal;
        document.getElementById('editTindakLanjut').value = s.TindakLanjut;
        document.getElementById('editNoWhatsApp').value = s.NoWhatsApp;
        document.getElementById('editIsiDisposisi').value = s.IsiDisposisi;

        const undanganBox = document.getElementById('editUndanganFields');
        if (s.JenisSurat === 'Undangan' && res.undangan) {
          undanganBox.style.display = 'block';
          document.getElementById('editTanggalAcara').value = res.undangan.tanggalAcara || '';
          document.getElementById('editWaktuAcara').value = res.undangan.waktu || '';
          document.getElementById('editTempatAcara').value = res.undangan.tempat || '';
          document.getElementById('editKeteranganAcara').value = res.undangan.keterangan || '';
        } else {
          undanganBox.style.display = 'none';
        }

        overlay.classList.add('show');
      })
      .withFailureHandler(function (err) {
        showToast('Gagal memuat data surat: ' + err.message, 'error');
      })
      .getSuratDetailUntukEdit(CURRENT_USER.token, noRegistrasi);
  }

  function hapusSuratMasuk(noRegistrasi) {
    const konfirmasi = window.confirm(
      'Hapus surat "' + noRegistrasi + '" beserta seluruh riwayat trackingnya?\n\nTindakan ini tidak bisa dibatalkan.'
    );
    if (!konfirmasi) return;

    google.script.run
      .withSuccessHandler(function () {
        showToast('Surat berhasil dihapus.', 'success');
        loadDaftarSuratMasuk();
        loadDashboard();
      })
      .withFailureHandler(function (err) {
        showToast('Gagal menghapus surat: ' + err.message, 'error');
      })
      .deleteSuratMasuk(CURRENT_USER.token, noRegistrasi);
  }

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'filterBulanSemuaSurat') {
      FILTER_BULAN_SEMUA_SURAT = e.target.value || '';
      terapkanFilterSemuaSurat();
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'cariSemuaSurat') {
      terapkanFilterSemuaSurat();
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnRefreshSemuaSurat') loadDaftarSuratMasuk();
    if (e.target && e.target.id === 'btnHapusFilterStatus') {
      STATUS_FILTER_AKTIF = null;
      terapkanFilterSemuaSurat();
    }
  });

  /* ============================================================
   *  LAPORAN HARIAN
   * ============================================================ */

  function loadLaporanHarian() {
    const statsBox = document.getElementById('statsHarian');
    const tbody = document.querySelector('#tabelMasihProses tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Memuat data...</td></tr>';

    google.script.run
      .withSuccessHandler(function (data) {
        statsBox.innerHTML =
          '<div class="stat-box"><div class="num">' + data.masukHariIni + '</div><div class="label">Surat Masuk Hari Ini</div></div>' +
          '<div class="stat-box green"><div class="num">' + data.selesaiHariIni + '</div><div class="label">Selesai Hari Ini</div></div>' +
          '<div class="stat-box amber"><div class="num">' + data.masihProses.length + '</div><div class="label">Masih Dalam Proses</div></div>';

        if (!data.masihProses.length) {
          tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Tidak ada surat yang masih dalam proses.</td></tr>';
        } else {
          tbody.innerHTML = data.masihProses.map(function (m) {
            return '<tr><td>' + m.noRegistrasi + '</td><td>' + m.perihal + '</td><td>' + m.jenisSurat + '</td>' +
              '<td><span class="pill pill-proses">' + m.tahapMenunggu + '</span></td></tr>';
          }).join('');
        }
      })
      .withFailureHandler(function (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Terjadi kesalahan: ' + err.message + '</td></tr>';
      })
      .getLaporanHarian(CURRENT_USER.token);
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnExportHarianPdf') {
      const btn = e.target;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Membuat PDF...';
      google.script.run
        .withSuccessHandler(function (res) {
          btn.disabled = false;
          btn.innerHTML = '📄 Export PDF Laporan Harian';
          unduhBase64(res);
        })
        .withFailureHandler(function (err) {
          btn.disabled = false;
          btn.innerHTML = '📄 Export PDF Laporan Harian';
          showToast('Gagal membuat PDF: ' + err.message, 'error');
        })
        .exportLaporanHarian(CURRENT_USER.token);
    }
  });

  /* ============================================================
   *  LAPORAN BULANAN
   * ============================================================ */

  function getFilterBulanan() {
    return {
      bulan: document.getElementById('filterBulan').value,
      tahun: document.getElementById('filterTahun').value,
      jenisSurat: document.getElementById('filterJenis').value
    };
  }

  function loadLaporanBulanan() {
    const tbody = document.querySelector('#tabelDaftar tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Memuat data...</td></tr>';

    google.script.run
      .withSuccessHandler(function (list) {
        if (!list.length) {
          tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Tidak ada data sesuai filter.</td></tr>';
          return;
        }
        tbody.innerHTML = list.map(function (s) {
          return '<tr>' +
            '<td>' + s.NoRegistrasi + '</td>' +
            '<td>' + s.TanggalMasuk + '</td>' +
            '<td>' + s.SuratDariNama + '</td>' +
            '<td>' + s.NoSurat + '</td>' +
            '<td>' + s.Perihal + '</td>' +
            '<td>' + s.JenisSurat + '</td>' +
            '<td>' + s.TujuanSurat + '</td>' +
            '<td><span class="pill ' + statusPillClass(s.StatusAkhir) + '">' + s.StatusAkhir + '</span></td>' +
            '</tr>';
        }).join('');
      })
      .withFailureHandler(function (err) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Terjadi kesalahan: ' + err.message + '</td></tr>';
      })
      .getAllSurat(CURRENT_USER.token, getFilterBulanan());
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnTerapkanFilter') loadLaporanBulanan();

    if (e.target && (e.target.id === 'btnExportPdf' || e.target.id === 'btnExportExcel')) {
      const format = (e.target.id === 'btnExportPdf') ? 'pdf' : 'xlsx';
      const btn = e.target;
      const originalLabel = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Menyiapkan...';

      google.script.run
        .withSuccessHandler(function (res) {
          btn.disabled = false;
          btn.innerHTML = originalLabel;
          unduhBase64(res);
        })
        .withFailureHandler(function (err) {
          btn.disabled = false;
          btn.innerHTML = originalLabel;
          showToast('Gagal ekspor: ' + err.message, 'error');
        })
        .exportLaporan(CURRENT_USER.token, getFilterBulanan(), format);
    }
  });

  /* ============================================================
   *  UTIL: UNDUH FILE BASE64
   * ============================================================ */

  function unduhBase64(res) {
    try {
      const byteChars = atob(res.base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: res.mimeType });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('File "' + res.filename + '" berhasil diunduh', 'success');
    } catch (err) {
      showToast('Gagal mengunduh file: ' + err.message, 'error');
    }
  }

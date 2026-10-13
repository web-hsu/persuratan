console.info('[SPARTA] app.js versi 20261017 termuat');
/* ============================================================
   *  CLIENT-SIDE LOGIC
   * ============================================================ */

  // Urutan baku tahap alur persetujuan (harus sama dengan URUTAN_TAHAP_BAKU di Code.gs)
  const URUTAN_TAHAP_BAKU_CLIENT = ['Paraf Asisten', 'Paraf Staf Ahli', 'Paraf Sekda', 'Tanda Tangan Sekda', 'Tanda Tangan Wakil Bupati', 'Tanda Tangan Bupati'];

  // Tab yang tersedia untuk masing-masing role
  const MENU_STANDAR = [
    {p:'dashboard', label:'📊 Dashboard'},
    {p:'registrasi', label:'📝 Registrasi Surat'},
    {p:'tracking', label:'🔎 Tracking Surat'},
    {p:'disposisi', label:'✅ Menunggu Persetujuan'},
    {p:'semuasurat', label:'📋 Daftar Surat Masuk'},
    {p:'suratselesai', label:'✔️ Surat Selesai'},
    {p:'laporan', label:'📁 Laporan'}
  ];
  const TAB_PER_ROLE = {
    'Admin TU'      : MENU_STANDAR,
    'Asisten'       : MENU_STANDAR,
    'Staf Ahli'     : MENU_STANDAR,
    'Sekda'         : MENU_STANDAR,
    'Wakil Bupati'  : MENU_STANDAR,
    'Bupati'        : MENU_STANDAR
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
    // Role yang sudah tidak punya menu (mis. akun lama "Petugas Arsip") ditolak, bukan diberi menu Admin TU.
    if (!TAB_PER_ROLE[info.role]) {
      showToast('Role "' + info.role + '" tidak lagi tersedia. Hubungi Admin TU.', 'error');
      keluarDariAplikasi();
      return;
    }
    CURRENT_USER = info; // { token, username, nama, role }

    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('appPage').style.display = 'block';

    document.getElementById('userNamaLabel').textContent = info.nama;
    document.getElementById('userRoleLabel').textContent = info.role + (info.role === 'Admin TU' ? ' • Super Admin' : '');
    document.getElementById('avatarInisial').textContent = (info.nama || '?').charAt(0).toUpperCase();

    buildNavTabs(info.role);

    populateJenisSurat();
    populateDaftarSkpd();
    populateFilterTahunJenis();
    loadDashboard();
    loadKotakMasukSaya(); // semua role persuratan (termasuk Super Admin) langsung melihat kotak masuknya
    initRegistrasiForm();
    prefetchDaftarSurat();
  }

  // Ambil Daftar Surat Masuk di latar belakang segera setelah login, supaya saat menunya dibuka
  // datanya sudah siap (hasilnya masuk cache sesi; permintaan yang sama digabung oleh gas-api.js).
  function prefetchDaftarSurat() {
    try {
      google.script.run
        .withSilentErrors()
        .withSuccessHandler(function (list) { DAFTAR_SURAT_CACHE = list || []; })
        .withFailureHandler(function () { /* diamkan - dimuat ulang saat menu dibuka */ })
        .getAllSurat(CURRENT_USER.token);
    } catch (e) { /* abaikan */ }
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
        const aktif = (gi === 0 && ti === 0 ? ' active' : '');
        if (t.p === 'laporan') { // dropdown: Harian / Bulanan
          html += '<div class="nav-item has-sub' + aktif + '" data-page="laporan">' + t.label + '<span class="nav-caret">▾</span></div>' +
            '<div class="nav-sub" id="navSubLaporan">' +
              '<div class="nav-subitem" data-sublaporan="harian">📅 Harian</div>' +
              '<div class="nav-subitem" data-sublaporan="bulanan">🗓️ Bulanan</div>' +
            '</div>';
        } else {
          html += '<div class="nav-item' + aktif + '" data-page="' + t.p + '">' + t.label + '</div>';
        }
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

    // Sub-menu Laporan (Harian / Bulanan)
    nav.querySelectorAll('.nav-subitem').forEach(function (subEl) {
      subEl.addEventListener('click', function () {
        const induk = nav.querySelector('.nav-item[data-page="laporan"]');
        nav.querySelectorAll('.nav-item').forEach(function (t) { t.classList.remove('active'); });
        if (induk) { induk.classList.add('active'); induk.classList.add('terbuka'); }
        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        document.getElementById('page-laporan').classList.add('active');
        tampilkanSubLaporan(subEl.dataset.sublaporan);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        tutupSidebarMobile();
      });
    });

    nav.querySelectorAll('.nav-item').forEach(function (tabEl) {
      tabEl.addEventListener('click', function () {
        // Dropdown Laporan: klik = buka/tutup daftar Harian & Bulanan (toggle murni).
        // Saat ditutup, halaman yang sedang tampil tidak berubah.
        if (tabEl.classList.contains('has-sub')) {
          const subBox = tabEl.nextElementSibling;
          const buka = !subBox.classList.contains('buka');
          subBox.classList.toggle('buka', buka);
          tabEl.classList.toggle('terbuka', buka);
          if (!buka) return; // tutup saja, jangan pindah halaman / muat ulang data
        }

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
        if (!tabEl.classList.contains('has-sub')) tutupSidebarMobile(); // dropdown tetap terbuka agar sub-menu bisa dipilih

        if (tabEl.dataset.page === 'dashboard') loadDashboard();
        if (tabEl.dataset.page === 'disposisi') loadKotakMasukSaya();
        if (tabEl.dataset.page === 'semuasurat') loadDaftarSuratMasuk();
        if (tabEl.dataset.page === 'suratselesai') loadSuratSelesai();
        if (tabEl.dataset.page === 'laporan') tampilkanSubLaporan(SUB_LAPORAN_AKTIF);
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
          return '<div class="kotak-masuk-row" data-noreg="' + s.NoRegistrasi + '" onclick="bukaDariKotakMasuk(\'' + s.NoRegistrasi + '\', this)">' +
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
        // Muat lebih awal alur 3 surat teratas (yang paling mungkin dibuka) agar pop up langsung terisi.
        list.slice(0, 3).forEach(function (s, i) { setTimeout(function () { prefetchDisposisi(s.NoRegistrasi); }, 400 + i * 500); });
      })
      .withFailureHandler(function (err) {
        box.innerHTML = '<div class="empty-state">Terjadi kesalahan: ' + err.message + '</div>';
      })
      .getSuratMenungguPersetujuan(CURRENT_USER.token);
  }

  // Pop up langsung tampil: kepala surat diambil dari baris yang diklik (tanpa menunggu server),
  // alur persetujuan menyusul begitu data tiba (atau seketika bila sudah dimuat lebih awal).
  function bukaDariKotakMasuk(noReg, rowEl) {
    document.getElementById('inputNoRegDisposisi').value = noReg;
    let kepala = '';
    if (rowEl && rowEl.querySelector) {
      const tx = function (sel) { const n = rowEl.querySelector(sel); return n ? n.textContent.trim() : ''; };
      kepala = '<div class="no-reg-result">' +
        '<div class="no">' + escHtmlQr(noReg) + '</div>' +
        '<div class="perihal">' + escHtmlQr(tx('.kotak-masuk-perihal')) + '</div>' +
        '<div class="perihal" style="opacity:.8;font-size:12px;">Menunggu: ' + escHtmlQr(tx('.kotak-masuk-side .pill')) + ' &middot; Masuk ' + escHtmlQr(tx('.kotak-masuk-tanggal')) + '</div>' +
        '</div>';
    }
    cariDisposisi(kepala);
  }

  // Muat data alur lebih awal begitu kursor berhenti / jari menyentuh baris (hasil masuk cache).
  const SUDAH_PREFETCH_DISP = {};
  function prefetchDisposisi(noReg) {
    if (!noReg || SUDAH_PREFETCH_DISP[noReg]) return;
    SUDAH_PREFETCH_DISP[noReg] = true;
    setTimeout(function () { delete SUDAH_PREFETCH_DISP[noReg]; }, 60000);
    try {
      google.script.run.withSilentErrors()
        .withSuccessHandler(function () {}).withFailureHandler(function () {})
        .getTrackingByNoRegistrasi(noReg);
    } catch (e) { /* abaikan */ }
  }
  (function () {
    let tunda = null;
    const barisDari = function (e) { return e.target.closest ? e.target.closest('.kotak-masuk-row') : null; };
    document.addEventListener('mouseover', function (e) {
      const r = barisDari(e); clearTimeout(tunda);
      if (r) tunda = setTimeout(function () { prefetchDisposisi(r.getAttribute('data-noreg')); }, 100);
    });
    document.addEventListener('touchstart', function (e) {
      const r = barisDari(e); if (r) prefetchDisposisi(r.getAttribute('data-noreg'));
    }, { passive: true });
  })();

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnCariDisposisi') cariDisposisi();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'inputNoRegDisposisi' && e.key === 'Enter') cariDisposisi();
  });

  function cariDisposisi(kepalaInstan) {
    const noReg = document.getElementById('inputNoRegDisposisi').value.trim();
    const box = document.getElementById('hasilDisposisi');
    if (!noReg) { showToast('Masukkan No Registrasi terlebih dahulu', 'error'); return; }
    box.innerHTML = (typeof kepalaInstan === 'string' && kepalaInstan)
      ? kepalaInstan + '<div class="empty-state">Memuat alur persetujuan...</div>'
      : '<div class="empty-state">Mencari data...</div>';

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
      const blob = QR_WA_BLOB; // sudah disiapkan saat modal dibuka (agar klik tetap dianggap aksi pengguna)
      const noReg = (DATA_QR_TERAKHIR && DATA_QR_TERAKHIR.noRegistrasi) || 'surat';
      const pesan = document.getElementById('notifWaPreview').textContent || '';

      // Tanpa QR (mis. notifikasi tindakan persetujuan): perilaku lama.
      if (!blob) {
        if (link) window.open(link, '_blank');
        tutup();
        return;
      }

      const berkas = new File([blob], 'QR-' + String(noReg).replace(/[^\w-]+/g, '-') + '.png', { type: 'image/png' });
      const adaHp = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      // HP: kirim foto QR + teks sekaligus lewat menu bagikan -> pilih WhatsApp.
      if (adaHp && navigator.canShare && navigator.canShare({ files: [berkas] })) {
        navigator.share({ files: [berkas], text: pesan }).then(tutup).catch(function (e) {
          if (e && e.name === 'AbortError') return; // dibatalkan pengguna: modal tetap terbuka
          if (link) window.open(link, '_blank');
          tutup();
        });
        return;
      }

      // Komputer: buka chat WhatsApp pemohon + salin foto QR ke clipboard. WhatsApp tidak mengizinkan
      // lampiran otomatis lewat tautan, jadi foto harus ditempel (Ctrl+V) di chat. Modal dibiarkan
      // terbuka agar petunjuk & tombol "Salin ulang / Unduh" tetap terlihat.
      if (link) window.open(link, '_blank');
      const tip = document.getElementById('notifWaQrTip');
      const status = document.getElementById('notifWaQrTipStatus');
      if (tip) tip.style.display = 'block';
      salinFotoQrWa(blob).then(function () {
        if (status) status.textContent = '✅ Foto QR Code sudah disalin ke clipboard.';
      }).catch(function () {
        if (status) status.textContent = '⚠️ Foto tidak bisa disalin otomatis oleh browser. Klik "Unduh foto", lalu lampirkan manual di WhatsApp (ikon klip).';
      });
    });

    const btnSalinUlang = document.getElementById('btnSalinUlangQr');
    if (btnSalinUlang) btnSalinUlang.addEventListener('click', function () {
      const status = document.getElementById('notifWaQrTipStatus');
      if (!QR_WA_BLOB) return;
      salinFotoQrWa(QR_WA_BLOB)
        .then(function () { if (status) status.textContent = '✅ Foto QR Code disalin ulang. Tekan Ctrl+V di chat WhatsApp.'; })
        .catch(function () { if (status) status.textContent = '⚠️ Gagal menyalin. Gunakan "Unduh foto".'; });
    });
    const btnUnduh = document.getElementById('btnUnduhQrWa');
    if (btnUnduh) btnUnduh.addEventListener('click', function () {
      if (!QR_WA_BLOB) return;
      const noReg = (DATA_QR_TERAKHIR && DATA_QR_TERAKHIR.noRegistrasi) || 'surat';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(QR_WA_BLOB);
      a.download = 'QR-' + String(noReg).replace(/[^\w-]+/g, '-') + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    const btnQr = document.getElementById('btnCetakQrNotifWa');
    if (btnQr) btnQr.addEventListener('click', function () {
      if (DATA_QR_TERAKHIR) cetakQrThermal(DATA_QR_TERAKHIR);
    });
  }

  /* ---------- Cetak QR Code tracking (kertas thermal / printer bluetooth) ---------- */
  // Lebar kertas thermal dalam mm. Printer bluetooth umumnya 58 mm; ganti ke 80 bila memakai kertas 80 mm.
  const LEBAR_KERTAS_THERMAL_MM = 58;
  let DATA_QR_TERAKHIR = null; // { noRegistrasi, linkTracking, perihal, suratDariNama }

  function escHtmlQr(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cetakQrThermal(d) {
    if (typeof QRCode === 'undefined') {
      showToast('Pustaka QR Code belum termuat. Periksa koneksi internet lalu coba lagi.', 'error');
      return;
    }
    // Buat QR di elemen sementara, lalu ambil sebagai gambar PNG
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(tmp);
    new QRCode(tmp, { text: d.linkTracking, width: 320, height: 320, correctLevel: QRCode.CorrectLevel.M });
    const canvas = tmp.querySelector('canvas');
    const img = tmp.querySelector('img');
    const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : '');
    document.body.removeChild(tmp);
    if (!dataUrl) { showToast('Gagal membuat QR Code.', 'error'); return; }

    const w = LEBAR_KERTAS_THERMAL_MM;
    const qrMm = Math.min(w - 12, 46);
    const html =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR ' + escHtmlQr(d.noRegistrasi) + '</title><style>' +
      '@page{size:' + w + 'mm auto;margin:0}' +
      '*{box-sizing:border-box}' +
      'html,body{margin:0;padding:0;background:#fff}' +
      'body{width:' + w + 'mm;padding:3mm 3mm 8mm;font-family:Arial,Helvetica,sans-serif;color:#000;text-align:center}' +
      '.judul{font-size:13pt;font-weight:bold;letter-spacing:1px}' +
      '.instansi{font-size:8pt;margin-top:1mm}' +
      '.garis{border-top:1px dashed #000;margin:2.5mm 0}' +
      '.label{font-size:8pt}' +
      '.noreg{font-size:11pt;font-weight:bold;margin-top:0.5mm;word-break:break-all}' +
      '.perihal{font-size:8.5pt;margin-top:1.5mm;word-break:break-word}' +
      'img{width:' + qrMm + 'mm;height:' + qrMm + 'mm;display:block;margin:2mm auto;image-rendering:pixelated}' +
      '.ket{font-size:8.5pt;line-height:1.35;margin-top:1mm}' +
      '.ket b{font-size:9pt}' +
      '</style></head><body>' +
      '<div class="judul">SPARTA</div>' +
      '<div class="instansi">Sistem Pelayanan Administrasi Persuratan</div>' +
      '<div class="garis"></div>' +
      '<div class="label">No. Registrasi</div>' +
      '<div class="noreg">' + escHtmlQr(d.noRegistrasi) + '</div>' +
      (d.perihal ? '<div class="perihal">Perihal: ' + escHtmlQr(d.perihal) + '</div>' : '') +
      '<img src="' + dataUrl + '" alt="QR Code">' +
      '<div class="ket"><b>Scan QR Code untuk melihat status surat</b></div>' +
      '<div class="garis"></div>' +
      '<div class="ket">Jika surat sudah selesai, proses tanda terima juga bisa melalui QR Code ini.</div>' +
      '</body></html>';

    const ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(ifr);
    const doc = ifr.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(function () {
      try { ifr.contentWindow.focus(); ifr.contentWindow.print(); }
      catch (e) { showToast('Gagal membuka dialog cetak: ' + e.message, 'error'); }
      setTimeout(function () { if (ifr.parentNode) ifr.parentNode.removeChild(ifr); }, 60000);
    }, 400);
  }

  /* ---------- Foto QR Code untuk dilampirkan ke WhatsApp ---------- */
  let QR_WA_BLOB = null;

  function salinFotoQrWa(blob) {
    if (!(navigator.clipboard && window.ClipboardItem)) return Promise.reject(new Error('Clipboard tidak didukung'));
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }

  function buatFotoQrWa(link, noRegistrasi, selesai) {
    try {
      if (typeof QRCode === 'undefined') { selesai(null, ''); return; }
      const tmp = document.createElement('div');
      tmp.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(tmp);
      new QRCode(tmp, { text: link, width: 360, height: 360, correctLevel: QRCode.CorrectLevel.M });
      const src = tmp.querySelector('canvas');
      const img = tmp.querySelector('img');
      const gambar = new Image();
      gambar.onload = function () {
        document.body.removeChild(tmp);
        const c = document.createElement('canvas');
        c.width = 480; c.height = 600;
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#0b2540'; g.textAlign = 'center';
        g.font = 'bold 30px Arial'; g.fillText('SPARTA', 240, 48);
        g.font = '16px Arial'; g.fillText('Sistem Pelayanan Administrasi Persuratan', 240, 74);
        g.font = 'bold 22px Arial'; g.fillText('No. Registrasi ' + noRegistrasi, 240, 118);
        g.imageSmoothingEnabled = false;
        g.drawImage(gambar, 60, 140, 360, 360);
        g.font = 'bold 20px Arial'; g.fillText('Scan QR Code untuk melihat status surat', 240, 540);
        g.font = '15px Arial'; g.fillText('Arahkan kamera HP ke kode di atas', 240, 568);
        c.toBlob(function (b) { selesai(b, c.toDataURL('image/png')); }, 'image/png');
      };
      gambar.onerror = function () { document.body.removeChild(tmp); selesai(null, ''); };
      gambar.src = src ? src.toDataURL('image/png') : (img ? img.src : '');
    } catch (e) { selesai(null, ''); }
  }

  function tampilkanKonfirmasiNotifWa(waInfo, noRegistrasi, dariDaftar) {
    const overlay = document.getElementById('notifWaModalOverlay');
    const btnKirim = document.getElementById('btnKirimNotifWa');
    const warning = document.getElementById('notifWaNoHpWarning');

    const dAwal = document.getElementById('notifWaDescAwal');
    const dAkhir = document.getElementById('notifWaDescAkhir');
    if (dAwal && dAkhir) {
      if (dariDaftar === 'ambil') {
        dAwal.textContent = 'Kirim pengingat pengambilan surat ';
        dAkhir.textContent = ' ke pemohon melalui WhatsApp?';
      } else {
        dAwal.textContent = dariDaftar ? 'Kirim informasi status surat ' : 'Tindakan pada surat ';
        dAkhir.textContent = dariDaftar ? ' ke pemohon melalui WhatsApp?' : ' berhasil disimpan. Kirim informasi ini ke pemohon surat melalui WhatsApp?';
      }
    }

    document.getElementById('notifWaNoRegistrasi').textContent = noRegistrasi;
    document.getElementById('notifWaPreview').textContent = waInfo.pesan;

    // Tombol QR Code hanya muncul setelah simpan registrasi (server mengirim linkTracking)
    const btnQr = document.getElementById('btnCetakQrNotifWa');
    if (btnQr) {
      if (waInfo.linkTracking) {
        DATA_QR_TERAKHIR = { noRegistrasi: noRegistrasi, linkTracking: waInfo.linkTracking, perihal: waInfo.perihal || '', suratDariNama: waInfo.suratDariNama || '' };
        btnQr.style.display = 'flex';
      } else {
        DATA_QR_TERAKHIR = null;
        btnQr.style.display = 'none';
      }
    }

    // Foto QR Code untuk dilampirkan ke WhatsApp (hanya untuk notifikasi registrasi)
    QR_WA_BLOB = null;
    const tipEl = document.getElementById('notifWaQrTip'); if (tipEl) tipEl.style.display = 'none';
    const qrBox = document.getElementById('notifWaQrBox');
    if (qrBox) qrBox.style.display = 'none';
    if (waInfo.linkTracking) {
      buatFotoQrWa(waInfo.linkTracking, noRegistrasi, function (blob, dataUrl) {
        QR_WA_BLOB = blob;
        const pv = document.getElementById('notifWaQrPreview');
        if (blob && pv && qrBox) { pv.src = dataUrl; qrBox.style.display = 'block'; }
      });
    }

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
      const persen = total > 0 ? Math.round((i[jumlahKey] / total) * 100) : 0;
      return '<div class="donut-legend-item"><span class="dot" style="background:' + warna + ';"></span>' + i[labelKey] + ' (' + persen + '%)</div>';
    }).join('');

    // Angka di atas tiap irisan: diletakkan di tengah ketebalan cincin sesuai sudut tengah irisan
    // (conic-gradient mulai dari atas, searah jarum jam). Irisan < 3% tidak diberi angka agar tidak bertabrakan;
    // nilainya tetap ada di legenda.
    let kum = 0;
    const angkaIrisan = items.map(function (i) {
      const bagian = total > 0 ? i[jumlahKey] / total : 0;
      const tengah = (kum + i[jumlahKey] / 2) / (total || 1);
      kum += i[jumlahKey];
      if (bagian < 0.03) return '';
      const sudut = tengah * 2 * Math.PI;
      const radius = 40; // % dari ukuran donat (tengah cincin)
      const x = 50 + radius * Math.sin(sudut);
      const y = 50 - radius * Math.cos(sudut);
      return '<span class="donut-slice-label" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;">' + i[jumlahKey] + '</span>';
    }).join('');

    container.innerHTML =
      '<div class="donut-chart-wrap">' +
      '  <div class="donut-chart" style="background:conic-gradient(' + stops + ');">' +
      angkaIrisan +
      '    <div class="donut-hole"><div class="donut-total-num">' + total + '</div><div class="donut-total-text">Total</div></div>' +
      '  </div>' +
      '  <div class="donut-legend">' + legend + '</div>' +
      '</div>';
  }

  // Grafik batang HORIZONTAL - dipakai untuk "Tahap Menunggu".
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
        // Kelas grid menyesuaikan jumlah kotak: 4 kotak (role) atau 6 kotak (Admin TU)
        grid.className = 'stats-grid' + (stats.papanRole ? ' stats-grid-role' : '');
        // Akun selain Admin TU: tampilkan 4 papan sesuai role yang login
        if (stats.papanRole) {
          const p = stats.papanRole;
          NOREG_FILTER_DASHBOARD = { disetujui: p.noRegDisetujui || [], ditolak: p.noRegDitolak || [] };
          grid.innerHTML =
            '<div class="stat-box stat-box-clickable" onclick="bukaDaftarSuratStatus(null)"><div class="num">' + p.total + '</div><div class="label">Total Surat Masuk</div></div>' +
            '<div class="stat-box amber stat-box-clickable" onclick="bukaHalamanDisposisi()"><div class="num">' + p.menunggu + '</div><div class="label">Menunggu Persetujuan</div></div>' +
            '<div class="stat-box green stat-box-clickable" onclick="bukaDaftarSuratStatus(\'ROLE_DISETUJUI\')"><div class="num">' + p.disetujui + '</div><div class="label">Disetujui</div></div>' +
            '<div class="stat-box red stat-box-clickable" onclick="bukaDaftarSuratStatus(\'ROLE_DITOLAK\')"><div class="num">' + p.ditolak + '</div><div class="label">Ditolak / Perlu Perbaikan</div></div>';
        } else {
        grid.innerHTML =
          '<div class="stat-box stat-box-clickable" onclick="bukaDaftarSuratStatus(null)"><div class="num">' + stats.total + '</div><div class="label">Total Surat</div></div>' +
          '<div class="stat-box amber stat-box-clickable" onclick="bukaDaftarSuratStatus(\'Dalam Proses\')"><div class="num">' + stats.dalamProses + '</div><div class="label">Dalam Proses</div></div>' +
          '<div class="stat-box green stat-box-clickable" onclick="bukaDaftarSuratStatus(\'Selesai / Disetujui\')"><div class="num">' + stats.disetujui + '</div><div class="label">Selesai / Disetujui</div></div>' +
          '<div class="stat-box red stat-box-clickable" onclick="bukaDaftarSuratStatus(\'DITOLAK_PERBAIKAN\')"><div class="num">' + (stats.ditolak + stats.perbaikan) + '</div><div class="label">Ditolak / Perlu Perbaikan</div></div>' +
          '<div class="stat-box stat-box-clickable" style="border-left-color:var(--navy-light);" onclick="bukaDaftarSuratStatus(\'Informasi (Tanpa Persetujuan)\')"><div class="num" style="color:var(--navy-light);">' + (stats.informasi || 0) + '</div><div class="label">Informasi (Undangan/Lainnya)</div></div>';

        // Kotak "Persentase Penyelesaian" versi ringkas - seukuran kotak statistik lain.
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
        }

        const boxBulan = document.getElementById('chartBulanSurat');
        if (boxBulan) renderVBarChart(boxBulan, stats.perBulan.map(function (b) { return { label: String(b.label).replace(/\s\d{2}(\d{2})$/, ' $1'), jumlah: b.jumlah }; }));

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
  let FILTER_BULAN_SEMUA_SURAT = ''; // '' = semua bulan | '1'..'12'
  let FILTER_TAHUN_SEMUA_SURAT = ''; // '' = semua tahun | 'yyyy' | 'kosong' = tanggal tidak terbaca
  const NAMA_BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const NAMA_BULAN_SINGKAT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  let NOREG_FILTER_DASHBOARD = { disetujui: [], ditolak: [] }; // No Registrasi untuk papan dashboard per role
  let STATUS_FILTER_AKTIF = null; // null | 'Dalam Proses' | 'Selesai / Disetujui' | 'DITOLAK_PERBAIKAN' | 'Informasi (Tanpa Persetujuan)'

  // Kunci bulan 'yyyy-M' sebuah surat. Memakai BulanKey dari server; bila belum ada (data cache lama), turunkan dari teks d/M/yyyy.
  function bulanKeySurat(s) {
    if (s.BulanKey !== undefined) return s.BulanKey || '';
    const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s.TanggalMasuk || '');
    return m ? (m[3] + '-' + Number(m[2])) : '';
  }

  // Filter Bulan & Tahun: dua dropdown biasa, sama seperti menu Laporan Bulanan.
  // Bulan sudah lengkap di HTML (Semua Bulan + Januari-Desember). Tahun: Semua Tahun, tahun berjalan s/d +2
  // (mis. 2026, 2027, 2028) ditambah tahun lain yang ada di data surat.
  // Pastikan dua dropdown (Bulan & Tahun) benar-benar ada, apa pun versi index.html yang terpasang
  // (mis. index.html lama berisi kotak popup / belum diganti) - dibuat langsung dari sini bila perlu.
  function pastikanDropdownFilterSurat() {
    let selB = document.getElementById('filterBulanSemuaSurat');
    if (!selB) return;
    if (selB.tagName !== 'SELECT') { // HTML lama: elemen ini berupa <div> pembungkus kotak popup
      const wadah = selB;
      wadah.className = ''; wadah.removeAttribute('style');
      let opsiBulan = '<option value="">Semua Bulan</option>';
      NAMA_BULAN_ID.forEach(function (n, i) { opsiBulan += '<option value="' + (i + 1) + '">' + n + '</option>'; });
      wadah.id = 'wadahFilterBulanTahunSemuaSurat';
      wadah.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
        '<div class="field"><label>Bulan</label><select id="filterBulanSemuaSurat">' + opsiBulan + '</select></div>' +
        '<div class="field"><label>Tahun</label><select id="filterTahunSemuaSurat"><option value="">Semua Tahun</option></select></div></div>';
      const labelLama = wadah.parentNode && wadah.parentNode.querySelector('label');
      if (labelLama && labelLama.parentNode === wadah.parentNode) labelLama.style.display = 'none';
      return;
    }
    if (!document.getElementById('filterTahunSemuaSurat')) { // hanya dropdown Bulan yang ada -> tambahkan Tahun
      const f = document.createElement('div');
      f.className = 'field';
      f.innerHTML = '<label>Tahun</label><select id="filterTahunSemuaSurat"><option value="">Semua Tahun</option></select>';
      const indukBulan = selB.parentNode;
      indukBulan.parentNode.insertBefore(f, indukBulan.nextSibling);
    }
  }

  function isiOpsiFilterBulanSemuaSurat() {
    pastikanDropdownFilterSurat();
    const selT = document.getElementById('filterTahunSemuaSurat');
    if (!selT) return;
    const t = new Date().getFullYear(), set = {}; let adaKosong = false;
    for (let i = t; i <= t + 2; i++) set[i] = true;
    DAFTAR_SURAT_CACHE.forEach(function (s) {
      const k = bulanKeySurat(s);
      if (k) set[k.split('-')[0]] = true; else adaKosong = true;
    });
    let html = '<option value="">Semua Tahun</option>';
    Object.keys(set).sort().forEach(function (th) { html += '<option value="' + th + '">' + th + '</option>'; });
    if (adaKosong) html += '<option value="kosong">(Tanggal tidak terbaca)</option>';
    selT.innerHTML = html;
    const ada = FILTER_TAHUN_SEMUA_SURAT && Array.prototype.some.call(selT.options, function (o) { return o.value === FILTER_TAHUN_SEMUA_SURAT; });
    if (!ada) FILTER_TAHUN_SEMUA_SURAT = '';
    selT.value = FILTER_TAHUN_SEMUA_SURAT;
    const selB = document.getElementById('filterBulanSemuaSurat');
    if (selB) selB.value = FILTER_BULAN_SEMUA_SURAT;
  }

  document.addEventListener('change', function (e) {
    if (!e.target) return;
    if (e.target.id === 'filterBulanSemuaSurat') {
      FILTER_BULAN_SEMUA_SURAT = e.target.value || '';
      terapkanFilterSemuaSurat();
    } else if (e.target.id === 'filterTahunSemuaSurat') {
      FILTER_TAHUN_SEMUA_SURAT = e.target.value || '';
      if (FILTER_TAHUN_SEMUA_SURAT === 'kosong') { // bulan tidak berlaku untuk tanggal tak terbaca
        FILTER_BULAN_SEMUA_SURAT = '';
        const sb = document.getElementById('filterBulanSemuaSurat'); if (sb) sb.value = '';
      }
      terapkanFilterSemuaSurat();
    }
  });

  function loadDaftarSuratMasuk() {
    const tbody = document.querySelector('#tabelSemuaSurat tbody');
    const counter = document.getElementById('jumlahSemuaSurat');
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Memuat data...</td></tr>';
    isiOpsiFilterBulanSemuaSurat(); // tombol bulan & pilihan tahun langsung tampil selagi data dimuat

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

  function bukaHalamanDisposisi() {
    const navItem = document.querySelector('.nav-item[data-page="disposisi"]');
    if (navItem) navItem.click();
  }

  function labelFilterStatus(f) {
    if (f === 'ROLE_DISETUJUI') return 'Disetujui oleh saya';
    if (f === 'ROLE_DITOLAK') return 'Ditolak / Perlu Perbaikan oleh saya';
    if (f === 'DITOLAK_PERBAIKAN') return 'Ditolak / Perlu Perbaikan';
    return f;
  }

  function terapkanFilterSemuaSurat() {
    const counter = document.getElementById('jumlahSemuaSurat');
    const chip = document.getElementById('filterStatusChip');
    const searchInput = document.getElementById('cariSemuaSurat');

    let list = DAFTAR_SURAT_CACHE;
    if (STATUS_FILTER_AKTIF === 'ROLE_DISETUJUI' || STATUS_FILTER_AKTIF === 'ROLE_DITOLAK') {
      const daftarNoReg = STATUS_FILTER_AKTIF === 'ROLE_DISETUJUI' ? NOREG_FILTER_DASHBOARD.disetujui : NOREG_FILTER_DASHBOARD.ditolak;
      list = list.filter(function (s) { return daftarNoReg.indexOf(String(s.NoRegistrasi).trim()) !== -1; });
    } else if (STATUS_FILTER_AKTIF === 'DITOLAK_PERBAIKAN') {
      list = list.filter(function (s) { return s.StatusAkhir === 'Ditolak' || s.StatusAkhir === 'Perlu Perbaikan'; });
    } else if (STATUS_FILTER_AKTIF) {
      list = list.filter(function (s) { return s.StatusAkhir === STATUS_FILTER_AKTIF; });
    }

    // Filter Tahun & Filter Bulan (berdiri sendiri-sendiri, bisa dikombinasikan)
    if (FILTER_TAHUN_SEMUA_SURAT === 'kosong') {
      list = list.filter(function (s) { return !bulanKeySurat(s); });
    } else {
      if (FILTER_TAHUN_SEMUA_SURAT) {
        list = list.filter(function (s) { return bulanKeySurat(s).split('-')[0] === FILTER_TAHUN_SEMUA_SURAT; });
      }
      if (FILTER_BULAN_SEMUA_SURAT) {
        list = list.filter(function (s) { return bulanKeySurat(s).split('-')[1] === FILTER_BULAN_SEMUA_SURAT; });
      }
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
    if (counter) counter.textContent = 'Total: ' + list.length + ' surat' + ((STATUS_FILTER_AKTIF || FILTER_BULAN_SEMUA_SURAT || FILTER_TAHUN_SEMUA_SURAT) ? ' (terfilter)' : '');

    BATAS_TAMPIL_SURAT = UKURAN_HALAMAN_SURAT; // filter/pencarian/muat ulang -> mulai dari halaman pertama
    renderTabelSemuaSurat(list);
  }

  // Menggambar ribuan baris sekaligus membuat browser macet -> tampilkan bertahap.
  const UKURAN_HALAMAN_SURAT = 50;
  let BATAS_TAMPIL_SURAT = UKURAN_HALAMAN_SURAT;
  let SURAT_TERFILTER = [];

  function tampilkanLebihBanyakSurat() {
    BATAS_TAMPIL_SURAT += UKURAN_HALAMAN_SURAT;
    renderTabelSemuaSurat(SURAT_TERFILTER);
  }

  function renderTabelSemuaSurat(list) {
    const tbody = document.querySelector('#tabelSemuaSurat tbody');
    SURAT_TERFILTER = list;
    const totalList = list.length;
    if (totalList > BATAS_TAMPIL_SURAT) list = list.slice(0, BATAS_TAMPIL_SURAT);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Tidak ada data yang cocok.</td></tr>';
      return;
    }
    const bisaKelola = CURRENT_USER && CURRENT_USER.role === 'Admin TU';
    tbody.innerHTML = list.map(function (s) {
      const noRegEsc = s.NoRegistrasi.replace(/'/g, "\\'");
      const aksi = bisaKelola
        ? '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button class="btn btn-outline btn-sm" onclick="bukaEditSurat(\'' + noRegEsc + '\')">✏️ Edit</button>' +
            '<button class="btn btn-reject btn-sm" onclick="hapusSuratMasuk(\'' + noRegEsc + '\')">🗑️ Hapus</button>' +
            '<button class="btn btn-wa btn-sm" onclick="kirimWaDariDaftar(\'' + noRegEsc + '\', this)">' + IKON_WA_SVG + 'Kirim WhatsApp</button>' +
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
    }).join('') + (totalList > list.length
      ? '<tr><td colspan="9" style="text-align:center;padding:14px;"><button type="button" class="btn btn-outline" onclick="tampilkanLebihBanyakSurat()">Tampilkan ' +
        Math.min(UKURAN_HALAMAN_SURAT, totalList - list.length) + ' lagi (' + list.length + ' dari ' + totalList + ' ditampilkan)</button></td></tr>'
      : '');
  }

  /* ============================================================
   *  SURAT SELESAI (tanggal selesai & status pengambilan)
   * ============================================================ */

  let SURAT_SELESAI_CACHE = [];
  let FILTER_BULAN_SURAT_SELESAI = '';
  let FILTER_TAHUN_SURAT_SELESAI = '';
  let FILTER_PENGAMBILAN_SURAT_SELESAI = ''; // '' = semua | 'belum' | 'sudah'

  // Kunci 'yyyy-M' dari Tanggal Selesai (teks d/M/yyyy). Kosong bila surat belum punya tanggal selesai ('-').
  function bulanKeySelesai(s) {
    const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s.TanggalSelesai || '');
    return m ? (m[3] + '-' + Number(m[2])) : '';
  }

  // Pilihan Tahun: tahun berjalan s/d +2, ditambah tahun lain yang ada di data (sama seperti Daftar Surat Masuk)
  function isiOpsiTahunSuratSelesai() {
    const selT = document.getElementById('filterTahunSuratSelesai');
    if (!selT) return;
    const t = new Date().getFullYear(), set = {}; let adaKosong = false;
    for (let i = t; i <= t + 2; i++) set[i] = true;
    SURAT_SELESAI_CACHE.forEach(function (s) {
      const k = bulanKeySelesai(s);
      if (k) set[k.split('-')[0]] = true; else adaKosong = true;
    });
    let html = '<option value="">Semua Tahun</option>';
    Object.keys(set).sort().forEach(function (th) { html += '<option value="' + th + '">' + th + '</option>'; });
    if (adaKosong) html += '<option value="kosong">(Tanggal tidak terbaca)</option>';
    selT.innerHTML = html;
    const ada = FILTER_TAHUN_SURAT_SELESAI && Array.prototype.some.call(selT.options, function (o) { return o.value === FILTER_TAHUN_SURAT_SELESAI; });
    if (!ada) FILTER_TAHUN_SURAT_SELESAI = '';
    selT.value = FILTER_TAHUN_SURAT_SELESAI;
    const selB = document.getElementById('filterBulanSuratSelesai');
    if (selB) selB.value = FILTER_BULAN_SURAT_SELESAI;
  }

  // Gabungan filter Bulan + Tahun (berdasarkan Tanggal Selesai) + Cari Cepat
  function terapkanFilterSuratSelesai() {
    const counter = document.getElementById('jumlahSuratSelesai');
    const cari = document.getElementById('cariSuratSelesai');
    let list = SURAT_SELESAI_CACHE;

    if (FILTER_TAHUN_SURAT_SELESAI === 'kosong') {
      list = list.filter(function (s) { return !bulanKeySelesai(s); });
    } else {
      if (FILTER_TAHUN_SURAT_SELESAI) {
        list = list.filter(function (s) { return bulanKeySelesai(s).split('-')[0] === FILTER_TAHUN_SURAT_SELESAI; });
      }
      if (FILTER_BULAN_SURAT_SELESAI) {
        list = list.filter(function (s) { return bulanKeySelesai(s).split('-')[1] === FILTER_BULAN_SURAT_SELESAI; });
      }
    }

    if (FILTER_PENGAMBILAN_SURAT_SELESAI === 'belum') list = list.filter(function (s) { return !s.SudahDiambil; });
    else if (FILTER_PENGAMBILAN_SURAT_SELESAI === 'sudah') list = list.filter(function (s) { return !!s.SudahDiambil; });

    const kw = cari ? cari.value.trim().toLowerCase() : '';
    if (kw) {
      list = list.filter(function (s) {
        return (s.NoRegistrasi + ' ' + s.Perihal + ' ' + s.NamaPenerima + ' ' + s.JenisSurat).toLowerCase().indexOf(kw) !== -1;
      });
    }

    const terfilter = !!(kw || FILTER_BULAN_SURAT_SELESAI || FILTER_TAHUN_SURAT_SELESAI || FILTER_PENGAMBILAN_SURAT_SELESAI);
    if (counter) counter.textContent = 'Total: ' + list.length + ' surat' + (terfilter ? ' (terfilter)' : '');
    renderTabelSuratSelesai(list, terfilter);
  }

  function loadSuratSelesai() {
    const tbody = document.querySelector('#tabelSuratSelesai tbody');
    const counter = document.getElementById('jumlahSuratSelesai');
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Memuat data...</td></tr>';
    if (counter) counter.textContent = '';

    google.script.run
      .withSuccessHandler(function (list) {
        try {
          SURAT_SELESAI_CACHE = list || [];
          isiOpsiTahunSuratSelesai();
          terapkanFilterSuratSelesai();
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

  function renderTabelSuratSelesai(list, terfilter) {
    const tbody = document.querySelector('#tabelSuratSelesai tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">' + (terfilter ? 'Tidak ada surat selesai yang cocok dengan filter.' : 'Belum ada surat yang selesai.') + '</td></tr>';
      return;
    }
    const isAdmin = CURRENT_USER && CURRENT_USER.role === 'Admin TU';
    tbody.innerHTML = list.map(function (s) {
      const pengambilan = s.SudahDiambil
        ? '<span class="pill pill-selesai">Sudah Diambil</span>'
        : '<span class="pill pill-proses">Belum Diambil</span>';
      const noRegEsc = s.NoRegistrasi.replace(/'/g, "\\'");

      let aksi = '';
      if (isAdmin) {
        const tombol = [];
        if (!s.SudahDiambil) {
          tombol.push('<button class="btn btn-primary btn-sm" onclick="bukaKonfirmasiDiambilAdmin(\'' + noRegEsc + '\')">📦 Sudah Diambil</button>');
          tombol.push('<button class="btn btn-wa btn-sm" onclick="kirimWaDariDaftar(\'' + noRegEsc + '\', this, \'ambil\')">' + IKON_WA_SVG + 'Kirim WhatsApp</button>');
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
    if (e.target && e.target.id === 'cariSuratSelesai') terapkanFilterSuratSelesai();
  });

  document.addEventListener('change', function (e) {
    if (!e.target) return;
    if (e.target.id === 'filterBulanSuratSelesai') {
      FILTER_BULAN_SURAT_SELESAI = e.target.value || '';
      terapkanFilterSuratSelesai();
    } else if (e.target.id === 'filterPengambilanSuratSelesai') {
      FILTER_PENGAMBILAN_SURAT_SELESAI = e.target.value || '';
      terapkanFilterSuratSelesai();
    } else if (e.target.id === 'filterTahunSuratSelesai') {
      FILTER_TAHUN_SURAT_SELESAI = e.target.value || '';
      if (FILTER_TAHUN_SURAT_SELESAI === 'kosong') { // bulan tidak berlaku untuk tanggal tak terbaca
        FILTER_BULAN_SURAT_SELESAI = '';
        const sb = document.getElementById('filterBulanSuratSelesai'); if (sb) sb.value = '';
      }
      terapkanFilterSuratSelesai();
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnRefreshSuratSelesai') loadSuratSelesai();
  });

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

  const IKON_WA_SVG = '<svg class="ikon-btn" viewBox="0 0 24 24" aria-hidden="true" style="width:15px;height:15px;flex-basis:15px;"><path fill="currentColor" d="M17.5 14.4c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.8h-.01a9.9 9.9 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88zM20.52 3.45A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.42z"/></svg>';

  // Tombol "Kirim WhatsApp" pada Daftar Surat Masuk: ambil info surat dari server, lalu tampilkan
  // modal yang sama dengan setelah registrasi (pesan + foto QR Code + tombol kirim).
  // mode: undefined = info status biasa | 'ambil' = pengingat pengambilan surat (Surat Selesai)
  function kirimWaDariDaftar(noRegistrasi, btn, mode) {
    if (btn) btn.disabled = true;
    google.script.run
      .withSuccessHandler(function (waInfo) {
        if (btn) btn.disabled = false;
        tampilkanKonfirmasiNotifWa(waInfo, noRegistrasi, mode === 'ambil' ? 'ambil' : true);
      })
      .withFailureHandler(function (err) {
        if (btn) btn.disabled = false;
        showToast('Gagal menyiapkan pesan WhatsApp: ' + err.message, 'error');
      })
      .getInfoKirimWa(CURRENT_USER.token, noRegistrasi, mode || '');
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

  // Laporan: hanya satu kartu (Harian ATAU Bulanan) yang tampil; data dimuat untuk yang dipilih saja.
  let SUB_LAPORAN_AKTIF = 'harian';
  function tampilkanSubLaporan(sub) {
    SUB_LAPORAN_AKTIF = (sub === 'bulanan') ? 'bulanan' : 'harian';
    const harian = document.getElementById('cardLaporanHarian');
    const bulanan = document.getElementById('cardLaporanBulanan');
    if (harian) harian.classList.toggle('laporan-sembunyi', SUB_LAPORAN_AKTIF !== 'harian');
    if (bulanan) bulanan.classList.toggle('laporan-sembunyi', SUB_LAPORAN_AKTIF !== 'bulanan');
    const subBox = document.getElementById('navSubLaporan');
    if (subBox) {
      subBox.classList.add('buka');
      subBox.querySelectorAll('.nav-subitem').forEach(function (el) {
        el.classList.toggle('active', el.dataset.sublaporan === SUB_LAPORAN_AKTIF);
      });
      const induk = subBox.previousElementSibling;
      if (induk) induk.classList.add('terbuka');
    }
    if (SUB_LAPORAN_AKTIF === 'harian') loadLaporanHarian(); else loadLaporanBulanan();
  }

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

import type { Dict } from './en'

/** Bahasa Indonesia. Nama verdict tidak diterjemahkan. Penjelasannya diterjemahkan. */
export const id: Dict = {
  meta: {
    siteName: 'CekKutip',
    description:
      'Tempel daftar pustakamu. CekKutip mencari tiap referensi di Crossref dan OpenAlex, lalu memberi tahu apakah referensi itu ada, apakah detailnya benar, atau apakah belum bisa dipastikan.',
    titles: {
      home: 'Periksa daftar pustaka',
      how: 'Cara kerja',
      evaluation: 'Evaluasi',
      about: 'Tentang',
      privacy: 'Privasi',
      notFound: 'Halaman tidak ditemukan',
    },
  },
  nav: {
    label: 'Utama',
    check: 'Periksa',
    how: 'Cara kerja',
    evaluation: 'Evaluasi',
    about: 'Tentang',
    language: 'Bahasa',
    skip: 'Langsung ke isi',
    switchTo: { en: 'Ganti ke English', id: 'Ganti ke Bahasa Indonesia' },
  },
  footer: {
    privacy: 'Privasi',
    statement: 'Verdict adalah ajakan untuk memeriksa ulang, bukan temuan pelanggaran.',
    builtBy: 'Dibuat oleh {team}',
  },
  verdict: {
    verified: 'Verified',
    mismatch: 'Mismatch',
    suspect: 'Suspect',
    out_of_index: 'Out-of-index',
    check_failed: 'Tidak bisa diperiksa',
  },
  verdictDefinitions: {
    verified: 'Karyanya ditemukan, dan judul, penulis, serta tahunnya sesuai dengan referensimu.',
    mismatch:
      'Karyanya ditemukan, tetapi beberapa detail yang kamu tulis tidak sesuai dengan recordnya.',
    suspect:
      'Karya ini tidak ditemukan, padahal cara penulisannya seharusnya membuatnya mudah dicari. Periksa sumbernya secara manual.',
    out_of_index:
      'Jenis sumber seperti ini sering tidak ada di Crossref dan OpenAlex, jadi kami tidak bisa memastikannya. Periksa secara manual.',
  },
  reasons: {
    verified_all_match: 'Ditemukan di {source}. Judul, penulis, dan tahun sesuai.',
    mismatch_authors:
      'Karya ini ada, tetapi penulis yang kamu tulis tidak sesuai dengan recordnya.',
    mismatch_year: 'Karya ini ada, tetapi tahunnya berbeda {n} tahun.',
    mismatch_venue: 'Karya ini ada, tetapi terbit di jurnal yang berbeda.',
    mismatch_doi_other_work: 'DOI ini mengarah ke karya yang berbeda dari yang kamu kutip.',
    suspect_doi_not_found:
      'DOI ini tidak terdaftar. Periksa sumbernya secara manual sebelum kamu mempertahankannya.',
    suspect_no_record_journal:
      'Karya ini tidak ditemukan, padahal ditulis seperti artikel jurnal. Periksa sumbernya secara manual.',
    out_of_index_type:
      'Ini tampaknya berupa {type}. Crossref dan OpenAlex sering tidak memuat jenis ini, jadi kami tidak bisa memeriksanya. Periksa secara manual.',
    out_of_index_insufficient_data:
      'Detailnya terlalu sedikit untuk dicari. Tambahkan judul dan penulis.',
    out_of_index_other_registry:
      'DOI ini milik registri yang belum kami cari. Buka DOI-nya untuk memeriksa.',
    check_failed_network: 'Layanan pencarian tidak merespons. Ini bukan verdict. Coba lagi.',
  },
  home: {
    h1: 'Periksa daftar pustaka sebelum kamu mengumpulkannya.',
    intro:
      'Tempel referensimu. CekKutip mencari tiap referensi, lalu memberi tahu apakah referensi itu ada, apakah detailnya benar, atau apakah belum bisa dipastikan.',
    inputLabel: 'Referensi',
    found: (n: number) => `${n} terdeteksi`,
    placeholderHint: 'Tempel satu referensi per paragraf, atau beri nomor.',
    noAi: 'Jangan kirim teksku ke layanan AI (kurang akurat)',
    notice:
      'Secara bawaan, teksmu dikirim ke Google Gemini untuk membaca field (penulis, tahun, judul). Judul dan penulis kemudian dicari di Crossref dan OpenAlex. Kami tidak menyimpan teksmu.',
    noticeLink: 'Baca rincian privasi',
    check: 'Periksa referensi',
    example: 'Coba contoh',
    clear: 'Hapus',
    resultsTitle: 'Hasil',
    emptyHint:
      'Tempel referensimu di sebelah kiri lalu pilih Periksa referensi. Hasilnya muncul di sini satu per satu.',
    emptyLegend: 'Arti keempat verdict',
    statement: 'Verdict adalah ajakan untuk memeriksa ulang, bukan temuan pelanggaran.',
    verdictsTitle: 'Empat verdict',
    howTitle: 'Cara kerja pemeriksaan',
    howMore: 'Lihat contoh lengkap',
    steps: [
      {
        name: 'Parse',
        text: 'Model bahasa membaca tiap referensi dan mengambil field-nya. Model tidak pernah memutuskan apakah referensi itu nyata.',
      },
      {
        name: 'Retrieve',
        text: 'Kami mencari karyanya di Crossref, dan di OpenAlex bila perlu.',
      },
      { name: 'Match', text: 'Kami membandingkan judul, penulis, tahun, dan venue.' },
      {
        name: 'Decide',
        text: 'Aturan tetap mengubah hasil perbandingan menjadi satu dari empat verdict.',
      },
    ],
    notTitle: 'Yang tidak dilakukan CekKutip',
    notItems: [
      'CekKutip tidak memeriksa apakah sebuah sumber mendukung klaimmu.',
      'CekKutip tidak mendeteksi plagiarisme.',
      'CekKutip tidak bisa melihat buku, skripsi, dan laporan yang tidak dimuat Crossref dan OpenAlex. Untuk itu kami bilang terus terang, bukan menebak.',
      'Hasilnya bukan bukti pelanggaran, dan bukan pengganti membaca sumbermu.',
    ],
  },
  how: {
    h1: 'Cara kerja pemeriksaan',
    lede: 'Pemeriksaan punya empat langkah. Hanya langkah pertama yang memakai model bahasa, dan model itu tidak pernah memutuskan apakah sebuah referensi nyata.',
    diagramTitle: 'Empat langkah',
    diagramDesc:
      'Empat langkah berurutan: Parse, Retrieve, Match, Decide. Hanya Parse yang memakai model bahasa. Tiga langkah lainnya adalah kode dengan aturan tetap.',
    diagramSteps: [
      { name: 'Parse', note: 'Membaca field', tag: 'Model bahasa' },
      { name: 'Retrieve', note: 'Crossref, lalu OpenAlex', tag: 'Tanpa model' },
      { name: 'Match', note: 'Membandingkan empat field', tag: 'Tanpa model' },
      { name: 'Decide', note: 'Aturan tetap, satu verdict', tag: 'Tanpa model' },
    ],
    diagramNote:
      'Model hanya mengubah teks menjadi field. Model tidak mencari apa pun dan tidak memilih verdict.',
    exampleTitle: 'Satu referensi, langkah demi langkah',
    exampleIntro:
      'Kami mengambil referensi nyata lalu mengubah dua detailnya, yaitu tahun dan jurnal, untuk menunjukkan seperti apa Mismatch.',
    exampleCitedLabel: 'Referensi seperti yang ditempel',
    exampleSteps: [
      {
        name: 'Parse',
        text: 'Model membaca teks lalu mengembalikan field: dua penulis, tahun 2021, judul, dan nama jurnal. Model tidak menambahkan apa pun yang tidak tertulis.',
      },
      {
        name: 'Retrieve',
        text: 'Tidak ada DOI, jadi kami mencari di Crossref dengan judul, penulis pertama, dan tahun. Crossref mengembalikan record dengan judul yang sama.',
      },
      {
        name: 'Match',
        text: 'Kami membandingkan tiap field dengan record. Judul dan penulis sesuai. Tahunnya berbeda dua tahun, dan jurnalnya tidak sama.',
      },
      {
        name: 'Decide',
        text: 'Judulnya cocok, tetapi tahun dan jurnalnya tidak. Aturan untuk kasus ini memberi Mismatch, dengan alasan yang ditampilkan di sebelahnya.',
      },
    ],
    tableCaption: 'Referensi dibandingkan dengan record',
    colField: 'Field',
    colCited: 'Seperti ditulis',
    colFound: 'Record ditemukan (Crossref)',
    colStatus: 'Status',
    fields: { title: 'Judul', authors: 'Penulis', year: 'Tahun', venue: 'Venue', doi: 'DOI' },
    states: {
      agree: 'sesuai',
      differs: 'berbeda',
      not_cited: 'tidak ditulis',
      not_found: 'tidak ditemukan',
    },
    yearDiffers: 'berbeda {n}',
    exampleResult: 'Hasil',
    exampleResultText: 'Karya ini ada, tetapi tahun dan jurnalnya berbeda dari record.',
    rulesTitle: 'Aturannya, berurutan',
    rulesIntro:
      'Aturan pertama yang cocok menentukan hasilnya. Seberapa mirip judul dan penulis dianggap cocok ditentukan oleh nilai ambang. Kami menyetelnya hanya pada data latihan, lalu membekukannya sebelum pengujian akhir.',
    rulesColIf: 'Jika',
    rulesColResult: 'Hasil',
    rules: [
      { if: 'Layanan pencarian tidak merespons setelah dicoba ulang.', result: 'check_failed' },
      { if: 'Referensi punya DOI yang tidak terdaftar di mana pun.', result: 'suspect' },
      { if: 'DOI mengarah ke record dengan judul yang sangat berbeda.', result: 'mismatch' },
      { if: 'Sebuah record cocok pada judul, penulis, tahun, dan jurnal.', result: 'verified' },
      {
        if: 'Sebuah record cocok pada judul, tetapi penulis, tahun, atau jurnalnya berbeda.',
        result: 'mismatch',
      },
      {
        if: 'Ditulis seperti artikel jurnal, dan tidak ada record yang cukup dekat.',
        result: 'suspect',
      },
      {
        if: 'Berupa buku, bab buku, skripsi, laporan, halaman web, atau sumber lain, dan tidak ada record yang cukup dekat.',
        result: 'out_of_index',
      },
      { if: 'Detailnya terlalu sedikit untuk dicari.', result: 'out_of_index' },
      { if: 'DOI milik registri yang belum kami cari.', result: 'out_of_index' },
    ],
    checkFailedNote:
      'Tidak bisa diperiksa adalah status, bukan verdict. Status ini tidak pernah merugikan sebuah referensi.',
    limitsTitle: 'Keterbatasan',
    limits: [
      'Crossref dan OpenAlex tidak lengkap. Sumber yang nyata bisa saja tidak ada di keduanya. Karena itu ada Out-of-index.',
      'Record juga bisa memuat kesalahan. Verified berarti karyanya ada dan detailnya sesuai, bukan bahwa sumbermu mendukung klaimmu.',
      'Model bisa salah membaca format referensi yang tidak lazim. Bila gagal, pembaca regex mengambil alih untuk referensi itu.',
      'Verdict adalah ajakan untuk memeriksa ulang, bukan temuan pelanggaran.',
    ],
  },
  evaluation: {
    h1: 'Evaluasi',
    lede: 'Kami menguji CekKutip dengan dua cara: pada sekumpulan referensi berlabel, dan bersama mahasiswa.',
    loading: 'Memuat hasil',
    emptyTitle: 'Belum ada hasil',
    empty: 'Hasil akan dipublikasikan setelah data dikunci pada 9 Desember 2026.',
    emptyNote:
      'Sampai saat itu halaman ini tidak menampilkan angka, karena kami belum punya hasil terukur untuk ditampilkan.',
    technicalTitle: 'Evaluasi teknis',
    technical:
      'Kami melabeli sekumpulan referensi secara manual, dengan dua orang melabeli tiap referensi. CekKutip dan tiga pembanding sederhana lalu dijalankan pada referensi yang disimpan sampai akhir. Kami juga mematikan bagian CekKutip satu per satu untuk melihat apa yang ditambahkan tiap bagian.',
    userTitle: 'Studi pengguna',
    user: 'Studi singkat bersama mahasiswa melihat apakah alat ini membantu orang menemukan masalah dalam daftar pustaka, dan bagaimana mereka menilai penjelasannya.',
    results: {
      loading: 'Memuat hasil',
      factsTitle: 'Bagaimana hasil ini dibuat',
      version: 'Versi CekKutip',
      commit: 'Commit',
      uncommitted: 'dengan perubahan yang belum di-commit',
      model: 'Model bahasa',
      noModel: 'tidak dipakai',
      date: 'Tanggal',
      cutoffs: 'Ambang',
      cutoffsSource: 'dipilih hanya pada set pengembangan',
      intervals: 'Interval',
      intervalsText: (resamples: number, seed: number) =>
        `Interval kepercayaan 95% dengan bootstrap persentil: ${resamples} resampel, seed tetap ${seed}.`,
      dataset: 'Data',
      datasetText: (n: number) => `${n} referensi, dilabeli oleh dua orang.`,
      splits: {
        dev: 'Set pengembangan (dipakai memilih ambang)',
        test: 'Set uji (dijalankan sekali, setelah ambang dibekukan)',
        all: 'Semua referensi',
      } as Record<string, string>,
      mainTitle: 'Perbandingan utama',
      timeTitle: 'Waktu dan biaya',
      timeCaption: (split: string) => `Waktu dan biaya, ${split}`,
      mainCaption: (split: string) => `Perbandingan utama, ${split}`,
      run: 'Sistem',
      n: 'Referensi',
      macroF1: 'Macro-F1 (interval 95%)',
      falseAccusation: 'False accusation rate (interval 95%)',
      falseAccusationOf: (n: number) => `dari ${n} yang nyata atau tidak terindeks`,
      abstain: 'Tingkat abstain (interval 95%)',
      latency: 'Waktu median (ms)',
      cost: 'Biaya per 1.000 (USD)',
      couldNotCheck: 'Tidak bisa diperiksa',
      latencyNote:
        'Waktu hanya bermakna untuk jalan yang membuat permintaannya sendiri. Jalan yang memutar ulang pencarian tersimpan tampak jauh lebih cepat. Jumlah token dan biaya ikut diputar ulang, dan tetap valid.',
      f1Title: 'F1 untuk tiap verdict',
      f1Caption: (split: string) => `F1 untuk tiap verdict, ${split}`,
      binaryTitle: 'Verified melawan bukan Verified',
      binaryText:
        'Baseline B2 dan B3 hanya menjawab Verified atau Suspect, jadi semua sistem juga dibandingkan pada satu pertanyaan ini.',
      binaryCaption: (split: string) => `Verified melawan bukan Verified, ${split}`,
      precision: 'Precision',
      recall: 'Recall',
      f1: 'F1',
      accuracy: 'Akurasi',
      ablationTitle: 'Apa yang ditambahkan tiap bagian',
      ablationText:
        'Tiap baris mematikan satu bagian. Perubahannya diukur terhadap pipeline penuh pada referensi yang sama.',
      ablationCaption: (split: string) => `Ablation, ${split}`,
      change: 'Perubahan',
      syntheticTitle: 'Dengan dan tanpa referensi yang diubah',
      syntheticText:
        'Sebagian referensi sengaja diubah untuk pengujian. Berikut perbandingan yang sama dengan dan tanpa referensi itu.',
      syntheticCaption: (split: string) => `Dengan dan tanpa referensi yang diubah, ${split}`,
      altered: 'Referensi yang diubah',
      withAll: 'Semua referensi',
      withoutAltered: 'Tanpa yang diubah',
      kappaTitle: 'Kesepakatan antara dua orang yang melabeli referensi',
      kappaText: (kappa: string, n: number, observed: string, expected: string) =>
        `Kappa Cohen ${kappa} pada ${n} referensi (kesepakatan ${observed}, diharapkan karena kebetulan ${expected}).`,
      kappaSkipped: (n: number) => `${n} referensi tanpa dua label tidak diikutkan.`,
      kappaCaption: 'Pelabel 1 (baris) melawan pelabel 2 (kolom)',
      labeler1: 'Pelabel 1',
      notAvailable: 'n/a',
      systems: {
        cekkutip: 'CekKutip, pipeline penuh',
        b1_llm_only: 'B1: hanya model bahasa',
        b2_crossref_top1: 'B2: hasil teratas Crossref',
        b3_doi_check: 'B3: cek DOI',
      } as Record<string, string>,
      ablations: {
        a1: 'A1: tanpa abstain',
        a2: 'A2: tanpa OpenAlex',
        a3: 'A3: pembaca pola, bukan model',
        a4: 'A4: tanpa pengecekan penulis',
      } as Record<string, string>,
    },
    metricsTitle: 'Yang akan kami laporkan',
    metricsTitleDone: 'Yang kami laporkan',
    metrics: [
      'Macro-F1 untuk empat verdict, dengan interval kepercayaan 95%.',
      'Precision, recall, dan F1 untuk tiap verdict.',
      'False accusation rate: seberapa sering sumber yang nyata, atau hanya tidak ada di indeks, diberi Suspect atau Mismatch.',
      'Tingkat abstain: seberapa sering alat ini menjawab Out-of-index.',
      'Waktu median per referensi, dan biaya per 1.000 referensi.',
      'Kesepakatan antara dua orang yang melabeli referensi (kappa Cohen).',
      'Hasil dengan dan tanpa referensi yang sengaja diubah untuk pengujian.',
    ],
  },
  about: {
    h1: 'Tentang CekKutip',
    lede: 'Pemeriksa referensi yang dibuat mahasiswa, untuk mahasiswa.',
    storyTitle: 'Mengapa kami membuatnya',
    story:
      'Asisten AI bisa menulis referensi yang tampak lengkap tetapi tidak mengarah ke mana pun, atau memuat penulis, tahun, atau jurnal yang salah. Mahasiswa sering sulit membedakan mana yang bisa dipercaya, dan kebanyakan pemeriksa hanya mengembalikan kecocokan atau skor. CekKutip menambahkan dua hal: Mismatch, untuk karya nyata yang dikutip keliru, dan Out-of-index, untuk sumber yang tidak bisa dilihatnya. Dengan begitu mahasiswa tidak dituduh keliru atas hal yang tidak benar-benar bisa ditemukan alat ini.',
    teamTitle: 'Tim',
    supervisorTitle: 'Pembimbing',
    universityTitle: 'Kampus',
    competitionTitle: 'Lomba',
    competition:
      'Dibuat untuk Global Youth Invention and Innovation Fair (GYIIF) 2027 yang diselenggarakan IPB University. Kategori: Engineering and Technology. Jalur daring.',
    limitsTitle: 'Keterbatasan',
    limits:
      'CekKutip tidak bisa melihat semuanya. Baca apa yang tidak dilakukannya di halaman Cara kerja.',
    limitsLink: 'Lihat keterbatasan',
    contactTitle: 'Kontak dan kode',
    contactEmail: 'Email',
    github: 'Kode sumber di GitHub',
    demo: 'Demo langsung',
    servicesTitle: 'Layanan yang kami pakai',
    services: [
      {
        name: 'Crossref',
        url: 'https://www.crossref.org/',
        text: 'Metadata karya ilmiah, dicari lewat DOI atau judul.',
      },
      {
        name: 'OpenAlex',
        url: 'https://openalex.org/',
        text: 'Indeks kedua, dipakai bila Crossref tidak punya record yang cukup dekat.',
      },
      {
        name: 'Google Gemini',
        url: 'https://ai.google.dev/',
        text: 'Membaca tiap referensi dan mengambil field-nya. Tidak memutuskan verdict apa pun.',
      },
    ],
  },
  privacy: {
    h1: 'Privasi',
    lede: 'Apa yang terjadi pada teks yang kamu tempel, dengan bahasa sederhana.',
    items: [
      'Secara bawaan, teks referensimu dikirim ke Google Gemini. Teks itu hanya dipakai untuk membaca field: penulis, tahun, judul. Pilih "Jangan kirim teksku ke layanan AI" untuk menghindarinya. Hasilnya jadi kurang akurat.',
      'Google menyatakan bahwa konten yang dikirim lewat tier gratisnya dapat dipakai untuk meningkatkan produknya, dan bahwa peninjau manusia dapat membacanya.',
      'Judul, penulis, dan DOI yang dibaca dari referensimu dikirim ke Crossref dan OpenAlex, serta ke DataCite bila perlu, untuk mencari karyanya.',
      'Berkas .txt atau .bib yang kamu pilih dibaca di browsermu dan dimasukkan ke kotak, seperti teks yang ditempel. Tidak ada yang dikirim sampai kamu memilih Periksa referensi.',
      'Server kami tidak menyimpan teksmu. Log kami hanya berisi id permintaan, jumlah referensi, waktu proses, dan kode galat. Log tidak pernah berisi teksmu.',
      'Kami mengikuti prinsip Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi: mengumpulkan seperlunya, memakainya untuk satu tujuan, dan tidak menyimpan yang tidak dibutuhkan. Ini gambaran cara kami bekerja, bukan pernyataan kepatuhan hukum.',
      'Jangan menempelkan informasi sensitif atau data pribadi. Daftar pustaka tidak membutuhkannya.',
    ],
    googleTerms: 'Baca ketentuan Google untuk Gemini API',
  },
  results: {
    progress: (n: number, total: number) => `${n} dari ${total} diperiksa`,
    checking: 'Memeriksa',
    filterLabel: 'Tampilkan hasil',
    all: 'Semua',
    showDetails: (n: number) => `Tampilkan rincian referensi ${n}`,
    hideDetails: (n: number) => `Sembunyikan rincian referensi ${n}`,
    exportCsv: 'Ekspor CSV',
    copyReport: 'Salin laporan',
    copied: 'Tersalin',
    copyFailed: 'Tidak bisa menyalin. Pilih teksnya lalu salin secara manual.',
    noneInFilter: 'Tidak ada referensi dengan hasil ini.',
    finished: (total: number) => `Pemeriksaan selesai. ${total} referensi diperiksa.`,
    barLabel: 'Hasil menurut verdict',
    printFiltered: 'Hanya menampilkan hasil {verdict}: {shown} dari {total}.',
  },
  evidence: {
    caption: (n: number) => `Referensi ${n} dibandingkan dengan record`,
    asCited: 'Seperti ditulis',
    recordFound: 'Record ditemukan ({source})',
    recordNone: 'Record ditemukan',
    status: 'Status',
    field: 'Field',
    noRecord:
      'Tidak ada record yang ditampilkan, karena tidak ada yang cukup dekat untuk dianggap karya ini.',
    openRecord: 'Buka record',
    scholar: 'Cari di Google Scholar',
    opensNewTab: 'terbuka di tab baru',
    nextStep: 'Langkah berikutnya',
    next: {
      verified:
        'Tidak ada yang perlu diperbaiki. Tetap baca sumbernya sebelum kamu mengandalkannya.',
      mismatch: 'Buka record-nya lalu perbaiki detail yang kamu tulis.',
      suspect:
        'Cari sumber ini secara manual. Kalau tidak ketemu, jangan pertahankan di daftar pustakamu.',
      out_of_index:
        'Periksa yang ini secara manual: cari judulnya, atau lihat di perpustakaan atau repositori kampusmu.',
      check_failed: 'Periksa lagi referensi ini sebentar lagi.',
    },
    details: 'Rincian',
    titleScore: 'Kemiripan judul',
    authorsScore: 'Penulis yang ditemukan',
    yearDiff: 'Selisih tahun',
    venueScore: 'Kemiripan venue',
    notCompared: 'tidak dibandingkan',
    readBy: 'Field dibaca oleh',
    readers: { llm: 'model bahasa', regex: 'pembaca pola, tanpa AI' },
    reasonCodes: 'Kode alasan',
    sourceType: 'Dibaca sebagai',
  },
  corrected: {
    title: 'Referensi yang dikoreksi (APA 7)',
    note: 'Ditulis dari record dengan aturan tetap, bukan oleh model bahasa. Cocokkan dengan sumbernya. Kamu masih perlu memiringkan nama jurnal dan volume, serta menulis judul artikel dengan huruf kapital hanya di awal kalimat (sentence case).',
    copy: 'Salin referensi',
    copied: 'Tersalin',
    copyFailed: 'Tidak bisa menyalin. Pilih teksnya lalu salin secara manual.',
  },
  sources: { crossref: 'Crossref', openalex: 'OpenAlex', datacite: 'DataCite' },
  types: {
    journal_article: 'artikel jurnal',
    book: 'buku',
    book_chapter: 'bab buku',
    conference_paper: 'makalah konferensi',
    thesis: 'skripsi atau tesis',
    report: 'laporan',
    web_page: 'halaman web',
    other: 'sumber jenis lain',
  },
  errors: {
    title: 'Pemeriksaan tidak selesai',
    generic: 'Ada masalah di sisi kami. Teksmu tidak disimpan. Coba lagi sebentar lagi.',
    network:
      'Kami tidak bisa menghubungi server. Teksmu tidak disimpan. Periksa koneksimu lalu coba lagi.',
    incomplete: 'Pemeriksaan berhenti sebelum selesai. Hasil yang tampil belum lengkap. Coba lagi.',
    rate_limited:
      'Kamu sudah mencapai batas pemeriksaan untuk saat ini. Tunggu beberapa menit lalu coba lagi.',
    too_many_references:
      'Kamu bisa memeriksa paling banyak {max} referensi sekaligus. Bagi daftarmu lalu periksa per bagian.',
    reference_too_long:
      'Referensi {n} lebih panjang dari {max} karakter. Pendekkan, atau pastikan itu memang satu referensi.',
    no_references: 'Tempel paling sedikit satu referensi untuk diperiksa.',
    tryAgain: 'Coba lagi',
  },
  workbench: {
    aiUnavailable:
      'Pembaca AI belum dipasang di server ini. Teksmu dibaca oleh pembaca pola di server kami, lalu dicari di Crossref dan OpenAlex. Kami tidak menyimpan teksmu.',
    shortcut: 'Ctrl+Enter',
    checkingButton: 'Memeriksa',
  },
  upload: {
    button: 'Unggah .txt atau .bib',
    hint: 'Berkas dibaca di browsermu lalu dimasukkan ke kotak, seperti teks yang ditempel. Sampai {max} KB.',
    added: (n: number, name: string) => `${n} referensi ditambahkan dari ${name}.`,
    skipped: (n: number) => `${n} entri tanpa judul tidak diikutkan.`,
    errors: {
      too_large: 'Berkas itu lebih besar dari {max} KB. Pecah dulu, lalu unggah sebagian-sebagian.',
      unsupported: 'Hanya berkas .txt dan .bib yang didukung.',
      empty: 'Tidak ada referensi yang ditemukan di berkas itu.',
      unreadable: 'Berkas itu tidak bisa dibaca sebagai teks.',
    },
  },
  split: {
    summary: (n: number) => `Periksa cara daftarmu dipecah (${n})`,
    hint: 'Tiap butir di bawah diperiksa sebagai satu referensi. Kalau ada referensi yang terpotong di tempat yang salah, gabungkan dengan referensi sebelumnya, atau ubah. Setiap perubahan menulis ulang kotak di atas menjadi satu referensi per paragraf.',
    item: (n: number) => `Referensi ${n}`,
    merge: 'Gabung dengan sebelumnya',
    mergeLabel: (n: number) => `Gabungkan referensi ${n} dengan referensi ${n - 1}`,
    edit: 'Ubah',
    editLabel: (n: number) => `Ubah referensi ${n}`,
    editHint:
      'Beri satu baris kosong di tempat sebuah referensi berakhir dan yang berikutnya mulai. Kosongkan teks untuk menghapus referensi.',
    apply: 'Terapkan',
    cancel: 'Batal',
    merged: (n: number, total: number) =>
      `Referensi ${n} digabung ke referensi ${n - 1}. ${total} terdeteksi.`,
    updated: (total: number) => `Referensi diubah. ${total} terdeteksi.`,
  },
  report: {
    title: 'Pemeriksaan referensi CekKutip',
    record: 'Record',
    totals:
      'Total {total}. Verified {verified}. Mismatch {mismatch}. Suspect {suspect}. Out-of-index {outOfIndex}. Tidak bisa diperiksa {checkFailed}.',
    tool: 'CekKutip {version}. Ambang: judul {tauT}, penulis {tauA}, judul rendah {tauL}, venue {tauV}.',
    filename: 'laporan-cekkutip',
  },
  notFound: {
    h1: 'Halaman tidak ditemukan',
    text: 'Halaman ini tidak ada. Kembali ke pemeriksa.',
    link: 'Ke pemeriksa',
  },
  dev: {
    todoBanner:
      'Masih ada placeholder di site.config.ts. Build produksi akan gagal sampai semuanya diisi:',
  },
}

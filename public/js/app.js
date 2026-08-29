(() => {
  'use strict';

  const APP_VERSION = 'v3.24';
  try { document.getElementById('appVersion').textContent = `Versi ${APP_VERSION}`; } catch {}

  const $ = (sel, el = document) => el.querySelector(sel);

  const ICONS = {
    pencil:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    link:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    star:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26 6.6 1.01-4.75 4.38L17.9 20 12 16.6 6.1 20l1.15-6.35L2.5 9.27l6.6-1.01z"/></svg>',
    user:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    alert:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    book:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    folder:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    list:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    plus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    folderPlus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>'
  };

  const STATUS_LABEL = { membaca: 'Membaca', ongoing: 'Ongoing', selesai: 'Selesai', ditunda: 'Ditunda', drop: 'Drop' };
  const STATUS_ORDER = ['semua', 'membaca', 'ongoing', 'selesai', 'ditunda', 'drop'];
  const state = {
    stories: [],
    lists: [],
    filterList: null,
    user: null,
    loaded: false,
    loadFailed: false,
    q: '',
    status: 'semua',
    sort: 'terbaru',
    page: 1
  };

  let pendingDeleteId = null;
  let lastFocus = null;
  let fetchingStory = false;
  let lastAutoFetchKey = '';
  const PER_PAGE = 10;
  const MAX_PAGE_BUTTONS = 7;
  const WATTPAD_URL_RE = /^https?:\/\/(www\.|m\.)?wattpad\.com\/story\/[A-Za-z0-9][^#\s]*(?:#.*)?$/i;
  const EMAIL_CLIENT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const els = {
    grid: $('#grid'),
    empty: $('#emptyState'),
    pagination: $('#pagination'),
    emptyTitle: $('#emptyTitle'),
    emptyText: $('#emptyText'),
    btnRetry: $('#btnRetry'),
    statTotal: $('#statTotal'),
    statReading: $('#statReading'),
    statOngoing: $('#statOngoing'),
    statDone: $('#statDone'),
    statPaused: $('#statPaused'),
    statusChips: $('#statusChips'),
    sortSelect: null,
    searchInput: $('#searchInput'),
    storyModal: $('#storyModal'),
    confirmModal: $('#confirmModal'),
    storyForm: $('#storyForm'),
    modalTitle: $('#modalTitle'),
    formError: $('#formError'),
    btnSave: $('#btnSave'),
    starInput: $('#starInput'),
    ratingValue: $('#ratingValue'),
    ratingHint: $('#ratingHint'),
    confirmTitle: $('#confirmTitle'),
    confirmText: $('#confirmText'),
    confirmOk: $('#confirmOk'),
    toasts: $('#toasts'),
    btnFetch: $('#btnFetch'),
    btnFetchLabel: $('#btnFetchLabel'),
    fetchHint: $('#fetchHint'),
    readerOverlay: $('#readerOverlay'),
    readerClose: $('#readerClose'),
    readerStory: $('#readerStory'),
    readerChapter: $('#readerChapter'),
    readerListBtn: $('#readerListBtn'),
    readerSidebar: $('#readerSidebar'),
    sidebarClose: $('#sidebarClose'),
    chapterList: $('#chapterList'),
    readerBody: $('#readerBody'),
    readerContent: $('#readerContent'),
    readerPrev: $('#readerPrev'),
    readerNext: $('#readerNext'),
    readerPos: $('#readerPos'),
    fontMinus: $('#fontMinus'),
    fontPlus: $('#fontPlus'),
    readerProgressBar: $('#readerProgressBar'),
    readerProgressWrap: $('.reader-progress'),
    readerTimeTotal: $('#readerTimeTotal'),
    readerTimeLeft: $('#readerTimeLeft'),
    btnLists: $('#btnLists'),
    listsModal: $('#listsModal'),
    newListForm: $('#newListForm'),
    newListName: $('#newListName'),
    listError: $('#listError'),
    listsManageWrap: $('#listsManageWrap'),
    listChips: $('#listChips'),
    listFilterWrap: $('#listFilterWrap'),
    formListField: $('#formListField'),
    formListSection: $('#formListSection'),
    formListChecks: $('#formListChecks'),
    formQuickListName: $('#formQuickListName'),
    btnFormAddList: $('#btnFormAddList'),
    quickListError: $('#quickListError'),
    authScreen: $('#authScreen'),
    authForm: $('#authForm'),
    authEmail: $('#authEmail'),
    authPassword: $('#authPassword'),
    authError: $('#authError'),
    btnAuthSubmit: $('#btnAuthSubmit'),
    tabLogin: $('#tabLogin'),
    tabRegister: $('#tabRegister'),
    userArea: $('#userArea'),
    btnLogout: $('#btnLogout'),
    btnNotif: $('#btnNotif'),
    notifBadge: $('#notifBadge'),
    notifPanel: $('#notifPanel'),
    notifList: $('#notifList'),
    btnCheckNow: $('#btnCheckNow'),
    notifPermPrompt: $('#notifPermPrompt'),
    btnNotifPerm: $('#btnNotifPerm'),
    detailOverlay: $('#detailOverlay'),
    detClose: $('#detClose'),
    detCover: $('#detCover'),
    detTitle: $('#detTitle'),
    detAuthor: $('#detAuthor'),
    detParts: $('#detParts'),
    detStars: $('#detStars'),
    detStatus: $('#detStatus'),
    detProgress: $('#detProgress'),
    detRead: $('#detRead'),
    detEdit: $('#detEdit'),
    detExt: $('#detExt'),
    detTabs: $('#detTabs'),
    detBabCount: $('#detBabCount'),
    detPaneSummary: $('#detPaneSummary'),
    detPaneBab: $('#detPaneBab'),
    detSummaryStatus: $('#detSummaryStatus'),
    detSummaryGenre: $('#detSummaryGenre'),
    detSummaryGenreWrap: $('#detSummaryGenreWrap'),
    detSummaryList: $('#detSummaryList'),
    detSummaryListWrap: $('#detSummaryListWrap'),
    detSummaryAdded: $('#detSummaryAdded'),
    detDesc: $('#detDesc'),
    detToc: $('#detToc'),
    detTocMsg: $('#detTocMsg'),
    notifCountdown: $('#notifCountdown'),
    notifCountdownText: $('#notifCountdownText'),
    userChip: $('#userChip'),
    profileModal: $('#profileModal'),
    profileForm: $('#profileForm'),
    passwordForm: $('#passwordForm'),
    profAvatar: $('#profAvatar'),
    profNameDisplay: $('#profNameDisplay'),
    profEmail: $('#profEmail'),
    profName: $('#profName'),
    profError: $('#profError'),
    btnAvatarPick: $('#btnAvatarPick'),
    avatarInput: $('#avatarInput'),
    btnAvatarRemove: $('#btnAvatarRemove'),
    pwdCurrent: $('#pwdCurrent'),
    pwdNew: $('#pwdNew'),
    pwdConfirm: $('#pwdConfirm'),
    pwdError: $('#pwdError'),
    discordForm: $('#discordForm'),
    discordEnabled: $('#discordEnabled'),
    discordFields: $('#discordFields'),
    discordWebhook: $('#discordWebhook'),
    discordRoleId: $('#discordRoleId'),
    checkIntervalMin: $('#checkIntervalMin'),
    discordError: $('#discordError'),
    btnTestWebhook: $('#btnTestWebhook'),
    discordStatusDot: $('#discordStatusDot'),
    discordStatusText: $('#discordStatusText'),
    btnDiscordSave: $('#btnDiscordSave')
  };

  const nf = new Intl.NumberFormat('id-ID');
  const dfmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const isHttpUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  async function request(url, opts = {}) {
    const init = { credentials: 'same-origin', method: opts.method || 'GET' };
    if (opts.json !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(opts.json);
    }
    let res;
    try {
      res = await fetch(url, init);
    } catch {
      throw new Error('Tidak dapat terhubung ke server.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.status = res.status;
      if (res.status === 401 && !url.startsWith('/api/auth/')) {
        showAuthScreen();
      }
      throw err;
    }
    if (data === null) throw new Error('Respons server tidak valid.');
    return data;
  }

  function toast(type, message) {
    while (els.toasts.children.length >= 4) els.toasts.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = type === 'success' ? ICONS.check : type === 'error' ? ICONS.alert : ICONS.info;
    const span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
    els.toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => { if (el.parentNode) el.remove(); }, 1000);
    }, 3200);
  }

  function initialsOf(title) {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    const first = [...words[0]][0] || '';
    const second = words.length > 1 ? ([...words[1]][0] || '') : '';
    return (first + second).toUpperCase();
  }

  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function makeFallbackCover(story) {
    const div = document.createElement('div');
    div.className = `cover-fallback g${hashCode(story.title) % 6}`;
    const span = document.createElement('span');
    span.textContent = initialsOf(story.title);
    div.appendChild(span);
    return div;
  }

  function makeStars(rating) {
    const wrap = document.createElement('span');
    wrap.className = 'stars';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.innerHTML = ICONS.star;
      const svg = s.firstChild;
      if (i < rating) svg.classList.add('on');
      wrap.appendChild(svg);
    }
    if (rating > 0) {
      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = `${rating}/5`;
      wrap.appendChild(score);
    }
    return wrap;
  }

  function buildCard(story, idx) {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.setProperty('--i', String(idx % 12));

    const media = document.createElement('div');
    media.className = 'card-media';

    if (isHttpUrl(story.cover)) {
      const img = document.createElement('img');
      img.className = 'card-cover-img';
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => {
        img.remove();
        media.appendChild(makeFallbackCover(story));
      }, { once: true });
      img.src = story.cover;
      media.appendChild(img);
    } else {
      media.appendChild(makeFallbackCover(story));
    }

    card.appendChild(media);

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = story.title;
    body.appendChild(title);

    if (story.author) {
      const author = document.createElement('p');
      author.className = 'card-author';
      author.innerHTML = ICONS.user;
      author.appendChild(document.createTextNode(story.author));
      author.title = `oleh ${story.author}`;
      body.appendChild(author);
    }

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    if (story.genre) {
      const tag = document.createElement('span');
      tag.className = 'genre-tag';
      tag.textContent = story.genre;
      meta.appendChild(tag);
    }
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge st-${story.status}`;
    statusBadge.textContent = STATUS_LABEL[story.status];
    meta.appendChild(statusBadge);

    meta.appendChild(makeStars(story.rating));
    const listNames = storyListNames(story);
    if (listNames.length) {
      const lb = document.createElement('span');
      lb.className = 'list-badge';
      lb.innerHTML = ICONS.folder;
      lb.appendChild(document.createTextNode(String(listNames.length)));
      lb.title = `List: ${listNames.join(', ')}`;
      meta.appendChild(lb);
    }
    if (meta.childElementCount > 0) body.appendChild(meta);

    if (story.notes) {
      const notes = document.createElement('p');
      notes.className = 'card-notes';
      notes.textContent = story.notes;
      notes.title = story.notes;
      body.appendChild(notes);
    }

    if (story.chaptersTotal > 0) {
      const pct = Math.min(100, Math.round((story.chaptersRead / story.chaptersTotal) * 100));
      const pw = document.createElement('div');
      pw.className = 'progress-wrap';
      const label = document.createElement('div');
      label.className = 'progress-label';
      const l1 = document.createElement('span');
      l1.textContent = `${nf.format(story.chaptersRead)} / ${nf.format(story.chaptersTotal)} bab`;
      const l2 = document.createElement('span');
      l2.textContent = `${pct}%`;
      label.append(l1, l2);
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);
      pw.append(label, bar);
      body.appendChild(pw);
    } else if (story.chaptersRead > 0) {
      const pw = document.createElement('div');
      pw.className = 'progress-wrap';
      const label = document.createElement('div');
      label.className = 'progress-label';
      const l1 = document.createElement('span');
      l1.textContent = `${nf.format(story.chaptersRead)} bab dibaca`;
      label.appendChild(l1);
      pw.appendChild(label);
      body.appendChild(pw);
    }

    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const wid = wattpadIdOf(story);
    if (wid) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card-link btn-baca';
      b.innerHTML = `${ICONS.book}<span>Baca</span>`;
      b.setAttribute('aria-label', `Baca ${story.title}`);
      b.addEventListener('click', () => openReader(story));
      foot.appendChild(b);
    } else if (isHttpUrl(story.url)) {
      const a = document.createElement('a');
      a.className = 'card-link';
      a.href = story.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow';
      a.innerHTML = `${ICONS.link}<span>Buka</span>`;
      a.setAttribute('aria-label', `Buka cerita ${story.title} di Wattpad`);
      foot.appendChild(a);
    }

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    if (wid && isHttpUrl(story.url)) {
      const ext = document.createElement('a');
      ext.className = 'mini-btn';
      ext.href = story.url;
      ext.target = '_blank';
      ext.rel = 'noopener noreferrer nofollow';
      ext.innerHTML = ICONS.link;
      ext.title = 'Buka di Wattpad';
      ext.setAttribute('aria-label', `Buka ${story.title} di browser`);
      actions.appendChild(ext);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'mini-btn';
    editBtn.innerHTML = ICONS.pencil;
    editBtn.title = `Edit ${story.title} (ditambahkan ${dfmt.format(new Date(story.createdAt))})`;
    editBtn.setAttribute('aria-label', `Edit cerita ${story.title}`);
    editBtn.addEventListener('click', () => openStoryModal(story));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'mini-btn danger';
    delBtn.innerHTML = ICONS.trash;
    delBtn.title = 'Hapus cerita';
    delBtn.setAttribute('aria-label', `Hapus cerita ${story.title}`);
    delBtn.addEventListener('click', () => openConfirmDelete(story));
    actions.appendChild(delBtn);

    foot.appendChild(actions);
    body.appendChild(foot);
    card.appendChild(body);
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-foot, .mini-btn, .card-link, .progress-wrap')) return;
      openDetail(story);
    });
    return card;
  }

  function applyFilters() {
    const q = state.q.trim().toLowerCase();
    let list = state.stories.filter((s) => {
      if (state.status !== 'semua' && s.status !== state.status) return false;
      if (state.filterList && !(Array.isArray(s.listIds) && s.listIds.includes(state.filterList))) return false;
      if (q) {
        const hay = `${s.title} ${s.author} ${s.notes} ${s.genre}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const byTitle = (a, b) => a.title.localeCompare(b.title, 'id', { sensitivity: 'base' });
    switch (state.sort) {
      case 'terlama':
        list = [...list].sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'judul':
        list = [...list].sort(byTitle);
        break;
      case 'rating':
        list = [...list].sort((a, b) => b.rating - a.rating || b.createdAt - a.createdAt);
        break;
      default:
        list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }

  function setStat(el, value) {
    const txt = nf.format(value);
    if (el.textContent !== txt) {
      el.textContent = txt;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  function renderStats() {
    const s = state.stories;
    setStat(els.statTotal, s.length);
    setStat(els.statReading, s.filter((x) => x.status === 'membaca').length);
    setStat(els.statOngoing, s.filter((x) => x.status === 'ongoing').length);
    setStat(els.statDone, s.filter((x) => x.status === 'selesai').length);
    setStat(els.statPaused, s.filter((x) => x.status === 'ditunda').length);
  }

  function renderChips() {
    const counts = { semua: state.stories.length };
    for (const st of STATUS_ORDER.slice(1)) {
      counts[st] = state.stories.reduce((n, s) => n + (s.status === st ? 1 : 0), 0);
    }
    els.statusChips.replaceChildren(
      ...STATUS_ORDER.map((st) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip${state.status === st ? ' active' : ''}`;
        btn.dataset.status = st;
        btn.textContent = st === 'semua' ? 'Semua' : STATUS_LABEL[st];
        const c = document.createElement('span');
        c.className = 'count';
        c.textContent = String(counts[st]);
        btn.appendChild(c);
        btn.setAttribute('aria-pressed', String(state.status === st));
        return btn;
      })
    );
  }

  function renderGrid() {
    const list = applyFilters();
    if (!state.loaded && !state.loadFailed) {
      els.grid.replaceChildren(
        ...Array.from({ length: 8 }, () => {
          const sk = document.createElement('div');
          sk.className = 'skeleton-card';
          return sk;
        })
      );
      els.empty.hidden = true;
      return;
    }
    if (list.length === 0) {
      els.grid.replaceChildren();
      els.empty.hidden = false;
      if (!state.loaded) {
        els.emptyTitle.textContent = state.loadFailed ? 'Gagal memuat data' : 'Memuat…';
        els.emptyText.textContent = state.loadFailed
          ? 'Periksa apakah server masih berjalan, lalu coba lagi.'
          : 'Mengambil data cerita dari server…';
        els.btnRetry.hidden = !state.loadFailed;
        $('#btnAddEmpty').hidden = !state.loaded;
      } else if (state.stories.length === 0) {
        els.emptyTitle.textContent = 'Belum ada cerita';
        els.emptyText.textContent = 'Simpan cerita pertamamu dan mulai bangun rak bacaan digitalmu.';
        els.btnRetry.hidden = true;
        $('#btnAddEmpty').hidden = false;
      } else {
        els.emptyTitle.textContent = 'Tidak ada hasil';
        els.emptyText.textContent = 'Tidak ada cerita yang cocok dengan pencarian atau filtermu.';
        els.btnRetry.hidden = true;
        $('#btnAddEmpty').hidden = false;
      }
      return;
    }
    els.empty.hidden = true;
    els.grid.replaceChildren(...list.map((s, i) => buildCard(s, i)));
  }

  function renderAll() {
    renderStats();
    renderChips();
    renderListUI();
    renderGrid();
  }

  async function load() {
    state.loaded = false;
    state.loadFailed = false;
    renderGrid();
    try {
      const [data, ld] = await Promise.all([
        request('/api/stories'),
        request('/api/lists').catch(() => ({ lists: [] }))
      ]);
      state.stories = Array.isArray(data?.stories) ? data.stories : [];
      state.lists = Array.isArray(ld?.lists) ? ld.lists : [];
      state.loaded = true;
      renderAll();
    } catch (err) {
      state.loaded = true;
      state.loadFailed = true;
      renderGrid();
      toast('error', err.message);
    }
  }

  const tocCache = new Map();
  let detCurrent = null;
  let countdownTimer = null;
  let nextCheckAt = null;
  let checkInterval = 1800;
  let detTocToken = 0;
  let lastUnread = 0;
  let notifPermission = 'default';

  function detPill(text, cls) {
    const s = document.createElement('span');
    s.className = cls || 'genre-tag';
    s.textContent = text;
    return s;
  }

  function detBuildProgress(story) {
    const wrap = document.createElement('div');
    wrap.className = 'pw-inner';
    const pct = Math.min(100, Math.round((story.chaptersRead / story.chaptersTotal) * 100));
    const label = document.createElement('div');
    label.className = 'progress-label';
    const l1 = document.createElement('span');
    l1.textContent = `${nf.format(story.chaptersRead)} / ${nf.format(story.chaptersTotal)} bab`;
    const l2 = document.createElement('span');
    l2.textContent = `${pct}%`;
    label.append(l1, l2);
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    wrap.append(label, bar);
    return wrap;
  }

  function detFill(story) {
    const cw = els.detCover;
    cw.replaceChildren();
    if (isHttpUrl(story.cover)) {
      const img = document.createElement('img');
      img.alt = story.title;
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => {
        img.remove();
        cw.appendChild(makeFallbackCover(story));
      }, { once: true });
      img.src = story.cover;
      cw.appendChild(img);
    } else {
      cw.appendChild(makeFallbackCover(story));
    }
    els.detTitle.textContent = story.title;
    els.detAuthor.textContent = story.author || 'Penulis tidak diketahui';
    const partsVal = els.detParts.querySelector('.val');
    if (partsVal) partsVal.textContent = story.chaptersTotal > 0 ? `${nf.format(story.chaptersTotal)} parts` : '– parts';
    els.detStars.replaceChildren(makeStars(story.rating));
    const stLabel = STATUS_LABEL[story.status] || '';
    els.detStatus.textContent = stLabel;
    els.detStatus.className = `st-${story.status}`;
    els.detProgress.replaceChildren();
    els.detProgress.hidden = !(story.chaptersTotal > 0 || story.chaptersRead > 0);
    if (story.chaptersTotal > 0) {
      els.detProgress.appendChild(detBuildProgress(story));
    } else if (story.chaptersRead > 0) {
      const l = document.createElement('div');
      l.className = 'progress-label';
      const s = document.createElement('span');
      s.textContent = `${nf.format(story.chaptersRead)} bab dibaca`;
      l.appendChild(s);
      els.detProgress.appendChild(l);
    }
    els.detDesc.textContent = story.notes || 'Belum ada ringkasan. Klik Edit untuk menambahkan catatan cerita ini.';
    els.detDesc.classList.toggle('empty', !story.notes);
    const stBadge = document.createElement('span');
    stBadge.className = `badge st-${story.status}`;
    stBadge.textContent = STATUS_LABEL[story.status] || '';
    els.detSummaryStatus.replaceChildren(stBadge);
    if (story.genre) {
      els.detSummaryGenre.textContent = story.genre;
      els.detSummaryGenreWrap.hidden = false;
    } else {
      els.detSummaryGenreWrap.hidden = true;
    }
    const ln = storyListNames(story);
    if (ln.length) {
      els.detSummaryList.textContent = ln.join(', ');
      els.detSummaryListWrap.hidden = false;
    } else {
      els.detSummaryListWrap.hidden = true;
    }
    els.detSummaryAdded.textContent = dfmt.format(new Date(story.createdAt));
    const wid = wattpadIdOf(story);
    const hasUrl = isHttpUrl(story.url);
    els.detExt.hidden = !(wid && hasUrl);
    if (!els.detExt.hidden) els.detExt.href = story.url;
    els.detRead.disabled = !wid;
  }

  function detSwitchTab(name) {
    [...els.detTabs.children].forEach((b) => b.classList.toggle('on', b.dataset.dtab === name));
    els.detPaneSummary.hidden = name !== 'ringkasan';
    els.detPaneBab.hidden = name !== 'bab';
  }

  async function loadDetToc(story) {
    const wid = wattpadIdOf(story);
    detTocToken += 1;
    const token = detTocToken;
    els.detToc.replaceChildren();
    els.detBabCount.textContent = '…';
    if (!wid) {
      els.detTocMsg.textContent = 'Cerita belum tertaut ke Wattpad.';
      return;
    }
    els.detTocMsg.textContent = 'Memuat daftar bab…';
    try {
      let parts = tocCache.get(wid);
      if (!parts) {
        const res = await request(`/api/wattpad/${wid}/parts`);
        parts = Array.isArray(res?.parts) ? res.parts : [];
        tocCache.set(wid, parts);
        if (tocCache.size > 60) tocCache.delete(tocCache.keys().next().value);
      }
      if (token !== detTocToken) return;
      els.detBabCount.textContent = String(parts.length);
      if (parts.length) {
        const pv = els.detParts.querySelector('.val');
        if (pv) pv.textContent = `${nf.format(parts.length)} parts`;
      }
      if (!parts.length) {
        els.detTocMsg.textContent = 'Cerita ini tidak memiliki bab.';
        return;
      }
      els.detTocMsg.textContent = '';
      els.detToc.replaceChildren(...parts.map((p, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toc-row';
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = `${i + 1}.`;
        const t = document.createElement('span');
        t.className = 't';
        t.textContent = p.title || `Bab ${i + 1}`;
        btn.append(num, t);
        const ts = p.dateCreated || p.dateUpdated;
        if (ts) {
          const d = document.createElement('span');
          d.className = 'toc-date';
          const dt = new Date(ts > 1e12 ? ts : ts * 1000);
          const now = Date.now();
          const diff = now - dt.getTime();
          const mo = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
          const pad = (n) => String(n).padStart(2, '0');
          const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
          if (diff < 86400000) {
            d.textContent = `Hari ini ${time}`;
          } else {
            d.textContent = `${dt.getDate()} ${mo[dt.getMonth()]} ${dt.getFullYear()} ${time}`;
          }
          btn.appendChild(d);
        }
        btn.addEventListener('click', () => {
          const s = detCurrent;
          closeDetail();
          if (s) openReader(s, i);
        });
        li.appendChild(btn);
        return li;
      }));
    } catch (err) {
      if (token === detTocToken) els.detTocMsg.textContent = err.message;
    }
  }

  function openDetail(story) {
    detCurrent = story;
    detFill(story);
    detSwitchTab('ringkasan');
    els.detailOverlay.hidden = false;
    document.body.classList.add('no-scroll');
    loadDetToc(story);
    els.detClose.focus({ preventScroll: true });
  }

  function closeDetail() {
    if (els.detailOverlay.hidden) return;
    els.detailOverlay.hidden = true;
    detCurrent = null;
    if (els.readerOverlay.hidden) document.body.classList.remove('no-scroll');
  }

  els.detailOverlay.addEventListener('click', (e) => {
    if (e.target.closest('.detail-page, .det-close')) return;
    closeDetail();
  });

  els.detClose.addEventListener('click', closeDetail);

  [...els.detTabs.children].forEach((b) => b.addEventListener('click', () => detSwitchTab(b.dataset.dtab)));

  els.detRead.addEventListener('click', () => {
    const s = detCurrent;
    if (!s) return;
    closeDetail();
    openReader(s);
  });

  els.detEdit.addEventListener('click', () => {
    const s = detCurrent;
    if (!s) return;
    closeDetail();
    openStoryModal(s);
  });

  function mergeStory(story) {
    const i = state.stories.findIndex((s) => s.id === story.id);
    if (i >= 0) state.stories[i] = story;
    else state.stories.push(story);
    renderAll();
  }

  function removeStory(id) {
    state.stories = state.stories.filter((s) => s.id !== id);
    renderAll();
  }

  function escNotif(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderNotifications(data) {
    const items = Array.isArray(data?.items) ? data.items : [];
    const unread = typeof data?.unread === 'number' ? data.unread : items.filter((i) => i.isNew).length;
    els.notifBadge.hidden = unread === 0;
    els.notifBadge.textContent = unread > 99 ? '99+' : String(unread);
    if (typeof data?.nextCheckAt === 'number') nextCheckAt = data.nextCheckAt;
    if (typeof data?.interval === 'number') checkInterval = data.interval * 60;
    updateCountdown();
    if (!items.length) {
      els.notifList.innerHTML = '<p class="notif-empty">Belum ada pembaruan. Cerita yang masuk list diperiksa otomatis setiap saat.</p>';
      return;
    }
    els.notifList.innerHTML = items.map((it) => `
      <div class="notif-item${it.isNew ? ' is-new' : ''}" data-sid="${escNotif(it.storyId)}">
        <button type="button" class="notif-info notif-open" title="Buka cerita">
          <strong>${escNotif(it.title || 'Cerita')}</strong>
          <span>${it.isNew ? escNotif(`Bab baru terdeteksi: ${it.known} → ${it.latest}`) : escNotif(`Terkini: ${it.latest} bab`)}</span>
        </button>
        ${it.isNew ? `<button type="button" class="btn btn-primary btn-xs" data-seen="${escNotif(it.storyId)}">Tandai dibaca</button>` : ''}
      </div>`).join('');
  }

  let countdownTriggered = false;
  let quickCheckEnd = 0;
  function updateCountdown() {
    if (nextCheckAt === null) {
      els.notifCountdownText.textContent = 'Memuat...';
      return;
    }
    const now = Date.now();
    const effective = quickCheckEnd > now ? quickCheckEnd : nextCheckAt;
    const diff = Math.max(0, effective - now);
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    els.notifCountdownText.textContent = diff > 0 ? `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : 'Memeriksa sekarang...';
    if (diff <= 0 && !countdownTriggered) {
      countdownTriggered = true;
      quickCheckEnd = 0;
      refreshNotifications().then(() => { countdownTriggered = false; });
    }
  }

  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateCountdown, 1000);
  }

  async function refreshNotifications() {
    if (!state.user) return;
    try {
      const data = await request('/api/updates');
      const newUnread = typeof data?.unread === 'number' ? data.unread : 0;
      if (newUnread > lastUnread && lastUnread > 0 && notifPermission === 'granted' && document.hidden) {
        const fresh = (data.items || []).filter((i) => i.isNew);
        if (fresh.length) {
          const title = fresh.length === 1 ? fresh[0].title || 'Cerita' : fresh.length + ' cerita diperbarui';
          const body = fresh.length === 1
            ? 'Bab baru tersedia: ' + fresh[0].latest + ' bab'
            : fresh.slice(0, 3).map((i) => i.title || 'Cerita').join(', ') + (fresh.length > 3 ? ' ...' : '');
          try { new Notification(title, { body, icon: '/favicon.svg', tag: 'hideo-update', renotify: true }); } catch {}
        }
      }
      const prevUnread = lastUnread;
      lastUnread = newUnread;
      renderNotifications(data);
      if (newUnread > prevUnread && newUnread > 0) {
        await load();
      }
    } catch {}
  }

  let modalFocusTrap = null;

  function openModal(backdrop) {
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add('no-scroll');
    const target =
      backdrop.querySelector('input:not([type="hidden"]), textarea, select') ||
      backdrop.querySelector('button');
    if (target) target.focus({ preventScroll: true });
    modalFocusTrap = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = backdrop.querySelectorAll('input:not([type="hidden"]), textarea, select, button:not([hidden]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    backdrop.addEventListener('keydown', modalFocusTrap);
  }

  function closeModal(backdrop) {
    backdrop.hidden = true;
    if (modalFocusTrap) { backdrop.removeEventListener('keydown', modalFocusTrap); modalFocusTrap = null; }
    if (!$('.modal-backdrop:not([hidden])')) document.body.classList.remove('no-scroll');
    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch {}
    }
  }

  function listById(id) {
    return state.lists.find((l) => l.id === id) || null;
  }

  function storyListNames(story) {
    if (!Array.isArray(story.listIds)) return [];
    return story.listIds.map((id) => listById(id)?.name).filter(Boolean);
  }

  function renderListUI() {
    const hasLists = state.lists.length > 0;
    els.listFilterWrap.hidden = !hasLists;
    els.formListSection.hidden = false;
    els.formListField.hidden = !hasLists;
    if (!hasLists) {
      els.listChips.replaceChildren();
      els.formListChecks.replaceChildren();
      if (state.filterList) {
        state.filterList = null;
        renderGrid();
      }
      return;
    }
    const countIn = (id) =>
      state.stories.reduce((n, s) => n + (Array.isArray(s.listIds) && s.listIds.includes(id) ? 1 : 0), 0);
    const kept = new Set(
      [...els.formListChecks.querySelectorAll('input:checked')].map((cb) => cb.value)
    );
    els.listChips.replaceChildren(
      ...state.lists.map((l) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip${state.filterList === l.id ? ' active' : ''}`;
        btn.dataset.listId = l.id;
        btn.textContent = l.name;
        const c = document.createElement('span');
        c.className = 'count';
        c.textContent = String(countIn(l.id));
        btn.appendChild(c);
        return btn;
      })
    );
    els.formListChecks.replaceChildren();
    for (const l of state.lists) {
      els.formListChecks.appendChild(buildListCheck(l, kept.has(l.id)));
    }
  }

  function buildListCheck(list, checked) {
    const label = document.createElement('label');
    label.className = 'list-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = list.id;
    cb.checked = checked;

    const box = document.createElement('span');
    box.className = 'list-check-box';
    const icon = document.createElement('span');
    icon.className = 'list-check-icon';
    icon.innerHTML = ICONS.folder;
    const body = document.createElement('span');
    body.className = 'list-check-body';
    const name = document.createElement('strong');
    name.className = 'list-check-name';
    name.textContent = list.name;
    body.appendChild(name);
    const count = state.lists
      ? state.stories.reduce((n, s) => n + (Array.isArray(s.listIds) && s.listIds.includes(list.id) ? 1 : 0), 0)
      : 0;
    const meta = document.createElement('small');
    meta.className = 'list-check-count';
    meta.textContent = `${count} cerita`;
    body.appendChild(meta);

    const tick = document.createElement('span');
    tick.className = 'list-check-tick';
    tick.innerHTML = ICONS.check;

    box.append(icon, body, tick);
    label.append(cb, box);
    return label;
  }

  function renderListChecks(story) {
    els.formListChecks.replaceChildren();
    const ids = Array.isArray(story?.listIds) ? story.listIds : [];
    for (const l of state.lists) {
      els.formListChecks.appendChild(buildListCheck(l, ids.includes(l.id)));
    }
  }

  function collectListIds() {
    return [...els.formListChecks.querySelectorAll('input:checked')].map((cb) => cb.value);
  }

  function renderListsManage() {
    els.listsManageWrap.replaceChildren();
    if (!state.lists.length) {
      const empty = document.createElement('div');
      empty.className = 'manage-empty';
      const icon = document.createElement('span');
      icon.className = 'manage-empty-icon';
      icon.innerHTML = ICONS.folderPlus;
      const msg = document.createElement('p');
      msg.textContent = 'Belum ada list. Buat list pertamamu di atas, misalnya "Rekomendasi" atau "Baca Ulang".';
      empty.append(icon, msg);
      els.listsManageWrap.appendChild(empty);
      return;
    }
    for (const l of state.lists) {
      const row = document.createElement('div');
      row.className = 'manage-row';
      row.dataset.listId = l.id;

      const icon = document.createElement('span');
      icon.className = 'manage-icon';
      icon.innerHTML = ICONS.folder;

      const info = document.createElement('div');
      info.className = 'manage-info';
      const nameEl = document.createElement('span');
      nameEl.className = 'manage-name';
      nameEl.textContent = l.name;
      const cnt = state.stories.reduce(
        (n, s) => n + (Array.isArray(s.listIds) && s.listIds.includes(l.id) ? 1 : 0),
        0
      );
      const meta = document.createElement('span');
      meta.className = 'manage-count';
      meta.textContent = `${cnt} cerita`;
      info.append(nameEl, meta);
      row.append(icon, info);

      const actions = document.createElement('div');
      actions.className = 'manage-actions';
      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'icon-btn sm';
      renameBtn.innerHTML = ICONS.pencil;
      renameBtn.setAttribute('aria-label', `Ganti nama list ${l.name}`);
      renameBtn.title = 'Ganti nama';
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-btn sm danger';
      delBtn.innerHTML = ICONS.trash;
      delBtn.setAttribute('aria-label', `Hapus list ${l.name}`);
      delBtn.title = 'Hapus list';
      actions.append(renameBtn, delBtn);
      row.appendChild(actions);
      els.listsManageWrap.appendChild(row);
    }
  }

  function startInlineRename(row, list) {
    const info = row.querySelector('.manage-info');
    const actions = row.querySelector('.manage-actions');
    const icon = row.querySelector('.manage-icon');
    if (!info || !actions || row.querySelector('.rename-input')) return;
    info.style.display = 'none';
    actions.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.maxLength = 60;
    input.value = list.name;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary btn-xs';
    saveBtn.textContent = 'Simpan';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost btn-xs';
    cancelBtn.textContent = 'Batal';

    const restore = () => {
      if (renameBar) renameBar.remove();
      info.style.display = '';
      actions.style.display = '';
    };

    const submit = async () => {
      const name = input.value.trim();
      if (!name || name === list.name) {
        restore();
        return;
      }
      try {
        const res = await request(`/api/lists/${encodeURIComponent(list.id)}`, {
          method: 'PUT',
          json: { name }
        });
        const idx = state.lists.findIndex((l) => l.id === list.id);
        if (idx !== -1) state.lists[idx] = res.list;
        renderAll();
        renderListsManage();
        toast('success', 'Nama list diperbarui.');
      } catch (err) {
        toast('error', err.message);
      }
      restore();
    };

    saveBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', restore);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        restore();
      }
    });
    const renameBar = document.createElement('div');
    renameBar.className = 'rename-bar';
    renameBar.append(input, saveBtn, cancelBtn);
    if (icon) icon.after(renameBar);
    else row.prepend(renameBar);
    input.focus({ preventScroll: true });
    input.select();
  }

  async function deleteList(list, btn) {
    if (btn.dataset.arm !== '1') {
      btn.dataset.arm = '1';
      btn.classList.add('arming');
      btn.title = 'Klik lagi untuk menghapus';
      setTimeout(() => {
        btn.dataset.arm = '';
        btn.classList.remove('arming');
        btn.title = 'Hapus list';
      }, 2500);
      return;
    }
    btn.disabled = true;
    try {
      await request(`/api/lists/${encodeURIComponent(list.id)}`, { method: 'DELETE' });
      state.lists = state.lists.filter((l) => l.id !== list.id);
      for (const s of state.stories) {
        if (Array.isArray(s.listIds)) s.listIds = s.listIds.filter((id) => id !== list.id);
      }
      renderAll();
      renderListsManage();
      toast('success', `List "${list.name}" dihapus. Cerita tidak ikut terhapus.`);
    } catch (err) {
      toast('error', err.message);
      btn.disabled = false;
    }
  }

  function setStarInput(value) {
    const v = Math.min(5, Math.max(0, Math.trunc(Number(value) || 0)));
    els.ratingValue.value = String(v);
    [...els.starInput.children].forEach((btn, i) => {
      btn.classList.toggle('on', i < v);
      btn.setAttribute('aria-checked', String(i + 1 === v));
    });
    if (els.ratingHint) {
      els.ratingHint.textContent = v > 0 ? `${v} / 5 bintang` : 'Tap bintang untuk memberi nilai';
    }
  }

  function openStoryModal(story) {
    els.storyForm.reset();
    els.formQuickListName.value = '';
    els.quickListError.hidden = true;
    renderListChecks(story);
    setStarInput(0);
    els.formError.hidden = true;
    lastAutoFetchKey = '';
    setFetchHint('Tempel tautan cerita, judul & penulis terisi otomatis.');
    if (story) {
      els.modalTitle.textContent = 'Edit Cerita';
      els.storyForm.elements.id.value = story.id;
      els.storyForm.elements.title.value = story.title || '';
      els.storyForm.elements.author.value = story.author || '';
      els.storyForm.elements.genre.value = story.genre || '';
      els.storyForm.elements.status.value = story.status || '';
      setStarInput(story.rating);
      els.storyForm.elements.chaptersRead.value = story.chaptersRead > 0 ? story.chaptersRead : '';
      els.storyForm.elements.chaptersTotal.value = story.chaptersTotal > 0 ? story.chaptersTotal : '';
      els.storyForm.elements.url.value = story.url || '';
      els.storyForm.elements.cover.value = story.cover || '';
      els.storyForm.elements.notes.value = story.notes || '';
    } else {
      els.modalTitle.textContent = 'Tambah Cerita';
      els.storyForm.elements.id.value = '';
    }
    updateFetchBtn();
    openModal(els.storyModal);
    els.storyForm.elements.title.focus({ preventScroll: true });
  }

  function showFormError(msg) {
    els.formError.textContent = msg;
    els.formError.hidden = false;
  }

  function validatePayload(p) {
    if (!p.title) return 'Judul cerita wajib diisi.';
    for (const key of ['url', 'cover']) {
      if (p[key] && !isHttpUrl(p[key])) {
        return `${key === 'url' ? 'Tautan cerita' : 'Cover URL'} harus dimulai dengan http:// atau https://`;
      }
    }
    if (p.chaptersTotal > 0 && p.chaptersRead > p.chaptersTotal) {
      return 'Bab dibaca tidak boleh lebih besar dari total bab.';
    }
    return null;
  }

  async function submitStory(event) {
    event.preventDefault();
    const f = els.storyForm;
    const num = (name) => {
      const v = Number(f.elements[name].value);
      return Number.isFinite(v) && v > 0 ? Math.min(99999, Math.trunc(v)) : 0;
    };
    const payload = {
      title: f.elements.title.value.trim(),
      author: f.elements.author.value.trim(),
      genre: f.elements.genre.value.trim(),
      status: f.elements.status.value,
      rating: Number(els.ratingValue.value) || 0,
      chaptersRead: num('chaptersRead'),
      chaptersTotal: num('chaptersTotal'),
      url: f.elements.url.value.trim(),
      cover: f.elements.cover.value.trim(),
      notes: f.elements.notes.value.trim(),
      listIds: collectListIds()
    };
    const invalid = validatePayload(payload);
    if (invalid) {
      showFormError(invalid);
      return;
    }
    const id = f.elements.id.value;
    els.formError.hidden = true;
    els.btnSave.disabled = true;
    try {
      const data = id
        ? await request(`/api/stories/${encodeURIComponent(id)}`, { method: 'PUT', json: payload })
        : await request('/api/stories', { method: 'POST', json: payload });
      closeModal(els.storyModal);
      mergeStory(data.story);
      toast('success', id ? 'Perubahan berhasil disimpan.' : `"${data.story.title}" ditambahkan.`);
    } catch (err) {
      showFormError(err.message);
    } finally {
      els.btnSave.disabled = false;
    }
  }

  function wattpadIdOf(story) {
    const src = String(story.sourceUrl || story.url || '');
    const m = src.match(/wattpad\.com\/story\/(\d{1,20})/i);
    return m ? m[1] : null;
  }

  const reader = {
    story: null,
    parts: [],
    idx: -1,
    pendingIdx: -1,
    busy: false,
    totalMin: 1,
    celebrated: false,
    finishTimer: null
  };

  function scheduleStoryFinish(delayMs) {
    if (reader.idx < 0 || reader.idx < reader.parts.length - 1) return;
    clearTimeout(reader.finishTimer);
    reader.finishTimer = setTimeout(() => {
      if (els.readerOverlay.hidden || reader.busy) return;
      if (reader.idx !== reader.parts.length - 1) return;
      toast('info', 'Kamu telah menyelesaikan cerita ini. Kembali ke daftar cerita.');
      setTimeout(() => {
        if (!els.readerOverlay.hidden && !reader.busy) closeReader();
      }, 900);
    }, delayMs);
  }

  function updateReadProgress() {
    const body = els.readerBody;
    const max = body.scrollHeight - body.clientHeight;
    if (max <= 4) {
      els.readerProgressBar.style.width = '100%';
      els.readerProgressWrap.setAttribute('aria-valuenow', '100');
      els.readerTimeLeft.textContent = '100% • bab singkat';
      scheduleStoryFinish(4000);
      return;
    }
    const ratio = Math.min(1, Math.max(0, body.scrollTop / max));
    const pct = Math.round(ratio * 100);
    els.readerProgressBar.style.width = `${pct}%`;
    els.readerProgressWrap.setAttribute('aria-valuenow', String(pct));
    if (pct >= 100) {
      const last = reader.idx >= reader.parts.length - 1;
      els.readerTimeLeft.textContent = last ? 'Selesai • bab terakhir' : 'Selesai — lanjut bab berikutnya';
      if (!reader.celebrated && reader.parts.length && reader.idx < reader.parts.length - 1) {
        reader.celebrated = true;
        toast('info', 'Bab selesai! Siap lanjut ke bab berikutnya.');
      }
      if (last) scheduleStoryFinish(1400);
      return;
    }
    reader.celebrated = false;
    const remSec = Math.max(0, Math.round((1 - ratio) * reader.totalMin * 60));
    let sisa;
    if (remSec >= 90) sisa = `±${Math.round(remSec / 60)} mnt`;
    else if (remSec >= 50) sisa = '±1 mnt';
    else sisa = `${Math.max(0, Math.ceil(remSec / 5) * 5)} dtk`;
    els.readerTimeLeft.textContent = `${pct}% • sisa ${sisa}`;
  }

  function applyFontSize() {
    document.documentElement.style.setProperty('--reader-fs', `${fontSize}px`);
    if (!els.readerOverlay.hidden) updateReadProgress();
  }

  function setReaderLoading() {
    els.readerContent.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'reader-loading';
    const sp = document.createElement('div');
    sp.className = 'spinner';
    wrap.appendChild(sp);
    els.readerContent.appendChild(wrap);
  }

  function renderReaderError(message) {
    els.readerContent.replaceChildren();
    const box = document.createElement('p');
    box.className = 'form-error';
    box.style.maxWidth = '680px';
    box.style.margin = '40px auto';
    box.textContent = message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-ghost';
    retry.textContent = 'Coba Lagi';
    retry.style.margin = '0 auto';
    retry.style.display = 'block';
    retry.addEventListener('click', () => {
      if (reader.parts.length) loadChapter(Math.max(0, reader.pendingIdx));
      else if (reader.story) openReader(reader.story, Math.max(0, reader.pendingIdx));
    });
    els.readerContent.append(box, retry);
  }

  function updateNavButtons() {
    els.readerPrev.disabled = reader.idx <= 0;
    els.readerNext.disabled = reader.idx < 0 || reader.idx >= reader.parts.length - 1;
  }

  function highlightChapter(idx) {
    [...els.chapterList.children].forEach((li, i) => {
      li.firstElementChild.classList.toggle('active', i === idx);
    });
    const active = els.chapterList.children[idx];
    if (active && els.sidebarOpen) active.scrollIntoView({ block: 'nearest' });
  }

  async function syncReadingProgress(story, chapterNum) {
    if (!story || !chapterNum) return;
    const live = state.stories.find((s) => s.id === story.id) || story;
    const prevRead = Number(live.chaptersRead) || 0;
    const next = Math.max(prevRead, chapterNum);
    let changed = false;
    if (next !== prevRead) {
      live.chaptersRead = next;
      changed = true;
    }
    const prevTotal = Number(live.chaptersTotal) || 0;
    if (prevTotal > 0 && next > prevTotal) {
      live.chaptersTotal = next;
      changed = true;
    }
    if (!changed) return;
    renderAll();
    try {
      await request(`/api/stories/${encodeURIComponent(live.id)}`, {
        method: 'PUT',
        json: { chaptersRead: live.chaptersRead, chaptersTotal: live.chaptersTotal }
      });
    } catch {}
  }

  async function loadChapter(idx) {
    if (reader.busy || !reader.parts.length) return;
    clearTimeout(reader.finishTimer);
    idx = Math.min(Math.max(0, idx), reader.parts.length - 1);
    reader.busy = true;
    reader.pendingIdx = idx;
    const part = reader.parts[idx];
    els.readerChapter.textContent = `Bab ${idx + 1}: ${part.title}`;
    highlightChapter(idx);
    setReaderLoading();
    els.readerBody.scrollTop = 0;
    try {
      const res = await request(`/api/wattpad/part/${part.id}`);
      reader.idx = idx;
      const frag = document.createDocumentFragment();
      const imgs = Array.isArray(res.images) ? res.images : [];
      const hasBlocks = Array.isArray(res.blocks) && res.blocks.length > 0;
      const appendPara = (t) => {
        const p = document.createElement('p');
        p.textContent = t;
        frag.appendChild(p);
      };
      const appendImg = (img) => {
        const box = document.createElement('div');
        box.className = 'reader-img loading';
        const el = document.createElement('img');
        el.alt = '';
        el.loading = 'lazy';
        el.addEventListener('load', () => box.classList.remove('loading'));
        el.addEventListener('error', () => box.remove());
        el.src = img.src;
        box.appendChild(el);
        frag.appendChild(box);
      };
      if (hasBlocks) {
        let imgIdx = 0;
        for (const blk of res.blocks) {
          if (blk.kind === 'img') appendImg(imgs[imgIdx++] || { src: '' });
          else appendPara(blk.text || '');
        }
      } else {
        res.paragraphs.forEach((t) => appendPara(t));
        if (imgs.length) for (const p of imgs) appendImg(p);
      }
      els.readerContent.replaceChildren(frag);
      els.readerPos.textContent = `${idx + 1} / ${reader.parts.length}`;
      try { localStorage.setItem(`hw_read_${reader.story.id}`, String(idx)); } catch {}
      const words = res.paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
      reader.totalMin = Math.max(1, Math.round(words / 200));
reader.celebrated = false;
    clearTimeout(reader.finishTimer);
      els.readerTimeTotal.textContent = `± ${reader.totalMin} mnt`;
      els.readerBody.scrollTop = 0;
      updateReadProgress();
      if (reader.story) syncReadingProgress(reader.story, idx + 1);
    } catch (err) {
      renderReaderError(err.message);
      toast('error', err.message);
    } finally {
      reader.busy = false;
      updateNavButtons();
    }
  }

  function renderChapterList(activeIdx) {
    els.chapterList.replaceChildren(
      ...reader.parts.map((p, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chapter-item${i === activeIdx ? ' active' : ''}`;
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = `${i + 1}.`;
        btn.append(num, document.createTextNode(p.title));
        btn.addEventListener('click', () => {
          toggleSidebar(false);
          loadChapter(i);
        });
        li.appendChild(btn);
        return li;
      })
    );
  }

  function toggleSidebar(open) {
    els.sidebarOpen = typeof open === 'boolean' ? open : els.readerSidebar.hidden;
    els.readerSidebar.hidden = !els.sidebarOpen;
  }

  async function openReader(story, forcedIdx) {
    const wpId = wattpadIdOf(story);
    if (!wpId) {
      toast('error', 'Cerita ini belum punya tautan Wattpad.');
      return;
    }
    reader.story = story;
    reader.parts = [];
    reader.idx = -1;
    reader.busy = false;
    els.readerStory.textContent = story.title;
    els.readerChapter.textContent = 'Memuat daftar bab…';
    els.readerPos.textContent = '–';
    els.readerPrev.disabled = true;
    els.readerNext.disabled = true;
    toggleSidebar(false);
    els.readerProgressBar.style.width = '0%';
    els.readerTimeTotal.innerHTML = '&plusmn; &ndash; mnt';
    els.readerTimeLeft.textContent = '0% • sisa –';
    lastFocus = document.activeElement;
    els.readerOverlay.hidden = false;
    document.body.classList.add('no-scroll');
    els.readerClose.focus({ preventScroll: true });
    setReaderLoading();
    try {
      const data = await request(`/api/wattpad/${wpId}/parts`);
      if (!data.parts.length) throw new Error('Cerita ini tidak memiliki bab.');
      reader.parts = data.parts;
      let saved = 0;
      try { saved = Number(localStorage.getItem(`hw_read_${story.id}`)) || 0; } catch {}
      let startIdx = Math.min(Math.max(saved, 0), reader.parts.length - 1);
      if (Number.isInteger(forcedIdx)) startIdx = Math.min(Math.max(forcedIdx, 0), reader.parts.length - 1);
      renderChapterList(startIdx);
      updateNavButtons();
      await loadChapter(startIdx);
    } catch (err) {
      renderReaderError(err.message);
      toast('error', err.message);
    }
  }

  function closeReader() {
    clearTimeout(reader.finishTimer);
    els.readerOverlay.hidden = true;
    toggleSidebar(false);
    if (!document.querySelector('.modal-backdrop:not([hidden])')) {
      document.body.classList.remove('no-scroll');
    }
    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch {}
    }
  }

  let fontSize = 17;
  try {
    const stored = Number(localStorage.getItem('hw_font'));
    if (Number.isFinite(stored) && stored >= 14 && stored <= 26) fontSize = stored;
  } catch {}
  applyFontSize();

  function setFetchHint(text) {
    els.fetchHint.textContent = text;
  }

  function updateFetchBtn() {
    const url = els.storyForm.elements.url.value.trim();
    els.btnFetch.disabled = fetchingStory || !WATTPAD_URL_RE.test(url);
  }

  function applyFetched(data, force) {
    const f = els.storyForm.elements;
    const fill = (input, value) => {
      if (value && (force || !input.value.trim())) input.value = value;
    };
    fill(f.title, data.title);
    fill(f.author, data.author);
    fill(f.cover, data.cover);
    if (data.parts > 0 && (force || !f.chaptersTotal.value.trim())) {
      f.chaptersTotal.value = String(data.parts);
    }
    fill(f.notes, data.description ? data.description.slice(0, 2000) : '');
    if (data.rating > 0 && (force || Number(els.ratingValue.value) === 0)) {
      setStarInput(data.rating);
    }
  }

  async function fetchFromWattpad(force) {
    const url = els.storyForm.elements.url.value.trim();
    if (!WATTPAD_URL_RE.test(url)) {
      if (force) setFetchHint('Masukkan tautan cerita Wattpad yang valid (wattpad.com/story/…).');
      updateFetchBtn();
      return;
    }
    const key = `${url}|${force ? 'f' : 'a'}`;
    if (!force && key === lastAutoFetchKey) return;
    if (fetchingStory) return;

    fetchingStory = true;
    lastAutoFetchKey = key;
    els.btnFetch.disabled = true;
    els.btnFetch.classList.add('loading');
    els.btnFetchLabel.textContent = 'Mengambil…';
    setFetchHint('Mengambil data dari Wattpad…');
    try {
      const res = await request('/api/wattpad', { method: 'POST', json: { url } });
      const d = res.story;
      applyFetched(d, force);
      const bits = [];
      if (d.parts > 0) bits.push(`${nf.format(d.parts)} bab`);
      if (d.completed) bits.push('tamat');
      if (d.rating > 0) bits.push(`rating ${d.rating}/5`);
      setFetchHint(
        `Terhubung: "${d.title}"${d.author ? ` oleh ${d.author}` : ''}${bits.length ? ` • ${bits.join(', ')}` : ''}`
      );
      toast('success', 'Data cerita berhasil diambil dari Wattpad.');
    } catch (err) {
      lastAutoFetchKey = '';
      toast('error', `Gagal mengambil dari Wattpad: ${err.message}`);
      setFetchHint(`Gagal mengambil otomatis (${err.message}). Isi manual atau klik Ambil lagi.`);
    } finally {
      fetchingStory = false;
      els.btnFetch.classList.remove('loading');
      els.btnFetchLabel.textContent = 'Ambil';
      updateFetchBtn();
    }
  }

  const debouncedAutoFetch = debounce(() => fetchFromWattpad(false), 800);

  function openConfirmDelete(story) {
    pendingDeleteId = story.id;
    els.confirmTitle.textContent = 'Hapus cerita ini?';
    els.confirmText.textContent = `"${story.title}" akan dihapus permanen.`;
    openModal(els.confirmModal);
    els.confirmOk.focus({ preventScroll: true });
  }

  async function confirmDelete() {
    if (!pendingDeleteId || els.confirmOk.disabled) return;
    const id = pendingDeleteId;
    els.confirmOk.disabled = true;
    try {
      await request(`/api/stories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      removeStory(id);
      closeModal(els.confirmModal);
      toast('success', 'Cerita dihapus.');
    } catch (err) {
      closeModal(els.confirmModal);
      toast('error', err.message);
    } finally {
      els.confirmOk.disabled = false;
      pendingDeleteId = null;
    }
  }

  els.confirmOk.addEventListener('click', () => {
    confirmDelete();
  });

  els.storyForm.addEventListener('submit', submitStory);

  els.storyForm.elements.url.addEventListener('input', () => {
    updateFetchBtn();
    debouncedAutoFetch();
  });

  els.btnFetch.addEventListener('click', () => fetchFromWattpad(true));

  els.readerClose.addEventListener('click', closeReader);
  els.readerListBtn.addEventListener('click', () => toggleSidebar());
  els.sidebarClose.addEventListener('click', () => toggleSidebar(false));
  els.readerBody.addEventListener('click', () => {
    if (!els.readerSidebar.hidden) toggleSidebar(false);
  });
  els.chapterList.addEventListener('click', (e) => e.stopPropagation());

  els.readerPrev.addEventListener('click', () => loadChapter(reader.idx - 1));
  els.readerNext.addEventListener('click', () => loadChapter(reader.idx + 1));

  els.readerBody.addEventListener('scroll', updateReadProgress, { passive: true });

  els.fontMinus.addEventListener('click', () => {
    fontSize = Math.max(14, fontSize - 1);
    applyFontSize();
    try { localStorage.setItem('hw_font', String(fontSize)); } catch {}
  });
  els.fontPlus.addEventListener('click', () => {
    fontSize = Math.min(26, fontSize + 1);
    applyFontSize();
    try { localStorage.setItem('hw_font', String(fontSize)); } catch {}
  });

  els.starInput.addEventListener('click', (e) => {
    const btn = e.target.closest('.star-btn');
    if (!btn) return;
    const v = Number(btn.dataset.value);
    setStarInput(Number(els.ratingValue.value) === v ? 0 : v);
  });

  for (const backdrop of [els.storyModal, els.confirmModal, els.listsModal, els.profileModal]) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
    for (const btn of backdrop.querySelectorAll('[data-close-modal]')) {
      btn.addEventListener('click', () => closeModal(backdrop));
    }
    const head = backdrop.querySelector('.modal-head');
    if (head) {
      let sy = 0;
      head.addEventListener('touchstart', (e) => { sy = e.touches[0].clientY; }, { passive: true });
      head.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - sy;
        if (dy > 50) closeModal(backdrop);
      }, { passive: true });
    }
  }

  document.addEventListener('keydown', (e) => {
    if (!els.readerOverlay.hidden) {
      if (e.key === 'Escape') {
        if (!els.readerSidebar.hidden) toggleSidebar(false);
        else closeReader();
      } else if (e.key === 'ArrowRight' && !els.readerNext.disabled) {
        loadChapter(reader.idx + 1);
      } else if (e.key === 'ArrowLeft' && !els.readerPrev.disabled) {
        loadChapter(reader.idx - 1);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (!els.readerOverlay.hidden) { closeReader(); return; }
      if (!els.detailOverlay.hidden) { closeDetail(); return; }
      const open = $('.modal-backdrop:not([hidden])');
      if (open) { closeModal(open); return; }
    } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = document.activeElement;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if ($('.modal-backdrop:not([hidden])') || !els.detailOverlay.hidden || !els.readerOverlay.hidden) return;
      e.preventDefault();
      els.searchInput.focus();
    }
  });

  els.statusChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.status = chip.dataset.status;
    renderChips();
    renderGrid();
  });

  els.listChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-list-id]');
    if (!chip) return;
    state.filterList = state.filterList === chip.dataset.listId ? null : chip.dataset.listId;
    renderListUI();
    renderGrid();
  });

  els.btnLists.addEventListener('click', () => {
    els.listError.hidden = true;
    renderListsManage();
    openModal(els.listsModal);
  });

  els.newListForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = els.newListName.value.trim();
    if (!name) return;
    try {
      const res = await request('/api/lists', { method: 'POST', json: { name } });
      state.lists.push(res.list);
      els.newListName.value = '';
      els.listError.hidden = true;
      renderAll();
      renderListsManage();
      toast('success', `List "${res.list.name}" dibuat.`);
    } catch (err) {
      els.listError.textContent = err.message;
      els.listError.hidden = false;
    }
  });

  els.btnFormAddList.addEventListener('click', async () => {
    const name = els.formQuickListName.value.trim();
    if (!name) return;
    const beforeChecked = collectListIds();
    try {
      const res = await request('/api/lists', { method: 'POST', json: { name } });
      state.lists.push(res.list);
      els.formQuickListName.value = '';
      els.quickListError.hidden = true;
      renderListUI();
      const newId = res.list.id;
      els.formListChecks.replaceChildren();
      for (const l of state.lists) {
        els.formListChecks.appendChild(buildListCheck(l, beforeChecked.includes(l.id) || l.id === newId));
      }
      toast('success', `List "${res.list.name}" dibuat.`);
    } catch (err) {
      els.quickListError.textContent = err.message;
      els.quickListError.hidden = false;
    }
  });

  els.listsManageWrap.addEventListener('click', (e) => {
    const row = e.target.closest('.manage-row');
    if (!row) return;
    const list = listById(row.dataset.listId);
    if (!list) return;
    const renameBtn = e.target.closest('.icon-btn:not(.danger)');
    if (renameBtn) {
      startInlineRename(row, list);
      return;
    }
    const delBtn = e.target.closest('.icon-btn.danger');
    if (delBtn) deleteList(list, delBtn);
  });

  els.searchInput.addEventListener('input', debounce(() => {
    state.q = els.searchInput.value;
    renderGrid();
  }, 160));

  $('#btnAdd').addEventListener('click', () => openStoryModal(null));
  $('#fabAdd').addEventListener('click', () => openStoryModal(null));
  $('#btnAddEmpty').addEventListener('click', () => openStoryModal(null));
  $('#footAdd').addEventListener('click', () => openStoryModal(null));
  $('#footLists').addEventListener('click', () => {
    els.listError.hidden = true;
    renderListsManage();
    openModal(els.listsModal);
  });
  els.btnRetry.addEventListener('click', load);

  els.starInput.replaceChildren(
    ...Array.from({ length: 5 }, (_, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star-btn';
      btn.dataset.value = String(i + 1);
      btn.setAttribute('role', 'radio');
      btn.innerHTML = ICONS.star;
      return btn;
    })
  );

  setStarInput(0);
  function showAuthScreen() {
    els.authScreen.hidden = false;
    els.userArea.hidden = true;
  }

  function applyUserIdentity(user) {
    state.user = user;
    const label = user.name || user.email;
    if (user.photo) {
      const big = document.createElement('img');
      big.src = user.photo;
      big.alt = 'Foto profil';
      els.profAvatar.replaceChildren(big);
      els.profAvatar.classList.add('has-photo');
      const mini = document.createElement('img');
      mini.src = user.photo;
      mini.alt = '';
      els.userChip.replaceChildren(mini, document.createTextNode(label));
    } else {
      els.profAvatar.classList.remove('has-photo');
      els.profAvatar.replaceChildren(document.createTextNode(label.charAt(0).toUpperCase()));
      els.userChip.textContent = label;
    }
    els.userChip.title = `${label} — klik untuk buka profil`;
    els.profNameDisplay.textContent = user.name || 'Tanpa nama';
    els.profEmail.textContent = user.email;
    els.btnAvatarRemove.hidden = !user.photo;
  }

  function cropToDataUrl(file, size, mime, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Berkas bukan gambar yang valid.'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL(mime, quality));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function showApp(user) {
    els.authScreen.hidden = true;
    els.userArea.hidden = false;
    if (typeof user === 'string') user = { email: user, name: '' };
    applyUserIdentity(user);
  }

  let authMode = 'login';
  let profileOpen = false;

  function openProfile() {
    if (!state.user) return;
    els.profName.value = state.user.name || '';
    els.profError.hidden = true;
    els.pwdError.hidden = true;
    els.pwdCurrent.value = '';
    els.pwdNew.value = '';
    els.pwdConfirm.value = '';
    const hasDiscord = !!(state.user.discordWebhook);
    els.discordEnabled.checked = hasDiscord;
    els.discordFields.hidden = !hasDiscord;
    els.discordWebhook.value = state.user.discordWebhook || '';
    els.discordRoleId.value = state.user.discordRoleId || '';
    els.checkIntervalMin.value = String(state.user.checkIntervalMin || 15);
    els.discordError.hidden = true;
    setWebhookStatus(hasDiscord ? 'untested' : 'off', hasDiscord ? 'Memeriksa status webhook…' : 'Webhook belum diatur');
    applyUserIdentity(state.user);
    openModal(els.profileModal);
    if (hasDiscord) {
      setWebhookStatus('testing', 'Memeriksa status webhook…');
      checkWebhookStatus(state.user.discordWebhook, { silent: true });
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    const name = els.profName.value.trim();
    try {
      const res = await request('/api/auth/profile', { method: 'PUT', json: { name } });
      applyUserIdentity(res.user);
      els.profError.hidden = true;
      toast('success', 'Profil diperbarui.');
    } catch (err) {
      els.profError.textContent = err.message;
      els.profError.hidden = false;
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    const currentPassword = els.pwdCurrent.value;
    const newPassword = els.pwdNew.value;
    if (newPassword !== els.pwdConfirm.value) {
      els.pwdError.textContent = 'Konfirmasi kata sandi tidak cocok.';
      els.pwdError.hidden = false;
      return;
    }
    try {
      await request('/api/auth/password', {
        method: 'POST',
        json: { currentPassword, newPassword }
      });
      els.pwdError.hidden = true;
      els.pwdCurrent.value = '';
      els.pwdNew.value = '';
      els.pwdConfirm.value = '';
      toast('success', 'Kata sandi berhasil diubah.');
      closeModal(els.profileModal);
    } catch (err) {
      els.pwdError.textContent = err.message;
      els.pwdError.hidden = false;
    }
  }

  function setAuthMode(mode) {
    authMode = mode;
    els.tabLogin.classList.toggle('active', mode === 'login');
    els.tabRegister.classList.toggle('active', mode === 'register');
    els.btnAuthSubmit.textContent = mode === 'login' ? 'Masuk' : 'Daftar';
    els.authPassword.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    els.authError.hidden = true;
  }

  async function handleAuth(event) {
    event.preventDefault();
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    if (!EMAIL_CLIENT_RE.test(email)) {
      els.authError.textContent = 'Format email tidak valid.';
      els.authError.hidden = false;
      return;
    }
    if (password.length < 8) {
      els.authError.textContent = 'Kata sandi minimal 8 karakter.';
      els.authError.hidden = false;
      return;
    }
    els.btnAuthSubmit.disabled = true;
    try {
      const res = await request(`/api/auth/${authMode}`, { method: 'POST', json: { email, password } });
      showApp(res.user);
      els.authPassword.value = '';
      state.filterList = null;
      await load();
      autoCheckWebhook();
      toast('success', authMode === 'login' ? `Selamat datang kembali, ${res.user.email}!` : 'Akun berhasil dibuat.');
    } catch (err) {
      els.authError.textContent = err.message;
      els.authError.hidden = false;
    } finally {
      els.btnAuthSubmit.disabled = false;
    }
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST', json: {} });
    } catch {}
    state.stories = [];
    state.lists = [];
    state.filterList = null;
    state.user = null;
    renderAll();
    showAuthScreen();
    setAuthMode('login');
    toast('info', 'Kamu telah keluar.');
  }

  els.tabLogin.addEventListener('click', () => setAuthMode('login'));
  els.tabRegister.addEventListener('click', () => setAuthMode('register'));
  els.authForm.addEventListener('submit', handleAuth);
  els.btnLogout.addEventListener('click', logout);

  els.btnNotif.addEventListener('click', () => {
    const open = els.notifPanel.hidden;
    els.notifPanel.hidden = !open;
    els.btnNotif.setAttribute('aria-expanded', String(open));
    if (open) updateNotifPermPrompt();
  });

  function updateNotifPermPrompt() {
    if (!('Notification' in window) || Notification.permission !== 'default') {
      els.notifPermPrompt.hidden = true;
      return;
    }
    els.notifPermPrompt.hidden = false;
  }
  els.btnNotifPerm.addEventListener('click', () => {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then((p) => {
      notifPermission = p;
      updateNotifPermPrompt();
      if (p === 'granted') toast('success', 'Notifikasi browser diaktifkan.');
    });
  });

  document.addEventListener('click', (e) => {
    if (els.notifPanel.hidden) return;
    if (e.target.closest('.notif-wrap')) return;
    els.notifPanel.hidden = true;
    els.btnNotif.setAttribute('aria-expanded', 'false');
  });

  async function markUpdateSeen(storyId) {
    try {
      await request('/api/updates/seen', { method: 'POST', json: { storyId } });
    } catch {}
  }

  let notifBusy = false;
  els.notifList.addEventListener('click', async (e) => {
    if (notifBusy) return;
    const seenBtn = e.target.closest('[data-seen]');
    if (seenBtn) {
      notifBusy = true;
      seenBtn.disabled = true;
      try {
        await markUpdateSeen(seenBtn.dataset.seen);
        await refreshNotifications();
        await load();
        toast('success', 'Jumlah bab disinkronkan.');
      } finally { notifBusy = false; }
      return;
    }
    const openBtn = e.target.closest('.notif-open');
    if (!openBtn) return;
    const sid = openBtn.closest('.notif-item')?.dataset.sid;
    if (!sid) return;
    notifBusy = true;
    els.notifPanel.hidden = true;
    els.btnNotif.setAttribute('aria-expanded', 'false');
    try {
      await markUpdateSeen(sid);
      await refreshNotifications();
      await load();
      const story = state.stories.find((s) => s.id.toLowerCase() === sid.toLowerCase());
      if (story) {
        openDetail(story);
        detSwitchTab('bab');
      } else {
        toast('error', 'Cerita tidak ada di rakmu.');
      }
    } finally { notifBusy = false; }
  });

  els.btnCheckNow.addEventListener('click', async () => {
    if (els.btnCheckNow.disabled) return;
    els.btnCheckNow.disabled = true;
    els.btnCheckNow.textContent = 'Memeriksa…';
    try {
      const data = await request('/api/updates/check', { method: 'POST' });
      renderNotifications(data);
      await refreshStories();
      quickCheckEnd = Date.now() + 10_000;
      if (data.items && data.items.some((i) => i.isNew)) toast('success', 'Ada cerita baru!');
      else toast('info', 'Tidak ada pembaruan.');
    } catch (err) { toast('error', err.message); }
    els.btnCheckNow.textContent = 'Cek sekarang';
    els.btnCheckNow.disabled = false;
  });

  async function refreshStories() {
    if (!state.user) return;
    try {
      const data = await request('/api/stories');
      if (Array.isArray(data.stories)) {
        state.stories = data.stories;
        applyFilters();
        renderAll();
      }
    } catch {}
  }

  setInterval(refreshNotifications, 60_000);
  startCountdown();

  if ('Notification' in window) notifPermission = Notification.permission;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !state.user) return;
    refreshNotifications();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((p) => { notifPermission = p; });
    }
  });


  els.userChip.addEventListener('click', openProfile);
  els.profileForm.addEventListener('submit', handleProfileSave);
  els.passwordForm.addEventListener('submit', handlePasswordChange);
  els.btnAvatarPick.addEventListener('click', () => els.avatarInput.click());
  els.btnAvatarRemove.addEventListener('click', async () => {
    try {
      const res = await request('/api/auth/profile', {
        method: 'PUT',
        json: { name: (state.user && state.user.name) || '', photo: '' }
      });
      applyUserIdentity(res.user);
      toast('info', 'Foto profil dihapus.');
    } catch (err) {
      toast('error', err.message);
    }
  });
  els.avatarInput.addEventListener('change', async () => {
    const file = els.avatarInput.files && els.avatarInput.files[0];
    els.avatarInput.value = '';
    if (!file || !state.user) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast('error', 'Format harus JPG, PNG, atau WebP.');
      return;
    }
    try {
      const photo = await cropToDataUrl(file, 256, 'image/jpeg', 0.85);
      const res = await request('/api/auth/profile', {
        method: 'PUT',
        json: { name: state.user.name || '', photo }
      });
      applyUserIdentity(res.user);
      toast('success', 'Foto profil diperbarui.');
    } catch (err) {
      toast('error', err.message);
    }
  });

  els.discordEnabled.addEventListener('change', () => {
    els.discordFields.hidden = !els.discordEnabled.checked;
    const on = els.discordEnabled.checked;
    setWebhookStatus(on ? 'untested' : 'off', on ? 'Simpan terlebih dahulu, lalu uji webhook' : 'Webhook belum diatur');
  });

  function setWebhookStatus(state, text) {
    els.discordStatusDot.dataset.state = state || 'off';
    els.discordStatusText.textContent = text || '';
  }

  els.btnTestWebhook.addEventListener('click', async () => {
    const webhook = els.discordWebhook.value.trim();
    if (!els.discordEnabled.checked) {
      setWebhookStatus('err', 'Aktifkan notifikasi Discord terlebih dahulu.');
      return;
    }
    if (!webhook) {
      setWebhookStatus('err', 'Webhook URL belum diisi.');
      return;
    }
    if (!webhook.startsWith('https://discord.com/api/webhooks/') && !webhook.startsWith('https://discordapp.com/api/webhooks/')) {
      setWebhookStatus('err', 'URL webhook harus dari Discord (discord.com).');
      return;
    }
    els.btnTestWebhook.disabled = true;
    setWebhookStatus('testing', 'Mengirim pesan uji ke Discord…');
    try {
      await request('/api/auth/test-webhook', { method: 'POST', json: { webhook } });
      setWebhookStatus('ok', 'Berhasil! Pesan uji terkirim ke Discord kamu.');
      toast('success', 'Webhook berfungsi. Cek channel Discord tujuan.');
    } catch (err) {
      setWebhookStatus('err', err.message);
      toast('error', err.message);
    } finally {
      els.btnTestWebhook.disabled = false;
    }
  });

  async function checkWebhookStatus(webhook, { silent = false } = {}) {
    setWebhookStatus('testing', 'Memeriksa status webhook…');
    let res;
    try {
      res = await request('/api/auth/check-webhook', { method: 'POST', json: { webhook: webhook || '' } });
    } catch (err) {
      setWebhookStatus('err', err.message);
      if (!silent) toast('error', err.message);
      return { ok: false, reason: err.message };
    }
    if (res && res.ok) {
      setWebhookStatus('ok', 'Webhook aktif dan terhubung ke Discord.');
    } else {
      const reason = res && res.reason ? res.reason : 'Webhook tidak aktif.';
      setWebhookStatus('err', reason);
      if (!silent) toast('warning', 'Webhook Discord tidak aktif. ' + reason);
    }
    return { ok: !!(res && res.ok), reason: res && res.reason ? res.reason : '' };
  }

  let webhookCheckedOnce = false;

  async function autoCheckWebhook() {
    if (webhookCheckedOnce || !state.user || !state.user.discordWebhook) return;
    webhookCheckedOnce = true;
    await checkWebhookStatus(state.user.discordWebhook, { silent: true });
  }

  els.discordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.discordError.hidden = true;
    const enabled = els.discordEnabled.checked;
    const webhook = enabled ? els.discordWebhook.value.trim() : '';
    const roleId = enabled ? els.discordRoleId.value.trim() : '';
    if (enabled && !webhook) {
      els.discordError.textContent = 'Webhook URL wajib diisi.';
      els.discordError.hidden = false;
      return;
    }
    const intervalRaw = Number(els.checkIntervalMin ? els.checkIntervalMin.value : 15);
    const checkIntervalMin = Math.max(5, Math.min(1440, Math.trunc(Number.isFinite(intervalRaw) ? intervalRaw : 15)));
    if (!Number.isFinite(intervalRaw) || intervalRaw < 5 || intervalRaw > 1440) {
      els.discordError.textContent = 'Interval 5–1440 menit.';
      els.discordError.hidden = false;
      return;
    }
    if (enabled && webhook && !webhook.startsWith('https://discord.com/api/webhooks/') && !webhook.startsWith('https://discordapp.com/api/webhooks/')) {
      els.discordError.textContent = 'URL webhook harus dari Discord (discord.com).';
      els.discordError.hidden = false;
      return;
    }
    try {
      const res = await request('/api/auth/profile', {
        method: 'PUT',
        json: { name: state.user.name || '', discordWebhook: webhook, discordRoleId: roleId, checkIntervalMin }
      });
      applyUserIdentity(res.user);
      webhookCheckedOnce = false;
      if (enabled) {
        await checkWebhookStatus(webhook);
      } else {
        setWebhookStatus('off', 'Webhook belum diatur');
      }
      toast('success', 'Pengaturan Discord disimpan.');
    } catch (err) {
      toast('error', err.message);
    }
  });

  for (const btn of document.querySelectorAll('.eye-toggle')) {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.input-eye');
      if (!wrap) return;
      const input = wrap.querySelector('input');
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('.ic-eye').hidden = show;
      btn.querySelector('.ic-eye-off').hidden = !show;
      btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    });
  }

  (async () => {
    try {
      const me = await request('/api/auth/me');
      if (me && me.user) {
        showApp(me.user);
        await load();
        refreshNotifications();
        autoCheckWebhook();
        if ('Notification' in window && Notification.permission === 'default') {
          setTimeout(() => { Notification.requestPermission().then((p) => { notifPermission = p; }); }, 3000);
        }
        return;
      }
    } catch {}
    showAuthScreen();
    setAuthMode('login');
  })();
})();

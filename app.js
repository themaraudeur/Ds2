'use strict';

/* ════════════════════════════════════════════
   SYSTÈMES & CORES
════════════════════════════════════════════ */
const SYS = {
  nds: { label:'NDS',  core:'nds',              emoji:'🎮', bg:'#0a1a40,#050f25', badge:'#1a3a80', bc:'#6699ff' },
  gba: { label:'GBA',  core:'gba',              emoji:'🔴', bg:'#2a0a08,#150402', badge:'#502020', bc:'#ff8866' },
  gb:  { label:'GB',   core:'gb',               emoji:'🟢', bg:'#0a1a0a,#051005', badge:'#1a4020', bc:'#66cc88' },
  gbc: { label:'GBC',  core:'gbc',              emoji:'🟡', bg:'#1a1a08,#0d0d04', badge:'#404020', bc:'#ddcc44' },
  nes: { label:'NES',  core:'nes',              emoji:'🕹️', bg:'#1a0a08,#0d0503', badge:'#502820', bc:'#ff9966' },
  sfc: { label:'SNES', core:'snes',             emoji:'🟣', bg:'#1a0a1a,#0d050d', badge:'#402050', bc:'#cc88ff' },
  smc: { label:'SNES', core:'snes',             emoji:'🟣', bg:'#1a0a1a,#0d050d', badge:'#402050', bc:'#cc88ff' },
  n64: { label:'N64',  core:'n64',              emoji:'🎯', bg:'#0a1a20,#050d10', badge:'#1a3040', bc:'#44aacc' },
  z64: { label:'N64',  core:'n64',              emoji:'🎯', bg:'#0a1a20,#050d10', badge:'#1a3040', bc:'#44aacc' },
  v64: { label:'N64',  core:'n64',              emoji:'🎯', bg:'#0a1a20,#050d10', badge:'#1a3040', bc:'#44aacc' },
  bin: { label:'PSX',  core:'psx',              emoji:'⬜', bg:'#1a1a1a,#0d0d0d', badge:'#303030', bc:'#cccccc' },
  iso: { label:'PSX',  core:'psx',              emoji:'⬜', bg:'#1a1a1a,#0d0d0d', badge:'#303030', bc:'#cccccc' },
};
const THEMES   = ['dsi','tds','r4','wood'];
const THEME_LABELS = { dsi:'Nintendo DSi', tds:'Nintendo 3DS', r4:'R4 Original', wood:'Wood UI' };
const ROM_EXTS = new Set(Object.keys(SYS));

function getSys(ext) { return SYS[ext.toLowerCase()] || SYS.nds; }

/* ════════════════════════════════════════════
   STATE
════════════════════════════════════════════ */
const S = {
  theme:        'dsi',
  roms:         [],          // { id, name, ext, size, url, image }
  images:       {},          // name -> dataURL
  folderName:   'ROMs',
  savesName:    '',
  selected:     null,        // rom sélectionné
  themeIdx:     0,
};

// Persist
function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem('ds-console') || '{}');
    if (d.theme)      S.theme      = d.theme;
    if (d.folderName) S.folderName = d.folderName;
    if (d.savesName)  S.savesName  = d.savesName;
    if (d.images)     S.images     = d.images;
    if (d.roms)       S.roms       = d.roms; // sans url (blob invalide après reload)
    S.themeIdx = THEMES.indexOf(S.theme);
    if (S.themeIdx < 0) S.themeIdx = 0;
  } catch(e) {}
}
function saveState() {
  try {
    localStorage.setItem('ds-console', JSON.stringify({
      theme: S.theme, folderName: S.folderName, savesName: S.savesName,
      images: S.images,
      roms: S.roms.map(r => ({ id:r.id, name:r.name, ext:r.ext, size:r.size, image:r.image }))
    }));
  } catch(e) {}
}

/* ════════════════════════════════════════════
   DOM REFS
════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const boot        = $('boot');
const ui          = $('ui');
const carousel    = $('carousel');
const listView    = $('list-view');
const emptyZone   = $('empty-zone');
const titleEl     = $('title');
const pathTxt     = $('path-txt');
const pathBack    = $('path-back');
const bannerIcon  = $('banner-icon');
const bannerTitle = $('banner-title');
const bannerSub   = $('banner-sub');
const noGameMsg   = $('no-game-msg');
const ctxMenu     = $('ctx-menu');
const toastEl     = $('toast');

/* ════════════════════════════════════════════
   BOOT
════════════════════════════════════════════ */
function skipBoot() {
  boot.classList.add('gone');
  setTimeout(() => {
    boot.style.display = 'none';
    ui.classList.add('visible');
    render();
  }, 620);
}
boot.addEventListener('click',    skipBoot);
boot.addEventListener('touchend', skipBoot);

/* ════════════════════════════════════════════
   HORLOGE
════════════════════════════════════════════ */
function tickClock() {
  const n = new Date();
  const t = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  $('top-clock').textContent = t;
}
function pad(n) { return String(n).padStart(2,'0'); }
tickClock();
setInterval(tickClock, 30000);

/* ════════════════════════════════════════════
   THÈMES
════════════════════════════════════════════ */
function setTheme(name) {
  THEMES.forEach(t => document.body.classList.remove(t));
  document.body.classList.add(name);
  S.theme    = name;
  S.themeIdx = THEMES.indexOf(name);
  saveState();
  render();
  toast(`Thème: ${THEME_LABELS[name]}`);
}

function cycleTheme() {
  S.themeIdx = (S.themeIdx + 1) % THEMES.length;
  setTheme(THEMES[S.themeIdx]);
}

// Expose globalement
window.setTheme  = setTheme;
window.cycleTheme = cycleTheme;

/* ════════════════════════════════════════════
   PICK FOLDER / FICHIERS
════════════════════════════════════════════ */
function pickFolder(type) {
  if (type === 'roms') {
    // Essayer webkitdirectory d'abord
    const inp = $('input-folder');
    inp.onchange = e => handleRomFiles(e.target.files, true);
    inp.click();
  } else if (type === 'saves') {
    const inp = $('input-saves');
    inp.onchange = e => handleSaves(e.target.files);
    inp.click();
  } else if (type === 'images') {
    const inp = $('input-images');
    inp.onchange = e => handleImages(e.target.files);
    inp.click();
  }
}
window.pickFolder = pickFolder;

$('input-roms').addEventListener('change', e => { handleRomFiles(e.target.files, false); e.target.value=''; });
$('input-folder').addEventListener('change', e => { handleRomFiles(e.target.files, true); e.target.value=''; });

/* ════════════════════════════════════════════
   CHARGER LES ROMs
════════════════════════════════════════════ */
async function handleRomFiles(files, isFolder) {
  const arr = Array.from(files);
  if (!arr.length) return;

  // Détecter nom du dossier
  if (isFolder && arr[0].webkitRelativePath) {
    S.folderName = arr[0].webkitRelativePath.split('/')[0] || 'ROMs';
  }

  let added = 0;
  for (const f of arr) {
    let parts = f.name.split('.');
    let ext   = parts.pop().toLowerCase();
    if (ext === 'zip') { ext = parts.join('.').split('.').pop().toLowerCase() || 'nds'; }
    if (!ROM_EXTS.has(ext)) continue; // ignorer non-ROM

    const clean = f.name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g,' ').trim();
    if (S.roms.find(r => r.name === clean && r.ext === ext)) continue; // doublon

    const data = await f.arrayBuffer();
    const blob = new Blob([data], { type:'application/octet-stream' });
    const url  = URL.createObjectURL(blob);

    S.roms.push({ id: Date.now() + Math.random(), name: clean, ext, size: f.size, url,
                  image: S.images[clean] || null });
    added++;
  }

  if (added) {
    toast(`${added} ROM${added>1?'s':''} chargée${added>1?'s':''}! 🎮`);
    saveState(); render();
  } else {
    toast('Aucune ROM reconnue dans ce dossier');
  }
}

/* ════════════════════════════════════════════
   CHARGER LES IMAGES (box art)
════════════════════════════════════════════ */
async function handleImages(files) {
  let matched = 0;
  for (const f of Array.from(files)) {
    const romName = f.name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g,' ').trim();
    const dataURL = await fileToDataURL(f);
    S.images[romName] = dataURL;
    // Associer aux ROMs existantes
    const rom = S.roms.find(r => r.name === romName);
    if (rom) { rom.image = dataURL; matched++; }
  }
  toast(`${Object.keys(S.images).length} image(s) chargée(s), ${matched} associée(s)`);
  saveState(); render();
}

function fileToDataURL(f) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsDataURL(f);
  });
}

/* ════════════════════════════════════════════
   CHARGER LES SAVES
════════════════════════════════════════════ */
function handleSaves(files) {
  const arr = Array.from(files);
  if (!arr.length) return;
  const folder = arr[0].webkitRelativePath ? arr[0].webkitRelativePath.split('/')[0] : 'Saves';
  S.savesName = folder;
  toast(`💾 ${arr.length} save(s) détectée(s) dans ${folder}`);
  saveState();
}

/* ════════════════════════════════════════════
   NAVIGATION DOS.
════════════════════════════════════════════ */
window.goBack = function() {
  // Navigation simple : pas de sous-dossiers pour l'instant
  pathBack.classList.remove('show');
};

/* ════════════════════════════════════════════
   RENDER PRINCIPAL
════════════════════════════════════════════ */
function render() {
  // Appliquer le thème sur le body
  THEMES.forEach(t => document.body.classList.remove(t));
  document.body.classList.add(S.theme);

  // Mettre à jour le path bar
  pathTxt.textContent = S.folderName;

  const hasRoms = S.roms.length > 0;
  emptyZone.classList.toggle('hidden', hasRoms);
  noGameMsg.classList.toggle('hidden', hasRoms);

  // Render selon thème
  if (S.theme === 'dsi' || S.theme === 'tds') {
    renderGrid();
  } else {
    renderList();
  }

  // Update banner
  updateBanner(S.selected);
}

/* ════════════════════════════════════════════
   GRILLE DSi / 3DS
════════════════════════════════════════════ */
function renderGrid() {
  carousel.innerHTML = '';
  listView.innerHTML = '';

  S.roms.forEach(rom => {
    const sys = getSys(rom.ext);
    const card = document.createElement('div');
    card.className = 'c-card';
    card.dataset.id = rom.id;

    const iconInner = rom.image
      ? `<img src="${rom.image}" alt="${esc(rom.name)}">`
      : `<span>${sys.emoji}</span><div class="c-icon-ext">${rom.ext.toUpperCase()}</div>`;

    card.innerHTML = `
      <div class="c-icon" style="background:linear-gradient(135deg,${sys.bg})">
        ${iconInner}
      </div>
      <div class="c-name">${esc(rom.name)}</div>
      <div class="c-badge" style="background:${sys.badge};color:${sys.bc}">${sys.label}</div>
    `;

    bindItem(card, rom);
    carousel.appendChild(card);
  });
}

/* ════════════════════════════════════════════
   LISTE R4 / WOOD
════════════════════════════════════════════ */
function renderList() {
  carousel.innerHTML = '';
  listView.innerHTML = '';

  S.roms.forEach(rom => {
    const sys = getSys(rom.ext);
    const item = document.createElement('div');
    item.className = 'l-item';
    item.dataset.id = rom.id;

    const iconInner = rom.image
      ? `<img src="${rom.image}" style="width:100%;height:100%;object-fit:cover;border-radius:4px" alt="">`
      : sys.emoji;

    item.innerHTML = `
      <div class="l-icon" style="background:${sys.badge}15;border-color:${sys.badge}44">
        ${iconInner}
      </div>
      <div class="l-info">
        <div class="l-name">${esc(rom.name)}</div>
        <div class="l-sub">${sys.label} • ${mb(rom.size)}</div>
      </div>
      <div class="l-badge" style="background:${sys.badge};color:${sys.bc}">${sys.label}</div>
    `;

    bindItem(item, rom);
    listView.appendChild(item);
  });
}

/* ════════════════════════════════════════════
   BIND CARD / ITEM
════════════════════════════════════════════ */
function bindItem(el, rom) {
  // Tap = sélectionner + lancer
  el.addEventListener('click', () => {
    selectRom(rom);
    launchGame(rom);
  });

  // Long press = context menu
  let timer;
  el.addEventListener('touchstart', () => {
    timer = setTimeout(() => showCtx(el, rom), 500);
  }, { passive: true });
  el.addEventListener('touchend',  () => clearTimeout(timer), { passive: true });
  el.addEventListener('touchmove', () => clearTimeout(timer), { passive: true });
  el.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e, rom); });
}

/* ════════════════════════════════════════════
   SÉLECTION (update bannière)
════════════════════════════════════════════ */
function selectRom(rom) {
  S.selected = rom;
  // Highlight visuel
  document.querySelectorAll('.c-card, .l-item').forEach(el => {
    el.style.background = '';
  });
  const el = document.querySelector(`[data-id="${rom.id}"]`);
  if (el) el.style.background = 'var(--selected-bg)';
  updateBanner(rom);
  titleEl.textContent = rom.name.toUpperCase();
}

function updateBanner(rom) {
  if (!rom) {
    bannerIcon.textContent = '🎮';
    bannerIcon.style.backgroundImage = '';
    bannerTitle.textContent = 'TWiLight Menu++';
    bannerSub.textContent   = 'Sélectionne un jeu';
    return;
  }
  const sys = getSys(rom.ext);
  if (rom.image) {
    bannerIcon.innerHTML = `<img src="${rom.image}" style="width:100%;height:100%;object-fit:cover;border-radius:7px">`;
  } else {
    bannerIcon.innerHTML = sys.emoji;
    bannerIcon.style.background = `linear-gradient(135deg,${sys.bg})`;
  }
  bannerTitle.textContent = rom.name;
  bannerSub.textContent   = `${sys.label} • ${mb(rom.size)}`;
}

/* ════════════════════════════════════════════
   LANCER UN JEU — EmulatorJS
════════════════════════════════════════════ */
function launchGame(rom) {
  if (!rom.url) {
    toast('❌ ROM non chargée en mémoire — recharge-la');
    return;
  }

  $('emu-title').textContent = rom.name;
  $('emu').classList.add('show');

  const load   = $('emu-load');
  const lbar   = $('el-bar');
  const ltxt   = $('el-txt');
  const gameDiv = $('game');

  gameDiv.innerHTML = '';
  document.querySelectorAll('.ejs-script').forEach(s => s.remove());
  lbar.style.width = '0'; lbar.style.background = '';
  ltxt.textContent = 'INITIALISATION...';
  load.classList.remove('done');

  // Barre de progression animée
  let prog = 0, mi = 0;
  const msgs = ['INITIALISATION...','CHARGEMENT DU CORE...','LECTURE DE LA ROM...','DÉMARRAGE...'];
  const pi = setInterval(() => {
    prog = Math.min(prog + (Math.random() * 6 + 2), 90);
    lbar.style.width = prog + '%';
    if (prog > 20 && mi < 1) { mi=1; ltxt.textContent = msgs[1]; }
    if (prog > 50 && mi < 2) { mi=2; ltxt.textContent = msgs[2]; }
    if (prog > 75 && mi < 3) { mi=3; ltxt.textContent = msgs[3]; }
  }, 200);

  const sys = getSys(rom.ext);

  // Config EmulatorJS
  window.EJS_player          = '#game';
  window.EJS_core            = sys.core;
  window.EJS_gameUrl         = rom.url;
  window.EJS_gameID          = Math.floor(Math.random() * 999999);
  window.EJS_cheats          = false;
  window.EJS_language        = 'fr';
  window.EJS_startOnLoaded   = true;
  window.EJS_pathtodata      = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_color           = '#00d4ff';
  window.EJS_backgroundColor = '#000010';

  window.EJS_onGameStart = () => {
    clearInterval(pi);
    lbar.style.width = '100%';
    ltxt.textContent = 'PRÊT!';
    setTimeout(() => load.classList.add('done'), 600);
  };
  window.EJS_onLoadError = () => {
    clearInterval(pi);
    ltxt.textContent = 'ERREUR — Connexion requise';
    lbar.style.width = '100%';
    lbar.style.background = '#ff4444';
  };

  // Injecter le loader EmulatorJS
  const sc = document.createElement('script');
  sc.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
  sc.className = 'ejs-script';
  sc.onerror = () => {
    clearInterval(pi);
    ltxt.textContent = 'HORS LIGNE — Connexion requise';
    lbar.style.width = '100%';
    lbar.style.background = '#ff4444';
  };
  document.body.appendChild(sc);
}

/* ════════════════════════════════════════════
   QUITTER L'ÉMULATEUR
════════════════════════════════════════════ */
function exitEmu() {
  try { if (window.EJS_emulator) window.EJS_emulator.pause(); } catch(e) {}
  document.querySelectorAll('.ejs-script').forEach(s => s.remove());
  $('game').innerHTML = '';
  ['EJS_player','EJS_core','EJS_gameUrl','EJS_emulator'].forEach(k => {
    try { delete window[k]; } catch(e) {}
  });
  $('emu').classList.remove('show');
  $('emu-load').classList.remove('done');
}
window.exitEmu = exitEmu;

function toggleFS() {
  const el = $('emu');
  if (!document.fullscreenElement)
    (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  else
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
}
window.toggleFS = toggleFS;

/* ════════════════════════════════════════════
   CONTEXT MENU
════════════════════════════════════════════ */
let ctxRom = null;

function showCtx(ref, rom) {
  ctxRom = rom;
  ctxMenu.classList.add('show');
  let x, y;
  if (ref instanceof Element) {
    const r = ref.getBoundingClientRect();
    x = r.left + 12; y = r.top + 12;
  } else {
    x = ref.clientX; y = ref.clientY;
  }
  ctxMenu.style.left = Math.min(x, window.innerWidth  - 165) + 'px';
  ctxMenu.style.top  = Math.min(y, window.innerHeight - 140) + 'px';
}

document.addEventListener('click',    () => ctxMenu.classList.remove('show'));
document.addEventListener('touchend', () => setTimeout(() => ctxMenu.classList.remove('show'), 120));

$('ctx-launch').addEventListener('click', () => {
  if (ctxRom) { selectRom(ctxRom); launchGame(ctxRom); }
});
$('ctx-info').addEventListener('click', () => {
  if (!ctxRom) return;
  const sys = getSys(ctxRom.ext);
  toast(`${sys.label} • ${mb(ctxRom.size)}`);
  ctxRom = null;
});
$('ctx-delete').addEventListener('click', () => {
  if (!ctxRom) return;
  try { URL.revokeObjectURL(ctxRom.url); } catch(e) {}
  S.roms = S.roms.filter(r => r.id !== ctxRom.id);
  if (S.selected && S.selected.id === ctxRom.id) {
    S.selected = null;
    titleEl.textContent = 'AUCUN JEU';
    updateBanner(null);
  }
  ctxRom = null;
  saveState(); render();
  toast('ROM supprimée');
});

/* ════════════════════════════════════════════
   DRAG & DROP
════════════════════════════════════════════ */
document.body.addEventListener('dragover', e => e.preventDefault());
document.body.addEventListener('drop', e => {
  e.preventDefault();
  handleRomFiles(e.dataTransfer.files, false);
});

/* ════════════════════════════════════════════
   TOAST
════════════════════════════════════════════ */
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

/* ════════════════════════════════════════════
   UTILS
════════════════════════════════════════════ */
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function mb(bytes) {
  if (!bytes) return '? MB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

/* ════════════════════════════════════════════
   PWA — SERVICE WORKER
════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  setTimeout(() => toast('💡 Menu → Ajouter à l\'accueil'), 4000);
});

/* ════════════════════════════════════════════
   INIT
════════════════════════════════════════════ */
loadState();

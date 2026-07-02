/* ============================================================
   Document Stitcher - Pure Vanilla JS  v7.7
   Features: 
   1. Multi-tool image editor (crop+rotate+flip+compress+convert at once)
   2. PDF input support with auto-detect + output options (pdf/jpg/png)
   3. Signature keyboard joystick placement (arrow keys)
   4. One-sided document cards with signature option
   5. Download format chooser (PDF/PNG/JPG) for every download
   6. Multi-person A4 passport layout (up to 4 persons)
============================================================ */

/* ============================================================
   ONLINE GUARD — blocks the app if there is no internet.
   Uses a real network probe (not cached) so the user cannot
   just enable airplane mode and keep using the app offline.
============================================================ */
const OnlineGuard = (() => {
  // A tiny uncached probe URL — we bust the cache with a timestamp
  // so the service worker cannot serve it from cache.
  const PROBE_URL = () =>
    `https://www.google.com/generate_204?_=${Date.now()}`;

  const CHECK_INTERVAL_MS = 8000;   // re-check every 8 s while offline
  const CHECK_LIVE_MS     = 30000;  // re-check every 30 s while online (catch mid-session drops)
  let _timer = null;
  let _overlayEl = null;
  let _online = true;

  /* ---- Create the blocking overlay (once) ---- */
  function _ensureOverlay() {
    if (_overlayEl) return _overlayEl;
    _overlayEl = document.createElement('div');
    _overlayEl.id = 'ds-offline-overlay';
    _overlayEl.style.cssText = [
      'position:fixed','inset:0','z-index:2147483647',
      'background:rgba(8,12,22,0.97)','backdrop-filter:blur(8px)',
      'display:flex','align-items:center','justify-content:center',
      'font-family:system-ui,sans-serif','padding:24px','text-align:center',
    ].join(';');
    _overlayEl.innerHTML = `
      <div style="background:#131929;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:48px 36px;max-width:400px;width:100%">
        <div style="font-size:52px;margin-bottom:16px">📵</div>
        <div style="font-size:20px;font-weight:800;color:#f0f4ff;margin-bottom:10px;font-family:'Space Grotesk',system-ui">No Internet Connection</div>
        <div style="font-size:13.5px;color:#8492a6;line-height:1.65;margin-bottom:28px">
          DocStitcher requires an active internet connection.<br>
          Please connect to Wi-Fi or mobile data.
        </div>
        <div id="ds-offline-checking" style="font-size:12px;color:#4a5568;margin-bottom:16px">Checking connection…</div>
        <button onclick="OnlineGuard.retry()"
          style="background:linear-gradient(135deg,#f9a825,#f96b3f);color:#0c111d;font-weight:800;font-size:14px;padding:14px 28px;border-radius:12px;border:none;cursor:pointer;font-family:inherit">
          Try Again
        </button>
      </div>`;
    document.body.appendChild(_overlayEl);
    return _overlayEl;
  }

  /* ---- Show the overlay ---- */
  function _block() {
    if (_online === false) return; // already blocked
    _online = false;
    document.body.style.overflow = 'hidden';
    const ov = _ensureOverlay();
    ov.style.display = 'flex';
    _scheduleCheck(CHECK_INTERVAL_MS);
  }

  /* ---- Hide the overlay ---- */
  function _unblock() {
    _online = true;
    document.body.style.overflow = '';
    if (_overlayEl) _overlayEl.style.display = 'none';
    _scheduleCheck(CHECK_LIVE_MS);
  }

  /* ---- Probe the network with a no-cache tiny request ---- */
  async function _probe() {
    try {
      const r = await fetch(PROBE_URL(), {
        method: 'HEAD',
        mode: 'no-cors',        // avoids CORS error; still fails when offline
        cache: 'no-store',      // never served from SW or browser cache
        signal: AbortSignal.timeout(6000),
      });
      return true; // any response (even opaque) means we reached the network
    } catch {
      return false;
    }
  }

  /* ---- Schedule next check ---- */
  function _scheduleCheck(ms) {
    clearTimeout(_timer);
    _timer = setTimeout(_tick, ms);
  }

  /* ---- One check cycle ---- */
  async function _tick() {
    const el = document.getElementById('ds-offline-checking');
    if (el) el.textContent = 'Checking connection…';
    const online = await _probe();
    if (online) {
      _unblock();
    } else {
      if (el) el.textContent = 'Still offline. Retrying…';
      _scheduleCheck(CHECK_INTERVAL_MS);
    }
  }

  /* ---- Public: manual retry from the "Try Again" button ---- */
  async function retry() {
    const el = document.getElementById('ds-offline-checking');
    if (el) el.textContent = 'Checking…';
    const online = await _probe();
    if (online) {
      _unblock();
    } else {
      if (el) el.textContent = 'Still no connection. Please check your network.';
    }
  }

  /* ---- Init — run on DOMContentLoaded ---- */
  async function init() {
    // Immediate probe
    const online = await _probe();
    if (!online) {
      _block();
    } else {
      // Start the periodic live-session check
      _scheduleCheck(CHECK_LIVE_MS);
    }

    // Also listen to browser online/offline events as a secondary signal
    window.addEventListener('offline', () => _block());
    window.addEventListener('online',  () => _tick()); // still probe — browser event alone is unreliable
  }

  return { init, retry };
})();




/* ============================================================
   DSTransfer — cross-page image handoff via IndexedDB.
   The old approach stored the full image as a base64 data URL
   inside a single localStorage key. localStorage has a hard
   ~5-10MB-per-origin quota, and a base64 data URL is ~33% bigger
   than the raw image, so any reasonably large crop/edit blew
   straight past it and threw "Image is too big" / quota errors.
   IndexedDB has a vastly larger quota (typically hundreds of MB
   to several GB), so routing the handoff through it fixes that
   failure for normal-sized photos/scans.
============================================================ */
const DSTransfer = (() => {
  const DB_NAME = 'ds_transfer_db';
  const STORE = 'transfer';
  const KEY = 'pending';

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function save(meta) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(meta, KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      // Tiny same-tab/cross-tab flag (always small) so other code can know
      // "something is pending" without opening IndexedDB first.
      try { localStorage.setItem('ds_pending_flag', '1'); } catch (e) {}
      return true;
    } catch (e) {
      console.warn('DSTransfer.save failed', e);
      return false;
    }
  }

  async function load() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('DSTransfer.load failed', e);
      return null;
    }
  }

  async function clear() {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { console.warn('DSTransfer.clear failed', e); }
    try { localStorage.removeItem('ds_pending_flag'); } catch (e) {}
  }

  return { save, load, clear };
})();






const A4_MM = {
  portrait:  [210, 297],
  landscape: [297, 210],
};

const SLOT_META = {
  front: { label: Lang.t('slotFront'), badge: Lang.t('slotBadgeFront') },
  back:  { label: Lang.t('slotBack'),  badge: Lang.t('slotBadgeBack')  },
  sign:  { label: Lang.t('slotSign'),  badge: ''       },
};

const state = {
  docs: [],
  nextDocNumber: 1,
};

/* ============================================================
   UTILITY
============================================================ */
function fmtBytes(b) {
  if (!Number.isFinite(b)) return '-';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function cleanFilename(name) {
  return (String(name||'document').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' '))||'document';
}
function toast(msg, type='success', containerId='toastWrap') {
  const w = document.getElementById(containerId);
  if (!w) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function updateSliderGradient(el) {
  const pct = ((el.value - el.min) / (el.max - el.min) * 100).toFixed(1) + '%';
  el.style.setProperty('--pct', pct);
}
function waitFrame() { return new Promise(r => requestAnimationFrame(r)); }
function triggerFileInput(id) { const el = document.getElementById(id); if (el) el.click(); }
function getDoc(docId) { return state.docs.find(d => d.id === Number(docId)); }
function isDocReady(doc) { return !!(doc && doc.files.front && (doc.oneSided || doc.files.back)); }
function hasAnyFile(doc) { return !!(doc.files.front || doc.files.back || doc.files.sign); }
function toggleHelp() {
  const p = document.getElementById('helpPanel');
  if (p) p.style.display = p.style.display==='none' ? 'block' : 'none';
}

/* ============================================================
   STATE PERSISTENCE — save/restore full app state to localStorage
   so images survive navigation between app.html and tools.html
============================================================ */
const STATE_STORAGE_KEY = 'ds_app_state_v1';

function saveAppState() {
  try {
    const toSave = {
      nextDocNumber: state.nextDocNumber,
      docs: state.docs.map(doc => ({
        id: doc.id,
        number: doc.number,
        name: doc.name,
        orientation: doc.orientation,
        quality: doc.quality,
        oneSided: doc.oneSided,
        signatureEnabled: doc.signatureEnabled,
        signScale: doc.signScale,
        signOffsetX: doc.signOffsetX,
        signOffsetY: doc.signOffsetY,
        files: {
          front: doc.files.front ? { dataUrl: doc.files.front.dataUrl, name: doc.files.front.file.name, size: doc.files.front.file.size, sourceType: doc.files.front.sourceType } : null,
          back:  doc.files.back  ? { dataUrl: doc.files.back.dataUrl,  name: doc.files.back.file.name,  size: doc.files.back.file.size,  sourceType: doc.files.back.sourceType  } : null,
          sign:  doc.files.sign  ? { dataUrl: doc.files.sign.dataUrl,  name: doc.files.sign.file.name,  size: doc.files.sign.file.size,  sourceType: doc.files.sign.sourceType  } : null,
        },
      })),
    };
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(toSave));
  } catch(e) {
    console.warn('Could not save app state:', e);
  }
}

function restoreAppState(onDone) {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) { onDone(false); return; }
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.docs) || saved.docs.length === 0) { onDone(false); return; }

    state.nextDocNumber = saved.nextDocNumber || 1;
    state.docs = [];
    let pending = 0;

    saved.docs.forEach(d => {
      const doc = {
        id: d.id,
        number: d.number,
        name: d.name,
        orientation: d.orientation || 'portrait',
        quality: d.quality || 80,
        oneSided: !!d.oneSided,
        signatureEnabled: !!d.signatureEnabled,
        signScale: d.signScale || 1.0,
        signOffsetX: d.signOffsetX || 0,
        signOffsetY: d.signOffsetY || 0,
        files: { front: null, back: null, sign: null },
        estimate: null,
        estimateStatus: 'waiting',
        estimateTimer: null,
        estimateToken: 0,
        pdfBlob: null,
        pdfUrl: null,
      };
      state.docs.push(doc);

      ['front', 'back', 'sign'].forEach(slot => {
        const f = d.files && d.files[slot];
        if (!f || !f.dataUrl) return;
        pending++;
        const img = new Image();
        img.onload = () => {
          const mime = (f.dataUrl.match(/^data:([^;]+);/) || [])[1] || 'image/jpeg';
          const fakeFile = new File([], f.name || (slot + '.jpg'), { type: mime });
          Object.defineProperty(fakeFile, 'size', { value: f.size || 0 });
          doc.files[slot] = { file: fakeFile, dataUrl: f.dataUrl, img, sourceType: f.sourceType || 'image' };
          pending--;
          if (pending === 0) onDone(true);
        };
        img.onerror = () => { pending--; if (pending === 0) onDone(true); };
        img.src = f.dataUrl;
      });
    });

    if (pending === 0) onDone(true);
  } catch(e) {
    console.warn('Could not restore app state:', e);
    onDone(false);
  }
}

/* ============================================================
   DOWNLOAD FORMAT PICKER MODAL
============================================================ */
let _dlResolve = null;

function showDownloadPicker(title) {
  return new Promise(resolve => {
    _dlResolve = resolve;
    document.getElementById('dlPickerTitle').textContent = title || Lang.t('dlPickerTitle');
    const m = document.getElementById('dlPickerModal');
    m.style.cssText = 'display:flex !important;position:fixed;inset:0;z-index:200000;background:rgba(30,44,64,0.55);align-items:center;justify-content:center;backdrop-filter:blur(3px)';
  });
}
function pickDownloadFormat(fmt) {
  document.getElementById('dlPickerModal').style.display = 'none';
  if (_dlResolve) { _dlResolve(fmt); _dlResolve = null; }
}
function cancelDownloadPicker() {
  document.getElementById('dlPickerModal').style.display = 'none';
  if (_dlResolve) { _dlResolve(null); _dlResolve = null; }
}

/* ============================================================
   DOCUMENT MANAGEMENT
============================================================ */
function addDocument(oneSided = false) {
  const number = state.nextDocNumber++;
  state.docs.push({
    id: Date.now() + number,
    number,
    name: `${Lang.current() === 'bn' ? 'ডকুমেন্ট' : 'document'} ${number}`,
    orientation: 'portrait',
    quality: 80,
    oneSided,
    files: { front: null, back: null, sign: null },
    signatureEnabled: false,
    signScale: 1.0,
    signOffsetX: 0,  // mm offset from centre
    signOffsetY: 0,
    estimate: null,
    estimateStatus: 'waiting',
    estimateTimer: null,
    estimateToken: 0,
    pdfBlob: null,
    pdfUrl: null,
  });
  renderDocuments();
  refreshAllEstimates();
  saveAppState();
}

function toggleDocType(docId) {
  const doc = getDoc(docId);
  if (!doc) return;
  doc.oneSided = !doc.oneSided;
  if (doc.oneSided && doc.files.back) {
    // Keep the back image in memory (not discarded) in case the user
    // switches back to two-sided, but it won't be used while one-sided.
  }
  invalidateDoc(doc);
  renderDocuments();
  scheduleDocEstimate(doc);
  saveAppState();
  toast(doc.oneSided ? Lang.t('typeLabelOneSided') : Lang.t('typeLabelTwoSided'), 'success');
}

function removeDocument(docId) {
  if (state.docs.length <= 2) { toast(Lang.t('toastKeepTwo'), 'error'); return; }
  const doc = getDoc(docId);
  if (doc && doc.pdfUrl) URL.revokeObjectURL(doc.pdfUrl);
  state.docs = state.docs.filter(d => d.id !== Number(docId));
  renderDocuments();
  updateBatchActions();
  saveAppState();
}

function renderDocuments() {
  const list = document.getElementById('documentsList');
  if (!list) return;

  // Two ad cadences rendered side-by-side in the DOM, each shown only at
  // its own breakpoint via CSS (see app-ui.css), so no re-render on resize:
  //  - narrow/mobile (<=1320px, side rails hidden there): ad after every card
  //  - wide/desktop (>1320px, side rails already showing): ad after every
  //    2 rows of cards (the grid is 2 columns wide, so that's every 4 cards)
  const ADS_EVERY_N_CARDS_NARROW = 1;
  const ADS_EVERY_N_CARDS_WIDE = 4;
  const html = [];
  state.docs.forEach((doc, i) => {
    html.push(renderDocumentCard(doc));
    const isLast = i === state.docs.length - 1;
    if (!isLast) {
      if ((i + 1) % ADS_EVERY_N_CARDS_NARROW === 0) {
        html.push(renderInFeedAdSlot(i, 'in-feed-ad-slot-narrow'));
      }
      if ((i + 1) % ADS_EVERY_N_CARDS_WIDE === 0) {
        html.push(renderInFeedAdSlot(i, 'in-feed-ad-slot-wide'));
      }
    }
  });
  list.innerHTML = html.join('');

  state.docs.forEach(doc => {
    const slider = document.getElementById(`quality-${doc.id}`);
    if (slider) updateSliderGradient(slider);
    schedulePreviewDraw(doc);
  });
  updateBatchActions();
}

function renderInFeedAdSlot(index, extraClass) {
  return `
    <div class="in-feed-ad-slot ${extraClass}" id="inFeedAdSlot-${extraClass}-${index}" aria-hidden="true">
      <span>Advertisement</span>
    </div>`;
}

function renderDocumentCard(doc) {
  const ready = isDocReady(doc);
  const estimateText = doc.estimate
    ? fmtBytes(doc.estimate)
    : ready
      ? (doc.estimateStatus==='working' ? Lang.t('estimateCalculating') : Lang.t('estimatePending'))
      : (doc.oneSided ? Lang.t('estimateAddFront') : Lang.t('estimateAddBoth'));
  const typeLabel = doc.oneSided ? Lang.t('typeLabelOneSided') : Lang.t('typeLabelTwoSided');
  const switchLabel = doc.oneSided ? 'Change to Two-Sided' : 'Change to One-Sided';

  return `
    <section class="card document-card" data-doc-id="${doc.id}">
      <div class="document-card-head">
        <div>
          <div class="document-kicker-row">
            <span class="document-kicker">${typeLabel}</span>
            <button class="doc-type-switch-btn" type="button" onclick="toggleDocType(${doc.id})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              <span>${switchLabel}</span>
            </button>
          </div>
          <input class="doc-name-input" value="${escapeHtml(doc.name)}" aria-label="${Lang.t('docNameAria')}" oninput="updateDocName(${doc.id}, this.value)">
        </div>
        <button class="btn-ghost icon-btn" title="${Lang.t('removeTitle')}" onclick="removeDocument(${doc.id})">×</button>
      </div>

      <div class="document-settings">
        <div class="ctrl-group">
          <label class="ctrl-label" for="orientation-${doc.id}">${Lang.t('labelOrientation')}</label>
          <select class="ctrl-select" id="orientation-${doc.id}" onchange="updateDocOrientation(${doc.id}, this.value)">
            <option value="portrait"${doc.orientation==='portrait'?' selected':''}>${Lang.t('optPortrait')}</option>
            <option value="landscape"${doc.orientation==='landscape'?' selected':''}>${Lang.t('optLandscape')}</option>
          </select>
        </div>
        <div class="ctrl-group quality-control">
          <label class="ctrl-label" for="quality-${doc.id}">${Lang.t('labelQuality')} <span id="qualityLabel-${doc.id}">${doc.quality}%</span></label>
          <div class="slider-wrap">
            <input type="range" id="quality-${doc.id}" min="1" max="100" value="${doc.quality}" oninput="updateDocQuality(${doc.id}, this)" style="--pct:${((doc.quality - 1) / 99 * 100).toFixed(1)}%">
          </div>
          <div class="target-size-wrap" style="margin-top:8px">
            <input type="number" class="target-size-input" id="targetKb-${doc.id}" min="20" max="10240" placeholder="${Lang.t('targetSizePlaceholder')}" oninput="updateTargetKbLabel(${doc.id}, this)">
            <span class="ctrl-label" style="white-space:nowrap;align-self:center">KB</span>
            <button class="target-size-btn" onclick="applyTargetKb(${doc.id})">${Lang.t('btnSet')}</button>
          </div>
        </div>
        <div class="estimate-pill ${ready ? 'ready' : ''}">
          <span>${Lang.t('labelDownloadSize')}</span>
          <strong id="estimate-${doc.id}">${estimateText}</strong>
        </div>
      </div>

      <div class="doc-layout-preview ${doc.orientation}">
        <div class="paper-mini paper-mini-canvas" title="${ready ? Lang.t('previewAltReady') : Lang.t('previewAltWait')}" onclick="openPreviewLightbox(${doc.id})">
          <canvas class="preview-canvas" id="preview-canvas-${doc.id}"></canvas>
          ${ready ? '<div class="preview-canvas-hint">'+Lang.t('previewClickHint')+'</div>' : ''}
        </div>
      </div>

      <label class="signature-toggle">
        <input type="checkbox" ${doc.signatureEnabled ? 'checked' : ''} onchange="toggleSignature(${doc.id}, this.checked)">
        <span>${Lang.t('sigToggle')}</span>
      </label>
      ${doc.signatureEnabled ? renderSignControls(doc) : ''}

      <div class="doc-slot-grid ${doc.oneSided ? 'one-sided' : ''} ${doc.signatureEnabled ? 'with-signature' : ''}">
        ${renderSlot(doc, 'front')}
        ${!doc.oneSided ? renderSlot(doc, 'back') : ''}
        ${doc.signatureEnabled ? renderSlot(doc, 'sign') : ''}
      </div>

      <div class="document-actions">
        <button class="btn-primary" onclick="downloadDocument(${doc.id})" ${ready ? '' : 'disabled'}>${Lang.t('btnDownload')}</button>
        ${ready ? `<button class="btn-secondary" onclick="openPreviewLightbox(${doc.id})">${Lang.t('btnPreview')}</button>` : ''}
        <button class="btn-secondary" onclick="clearDocument(${doc.id})" ${hasAnyFile(doc) ? '' : 'disabled'}>${Lang.t('btnClearImages')}</button>
        ${doc.signatureEnabled && doc.files.sign ? `<button class="btn-secondary" onclick="openSignaturePlacer(${doc.id})">🎯 ${Lang.t('btnPlaceSign').replace('🎯 ','')}</button>` : ''}
      </div>
    </section>
  `;
}

function renderSignControls(doc) {
  const pct = ((doc.signScale * 100 - 30) / (300 - 30) * 100).toFixed(1) + '%';
  const label = Math.round(doc.signScale * 100) + '%';
  return `
    <div class="sign-scale-wrap">
      <label class="ctrl-label">${Lang.t('labelSigSize')} &nbsp;<span id="signScaleLabel-${doc.id}">${label}</span></label>
      <div class="slider-wrap" style="gap:8px">
        <span class="ctrl-label" style="font-size:10px">30%</span>
        <input type="range" id="signScale-${doc.id}" min="30" max="300" step="5" value="${Math.round(doc.signScale*100)}"
          oninput="updateSignScale(${doc.id}, this)" style="--pct:${pct}">
        <span class="ctrl-label" style="font-size:10px">300%</span>
      </div>
      <div class="sign-scale-presets">
        <button class="sign-preset-btn" onclick="setSignScale(${doc.id}, 0.5)">${Lang.t('signPresetSmall')}</button>
        <button class="sign-preset-btn" onclick="setSignScale(${doc.id}, 1.0)">${Lang.t('signPresetNormal')}</button>
        <button class="sign-preset-btn" onclick="setSignScale(${doc.id}, 1.5)">${Lang.t('signPresetLarge')}</button>
        <button class="sign-preset-btn" onclick="setSignScale(${doc.id}, 2.0)">${Lang.t('signPresetXL')}</button>
      </div>
      <div class="sign-offset-info" id="signOffset-${doc.id}" style="font-size:11px;color:var(--text-muted);margin-top:4px">
        ${Lang.t('signOffsetLabel')} X=${doc.signOffsetX.toFixed(1)}mm Y=${doc.signOffsetY.toFixed(1)}mm
        <button class="btn-ghost" style="font-size:10px;padding:2px 8px;margin-left:6px" onclick="resetSignOffset(${doc.id})">${Lang.t('btnResetOffset')}</button>
      </div>
    </div>
  `;
}

function renderSlot(doc, slot) {
  const fileObj = doc.files[slot];
  const meta = SLOT_META[slot];
  const optional = slot === 'sign';
  const inputId = `file-${doc.id}-${slot}`;
  const dropId  = `drop-${doc.id}-${slot}`;
  const accept  = slot === 'sign'
    ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
    : '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

  return `
    <div class="doc-slot ${fileObj ? 'has-image' : ''}">
      <div class="slot-heading">
        <span>${meta.label}</span>
        <small>${meta.badge}</small>
      </div>
      <div class="drop-zone compact-drop" id="${dropId}"
           onclick="triggerFileInput('${inputId}')"
           ondragover="dzDrag(event,'${dropId}')"
           ondragleave="dzLeave('${dropId}')"
           ondrop="dzDrop(event,'${dropId}',${doc.id},'${slot}')">
        <input type="file" id="${inputId}" accept="${accept}" onchange="handleFile(this.files[0],${doc.id},'${slot}')">
        ${fileObj ? `
          <img class="drop-preview slot-img-clickable" src="${fileObj.dataUrl}" alt="${escapeHtml(meta.label)}" onclick="viewFull(${doc.id},'${slot}',event)" title="Click to enlarge">
          <div class="drop-overlay">
            <button class="btn-ghost" onclick="clearSlot(${doc.id},'${slot}',event)">${Lang.t('btnRemoveSlot')}</button>
            <button class="btn-ghost" onclick="viewFull(${doc.id},'${slot}',event)">${Lang.t('btnViewSlot')}</button>
          </div>
        ` : `
          <div class="drop-placeholder">
            <div class="drop-icon">${optional ? 'Sign' : slot==='front' ? Lang.t('slotBadgeFront') : Lang.t('slotBadgeBack')}</div>
            <div class="drop-label">${optional ? Lang.t('dropOptional') : Lang.t('dropClickOrDrag')}</div>
            <div class="drop-hint">${slot==='sign' ? Lang.t('hintImageOnly') : Lang.t('hintImagePdf')}</div>
          </div>
        `}
      </div>
      <div class="slot-info ${fileObj ? '' : 'empty'}">
        <span class="slot-fname">${fileObj ? escapeHtml(fileObj.file.name) : (optional ? Lang.t('noSignature') : Lang.t('slotRequired'))}</span>
        <span class="slot-size">${fileObj ? fmtBytes(fileObj.file.size) : ''}</span>
      </div>
    </div>
  `;
}

/* ============================================================
   DOC STATE UPDATES
============================================================ */
function updateDocName(docId, value) { const d = getDoc(docId); if (d) { d.name = value; saveAppState(); } }
function updateDocOrientation(docId, value) {
  const d = getDoc(docId); if (!d) return;
  d.orientation = value === 'landscape' ? 'landscape' : 'portrait';
  invalidateDoc(d); renderDocuments(); scheduleDocEstimate(d); saveAppState();
}
function updateDocQuality(docId, el) {
  const d = getDoc(docId); if (!d) return;
  d.quality = Number(el.value); updateSliderGradient(el);
  const lbl = document.getElementById(`qualityLabel-${docId}`);
  if (lbl) lbl.textContent = d.quality + '%';
  const kbInput = document.getElementById(`targetKb-${docId}`);
  if (kbInput) { kbInput.value = ''; kbInput.classList.remove('ts-error','ts-ok'); }
  invalidateDoc(d); scheduleDocEstimate(d); saveAppState();
}
function updateTargetKbLabel(docId, el) {
  const v = parseInt(el.value);
  el.classList.remove('ts-error','ts-ok');
  if (!el.value) return;
  el.classList.add((isNaN(v)||v<20||v>10240) ? 'ts-error' : 'ts-ok');
}
async function applyTargetKb(docId) {
  const doc = getDoc(docId); if (!doc) return;
  const kbInput = document.getElementById(`targetKb-${docId}`);
  if (!kbInput) return;
  const targetKb = parseInt(kbInput.value);
  if (isNaN(targetKb)||targetKb<20||targetKb>10240) { kbInput.classList.add('ts-error'); toast(Lang.t('toastRangeKb'),'error'); return; }
  if (!isDocReady(doc)) { toast(Lang.t('toastUploadImgFirst'),'error'); return; }
  const targetBytes = targetKb * 1024;
  let lo=1,hi=100,bestQ=doc.quality,bestBlob=null;
  for (let i=0;i<8;i++) {
    const mid = Math.round((lo+hi)/2);
    const testDoc = Object.assign({},doc,{quality:mid});
    const blob = await buildDocPdfBlob(testDoc);
    if (blob.size <= targetBytes) { bestQ=mid; bestBlob=blob; lo=mid+1; } else { hi=mid-1; }
    if (lo>hi) break;
  }
  doc.quality = bestQ;
  if (bestBlob) { doc.pdfBlob=bestBlob; doc.estimate=bestBlob.size; doc.estimateStatus='ready'; }
  const slider = document.getElementById(`quality-${docId}`);
  if (slider) { slider.value=bestQ; updateSliderGradient(slider); }
  const lbl = document.getElementById(`qualityLabel-${docId}`);
  if (lbl) lbl.textContent = bestQ + '%';
  kbInput.classList.remove('ts-error'); kbInput.classList.add('ts-ok');
  updateEstimateText(doc); updateBatchActions();
  toast(Lang.t('toastQualitySet')+bestQ+'% (~'+fmtBytes(doc.estimate||0)+')');
  saveAppState();
}
function toggleSignature(docId, enabled) {
  const doc = getDoc(docId); if (!doc) return;
  doc.signatureEnabled = !!enabled;
  if (!doc.signatureEnabled) { doc.files.sign=null; doc.signOffsetX=0; doc.signOffsetY=0; }
  invalidateDoc(doc); renderDocuments(); scheduleDocEstimate(doc); saveAppState();
}
function updateSignScale(docId, el) {
  const doc = getDoc(docId); if (!doc) return;
  doc.signScale = Number(el.value)/100; updateSliderGradient(el);
  const lbl = document.getElementById('signScaleLabel-'+docId);
  if (lbl) lbl.textContent = Math.round(doc.signScale*100)+'%';
  invalidateDoc(doc); scheduleDocEstimate(doc); schedulePreviewDraw(doc); saveAppState();
}
function setSignScale(docId, scale) {
  const doc = getDoc(docId); if (!doc) return;
  doc.signScale = scale;
  const slider = document.getElementById('signScale-'+docId);
  if (slider) { slider.value=Math.round(scale*100); updateSliderGradient(slider); }
  const lbl = document.getElementById('signScaleLabel-'+docId);
  if (lbl) lbl.textContent = Math.round(scale*100)+'%';
  invalidateDoc(doc); scheduleDocEstimate(doc); schedulePreviewDraw(doc); saveAppState();
}
function resetSignOffset(docId) {
  const doc = getDoc(docId); if (!doc) return;
  doc.signOffsetX=0; doc.signOffsetY=0;
  updateSignOffsetDisplay(doc); invalidateDoc(doc); scheduleDocEstimate(doc); schedulePreviewDraw(doc); saveAppState();
}
function updateSignOffsetDisplay(doc) {
  const el = document.getElementById('signOffset-'+doc.id);
  if (el) el.innerHTML = `Position: X=${doc.signOffsetX.toFixed(1)}mm Y=${doc.signOffsetY.toFixed(1)}mm
    <button class="btn-ghost" style="font-size:10px;padding:2px 8px;margin-left:6px" onclick="resetSignOffset(${doc.id})">Reset</button>`;
}
function clearDocument(docId) {
  const doc = getDoc(docId); if (!doc) return;
  doc.files={front:null,back:null,sign:null}; doc.signatureEnabled=false; doc.signOffsetX=0; doc.signOffsetY=0;
  invalidateDoc(doc); renderDocuments(); saveAppState();
}

/* ============================================================
   SIGNATURE KEYBOARD PLACER MODAL
============================================================ */
let _sigPlacerDocId = null;
let _sigPlacerAnimFrame = null;

function openSignaturePlacer(docId) {
  const doc = getDoc(docId);
  if (!doc || !doc.files.sign) { toast('Upload a signature image first.', 'error'); return; }
  _sigPlacerDocId = docId;
  const modal = document.getElementById('sigPlacerModal');
  modal.style.cssText = 'display:flex !important;position:fixed;inset:0;z-index:200001;background:rgba(18,26,40,0.88);flex-direction:column;align-items:center;justify-content:center;gap:16px;backdrop-filter:blur(4px);padding:20px';
  renderSigPlacer(doc);
  modal.focus();
}

function renderSigPlacer(doc) {
  const canvas = document.getElementById('sigPlacerCanvas');
  const ctx = canvas.getContext('2d');
  const isPort = doc.orientation === 'portrait';
  const [pw, ph] = isPort ? [210, 297] : [297, 210];

  // Canvas size for display
  const maxW = Math.min(window.innerWidth - 48, 480);
  const maxH = Math.min(window.innerHeight - 200, 600);
  let cW, cH;
  if (isPort) {
    cH = Math.min(maxH, maxW * 297/210);
    cW = cH * 210/297;
  } else {
    cW = Math.min(maxW, maxH * 297/210);
    cH = cW * 210/297;
  }
  canvas.width  = Math.round(cW);
  canvas.height = Math.round(cH);
  canvas.style.width  = Math.round(cW) + 'px';
  canvas.style.height = Math.round(cH) + 'px';

  drawSigPlacerCanvas(doc, canvas, ctx, pw, ph, cW, cH);
}

function drawSigPlacerCanvas(doc, canvas, ctx, pw, ph, cW, cH) {
  const scX = cW/pw, scY = cH/ph;

  // White background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cW, cH);

  // Draw front image (or placeholder)
  const isPort = doc.orientation === 'portrait';
  const pad = 12, gap = 8;
  const hasSign = doc.signatureEnabled && doc.files.sign;
  const SIGN_BAND_H = 40;
  const imgAreaBot = hasSign ? ph - pad - SIGN_BAND_H : ph - pad;
  const imgAreaH = imgAreaBot - pad;
  const imgAreaW = pw - pad*2;

  function drawImg(imgEl, xMm, yMm, bW, bH) {
    if (!imgEl || !imgEl.complete || !imgEl.naturalWidth) {
      ctx.fillStyle = 'rgba(249,107,63,0.08)';
      ctx.fillRect(xMm*scX, yMm*scY, bW*scX, bH*scY);
      return;
    }
    const r = imgEl.naturalWidth/imgEl.naturalHeight;
    let w=bW, h=w/r; if(h>bH){h=bH;w=h*r;}
    ctx.drawImage(imgEl, (xMm+(bW-w)/2)*scX, yMm*scY, w*scX, h*scY);
  }

  if (isPort) {
    const useH = doc.oneSided ? imgAreaH : (imgAreaH-gap)/2;
    drawImg(doc.files.front?.img, pad, pad, imgAreaW, useH);
    if (!doc.oneSided) drawImg(doc.files.back?.img, pad, pad+useH+gap, imgAreaW, useH);
  } else {
    const useW = doc.oneSided ? imgAreaW : (imgAreaW-gap)/2;
    drawImg(doc.files.front?.img, pad, pad, useW, imgAreaH);
    if (!doc.oneSided) drawImg(doc.files.back?.img, pad+useW+gap, pad, useW, imgAreaH);
  }

  // Draw signature at current offset
  if (hasSign && doc.files.sign && doc.files.sign.img.complete && doc.files.sign.img.naturalWidth) {
    const signScale = doc.signScale || 1.0;
    const MAX_W = Math.min(63.5*signScale, pw-pad*2);
    const MAX_H = Math.min(40*signScale, 40);
    const sImg = doc.files.sign.img;
    const ratio = sImg.naturalWidth/sImg.naturalHeight;
    let sw=MAX_W, sh=sw/ratio; if(sh>MAX_H){sh=MAX_H;sw=sh*ratio;}

    const bandTop = imgAreaBot;
    const bandH   = ph - pad - bandTop;
    const baseX = (pw-sw)/2 + doc.signOffsetX;
    const baseY = bandTop + (bandH-sh)/2 + doc.signOffsetY;

    // Glow effect to show it's the active element
    ctx.save();
    ctx.shadowColor = 'rgba(249,107,63,0.6)';
    ctx.shadowBlur = 10;
    ctx.drawImage(sImg, baseX*scX, baseY*scY, sw*scX, sh*scY);
    ctx.restore();

    // Dashed border around signature
    ctx.setLineDash([3,3]);
    ctx.strokeStyle = 'rgba(249,107,63,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(baseX*scX-1, baseY*scY-1, sw*scX+2, sh*scY+2);
    ctx.setLineDash([]);
  }

  // Page border
  ctx.strokeStyle = 'rgba(30,44,64,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, cW-1, cH-1);
}

function closeSigPlacer() {
  const m = document.getElementById('sigPlacerModal');
  m.style.display = 'none';
  _sigPlacerDocId = null;
  if (_sigPlacerAnimFrame) { cancelAnimationFrame(_sigPlacerAnimFrame); _sigPlacerAnimFrame = null; }
  renderDocuments();
}

function confirmSigPlacement() {
  if (_sigPlacerDocId !== null) {
    const doc = getDoc(_sigPlacerDocId);
    if (doc) { invalidateDoc(doc); scheduleDocEstimate(doc); schedulePreviewDraw(doc); saveAppState(); }
    toast(Lang.t('toastSignSaved'));
  }
  closeSigPlacer();
}

// Keyboard joystick for signature placement
document.addEventListener('keydown', function(e) {
  if (_sigPlacerDocId === null) return;
  const modal = document.getElementById('sigPlacerModal');
  if (modal.style.display === 'none') return;

  const doc = getDoc(_sigPlacerDocId);
  if (!doc) return;

  const step = e.shiftKey ? 5 : 1; // Shift = bigger steps
  let changed = false;
  if (e.key === 'ArrowLeft')  { doc.signOffsetX -= step; changed = true; e.preventDefault(); }
  if (e.key === 'ArrowRight') { doc.signOffsetX += step; changed = true; e.preventDefault(); }
  if (e.key === 'ArrowUp')    { doc.signOffsetY -= step; changed = true; e.preventDefault(); }
  if (e.key === 'ArrowDown')  { doc.signOffsetY += step; changed = true; e.preventDefault(); }
  if (e.key === 'Enter')      { confirmSigPlacement(); return; }
  if (e.key === 'Escape')     { closeSigPlacer(); return; }

  if (changed) {
    // Clamp within reasonable bounds (±80mm)
    doc.signOffsetX = Math.max(-80, Math.min(80, doc.signOffsetX));
    doc.signOffsetY = Math.max(-80, Math.min(80, doc.signOffsetY));
    // Redraw
    const canvas = document.getElementById('sigPlacerCanvas');
    const ctx = canvas.getContext('2d');
    const isPort = doc.orientation === 'portrait';
    const [pw, ph] = isPort ? [210,297] : [297,210];
    drawSigPlacerCanvas(doc, canvas, ctx, pw, ph, canvas.width, canvas.height);
    // Update position display
    const posEl = document.getElementById('sigPlacerPos');
    if (posEl) posEl.textContent = `X: ${doc.signOffsetX.toFixed(1)}mm  Y: ${doc.signOffsetY.toFixed(1)}mm`;
  }
});

/* ============================================================
   FILE HANDLING (images + PDF)
============================================================ */
function dzDrag(e, id) { e.preventDefault(); const d=document.getElementById(id); if(d) d.classList.add('drag-over'); }
function dzLeave(id) { const d=document.getElementById(id); if(d) d.classList.remove('drag-over'); }
function dzDrop(e, dropId, docId, slot) {
  e.preventDefault(); dzLeave(dropId);
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file, docId, slot);
}

function handleFile(file, docId, slot) {
  if (!file) return;
  const doc = getDoc(docId); if (!doc || !SLOT_META[slot]) return;

  const isPDF  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImg  = file.type.startsWith('image/');

  if (slot === 'sign' && isPDF) { toast(Lang.t('toastSignOnlyImg'),'error'); return; }
  if (!isPDF && !isImg) { toast(Lang.t('toastSelectImg'),'error'); return; }

  if (isPDF) {
    loadPdfAsImage(file, docId, slot);
  } else {
    loadImageFile(file, docId, slot);
  }
}

function loadImageFile(file, docId, slot) {
  const doc = getDoc(docId);
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      doc.files[slot] = { file, dataUrl: e.target.result, img, sourceType: 'image' };
      invalidateDoc(doc); renderDocuments(); scheduleDocEstimate(doc); schedulePreviewDraw(doc);
      saveAppState();
    };
    img.onerror = () => toast(Lang.t('toastImageError'),'error');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function loadPdfAsImage(file, docId, slot) {
  const doc = getDoc(docId);
  toast(Lang.t('toastPdfConverting'), 'success');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      // Use PDF.js via CDN if available, else use canvas fallback
      if (window.pdfjsLib) {
        const pdf = await window.pdfjsLib.getDocument({ data: e.target.result }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.5 }); // high-res
        const canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        // Use PNG for lossless intermediate to avoid quality loss when re-encoding
        const dataUrl = canvas.toDataURL('image/png');
        const img = new Image();
        img.onload = () => {
          doc.files[slot] = { file, dataUrl, img, sourceType: 'pdf' };
          invalidateDoc(doc); renderDocuments(); scheduleDocEstimate(doc); schedulePreviewDraw(doc);
          toast(Lang.t('toastPdfConverted'));
          saveAppState();
        };
        img.src = dataUrl;
      } else {
        // PDF.js not loaded — try dynamic load
        if (!document.getElementById('pdfjs-script')) {
          const s = document.createElement('script');
          s.id = 'pdfjs-script';
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            loadPdfAsImage(file, docId, slot);
          };
          document.head.appendChild(s);
        }
        return;
      }
    } catch(err) {
      console.error(err);
      toast(Lang.t('toastPdfError'), 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function clearSlot(docId, slot, e) {
  if (e) e.stopPropagation();
  const doc = getDoc(docId); if (!doc) return;
  doc.files[slot]=null;
  if (slot==='sign') { doc.signOffsetX=0; doc.signOffsetY=0; }
  invalidateDoc(doc); renderDocuments(); scheduleDocEstimate(doc); saveAppState();
}
function viewFull(docId, slot, e) {
  if (e) e.stopPropagation();
  const doc=getDoc(docId); const f=doc&&doc.files[slot]; if(!f) return;
  document.getElementById('lightboxImg').src=f.dataUrl;
  document.getElementById('lightbox').style.display='flex';
}
function closeLightbox(e) {
  if (e && e.target===document.getElementById('lightboxImg')) return;
  document.getElementById('lightbox').style.display='none';
}

/* ============================================================
   CANVAS PREVIEW
============================================================ */
function drawPreviewCanvas(doc, canvas) {
  const isPort = doc.orientation === 'portrait';
  const [pw, ph] = isPort ? [210,297] : [297,210];
  const BASE = isPort ? 420 : 594;
  const cW = isPort ? Math.round(BASE*210/297) : BASE;
  const cH = isPort ? BASE : Math.round(BASE*210/297);
  canvas.width=cW; canvas.height=cH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,cW,cH);
  const scaleX=cW/pw, scaleY=cH/ph;
  const pagePad=12, gap=8;
  const hasSign = doc.signatureEnabled && doc.files.sign;
  const SIGN_BAND_H=40;
  const imgAreaTop=pagePad;
  const imgAreaBot = hasSign ? ph-pagePad-SIGN_BAND_H : ph-pagePad;
  const imgAreaH=imgAreaBot-imgAreaTop, imgAreaW=pw-pagePad*2;

  function drawImgInBox(imgEl, xMm, yMm, bW, bH) {
    if (!imgEl||!imgEl.complete||!imgEl.naturalWidth) return;
    const r=imgEl.naturalWidth/imgEl.naturalHeight;
    let w=bW,h=w/r; if(h>bH){h=bH;w=h*r;}
    ctx.drawImage(imgEl,(xMm+(bW-w)/2)*scaleX,yMm*scaleY,w*scaleX,h*scaleY);
  }
  function placeholder(xMm, yMm, bW, bH, label, clr1, clr2) {
    ctx.fillStyle=clr1; ctx.fillRect(xMm*scaleX,yMm*scaleY,bW*scaleX,bH*scaleY);
    ctx.fillStyle=clr2; ctx.font=`bold ${Math.round(10*scaleY)}px sans-serif`;
    ctx.textAlign='center';
    ctx.fillText(label,(xMm+bW/2)*scaleX,(yMm+bH/2)*scaleY);
  }

  if (isPort) {
    // One-sided: use full imgAreaH. Two-sided: split into halves
    const useH = doc.oneSided ? imgAreaH : (imgAreaH-gap)/2;
    const startY = imgAreaTop;
    if (doc.files.front?.img?.complete && doc.files.front.img.naturalWidth)
      drawImgInBox(doc.files.front.img, pagePad, startY, imgAreaW, useH);
    else placeholder(pagePad, startY, imgAreaW, useH, 'FRONT','rgba(249,107,63,0.10)','rgba(249,107,63,0.35)');

    if (!doc.oneSided) {
      if (doc.files.back?.img?.complete && doc.files.back.img.naturalWidth)
        drawImgInBox(doc.files.back.img, pagePad, startY+useH+gap, imgAreaW, useH);
      else placeholder(pagePad, startY+useH+gap, imgAreaW, useH, 'BACK','rgba(110,216,196,0.10)','rgba(24,168,122,0.35)');
    }
  } else {
    // Landscape: one-sided fills full width, two-sided splits
    const useW = doc.oneSided ? imgAreaW : (imgAreaW-gap)/2;
    if (doc.files.front?.img?.complete && doc.files.front.img.naturalWidth)
      drawImgInBox(doc.files.front.img, pagePad, imgAreaTop, useW, imgAreaH);
    else placeholder(pagePad, imgAreaTop, useW, imgAreaH, 'FRONT','rgba(249,107,63,0.10)','rgba(249,107,63,0.35)');

    if (!doc.oneSided) {
      if (doc.files.back?.img?.complete && doc.files.back.img.naturalWidth)
        drawImgInBox(doc.files.back.img, pagePad+useW+gap, imgAreaTop, useW, imgAreaH);
      else placeholder(pagePad+useW+gap, imgAreaTop, useW, imgAreaH, 'BACK','rgba(110,216,196,0.10)','rgba(24,168,122,0.35)');
    }
  }

  if (hasSign) {
    const bandTop=imgAreaBot, bandH=ph-pagePad-bandTop;
    if (doc.files.sign?.img?.complete && doc.files.sign.img.naturalWidth) {
      const signScale=doc.signScale||1.0;
      const MAX_W=Math.min(63.5*signScale,pw-pagePad*2), MAX_H=Math.min(40*signScale,40);
      const sImg=doc.files.sign.img; const ratio=sImg.naturalWidth/sImg.naturalHeight;
      let sw=MAX_W,sh=sw/ratio; if(sh>MAX_H){sh=MAX_H;sw=sh*ratio;}
      const sx=(pw-sw)/2+doc.signOffsetX, sy=bandTop+(bandH-sh)/2+doc.signOffsetY;
      ctx.drawImage(sImg, sx*scaleX, sy*scaleY, sw*scaleX, sh*scaleY);
    } else {
      ctx.fillStyle='rgba(24,168,122,0.08)';
      ctx.fillRect(pagePad*scaleX,bandTop*scaleY,imgAreaW*scaleX,bandH*scaleY);
      ctx.fillStyle='rgba(24,168,122,0.4)';
      ctx.font=`bold ${Math.round(8*scaleY)}px sans-serif`; ctx.textAlign='center';
      ctx.fillText('SIGNATURE',(pw/2)*scaleX,(bandTop+bandH/2)*scaleY);
    }
  }
  ctx.strokeStyle='rgba(30,44,64,0.12)'; ctx.lineWidth=1;
  ctx.strokeRect(0.5,0.5,cW-1,cH-1);
}

const _previewTimers = {};
function schedulePreviewDraw(doc) {
  if (_previewTimers[doc.id]) cancelAnimationFrame(_previewTimers[doc.id]);
  _previewTimers[doc.id] = requestAnimationFrame(() => {
    delete _previewTimers[doc.id];
    const canvas = document.getElementById('preview-canvas-'+doc.id);
    if (canvas) drawPreviewCanvas(doc, canvas);
  });
}
function openPreviewLightbox(docId) {
  const doc = getDoc(docId); if (!doc) return;
  const off = document.createElement('canvas');
  const isPort = doc.orientation==='portrait';
  const BASE = isPort ? 1400 : 1980;
  off.width  = isPort ? Math.round(BASE*210/297) : BASE;
  off.height = isPort ? BASE : Math.round(BASE*210/297);
  drawPreviewCanvas(doc, off);
  document.getElementById('lightboxImg').src = off.toDataURL('image/jpeg', 0.96);
  document.getElementById('lightbox').style.display='flex';
}

/* ============================================================
   PDF BUILD
============================================================ */
function invalidateDoc(doc) {
  doc.estimate=null; doc.estimateStatus=isDocReady(doc)?'pending':'waiting';
  doc.estimateToken+=1;
  if(doc.estimateTimer){clearTimeout(doc.estimateTimer);doc.estimateTimer=null;}
  if(doc.pdfUrl)URL.revokeObjectURL(doc.pdfUrl);
  doc.pdfUrl=null; doc.pdfBlob=null;
  updateEstimateText(doc); updateBatchActions();
}
function refreshAllEstimates() { state.docs.forEach(scheduleDocEstimate); }
function scheduleDocEstimate(doc) {
  if(!doc||!isDocReady(doc)){updateEstimateText(doc);updateBatchActions();return;}
  const token=++doc.estimateToken;
  doc.estimateStatus='working'; updateEstimateText(doc);
  if(doc.estimateTimer) clearTimeout(doc.estimateTimer);
  doc.estimateTimer=setTimeout(async()=>{
    try {
      await waitFrame();
      const blob=await buildDocPdfBlob(doc);
      if(token!==doc.estimateToken)return;
      doc.pdfBlob=blob; doc.estimate=blob.size; doc.estimateStatus='ready';
      updateEstimateText(doc); updateBatchActions();
    } catch(err){
      console.error(err);
      if(token===doc.estimateToken){doc.estimateStatus='error';updateEstimateText(doc,'Could not estimate');}
    }
  },220);
}
function updateEstimateText(doc, fallback) {
  if(!doc)return;
  const el=document.getElementById(`estimate-${doc.id}`); if(!el)return;
  if(fallback) el.textContent=fallback;
  else if(!isDocReady(doc)) el.textContent=doc.oneSided?Lang.t('estimateAddFront'):Lang.t('estimateAddBoth');
  else if(doc.estimate) el.textContent=fmtBytes(doc.estimate);
  else el.textContent=doc.estimateStatus==='working'?Lang.t('estimateCalculating'):Lang.t('estimatePending');
}

async function buildDocPdfBlob(doc) {
  if(!window.jspdf||!window.jspdf.jsPDF) throw new Error('PDF library not loaded.');
  if(!isDocReady(doc)) throw new Error('Front image required.');
  const {jsPDF}=window.jspdf;
  const [pw,ph]=A4_MM[doc.orientation];
  const quality=Math.max(0.1,Math.min(1,doc.quality/100));
  const pdf=new jsPDF({orientation:doc.orientation,unit:'mm',format:'a4',compress:true});

  const frontData=await imageToJpeg(doc.files.front.img,quality,3200);
  await waitFrame();
  let backData=null;
  if(!doc.oneSided&&doc.files.back) { backData=await imageToJpeg(doc.files.back.img,quality,3200); }

  const pagePad=12,gap=8;
  const hasSign=doc.signatureEnabled&&doc.files.sign;
  const SIGN_IMG_MAX=40, SIGN_BAND_H=40;
  const imgAreaTop=pagePad;
  const imgAreaBot=hasSign?ph-pagePad-SIGN_BAND_H:ph-pagePad;
  const imgAreaH=imgAreaBot-imgAreaTop, imgAreaW=pw-pagePad*2;

  if(doc.orientation==='portrait') {
    const useH=doc.oneSided?imgAreaH:(imgAreaH-gap)/2;
    addImageFit(pdf,frontData,doc.files.front.img,pagePad,imgAreaTop,imgAreaW,useH);
    if(!doc.oneSided&&backData) addImageFit(pdf,backData,doc.files.back.img,pagePad,imgAreaTop+useH+gap,imgAreaW,useH);
  } else {
    const useW=doc.oneSided?imgAreaW:(imgAreaW-gap)/2;
    addImageFit(pdf,frontData,doc.files.front.img,pagePad,imgAreaTop,useW,imgAreaH);
    if(!doc.oneSided&&backData) addImageFit(pdf,backData,doc.files.back.img,pagePad+useW+gap,imgAreaTop,useW,imgAreaH);
  }

  if(hasSign) {
    await waitFrame();
    const signData=await imageToJpeg(doc.files.sign.img,quality,2000);
    const bandTop=imgAreaBot;
    const bandH=ph-pagePad-bandTop;
    addSignatureWithOffset(pdf,signData,doc.files.sign.img,pw,bandTop,bandH,SIGN_IMG_MAX,pagePad,doc.signScale||1.0,doc.signOffsetX||0,doc.signOffsetY||0);
  }
  return pdf.output('blob');
}

function imageToJpeg(imgEl,quality,maxDim) {
  return new Promise(resolve=>{
    const naturalW=imgEl.naturalWidth,naturalH=imgEl.naturalHeight;
    // Use full resolution if image fits, only scale down if exceeds maxDim
    const scale=Math.min(1,maxDim/Math.max(naturalW,naturalH));
    const w=Math.max(1,Math.round(naturalW*scale)),h=Math.max(1,Math.round(naturalH*scale));
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d',{alpha:false,willReadFrequently:false});
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(imgEl,0,0,w,h);
    resolve(c.toDataURL('image/jpeg',quality));
  });
}
function addImageFit(pdf,dataUrl,imgEl,x,y,maxW,maxH) {
  const ratio=imgEl.naturalWidth/imgEl.naturalHeight;
  let w=maxW,h=w/ratio; if(h>maxH){h=maxH;w=h*ratio;}
  const cx=x+(maxW-w)/2, cy=y;
  pdf.addImage(dataUrl,'JPEG',cx,cy,w,h,undefined,'FAST');
}
function addSignatureWithOffset(pdf,dataUrl,imgEl,pageW,bandTop,bandH,maxImgH,pagePad,signScale,offsetX,offsetY) {
  signScale=signScale||1.0;
  const MAX_W=Math.min(63.5*signScale,pageW-pagePad*2);
  const MAX_H=Math.min(maxImgH*signScale,maxImgH);
  const ratio=imgEl.naturalWidth/imgEl.naturalHeight;
  let w=MAX_W,h=w/ratio; if(h>MAX_H){h=MAX_H;w=h*ratio;}
  const x=(pageW-w)/2+(offsetX||0);
  const y=bandTop+(bandH-h)/2+(offsetY||0);
  pdf.addImage(dataUrl,'JPEG',x,y,w,h,undefined,'FAST');
}

/* ============================================================
   DOWNLOAD WITH FORMAT CHOICE
============================================================ */
async function ensurePdf(doc) {
  if(doc.pdfBlob) return doc.pdfBlob;
  doc.estimateStatus='working'; updateEstimateText(doc);
  const blob=await buildDocPdfBlob(doc);
  doc.pdfBlob=blob; doc.estimate=blob.size; doc.estimateStatus='ready';
  updateEstimateText(doc); updateBatchActions();
  return blob;
}

/* ============================================================
   HIGH-QUALITY IMAGE EXPORT
   Draws document images at their native pixel resolution so
   JPG/PNG downloads are as sharp as the source files.
   Unlike drawPreviewCanvas (which forces a fixed small canvas
   sized for screen preview), this sizes the canvas to the
   actual source image(s) and draws them 1:1.
============================================================ */
async function buildDocImageDataUrl(doc, mime, quality) {
  const frontImg = doc.files.front?.img;
  const backImg  = !doc.oneSided && doc.files.back?.img;
  const signImg  = doc.signatureEnabled && doc.files.sign?.img;

  // Use the larger dimension of front/back as the base resolution
  const fW = frontImg ? frontImg.naturalWidth  : 0;
  const fH = frontImg ? frontImg.naturalHeight : 0;
  const bW = backImg  ? backImg.naturalWidth   : 0;
  const bH = backImg  ? backImg.naturalHeight  : 0;

  // Determine canvas size based on layout
  const isPort = doc.orientation === 'portrait';
  const GAP_PX = 16; // gap between front and back in pixels
  const SIG_RATIO = 0.18; // signature band = 18% of total canvas height

  let cW, cH;
  if (doc.oneSided) {
    cW = Math.max(fW, 100);
    cH = Math.max(fH, 100);
  } else if (isPort) {
    // Portrait two-sided: stack vertically
    cW = Math.max(fW, bW, 100);
    cH = Math.max(fH, 100) + GAP_PX + Math.max(bH, 100);
  } else {
    // Landscape two-sided: side by side
    cW = Math.max(fW, 100) + GAP_PX + Math.max(bW, 100);
    cH = Math.max(fH, bH, 100);
  }

  // Add signature band height if needed
  const sigBandH = signImg ? Math.round(cH * SIG_RATIO) : 0;
  const totalH = cH + sigBandH;

  const off = document.createElement('canvas');
  off.width  = cW;
  off.height = totalH;
  const ctx = off.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cW, totalH);

  // Helper: draw image centred and aspect-fitted into a pixel box
  function drawNative(img, dx, dy, dW, dH) {
    if (!img || !img.complete || !img.naturalWidth) return;
    const r = img.naturalWidth / img.naturalHeight;
    let w = dW, h = w / r;
    if (h > dH) { h = dH; w = h * r; }
    ctx.drawImage(img, dx + (dW - w) / 2, dy, w, h);
  }

  if (doc.oneSided) {
    drawNative(frontImg, 0, 0, cW, cH);
  } else if (isPort) {
    const halfH = Math.max(fH, 100);
    drawNative(frontImg, 0, 0,             cW, halfH);
    drawNative(backImg,  0, halfH + GAP_PX, cW, Math.max(bH, 100));
  } else {
    const halfW = Math.max(fW, 100);
    drawNative(frontImg, 0,           0, halfW,                  cH);
    drawNative(backImg,  halfW + GAP_PX, 0, Math.max(bW, 100), cH);
  }

  // Draw signature into band below the document image(s)
  if (signImg && signImg.complete && signImg.naturalWidth) {
    const signScale = doc.signScale || 1.0;
    // Signature max size: 40% of canvas width at scale 1, capped to band height
    const MAX_SW = Math.min(cW * 0.4 * signScale, cW * 0.9);
    const MAX_SH = sigBandH * 0.8;
    const sRatio = signImg.naturalWidth / signImg.naturalHeight;
    let sw = MAX_SW, sh = sw / sRatio;
    if (sh > MAX_SH) { sh = MAX_SH; sw = sh * sRatio; }

    // Translate mm offsets to pixels proportionally
    // signOffsetX/Y are in mm (±80mm range), map to ±half canvas
    const offXpx = (doc.signOffsetX / 80) * (cW / 2);
    const offYpx = (doc.signOffsetY / 80) * (sigBandH / 2);

    const sx = (cW - sw) / 2 + offXpx;
    const sy = cH + (sigBandH - sh) / 2 + offYpx;
    ctx.drawImage(signImg, sx, sy, sw, sh);
  }

  return off.toDataURL(mime, quality);
}

async function downloadDocument(docId) {
  const doc = getDoc(docId);
  if (!isDocReady(doc)) { toast(Lang.t('toastUploadFirst'),'error'); return; }

  const fmt = await showDownloadPicker(Lang.t('dlPickerTitle'));
  if (!fmt) return;

  const btn = document.querySelector(`[data-doc-id="${doc.id}"] .btn-primary`);
  if (btn) btn.disabled=true;
  try {
    if (fmt === 'pdf') {
      const blob = await ensurePdf(doc);
      saveBlob(blob, cleanFilename(doc.name)+'.pdf');
    } else {
      // Render at native source resolution so text/details stay sharp
      const mime = fmt==='png' ? 'image/png' : 'image/jpeg';
      const quality = fmt==='png' ? 1.0 : Math.max(0.1, Math.min(1, doc.quality / 100));
      const dataUrl = await buildDocImageDataUrl(doc, mime, quality);
      const a=document.createElement('a');
      a.href=dataUrl; a.download=cleanFilename(doc.name)+'.'+(fmt==='png'?'png':'jpg');
      document.body.appendChild(a); a.click(); a.remove();
    }
    toast(Lang.t('toastDownloading')+cleanFilename(doc.name)+'.'+fmt);
  } catch(err) {
    console.error(err); toast(Lang.t('toastDownloadFail')+err.message,'error');
  } finally {
    if(btn) btn.disabled=false;
  }
}

async function downloadAllDocuments() {
  const readyDocs=state.docs.filter(isDocReady);
  if(!readyDocs.length){toast(Lang.t('toastNoReady'),'error');return;}
  const fmt=await showDownloadPicker(Lang.t('dlPickerAllTitle'));
  if(!fmt)return;
  const btn=document.getElementById('downloadAllBtn');
  if(btn)btn.disabled=true;
  try {
    for(const doc of readyDocs) {
      if(fmt==='pdf'){
        const blob=await ensurePdf(doc);
        saveBlob(blob,cleanFilename(doc.name)+'.pdf');
      } else {
        const mime=fmt==='png'?'image/png':'image/jpeg';
        const quality=fmt==='png'?1.0:Math.max(0.1,Math.min(1,doc.quality/100));
        const dataUrl=await buildDocImageDataUrl(doc,mime,quality);
        const a=document.createElement('a');
        a.href=dataUrl; a.download=cleanFilename(doc.name)+'.'+(fmt==='png'?'png':'jpg');
        document.body.appendChild(a);a.click();a.remove();
      }
      await new Promise(r=>setTimeout(r,350));
    }
    toast(Lang.t('toastStarted')+readyDocs.length+Lang.t('toastDownloads'));
  } catch(err){
    console.error(err); toast(Lang.t('toastDownloadError')+err.message,'error');
  } finally {
    if(btn)btn.disabled=false;
  }
}

function saveBlob(blob,filename) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function updateBatchActions() {
  const rc=state.docs.filter(isDocReady).length;
  const el=document.getElementById('readyCount'); const btn=document.getElementById('downloadAllBtn');
  if(el)el.textContent=rc+Lang.t('toastReadyCount');
  if(btn)btn.disabled=rc===0;
}

/* ============================================================
   SDT NAVIGATION — now uses separate pages
============================================================ */
function sdtOpen() {
  window.location.href = 'tools.html';
}
function sdtClose() {
  window.location.href = 'app.html';
}

let _pendingSendImg=null;
async function sdtSendToApp(imgElId,filenameBase) {
  const img=document.getElementById(imgElId);
  if(!img||!img.src||img.src.startsWith('data:,')) {sdt.toast(Lang.t('toastGenerateFirst'),'error');return;}
  const ok = await DSTransfer.save({src:img.src,name:filenameBase});
  if(!ok) { sdt.toast('Could not prepare image for transfer. Try downloading instead.','error'); return; }
  window.location.href = 'app.html';
}
function renderSlotPicker() {
  const body=document.getElementById('slotPickerBody'); if(!body)return;
  body.innerHTML=state.docs.map(doc=>{
    const fo=!!doc.files.front,bo=!!doc.files.back,so=!!doc.files.sign;
    const frontBtn=fo?`<button class="btn-primary slot-occupied" disabled title="Occupied"><span class="slot-occ-icon">✓</span> Front</button>`:`<button class="btn-primary" onclick="doSendToSlot(${doc.id},'front')">${Lang.t('slotBtnFront')}</button>`;
    const backBtn=doc.oneSided?`<button class="btn-secondary" style="opacity:0.3" disabled title="One-sided">—</button>`
      :(bo?`<button class="btn-primary slot-occupied" disabled><span class="slot-occ-icon">✓</span> Back</button>`:`<button class="btn-primary" onclick="doSendToSlot(${doc.id},'back')">${Lang.t('slotBtnBack')}</button>`);
    const signBtn=so?`<button class="btn-secondary slot-occupied" disabled><span class="slot-occ-icon">✓</span> Sign</button>`:`<button class="btn-secondary" onclick="doSendToSlot(${doc.id},'sign')">${Lang.t('slotBtnSign')}</button>`;
    return `<div class="slot-picker-doc">
      <div class="slot-picker-doc-name">${escapeHtml(doc.name||'document '+doc.number)}${doc.oneSided?' <small>('+Lang.t('typeLabelOneSided')+')</small>':''}</div>
      <div class="slot-picker-actions">${frontBtn}${backBtn}${signBtn}</div>
    </div>`;
  }).join('')+`
    <button class="btn-secondary" style="width:100%;justify-content:center" onclick="sendToNewDocument()">${Lang.t('slotPickerAddNew')}</button>
    <button class="btn-ghost" style="width:100%;justify-content:center;margin-top:8px" onclick="closeSlotPicker()">Cancel</button>
  `;
}
function closeSlotPicker(e) {
  if(e&&e.target!==document.getElementById('slotPicker'))return;
  document.getElementById('slotPicker').style.display='none';
  // Do NOT clear _pendingSendImg or localStorage here — user may have closed accidentally
  // and should be able to reopen the picker from the pending-send banner.
  _updatePendingBanner();
}
async function pendingSendFile() {
  // Check in-memory first, then IndexedDB (persists across page navigations)
  let data = _pendingSendImg;
  if (!data) data = await DSTransfer.load();
  if(!data)return null;
  const arr=data.src.split(',');
  const mime=(arr[0].match(/:(.*?);/)||[])[1]||'image/jpeg';
  const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  const bstr=atob(arr[1]); let n=bstr.length; const u8=new Uint8Array(n);
  while(n--)u8[n]=bstr.charCodeAt(n);
  return new File([u8],`${data.name}.${ext}`,{type:mime});
}
async function _clearPendingSend() {
  _pendingSendImg = null;
  await DSTransfer.clear();
  _updatePendingBanner();
}
async function _getPendingMeta() {
  if (_pendingSendImg) return _pendingSendImg;
  return await DSTransfer.load();
}
async function _updatePendingBanner() {
  const banner = document.getElementById('ds-pending-banner');
  if (!banner) return;
  const meta = await _getPendingMeta();
  if (meta) {
    banner.style.display = 'flex';
    const nameEl = banner.querySelector('.ds-pending-name');
    if (nameEl) nameEl.textContent = meta.name || 'image';
  } else {
    banner.style.display = 'none';
  }
}
async function openPendingSendPicker() {
  const meta = await _getPendingMeta();
  if (!meta) return;
  _pendingSendImg = meta;
  renderSlotPicker();
  const sp = document.getElementById('slotPicker');
  if (sp) sp.style.display = 'flex';
}
function dismissPendingSend() {
  _clearPendingSend();
}
async function doSendToSlot(docId,slot) {
  const doc=getDoc(docId); if(!doc)return;
  if(doc.files[slot]){toast(Lang.t('slot'+slot.charAt(0).toUpperCase()+slot.slice(1))+Lang.t('toastOccupied'),'error');return;}
  const file=await pendingSendFile(); if(!file)return;
  document.getElementById('slotPicker').style.display='none';
  await _clearPendingSend(); // Only clear after confirmed placement
  handleFile(file,docId,slot);
  toast(Lang.t('toastSentTo')+Lang.t('slot'+slot.charAt(0).toUpperCase()+slot.slice(1)).toLowerCase()+'.');
}
async function sendToNewDocument() {
  const file=await pendingSendFile(); if(!file)return;
  addDocument();
  const doc=state.docs[state.docs.length-1];
  document.getElementById('slotPicker').style.display='none';
  await _clearPendingSend(); // Only clear after confirmed placement
  handleFile(file,doc.id,'front');
  toast(Lang.t('toastNewDocCreated'));
}

/* Refine the AI mask for still portraits: remove disconnected false positives,
   keep fine hair detail, and remove the old background colour from soft edges. */
function createPrecisePersonCutout(source, segmentationMask) {
  const width = source.width;
  const height = source.height;
  const count = width * height;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d', {willReadFrequently:true});
  maskCtx.drawImage(segmentationMask, 0, 0, width, height);
  const raw = maskCtx.getImageData(0, 0, width, height).data;
  const confidence = new Uint8Array(count);

  // A compact Gaussian pass reduces the blocky low-resolution model boundary.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = 0, weight = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = Math.max(0, Math.min(height - 1, y + oy));
        for (let ox = -1; ox <= 1; ox++) {
          const xx = Math.max(0, Math.min(width - 1, x + ox));
          const w = (ox === 0 ? 2 : 1) * (oy === 0 ? 2 : 1);
          total += raw[(yy * width + xx) * 4] * w;
          weight += w;
        }
      }
      confidence[y * width + x] = Math.round(total / weight);
    }
  }

  // Label confident connected regions and retain only the main portrait.
  const labels = new Int32Array(count);
  const queue = new Int32Array(count);
  let label = 0, largestLabel = 0, largestSize = 0;
  for (let start = 0; start < count; start++) {
    if (labels[start] || confidence[start] < 108) continue;
    label++;
    let head = 0, tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const candidates = [index - width, index + width, index - 1, index + 1];
      for (let n = 0; n < 4; n++) {
        const next = candidates[n];
        if (next < 0 || next >= count || labels[next] || confidence[next] < 108) continue;
        if ((n === 2 && x === 0) || (n === 3 && x === width - 1)) continue;
        labels[next] = label;
        queue[tail++] = next;
      }
    }
    if (tail > largestSize) { largestSize = tail; largestLabel = label; }
  }
  if (!largestLabel || largestSize < count * 0.004) {
    throw new Error('No clear main person was detected. Try a sharper, well-lit photo.');
  }

  // Dilate the retained component slightly so wispy hair beside the core survives.
  const keep = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (labels[i] !== largestLabel) continue;
    const x = i % width, y = Math.floor(i / width);
    for (let oy = -3; oy <= 3; oy++) {
      const yy = y + oy;
      if (yy < 0 || yy >= height) continue;
      for (let ox = -3; ox <= 3; ox++) {
        const xx = x + ox;
        if (xx >= 0 && xx < width && ox * ox + oy * oy <= 9) keep[yy * width + xx] = 1;
      }
    }
  }

  const sourceCtx = source.getContext('2d', {willReadFrequently:true});
  const output = sourceCtx.getImageData(0, 0, width, height);
  const pixels = output.data;
  const smoothstep = value => {
    const t = Math.max(0, Math.min(1, (value - 0.16) / 0.68));
    return t * t * (3 - 2 * t);
  };

  for (let i = 0; i < count; i++) {
    const p = i * 4;
    if (!keep[i]) { pixels[p + 3] = 0; continue; }
    let alpha = smoothstep(confidence[i] / 255);
    if (alpha <= 0.01) { pixels[p + 3] = 0; continue; }

    // Find clean pixels just outside and inside the silhouette.
    const x = i % width, y = Math.floor(i / width);
    let bgIndex = -1, innerIndex = -1, edgeDepth = 7;
    for (let radius = 1; radius <= 6; radius++) {
      for (let oy = -radius; oy <= radius; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -radius; ox <= radius; ox++) {
          if (Math.abs(ox) !== radius && Math.abs(oy) !== radius) continue;
          const xx = x + ox;
          if (xx < 0 || xx >= width) continue;
          const candidate = yy * width + xx;
          if (confidence[candidate] < 55) {
            if (bgIndex < 0) bgIndex = candidate * 4;
            edgeDepth = Math.min(edgeDepth, radius);
          }
          if (innerIndex < 0 && confidence[candidate] > 242) innerIndex = candidate * 4;
        }
      }
    }

    // Contract only the outer rim. This removes the dark/green one-pixel outline.
    const edgeAlpha = [1, 0.30, 0.66, 0.88, 0.96, 1, 1];
    alpha *= edgeAlpha[Math.min(edgeDepth, 6)];
    if (alpha <= 0.015) { pixels[p + 3] = 0; continue; }

    // Pull edge RGB toward a clean interior sample before alpha compositing.
    if (edgeDepth <= 4 && innerIndex >= 0) {
      const interiorMix = [0, 0.72, 0.48, 0.26, 0.10];
      const mix = interiorMix[edgeDepth];
      for (let channel = 0; channel < 3; channel++) {
        pixels[p + channel] = Math.round(pixels[p + channel] * (1 - mix) + pixels[innerIndex + channel] * mix);
      }
    }

    // Unmix any old background colour still stored in translucent hair pixels.
    if (bgIndex >= 0 && alpha < 0.98) {
      const safeAlpha = Math.max(alpha, 0.28);
      for (let channel = 0; channel < 3; channel++) {
        const foreground = (pixels[p + channel] - (1 - safeAlpha) * pixels[bgIndex + channel]) / safeAlpha;
        pixels[p + channel] = Math.max(0, Math.min(255, Math.round(foreground)));
      }
    }
    pixels[p + 3] = Math.round(alpha * 255);
  }

  const cutout = document.createElement('canvas');
  cutout.width = width;
  cutout.height = height;
  cutout.getContext('2d').putImageData(output, 0, 0);
  return cutout;
}

/* ============================================================
   SINGLE-DOC TOOLS MODULE — MULTI-TOOL (all-at-once)
============================================================ */
window.sdt = (() => {
  // LOW-END PC FIX: cap how many pixels we ever put in a working canvas.
  // navigator.deviceMemory (Chrome/Edge) reports approx RAM in GB when available.
  // On 1-2GB RAM / old Windows 7 machines we cut the cap hard so rotate+crop
  // canvases never get big enough to hang the tab. Falls back to a safe
  // middle-ground cap when the browser doesn't expose deviceMemory at all.
  function getMtMaxPixels() {
    const mem = navigator.deviceMemory; // GB, undefined on many browsers
    if (mem && mem <= 2) return 4 * 1024 * 1024;   // ~4MP — very low RAM
    if (mem && mem <= 4) return 8 * 1024 * 1024;   // ~8MP — low RAM
    return 16 * 1024 * 1024;                       // default cap
  }
  function toast(msg, type='success') {
    const w=document.getElementById('sdtToastWrap');
    const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=msg;
    w.appendChild(t); setTimeout(()=>t.remove(),3200);
  }
  function fmtBytes(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(2)+' MB';}
  function upSlider(el){const pct=((el.value-el.min)/(el.max-el.min)*100).toFixed(1)+'%';el.style.setProperty('--pct',pct);}
  function switchTab(name,btn){
    document.querySelectorAll('.tool-section').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('tab-'+name).classList.add('active');
    btn.classList.add('active');
  }
  function dzDrag(e,id){e.preventDefault();document.getElementById(id).classList.add('drag-over');}
  function dzLeave(id){document.getElementById(id).classList.remove('drag-over');}
  function dzDrop(e,id,loader){e.preventDefault();document.getElementById(id).classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f)loader(f);}

  /* -------- MULTI-TOOL state -------- */
  let mtOrigFile=null, mtOrigImg=null;
  let mtState = {
    rotateDeg: 0,
    flipH: false,
    flipV: false,
    cropRect: null,     // {x,y,w,h} in original px
    quality: 85,
    format: 'jpeg',
    maxW: 0,
    hasCrop: false,
    brightness: 0,
  };
  let mtCropDragging=false, mtCropStartX=0, mtCropStartY=0;
  let mtDisplayScale=1, mtCropDisplayRect=null;
  let _cropRafId=null; // RAF handle for throttled crop redraws
  let _cachedRotatedCanvas=null; // Cache of rotated image — reused during crop drag to avoid per-frame re-render on slow PCs
  let mtResultCanvas = document.createElement('canvas');
  const REMOVE_BG_API_URL = 'https://api.remove.bg/v1.0/removebg';
  const REMOVE_BG_STORAGE_KEY = 'ds_removebg_api_key';
  const REMOVE_BG_USAGE_KEY   = 'ds_removebg_usage_count';
  const REMOVE_BG_FREE_LIMIT  = 50;

  /* ---- Get user's saved API key ---- */
  function getRemoveBgApiKey() {
    return localStorage.getItem(REMOVE_BG_STORAGE_KEY) || '';
  }

  /* ---- Get / increment usage count ---- */
  function getRemoveBgUsage() {
    return parseInt(localStorage.getItem(REMOVE_BG_USAGE_KEY) || '0');
  }
  function incrementRemoveBgUsage() {
    const n = getRemoveBgUsage() + 1;
    localStorage.setItem(REMOVE_BG_USAGE_KEY, String(n));
    updateAllRemoveBgCounters();
  }
  function updateAllRemoveBgCounters() {
    const used  = getRemoveBgUsage();
    const left  = Math.max(0, REMOVE_BG_FREE_LIMIT - used);
    const text  = `🖼 remove.bg credits used this month: ${used} / ${REMOVE_BG_FREE_LIMIT} &nbsp;|&nbsp; <strong>${left} remaining</strong>`;
    document.querySelectorAll('.ds-removebg-counter').forEach(el => { el.innerHTML = text; });
  }

  /* ---- Show the API key setup modal ---- */
  function showRemoveBgSetup() {
    const modal = document.getElementById('removeBgSetupModal');
    if (modal) { modal.style.display = 'flex'; }
  }
  function hideRemoveBgSetup() {
    const modal = document.getElementById('removeBgSetupModal');
    if (modal) { modal.style.display = 'none'; }
  }
  function saveRemoveBgKey() {
    const inp = document.getElementById('removeBgApiKeyInput');
    if (!inp) return;
    const key = inp.value.trim();
    if (!key) { alert('Please paste your API key first.'); return; }
    localStorage.setItem(REMOVE_BG_STORAGE_KEY, key);
    hideRemoveBgSetup();
    toast('✅ API key saved! Background removal with remove.bg is now ready.', 'success');
    updateAllRemoveBgCounters();
    updateAllApiKeyStatus();
  }
  function clearRemoveBgKey() {
    if (!confirm('Remove your saved API key?')) return;
    localStorage.removeItem(REMOVE_BG_STORAGE_KEY);
    updateAllRemoveBgCounters();
    updateAllApiKeyStatus();
    toast('API key cleared.', 'info');
  }
  function updateAllApiKeyStatus() {
    const key = getRemoveBgApiKey();
    document.querySelectorAll('.ds-removebg-key-status').forEach(el => {
      el.innerHTML = key
        ? `✅ API key saved &nbsp;<button onclick="clearRemoveBgKey()" style="font-size:11px;padding:2px 8px;border-radius:6px;border:1px solid #e04;background:transparent;color:#e04;cursor:pointer">Remove Key</button>`
        : `❌ No API key saved`;
    });
  }

  /* ---- Expose to global scope so inline onclick can reach them, AND so ----
     the separate Photo Maker (mp) module — a different closure entirely —
     can call them too. Without this, mp.removeBg() throws a silent
     "removeBgWithApi is not defined" ReferenceError and falls back to the
     local remover on every single call, regardless of the mode selected. */
  window.showRemoveBgSetup = showRemoveBgSetup;
  window.hideRemoveBgSetup = hideRemoveBgSetup;
  window.saveRemoveBgKey   = saveRemoveBgKey;
  window.clearRemoveBgKey  = clearRemoveBgKey;
  window.getRemoveBgApiKey        = getRemoveBgApiKey;
  window.updateAllRemoveBgCounters = updateAllRemoveBgCounters;
  window.updateAllApiKeyStatus    = updateAllApiKeyStatus;
  // removeBgWithApi is defined further down (after canvasToBlob/blobToCanvas),
  // so it's exposed right after its own definition — see below.

  function cloneMtState(state = mtState) {
    return {
      rotateDeg: state.rotateDeg,
      flipH: state.flipH,
      flipV: state.flipV,
      cropRect: state.cropRect ? {...state.cropRect} : null,
      quality: state.quality,
      format: state.format,
      maxW: state.maxW,
      hasCrop: state.hasCrop,
      brightness: state.brightness || 0,
    };
  }

  function buildMtEditedSourceCanvas(image = mtOrigImg, state = mtState) {
    if (!image) return null;
    const rotC = makeTransformedCanvas(image, state);

    if (!state.hasCrop || !state.cropRect) return rotC;

    const cr = state.cropRect;
    const sx = Math.max(0, Math.min(cr.x, rotC.width - 1));
    const sy = Math.max(0, Math.min(cr.y, rotC.height - 1));
    const sw = Math.max(1, Math.min(cr.w, rotC.width - sx));
    const sh = Math.max(1, Math.min(cr.h, rotC.height - sy));
    const cropC = document.createElement('canvas');
    cropC.width = sw;
    cropC.height = sh;
    cropC.getContext('2d').drawImage(rotC, sx, sy, sw, sh, 0, 0, sw, sh);
    return cropC;
  }

  function canvasToBlob(canvas, type = 'image/png', quality = 0.95) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the image for background removal.')), type, quality);
    });
  }

  function canvasToLoadedImage(canvas) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not prepare the edited image.'));
      img.src = canvas.toDataURL('image/png');
    });
  }

  function blobToCanvas(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('The background-removal result could not be read.'));
      };
      img.src = url;
    });
  }

  function loadMultiToolFile(file) {
    if(!file||(file.type&&!file.type.startsWith('image/')&&file.type!=='application/pdf'&&!file.name.endsWith('.pdf'))){
      toast(Lang.t('toastSelectImgSdt'),'error'); return;
    }
    // If PDF: convert first
    if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')) {
      toast(Lang.t('toastPdfConvertFirst'),'success');
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try {
          if(!window.pdfjsLib) {
            if(!document.getElementById('pdfjs-script')) {
              const s=document.createElement('script');
              s.id='pdfjs-script';
              s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
              s.onload=()=>{
                window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                loadMultiToolFile(file);
              };
              document.head.appendChild(s);
            }
            return;
          }
          const pdf=await window.pdfjsLib.getDocument({data:e.target.result}).promise;
          const page=await pdf.getPage(1);
          const viewport=page.getViewport({scale:2.5});
          const c=document.createElement('canvas');
          c.width=viewport.width; c.height=viewport.height;
          await page.render({canvasContext:c.getContext('2d'),viewport}).promise;
          const dataUrl=c.toDataURL('image/jpeg',0.92);
          const img=new Image();
          img.onload=()=>initMultiTool(img,file);
          img.src=dataUrl;
        } catch(err){toast(Lang.t('toastPdfConvertError'),'error');}
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>initMultiTool(img,file);
      img.onerror=()=>toast('Could not read image.','error');
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  }


  function applyBrightnessFilter(ctx, w, h, level) {
    // level: -100 to +100. Positive = enhance brightness/contrast/vibrance
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const bAdj = level * 1.5;  // brightness offset
    const contrast = 1 + level * 0.008;
    const saturation = 1 + Math.max(0, level) * 0.012;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i+1], b = data[i+2];
      // Contrast
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;
      // Brightness
      r += bAdj; g += bAdj; b += bAdj;
      // Saturation (only for positive enhancement)
      if (level > 0) {
        const lum = 0.299*r + 0.587*g + 0.114*b;
        r = lum + (r - lum) * saturation;
        g = lum + (g - lum) * saturation;
        b = lum + (b - lum) * saturation;
      }
      data[i]   = Math.max(0, Math.min(255, Math.round(r)));
      data[i+1] = Math.max(0, Math.min(255, Math.round(g)));
      data[i+2] = Math.max(0, Math.min(255, Math.round(b)));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function mtSetBrightness(val) {
    mtState.brightness = parseInt(val);
    const lbl = document.getElementById('mtBrightnessLabel');
    if (lbl) lbl.textContent = (val >= 0 ? '+' : '') + val;
    const sl = document.getElementById('mtBrightness');
    if (sl) upSlider(sl);
    if (mtOrigImg) renderMultiTool();
  }

  function makeTransformedCanvas(image, state) {
    const deg = Number(state.rotateDeg || 0);
    const rad = deg * Math.PI / 180;
    const srcW = image.naturalWidth || image.width;
    const srcH = image.naturalHeight || image.height;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const outW = Math.max(1, Math.ceil(srcW * cos + srcH * sin));
    const outH = Math.max(1, Math.ceil(srcW * sin + srcH * cos));

    // LOW-END PC FIX: Cap the canvas pixel area. Old hardware (Windows 7, 1-4 GB
    // RAM) silently fails or hangs on very large canvases, causing "Apply Crop
    // does nothing". We scale down if needed, then the final download step
    // reuses the same logic so output is still correct. The cap now also adapts
    // to navigator.deviceMemory when the browser reports it, so a 1-2GB machine
    // gets an even smaller working canvas than the default 16MP ceiling.
    const MAX_PIXELS = getMtMaxPixels();
    const pixelCount = outW * outH;
    let drawScale = 1;
    if (pixelCount > MAX_PIXELS) {
      drawScale = Math.sqrt(MAX_PIXELS / pixelCount);
    }
    const cW = Math.max(1, Math.round(outW * drawScale));
    const cH = Math.max(1, Math.round(outH * drawScale));

    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(cW / 2, cH / 2);
    ctx.rotate(rad);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
    ctx.drawImage(image, -srcW * drawScale / 2, -srcH * drawScale / 2, srcW * drawScale, srcH * drawScale);
    ctx.restore();
    return canvas;
  }

  function clampCanvasPos(pos, canvas) {
    return {
      x: Math.max(0, Math.min(canvas.width, pos.x)),
      y: Math.max(0, Math.min(canvas.height, pos.y)),
    };
  }

  function clampCropRect(rect, canvas) {
    const x = Math.max(0, Math.min(rect.x, canvas.width));
    const y = Math.max(0, Math.min(rect.y, canvas.height));
    const w = Math.max(0, Math.min(rect.w, canvas.width - x));
    const h = Math.max(0, Math.min(rect.h, canvas.height - y));
    return {x, y, w, h};
  }

  function initMultiTool(img, file) {
    mtOrigFile=file; mtOrigImg=img;
    mtState={rotateDeg:0,flipH:false,flipV:false,cropRect:null,quality:85,format:'jpeg',maxW:0,hasCrop:false,brightness:0};
    mtSyncRotationControl();
    const bSlider=document.getElementById('mtBrightness');
    if(bSlider){bSlider.value=0;upSlider(bSlider);
      const bLbl=document.getElementById('mtBrightnessLabel');
      if(bLbl) bLbl.textContent='0';}
    document.getElementById('mtPlaceholder').style.display='none';
    document.getElementById('mtDrop').style.display='none';
    document.getElementById('mtEditor').style.display='block';
    const previewEmpty=document.getElementById('mtPreviewEmpty'); if(previewEmpty) previewEmpty.style.display='none';
    const previewActive=document.getElementById('mtPreviewActive'); if(previewActive) previewActive.style.display='block';
    const statsBlock=document.getElementById('mtStatsBlock');
    if(statsBlock) statsBlock.style.display='grid';
    document.getElementById('mtOrigSize').textContent=fmtBytes(file.size);
    document.getElementById('mtOrigDims').textContent=img.naturalWidth+'×'+img.naturalHeight;
    renderMultiTool();
  }

  function renderMultiTool() {
    // Apply rotate then crop to get current working image
    // Step 1: Rotate / flip. The output canvas grows for small tilt angles so nothing is clipped.
    const rotC=makeTransformedCanvas(mtOrigImg, mtState);

    // Step 2: Crop
    let cropSrc=rotC;
    if(mtState.hasCrop&&mtState.cropRect) {
      const cr=mtState.cropRect;
      const cOut=document.createElement('canvas');
      cOut.width=Math.max(1,cr.w); cOut.height=Math.max(1,cr.h);
      cOut.getContext('2d').drawImage(rotC,cr.x,cr.y,cr.w,cr.h,0,0,cr.w,cr.h);
      cropSrc=cOut;
    }

    // Step 3: Resize
    let finalW=cropSrc.width, finalH=cropSrc.height;
    if(mtState.maxW>0&&finalW>mtState.maxW) {finalH=Math.round(finalH*mtState.maxW/finalW);finalW=mtState.maxW;}
    const finalC=document.createElement('canvas'); finalC.width=Math.max(1,finalW); finalC.height=Math.max(1,finalH);
    const fCtx=finalC.getContext('2d');
    if(mtState.format!=='png'){fCtx.fillStyle='#fff';fCtx.fillRect(0,0,finalW,finalH);}
    fCtx.drawImage(cropSrc,0,0,finalW,finalH);
    // Step 4: Brightness/Enhancement
    if(mtState.brightness && mtState.brightness !== 0) {
      applyBrightnessFilter(fCtx, finalW, finalH, mtState.brightness);
    }
    mtResultCanvas=finalC;

    // Preview
    const mime=mtState.format==='png'?'image/png':mtState.format==='webp'?'image/webp':'image/jpeg';
    const qual=mtState.quality/100;
    const dataUrl=finalC.toDataURL(mime,mtState.format!=='png'?qual:undefined);
    document.getElementById('mtPreview').src=dataUrl;
    const estBytes=Math.round(dataUrl.split(',')[1].length*0.75);
    const estStr=fmtBytes(estBytes);
    document.getElementById('mtNewSize').textContent=estStr;
    document.getElementById('mtNewDims').textContent=finalW+'×'+finalH;
    // Live badge next to the Quality slider — uses the exact same toDataURL() call
    // that mtDownload() uses for the JPG/PNG download, so this number always matches
    // the actual downloaded file size.
    const qualSizeEst=document.getElementById('mtQualSizeEst');
    if(qualSizeEst){
      qualSizeEst.innerHTML = mtState.format==='png'
        ? '≈ estimated size: <span class="mt-qual-size-val">'+estStr+'</span> (PNG is lossless — quality slider doesn\'t apply)'
        : '≈ estimated size: <span class="mt-qual-size-val">'+estStr+'</span>';
    }

    // Draw crop UI on the display canvas
    drawMtCropCanvas(rotC);
    // Auto-refresh A4 preview
    setTimeout(()=>{ try{a4Preview();}catch(e){} },30);
    // Persist state across page navigations
    setTimeout(saveMtState, 60);
  }

  function drawMtCropCanvas(rotated) {
    // Store the already-computed rotated canvas so redrawCropOverlay can reuse it
    // during drag without recreating it on every mouse-move frame (perf fix for slow PCs).
    _cachedRotatedCanvas = rotated;
    const wrap=document.getElementById('mtCropWrap');

    // ROOT FIX: The old code subtracted 8px from wrap width, making the canvas narrower
    // than its container. The flex centering then placed it with ~4px gaps on each side —
    // creating the visible brown border gap. Clicks near the image edge were actually
    // landing outside the canvas rect, so coords were wrong.
    // Solution: canvas fills the wrap exactly, wrap has no padding, no centering gap.
    wrap.style.padding = '0';
    wrap.style.alignItems = 'flex-start';
    wrap.style.justifyContent = 'flex-start';
    wrap.style.overflow = 'hidden';

    const maxW = Math.max(wrap.clientWidth || 680, 320);
    // Fit by BOTH width and height so tall/wide images never overflow the wrap.
    const maxH = Math.max(window.innerHeight * 0.72, 320);
    const scaleByW = maxW / rotated.width;
    const scaleByH = maxH / rotated.height;
    // Cap at 1x (no upscaling). On 2-4 GB RAM / Windows 7 machines, upscaling a large
    // image 2x means 4x the canvas memory — can cause freezes or tab crashes.
    mtDisplayScale = Math.min(scaleByW, scaleByH, 1);
    const dW = Math.round(rotated.width  * mtDisplayScale);
    const dH = Math.round(rotated.height * mtDisplayScale);
    const cv = document.getElementById('mtCropCanvas');

    // CRITICAL: canvas pixel size must equal style size must equal getBoundingClientRect.
    // Any mismatch creates wrong scaleX/Y in getCropCanvasPos() => wrong crop coordinates.
    cv.width  = dW;
    cv.height = dH;
    cv.style.width    = dW + 'px';
    cv.style.height   = dH + 'px';
    cv.style.maxWidth = dW + 'px';
    cv.style.display  = 'block'; // block removes inline baseline gap (extra pixels below canvas)

    // LOW-END PC optimisation: imageSmoothingQuality 'low' is much faster on old
    // integrated GPUs and software renderers (Windows 7, Celeron, 2GB RAM).
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(rotated, 0, 0, dW, dH);

    // Draw crop rect if any
    if(mtCropDisplayRect) {
      ctx.strokeStyle='rgba(249,107,63,0.9)'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
      ctx.strokeRect(mtCropDisplayRect.x,mtCropDisplayRect.y,mtCropDisplayRect.w,mtCropDisplayRect.h);
      ctx.setLineDash([]);
      ctx.fillStyle='rgba(249,107,63,0.08)';
      ctx.fillRect(mtCropDisplayRect.x,mtCropDisplayRect.y,mtCropDisplayRect.w,mtCropDisplayRect.h);

      // Show crop size info
      const imgW=Math.round(mtCropDisplayRect.w/mtDisplayScale);
      const imgH=Math.round(mtCropDisplayRect.h/mtDisplayScale);
      const infoEl=document.getElementById('mtCropInfo');
      if(infoEl) infoEl.textContent=`Selection: ${imgW}×${imgH}px  ≈  ${(imgW*0.0264583).toFixed(1)}×${(imgH*0.0264583).toFixed(1)} cm  |  ${(imgW*0.264583).toFixed(0)}×${(imgH*0.264583).toFixed(0)} mm`;
    } else {
      const infoEl=document.getElementById('mtCropInfo');
      if(infoEl&&!mtState.hasCrop) infoEl.textContent='';
    }
  }

  // Bind crop canvas events
  // KEY FIX: canvas is CSS-scaled (style.width != canvas.width), so we MUST use
  // getBoundingClientRect() for ALL events and scale the coords to canvas-pixel space.
  function getCropCanvasPos(clientX, clientY) {
    const cv = document.getElementById('mtCropCanvas');
    if (!cv) return {x:0,y:0};
    const rect = cv.getBoundingClientRect();
    // Since we set canvas pixel size === style size, getBoundingClientRect should
    // exactly match cv.width/cv.height. scaleX/Y should be ~1.0.
    // We still derive them from rect in case browser zoom or device pixel ratio differs.
    const dispW = rect.width  || cv.width;
    const dispH = rect.height || cv.height;
    const scaleX = cv.width  / dispW;
    const scaleY = cv.height / dispH;
    // Math.floor gives pixel-exact coords — avoids sub-pixel drift at image edges.
    return {
      x: Math.floor((clientX - rect.left) * scaleX),
      y: Math.floor((clientY - rect.top)  * scaleY),
    };
  }

  function redrawCropOverlay() {
    const cv2 = document.getElementById('mtCropCanvas');
    if (!cv2) return;
    const ctx = cv2.getContext('2d');
    if (mtOrigImg) {
      // Use cached rotated canvas during drag — avoids recreating it on every mouse-move frame.
      // This is the key fix for slow/old PCs (Windows 7, low RAM) where canvas operations are expensive.
      const rotC = _cachedRotatedCanvas || makeTransformedCanvas(mtOrigImg, mtState);
      ctx.drawImage(rotC, 0, 0, cv2.width, cv2.height);
    }
    if (mtCropDisplayRect) {
      const {x,y,w,h} = mtCropDisplayRect;
      // Darken outside selection
      ctx.fillStyle='rgba(0,0,0,0.35)';
      ctx.fillRect(0,0,cv2.width,y);            // top
      ctx.fillRect(0,y+h,cv2.width,cv2.height); // bottom
      ctx.fillRect(0,y,x,h);                    // left
      ctx.fillRect(x+w,y,cv2.width-x-w,h);     // right
      // Selection border
      ctx.strokeStyle='rgba(249,107,63,1)'; ctx.lineWidth=2; ctx.setLineDash([5,4]);
      ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); ctx.setLineDash([]);
      // Corner handles
      const hs=7;
      ctx.fillStyle='rgba(249,107,63,0.9)';
      [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy])=>{
        ctx.fillRect(cx-hs/2, cy-hs/2, hs, hs);
      });
      // Live size info
      const iW=Math.round(w/mtDisplayScale), iH=Math.round(h/mtDisplayScale);
      const infoEl=document.getElementById('mtCropInfo');
      if(infoEl) infoEl.textContent=`Selection: ${iW}×${iH}px  ≈  ${(iW*0.0264583).toFixed(1)}×${(iH*0.0264583).toFixed(1)} cm  |  ${(iW*0.264583).toFixed(0)}×${(iH*0.264583).toFixed(0)} mm`;
    }
  }

  function scheduleRedrawCropOverlay() {
    if (_cropRafId) return; // already queued — skip to avoid double-draw
    _cropRafId = requestAnimationFrame(() => { _cropRafId = null; redrawCropOverlay(); });
  }

  function bindMtCropEvents() {
    const cv=document.getElementById('mtCropCanvas'); if(!cv)return;

    // Remove old listeners by replacing with fresh ones via onX
    cv.onmousedown = e => {
      e.preventDefault();
      const pos = clampCanvasPos(getCropCanvasPos(e.clientX, e.clientY), cv);
      mtCropDragging=true;
      mtCropStartX=pos.x; mtCropStartY=pos.y;
      mtCropDisplayRect=null;
      redrawCropOverlay();
    };

    cv.onmousemove = e => {
      if(!mtCropDragging) return;
      // FIX (crop box lagging behind a fast cursor swipe): this used to ALSO
      // throttle how often we read/clamp the mouse position (skip unless
      // 33ms had passed). That math is essentially free even on very old
      // hardware — it's the canvas repaint that's expensive. But skipping the
      // read meant a fast flick could drop the last few real cursor positions,
      // so the box visibly froze behind the cursor. We now read+clamp the
      // position on every event; only the actual repaint stays capped to once
      // per animation frame via scheduleRedrawCropOverlay()'s existing rAF
      // dedup below, so the redraw cost on slow PCs is completely unchanged.
      const pos = clampCanvasPos(getCropCanvasPos(e.clientX, e.clientY), cv);
      const x=Math.min(mtCropStartX, pos.x), y=Math.min(mtCropStartY, pos.y);
      const w=Math.abs(pos.x - mtCropStartX),   h=Math.abs(pos.y - mtCropStartY);
      mtCropDisplayRect=clampCropRect({x,y,w,h}, cv);
      scheduleRedrawCropOverlay();
    };

    cv.onmouseup = e => { commitMtCropDrag(); };

    // FIX (fast-cursor-out-of-canvas bug): previously this listener SET
    // mtCropDragging=false the instant the cursor left the canvas, which threw
    // away the in-progress selection without ever committing it to mtState.
    // That is why a fast drag past the edge left the crop box "stuck" and Apply
    // Crop appeared to do nothing (mtState.cropRect/hasCrop was never updated).
    // We now leave dragging ON when the cursor exits: onmousemove already clamps
    // the rect to the canvas bounds (clampCanvasPos/clampCropRect), so the box
    // simply freezes at the edge and keeps working the moment the cursor comes
    // back over the canvas. The drag is still safely finalised even if the mouse
    // button is released outside the canvas, via the document-level mouseup
    // fallback (commitMtCropDrag) registered once below.
    cv.onmouseleave = e => {};

    // Touch support — same getBoundingClientRect approach
    cv.ontouchstart = e => {
      e.preventDefault();
      const t=e.touches[0];
      const pos=clampCanvasPos(getCropCanvasPos(t.clientX, t.clientY), cv);
      mtCropDragging=true; mtCropStartX=pos.x; mtCropStartY=pos.y;
      mtCropDisplayRect=null; redrawCropOverlay();
    };
    cv.ontouchmove = e => {
      e.preventDefault();
      if(!mtCropDragging) return;
      const t=e.touches[0];
      const pos=clampCanvasPos(getCropCanvasPos(t.clientX, t.clientY), cv);
      const x=Math.min(mtCropStartX,pos.x), y=Math.min(mtCropStartY,pos.y);
      const w=Math.abs(pos.x-mtCropStartX),  h=Math.abs(pos.y-mtCropStartY);
      mtCropDisplayRect=clampCropRect({x,y,w,h}, cv);
      scheduleRedrawCropOverlay();
    };
    cv.ontouchend = e => {
      if(!mtCropDragging) return;
      mtCropDragging=false;
      if (_cropRafId) { cancelAnimationFrame(_cropRafId); _cropRafId=null; }
      if(mtCropDisplayRect && mtCropDisplayRect.w>4 && mtCropDisplayRect.h>4){
        mtState.cropRect={
          x: Math.round(mtCropDisplayRect.x / mtDisplayScale),
          y: Math.round(mtCropDisplayRect.y / mtDisplayScale),
          w: Math.round(mtCropDisplayRect.w / mtDisplayScale),
          h: Math.round(mtCropDisplayRect.h / mtDisplayScale),
        };
        mtState.hasCrop=true;
        document.getElementById('mtApplyCropBtn').classList.add('active-state');
      }
    };
  }

  // Shared finalize-drag logic used by both the canvas mouseup handler above and
  // the document-level fallback below (so a release outside the canvas still
  // commits the crop instead of leaving it "stuck").
  function commitMtCropDrag(){
    if(!mtCropDragging) return;
    mtCropDragging=false;
    if (_cropRafId) { cancelAnimationFrame(_cropRafId); _cropRafId=null; }
    if(mtCropDisplayRect && mtCropDisplayRect.w>4 && mtCropDisplayRect.h>4){
      // Convert canvas-pixel coords → original image coords
      mtState.cropRect={
        x: Math.round(mtCropDisplayRect.x / mtDisplayScale),
        y: Math.round(mtCropDisplayRect.y / mtDisplayScale),
        w: Math.round(mtCropDisplayRect.w / mtDisplayScale),
        h: Math.round(mtCropDisplayRect.h / mtDisplayScale),
      };
      mtState.hasCrop=true;
      const btn=document.getElementById('mtApplyCropBtn');
      if(btn) btn.classList.add('active-state');
    }
  }
  // FIX: registered ONCE at module load (not inside bindMtCropEvents, which runs
  // many times) so a fast drag that ends with the mouse button released outside
  // the crop canvas still finishes the crop cleanly, instead of leaving the
  // selection box stuck on screen with nothing applied to mtState.
  document.addEventListener('mouseup', commitMtCropDrag);

  function mtSyncRotationControl(){
    const input=document.getElementById('mtRotateFine');
    const label=document.getElementById('mtRotateFineLabel');
    const val=Math.round((Number(mtState.rotateDeg)||0)*10)/10;
    if(input) input.value=val;
    if(label) label.textContent=val+' deg';
  }
  function mtRotate(deg){mtState.rotateDeg=(Number(mtState.rotateDeg)||0)+Number(deg||0);mtCropDisplayRect=null;mtState.cropRect=null;mtState.hasCrop=false;_cachedRotatedCanvas=null;mtSyncRotationControl();renderMultiTool();setTimeout(bindMtCropEvents,50);}
  function mtSetRotation(deg){mtState.rotateDeg=Number(deg)||0;mtCropDisplayRect=null;mtState.cropRect=null;mtState.hasCrop=false;_cachedRotatedCanvas=null;mtSyncRotationControl();renderMultiTool();setTimeout(bindMtCropEvents,50);}
  function mtFlip(dir){if(dir==='h')mtState.flipH=!mtState.flipH;else mtState.flipV=!mtState.flipV;_cachedRotatedCanvas=null;renderMultiTool();setTimeout(bindMtCropEvents,50);}
  function mtApplyCrop(){
    // FIX (weird overlay on crop-after-crop): clear the leftover selection box
    // BEFORE re-rendering. Previously the old dashed rectangle from the last
    // drag stayed in mtCropDisplayRect and got redrawn on top of the freshly
    // applied crop every time, which is what made repeated cropping look messy.
    // Clearing it here gives a clean image with no stray box; a new one only
    // appears once the user starts a fresh drag.
    mtCropDisplayRect = null;
    try {
      renderMultiTool();
      toast(Lang.t('toastCropApplied'));
      document.getElementById('mtApplyCropBtn').classList.add('active-state');
    } catch(e) {
      // Fallback for very low-end PCs: try again with a short delay to let
      // the browser release memory from any previous canvas operations.
      console.warn('mtApplyCrop first attempt failed, retrying:', e);
      setTimeout(function() {
        try { renderMultiTool(); toast(Lang.t('toastCropApplied')); } catch(e2) {
          console.error('mtApplyCrop failed:', e2);
          toast('Crop failed — try a smaller image or clear other browser tabs.');
        }
      }, 200);
    }
  }
  function mtClearCrop(){mtState.cropRect=null;mtState.hasCrop=false;mtCropDisplayRect=null;renderMultiTool();setTimeout(bindMtCropEvents,50);document.getElementById('mtApplyCropBtn').classList.remove('active-state');}
  function mtSetQuality(val){mtState.quality=Number(val);document.getElementById('mtQualLabel').textContent=val+'%';upSlider(document.getElementById('mtQual'));renderMultiTool();}
  function mtSetFormat(val){mtState.format=val;renderMultiTool();}
  function mtSetMaxW(val){mtState.maxW=Number(val);document.getElementById('mtMaxWLabel').textContent=Number(val)===0?'Original':val+'px';upSlider(document.getElementById('mtMaxW'));renderMultiTool();}
  function mtReset(){
    _mtBgMask=null;_mtBgRestoreSnapshot=null;_mtBgColor='transparent';
    const cr=document.getElementById('mtBgColorRow');if(cr)cr.style.display='none';
    const rb=document.getElementById('mtRestoreBgBtn');if(rb)rb.style.display='none';
    const st=document.getElementById('mtBgStatus');if(st)st.textContent='';
    mtState={rotateDeg:0,flipH:false,flipV:false,cropRect:null,quality:85,format:'jpeg',maxW:0,hasCrop:false,brightness:0};mtCropDisplayRect=null;_cachedRotatedCanvas=null;
    document.getElementById('mtQual').value=85;document.getElementById('mtQualLabel').textContent='85%';
    document.getElementById('mtMaxW').value=0;document.getElementById('mtMaxWLabel').textContent='Original';
    document.getElementById('mtFmt').value='jpeg';
    mtSyncRotationControl();
    mtClearSize();
    renderMultiTool();setTimeout(bindMtCropEvents,50);
    toast(Lang.t('toastReset'));
  }

  /* ---- SIZE INPUT helpers ---- */
  function toMM(val, unit){
    if(unit==='mm') return val;
    if(unit==='cm') return val*10;
    if(unit==='in') return val*25.4;
    if(unit==='px') return val*0.264583; // at 96dpi
    return val;
  }
  function fromMM(mm, unit){
    if(unit==='mm') return mm;
    if(unit==='cm') return mm/10;
    if(unit==='in') return mm/25.4;
    if(unit==='px') return mm/0.264583;
    return mm;
  }
  function mtSizeChanged(){
    const wVal=parseFloat(document.getElementById('mtSizeW').value);
    const hVal=parseFloat(document.getElementById('mtSizeH').value);
    const uW=document.getElementById('mtSizeUnitW').value;
    const uH=document.getElementById('mtSizeUnitH').value;
    const infoEl=document.getElementById('mtSizeInfo');
    if(!isNaN(wVal)&&!isNaN(hVal)&&wVal>0&&hVal>0){
      const wMM=toMM(wVal,uW), hMM=toMM(hVal,uH);
      infoEl.textContent=`→ ${wMM.toFixed(1)}×${hMM.toFixed(1)} mm  |  ${(wMM/10).toFixed(2)}×${(hMM/10).toFixed(2)} cm  |  ${(wMM/25.4).toFixed(2)}×${(hMM/25.4).toFixed(2)} in`;
    } else { infoEl.textContent=''; }
    a4Preview();
  }
  function mtSizeUnitChanged(axis){
    // Sync both units to same (convenience)
    const wU=document.getElementById('mtSizeUnitW');
    const hU=document.getElementById('mtSizeUnitH');
    if(axis==='w') hU.value=wU.value;
    else wU.value=hU.value;
    mtSizeChanged();
  }
  function mtApplySizePreset(w,h,unit){
    document.getElementById('mtSizeW').value=w;
    document.getElementById('mtSizeH').value=h;
    document.getElementById('mtSizeUnitW').value=unit;
    document.getElementById('mtSizeUnitH').value=unit;
    mtSizeChanged();
  }
  function mtClearSize(){
    const sw=document.getElementById('mtSizeW');
    const sh=document.getElementById('mtSizeH');
    if(sw) sw.value='';
    if(sh) sh.value='';
    const infoEl=document.getElementById('mtSizeInfo');
    if(infoEl) infoEl.textContent='';
  }

  /* ---- A4 LAYOUT ---- */
  // Paper sizes: [widthMM, heightMM]
  const PAPER_SIZES = {
    'a4':     [210,   297  ],
    'a5':     [148,   210  ],
    '4x6':    [101.6, 152.4],
    '5x7':    [127,   177.8],
    '3x5':    [76.2,  127  ],
    'letter': [215.9, 279.4],
    'legal':  [215.9, 355.6],
    'custom': null,
  };

  let a4State={orient:'landscape', count:4, margin:3, corner:'tl', imgDir:'row', gap:2,
               paperSize:'4x6', customPW:210, customPH:297};

  function getA4PageDims(){
    const s = a4State.paperSize;
    let bW, bH;
    if(s === 'custom'){
      bW = a4State.customPW || 210;
      bH = a4State.customPH || 297;
    } else {
      const base = PAPER_SIZES[s] || PAPER_SIZES['a4'];
      bW = base[0]; bH = base[1];
    }
    // Apply orientation
    if(a4State.orient === 'landscape'){
      return {pW: Math.max(bW,bH), pH: Math.min(bW,bH)};
    } else {
      return {pW: Math.min(bW,bH), pH: Math.max(bW,bH)};
    }
  }

  function setA4PaperSize(sz){
    a4State.paperSize = sz;
    const customRow = document.getElementById('a4CustomSizeRow');
    if(customRow) customRow.style.display = (sz==='custom') ? 'flex' : 'none';
    Object.keys(PAPER_SIZES).forEach(k=>{
      const el=document.getElementById('a4Paper_'+k);
      if(el) el.classList.toggle('active', k===sz);
    });
    a4Preview();
  }

  function setA4CustomDim(){
    const wEl=document.getElementById('a4CustomPW');
    const hEl=document.getElementById('a4CustomPH');
    if(wEl) a4State.customPW = parseFloat(wEl.value)||210;
    if(hEl) a4State.customPH = parseFloat(hEl.value)||297;
    a4Preview();
  }

  function setA4Orient(o){
    a4State.orient=o;
    document.getElementById('a4OrientPortrait').classList.toggle('active',o==='portrait');
    document.getElementById('a4OrientLandscape').classList.toggle('active',o==='landscape');
    a4Preview();
  }
  function setA4Corner(c){
    a4State.corner=c;
    ['tl','tr','bl','br'].forEach(k=>{
      const el=document.getElementById('a4Corner_'+k);
      if(el) el.classList.toggle('active',k===c);
    });
    a4Preview();
  }
  function setA4ImgDir(d){
    a4State.imgDir=d;
    const rowBtn = document.getElementById('a4DirRow');
    const colBtn = document.getElementById('a4DirCol');
    if(rowBtn){ rowBtn.classList.remove('active'); if(d==='row') rowBtn.classList.add('active'); }
    if(colBtn){ colBtn.classList.remove('active'); if(d==='col') colBtn.classList.add('active'); }
    a4Preview();
  }
  function a4CountDelta(d){
    a4State.count=Math.max(1,Math.min(30,a4State.count+d));
    document.getElementById('a4CountLabel').textContent=a4State.count;
    a4Preview();
  }

  function getSizeMM(){
    const wVal=parseFloat(document.getElementById('mtSizeW')?.value);
    const hVal=parseFloat(document.getElementById('mtSizeH')?.value);
    const uW=document.getElementById('mtSizeUnitW')?.value||'cm';
    const uH=document.getElementById('mtSizeUnitH')?.value||'cm';
    if(!isNaN(wVal)&&!isNaN(hVal)&&wVal>0&&hVal>0){
      return {w:toMM(wVal,uW), h:toMM(hVal,uH)};
    }
    return null;
  }

  // Compute grid layout.
  // sizedExact=true  → placedW/H are FIXED at imgWmm×imgHmm (user set a real-world size).
  //                    Grid just figures out how many cols/rows fit without stretching.
  // sizedExact=false → auto-fit: stretch images to fill available space as large as possible.
  function computeA4Grid(pW, pH, imgWmm, imgHmm, marginMM, gapMM, count, sizedExact){
    const areaW = pW - marginMM*2;
    const areaH = pH - marginMM*2;

    if(sizedExact){
      // How many columns and rows fit at the EXACT specified size?
      const maxCols = Math.max(1, Math.floor((areaW + gapMM) / (imgWmm + gapMM)));
      const maxRows = Math.max(1, Math.floor((areaH + gapMM) / (imgHmm + gapMM)));
      // We need enough cells for `count` images
      const cols = Math.min(maxCols, count);
      const rows = Math.min(maxRows, Math.ceil(count / cols));
      // If user asks for more than fits, we still place as many as fit and warn
      const fits = cols * rows;
      return {
        cols, rows,
        placedW: imgWmm,   // EXACT — no scaling
        placedH: imgHmm,
        cellW:   imgWmm,
        cellH:   imgHmm,
        fitsOnPage: fits,
        overflow: count > fits,
      };
    }

    // Auto-fit: find the grid layout that makes images as large as possible
    let bestCols=1, bestRows=1, bestScale=0;
    for(let cols=1; cols<=count; cols++){
      const rows = Math.ceil(count/cols);
      if(cols*rows > count + cols) continue;
      const cellW = (areaW - Math.max(0,cols-1)*gapMM) / cols;
      const cellH = (areaH - Math.max(0,rows-1)*gapMM) / rows;
      if(cellW<=0 || cellH<=0) continue;
      const scale = Math.min(cellW/imgWmm, cellH/imgHmm);
      if(scale > bestScale){ bestScale=scale; bestCols=cols; bestRows=rows; }
    }
    const cellW = (areaW - Math.max(0,bestCols-1)*gapMM) / bestCols;
    const cellH = (areaH - Math.max(0,bestRows-1)*gapMM) / bestRows;
    const fitScale = Math.min(cellW/imgWmm, cellH/imgHmm);
    return {
      cols: bestCols, rows: bestRows,
      placedW: imgWmm*fitScale, placedH: imgHmm*fitScale,
      cellW, cellH,
      fitsOnPage: bestCols*bestRows,
      overflow: false,
    };
  }

  // Get position of image i in mm.
  // image 0 always lands in the chosen corner cell.
  function getImgPos(i, g, marginMM, gapMM){
    const {cols, rows, placedW, placedH, cellW, cellH} = g;
    const corner = a4State.corner;   // tl tr bl br
    const dir    = a4State.imgDir;   // row | col

    // 1. Natural (top-left) col,row for slot i
    let col, row;
    if(dir === 'row'){
      col = i % cols;
      row = Math.floor(i / cols);
    } else {
      // Column-by-column: fill down first, then next column
      col = Math.floor(i / rows);
      row = i % rows;
    }

    // 2. Mirror so image 0 is in the chosen corner.
    const flipH = (corner === 'tr' || corner === 'br');
    const flipV = (corner === 'bl' || corner === 'br');
    if(flipH) col = (cols - 1) - col;
    if(flipV) row = (rows - 1) - row;

    // 3. mm position using cell pitch so cells don't overlap.
    let xMM = marginMM + col*(cellW + gapMM) + (cellW - placedW)/2;
    let yMM = marginMM + row*(cellH + gapMM) + (cellH - placedH)/2;

    // 4. For bottom corners, anchor the whole grid block to the bottom.
    const _pageDims = getA4PageDims();
    if(flipV){
      const areaH = _pageDims.pH - marginMM*2;
      const blockH = rows*(cellH + gapMM) - gapMM;
      const shiftDown = areaH - blockH;
      yMM += shiftDown;
    }
    // Same logic for right-anchored columns.
    if(flipH){
      const areaW = _pageDims.pW - marginMM*2;
      const blockW = cols*(cellW + gapMM) - gapMM;
      const shiftRight = areaW - blockW;
      xMM += shiftRight;
    }

    return {xMM, yMM};
  }

  function a4Preview(){
    if(!mtResultCanvas||!mtResultCanvas.width) return;
    const marginMM = parseFloat(document.getElementById('a4Margin')?.value)||3;
    const gapRaw   = parseFloat(document.getElementById('a4Gap')?.value);
    const gapMM    = isNaN(gapRaw) ? 2 : Math.max(0, gapRaw);
    a4State.margin = marginMM;
    a4State.gap    = gapMM;
    const {pW, pH} = getA4PageDims();

    let imgWmm, imgHmm, sizedExact=false;
    const sized=getSizeMM();
    if(sized){
      imgWmm=sized.w; imgHmm=sized.h;
      sizedExact=true;   // ← user specified real-world dimensions → honour them exactly
    } else {
      const r=mtResultCanvas.width/mtResultCanvas.height;
      imgWmm=Math.min(80,(pW-marginMM*2));
      imgHmm=imgWmm/r;
    }

    const count = a4State.count;
    const g     = computeA4Grid(pW,pH,imgWmm,imgHmm,marginMM,gapMM,count,sizedExact);
    const placeable = Math.min(count, g.fitsOnPage);

    const PX_PER_MM=2.2;
    const cW=Math.round(pW*PX_PER_MM), cH=Math.round(pH*PX_PER_MM);
    const cv=document.getElementById('a4PreviewCanvas');
    cv.width=cW; cv.height=cH;
    cv.style.maxWidth=Math.min(cW,420)+'px';
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,cW,cH);

    for(let i=0;i<placeable;i++){
      const {xMM,yMM}=getImgPos(i,g,marginMM,gapMM,pW,pH);
      const px=Math.round(xMM*PX_PER_MM), py=Math.round(yMM*PX_PER_MM);
      const pw2=Math.round(g.placedW*PX_PER_MM), ph2=Math.round(g.placedH*PX_PER_MM);
      if(pw2<1||ph2<1) continue;
      ctx.drawImage(mtResultCanvas, px, py, pw2, ph2);
      ctx.strokeStyle='rgba(160,160,185,0.6)'; ctx.lineWidth=0.6;
      ctx.strokeRect(px+0.5, py+0.5, pw2-1, ph2-1);
      // number label
      const fs=Math.max(7, Math.round(Math.min(pw2,ph2)*0.13));
      ctx.fillStyle='rgba(108,99,255,0.8)';
      ctx.font=`bold ${fs}px sans-serif`;
      ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText(i+1, px+2, py+2);
    }

    // Page border
    ctx.strokeStyle='rgba(108,99,255,0.4)'; ctx.lineWidth=1.5;
    ctx.strokeRect(0.5,0.5,cW-1,cH-1);
    // Margin guide
    const mPx=Math.round(marginMM*PX_PER_MM);
    ctx.strokeStyle='rgba(108,99,255,0.18)'; ctx.lineWidth=0.7; ctx.setLineDash([4,4]);
    ctx.strokeRect(mPx,mPx,cW-mPx*2,cH-mPx*2); ctx.setLineDash([]);

    const infoEl=document.getElementById('a4LayoutInfo');
    if(infoEl){
      let msg = `${g.cols} col × ${g.rows} row · each photo ${g.placedW.toFixed(1)}×${g.placedH.toFixed(1)} mm`;
      if(sizedExact) msg += ` (exact size)`;
      if(gapMM>0) msg += ` · gap ${gapMM}mm`;
      if(g.overflow) msg += ` ⚠ Only ${g.fitsOnPage} fit on this page at this size (asked for ${count})`;
      infoEl.textContent = msg;
      infoEl.style.color = g.overflow ? '#e04' : 'var(--text-muted)';
    }
  }

  async function downloadA4PDF(){
    if(!mtResultCanvas||!mtResultCanvas.width){toast('Upload and edit an image first.','error');return;}
    if(!window.jspdf||!window.jspdf.jsPDF){toast('PDF library not loaded.','error');return;}
    const {jsPDF}=window.jspdf;
    const marginMM = parseFloat(document.getElementById('a4Margin')?.value)||3;
    const gapRaw   = parseFloat(document.getElementById('a4Gap')?.value);
    const gapMM    = isNaN(gapRaw)?2:Math.max(0,gapRaw);
    const {pW, pH} = getA4PageDims();

    let imgWmm,imgHmm,sizedExact=false;
    const sized=getSizeMM();
    if(sized){imgWmm=sized.w;imgHmm=sized.h;sizedExact=true;}
    else{const r=mtResultCanvas.width/mtResultCanvas.height;imgWmm=Math.min(80,(pW-marginMM*2));imgHmm=imgWmm/r;}

    const count=a4State.count;
    const g=computeA4Grid(pW,pH,imgWmm,imgHmm,marginMM,gapMM,count,sizedExact);
    const placeable=Math.min(count,g.fitsOnPage);

    const paperFmt = a4State.paperSize==='a4' ? 'a4' : [Math.min(pW,pH), Math.max(pW,pH)];
    const pdf=new jsPDF({orientation:a4State.orient,unit:'mm',format:paperFmt,compress:true});
    const qual=mtState.quality/100;
    const dataUrl=mtResultCanvas.toDataURL('image/jpeg',qual);

    for(let i=0;i<placeable;i++){
      const {xMM,yMM}=getImgPos(i,g,marginMM,gapMM,pW,pH);
      pdf.addImage(dataUrl,'JPEG',xMM,yMM,g.placedW,g.placedH,undefined,'FAST');
    }
    saveBlob(pdf.output('blob'),'passport_photos_a4.pdf');
    if(g.overflow) toast(`PDF saved — only ${placeable} of ${count} fit at this size.`,'info');
    else toast('A4 PDF downloaded!');
  }

  /* ================================================================
     BULK PDF BUILDER
     Pages are stored as {id, name, dataUrl, canvas} objects.
     Drag-to-reorder is done with native HTML5 drag-and-drop on the
     thumbnail grid.  Full-page lightbox for preview / reorder / delete.
  ================================================================ */
  let bpPages   = [];   // [{id, name, dataUrl}]
  let bpDragIdx = null;
  let bpLbIdx   = 0;

  function bpId(){ return Date.now()+Math.random(); }

  // ---- File ingestion ----
  async function bpAddFiles(files){
    if(!files||!files.length) return;
    const arr = Array.from(files);
    document.getElementById('bpProgress').style.display='block';
    document.getElementById('bpToolbar').style.display='none';

    for(let i=0;i<arr.length;i++){
      const f=arr[i];
      document.getElementById('bpProgressLabel').textContent=`Loading ${i+1} of ${arr.length}: ${f.name}`;
      document.getElementById('bpProgressBar').style.width=((i/arr.length)*100)+'%';
      try {
        if(f.type==='application/pdf' || f.name.toLowerCase().endsWith('.pdf')){
          // Render each PDF page via jsPDF / pdf.js fallback
          const pages = await bpLoadPDF(f);
          pages.forEach(p => bpPages.push(p));
        } else {
          const dataUrl = await bpReadImg(f);
          bpPages.push({id:bpId(), name:f.name, dataUrl});
        }
      } catch(e){ toast(`Failed: ${f.name}`,'error'); }
    }

    document.getElementById('bpProgress').style.display='none';
    document.getElementById('bpProgressBar').style.width='0%';
    document.getElementById('bpToolbar').style.display='block';
    bpRender();
  }

  function bpReadImg(file){
    return new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=e=>res(e.target.result);
      r.onerror=rej;
      r.readAsDataURL(file);
    });
  }

  async function bpLoadPDF(file){
    // Use pdfjsLib if available (loaded lazily), else render via canvas hack
    if(!window.pdfjsLib){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const arrayBuf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({data:arrayBuf}).promise;
    const pages = [];
    for(let p=1;p<=pdf.numPages;p++){
      document.getElementById('bpProgressLabel').textContent=`Reading PDF: ${file.name} — page ${p}/${pdf.numPages}`;
      const page = await pdf.getPage(p);
      const vp   = page.getViewport({scale:1.8});
      const cv   = document.createElement('canvas');
      cv.width=vp.width; cv.height=vp.height;
      await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      pages.push({id:bpId(), name:`${file.name} p${p}`, dataUrl:cv.toDataURL('image/jpeg',0.92)});
    }
    return pages;
  }

  function loadScript(src){
    return new Promise((res,rej)=>{
      if(document.querySelector(`script[src="${src}"]`)){res();return;}
      const s=document.createElement('script'); s.src=src;
      s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });
  }

  // ---- Render thumbnail grid ----
  function bpRender(){
    const grid=document.getElementById('bpGrid');
    const countEl=document.getElementById('bpCount');
    if(!grid) return;
    countEl.textContent=`${bpPages.length} page${bpPages.length!==1?'s':''}`;
    grid.innerHTML='';
    bpPages.forEach((pg,idx)=>{
      const card=document.createElement('div');
      card.className='bp-thumb-card';
      card.draggable=true;
      card.dataset.idx=idx;

      card.innerHTML=`
        <div class="bp-thumb-num">${idx+1}</div>
        <img class="bp-thumb-img" src="${pg.dataUrl}" alt="${pg.name}" loading="lazy">
        <div class="bp-thumb-name">${pg.name.length>22?pg.name.slice(0,19)+'…':pg.name}</div>
        <button class="bp-thumb-del" onclick="sdt.bpDelete(${idx})" title="Remove">✕</button>
        <div class="bp-thumb-move-row">
          <button class="bp-thumb-mv" onclick="sdt.bpMove(${idx},-1)" ${idx===0?'disabled':''}>◀</button>
          <button class="bp-thumb-mv" onclick="sdt.bpLbOpen(${idx})">🔍</button>
          <button class="bp-thumb-mv" onclick="sdt.bpMove(${idx},1)" ${idx===bpPages.length-1?'disabled':''}>▶</button>
        </div>`;

      // Click image to open lightbox
      card.querySelector('.bp-thumb-img').addEventListener('click',()=>bpLbOpen(idx));

      // Drag-and-drop reorder
      card.addEventListener('dragstart',e=>{
        bpDragIdx=idx;
        card.classList.add('bp-dragging');
        e.dataTransfer.effectAllowed='move';
      });
      card.addEventListener('dragend',()=>card.classList.remove('bp-dragging'));
      card.addEventListener('dragover',e=>{
        e.preventDefault();
        e.dataTransfer.dropEffect='move';
        document.querySelectorAll('.bp-thumb-card').forEach(c=>c.classList.remove('bp-drag-over'));
        card.classList.add('bp-drag-over');
      });
      card.addEventListener('dragleave',()=>card.classList.remove('bp-drag-over'));
      card.addEventListener('drop',e=>{
        e.preventDefault();
        card.classList.remove('bp-drag-over');
        if(bpDragIdx===null||bpDragIdx===idx) return;
        const moved=bpPages.splice(bpDragIdx,1)[0];
        bpPages.splice(idx,0,moved);
        bpDragIdx=null;
        bpRender();
      });

      grid.appendChild(card);
    });
  }

  function bpDelete(idx){
    bpPages.splice(idx,1);
    bpRender();
    if(!bpPages.length) document.getElementById('bpToolbar').style.display='none';
  }

  function bpMove(idx,dir){
    const to=idx+dir;
    if(to<0||to>=bpPages.length) return;
    [bpPages[idx],bpPages[to]]=[bpPages[to],bpPages[idx]];
    bpRender();
  }

  function bpSortByName(){
    bpPages.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
    bpRender();
    toast('Sorted by name');
  }

  function bpReverseOrder(){
    bpPages.reverse();
    bpRender();
    toast('Order reversed');
  }

  function bpClearAll(){
    if(!bpPages.length) return;
    if(!confirm(`Remove all ${bpPages.length} pages?`)) return;
    bpPages=[];
    document.getElementById('bpToolbar').style.display='none';
    document.getElementById('bpGrid').innerHTML='';
    toast('Cleared');
  }

  // "Clear Page" — wipes BOTH tools that live on this tab (PDF Compressor + Bulk PDF
  // Builder) in one go, since they share the same tab/page.
  function clearBulkPdfPage(){
    const hasWork = bpPages.length > 0 || !!pcOrigFile;
    if(!hasWork){ toast('Nothing to clear.'); return; }
    if(!confirm('Clear the PDF Compressor and Bulk PDF Builder on this page? This cannot be undone.')) return;
    pcClear();
    bpPages=[];
    document.getElementById('bpToolbar').style.display='none';
    document.getElementById('bpGrid').innerHTML='';
    toast('Page cleared');
  }

  function bpDzDrop(e){
    e.preventDefault();
    document.getElementById('bpDrop').classList.remove('dz-over');
    bpAddFiles(e.dataTransfer.files);
  }

  // ---- Lightbox ----
  function bpLbOpen(idx){
    if(!bpPages.length) return;
    bpLbIdx=Math.max(0,Math.min(idx,bpPages.length-1));
    const lb=document.getElementById('bpLightbox');
    lb.style.display='flex';
    bpLbShow();
    // keyboard nav
    document.addEventListener('keydown',bpLbKey);
  }

  function bpLbShow(){
    const pg=bpPages[bpLbIdx];
    document.getElementById('bpLbImg').src=pg.dataUrl;
    document.getElementById('bpLbCounter').textContent=`${bpLbIdx+1} / ${bpPages.length}`;
    document.getElementById('bpLbName').textContent=pg.name;
    document.getElementById('bpLbPrev').disabled=bpLbIdx===0;
    document.getElementById('bpLbNext').disabled=bpLbIdx===bpPages.length-1;
    document.getElementById('bpLbMoveL').disabled=bpLbIdx===0;
    document.getElementById('bpLbMoveR').disabled=bpLbIdx===bpPages.length-1;
  }

  function bpLbNav(dir){
    bpLbIdx=Math.max(0,Math.min(bpLbIdx+dir,bpPages.length-1));
    bpLbShow();
  }

  function bpLbMove(dir){
    const to=bpLbIdx+dir;
    if(to<0||to>=bpPages.length) return;
    [bpPages[bpLbIdx],bpPages[to]]=[bpPages[to],bpPages[bpLbIdx]];
    bpLbIdx=to;
    bpLbShow();
    bpRender();
    toast(`Moved to position ${to+1}`);
  }

  function bpLbDelete(){
    if(!confirm('Remove this page?')) return;
    bpPages.splice(bpLbIdx,1);
    if(!bpPages.length){ bpLbClose(); return; }
    bpLbIdx=Math.min(bpLbIdx,bpPages.length-1);
    bpLbShow();
    bpRender();
  }

  function bpLbClose(){
    document.getElementById('bpLightbox').style.display='none';
    document.removeEventListener('keydown',bpLbKey);
  }

  function bpLbKey(e){
    if(e.key==='ArrowLeft')  { e.preventDefault(); bpLbNav(-1); }
    if(e.key==='ArrowRight') { e.preventDefault(); bpLbNav(1);  }
    if(e.key==='Escape')     { e.preventDefault(); bpLbClose(); }
  }

  // ---- PDF Download ----
  function bpPageFit(dim, marginMM) {
    const portrait = {orient:'portrait', pW:210, pH:297};
    const landscape = {orient:'landscape', pW:297, pH:210};
    const score = page => {
      const innerW = page.pW - marginMM * 2;
      const innerH = page.pH - marginMM * 2;
      const scale = Math.min(innerW / dim.w, innerH / dim.h);
      return {page, scale, area: dim.w * scale * dim.h * scale};
    };
    const p = score(portrait);
    const l = score(landscape);
    const best = l.area > p.area ? l : p;
    const innerW = best.page.pW - marginMM * 2;
    const innerH = best.page.pH - marginMM * 2;
    const iW = dim.w * best.scale;
    const iH = dim.h * best.scale;
    return {
      orient: best.page.orient,
      x: marginMM + (innerW - iW) / 2,
      y: marginMM + (innerH - iH) / 2,
      iW,
      iH,
    };
  }

  // ---- PDF COMPRESSOR ----
  let pcOrigFile = null;
  let pcOrigSize = 0;

  function pcDzDrop(e) {
    e.preventDefault();
    document.getElementById('pcDrop').classList.remove('dz-over');
    const f = e.dataTransfer.files[0];
    if (f) pcLoadFile(f);
  }

  async function pcLoadFile(file) {
    if (!file || !(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      toast('Please upload a PDF file.', 'error'); return;
    }
    pcOrigFile = file;
    pcOrigSize = file.size;
    _pcPdfDoc = null;
    _pcCompressedCache = null;
    _pcBuildPromise = null;
    _pcEstimateToken += 1;
    if (_pcEstimateTimer) clearTimeout(_pcEstimateTimer);
    _pcRawBytes = null; // store original bytes for stream-level compression

    document.getElementById('pcPlaceholder').style.display = 'none';
    document.getElementById('pcFileInfo').style.display = 'block';
    document.getElementById('pcFileName').textContent = file.name;
    document.getElementById('pcFileSize').textContent = fmtBytes(file.size) + ' \u00b7 loading\u2026';
    document.getElementById('pcEditor').style.display = 'none';
    document.getElementById('pcProgress').style.display = 'block';
    document.getElementById('pcProgressLabel').textContent = 'Loading PDF\u2026';
    document.getElementById('pcProgressBar').style.width = '0%';

    try {
      const arrayBuf = await file.arrayBuffer();
      _pcRawBytes = new Uint8Array(arrayBuf);

      // Count pages via pdfjs for display only — we don't rasterize
      if (!window.pdfjsLib) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      const pdfDoc = await window.pdfjsLib.getDocument({data: arrayBuf.slice(0)}).promise;
      const total = pdfDoc.numPages;
      _pcPdfDoc = pdfDoc;

      document.getElementById('pcProgressBar').style.width = '60%';
      document.getElementById('pcProgressLabel').textContent = 'Preparing compressor\u2026';

      document.getElementById('pcProgressBar').style.width = '100%';
      document.getElementById('pcFileSize').textContent = fmtBytes(file.size) + ' \u00b7 ' + total + ' page' + (total !== 1 ? 's' : '');
      document.getElementById('pcOrigSize').textContent = fmtBytes(file.size);
      document.getElementById('pcPageCount').textContent = total;

      setTimeout(() => {
        document.getElementById('pcProgress').style.display = 'none';
        document.getElementById('pcEditor').style.display = 'block';
        pcUpdateEstimate();
      }, 300);
    } catch(e) {
      toast('Failed to load PDF: ' + e.message, 'error');
      document.getElementById('pcProgress').style.display = 'none';
      document.getElementById('pcPlaceholder').style.display = 'flex';
      document.getElementById('pcFileInfo').style.display = 'none';
    }
  }

  // Stored PDF data and exact compressed-output cache.
  let _pcRawBytes = null;
  let _pcPdfDoc = null;
  let _pcCompressedCache = null; // {quality, blob, bytes}
  let _pcBuildPromise = null;
  let _pcEstimateTimer = null;
  let _pcEstimateToken = 0;

  function pcUpdateQualLabel(el) {
    updateSliderGradient(el);
    document.getElementById('pcQualLabel').textContent = el.value + '%';
    pcUpdateEstimate();
  }

  function pcTargetChanged(el) {
    el.classList.remove('ts-error', 'ts-ok');
    if (!el.value) return;
    const v = parseInt(el.value);
    el.classList.add(isNaN(v) || v < 20 ? 'ts-error' : 'ts-ok');
  }

  function pcUpdateEstimate() {
    const q = parseInt(document.getElementById('pcQual').value);
    const estEl = document.getElementById('pcEstSize');
    if (!_pcPdfDoc) { estEl.textContent = '\u2014'; return; }
    if (_pcCompressedCache && _pcCompressedCache.quality === q) {
      estEl.textContent = fmtBytes(_pcCompressedCache.bytes);
      return;
    }
    _pcCompressedCache = null;
    estEl.textContent = 'Calculating\u2026';
    const token = ++_pcEstimateToken;
    if (_pcEstimateTimer) clearTimeout(_pcEstimateTimer);
    _pcEstimateTimer = setTimeout(async () => {
      try {
        const blob = await pcGetCompressedBlob(q, (pct) => {
          if (token !== _pcEstimateToken) return;
          estEl.textContent = 'Calculating ' + Math.max(1, Math.round(pct * 100)) + '%\u2026';
        });
        if (token !== _pcEstimateToken) return;
        estEl.textContent = fmtBytes(blob.size);
      } catch(e) {
        if (token === _pcEstimateToken) estEl.textContent = 'Could not calculate';
      }
    }, 350);
  }

  async function pcApplyTarget() {
    if (!_pcRawBytes || !_pcPdfDoc) { toast('Load a PDF first.', 'error'); return; }
    const inp = document.getElementById('pcTargetKb');
    const targetKb = parseInt(inp.value);
    if (isNaN(targetKb) || targetKb < 20) { inp.classList.add('ts-error'); toast('Enter a valid target size (min 20 KB).', 'error'); return; }
    const targetBytes = targetKb * 1024;
    const candidates = [100,95,90,85,80,75,70,65,60,55,50,45,40,35,30,25,20,15,10,5];
    let best = null;
    let smallest = null;
    const token = ++_pcEstimateToken;
    const progress = document.getElementById('pcProgress');
    const label = document.getElementById('pcProgressLabel');
    const bar = document.getElementById('pcProgressBar');
    progress.style.display = 'block';
    try {
      for (let i = 0; i < candidates.length; i++) {
        const q = candidates[i];
        label.textContent = 'Finding target size\u2026 ' + q + '%';
        bar.style.width = Math.round((i / candidates.length) * 100) + '%';
        const blob = await pcGetCompressedBlob(q);
        if (token !== _pcEstimateToken) return;
        smallest = {q, blob};
        if (blob.size <= targetBytes) { best = {q, blob}; break; }
      }
    } catch(e) {
      progress.style.display = 'none';
      toast('Could not test target size: ' + e.message, 'error');
      return;
    }
    const result = best || smallest;
    const bestQ = result ? result.q : 5;
    const slider = document.getElementById('pcQual');
    slider.value = bestQ; updateSliderGradient(slider);
    document.getElementById('pcQualLabel').textContent = bestQ + '%';
    if (result) _pcCompressedCache = {quality: bestQ, blob: result.blob, bytes: result.blob.size};
    document.getElementById('pcEstSize').textContent = result ? fmtBytes(result.blob.size) : 'Could not calculate';
    inp.classList.remove('ts-error'); inp.classList.add('ts-ok');
    bar.style.width = '100%';
    setTimeout(() => { progress.style.display = 'none'; bar.style.width = '0%'; }, 500);
    toast('Quality set to ' + bestQ + '% \u2192 ' + (best ? fmtBytes(result.blob.size) : 'smallest available: ' + (result ? fmtBytes(result.blob.size) : 'unknown')));
  }

  async function pcDownload() {
    if (!_pcRawBytes || !_pcPdfDoc) { toast('Load a PDF first.', 'error'); return; }

    const quality = parseInt(document.getElementById('pcQual').value);
    document.getElementById('pcProgress').style.display = 'block';
    document.getElementById('pcProgressLabel').textContent = 'Compressing\u2026';
    const bar = document.getElementById('pcProgressBar');
    bar.style.width = '10%';

    try {
      const blob = await pcGetCompressedBlob(quality, (pct) => {
        bar.style.width = (10 + pct * 85) + '%';
        document.getElementById('pcProgressLabel').textContent = 'Building compressed PDF\u2026 ' + Math.round(pct * 100) + '%';
      });

      bar.style.width = '95%';
      document.getElementById('pcProgressLabel').textContent = 'Saving\u2026';

      const outName = (pcOrigFile.name.replace(/\.pdf$/i, '') || 'compressed') + '_compressed.pdf';
      saveBlob(blob, outName);

      const saved = _pcRawBytes.length - blob.size;
      const savedPct = Math.round(Math.abs(saved) / _pcRawBytes.length * 100);
      document.getElementById('pcEstSize').textContent = fmtBytes(blob.size) + ' \u2713';
      bar.style.width = '100%';
      setTimeout(() => { document.getElementById('pcProgress').style.display = 'none'; bar.style.width = '0%'; }, 600);
      toast('Saved! ' + fmtBytes(blob.size) + (saved >= 0 ? ' (reduced by ' : ' (larger by ') + savedPct + '%)');
    } catch(e) {
      document.getElementById('pcProgress').style.display = 'none';
      toast('Compression failed: ' + e.message, 'error');
    }
  }

  // Core PDF compressor: works on raw PDF bytes, recompresses JPEG images and
  // strips redundant metadata. Content (text, vectors, fonts) is fully preserved.
  async function pcCompressPdfBytes(srcBytes, jpegQuality, onProgress) {
    const src = srcBytes;
    const text = pcBytesToLatin1(src);

    // --- Step 1: Strip/blank metadata dictionary to save space ---
    let out = text;
    // Remove Info dictionary content (author, creator, producer, dates etc.)
    out = out.replace(/\/Author\s*\([^)]*\)/g, '/Author ()');
    out = out.replace(/\/Creator\s*\([^)]*\)/g, '/Creator ()');
    out = out.replace(/\/Producer\s*\([^)]*\)/g, '/Producer ()');
    out = out.replace(/\/Subject\s*\([^)]*\)/g, '/Subject ()');
    out = out.replace(/\/Keywords\s*\([^)]*\)/g, '/Keywords ()');
    out = out.replace(/\/Title\s*\([^)]*\)/g, '/Title ()');
    // Remove XMP metadata streams (often 2–20 KB of XML bloat)
    out = out.replace(/\/Type\s*\/Metadata[\s\S]*?endstream/g, (m) => {
      const streamStart = m.indexOf('stream') + 6;
      const nl = m[streamStart] === '\r' ? 2 : 1;
      const blank = m.slice(0, streamStart + nl) + 'endstream';
      return blank;
    });

    onProgress && onProgress(0.15);
    await new Promise(r => setTimeout(r, 0));

    // --- Step 2: Recompress JPEG (DCTDecode) image streams at target quality ---
    // Find all DCTDecode image stream positions
    const dctRegex = /<<([^>]*\/Filter\s*\/DCTDecode[^>]*)>>\s*stream\r?\n/g;
    let match;
    const patches = []; // [{start, end, newData}]

    while ((match = dctRegex.exec(out)) !== null) {
      const streamStart = match.index + match[0].length;
      const endIdx = out.indexOf('endstream', streamStart);
      if (endIdx < 0) continue;
      const jpegStr = out.slice(streamStart, endIdx);
      const jpegBytes = pcLatin1ToBytes(jpegStr);

      // Re-encode JPEG at target quality via canvas
      try {
        const reEncoded = await pcRecompressJpeg(jpegBytes, jpegQuality);
        if (reEncoded && reEncoded.length < jpegBytes.length * 0.98) {
          // Only use if actually smaller
          patches.push({start: streamStart, end: endIdx, newBytes: reEncoded, dictStr: match[0], origDictStart: match.index});
        }
      } catch(e) { /* skip this image if re-encode fails */ }
    }

    onProgress && onProgress(0.85);

    // Apply patches in reverse order so offsets stay valid
    patches.sort((a, b) => b.start - a.start);
    for (const patch of patches) {
      const newJpegStr = pcBytesToLatin1(patch.newBytes);
      // Update /Length in the dictionary
      const newDict = patch.dictStr.replace(/\/Length\s+\d+/, '/Length ' + patch.newBytes.length);
      out = out.slice(0, patch.origDictStart) + newDict + out.slice(patch.origDictStart + patch.dictStr.length, patch.start) + newJpegStr + out.slice(patch.end);
    }

    onProgress && onProgress(1.0);

    // Convert back to bytes
    return pcLatin1ToBytes(out).buffer;
  }

  // Re-encode a JPEG byte array at a new quality via canvas, returns Uint8Array
  function pcRecompressJpeg(jpegBytes, quality) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([jpegBytes], {type: 'image/jpeg'});
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (img.naturalWidth === 0) { reject(new Error('bad image')); return; }
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        const ctx = cv.getContext('2d', {alpha: false});
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0);
        const dataUrl = cv.toDataURL('image/jpeg', quality);
        const b64 = dataUrl.split(',')[1];
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(arr);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
      img.src = url;
    });
  }

  // Convert Uint8Array to latin1 string (1 byte per char, preserves all bytes)
  function pcBytesToLatin1(bytes) {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]);
    }
    return result;
  }

  // Convert latin1 string back to Uint8Array
  function pcLatin1ToBytes(str) {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i) & 0xff;
    return arr;
  }

  async function pcGetCompressedBlob(quality, onProgress) {
    if (_pcCompressedCache && _pcCompressedCache.quality === quality) {
      onProgress && onProgress(1);
      return _pcCompressedCache.blob;
    }
    if (_pcBuildPromise && _pcBuildPromise.quality === quality) return _pcBuildPromise.promise;

    const promise = pcBuildRasterPdf(quality, onProgress).then(blob => {
      _pcCompressedCache = {quality, blob, bytes: blob.size};
      return blob;
    }).finally(() => {
      if (_pcBuildPromise && _pcBuildPromise.quality === quality) _pcBuildPromise = null;
    });
    _pcBuildPromise = {quality, promise};
    return promise;
  }

  async function pcBuildRasterPdf(quality, onProgress) {
    if (!_pcPdfDoc || !window.jspdf || !window.jspdf.jsPDF) throw new Error('PDF library not loaded.');
    const {jsPDF} = window.jspdf;
    const q = Math.max(5, Math.min(100, quality));
    const jpegQuality = Math.max(0.22, Math.min(0.95, 0.18 + q / 120));
    const renderScale = Math.max(0.7, Math.min(2.4, 0.55 + q / 55));
    let pdf = null;

    for (let p = 1; p <= _pcPdfDoc.numPages; p++) {
      const page = await _pcPdfDoc.getPage(p);
      const vp = page.getViewport({scale: renderScale});
      const baseVp = page.getViewport({scale: 1});
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.floor(vp.width));
      cv.height = Math.max(1, Math.floor(vp.height));
      const ctx = cv.getContext('2d', {alpha: false});
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({canvasContext: ctx, viewport: vp}).promise;

      const pageWmm = baseVp.width * 25.4 / 72;
      const pageHmm = baseVp.height * 25.4 / 72;
      if (!pdf) {
        pdf = new jsPDF({
          orientation: pageWmm > pageHmm ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [pageWmm, pageHmm],
          compress: true
        });
      } else {
        pdf.addPage([pageWmm, pageHmm], pageWmm > pageHmm ? 'landscape' : 'portrait');
      }
      pdf.addImage(cv.toDataURL('image/jpeg', jpegQuality), 'JPEG', 0, 0, pageWmm, pageHmm, undefined, 'FAST');
      cv.width = cv.height = 1;
      onProgress && onProgress(p / _pcPdfDoc.numPages);
      await new Promise(r => setTimeout(r, 0));
    }
    return pdf.output('blob');
  }

  function pcClear() {
    pcOrigFile = null; pcOrigSize = 0;
    _pcRawBytes = null; _pcPdfDoc = null; _pcCompressedCache = null; _pcBuildPromise = null;
    _pcEstimateToken += 1;
    if (_pcEstimateTimer) clearTimeout(_pcEstimateTimer);
    document.getElementById('pcPlaceholder').style.display = 'flex';
    document.getElementById('pcFileInfo').style.display = 'none';
    document.getElementById('pcEditor').style.display = 'none';
    document.getElementById('pcProgress').style.display = 'none';
    document.getElementById('pcInput').value = '';
    document.getElementById('pcTargetKb').value = '';
    document.getElementById('pcTargetKb').classList.remove('ts-ok', 'ts-error');
  }

  // ---- END PDF COMPRESSOR ----

  async function bpDownloadPDF(){
    if(!bpPages.length){ toast('No pages to export','error'); return; }
    if(!window.jspdf||!window.jspdf.jsPDF){ toast('PDF library not loaded','error'); return; }
    const {jsPDF}=window.jspdf;
    const pageMarginMM = 5;

    document.getElementById('bpProgress').style.display='block';
    document.getElementById('bpProgressLabel').textContent='Building PDF…';
    const bar=document.getElementById('bpProgressBar');

    const firstImg=await bpImgDimensions(bpPages[0].dataUrl);
    const firstFit=bpPageFit(firstImg, pageMarginMM);
    const pdf=new jsPDF({orientation:firstFit.orient,unit:'mm',format:'a4',compress:true});

    for(let i=0;i<bpPages.length;i++){
      const pg=bpPages[i];
      bar.style.width=((i/bpPages.length)*100)+'%';
      document.getElementById('bpProgressLabel').textContent=`Adding page ${i+1} of ${bpPages.length}…`;

      const dim=await bpImgDimensions(pg.dataUrl);
      const fit=bpPageFit(dim, pageMarginMM);
      if(i>0) pdf.addPage('a4', fit.orient);

      const fmt=pg.dataUrl.startsWith('data:image/png')?'PNG':'JPEG';
      pdf.addImage(pg.dataUrl,fmt,fit.x,fit.y,fit.iW,fit.iH,undefined,'FAST');

      // Yield to keep UI responsive
      await new Promise(r=>setTimeout(r,0));
    }

    bar.style.width='100%';
    document.getElementById('bpProgressLabel').textContent='Saving…';
    saveBlob(pdf.output('blob'),'bulk_document.pdf');
    setTimeout(()=>{
      document.getElementById('bpProgress').style.display='none';
      bar.style.width='0%';
    },800);
    toast(`PDF saved — ${bpPages.length} pages`);
  }

  function bpImgDimensions(dataUrl){
    return new Promise(res=>{
      const img=new Image();
      img.onload=()=>res({w:img.naturalWidth,h:img.naturalHeight});
      img.src=dataUrl;
    });
  }

  async function mtDownload() {
    const mime=mtState.format==='png'?'image/png':mtState.format==='webp'?'image/webp':'image/jpeg';
    const qual=mtState.quality/100;

    // Show format picker
    const fmt=await showDownloadPicker(Lang.t('dlPickerTitle'));
    if(!fmt)return;

    if(fmt==='pdf'){
      if(!window.jspdf||!window.jspdf.jsPDF){toast(Lang.t('toastPdfLibNotLoaded'),'error');return;}
      const {jsPDF}=window.jspdf;
      const w=mtResultCanvas.width,h=mtResultCanvas.height;
      const mmW=w*0.2646,mmH=h*0.2646; // px to mm at 96dpi
      const isPort=mmH>=mmW;
      const pdf=new jsPDF({orientation:isPort?'portrait':'landscape',unit:'mm',format:[Math.min(mmW,mmH),Math.max(mmW,mmH)],compress:true});
      const dataUrl=mtResultCanvas.toDataURL('image/jpeg',qual);
      pdf.addImage(dataUrl,'JPEG',0,0,pdf.internal.pageSize.getWidth(),pdf.internal.pageSize.getHeight(),undefined,'FAST');
      saveBlob(pdf.output('blob'),'edited_doc.pdf');
    } else {
      const outMime=fmt==='png'?'image/png':'image/jpeg';
      const outUrl=mtResultCanvas.toDataURL(outMime,qual);
      const a=document.createElement('a');a.href=outUrl;a.download='edited_doc.'+(fmt==='png'?'png':'jpg');
      document.body.appendChild(a);a.click();a.remove();
    }
    toast(Lang.t('toastDownloaded'));
  }

  async function mtSendToApp() {
    const dataUrl=document.getElementById('mtPreview').src;
    if(!dataUrl||dataUrl.startsWith('data:,')){toast('Generate output first.','error');return;}
    // Hand off via IndexedDB (large quota) instead of localStorage (~5-10MB cap),
    // so the slot picker on app.html can receive the image even after a big crop/edit.
    const ok = await DSTransfer.save({src:dataUrl,name:'edited_doc'});
    if(!ok){
      toast('Image too large to transfer — try downloading instead.','error');
      return;
    }
    window.location.href='app.html';
  }

  /* =====================================================================
     BACKGROUND REMOVAL — MediaPipe Selfie Segmentation (100% local)
     ===================================================================== */
  let _mtBgMask = null;       // transparent cut-out canvas
  let _mtBgRestoreSnapshot = null; // exact image + edit state before BG removal
  let _mtBgColor = 'transparent'; // current fill colour
  let _mtBgMode = 'local';

  function mtSetBgMode(mode) {
    _mtBgMode = mode === 'local' ? 'local' : 'api';
    const status = document.getElementById('mtBgStatus');
    if (_mtBgMode === 'api') {
      const key = getRemoveBgApiKey();
      if (!key) {
        if (status) status.textContent = '⚠️ No API key saved yet. Click "Setup API Key" to add yours.';
      } else {
        if (status) status.textContent = 'remove.bg API selected. Uses your personal free credits (50/month).';
      }
    } else {
      if (status) status.textContent = 'Built-in local AI remover selected. Works offline, no API key needed.';
    }
  }

  async function removeBgWithApi(sourceCanvas) {
    const apiKey = getRemoveBgApiKey();
    if (!apiKey) {
      showRemoveBgSetup();
      throw new Error('No remove.bg API key saved. Please add your key first.');
    }

    const blob = await canvasToBlob(sourceCanvas, 'image/png');
    const form = new FormData();
    form.append('image_file', blob, 'docstitcher-current.png');
    // 'preview' uses your free monthly preview allowance (up to 0.25MP, plenty
    // for passport/ID photos). 'auto' tries full resolution and fails with a
    // 402 Insufficient Credits error on free-tier accounts with 0 paid credits,
    // which was silently triggering the fallback to the local remover.
    form.append('size', 'preview');
    form.append('format', 'png');

    let response;
    try {
      response = await fetch(REMOVE_BG_API_URL, {
        method: 'POST',
        headers: {'X-Api-Key': apiKey},
        body: form,
      });
    } catch (networkErr) {
      // fetch() throws a generic TypeError for network failures AND for CORS
      // preflight rejections — the browser never lets JS see the real reason.
      // Surface this distinctly so it isn't confused with an API-side error.
      const error = new Error(
        'Could not reach remove.bg from the browser (network error or blocked by CORS). ' +
        'Open DevTools → Network/Console tab and try again to confirm the exact cause — this ' +
        'call cannot succeed from client-side JS alone if remove.bg rejects the cross-origin request.'
      );
      error.isNetworkOrCors = true;
      error.cause = networkErr;
      throw error;
    }

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      let reason = `HTTP ${response.status}`;
      if (response.status === 403) reason = 'Authentication failed — API key is invalid';
      else if (response.status === 402) reason = 'Insufficient credits on your remove.bg account';
      else if (response.status === 429) reason = 'Rate limit exceeded';
      else if (response.status === 400) reason = 'Invalid request/image';
      const error = new Error(`remove.bg API failed: ${reason} (${response.status}). ${details}`.trim());
      error.status = response.status;
      throw error;
    }

    const result = await blobToCanvas(await response.blob());
    incrementRemoveBgUsage(); // count only on success
    return result;
  }
  window.removeBgWithApi = removeBgWithApi;

  async function removeBgWithLocal(sourceCanvas, onStatus) {
    if (onStatus) onStatus('Loading the built-in AI person detector...');
    return PersonBackground.remove(sourceCanvas, onStatus);
  }

  function bakeBackgroundResult() {
    const keepQuality = mtState.quality;
    const keepFormat = mtState.format;
    const keepMaxW = mtState.maxW;
    mtState = {rotateDeg:0,flipH:false,flipV:false,cropRect:null,quality:keepQuality,format:keepFormat,maxW:keepMaxW,hasCrop:false};
    mtCropDisplayRect = null;
    const cropBtn = document.getElementById('mtApplyCropBtn');
    if (cropBtn) cropBtn.classList.remove('active-state');
  }

  function _loadMediaPipe(cb) {
    if (window._mpSegmenter) { cb(window._mpSegmenter); return; }
    const status = document.getElementById('mtBgStatus');
    status.textContent = '⏳ Loading AI model (first time ~3 MB)…';

    // Load the MediaPipe selfie-segmentation solution
    function tryLoad() {
      if (typeof SelfieSegmentation !== 'undefined') {
        const seg = new SelfieSegmentation({locateFile: f =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}`
        });
        seg.setOptions({ modelSelection: 0 }); // Higher-detail model; works well for portraits and full body.
        seg.onResults(r => {
          if (window._mpSegCallback) window._mpSegCallback(r);
        });
        seg.initialize().then(() => {
          window._mpSegmenter = seg;
          status.textContent = '✅ AI model ready!';
          cb(seg);
        }).catch(e => {
          status.textContent = '❌ Model load failed: ' + e.message;
          const btn = document.getElementById('mtRemoveBgBtn');
          if (btn) { btn.disabled = false; btn.textContent = '✨ Remove Background'; }
        });
        return;
      }
      // Load script then retry
      if (!document.getElementById('mp-ss-script')) {
        const s = document.createElement('script');
        s.id = 'mp-ss-script';
        s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/selfie_segmentation.js';
        s.crossOrigin = 'anonymous';
        s.onload = () => tryLoad();
        s.onerror = () => {
          status.textContent = '❌ Failed to load AI files. Check your internet and try again.';
          const btn = document.getElementById('mtRemoveBgBtn');
          if (btn) { btn.disabled = false; btn.textContent = '✨ Remove Background'; }
        };
        document.head.appendChild(s);
      }
    }
    tryLoad();
  }

  async function mtRemoveBg() {
    if (!mtOrigImg) { toast('Upload an image first.', 'error'); return; }
    const btn = document.getElementById('mtRemoveBgBtn');
    const status = document.getElementById('mtBgStatus');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      const baseImage = _mtBgRestoreSnapshot ? _mtBgRestoreSnapshot.img : mtOrigImg;
      const baseState = _mtBgRestoreSnapshot ? _mtBgRestoreSnapshot.state : mtState;
      const sourceCanvas = buildMtEditedSourceCanvas(baseImage, baseState);
      if (!sourceCanvas) throw new Error('Could not prepare the current image.');

      if (!_mtBgRestoreSnapshot) {
        _mtBgRestoreSnapshot = {
          img: mtOrigImg,
          state: cloneMtState(mtState),
          cropDisplayRect: mtCropDisplayRect ? {...mtCropDisplayRect} : null,
        };
      }

      const mode = document.getElementById('mtBgMode')?.value || _mtBgMode;
      if (mode === 'api') {
        status.textContent = 'Uploading the current edited image to remove.bg...';
        try {
          _mtBgMask = await removeBgWithApi(sourceCanvas);
        } catch (apiError) {
          console.warn(apiError);
          toast('remove.bg: ' + apiError.message, 'error');
          status.textContent = `remove.bg failed (${apiError.message}). Switching to the built-in local remover...`;
          _mtBgMask = await removeBgWithLocal(sourceCanvas, message => { status.textContent = message; });
        }
      } else {
        _mtBgMask = await removeBgWithLocal(sourceCanvas, message => { status.textContent = message; });
      }

      _mtBgColor = 'transparent';
      bakeBackgroundResult();
      _applyBgFill(_mtBgColor);

      document.getElementById('mtBgColorRow').style.display = 'block';
      document.getElementById('mtRestoreBgBtn').style.display = 'inline-flex';
      status.textContent = 'Background removed from the current edited image. Pick a fill colour below, or keep transparent.';
      btn.textContent = 'Re-run Removal';
    } catch(e) {
      status.textContent = 'Error: ' + e.message;
      console.error(e);
    } finally {
      btn.disabled = false;
    }
  }

  function _applyBgFill(color) {
    if (!_mtBgMask) return;
    const W = _mtBgMask.width, H = _mtBgMask.height;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');

    if (color !== 'transparent') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
    }

    // Draw the cut-out (person with alpha) on top
    if (_mtBgMask instanceof HTMLCanvasElement) {
      ctx.drawImage(_mtBgMask, 0, 0);
    } else {
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').putImageData(_mtBgMask, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    }

    // Replace mtOrigImg with result
    const dataUrl = out.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = () => {
      mtOrigImg = newImg;
      // Force PNG format so transparency is preserved when colour = transparent
      if (color === 'transparent') {
        document.getElementById('mtFmt').value = 'png';
        mtState.format = 'png';
      }
      document.getElementById('mtOrigDims').textContent = newImg.naturalWidth + 'x' + newImg.naturalHeight;
      renderMultiTool();
      setTimeout(bindMtCropEvents, 50);
    };
    newImg.src = dataUrl;
  }

  function mtFillBg(color, btn) {
    _mtBgColor = color;
    // Update active state on colour buttons
    document.querySelectorAll('.bg-fill-btn').forEach(b => b.style.border = '2px solid var(--border)');
    if (btn) btn.style.border = '2px solid var(--accent)';
    _applyBgFill(color);
  }

  function mtFillBgCustom(color) {
    _mtBgColor = color;
    document.querySelectorAll('.bg-fill-btn').forEach(b => b.style.border = '2px solid var(--border)');
    _applyBgFill(color);
  }

  function mtRestoreBg() {
    if (!_mtBgRestoreSnapshot) return;
    mtOrigImg = _mtBgRestoreSnapshot.img;
    mtState = cloneMtState(_mtBgRestoreSnapshot.state);
    mtCropDisplayRect = _mtBgRestoreSnapshot.cropDisplayRect ? {..._mtBgRestoreSnapshot.cropDisplayRect} : null;
    _mtBgRestoreSnapshot = null;
    _mtBgMask = null;
    _mtBgColor = 'transparent';
    document.getElementById('mtBgColorRow').style.display = 'none';
    document.getElementById('mtRestoreBgBtn').style.display = 'none';
    document.getElementById('mtBgStatus').textContent = '';
    document.getElementById('mtFmt').value = mtState.format;
    document.getElementById('mtQual').value = mtState.quality;
    document.getElementById('mtQualLabel').textContent = mtState.quality + '%';
    document.getElementById('mtMaxW').value = mtState.maxW;
    document.getElementById('mtMaxWLabel').textContent = mtState.maxW === 0 ? 'Original' : mtState.maxW + 'px';
    document.getElementById('mtOrigDims').textContent = (mtOrigImg.naturalWidth || mtOrigImg.width) + 'x' + (mtOrigImg.naturalHeight || mtOrigImg.height);
    renderMultiTool();
    setTimeout(bindMtCropEvents, 50);
    toast('Original image restored.');
  }
  /* ===== END BACKGROUND REMOVAL ===== */

  function clearMultiTool() {
    mtOrigFile=null;mtOrigImg=null;mtCropDisplayRect=null;
    _mtBgMask=null;_mtBgRestoreSnapshot=null;_mtBgColor='transparent';
    mtState={rotateDeg:0,flipH:false,flipV:false,cropRect:null,quality:85,format:'jpeg',maxW:0,hasCrop:false};
    mtResultCanvas=document.createElement('canvas');
    document.getElementById('mtPlaceholder').style.display='flex';
    document.getElementById('mtDrop').style.display='flex';
    document.getElementById('mtEditor').style.display='none';
    document.getElementById('mtInput').value='';
    const cr=document.getElementById('mtBgColorRow'); if(cr) cr.style.display='none';
    const rb=document.getElementById('mtRestoreBgBtn'); if(rb) rb.style.display='none';
    const st=document.getElementById('mtBgStatus'); if(st) st.textContent='';
    // The Live Preview panel (image + stats) lives outside #mtEditor and stays visible
    // at all times, so it must be reset explicitly or the old photo/numbers linger.
    const prev=document.getElementById('mtPreview'); if(prev) prev.removeAttribute('src');
    const previewEmpty=document.getElementById('mtPreviewEmpty'); if(previewEmpty) previewEmpty.style.display='flex';
    const previewActive=document.getElementById('mtPreviewActive'); if(previewActive) previewActive.style.display='none';
    const statsBlock=document.getElementById('mtStatsBlock'); if(statsBlock) statsBlock.style.display='none';
    const origSize=document.getElementById('mtOrigSize'); if(origSize) origSize.textContent='-';
    const origDims=document.getElementById('mtOrigDims'); if(origDims) origDims.textContent='-';
    const newSize=document.getElementById('mtNewSize'); if(newSize) newSize.textContent='-';
    const newDims=document.getElementById('mtNewDims'); if(newDims) newDims.textContent='-';
    const qualEst=document.getElementById('mtQualSizeEst'); if(qualEst) qualEst.textContent='≈ estimated size: -';
    localStorage.removeItem(MT_STORAGE_KEY);
  }

  // "Clear Page" — same as clearMultiTool but with a confirmation prompt since
  // it's a bigger, more visible/destructive action triggered from the red button.
  function clearMultiToolPage() {
    if (!mtOrigImg) { toast('Nothing to clear.'); return; }
    if (!confirm('Clear this image and all edits? This cannot be undone.')) return;
    clearMultiTool();
    toast('Page cleared');
  }

  /* ---- WATERMARK (keep existing) ---- */
  let wmImg=null;
  function loadWmImg(file){
    if(!file||!file.type.startsWith('image/')){toast(Lang.t('toastSelectImgWm'),'error');return;}
    const r=new FileReader();
    r.onload=e=>{wmImg=new Image();wmImg.onload=()=>{
      document.getElementById('wmPlaceholder').style.display='none';
      document.getElementById('wmDrop').style.display='none';
      document.getElementById('wmEditor').style.display='block';
      updateWmPreview();
    };wmImg.src=e.target.result;};
    r.readAsDataURL(file);
  }
  function updateWmSizeLabel(){const v=document.getElementById('wmSize').value;document.getElementById('wmSizeLabel').textContent=v+'px';upSlider(document.getElementById('wmSize'));}
  function updateWmOpLabel(){const v=document.getElementById('wmOp').value;document.getElementById('wmOpLabel').textContent=v+'%';upSlider(document.getElementById('wmOp'));}
  function updateWmRotLabel(){const v=document.getElementById('wmRot').value;document.getElementById('wmRotLabel').textContent=v+' deg';upSlider(document.getElementById('wmRot'));}
  function updateWmPreview(){
    if(!wmImg)return;
    const text=document.getElementById('wmText').value||'WATERMARK';
    const pos=document.getElementById('wmPos').value;
    const size=parseInt(document.getElementById('wmSize').value);
    const op=parseInt(document.getElementById('wmOp').value)/100;
    const rot=parseInt(document.getElementById('wmRot').value)*Math.PI/180;
    const color=document.getElementById('wmColor').value;
    const c=document.createElement('canvas');
    c.width=wmImg.naturalWidth;c.height=wmImg.naturalHeight;
    const ctx=c.getContext('2d');
    ctx.drawImage(wmImg,0,0);
    ctx.globalAlpha=op;ctx.font=`bold ${size}px sans-serif`;ctx.fillStyle=color;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const drawText=(x,y)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.fillText(text,0,0);ctx.restore();};
    const w=c.width,h=c.height;
    if(pos==='center') drawText(w/2,h/2);
    else if(pos==='tile'){const stepX=Math.max(200,ctx.measureText(text).width+size*2),stepY=size*3;for(let y=0;y<h+stepY;y+=stepY)for(let x=0;x<w+stepX;x+=stepX)drawText(x,y);}
    else{const pad=size;const pos2={topleft:[pad,pad],topright:[w-pad,pad],bottomleft:[pad,h-pad],bottomright:[w-pad,h-pad]};drawText(...pos2[pos]);}
    ctx.globalAlpha=1;
    document.getElementById('wmOutImg').src=c.toDataURL('image/jpeg',0.92);
  }
  async function downloadWatermarked(){
    const fmt=await showDownloadPicker(Lang.t('dlPickerTitle'));
    if(!fmt)return;
    const src=document.getElementById('wmOutImg').src;if(!src)return;
    if(fmt==='pdf'){
      if(!window.jspdf||!window.jspdf.jsPDF){toast(Lang.t('toastPdfLibNotLoaded'),'error');return;}
      const img=document.getElementById('wmOutImg');
      const mmW=img.naturalWidth*0.2646,mmH=img.naturalHeight*0.2646;
      const {jsPDF}=window.jspdf;
      const isPort=mmH>=mmW;
      const pdf=new jsPDF({orientation:isPort?'portrait':'landscape',unit:'mm',format:[Math.min(mmW,mmH),Math.max(mmW,mmH)],compress:true});
      pdf.addImage(src,'JPEG',0,0,pdf.internal.pageSize.getWidth(),pdf.internal.pageSize.getHeight(),undefined,'FAST');
      saveBlob(pdf.output('blob'),'watermarked.pdf');
    } else {
      const outMime=fmt==='png'?'image/png':'image/jpeg';
      const c=document.createElement('canvas');c.width=wmImg.naturalWidth;c.height=wmImg.naturalHeight;
      c.getContext('2d').drawImage(document.getElementById('wmOutImg'),0,0);
      const a=document.createElement('a');a.href=c.toDataURL(outMime,0.92);a.download='watermarked.'+(fmt==='png'?'png':'jpg');
      document.body.appendChild(a);a.click();a.remove();
    }
    toast('Downloaded!');
  }
  async function wmSendToApp(){
    const outImg = document.getElementById('wmOutImg');
    if(!outImg || !outImg.src || outImg.src === window.location.href || outImg.src.startsWith('data:,')){
      toast('Apply a watermark first.','error'); return;
    }
    const ok = await DSTransfer.save({src: outImg.src, name: 'watermarked_doc'});
    if(!ok){
      toast('Image too large to transfer — try downloading instead.','error'); return;
    }
    window.location.href = 'app.html';
  }
  /* ============================================================
     MULTI-TOOL PERSISTENCE
     Save the original image + current edit settings to localStorage
     so work survives tab switches, navigation to app.html, etc.
  ============================================================ */
  const MT_STORAGE_KEY = 'ds_mt_v1';

  function saveMtState() {
    if (!mtOrigImg) return;
    try {
      // Get the original image as a data URL from the img element src
      // (it was loaded via FileReader so .src is already a data URL)
      const origSrc = mtOrigImg.src;
      if (!origSrc || !origSrc.startsWith('data:')) return;
      localStorage.setItem(MT_STORAGE_KEY, JSON.stringify({
        origSrc,
        origName: mtOrigFile ? mtOrigFile.name : 'image.jpg',
        origSize: mtOrigFile ? mtOrigFile.size : 0,
        state: Object.assign({}, mtState),
      }));
    } catch(e) { console.warn('saveMtState failed:', e); }
  }

  function restoreMtState() {
    // Only restore on the tools page
    if (!document.getElementById('mtEditor')) return;
    try {
      const raw = localStorage.getItem(MT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !saved.origSrc) return;
      const img = new Image();
      img.onload = () => {
        const mime = (saved.origSrc.match(/^data:([^;]+);/) || [])[1] || 'image/jpeg';
        const fakeFile = new File([], saved.origName || 'image.jpg', { type: mime });
        Object.defineProperty(fakeFile, 'size', { value: saved.origSize || 0 });
        mtOrigFile = fakeFile;
        mtOrigImg  = img;
        if (saved.state) Object.assign(mtState, saved.state);
        // Show editor
        const ph = document.getElementById('mtPlaceholder');
        const dz = document.getElementById('mtDrop');
        const ed = document.getElementById('mtEditor');
        if (ph) ph.style.display = 'none';
        if (dz) dz.style.display = 'none';
        if (ed) ed.style.display = 'block';
        const previewEmpty = document.getElementById('mtPreviewEmpty'); if (previewEmpty) previewEmpty.style.display = 'none';
        const previewActive = document.getElementById('mtPreviewActive'); if (previewActive) previewActive.style.display = 'block';
        // Sync info labels
        const szEl = document.getElementById('mtOrigSize');
        const dmEl = document.getElementById('mtOrigDims');
        if (szEl) szEl.textContent = fmtBytes(saved.origSize || 0);
        if (dmEl) dmEl.textContent = img.naturalWidth + '×' + img.naturalHeight;
        // Sync controls to restored state
        mtSyncRotationControl();
        const bSlider = document.getElementById('mtBrightness');
        if (bSlider) { bSlider.value = mtState.brightness || 0; upSlider(bSlider); }
        const bLbl = document.getElementById('mtBrightnessLabel');
        if (bLbl) bLbl.textContent = (mtState.brightness || 0);
        const fmtEl = document.getElementById('mtFmt');
        if (fmtEl) fmtEl.value = mtState.format || 'jpeg';
        const qualEl = document.getElementById('mtQual');
        if (qualEl) { qualEl.value = mtState.quality || 85; upSlider(qualEl); }
        const qualLbl = document.getElementById('mtQualLabel');
        if (qualLbl) qualLbl.textContent = (mtState.quality || 85) + '%';
        const maxWEl = document.getElementById('mtMaxW');
        if (maxWEl) { maxWEl.value = mtState.maxW || ''; upSlider(maxWEl); }
        renderMultiTool();
        setTimeout(bindMtCropEvents, 100);
      };
      img.onerror = () => localStorage.removeItem(MT_STORAGE_KEY);
      img.src = saved.origSrc;
    } catch(e) {
      console.warn('restoreMtState failed:', e);
      localStorage.removeItem(MT_STORAGE_KEY);
    }
  }

  function clearWatermark(){
    wmImg=null;
    document.getElementById('wmPlaceholder').style.display='flex';
    document.getElementById('wmDrop').style.display='flex';
    document.getElementById('wmEditor').style.display='none';
    document.getElementById('wmInput').value='';
  }

  // "Clear Page" — same as clearWatermark but with a confirmation prompt.
  function clearWatermarkPage() {
    if (!wmImg) { toast('Nothing to clear.'); return; }
    if (!confirm('Clear this image and watermark settings? This cannot be undone.')) return;
    clearWatermark();
    toast('Page cleared');
  }

  // Init after DOM loaded
  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(()=>{
      const cv=document.getElementById('mtCropCanvas');
      if(cv) bindMtCropEvents();
      restoreMtState();
    }, 500);
  });

  return {
    toast,fmtBytes,switchTab,dzDrag,dzLeave,dzDrop,
    loadMultiToolFile,mtRotate,mtSetRotation,mtFlip,mtApplyCrop,mtClearCrop,
    mtSetQuality,mtSetFormat,mtSetMaxW,mtReset,mtDownload,mtSendToApp,clearMultiTool,clearMultiToolPage,
    loadWmImg,updateWmSizeLabel,updateWmOpLabel,updateWmRotLabel,updateWmPreview,downloadWatermarked,clearWatermark,clearWatermarkPage,wmSendToApp,
    bindMtCropEvents,
    mtSizeChanged,mtSizeUnitChanged,mtApplySizePreset,mtClearSize,
    setA4Orient,setA4Corner,setA4ImgDir,a4CountDelta,a4Preview,downloadA4PDF,
    setA4PaperSize,setA4CustomDim,getA4PageDims,
    mtSetBrightness,
    mtRemoveBg,mtSetBgMode,mtFillBg,mtFillBgCustom,mtRestoreBg,
    // Bulk PDF Builder
    bpAddFiles,bpDzDrop,bpDelete,bpMove,bpSortByName,bpReverseOrder,bpClearAll,clearBulkPdfPage,
    bpLbOpen,bpLbNav,bpLbMove,bpLbDelete,bpLbClose,
    bpDownloadPDF,
    // PDF Compressor
    pcLoadFile,pcDzDrop,pcUpdateQualLabel,pcTargetChanged,pcApplyTarget,pcDownload,pcClear,
    loadCompressImg:(f)=>loadMultiToolFile(f),
    loadCropImg:(f)=>loadMultiToolFile(f),
    loadRotateImg:(f)=>loadMultiToolFile(f),
    loadConvertImg:(f)=>loadMultiToolFile(f),
  };
})();

/* ============================================================
   SERVICE WORKER
============================================================ */
if('serviceWorker'in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
  });
}

/* Shared automatic person cut-out service for the Multi-Person editor. */
const PersonBackground = (() => {
  let loadPromise = null;
  let queue = Promise.resolve();

  function load() {
    if (window._mpSegmenter) return Promise.resolve(window._mpSegmenter);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const start = () => {
        try {
          const segmenter = new SelfieSegmentation({locateFile: file =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`
          });
          segmenter.setOptions({modelSelection:0});
          segmenter.onResults(results => {
            if (window._mpSegCallback) window._mpSegCallback(results);
          });
          segmenter.initialize().then(() => {
            window._mpSegmenter = segmenter;
            resolve(segmenter);
          }, reject);
        } catch (error) { reject(error); }
      };
      if (typeof SelfieSegmentation !== 'undefined') { start(); return; }
      let script = document.getElementById('mp-ss-script');
      if (!script) {
        script = document.createElement('script');
        script.id = 'mp-ss-script';
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/selfie_segmentation.js';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }
      script.addEventListener('load', start, {once:true});
      script.addEventListener('error', () => reject(new Error('AI files could not be loaded. Check your internet connection.')), {once:true});
    }).catch(error => { loadPromise = null; throw error; });
    return loadPromise;
  }

  function removeNow(image, onStatus) {
    return load().then(segmenter => new Promise((resolve, reject) => {
      if (onStatus) onStatus('Detecting person and body…');
      const source = document.createElement('canvas');
      source.width = image.naturalWidth || image.width;
      source.height = image.naturalHeight || image.height;
      source.getContext('2d').drawImage(image, 0, 0, source.width, source.height);
      const timer = setTimeout(() => {
        window._mpSegCallback = null;
        reject(new Error('Person detection timed out. Please try again.'));
      }, 30000);
      window._mpSegCallback = results => {
        clearTimeout(timer);
        window._mpSegCallback = null;
        try {
          if (onStatus) onStatus('Refining hair, clothing and edge detail…');
          const cutout = createPrecisePersonCutout(source, results.segmentationMask);
          resolve(cutout);
        } catch (error) { reject(error); }
      };
      Promise.resolve(segmenter.send({image:source})).catch(error => {
        clearTimeout(timer);
        window._mpSegCallback = null;
        reject(error);
      });
    }));
  }

  function remove(image, onStatus) {
    const task = queue.then(() => removeNow(image, onStatus));
    queue = task.catch(() => {});
    return task;
  }

  function fill(cutout, color) {
    const canvas = document.createElement('canvas');
    canvas.width = cutout.width; canvas.height = cutout.height;
    const ctx = canvas.getContext('2d');
    if (color !== 'transparent') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(cutout, 0, 0);
    return canvas;
  }
  return {remove, fill};
})();

/* ============================================================
   MULTI-PERSON A4 MODULE
   Up to 4 persons, each with own image + crop/rotate/flip/resize.
   All placed together on one A4 sheet.
============================================================ */
const mp = (() => {
  // LOW-END PC FIX: cap how many pixels we ever put in a working canvas.
  // navigator.deviceMemory (Chrome/Edge) reports approx RAM in GB when available.
  // On 1-2GB RAM / old Windows 7 machines we cut the cap hard so rotate+crop
  // canvases never get big enough to hang the tab. Falls back to a safe
  // middle-ground cap when the browser doesn't expose deviceMemory at all.
  function getPersonMaxPixels() {
    const mem = navigator.deviceMemory; // GB, undefined on many browsers
    if (mem && mem <= 2) return 4 * 1024 * 1024;   // ~4MP — very low RAM
    if (mem && mem <= 4) return 8 * 1024 * 1024;   // ~8MP — low RAM
    return 16 * 1024 * 1024;                       // default cap
  }

  let personCount = 1;
  let orient = 'portrait';   // matches HTML default (Portrait button has 'active' class)
  let mpPaperSize = 'a4';    // matches HTML default (A4 button has 'active' class)
  let mpCustomPW = 210, mpCustomPH = 297;
  let mpImgDir = 'row';   // 'row' | 'col'
  let mpCorner = 'tl';    // 'tl' | 'tr' | 'bl' | 'br'
  let persons = []; // [{img, canvas, state, cropRect, cropDisplayRect, displayScale, dragging, startX, startY}]
  // RAF handle for the single-photo quality-slider size estimate — dedups so
  // dragging the slider doesn't re-encode a JPEG on every 'input' tick,
  // just once per animation frame (same low-end-PC-safe pattern used elsewhere).
  let _mpQualRafId = null;

  // Paper sizes [width_mm, height_mm] — portrait base dimensions
  const MP_PAPER_SIZES = {
    'a4':     [210,   297  ],   // ISO A4 — most common India gov forms
    'a5':     [148,   210  ],   // ISO A5 — half of A4
    '4x6':    [101.6, 152.4],   // 4R — most popular Indian photo studio print
    '5x7':    [127,   177.8],   // 5R — common family/school photo size
    '3x5':    [76.2,  127  ],   // 3R — smaller print, ID cards
    'letter': [215.9, 279.4],   // US Letter — common in Indian offices & banks
    'legal':  [215.9, 355.6],   // Legal — used in Indian courts & legal docs
    'custom': null,
  };

  // Default photo dimensions per paper size [widthCm, heightCm]
  const MP_DEFAULT_PHOTO = {
    'a4':     [2.5, 3.0],
    'a5':     [2.5, 3.0],
    '4x6':    [3.5, 4.5],
    '5x7':    [3.5, 4.5],
    '3x5':    [2.5, 3.0],
    'letter': [2.5, 3.0],
    'legal':  [2.5, 3.0],
    'custom': [2.5, 3.0],
  };

  function getMpPageDims(){
    let bW, bH;
    if(mpPaperSize==='custom'){bW=mpCustomPW||210;bH=mpCustomPH||297;}
    else{const b=MP_PAPER_SIZES[mpPaperSize]||[210,297];bW=b[0];bH=b[1];}
    if(orient==='landscape') return {pW:Math.max(bW,bH),pH:Math.min(bW,bH)};
    return {pW:Math.min(bW,bH),pH:Math.max(bW,bH)};
  }

  function setMpPaperSize(sz){
    mpPaperSize = sz;
    const cr = document.getElementById('mpCustomSizeRow');
    if(cr) cr.style.display = (sz === 'custom') ? 'flex' : 'none';
    Object.keys(MP_PAPER_SIZES).forEach(k => {
      const el = document.getElementById('mpPaper_' + k);
      if(el) el.classList.toggle('active', k === sz);
    });
    // Auto-set photo size to a sensible default for this paper
    const def = MP_DEFAULT_PHOTO[sz] || [2.5, 3.0];
    const [wCm, hCm] = def;
    persons.slice(0, personCount).forEach((p, pi) => {
      p.state.sizeWmm = wCm * 10;
      p.state.sizeHmm = hCm * 10;
      const wEl = document.getElementById('mpW' + pi);
      const hEl = document.getElementById('mpH' + pi);
      if(wEl) wEl.value = wCm.toFixed(1);
      if(hEl) hEl.value = hCm.toFixed(1);
    });
    refreshPreview();
  }

  function makePersonTransformedCanvas(image, state) {
    const deg = Number(state.rotateDeg || 0);
    const rad = deg * Math.PI / 180;
    const srcW = image.naturalWidth || image.width;
    const srcH = image.naturalHeight || image.height;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const outW = Math.max(1, Math.ceil(srcW * cos + srcH * sin));
    const outH = Math.max(1, Math.ceil(srcW * sin + srcH * cos));

    // LOW-END PC FIX: this used to allocate a full-resolution rotated canvas
    // with NO ceiling. A normal 12-20MP phone photo would try to allocate a
    // huge canvas (plus another one for the crop preview) — on a 1-2GB RAM
    // Windows 7 PC that is exactly what hangs/freezes the tab when cropping
    // in Photo Maker. Passport/ID photo output never needs more than a few
    // MP even at print DPI, so capping here costs nothing in real quality.
    const MAX_PIXELS = getPersonMaxPixels();
    const pixelCount = outW * outH;
    let drawScale = 1;
    if (pixelCount > MAX_PIXELS) {
      drawScale = Math.sqrt(MAX_PIXELS / pixelCount);
    }
    const cW = Math.max(1, Math.round(outW * drawScale));
    const cH = Math.max(1, Math.round(outH * drawScale));

    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(cW / 2, cH / 2);
    ctx.rotate(rad);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
    ctx.drawImage(image, -srcW * drawScale / 2, -srcH * drawScale / 2, srcW * drawScale, srcH * drawScale);
    ctx.restore();
    return canvas;
  }

  function syncRotationControl(pi) {
    const p = persons[pi];
    if (!p) return;
    const val = Math.round((Number(p.state.rotateDeg)||0) * 10) / 10;
    const input = document.getElementById('mpRotFine' + pi);
    const label = document.getElementById('mpRotFineLabel' + pi);
    if (input) input.value = val;
    if (label) label.textContent = val + ' deg';
  }

  function setMpCustomDim(){
    const wEl=document.getElementById('mpCustomPW'),hEl=document.getElementById('mpCustomPH');
    if(wEl) mpCustomPW=parseFloat(wEl.value)||210;
    if(hEl) mpCustomPH=parseFloat(hEl.value)||297;
    refreshPreview();
  }

  function setMpImgDir(d){
    mpImgDir=d;
    const rBtn=document.getElementById('mpDirRow');
    const cBtn=document.getElementById('mpDirCol');
    if(rBtn){ rBtn.classList.remove('active'); if(d==='row') rBtn.classList.add('active'); }
    if(cBtn){ cBtn.classList.remove('active'); if(d==='col') cBtn.classList.add('active'); }
    refreshPreview();
  }

  function setMpCorner(c){
    mpCorner=c;
    ['tl','tr','bl','br'].forEach(k=>{
      const el=document.getElementById('mpCorner_'+k);
      if(el) el.classList.toggle('active',k===c);
    });
    refreshPreview();
  }

  function init() {
    // Build persons array
    persons = Array.from({length:4}, () => ({
      img: null, originalImg: null, canvas: null, resultCanvas: null,
      bgCutout: null, bgColor: 'transparent', bgStatus: '', bgBusy: false, bgMode: 'local',
      state: freshState(),
      cropDisplayRect: null, displayScale: 1,
      dragging: false, startX: 0, startY: 0,
      count: 4,
      cachedRotC: null  // cached rotated canvas — reused during crop drag to avoid per-frame re-render on slow PCs
    }));
    // Sync button active states with JS defaults (portrait + a4)
    setOrient(orient);
    setMpPaperSize(mpPaperSize);
    setPersonCount(1);
  }

  function freshState() {
    return {rotateDeg:0, flipH:false, flipV:false, cropRect:null, quality:85,
            hasCrop:false, sizeWmm:25, sizeHmm:30, photoCount:4, brightness:0};
  }

  function setPersonCount(n) {
    personCount = n;
    [1,2,3,4].forEach(i => {
      const btn = document.getElementById('mpCount'+i);
      if(btn) btn.classList.toggle('active', i===n);
    });
    // Update person selector visibility in zoom card
    const sel = document.getElementById('mpSingleImgSelector');
    if (sel) {
      sel.style.display = n > 1 ? 'block' : 'none';
      // Rebuild options to match active persons
      sel.innerHTML = Array.from({length: n}, (_,i) => `<option value="${i}">Person ${i+1}</option>`).join('');
    }
    renderPersonCards();
    refreshPreview();
  }

  function setOrient(o) {
    orient = o;
    document.getElementById('mpOrientPortrait').classList.toggle('active', o==='portrait');
    document.getElementById('mpOrientLandscape').classList.toggle('active', o==='landscape');
    refreshPreview();
  }

  function renderPersonCards() {
    const container = document.getElementById('mpPersonsContainer');
    if (!container) return;
    // Determine grid layout
    const cols = personCount <= 1 ? 1 : 2;
    container.style.gridTemplateColumns = cols > 1 ? '1fr 1fr' : '1fr';
    container.innerHTML = '';

    for (let pi = 0; pi < personCount; pi++) {
      const p = persons[pi];
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'padding:18px;position:relative';
      card.innerHTML = `
        <div style="font-weight:700;font-size:13px;margin-bottom:12px;color:var(--accent)">
          👤 Person ${pi+1}
        </div>
        ${p.img ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;justify-content:center">
            <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="mp.rotate(${pi},-90)">↺ 90°L</button>
            <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="mp.rotate(${pi},90)">↻ 90°R</button>
            <input type="number" id="mpRotFine${pi}" value="${Math.round((p.state.rotateDeg||0)*10)/10}" step="0.5" min="-45" max="45" style="width:62px;padding:5px 7px;border:1.5px solid var(--border);border-radius:7px;font-size:11px" oninput="mp.setRotation(${pi},this.value)">
            <span id="mpRotFineLabel${pi}" style="font-size:11px;color:var(--text-muted);min-width:40px">${Math.round((p.state.rotateDeg||0)*10)/10} deg</span>
            <button class="btn-ghost"     style="font-size:11px;padding:5px 10px;color:var(--danger)" onclick="mp.clearPerson(${pi})">✕ Clear</button>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;text-align:center">Step 1: Drag on image to crop</div>
          <div id="mpCropWrap${pi}" style="overflow:hidden;border-radius:8px;line-height:0;display:block;">
          <canvas id="mpCropCanvas${pi}" style="display:block;margin:0;border-radius:8px;cursor:crosshair;"></canvas>
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;justify-content:center">
            <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="mp.applyCrop(${pi})">✂ Apply Crop</button>
            <button class="btn-ghost"     style="font-size:11px;padding:5px 10px" onclick="mp.clearCrop(${pi})">Clear Crop</button>
          </div>
          <div class="mp-bg-tools">
            <div class="mp-bg-heading"><span>Step 2: ✂️ Remove Background (Optional)</span><span class="passport-optional-badge">Optional</span></div>
            <div class="mp-bg-method">
              <label class="ctrl-label" for="mpBgMode${pi}">Removal Method</label>
              <select class="ctrl-select" id="mpBgMode${pi}" ${p.bgBusy?'disabled':''} onchange="mp.setBgMode(${pi},this.value)">
                <option value="local" ${p.bgMode!=='api'?'selected':''}>🤖 Built-in Local AI (free, Unlimited)</option>
                <option value="api" ${p.bgMode==='api'?'selected':''}>☁️ remove.bg API (your key, 50 free previews/month)</option>
              </select>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 4px">
              <span class="ds-removebg-key-status" style="font-size:11px"></span>
              <button onclick="showRemoveBgSetup()" style="font-size:10.5px;padding:3px 10px;border-radius:7px;border:1.5px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-weight:600">⚙ Setup Key</button>
            </div>
            <div class="ds-removebg-counter" style="font-size:11px;color:var(--text-muted);margin-bottom:8px;padding:5px 10px;background:var(--surface);border-radius:7px;border:1px solid var(--border)"></div>
            <div class="mp-bg-actions">
              <button class="btn-primary mp-remove-bg" ${p.bgBusy?'disabled':''} onclick="mp.removeBg(${pi})">${p.bgBusy?'⏳ Working…':'✨ Remove BG'}</button>
              ${p.originalImg ? `<button class="btn-ghost mp-restore-bg" onclick="mp.restoreBg(${pi})">↩ Restore</button>` : ''}
            </div>
            <div class="mp-bg-status ${p.bgStatus.startsWith('Error:')?'error':''}" id="mpBgStatus${pi}">${p.bgStatus}</div>
            ${p.bgCutout ? `<div class="mp-bg-palette" aria-label="Background colour">
              <button class="mp-bg-swatch checker ${p.bgColor==='transparent'?'active':''}" title="Transparent" onclick="mp.fillBg(${pi},'transparent')"></button>
              <button class="mp-bg-swatch ${p.bgColor==='#ffffff'?'active':''}" style="--swatch:#ffffff" title="White" onclick="mp.fillBg(${pi},'#ffffff')"></button>
              <button class="mp-bg-swatch ${p.bgColor==='#87CEEB'?'active':''}" style="--swatch:#87CEEB" title="Sky blue" onclick="mp.fillBg(${pi},'#87CEEB')"></button>
              <button class="mp-bg-swatch ${p.bgColor==='#b0d4f1'?'active':''}" style="--swatch:#b0d4f1" title="Light blue" onclick="mp.fillBg(${pi},'#b0d4f1')"></button>
              <button class="mp-bg-swatch ${p.bgColor==='#eeeeee'?'active':''}" style="--swatch:#eeeeee" title="Light grey" onclick="mp.fillBg(${pi},'#eeeeee')"></button>
              <label class="mp-bg-custom" title="Custom colour">🎨<input type="color" value="${p.bgColor==='transparent'?'#4a90d9':p.bgColor}" oninput="mp.fillBg(${pi},this.value)"></label>
            </div>` : ''}
          </div>
          <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span style="font-size:11.5px;color:var(--text-muted);font-weight:700">Step 3 — Size:</span>
            <button class="btn-secondary size-preset-btn" onclick="mp.setSize(${pi},2.5,3,'cm')">2.5×3cm</button>
            <button class="btn-secondary size-preset-btn" onclick="mp.setSize(${pi},50.8,50.8,'mm')">2×2in</button>
            <input type="number" id="mpW${pi}" value="${(p.state.sizeWmm/10).toFixed(1)}" step="0.1" min="0.5" max="10" style="width:54px;padding:4px 6px;border:1.5px solid var(--border);border-radius:7px;font-size:12px" oninput="mp.setSizeRaw(${pi})">
            <span style="font-size:11px">×</span>
            <input type="number" id="mpH${pi}" value="${(p.state.sizeHmm/10).toFixed(1)}" step="0.1" min="0.5" max="12" style="width:54px;padding:4px 6px;border:1.5px solid var(--border);border-radius:7px;font-size:12px" oninput="mp.setSizeRaw(${pi})">
            <span style="font-size:11px;color:var(--text-muted)">cm</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;align-items:center">
            <span style="font-size:11.5px;color:var(--text-muted)">Photos on A4:</span>
            <button class="a4-count-btn" style="width:28px;height:28px;font-size:13px" onclick="mp.deltaCount(${pi},-1)">−</button>
            <span id="mpPhCount${pi}" style="font-weight:700;color:var(--accent);min-width:20px;text-align:center">${p.state.photoCount}</span>
            <button class="a4-count-btn" style="width:28px;height:28px;font-size:13px" onclick="mp.deltaCount(${pi},1)">+</button>
          </div>
          <div style="margin-top:10px">
            <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:4px">☀️ Photo Enhancement</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="range" id="mpBrightness${pi}" min="-100" max="100" value="${p.state.brightness||0}" step="1"
                oninput="mp.mpSetBrightness(${pi},this.value)"
                style="flex:1;accent-color:var(--accent)">
              <span id="mpBrightnessLabel${pi}" style="font-size:11px;font-weight:600;min-width:28px;color:var(--accent)">${(p.state.brightness||0)>=0?'+'+( p.state.brightness||0):(p.state.brightness||0)}</span>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Darken ← 0 = Original → Enhance</div>
          </div>
          <div style="margin-top:8px">
            <img id="mpPreview${pi}" alt="Person ${pi+1} preview" style="max-width:100%;border-radius:6px;border:1px solid var(--border);object-fit:contain;display:block">
          </div>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">⬇ Download Edited Image</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn-primary" style="font-size:11.5px;padding:6px 14px;background:linear-gradient(135deg,#6c63ff,#4a90d9)" onclick="mp.downloadSingleImage(${pi},'jpeg')">
                JPG
              </button>
              <button class="btn-secondary" style="font-size:11.5px;padding:6px 14px" onclick="mp.downloadSingleImage(${pi},'png')">
                PNG
              </button>
              <span style="font-size:10.5px;color:var(--text-muted);align-self:center">— saves 1 photo with all your edits</span>
            </div>
          </div>
        ` : `
          <div class="drop-zone sdt-drop" style="min-height:140px" onclick="document.getElementById('mpFileInput${pi}').click()"
               ondragover="event.preventDefault()" ondrop="mp.onDrop(event,${pi})">
            <input type="file" id="mpFileInput${pi}" accept="image/*" style="display:none" onchange="mp.loadFile(${pi},this.files[0])">
            <div class="sdt-placeholder">
              <div class="drop-icon" style="font-size:28px">📷</div>
              <div class="drop-label" style="font-size:13px">Click or drag photo here</div>
              <div class="drop-hint">Person ${pi+1}</div>
            </div>
          </div>
        `}
      `;
      container.appendChild(card);

      if (p.img) {
        setTimeout(() => {
          renderPersonCanvas(pi);
          bindCropEvents(pi);
        }, 30);
      }
    }

    // Refresh all remove.bg counters and key status badges in the newly rendered cards
    setTimeout(() => {
      if (typeof updateAllRemoveBgCounters === 'function') updateAllRemoveBgCounters();
      if (typeof updateAllApiKeyStatus     === 'function') updateAllApiKeyStatus();
    }, 50);
  }

  function onDrop(event, pi) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFile(pi, file);
  }

  function loadFile(pi, file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        persons[pi].img = img;
        persons[pi].originalImg = null;
        persons[pi].bgCutout = null;
        persons[pi].bgColor = 'transparent';
        persons[pi].bgStatus = '';
        persons[pi].bgBusy = false;
        persons[pi].bgMode = 'local';
        persons[pi].state = freshState();
        persons[pi].cropDisplayRect = null;
        renderPersonCards();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearPerson(pi) {
    persons[pi].img = null;
    persons[pi].originalImg = null;
    persons[pi].bgCutout = null;
    persons[pi].bgColor = 'transparent';
    persons[pi].bgStatus = '';
    persons[pi].bgBusy = false;
    persons[pi].bgMode = 'local';
    persons[pi].resultCanvas = null;
    persons[pi].state = freshState();
    persons[pi].cropDisplayRect = null;
    renderPersonCards();
    refreshPreview();
    saveMpState();
  }

  // "Clear Page" — wipes every photo/edit in the Photo Maker tab in one go,
  // not just the currently-selected person slot.
  function clearPhotoMakerPage() {
    const hasWork = persons.some(p => p && p.img);
    if (!hasWork) { toast('Nothing to clear.'); return; }
    if (!confirm('Clear all photos and edits on this page? This cannot be undone.')) return;
    for (let i = 0; i < persons.length; i++) clearPerson(i);
    localStorage.removeItem(MP_STORAGE_KEY);
    toast('Page cleared');
  }

  function canvasToImage(canvas) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not prepare the edited photo.'));
      image.src = canvas.toDataURL('image/png');
    });
  }

  function imageToCanvas(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function setBgStatus(pi, message) {
    const p = persons[pi];
    if (!p) return;
    p.bgStatus = message;
    const status = document.getElementById('mpBgStatus' + pi);
    if (status) {
      status.textContent = message;
      status.classList.toggle('error', message.startsWith('Error:'));
    }
  }

  function setBgMode(pi, mode) {
    const p = persons[pi];
    if (!p || p.bgBusy) return;
    p.bgMode = mode === 'api' ? 'api' : 'local';
    if (p.bgMode === 'api') {
      const key = getRemoveBgApiKey();
      setBgStatus(pi, key
        ? 'remove.bg API selected. Uses your personal free credits (50/month).'
        : '⚠️ No API key saved yet. Click "Setup Key" above to add yours.');
    } else {
      setBgStatus(pi, 'Built-in local AI selected. Works offline, no key needed.');
    }
  }

  async function removeBg(pi) {
    const p = persons[pi];
    if (!p || !p.img || p.bgBusy) return;
    p.bgBusy = true;
    p.bgStatus = p.bgMode === 'api' ? 'Uploading this photo to remove.bg...' : 'Loading the AI person detector…';
    renderPersonCards();
    try {
      // Use the cropped/rotated result canvas so BG removal applies to the edited image
      const sourceCanvas = p.resultCanvas || imageToCanvas(p.img);
      let cutout;
      if (p.bgMode === 'api') {
        try {
          cutout = await removeBgWithApi(sourceCanvas);
        } catch (apiError) {
          console.warn(apiError);
          toast('remove.bg: ' + apiError.message, 'error');
          setBgStatus(pi, `remove.bg failed (${apiError.message}). Switching to the built-in local remover...`);
          cutout = await PersonBackground.remove(sourceCanvas, message => setBgStatus(pi, message));
        }
      } else {
        cutout = await PersonBackground.remove(sourceCanvas, message => setBgStatus(pi, message));
      }
      // Backup original image + state for restore
      if (!p.originalImg) {
        p.originalImg = p.img;
        p._preRemoveBgState = { cropRect: p.state.cropRect ? {...p.state.cropRect} : null, hasCrop: p.state.hasCrop,
          rotateDeg: p.state.rotateDeg, flipH: p.state.flipH, flipV: p.state.flipV };
      }
      p.bgCutout = cutout;
      p.bgColor = 'transparent';
      // Load cutout as the new base image, clear crop/rotate so result canvas is correct
      const cutoutImg = await canvasToImage(PersonBackground.fill(cutout, p.bgColor));
      p.img = cutoutImg;
      p.state.cropRect = null; p.state.hasCrop = false;
      p.state.rotateDeg = 0; p.state.flipH = false; p.state.flipV = false;
      p.cropDisplayRect = null;
      p.bgStatus = 'Background removed from cropped image. Choose transparent or a solid colour.';
      toast(`Person ${pi + 1}: background removed.`);
    } catch (error) {
      p.bgStatus = 'Error: ' + error.message;
      toast(error.message, 'error');
    } finally {
      p.bgBusy = false;
      renderPersonCards();
      refreshPreview();
    }
  }

  async function fillBg(pi, color) {
    const p = persons[pi];
    if (!p || !p.bgCutout) return;
    p.bgColor = color;
    p.img = await canvasToImage(PersonBackground.fill(p.bgCutout, color));
    p.bgStatus = color === 'transparent' ? 'Transparent background selected.' : `Solid background ${color} selected.`;
    renderPersonCards();
    refreshPreview();
  }

  function restoreBg(pi) {
    const p = persons[pi];
    if (!p || !p.originalImg) return;
    p.img = p.originalImg;
    p.originalImg = null;
    p.bgCutout = null;
    p.bgColor = 'transparent';
    p.bgStatus = '';
    p.cropDisplayRect = null;
    p.state.cropRect = null;
    p.state.hasCrop = false;
    renderPersonCards();
    refreshPreview();
    toast(`Person ${pi + 1}: original background restored.`);
  }

  function rotate(pi, deg) {
    persons[pi].state.rotateDeg += deg;
    persons[pi].cropDisplayRect = null;
    persons[pi].state.cropRect = null;
    persons[pi].state.hasCrop = false;
    syncRotationControl(pi);
    renderPersonCanvas(pi);
    setTimeout(() => bindCropEvents(pi), 30);
  }

  function setRotation(pi, deg) {
    persons[pi].state.rotateDeg = Number(deg) || 0;
    persons[pi].cropDisplayRect = null;
    persons[pi].state.cropRect = null;
    persons[pi].state.hasCrop = false;
    syncRotationControl(pi);
    renderPersonCanvas(pi);
    setTimeout(() => bindCropEvents(pi), 30);
  }

  function flip(pi, dir) {
    if (dir === 'h') persons[pi].state.flipH = !persons[pi].state.flipH;
    else persons[pi].state.flipV = !persons[pi].state.flipV;
    renderPersonCanvas(pi);
    setTimeout(() => bindCropEvents(pi), 30);
  }

  function applyCrop(pi) {
    // FIX (weird overlay on crop-after-crop): the old dashed selection box was
    // left in cropDisplayRect after applying, using coordinates/scale from the
    // PREVIOUS (larger) canvas size. Since applying a crop shrinks the canvas,
    // that stale box got redrawn in the wrong place on top of the newly cropped
    // photo on the next render. Clearing it first gives a clean cropped photo;
    // a new box only appears once the user starts another drag.
    const p = persons[pi];
    if (p) p.cropDisplayRect = null;
    renderPersonCanvas(pi);
  }

  function clearCrop(pi) {
    persons[pi].state.cropRect = null;
    persons[pi].state.hasCrop = false;
    persons[pi].cropDisplayRect = null;
    renderPersonCanvas(pi);
    setTimeout(() => bindCropEvents(pi), 30);
  }

  function setSize(pi, w, h, unit) {
    const toMM = (v, u) => u==='mm'?v : u==='cm'?v*10 : u==='in'?v*25.4 : v*0.264583;
    persons[pi].state.sizeWmm = toMM(w, unit);
    persons[pi].state.sizeHmm = toMM(h, unit);
    const wEl = document.getElementById('mpW'+pi);
    const hEl = document.getElementById('mpH'+pi);
    if (wEl) wEl.value = (persons[pi].state.sizeWmm / 10).toFixed(1);
    if (hEl) hEl.value = (persons[pi].state.sizeHmm / 10).toFixed(1);
    refreshPreview();
  }

  function setSizeRaw(pi) {
    const w = parseFloat(document.getElementById('mpW'+pi)?.value);
    const h = parseFloat(document.getElementById('mpH'+pi)?.value);
    if (!isNaN(w) && w > 0) persons[pi].state.sizeWmm = w * 10;
    if (!isNaN(h) && h > 0) persons[pi].state.sizeHmm = h * 10;
    refreshPreview();
  }

  function deltaCount(pi, d) {
    const p = persons[pi];
    if (!p) return;
    // Compute the maximum that fits on the page at current image size
    const marginMM = parseFloat(document.getElementById('mpMargin')?.value) || 3;
    const gapMM    = parseFloat(document.getElementById('mpGap')?.value) || 2;
    const {pW, pH} = getMpPageDims();
    const areaW = pW - marginMM * 2;
    const areaH = pH - marginMM * 2;
    const imgW = p.state.sizeWmm || 25;
    const imgH = p.state.sizeHmm || 30;
    // How many fit per row × how many rows
    const perRow = Math.max(1, Math.floor((areaW + gapMM) / (imgW + gapMM)));
    const rows   = Math.max(1, Math.floor((areaH + gapMM) / (imgH + gapMM)));
    const maxCount = Math.max(1, perRow * rows);
    persons[pi].state.photoCount = Math.max(1, Math.min(maxCount, persons[pi].state.photoCount + d));
    const el = document.getElementById('mpPhCount'+pi);
    if (el) el.textContent = persons[pi].state.photoCount;
    refreshPreview();
  }

  function mpApplyBrightness(ctx, w, h, level) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const bAdj = level * 1.5;
    const contrast = 1 + level * 0.008;
    const saturation = 1 + Math.max(0, level) * 0.012;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i+1], b = data[i+2];
      r = (r-128)*contrast+128; g = (g-128)*contrast+128; b = (b-128)*contrast+128;
      r += bAdj; g += bAdj; b += bAdj;
      if (level > 0) {
        const lum = 0.299*r + 0.587*g + 0.114*b;
        r = lum+(r-lum)*saturation; g = lum+(g-lum)*saturation; b = lum+(b-lum)*saturation;
      }
      data[i]=Math.max(0,Math.min(255,Math.round(r)));
      data[i+1]=Math.max(0,Math.min(255,Math.round(g)));
      data[i+2]=Math.max(0,Math.min(255,Math.round(b)));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function mpSetBrightness(pi, val) {
    const p = persons[pi];
    if (!p) return;
    p.state.brightness = parseInt(val);
    const lbl = document.getElementById('mpBrightnessLabel'+pi);
    if (lbl) lbl.textContent = (val >= 0 ? '+' : '') + val;
    renderPersonCanvas(pi);
  }

  function renderPersonCanvas(pi) {
    const p = persons[pi];
    if (!p.img) return;
    const rotC = makePersonTransformedCanvas(p.img, p.state);
    p.cachedRotC = rotC; // cache for use during crop drag on slow PCs

    // Crop
    let cropSrc = rotC;
    if (p.state.hasCrop && p.state.cropRect) {
      const cr = p.state.cropRect;
      const cOut = document.createElement('canvas');
      cOut.width = Math.max(1, cr.w); cOut.height = Math.max(1, cr.h);
      cOut.getContext('2d').drawImage(rotC, cr.x, cr.y, cr.w, cr.h, 0, 0, cr.w, cr.h);
      cropSrc = cOut;
    }

    // Apply brightness enhancement if set
    if (p.state.brightness && p.state.brightness !== 0) {
      const bC = document.createElement('canvas');
      bC.width = cropSrc.width; bC.height = cropSrc.height;
      const bCtx = bC.getContext('2d');
      bCtx.drawImage(cropSrc, 0, 0);
      mpApplyBrightness(bCtx, bC.width, bC.height, p.state.brightness);
      cropSrc = bC;
    }
    p.resultCanvas = cropSrc;

    // Draw display canvas
    const cv = document.getElementById('mpCropCanvas'+pi);
    if (!cv) return;

    // ROOT FIX: Use the crop-wrapper div's clientWidth (not the card's full width).
    // The wrapper has overflow:hidden so the canvas never spills into the card padding.
    // No border on the wrapper means no offset — canvas pixel size == rendered size exactly.
    const wrapper = document.getElementById('mpCropWrap'+pi);
    const parentW = wrapper ? wrapper.clientWidth : (cv.parentElement ? cv.parentElement.clientWidth : 600);
    const maxW = Math.max(parentW, 200); // no border to subtract
    const maxH = Math.max(window.innerHeight * 0.62, 280);
    const scaleW = maxW / cropSrc.width;
    const scaleH = maxH / cropSrc.height;
    // Cap at 1 — no upscaling. On 2-4 GB RAM / Windows 7 machines upscaling a
    // large image wastes memory and can crash the tab.
    const scale = Math.min(scaleW, scaleH, 1);
    p.displayScale = scale;
    cv.width  = Math.round(cropSrc.width  * scale);
    cv.height = Math.round(cropSrc.height * scale);
    // CRITICAL: style px == canvas px == getBoundingClientRect so coords are exact.
    // Clamp width to maxW: on very low-end / high-DPI PCs rounding could push the
    // canvas 1-2px wider than the wrapper, creating the brown-border gap.
    cv.style.width    = Math.min(cv.width, maxW) + 'px';
    cv.style.height   = cv.height + 'px';
    cv.style.display  = 'block';   // no inline baseline gap
    cv.style.margin   = '0';       // no centering offset that shifts canvas from rect.left
    const ctx = cv.getContext('2d');
    // LOW-END PC: 'low' quality is much faster on old integrated GPUs / Windows 7.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(cropSrc, 0, 0, cv.width, cv.height);

    // Draw crop overlay
    if (p.cropDisplayRect) {
      const {x,y,w,h} = p.cropDisplayRect;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0,0,cv.width,y); ctx.fillRect(0,y+h,cv.width,cv.height);
      ctx.fillRect(0,y,x,h); ctx.fillRect(x+w,y,cv.width-x-w,h);
      ctx.strokeStyle='rgba(249,107,63,1)'; ctx.lineWidth=2; ctx.setLineDash([5,4]);
      ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); ctx.setLineDash([]);
    }

    // Update preview img
    const prevEl = document.getElementById('mpPreview'+pi);
    if (prevEl) prevEl.src = cropSrc.toDataURL(p.bgCutout && p.bgColor === 'transparent' ? 'image/png' : 'image/jpeg', 0.85);

    refreshPreview();
    // Persist state across page navigations
    setTimeout(saveMpState, 80);
  }

  // Lightweight redraw used only during crop drag — reuses the cached rotated canvas
  // so we don't call makePersonTransformedCanvas or refreshPreview on every mouse-move frame.
  // This is the key fix for slow/old PCs (Windows 7, low RAM).
  function redrawCropDragOverlay(pi) {
    const p = persons[pi];
    const cv = document.getElementById('mpCropCanvas'+pi);
    if (!cv || !p.cachedRotC) { renderPersonCanvas(pi); return; }
    const ctx = cv.getContext('2d');
    ctx.drawImage(p.cachedRotC, 0, 0, cv.width, cv.height);
    if (p.cropDisplayRect) {
      const {x,y,w,h} = p.cropDisplayRect;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0,0,cv.width,y); ctx.fillRect(0,y+h,cv.width,cv.height);
      ctx.fillRect(0,y,x,h); ctx.fillRect(x+w,y,cv.width-x-w,h);
      ctx.strokeStyle='rgba(249,107,63,1)'; ctx.lineWidth=2; ctx.setLineDash([5,4]);
      ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); ctx.setLineDash([]);
    }
  }

  function bindCropEvents(pi) {
    const cv = document.getElementById('mpCropCanvas'+pi);
    if (!cv) return;
    const p = persons[pi];

    function getPos(clientX, clientY) {
      const rect = cv.getBoundingClientRect();
      // Since canvas pixel size === style size, scaleX/Y should be ~1.0.
      // Still computed from rect in case browser zoom or device pixel ratio differs.
      // LOW-END PC FIX: use Math.round (not Math.floor) so a click at the very
      // right/bottom edge of the canvas maps to cv.width / cv.height, not one pixel
      // short — this is the root cause of "I have to click the brown border to crop
      // from the image edge" reported on slow machines.
      const dispW = rect.width  || cv.width;
      const dispH = rect.height || cv.height;
      const scaleX = cv.width / dispW, scaleY = cv.height / dispH;
      const x = Math.round((clientX - rect.left) * scaleX);
      const y = Math.round((clientY - rect.top)  * scaleY);
      return {x: Math.max(0, Math.min(cv.width,  x)),
              y: Math.max(0, Math.min(cv.height, y))};
    }

    cv.onmousedown = e => {
      e.preventDefault();
      const pos = getPos(e.clientX, e.clientY);
      p.dragging = true; p.startX = pos.x; p.startY = pos.y;
      p.cropDisplayRect = null;
    };
    // FIX (crop box lagging behind a fast cursor swipe): previously the ONLY
    // throttle here was a 33ms Date.now() gate that skipped BOTH reading the
    // mouse position AND repainting. Reading/clamping the position is cheap
    // math — it's the canvas repaint (redrawCropDragOverlay) that's expensive.
    // Gating both together meant a fast flick could drop the last few real
    // cursor positions, so the box visibly froze behind the cursor. We now
    // read the position on every event, and instead cap the repaint itself to
    // once per animation frame (requestAnimationFrame dedup below) — the same
    // safe pattern already used by the main image-editor crop tool. This keeps
    // the actual redraw cost on slow PCs unchanged (never more than 1 paint
    // per screen refresh), it just stops throwing away position data.
    let _mpCropRafId = null;
    function scheduleMpCropRedraw(){
      if (_mpCropRafId) return; // already queued — skip to avoid double-paint
      _mpCropRafId = requestAnimationFrame(() => { _mpCropRafId = null; redrawCropDragOverlay(pi); });
    }
    cv.onmousemove = e => {
      if (!p.dragging) return;
      const pos = getPos(e.clientX, e.clientY);
      p.cropDisplayRect = {
        x: Math.min(p.startX, pos.x), y: Math.min(p.startY, pos.y),
        w: Math.abs(pos.x - p.startX), h: Math.abs(pos.y - p.startY)
      };
      scheduleMpCropRedraw();
    };
    // Shared finalize-drag logic, used by the canvas mouseup handler AND the
    // document-level fallback below, so a release outside the canvas still
    // commits the crop instead of leaving it stuck.
    function commitCropDrag(){
      if (!p.dragging) return;
      p.dragging = false;
      if (_mpCropRafId) { cancelAnimationFrame(_mpCropRafId); _mpCropRafId = null; }
      if (p.cropDisplayRect && p.cropDisplayRect.w > 4 && p.cropDisplayRect.h > 4) {
        p.state.cropRect = {
          x: Math.round(p.cropDisplayRect.x / p.displayScale),
          y: Math.round(p.cropDisplayRect.y / p.displayScale),
          w: Math.round(p.cropDisplayRect.w / p.displayScale),
          h: Math.round(p.cropDisplayRect.h / p.displayScale),
        };
        p.state.hasCrop = true;
      }
    }
    cv.onmouseup = e => { commitCropDrag(); };

    // FIX (fast-cursor-out-of-canvas bug): this used to abort the drag the
    // instant the cursor left the canvas, discarding the in-progress selection
    // before it was ever committed to p.state — that's why a fast drag past the
    // edge left the crop box "stuck" and Apply Crop did nothing. Now dragging
    // stays on: onmousemove already clamps to the canvas bounds, so the box
    // simply freezes at the edge and resumes the moment the cursor comes back.
    cv.onmouseleave = () => {};

    // FIX: registered once per person-canvas (old listener removed first so
    // repeated bindCropEvents() calls, which happen on every state change,
    // don't stack up multiple listeners). Safety net so releasing the mouse
    // button outside the canvas still finalizes the crop cleanly.
    if (p._docMouseUp) document.removeEventListener('mouseup', p._docMouseUp);
    p._docMouseUp = commitCropDrag;
    document.addEventListener('mouseup', p._docMouseUp);

    cv.ontouchstart = e => {
      e.preventDefault();
      const t = e.touches[0], pos = getPos(t.clientX, t.clientY);
      p.dragging = true; p.startX = pos.x; p.startY = pos.y;
      p.cropDisplayRect = null;
    };
    cv.ontouchmove = e => {
      e.preventDefault();
      if (!p.dragging) return;
      const t = e.touches[0], pos = getPos(t.clientX, t.clientY);
      p.cropDisplayRect = {
        x: Math.min(p.startX, pos.x), y: Math.min(p.startY, pos.y),
        w: Math.abs(pos.x - p.startX), h: Math.abs(pos.y - p.startY)
      };
      redrawCropDragOverlay(pi);
    };
    cv.ontouchend = () => {
      if (!p.dragging) return; p.dragging = false;
      if (p.cropDisplayRect && p.cropDisplayRect.w > 4 && p.cropDisplayRect.h > 4) {
        p.state.cropRect = {
          x: Math.round(p.cropDisplayRect.x / p.displayScale),
          y: Math.round(p.cropDisplayRect.y / p.displayScale),
          w: Math.round(p.cropDisplayRect.w / p.displayScale),
          h: Math.round(p.cropDisplayRect.h / p.displayScale),
        };
        p.state.hasCrop = true;
      }
    };
  }

  /* ---- A4 combined preview ---- */
  function refreshPreview() {
    const cv = document.getElementById('mpA4Canvas');
    if (!cv) return;
    const marginMM = parseFloat(document.getElementById('mpMargin')?.value) || 3;
    const gapMM    = parseFloat(document.getElementById('mpGap')?.value) || 2;
    const {pW, pH} = getMpPageDims();
    const PX = 3.0; // higher internal resolution for sharper render
    const cW = Math.round(pW * PX), cH = Math.round(pH * PX);
    cv.width = cW; cv.height = cH;

    // Scale to fit container width but cap height at 260px so it stays visible without scrolling
    const wrap = document.getElementById('mpA4PreviewWrap');
    const containerW = wrap ? (wrap.clientWidth || 268) : 268;
    const maxDisplayH = 260; // cap height so portrait A4 doesn't go off screen
    // Scale by width first, then check if height exceeds cap
    let displayW = containerW;
    let displayH = Math.round(displayW * (cH / cW));
    if (displayH > maxDisplayH) {
      displayH = maxDisplayH;
      displayW = Math.round(displayH * (cW / cH));
    }
    cv.style.width  = displayW + 'px';
    cv.style.height = displayH + 'px';
    cv.style.maxWidth  = '100%';
    cv.style.maxHeight = '';
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,cW,cH);

    const areaW = pW - marginMM * 2;
    const areaH = pH - marginMM * 2;

    const activePeople = persons.slice(0, personCount).filter(p => p.resultCanvas);
    const placements = computeContinuousPlacements(activePeople, areaW, areaH, gapMM);
    const placedByPerson = new Map();

    for (const item of placements) {
      const px = Math.round((marginMM + item.x)*PX), py = Math.round((marginMM + item.y)*PX);
      const pw2 = Math.round(item.w*PX), ph2 = Math.round(item.h*PX);
      ctx.drawImage(item.person.resultCanvas, px, py, pw2, ph2);
      ctx.strokeStyle='rgba(160,160,185,0.55)'; ctx.lineWidth=0.6;
      ctx.strokeRect(px+0.5, py+0.5, pw2-1, ph2-1);
      placedByPerson.set(item.person, (placedByPerson.get(item.person) || 0) + 1);
    }

    // Page border + margin guide
    ctx.strokeStyle='rgba(108,99,255,0.4)'; ctx.lineWidth=1.5;
    ctx.strokeRect(0.5,0.5,cW-1,cH-1);
    const mPx = Math.round(marginMM*PX);
    ctx.strokeStyle='rgba(108,99,255,0.15)'; ctx.lineWidth=0.7; ctx.setLineDash([4,4]);
    ctx.strokeRect(mPx,mPx,cW-mPx*2,cH-mPx*2); ctx.setLineDash([]);

    const infoEl = document.getElementById('mpA4Info');
    if (!activePeople.length) {
      if (infoEl) infoEl.textContent = 'Upload photos for persons above to see preview.';
    } else {
      const labels = activePeople.map((p) => {
        const si = persons.indexOf(p);
        const placed = placedByPerson.get(p) || 0;
        return `P${si+1}: ${placed} photo${placed!==1?'s':''} @ ${((p.state.sizeWmm||25)/10).toFixed(1)}×${((p.state.sizeHmm||30)/10).toFixed(1)}cm`;
      });
      if (infoEl) infoEl.textContent = labels.join(' · ');
    }

    // Update single-image zoom preview card
    refreshSingleImagePreview();
  }

  function refreshSingleImagePreview() {
    const zoomCard = document.getElementById('mpSingleImgCard');
    if (!zoomCard) return;
    const firstPerson = persons.slice(0, personCount).find(p => p.resultCanvas);
    const zoomImg = document.getElementById('mpSingleImgPreview');
    const zoomInfo = document.getElementById('mpSingleImgInfo');
    const zoomSelector = document.getElementById('mpSingleImgSelector');

    if (!firstPerson) {
      if (zoomImg) { zoomImg.src=''; zoomImg.style.display='none'; }
      const ph = document.getElementById('mpSingleImgPlaceholder');
      if (ph) ph.style.display = 'block';
      if (zoomInfo) zoomInfo.textContent = 'Upload a photo above to see it here.';
      const estEl = document.getElementById('mpSingleQualSizeEst');
      if (estEl) estEl.textContent = '≈ estimated size: -';
      return;
    }

    const selIdx = zoomSelector ? parseInt(zoomSelector.value) : 0;
    const targetPerson = persons[selIdx] && persons[selIdx].resultCanvas ? persons[selIdx] : firstPerson;

    if (zoomImg && targetPerson.resultCanvas) {
      const ph = document.getElementById('mpSingleImgPlaceholder');
      if (ph) ph.style.display = 'none';

      const src = targetPerson.resultCanvas;
      const wMM = targetPerson.state.sizeWmm || 25;
      const hMM = targetPerson.state.sizeHmm || 30;

      // Use mm dimensions for correct real-world proportions (what will actually print)
      // but cap display so it doesn't exceed 220px height
      const wrap = document.getElementById('mpSingleImgWrap');
      const maxW = wrap ? (wrap.clientWidth || 268) : 268;
      const maxH = 220;

      let dispW = maxW;
      let dispH = Math.round(dispW * (hMM / wMM));
      if (dispH > maxH) {
        dispH = maxH;
        dispW = Math.round(dispH * (wMM / hMM));
      }

      // Render at 2× for sharpness
      const tmp = document.createElement('canvas');
      tmp.width  = dispW * 2;
      tmp.height = dispH * 2;
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.drawImage(src, 0, 0, tmp.width, tmp.height);

      zoomImg.src = tmp.toDataURL('image/jpeg', 0.93);
      zoomImg.style.display = 'block';
      zoomImg.style.width   = dispW + 'px';
      zoomImg.style.height  = dispH + 'px';
      zoomImg.style.objectFit = 'fill';
      if (zoomInfo) zoomInfo.textContent = `${(wMM/10).toFixed(1)} × ${(hMM/10).toFixed(1)} cm · print ratio`;
    }

    // Sync the quality slider to whichever person is currently shown — each
    // person keeps their own saved quality (defaults to 85) so switching the
    // "Person" dropdown doesn't clobber anyone's chosen setting.
    const qualEl = document.getElementById('mpSingleQual');
    const qualLbl = document.getElementById('mpSingleQualLabel');
    if (qualEl && targetPerson) {
      const q = targetPerson.state.quality || 85;
      qualEl.value = q;
      qualEl.style.setProperty('--pct', ((q - 1) / 99 * 100).toFixed(1) + '%');
      if (qualLbl) qualLbl.textContent = q + '%';
    }
    updateSingleQualSizeEst(targetPerson);
  }

  // Called on every 'input' tick of the single-photo quality slider.
  function mpSetSingleQuality(val) {
    const sel = document.getElementById('mpSingleImgSelector');
    const pi = sel ? parseInt(sel.value) : 0;
    const p = persons[pi] && persons[pi].resultCanvas
      ? persons[pi]
      : persons.slice(0, personCount).find(pr => pr.resultCanvas);
    if (!p) return;
    p.state.quality = Number(val);
    const lbl = document.getElementById('mpSingleQualLabel');
    if (lbl) lbl.textContent = val + '%';
    const rangeEl = document.getElementById('mpSingleQual');
    if (rangeEl) rangeEl.style.setProperty('--pct', ((val - 1) / 99 * 100).toFixed(1) + '%');
    updateSingleQualSizeEst(p);
    setTimeout(saveMpState, 60);
  }

  // Debounced (RAF) wrapper — dragging the slider fires many 'input' events in
  // a burst; this makes sure we only ever do the actual JPEG re-encode (the
  // expensive part) once per animation frame, same low-end-PC-safe pattern
  // used for the crop-drag redraws elsewhere in this file.
  function updateSingleQualSizeEst(p) {
    if (_mpQualRafId) return;
    _mpQualRafId = requestAnimationFrame(() => {
      _mpQualRafId = null;
      computeSingleQualSizeEst(p);
    });
  }

  function computeSingleQualSizeEst(p) {
    const estEl = document.getElementById('mpSingleQualSizeEst');
    if (!estEl) return;
    if (!p || !p.resultCanvas) { estEl.textContent = '≈ estimated size: -'; return; }
    try {
      const q = Math.max(0.1, Math.min(1, (p.state.quality || 85) / 100));
      const dataUrl = p.resultCanvas.toDataURL('image/jpeg', q);
      const estBytes = Math.round(dataUrl.split(',')[1].length * 0.75);
      estEl.innerHTML = '≈ estimated JPG size: <span class="mt-qual-size-val">' + fmtBytes(estBytes) +
        '</span> <span style="opacity:.75">(PNG download is always lossless — slider doesn\'t change it)</span>';
    } catch(e) {
      // Very low-end PC / huge canvas edge case — fail quietly, don't block the UI.
      estEl.textContent = '≈ estimated size: -';
    }
  }

  /* Fill the sheet like a normal passport-photo layout.
     Supports row-by-row and column-by-column directions. */
  function computeContinuousPlacements(activePeople, areaW, areaH, gapMM) {
    if (mpImgDir === 'col') {
      return computeContinuousPlacementsCol(activePeople, areaW, areaH, gapMM);
    }
    // Row-by-row (default)
    const placements = [];
    let x = 0, y = 0, rowH = 0;
    outer: for (const person of activePeople) {
      const w = person.state.sizeWmm || 25;
      const h = person.state.sizeHmm || 30;
      const count = person.state.photoCount || 4;
      for (let i = 0; i < count; i++) {
        if (x > 0 && x + w > areaW + 0.01) {
          x = 0;
          y += rowH + gapMM;
          rowH = 0;
        }
        if (y + h > areaH + 0.01) break outer;
        placements.push({ person, x, y, w, h });
        x += w + gapMM;
        rowH = Math.max(rowH, h);
      }
    }
    return placements;
  }

  function computeContinuousPlacementsCol(activePeople, areaW, areaH, gapMM) {
    const placements = [];
    let x = 0, y = 0, colW = 0;
    outer: for (const person of activePeople) {
      const w = person.state.sizeWmm || 25;
      const h = person.state.sizeHmm || 30;
      const count = person.state.photoCount || 4;
      for (let i = 0; i < count; i++) {
        if (y > 0 && y + h > areaH + 0.01) {
          y = 0;
          x += colW + gapMM;
          colW = 0;
        }
        if (x + w > areaW + 0.01) break outer;
        placements.push({ person, x, y, w, h });
        y += h + gapMM;
        colW = Math.max(colW, w);
      }
    }
    return placements;
  }

  /* Place photos at their EXACT mm size. Find best cols/rows so they all fit.
     Returns {cols, rows, fitsInSection} */
  function computeExactGrid(secW, secH, imgWmm, imgHmm, gapMM, count) {
    let bestCols = 1, bestRows = 1, bestFits = 0;
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      // Total space needed at exact size
      const neededW = cols * imgWmm + Math.max(0, cols-1) * gapMM;
      const neededH = rows * imgHmm + Math.max(0, rows-1) * gapMM;
      if (neededW <= secW + 0.01 && neededH <= secH + 0.01) {
        const fits = cols * rows;
        if (fits > bestFits) { bestFits = fits; bestCols = cols; bestRows = rows; }
      }
    }
    // If not even 1 fits at exact size, force 1 column and scale to fit
    if (bestFits === 0) { bestCols = 1; bestRows = 1; bestFits = 1; }
    return { cols: bestCols, rows: bestRows, fitsInSection: bestFits };
  }

  /* ---- Download ---- */
  async function downloadPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('PDF library not loaded.', 'error'); return; }
    const activePeople = persons.slice(0, personCount);
    if (!activePeople.some(p => p.resultCanvas)) { toast('Upload at least one person\'s photo.', 'error'); return; }

    const {jsPDF} = window.jspdf;
    const marginMM = parseFloat(document.getElementById('mpMargin')?.value) || 3;
    const gapMM    = parseFloat(document.getElementById('mpGap')?.value) || 2;
    const {pW, pH} = getMpPageDims();
    // For custom paper sizes, pass [pW, pH] directly — jsPDF uses them as [width, height]
    // For A4, use the named format string so jsPDF handles it correctly
    const paperFmt = mpPaperSize==='a4' ? 'a4' : [pW, pH];
    const pdf = new jsPDF({orientation:orient, unit:'mm', format:paperFmt, compress:true});

    const areaW = pW - marginMM * 2;
    const areaH = pH - marginMM * 2;
    const placements = computeContinuousPlacements(activePeople.filter(p => p.resultCanvas), areaW, areaH, gapMM);
    const imageCache = new Map();
    for (const item of placements) {
      if (!imageCache.has(item.person)) {
        const flattened = document.createElement('canvas');
        flattened.width = item.person.resultCanvas.width;
        flattened.height = item.person.resultCanvas.height;
        const flattenedCtx = flattened.getContext('2d');
        flattenedCtx.fillStyle = '#ffffff';
        flattenedCtx.fillRect(0, 0, flattened.width, flattened.height);
        flattenedCtx.drawImage(item.person.resultCanvas, 0, 0);
        imageCache.set(item.person, flattened.toDataURL('image/jpeg', 0.92));
      }
      pdf.addImage(imageCache.get(item.person), 'JPEG', marginMM + item.x, marginMM + item.y, item.w, item.h, undefined, 'FAST');
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='multiperson_a4.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
    toast('Multi-person A4 PDF downloaded!');
  }

  /* ---- Download single edited image for one person ---- */
  function downloadSingleImage(pi, fmt) {
    const p = persons[pi];
    if (!p || !p.resultCanvas) { toast('Upload and edit a photo first.', 'error'); return; }
    const cv = p.resultCanvas;

    // Flatten onto white background (for JPEG), keep alpha for PNG
    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext('2d');
    if (fmt === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.drawImage(cv, 0, 0);

    const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    // PNG is always lossless (1.0). JPG uses this person's own quality slider
    // setting (from the Single Photo Preview card), defaulting to 85 if unset.
    const quality = fmt === 'png' ? 1.0 : Math.max(0.1, Math.min(1, (p.state.quality || 85) / 100));
    const dataUrl = out.toDataURL(mime, quality);
    const ext = fmt === 'png' ? 'png' : 'jpg';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `photo_person${pi + 1}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    toast(`Downloaded photo_person${pi + 1}.${ext}`);
  }

  function downloadSingleImageFromSelector(fmt) {
    const sel = document.getElementById('mpSingleImgSelector');
    const pi = sel ? parseInt(sel.value) : 0;
    const p = persons[pi] && persons[pi].resultCanvas ? persons[pi] : persons.slice(0, personCount).find(pr => pr.resultCanvas);
    if (!p || !p.resultCanvas) { toast('Upload a photo first.', 'error'); return; }
    const actualPi = persons.indexOf(p);
    downloadSingleImage(actualPi, fmt);
  }

  /* ---- Fill-Page PDF ----
     Rules:
       1 image  → fills whole page
       2 images → page split in 2 equal halves (top/bottom in portrait, left/right in landscape)
       3 images → 2×2 grid, 3 cells filled, 1 empty
       4 images → 2×2 grid, all 4 filled
       5-6      → 2×3 or 3×2 grid, etc.
     No borders/lines drawn. Margins + gaps kept, everything else fills.
  ---- */
  async function downloadFillPagePDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('PDF library not loaded.', 'error'); return; }
    const activePeople = persons.slice(0, personCount).filter(p => p.resultCanvas);
    if (!activePeople.length) { toast('Upload at least one person\'s photo.', 'error'); return; }

    const {jsPDF} = window.jspdf;
    const baseMarginMM = 6;
    const gapMM    = 4;

    // Extra margin option (for signature space)
    const extraMarginEnabled = document.getElementById('fpExtraMargin')?.checked;
    const extraMarginMM = extraMarginEnabled ? 38.1 : 0; // 1.5 inch = 38.1mm
    const extraMarginSide = document.getElementById('fpExtraMarginSide')?.value || 'bottom';

    const {pW, pH} = getMpPageDims();

    const paperFmt = mpPaperSize === 'a4' ? 'a4' : [pW, pH];
    const pdf = new jsPDF({orientation: orient, unit: 'mm', format: paperFmt, compress: true});

    // Gather all canvases in order
    const allCanvases = [];
    for (const person of activePeople) {
      const count = person.state.photoCount || 1;
      for (let i = 0; i < count; i++) {
        allCanvases.push(person.resultCanvas);
      }
    }
    const n = allCanvases.length;

    // Determine grid dimensions based on count
    let gridCols, gridRows;
    if (n === 1) {
      gridCols = 1; gridRows = 1;
    } else if (n === 2) {
      if (orient === 'portrait') { gridCols = 1; gridRows = 2; }
      else                       { gridCols = 2; gridRows = 1; }
    } else if (n === 3 || n === 4) {
      gridCols = 2; gridRows = 2;
    } else if (n === 5 || n === 6) {
      if (orient === 'portrait') { gridCols = 2; gridRows = 3; }
      else                       { gridCols = 3; gridRows = 2; }
    } else if (n <= 9) {
      gridCols = 3; gridRows = 3;
    } else {
      gridCols = Math.ceil(Math.sqrt(n));
      gridRows = Math.ceil(n / gridCols);
    }

    // Compute margins accounting for extra margin side
    const mTop    = baseMarginMM + (extraMarginSide === 'top'    ? extraMarginMM : 0);
    const mBottom = baseMarginMM + (extraMarginSide === 'bottom' ? extraMarginMM : 0);
    const mLeft   = baseMarginMM + (extraMarginSide === 'left'   ? extraMarginMM : 0);
    const mRight  = baseMarginMM + (extraMarginSide === 'right'  ? extraMarginMM : 0);

    const areaW = pW - mLeft - mRight;
    const areaH = pH - mTop  - mBottom;
    const cellW = (areaW - (gridCols - 1) * gapMM) / gridCols;
    const cellH = (areaH - (gridRows - 1) * gapMM) / gridRows;

    // Pre-flatten canvases to JPEG data URLs
    const imageCache = new Map();
    const getJpeg = (cv) => {
      if (!imageCache.has(cv)) {
        const flat = document.createElement('canvas');
        flat.width = cv.width; flat.height = cv.height;
        const flatCtx = flat.getContext('2d');
        flatCtx.fillStyle = '#ffffff';
        flatCtx.fillRect(0, 0, flat.width, flat.height);
        flatCtx.drawImage(cv, 0, 0);
        imageCache.set(cv, flat.toDataURL('image/jpeg', 0.92));
      }
      return imageCache.get(cv);
    };

    // Place each image — CONTAIN (preserve aspect ratio, letter-box inside cell)
    for (let i = 0; i < n; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const cellXMM = mLeft + col * (cellW + gapMM);
      const cellYMM = mTop  + row * (cellH + gapMM);

      const cv = allCanvases[i];
      const imgAspect = cv.width / cv.height;
      const cellAspect = cellW / cellH;

      let drawW, drawH;
      if (imgAspect > cellAspect) {
        // Image is wider than cell — fit by width
        drawW = cellW;
        drawH = cellW / imgAspect;
      } else {
        // Image is taller — fit by height
        drawH = cellH;
        drawW = cellH * imgAspect;
      }
      // Centre in cell
      const xMM = cellXMM + (cellW - drawW) / 2;
      const yMM = cellYMM + (cellH - drawH) / 2;

      pdf.addImage(getJpeg(cv), 'JPEG', xMM, yMM, drawW, drawH, undefined, 'FAST');
    }

    const outBlob = pdf.output('blob');
    const outUrl = URL.createObjectURL(outBlob);
    const a = document.createElement('a'); a.href = outUrl; a.download = 'fill_page_photos.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(outUrl), 5000);
    const marginNote = extraMarginEnabled ? ` · 1.5in ${extraMarginSide} margin for signature` : '';
    toast(`Fill-page PDF downloaded! ${gridCols}×${gridRows} grid, ${n} photo${n!==1?'s':''}${marginNote}`);
  }

  /* ---- Shared: resolve page size to a CSS @page size string ---- */
  function getMpCssPageSize() {
    const {pW, pH} = getMpPageDims();
    if (mpPaperSize === 'a4') {
      return orient === 'landscape' ? 'A4 landscape' : 'A4 portrait';
    }
    if (mpPaperSize === '4x6') {
      return orient === 'landscape' ? '6in 4in' : '4in 6in';
    }
    return orient === 'landscape'
      ? `${Math.max(pW,pH)}mm ${Math.min(pW,pH)}mm`
      : `${Math.min(pW,pH)}mm ${Math.max(pW,pH)}mm`;
  }

  /* ---- Open a popup window and trigger print with correct paper size pre-set ---- */
  /* Key insight: browsers BLOCK window.print() from hidden/offscreen iframes (blob: src).
     The only reliable cross-browser fix is to open a small VISIBLE popup window, write the
     print HTML into it, and call print() on that window reference directly from the parent. */
  function openPdfForPrint(pdfBlob) {
    const cssPageSize = getMpCssPageSize();
    const {pW, pH} = getMpPageDims();
    const blobUrl = URL.createObjectURL(pdfBlob);

    // Build self-contained HTML with correct @page size and auto-print
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Print Photos</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page {
    size: ${cssPageSize};
    margin: 0;
  }
  html, body {
    width: ${pW}mm;
    height: ${pH}mm;
    overflow: hidden;
    background: #fff;
  }
  embed {
    display: block;
    width: ${pW}mm;
    height: ${pH}mm;
  }
</style>
</head>
<body>
  <embed src="${blobUrl}" type="application/pdf" width="${pW}mm" height="${pH}mm">
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 800);
    };
    setTimeout(function() { window.print(); }, 1400);
    window.onafterprint = function() {
      setTimeout(function() {
        URL.revokeObjectURL('${blobUrl}');
        window.close();
      }, 1000);
    };
  <\/script>
</body>
</html>`;

    // Open a real visible popup — browsers only allow print() in visible windows
    const popup = window.open('', '_blank', 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no');
    if (!popup) {
      // Popup was blocked — fall back to opening the PDF blob directly
      toast('Popup blocked by browser. Please allow popups for this site, or use the download button and print from there.', 'error');
      URL.revokeObjectURL(blobUrl);
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    // Safety: if popup closes without printing, clean up blob URL
    const cleanup = setInterval(() => {
      if (popup.closed) {
        clearInterval(cleanup);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
    }, 1000);
  }

  /* ---- Print: same PDF as downloadPDF ---- */
  async function printPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('PDF library not loaded.', 'error'); return; }
    const activePeople = persons.slice(0, personCount);
    if (!activePeople.some(p => p.resultCanvas)) { toast('Upload at least one person\'s photo first.', 'error'); return; }

    const {jsPDF} = window.jspdf;
    const marginMM = parseFloat(document.getElementById('mpMargin')?.value) || 3;
    const gapMM    = parseFloat(document.getElementById('mpGap')?.value) || 2;
    const {pW, pH} = getMpPageDims();
    const paperFmt = mpPaperSize === 'a4' ? 'a4' : [pW, pH];
    const pdf = new jsPDF({orientation: orient, unit: 'mm', format: paperFmt, compress: true});

    const areaW = pW - marginMM * 2;
    const areaH = pH - marginMM * 2;
    const placements = computeContinuousPlacements(activePeople.filter(p => p.resultCanvas), areaW, areaH, gapMM);
    const imageCache = new Map();
    for (const item of placements) {
      if (!imageCache.has(item.person)) {
        const flattened = document.createElement('canvas');
        flattened.width  = item.person.resultCanvas.width;
        flattened.height = item.person.resultCanvas.height;
        const flatCtx = flattened.getContext('2d');
        flatCtx.fillStyle = '#ffffff';
        flatCtx.fillRect(0, 0, flattened.width, flattened.height);
        flatCtx.drawImage(item.person.resultCanvas, 0, 0);
        imageCache.set(item.person, flattened.toDataURL('image/jpeg', 0.92));
      }
      pdf.addImage(imageCache.get(item.person), 'JPEG', marginMM + item.x, marginMM + item.y, item.w, item.h, undefined, 'FAST');
    }

    openPdfForPrint(pdf.output('blob'));
  }

  /* ---- Print: same PDF as downloadFillPagePDF ---- */
  async function printFillPagePDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('PDF library not loaded.', 'error'); return; }
    const activePeople = persons.slice(0, personCount).filter(p => p.resultCanvas);
    if (!activePeople.length) { toast('Upload at least one person\'s photo first.', 'error'); return; }

    const {jsPDF} = window.jspdf;
    const baseMarginMM = 6, gapMM = 4;
    const extraMarginEnabled = document.getElementById('fpExtraMargin')?.checked;
    const extraMarginMM = extraMarginEnabled ? 38.1 : 0;
    const extraMarginSide = document.getElementById('fpExtraMarginSide')?.value || 'bottom';
    const {pW, pH} = getMpPageDims();
    const paperFmt = mpPaperSize === 'a4' ? 'a4' : [pW, pH];
    const pdf = new jsPDF({orientation: orient, unit: 'mm', format: paperFmt, compress: true});

    const allCanvases = [];
    for (const person of activePeople) {
      const count = person.state.photoCount || 1;
      for (let i = 0; i < count; i++) allCanvases.push(person.resultCanvas);
    }
    const n = allCanvases.length;

    let gridCols, gridRows;
    if (n === 1)            { gridCols = 1; gridRows = 1; }
    else if (n === 2)       { gridCols = orient==='portrait'?1:2; gridRows = orient==='portrait'?2:1; }
    else if (n <= 4)        { gridCols = 2; gridRows = 2; }
    else if (n <= 6)        { gridCols = orient==='portrait'?2:3; gridRows = orient==='portrait'?3:2; }
    else if (n <= 9)        { gridCols = 3; gridRows = 3; }
    else { gridCols = Math.ceil(Math.sqrt(n)); gridRows = Math.ceil(n / gridCols); }

    const mTop    = baseMarginMM + (extraMarginSide==='top'    ? extraMarginMM : 0);
    const mBottom = baseMarginMM + (extraMarginSide==='bottom' ? extraMarginMM : 0);
    const mLeft   = baseMarginMM + (extraMarginSide==='left'   ? extraMarginMM : 0);
    const mRight  = baseMarginMM + (extraMarginSide==='right'  ? extraMarginMM : 0);
    const areaW = pW - mLeft - mRight;
    const areaH = pH - mTop  - mBottom;
    const cellW = (areaW - (gridCols-1)*gapMM) / gridCols;
    const cellH = (areaH - (gridRows-1)*gapMM) / gridRows;

    const imageCache = new Map();
    const getJpeg = (cv) => {
      if (!imageCache.has(cv)) {
        const flat = document.createElement('canvas');
        flat.width = cv.width; flat.height = cv.height;
        const flatCtx = flat.getContext('2d');
        flatCtx.fillStyle = '#ffffff';
        flatCtx.fillRect(0, 0, flat.width, flat.height);
        flatCtx.drawImage(cv, 0, 0);
        imageCache.set(cv, flat.toDataURL('image/jpeg', 0.92));
      }
      return imageCache.get(cv);
    };

    for (let i = 0; i < n; i++) {
      const col = i % gridCols, row = Math.floor(i / gridCols);
      const cellXMM = mLeft + col*(cellW+gapMM);
      const cellYMM = mTop  + row*(cellH+gapMM);
      const cv = allCanvases[i];
      const imgAspect = cv.width / cv.height;
      const cellAspect = cellW / cellH;
      let drawW, drawH;
      if (imgAspect > cellAspect) { drawW = cellW; drawH = cellW / imgAspect; }
      else                         { drawH = cellH; drawW = cellH * imgAspect; }
      const xMM = cellXMM + (cellW - drawW) / 2;
      const yMM = cellYMM + (cellH - drawH) / 2;
      pdf.addImage(getJpeg(cv), 'JPEG', xMM, yMM, drawW, drawH, undefined, 'FAST');
    }

    openPdfForPrint(pdf.output('blob'));
  }

  /* ============================================================
     PHOTO MAKER PERSISTENCE
     Save all persons' images + edit states + layout settings
     so work survives navigation to app.html or other sections.
  ============================================================ */
  const MP_STORAGE_KEY = 'ds_mp_v1';

  function saveMpState() {
    try {
      const personsData = persons.slice(0, 4).map(p => {
        if (!p.img) return null;
        // Get image src — it was loaded via FileReader so it's a data URL
        const imgSrc = p.img.src;
        if (!imgSrc || !imgSrc.startsWith('data:')) return null;
        return {
          imgSrc,
          // Also save the resultCanvas so we can show the exact edited preview immediately
          resultSrc: p.resultCanvas ? p.resultCanvas.toDataURL('image/jpeg', 0.85) : null,
          state: Object.assign({}, p.state),
          bgColor: p.bgColor,
          bgStatus: p.bgStatus,
          bgMode: p.bgMode,
        };
      });
      // Only save if at least one person has an image
      if (!personsData.some(Boolean)) { localStorage.removeItem(MP_STORAGE_KEY); return; }
      localStorage.setItem(MP_STORAGE_KEY, JSON.stringify({
        personCount, orient, mpPaperSize, mpCustomPW, mpCustomPH, mpImgDir, mpCorner,
        persons: personsData,
      }));
    } catch(e) { console.warn('saveMpState failed:', e); }
  }

  function restoreMpState() {
    if (!document.getElementById('mpPersonsContainer')) return;
    try {
      const raw = localStorage.getItem(MP_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.persons)) return;

      // Restore layout settings
      if (saved.orient)      orient      = saved.orient;
      if (saved.mpPaperSize) mpPaperSize = saved.mpPaperSize;
      if (saved.mpCustomPW)  mpCustomPW  = saved.mpCustomPW;
      if (saved.mpCustomPH)  mpCustomPH  = saved.mpCustomPH;
      if (saved.mpImgDir)    mpImgDir    = saved.mpImgDir;
      if (saved.mpCorner)    mpCorner    = saved.mpCorner;

      let pending = 0;

      saved.persons.forEach((pd, pi) => {
        if (!pd || !pd.imgSrc) return;
        pending++;
        const img = new Image();
        img.onload = () => {
          persons[pi].img = img;
          if (pd.state) Object.assign(persons[pi].state, pd.state);
          persons[pi].bgColor  = pd.bgColor  || 'transparent';
          persons[pi].bgStatus = pd.bgStatus || '';
          persons[pi].bgMode   = pd.bgMode   || 'local';
          // Restore resultCanvas from saved resultSrc
          if (pd.resultSrc) {
            const ri = new Image();
            ri.onload = () => {
              const rc = document.createElement('canvas');
              rc.width = ri.naturalWidth; rc.height = ri.naturalHeight;
              rc.getContext('2d').drawImage(ri, 0, 0);
              persons[pi].resultCanvas = rc;
              pending--;
              if (pending === 0) _finishMpRestore(saved);
            };
            ri.onerror = () => { pending--; if (pending === 0) _finishMpRestore(saved); };
            ri.src = pd.resultSrc;
          } else {
            pending--;
            if (pending === 0) _finishMpRestore(saved);
          }
        };
        img.onerror = () => { pending--; if (pending === 0) _finishMpRestore(saved); };
        img.src = pd.imgSrc;
      });

      if (pending === 0) _finishMpRestore(saved);
    } catch(e) {
      console.warn('restoreMpState failed:', e);
      localStorage.removeItem(MP_STORAGE_KEY);
    }
  }

  function _finishMpRestore(saved) {
    // Re-initialise UI with restored data
    setOrient(orient);
    setMpPaperSize(mpPaperSize);
    setMpImgDir(mpImgDir);
    setMpCorner(mpCorner);
    // Restore custom dims UI
    if (mpPaperSize === 'custom') {
      const wEl = document.getElementById('mpCustomPW');
      const hEl = document.getElementById('mpCustomPH');
      if (wEl) wEl.value = mpCustomPW;
      if (hEl) hEl.value = mpCustomPH;
    }
    // setPersonCount re-renders the cards and fires refreshPreview
    setPersonCount(saved.personCount || 1);
  }

  document.addEventListener('DOMContentLoaded', () => {
    init();
    // Restore any in-progress photo maker session (after init builds the persons array)
    setTimeout(restoreMpState, 400);
  });

  async function mpSendToApp() {
    const sel = document.getElementById('mpSingleImgSelector');
    const pi = sel ? parseInt(sel.value) : 0;
    const p = persons[pi] && persons[pi].resultCanvas ? persons[pi] : persons.slice(0, personCount).find(pr => pr.resultCanvas);
    if (!p || !p.resultCanvas) { toast('Upload and edit a photo first.', 'error'); return; }
    const cv = p.resultCanvas;
    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(cv, 0, 0);
    const dataUrl = out.toDataURL('image/jpeg', 0.92);
    const ok = await DSTransfer.save({src: dataUrl, name: 'photo_maker_photo'});
    if(!ok){
      toast('Image too large to transfer — try downloading instead.', 'error'); return;
    }
    window.location.href = 'app.html';
  }

  return {setPersonCount, setOrient, loadFile, onDrop, rotate, setRotation, flip, applyCrop, clearCrop,
          setSize, setSizeRaw, deltaCount, clearPerson, clearPhotoMakerPage, setBgMode, removeBg, fillBg, restoreBg,
          refreshPreview, refreshSingleImagePreview, downloadSingleImageFromSelector, downloadPDF, downloadFillPagePDF, downloadSingleImage,
          mpSetSingleQuality,
          printPDF, printFillPagePDF,
          setMpPaperSize, setMpCustomDim, setMpImgDir, setMpCorner, mpSetBrightness, mpSendToApp};
})();

/* ============================================================
   INIT — start the app immediately, no auth required.
============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  // Expose OnlineGuard globally so the overlay button can call it
  window.OnlineGuard = OnlineGuard;

  // Run the online check before anything else
  OnlineGuard.init();

  // Show landing page if on index.html
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
    const lp = document.getElementById('landing-page');
    if (lp) lp.style.display = 'flex';
  }

  // On app.html: restore persisted state (docs + images), then check for pending sends
  if (path.endsWith('app.html')) {

    // Inject the persistent pending-send banner into the page
    const bannerHtml = `
      <div id="ds-pending-banner" style="display:none;align-items:center;gap:12px;background:linear-gradient(90deg,rgba(249,107,63,0.13),rgba(249,107,63,0.06));border:1.5px solid rgba(249,107,63,0.35);border-radius:12px;padding:12px 16px;margin-bottom:16px;flex-wrap:wrap">
        <span style="font-size:18px">📎</span>
        <span style="flex:1;font-size:13.5px;color:var(--text,#1e2c40)">
          Image ready to place: <strong class="ds-pending-name" style="color:var(--accent,#f96b3f)"></strong>
        </span>
        <button class="btn-primary" style="font-size:12px;padding:7px 14px" onclick="openPendingSendPicker()">📤 Choose Slot</button>
        <button class="btn-ghost" style="font-size:12px;padding:7px 10px" onclick="dismissPendingSend()" title="Discard this image">✕</button>
      </div>`;
    const docsList = document.getElementById('documentsList');
    if (docsList) docsList.insertAdjacentHTML('beforebegin', bannerHtml);

    // Restore saved state; fall back to 2 default empty cards if nothing saved
    restoreAppState(restored => {
      if (!restored || state.docs.length === 0) {
        addDocument(false); // two-sided card 1
        addDocument(false); // two-sided card 2
      } else {
        // Re-render with restored docs and kick off estimates + previews
        renderDocuments();
        state.docs.forEach(doc => {
          schedulePreviewDraw(doc);
          scheduleDocEstimate(doc);
        });
        updateBatchActions();
      }

      // Check for a pending send from tools.html (stored in IndexedDB via DSTransfer,
      // which has a far larger quota than localStorage and won't choke on big edits).
      DSTransfer.load().then(data => {
        if (!data) {
          // Legacy fallback: older sends (or anything that slipped through before
          // this fix) may still be sitting in the old localStorage key.
          const legacy = localStorage.getItem('ds_pending_send');
          if (legacy) {
            try {
              data = JSON.parse(legacy);
              localStorage.removeItem('ds_pending_send');
            } catch(e) { data = null; }
          }
        }
        if (data) {
          setTimeout(() => {
            _pendingSendImg = data;
            _updatePendingBanner();
            // Auto-open slot picker so user sees placement options immediately
            renderSlotPicker();
            const sp = document.getElementById('slotPicker');
            if (sp) sp.style.display = 'flex';
            DSTransfer.clear();
          }, 300);
        } else {
          _updatePendingBanner();
        }
      });
    });
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW reg failed', e));
  }
});

import './style.css';
import { PIN_SESSION_KEY, SEARCH_DEBOUNCE_MS } from './config';
import { Participante } from './types';
import { formatearFecha, getInitials, esc, playBeep, obtenerFechaActualStr } from './utils';
import { fetchParticipantes, marcarAsistenciaAPI, addToOfflineQueue, syncOfflineQueue, getOfflineQueue } from './api';
import { startScanner, stopScanner, pauseScanner, resumeScanner, isScannerActive } from './scanner';

// ── Estado ─────────────────────────────────────────────
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;
let participantesCache: Participante[] = [];
let cacheLoaded = false;
let lastSearchResults: Participante[] = [];
let pinCode = '';
let detailCurrentId = '';

// ── Elementos DOM ──────────────────────────────────────
const $pinScreen = document.getElementById('pin-screen') as HTMLDivElement;
const $mainApp = document.getElementById('main-app') as HTMLDivElement;
const $pinDots = document.getElementById('pin-dots') as HTMLDivElement;
const $pinError = document.getElementById('pin-error') as HTMLDivElement;
const $tabScanner = document.getElementById('tab-scanner') as HTMLButtonElement;
const $tabSearch = document.getElementById('tab-search') as HTMLButtonElement;
const $panelScanner = document.getElementById('panel-scanner') as HTMLDivElement;
const $panelSearch = document.getElementById('panel-search') as HTMLDivElement;
const $searchInput = document.getElementById('search-input') as HTMLInputElement;
const $searchResults = document.getElementById('search-results') as HTMLDivElement;
const $resultOverlay = document.getElementById('result-overlay') as HTMLDivElement;
const $resultIcon = document.getElementById('result-icon') as HTMLDivElement;
const $resultName = document.getElementById('result-name') as HTMLDivElement;
const $resultEvent = document.getElementById('result-event') as HTMLDivElement;
const $resultStatus = document.getElementById('result-status') as HTMLDivElement;
const $resultTime = document.getElementById('result-time') as HTMLDivElement;
const $offlineBadge = document.getElementById('offline-badge') as HTMLSpanElement;
const $offlineCount = document.getElementById('offline-count') as HTMLSpanElement;
const $btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;

// Scanner UI
const $cameraPrompt = document.getElementById('camera-prompt') as HTMLDivElement;
const $btnStartCamera = document.getElementById('btn-start-camera') as HTMLButtonElement;
const $scannerHint = document.getElementById('scanner-hint') as HTMLDivElement;

// Detail Overlay UI
const $detailOverlay = document.getElementById('detail-overlay') as HTMLDivElement;
const $detailClose = document.getElementById('detail-close') as HTMLButtonElement;
const $detailAvatar = document.getElementById('detail-avatar') as HTMLDivElement;
const $detailName = document.getElementById('detail-name') as HTMLHeadingElement;
const $detailId = document.getElementById('detail-id') as HTMLSpanElement;
const $detailEvento = document.getElementById('detail-evento') as HTMLTableCellElement;
const $detailCorreo = document.getElementById('detail-correo') as HTMLTableCellElement;
const $detailCurp = document.getElementById('detail-curp') as HTMLTableCellElement;
const $detailInstitucion = document.getElementById('detail-institucion') as HTMLTableCellElement;
const $detailTelefono = document.getElementById('detail-telefono') as HTMLTableCellElement;
const $detailPerfil = document.getElementById('detail-perfil') as HTMLTableCellElement;
const $detailAsistencia = document.getElementById('detail-asistencia') as HTMLTableCellElement;
const $detailAsistenciaRow = document.getElementById('detail-asistencia-row') as HTMLTableRowElement;
const $detailBtnMarcar = document.getElementById('detail-btn-marcar') as HTMLButtonElement;


// ════════════════════════════════════════════════════════
//  PIN
// ════════════════════════════════════════════════════════

if (sessionStorage.getItem(PIN_SESSION_KEY) === '1') {
  showApp();
}

const keypad = document.querySelector('.pin-keypad');
if (keypad) {
  keypad.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('.key') as HTMLButtonElement;
    if (!btn) return;
    const key = btn.getAttribute('data-key');
    if (!key) return;

    if (key === 'del') {
      pinCode = pinCode.slice(0, -1);
      updatePinDots();
      return;
    }

    if (pinCode.length >= 4) return;
    pinCode += key;
    updatePinDots();

    if (pinCode.length === 4) {
      $pinError.style.color = 'var(--text-secondary)';
      $pinError.textContent = 'Verificando...';
      validatePin(pinCode);
    }
  });
}

function updatePinDots() {
  const dots = $pinDots.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinCode.length);
    dot.classList.remove('error');
  });
  $pinError.textContent = '';
}

function validatePin(pin: string) {
  $pinError.style.color = ''; 
  if (pin === '2026') {
    sessionStorage.setItem(PIN_SESSION_KEY, '1');
    showApp();
  } else {
    pinCode = '';
    const dots = $pinDots.querySelectorAll('.dot');
    dots.forEach((dot) => {
      dot.classList.remove('filled');
      dot.classList.add('error');
    });
    $pinError.textContent = 'PIN incorrecto';
    setTimeout(() => {
      dots.forEach((dot) => dot.classList.remove('error'));
    }, 600);
  }
}

function showApp() {
  $pinScreen.classList.remove('active');
  $mainApp.classList.add('active');
  cargarParticipantes();
  syncOfflineQueue(updateOfflineBadge);
  updateOfflineBadge();
}

// ════════════════════════════════════════════════════════
//  TABS
// ════════════════════════════════════════════════════════

$tabScanner.addEventListener('click', () => switchTab('scanner'));
$tabSearch.addEventListener('click', () => switchTab('search'));

function switchTab(tab: 'scanner' | 'search') {
  const isScanner = tab === 'scanner';
  $tabScanner.classList.toggle('active', isScanner);
  $tabSearch.classList.toggle('active', !isScanner);
  $panelScanner.classList.toggle('active', isScanner);
  $panelSearch.classList.toggle('active', !isScanner);

  if (!isScanner) {
    stopScanner();
    $cameraPrompt.classList.remove('hidden');
    $scannerHint.textContent = 'Toca para iniciar el escáner QR';
    setTimeout(() => { $searchInput.focus(); }, 200);
  }
}

// ════════════════════════════════════════════════════════
//  QR SCANNER
// ════════════════════════════════════════════════════════

$btnStartCamera.addEventListener('click', () => {
  $cameraPrompt.classList.add('hidden');
  startScanner(
    onQrScanned,
    (msg) => { $scannerHint.textContent = msg; },
    () => { $cameraPrompt.classList.remove('hidden'); }
  );
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (isScannerActive()) {
      stopScanner();
      $cameraPrompt.classList.remove('hidden');
      $scannerHint.textContent = 'Cámara en pausa - Toca para reanudar';
    }
  }
});

function onQrScanned(decodedText: string) {
  if (isProcessing) return;
  isProcessing = true;

  pauseScanner();

  if (navigator.vibrate) navigator.vibrate(100);
  playBeep();

  const id = decodedText.trim().toUpperCase();
  markAttendance(id);
}

// ════════════════════════════════════════════════════════
//  SEARCH (local cache)
// ════════════════════════════════════════════════════════

function cargarParticipantes() {
  fetchParticipantes()
    .then((data) => {
      participantesCache = [];
      if (data && data.registros) {
        data.registros.forEach((reg) => {
          participantesCache.push({
            id: reg.id_participante,
            nombre: reg.nombre,
            evento: reg.taller,
            correo: reg.correo,
            curp: reg.curp,
            telefono: reg.telefono,
            institucion: reg.institucion,
            perfil: reg.perfil,
            asistencia: reg.asistio ? formatearFecha(reg.fecha_asistencia) : null
          });
        });
      }
      cacheLoaded = true;
      if ($tabSearch.classList.contains('active')) {
        onSearchInput();
      }
    })
    .catch((error) => {
      console.error('Error API:', error);
    });
}

function onSearchInput() {
  const q = $searchInput.value.trim().toLowerCase();
  if (q.length < 2) {
    showSearchEmpty('Escribe al menos 2 caracteres');
    return;
  }

  if (!cacheLoaded) {
    showSearchEmpty('Cargando datos...');
    cargarParticipantes();
    return;
  }

  const resultados: Participante[] = [];
  for (let i = 0; i < participantesCache.length; i++) {
    const p = participantesCache[i];
    const coincide = p.id.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q);
    if (coincide) {
      resultados.push(p);
      if (resultados.length >= 20) break;
    }
  }

  if (resultados.length) {
    renderSearchResults(resultados);
  } else {
    showSearchEmpty('Sin resultados');
  }
}

function handleSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(onSearchInput, SEARCH_DEBOUNCE_MS);
}
$searchInput.addEventListener('input', handleSearchInput);
$searchInput.addEventListener('change', handleSearchInput);

function renderSearchResults(results: Participante[]) {
  let html = '';
  results.forEach((r, i) => {
    const initials = getInitials(r.nombre);
    const yaReg = !!r.asistencia;
    html +=
      `<div class="result-item ${yaReg ? ' ya-registrado' : ''}" data-idx="${i}">` +
        `<div class="result-item-avatar">${esc(initials)}</div>` +
        `<div class="result-item-info">` +
          `<div class="result-item-name">${esc(r.nombre)}</div>` +
          `<div class="result-item-detail">${esc(r.id)} · ${esc(r.evento)}</div>` +
        `</div>` +
        `<span class="result-item-badge ${yaReg ? 'badge-asistio' : 'badge-pendiente'}">` +
          (yaReg ? '✓' : 'Pendiente') +
        `</span>` +
      `</div>`;
  });
  $searchResults.innerHTML = html;
  lastSearchResults = results;

  const items = $searchResults.querySelectorAll('.result-item');
  items.forEach((item) => {
    item.addEventListener('click', () => {
      const idxStr = item.getAttribute('data-idx');
      if (idxStr) {
        const idx = parseInt(idxStr, 10);
        if (!isNaN(idx) && lastSearchResults[idx]) {
          showDetail(lastSearchResults[idx]);
        }
      }
    });
  });
}

function showSearchEmpty(msg: string) {
  $searchResults.innerHTML =
    `<div class="search-empty">` +
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">` +
        `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>` +
      `</svg>` +
      `<p>${esc(msg)}</p>` +
    `</div>`;
}

// ════════════════════════════════════════════════════════
//  PARTICIPANT DETAIL
// ════════════════════════════════════════════════════════

function showDetail(p: Participante) {
  $detailAvatar.textContent = getInitials(p.nombre);
  $detailName.textContent = p.nombre;
  $detailId.textContent = p.id;
  $detailEvento.textContent = p.evento || '—';
  $detailCorreo.textContent = p.correo || '—';
  $detailCurp.textContent = p.curp || '—';
  $detailInstitucion.textContent = p.institucion || '—';
  $detailTelefono.textContent = p.telefono || '—';
  $detailPerfil.textContent = p.perfil || '—';
  detailCurrentId = p.id;

  if (p.asistencia) {
    $detailAsistenciaRow.style.display = '';
    $detailAsistencia.textContent = p.asistencia;
    $detailAsistencia.style.color = 'var(--green)';
    $detailBtnMarcar.textContent = '✓ Ya registrado';
    $detailBtnMarcar.classList.add('ya-registrado');
    $detailBtnMarcar.disabled = true;
  } else {
    $detailAsistenciaRow.style.display = 'none';
    $detailBtnMarcar.textContent = '✓ Marcar asistencia';
    $detailBtnMarcar.classList.remove('ya-registrado');
    $detailBtnMarcar.disabled = false;
  }

  $detailOverlay.classList.remove('hidden');
}

function hideDetail() {
  $detailOverlay.classList.add('hidden');
}

$detailClose.addEventListener('click', hideDetail);

$detailBtnMarcar.addEventListener('click', () => {
  if (!detailCurrentId || $detailBtnMarcar.disabled) return;
  hideDetail();
  markAttendance(detailCurrentId);
});

// ════════════════════════════════════════════════════════
//  MARK ATTENDANCE
// ════════════════════════════════════════════════════════

function markAttendance(id: string) {
  let p: Participante | null = null;
  for (let i = 0; i < participantesCache.length; i++) {
    if (participantesCache[i].id === id) { p = participantesCache[i]; break; }
  }

  if (!p) {
    isProcessing = false;
    showResult('error', id, '', 'ID no encontrado en la base de datos', '');
    return;
  }

  if (p.asistencia && !p.asistencia.includes('Pendiente')) {
    isProcessing = false;
    showResult('already', p.nombre, p.evento || '', 'Ya registrado previamente', p.asistencia);
    return;
  }

  const ahoraStr = obtenerFechaActualStr();
  actualizarCacheLocal(id, ahoraStr);

  if (navigator.onLine) {
    marcarAsistenciaAPI(id)
      .then(() => {
         isProcessing = false;
         showResult('success', p!.nombre, p!.evento || '', 'Asistencia registrada ✓', ahoraStr);
      })
      .catch(() => {
         isProcessing = false;
         addToOfflineQueue({ id, asistencia: ahoraStr });
         updateOfflineBadge();
         showResult('offline-queued', p!.nombre, p!.evento || '', 'Guardado sin conexión (Error de red)', ahoraStr);
      });
  } else {
    isProcessing = false;
    addToOfflineQueue({ id, asistencia: ahoraStr });
    updateOfflineBadge();
    showResult('offline-queued', p.nombre, p.evento || '', 'Guardado sin conexión', ahoraStr);
  }
}

function actualizarCacheLocal(id: string, valorAsistencia: string) {
  const cacheItem = participantesCache.find(x => x.id === id);
  if (cacheItem) {
    cacheItem.asistencia = valorAsistencia;
  }
  if ($tabSearch.classList.contains('active') && $searchInput.value.trim().length >= 2) {
    onSearchInput();
  }
}

// ════════════════════════════════════════════════════════
//  RESULT OVERLAY
// ════════════════════════════════════════════════════════

function showResult(type: 'success' | 'already' | 'error' | 'offline-queued', name: string, event: string, status: string, time: string) {
  const icons = {
    'success': '✓',
    'already': '⚠',
    'error': '✕',
    'offline-queued': '⏳'
  };

  $resultIcon.className = 'result-icon ' + type;
  $resultIcon.textContent = icons[type] || '?';
  $resultName.textContent = name;
  $resultEvent.textContent = event;
  $resultStatus.textContent = status;
  $resultStatus.className = 'result-status ' + (type === 'already' ? 'already' : type === 'error' ? 'error' : type === 'offline-queued' ? 'offline' : 'success');
  $resultTime.textContent = time;
  $resultOverlay.classList.remove('hidden');
}

function hideResult() {
  $resultOverlay.classList.add('hidden');
  resumeScanner();
}

$resultOverlay.addEventListener('click', hideResult);
$resultOverlay.addEventListener('touchend', (e) => {
  e.preventDefault();
  hideResult();
});

// ════════════════════════════════════════════════════════
//  OFFLINE QUEUE (UI SYNC)
// ════════════════════════════════════════════════════════

function updateOfflineBadge() {
  const queue = getOfflineQueue();
  if (queue.length > 0) {
    $offlineBadge.classList.remove('hidden');
    $offlineCount.textContent = queue.length.toString();
  } else {
    $offlineBadge.classList.add('hidden');
  }
}

window.addEventListener('online', () => {
  syncOfflineQueue(updateOfflineBadge);
});

// ════════════════════════════════════════════════════════
//  LOGOUT
// ════════════════════════════════════════════════════════

$btnLogout.addEventListener('click', () => {
  stopScanner();
  sessionStorage.removeItem(PIN_SESSION_KEY);
  $mainApp.classList.remove('active');
  $pinScreen.classList.add('active');
  pinCode = '';
  updatePinDots();
});

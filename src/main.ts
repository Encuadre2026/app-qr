import './style.css';
import { LARGO_PIN, SEARCH_DEBOUNCE_MS } from './config';
import { VERSION, vigilarActualizaciones } from './actualizacion';
import { Participante } from './types';
import { formatearFecha, getInitials, esc, playBeep, obtenerFechaActualStr } from './utils';
import {
  ErrorApi,
  addToOfflineQueue,
  fetchParticipantes,
  getOfflineQueue,
  haySesion,
  iniciarSesion,
  marcarAsistenciaAPI,
  olvidarSesion,
  syncOfflineQueue,
} from './api';
import { startScanner, stopScanner, pauseScanner, resumeScanner, isScannerActive } from './scanner';
import { buscarConRecarga, tocaRecargar } from './padron';
import { CODIGO_PAGO_PENDIENTE, decidirEscaneo, estaAprobado } from './puerta';

// ── Estado ─────────────────────────────────────────────
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let isProcessing = false;
let participantesCache: Participante[] = [];
let cacheLoaded = false;
/** Cuándo se cargó el padrón por última vez, para no pedirlo a cada rato. */
let ultimaCarga: number | null = null;
/** La carga en curso, para que dos peticiones a la vez no pidan el padrón dos veces. */
let cargaEnCurso: Promise<boolean> | null = null;
let lastSearchResults: Participante[] = [];
let pinCode = '';
let verificandoPin = false;
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
const $detailInstitucion = document.getElementById('detail-institucion') as HTMLTableCellElement;
const $detailPerfil = document.getElementById('detail-perfil') as HTMLTableCellElement;
const $detailAsistencia = document.getElementById('detail-asistencia') as HTMLTableCellElement;
const $detailPagoLabel = document.getElementById('detail-pago-label') as HTMLSpanElement;
const $detailPago = document.getElementById('detail-pago') as HTMLSpanElement;
const $detailAsistenciaRow = document.getElementById('detail-asistencia-row') as HTMLTableRowElement;
const $detailBtnMarcar = document.getElementById('detail-btn-marcar') as HTMLButtonElement;


vigilarActualizaciones();

const $version = document.getElementById('app-version');
if ($version) $version.textContent = `v${VERSION}`;

// ════════════════════════════════════════════════════════
//  PIN
// ════════════════════════════════════════════════════════

// El PIN ya no se compara aquí. Estaba escrito en el código —`pin === '2026'`,
// el año del evento— y por tanto viajaba en el paquete público, igual que el
// secreto de administración: no protegía nada, solo tapaba la pantalla. Ahora
// se envía al Worker, que lo valida contra un secreto que nunca sale de allí y
// devuelve un token temporal.
if (haySesion()) {
  showApp();
}

const keypad = document.querySelector('.pin-keypad');
if (keypad) {
  keypad.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('.key') as HTMLButtonElement;
    if (!btn || verificandoPin) return;
    const key = btn.getAttribute('data-key');
    if (!key) return;

    if (key === 'del') {
      pinCode = pinCode.slice(0, -1);
      updatePinDots();
      return;
    }

    if (pinCode.length >= LARGO_PIN) return;
    pinCode += key;
    updatePinDots();

    if (pinCode.length === LARGO_PIN) {
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

/** Vacía los puntitos y los marca en rojo un instante. */
function rechazarPin(mensaje: string) {
  pinCode = '';
  const dots = $pinDots.querySelectorAll('.dot');
  dots.forEach((dot) => {
    dot.classList.remove('filled');
    dot.classList.add('error');
  });
  $pinError.style.color = '';
  $pinError.textContent = mensaje;
  setTimeout(() => {
    dots.forEach((dot) => dot.classList.remove('error'));
  }, 600);
}

async function validatePin(pin: string) {
  verificandoPin = true;
  $pinError.style.color = 'var(--text-secondary)';
  $pinError.textContent = 'Verificando...';

  try {
    await iniciarSesion(pin);
    pinCode = '';
    $pinError.textContent = '';
    showApp();
  } catch (err) {
    // El servidor distingue entre un PIN equivocado, demasiados intentos y no
    // haber podido hablar con él. Antes los tres casos habrían sido el mismo
    // «PIN incorrecto», que manda a la persona a probar otro PIN cuando el
    // problema puede estar en la red o en que hay que esperar un minuto.
    const fallo = err instanceof ErrorApi ? err : new ErrorApi('No se pudo verificar el PIN.');
    rechazarPin(fallo.message);
  } finally {
    verificandoPin = false;
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
    return;
  }

  // Al volver a la app se pide el padrón otra vez, como mucho una vez por
  // minuto: así llegan los talleres editados desde el panel y la gente que se
  // inscribió mientras el teléfono estaba en otra cosa.
  if ($mainApp.classList.contains('active') && haySesion() && tocaRecargar(ultimaCarga, Date.now())) {
    cargarParticipantes();
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

/**
 * Pide el padrón y lo deja en la caché local. Devuelve si salió bien.
 *
 * Si ya hay una carga en marcha, espera a esa en vez de lanzar otra: al volver
 * a la app y escanear enseguida coinciden las dos.
 */
function cargarParticipantes(): Promise<boolean> {
  cargaEnCurso ??= pedirParticipantes().finally(() => {
    cargaEnCurso = null;
  });
  return cargaEnCurso;
}

async function pedirParticipantes(): Promise<boolean> {
  try {
    const data = await fetchParticipantes();
    participantesCache = data.participantes.map((reg) => ({
      id: reg.id_participante,
      nombre: reg.nombre,
      evento: reg.taller,
      institucion: reg.institucion,
      perfil: reg.perfil,
      aprobado: estaAprobado(reg.pago_aprobado),
      // `formatearFecha` devuelve null si la fecha no se puede leer, y quien ya
      // entró tiene que seguir constando como dentro aunque sin hora.
      asistencia: reg.asistio ? (formatearFecha(reg.fecha_asistencia) ?? 'sí') : null,
    }));
    cacheLoaded = true;
    ultimaCarga = Date.now();
    if ($tabSearch.classList.contains('active')) {
      onSearchInput();
    }
    return true;
  } catch (err) {
    // Antes esto solo hacía `console.error`, así que si la carga fallaba la
    // app se quedaba con la búsqueda vacía y sin decir por qué.
    console.error('Error API:', err);
    if (err instanceof ErrorApi && err.esSesionInvalida) {
      volverAlPin('Tu sesión expiró. Vuelve a introducir el PIN.');
      return false;
    }
    if ($tabSearch.classList.contains('active')) {
      showSearchEmpty(
        err instanceof ErrorApi ? err.message : 'No se pudieron cargar los participantes.'
      );
    }
    return false;
  }
}

/** Cierra la sesión y devuelve al teclado, explicando por qué. */
function volverAlPin(motivo: string) {
  stopScanner();
  olvidarSesion();
  participantesCache = [];
  cacheLoaded = false;
  ultimaCarga = null;
  pinCode = '';
  $mainApp.classList.remove('active');
  $pinScreen.classList.add('active');
  updatePinDots();
  $pinError.style.color = '';
  $pinError.textContent = motivo;
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
    // Tres estados y no dos: «Pendiente» es que todavía no ha entrado; «Sin
    // aprobar» es que, según el último padrón, no puede entrar.
    const insignia = yaReg
      ? { clase: 'badge-asistio', texto: '✓' }
      : r.aprobado
        ? { clase: 'badge-pendiente', texto: 'Pendiente' }
        : { clase: 'badge-sin-aprobar', texto: 'Sin aprobar' };
    html +=
      `<div class="result-item ${yaReg ? ' ya-registrado' : ''}" data-idx="${i}">` +
        `<div class="result-item-avatar">${esc(initials)}</div>` +
        `<div class="result-item-info">` +
          `<div class="result-item-name">${esc(r.nombre)}</div>` +
          `<div class="result-item-detail">${esc(r.id)} · ${esc(r.evento)}</div>` +
        `</div>` +
        `<span class="result-item-badge ${insignia.clase}">${insignia.texto}</span>` +
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
  $detailInstitucion.textContent = p.institucion || '—';
  $detailPerfil.textContent = p.perfil || '—';
  $detailPagoLabel.textContent = esAsamblea(p) ? 'Acreditación' : 'Pago';
  $detailPago.textContent = p.aprobado ? 'Aprobado' : 'Sin aprobar: a la mesa de registro';
  $detailPago.style.color = p.aprobado ? 'var(--green)' : 'var(--red)';
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

function buscarEnCache(id: string): Participante | null {
  return participantesCache.find((p) => p.id === id) ?? null;
}

function markAttendance(id: string) {
  const p = buscarEnCache(id);
  if (p) {
    registrarAsistencia(id, p);
    return;
  }

  // Quien se inscribió después de teclear el PIN —o en un taller agregado hoy
  // desde el panel— no está en el padrón que se cargó al entrar. Antes de
  // decir «no encontrado» se pide el padrón otra vez, una sola. Sin red no hay
  // a quién preguntar, y se dice lo de siempre.
  const noEncontrado = () => {
    isProcessing = false;
    showResult('error', id, '', 'ID no encontrado en la base de datos', '');
  };
  if (!navigator.onLine) {
    noEncontrado();
    return;
  }
  buscarConRecarga(() => buscarEnCache(id), cargarParticipantes).then((encontrado) => {
    // Si la recarga descubrió que la sesión caducó, la app ya volvió al PIN y
    // no hay resultado que enseñar.
    if (!haySesion()) {
      isProcessing = false;
      return;
    }
    if (encontrado) registrarAsistencia(id, encontrado);
    else noEncontrado();
  });
}

/** La asamblea no paga: lo que se le aprueba es la acreditación. */
function esAsamblea(p: Participante): boolean {
  return p.perfil === 'Asambleísta Encuadre';
}

/** «Pago» o «Acreditación», para que el mensaje hable de lo que de verdad falta. */
function queFalta(p: Participante): string {
  return esAsamblea(p) ? 'Acreditación' : 'Pago';
}

/** Sin red no se puede preguntar si la aprobaron hace un momento, y se dice así. */
function avisarPendienteSinRed(p: Participante) {
  showResult(
    'pendiente',
    p.nombre,
    p.evento || '',
    `${queFalta(p)} sin aprobar según la última lista. Sin conexión no se puede comprobar: envía a la persona a la mesa de registro.`,
    ''
  );
}

function registrarAsistencia(id: string, p: Participante) {
  const decision = decidirEscaneo(p, navigator.onLine);

  if (decision === 'ya-registrado') {
    isProcessing = false;
    showResult('already', p.nombre, p.evento || '', 'Ya registrado previamente', p.asistencia || '');
    return;
  }

  // Quien no tiene el pago aprobado no entra, y sin red no hay a quién
  // preguntarle si lo aprobaron después de cargar el padrón. Tampoco se encola:
  // dejarlo pasar ahora y «registrarlo» después sería lo mismo que no mirar.
  if (decision === 'pendiente-sin-red') {
    isProcessing = false;
    avisarPendienteSinRed(p);
    return;
  }

  const ahoraStr = obtenerFechaActualStr();
  const asistenciaPrevia = p.asistencia;

  if (decision === 'encolar') {
    isProcessing = false;
    actualizarCacheLocal(id, ahoraStr);
    addToOfflineQueue({ id, asistencia: ahoraStr });
    updateOfflineBadge();
    showResult('offline-queued', p.nombre, p.evento || '', 'Guardado sin conexión', ahoraStr);
    return;
  }

  // Con red decide el servidor, también para quien el padrón da por pendiente:
  // pueden haberlo aprobado hace un minuto en la mesa de registro. La marca
  // optimista de la caché solo se pone a quien se espera que entre.
  if (p.aprobado) actualizarCacheLocal(id, ahoraStr);

  marcarAsistenciaAPI(id)
    .then(() => {
      isProcessing = false;
      // Si entró, su pago está aprobado aunque el padrón dijera otra cosa.
      p.aprobado = true;
      actualizarCacheLocal(id, ahoraStr);
      showResult('success', p.nombre, p.evento || '', 'Asistencia registrada ✓', ahoraStr);
    })
    .catch((err) => {
      isProcessing = false;
      const fallo = err instanceof ErrorApi ? err : new ErrorApi('No se pudo registrar la asistencia.');

      // Solo se encola lo que falló por falta de red. Antes se encolaba
      // cualquier fallo y se anunciaba como «guardado sin conexión»: una
      // sesión caducada o un participante inexistente quedaban en la cola
      // para siempre mientras al personal se le decía que había quedado
      // registrado. Y solo a quien se sabe aprobado, por lo mismo que arriba.
      if (fallo.esDeRed) {
        if (!p.aprobado) {
          avisarPendienteSinRed(p);
          return;
        }
        addToOfflineQueue({ id, asistencia: ahoraStr });
        updateOfflineBadge();
        showResult('offline-queued', p.nombre, p.evento || '', 'Guardado sin conexión', ahoraStr);
        return;
      }

      // No se registró, así que la marca optimista de la caché se deshace.
      actualizarCacheLocal(id, asistenciaPrevia);

      if (fallo.esSesionInvalida) {
        volverAlPin('Tu sesión expiró. Vuelve a introducir el PIN.');
        return;
      }

      if (fallo.codigo === CODIGO_PAGO_PENDIENTE) {
        p.aprobado = false;
        showResult('pendiente', p.nombre, p.evento || '', fallo.message, '');
        return;
      }

      showResult('error', p.nombre, p.evento || '', fallo.message, '');
    });
}

function actualizarCacheLocal(id: string, valorAsistencia: string | null) {
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

/**
 * `pendiente` es «no puede entrar todavía»: no es un fallo de la app ni del
 * registro, y por eso no comparte el aspa de `error` con «ID no encontrado».
 */
type TipoDeResultado = 'success' | 'already' | 'error' | 'offline-queued' | 'pendiente';

function showResult(type: TipoDeResultado, name: string, event: string, status: string, time: string) {
  const icons: Record<TipoDeResultado, string> = {
    'success': '✓',
    'already': '⚠',
    'error': '✕',
    'offline-queued': '⏳',
    'pendiente': '!'
  };
  const clasesDeEstado: Record<TipoDeResultado, string> = {
    'success': 'success',
    'already': 'already',
    'error': 'error',
    'offline-queued': 'offline',
    'pendiente': 'pendiente'
  };

  $resultIcon.className = 'result-icon ' + type;
  $resultIcon.textContent = icons[type];
  $resultName.textContent = name;
  $resultEvent.textContent = event;
  $resultStatus.textContent = status;
  $resultStatus.className = 'result-status ' + clasesDeEstado[type];
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
  olvidarSesion();
  $mainApp.classList.remove('active');
  $pinScreen.classList.add('active');
  pinCode = '';
  updatePinDots();
});

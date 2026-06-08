// @ts-nocheck
/* ════════════════════════════════════════════════════════════
   App QR — Lógica Principal
   ════════════════════════════════════════════════════════════ */

import './style.css';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

  

  // ── CONFIGURACIÓN DE LA API ──────────────────────────
  let API_URL = "https://encuadre-2026-api.sitio-392.workers.dev";
  // IMPORTANTE: Pon aquí la misma contraseña que pusiste en Cloudflare
  const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || ''; 

  let OFFLINE_QUEUE_KEY = 'qr_asistencia_offline_queue';
  let PIN_SESSION_KEY = 'qr_asistencia_pin_ok';
  let SEARCH_DEBOUNCE_MS = 400;

  // ── Estado ─────────────────────────────────────────────
  let qrScanner = null;
  let scannerActive = false;
  let searchTimer = null;
  let isProcessing = false;

  // ── Elementos DOM ──────────────────────────────────────
  let $pinScreen = document.getElementById('pin-screen');
  let $mainApp = document.getElementById('main-app');
  let $pinDots = document.getElementById('pin-dots');
  let $pinError = document.getElementById('pin-error');
  let $tabScanner = document.getElementById('tab-scanner');
  let $tabSearch = document.getElementById('tab-search');
  let $panelScanner = document.getElementById('panel-scanner');
  let $panelSearch = document.getElementById('panel-search');
  let $searchInput = document.getElementById('search-input');
  let $searchResults = document.getElementById('search-results');
  let $resultOverlay = document.getElementById('result-overlay');
  let $resultIcon = document.getElementById('result-icon');
  let $resultName = document.getElementById('result-name');
  let $resultEvent = document.getElementById('result-event');
  let $resultStatus = document.getElementById('result-status');
  let $resultTime = document.getElementById('result-time');
  let $offlineBadge = document.getElementById('offline-badge');
  let $offlineCount = document.getElementById('offline-count');
  let $btnLogout = document.getElementById('btn-logout');

  let pinCode = '';

  // ════════════════════════════════════════════════════════
  //  PIN
  // ════════════════════════════════════════════════════════

  // Check saved session
  if (sessionStorage.getItem(PIN_SESSION_KEY) === '1') {
    showApp();
  }

  // Keypad clicks
  document.querySelector('.pin-keypad').addEventListener('click', function (e) {
    let btn = e.target.closest('.key');
    if (!btn) return;
    let key = btn.getAttribute('data-key');
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

  function updatePinDots() {
    let dots = $pinDots.querySelectorAll('.dot');
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('filled', i < pinCode.length);
      dots[i].classList.remove('error');
    }
    $pinError.textContent = '';
  }

  function validatePin(pin) {
    $pinError.style.color = ''; // Restaurar color original
    if (pin === '2026') {
      sessionStorage.setItem(PIN_SESSION_KEY, '1');
      showApp();
    } else {
      pinCode = '';
      let dots = $pinDots.querySelectorAll('.dot');
      for (let i = 0; i < dots.length; i++) {
        dots[i].classList.remove('filled');
        dots[i].classList.add('error');
      }
      $pinError.textContent = 'PIN incorrecto';
      setTimeout(function () {
        for (let j = 0; j < dots.length; j++) dots[j].classList.remove('error');
      }, 600);
    }
  }

  function showApp() {
    $pinScreen.classList.remove('active');
    $mainApp.classList.add('active');
    // No auto-start scanner; show button and wait for user tap
    cargarParticipantes();
    syncOfflineQueue();
    updateOfflineBadge();
  }

  // ════════════════════════════════════════════════════════
  //  TABS
  // ════════════════════════════════════════════════════════

  $tabScanner.addEventListener('click', function () {
    switchTab('scanner');
  });

  $tabSearch.addEventListener('click', function () {
    switchTab('search');
  });

  function switchTab(tab) {
    let isScanner = tab === 'scanner';
    $tabScanner.classList.toggle('active', isScanner);
    $tabSearch.classList.toggle('active', !isScanner);
    $panelScanner.classList.toggle('active', isScanner);
    $panelSearch.classList.toggle('active', !isScanner);

    if (!isScanner) {
      stopScanner();
      $cameraPrompt.classList.remove('hidden');
      $scannerHint.textContent = 'Toca para iniciar el escáner QR';
      setTimeout(function () { $searchInput.focus(); }, 200);
    }
  }

  // ════════════════════════════════════════════════════════
  //  QR SCANNER
  // ════════════════════════════════════════════════════════

  let $cameraPrompt = document.getElementById('camera-prompt');
  let $btnStartCamera = document.getElementById('btn-start-camera');
  let $scannerHint = document.getElementById('scanner-hint');

  $btnStartCamera.addEventListener('click', function () {
    startScanner();
  });

  function startScanner() {
    if (scannerActive) return;
    if (typeof Html5Qrcode === 'undefined') {
      $scannerHint.textContent = 'Error: librería QR no cargada. Recarga la página.';
      return;
    }

    // Check basic camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $scannerHint.textContent = 'Tu navegador no soporta cámara. Prueba con Chrome.';
      return;
    }

    // Hide prompt, show scanner
    $cameraPrompt.classList.add('hidden');
    $scannerHint.textContent = 'Solicitando permiso de cámara...';

    // Clean previous instance
    if (qrScanner) {
      try { qrScanner.clear(); } catch(e) {}
    }

    qrScanner = new Html5Qrcode('qr-reader', {
      formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
      useBarCodeDetectorIfSupported: true,
      verbose: false
    });
    let config = {
      fps: 10, // Reducido de 25 a 10 para evitar sobrecarga del CPU en celulares
      qrbox: { width: 250, height: 250 }, // Limita el área de análisis, haciéndolo mucho más rápido
      disableFlip: true
    };

    // Try back camera first, fallback to any camera
    qrScanner.start(
      { facingMode: 'environment' },
      config,
      onQrScanned,
      function () {}
    ).then(function () {
      scannerActive = true;
      $scannerHint.textContent = 'Apunta al código QR del participante';
    }).catch(function (err) {
      console.error('Back camera failed, trying any camera:', err);
      $scannerHint.textContent = 'Intentando cámara alternativa...';
      // Fallback: try any available camera
      qrScanner.start(
        { facingMode: 'user' },
        config,
        onQrScanned,
        function () {}
      ).then(function () {
        scannerActive = true;
        $scannerHint.textContent = 'Usando cámara frontal - apunta al QR';
      }).catch(function (err2) {
        console.error('All cameras failed:', err2);
        $cameraPrompt.classList.remove('hidden');
        $scannerHint.textContent = 'Error: ' + String(err2.message || err2);
      });
    });
  }

  function stopScanner() {
    if (!scannerActive || !qrScanner) return;
    qrScanner.stop().then(function () {
      scannerActive = false;
      qrScanner.clear();
    }).catch(function () {
      scannerActive = false;
    });
  }

  // Detener cámara cuando la app pasa a segundo plano o se minimiza el navegador
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      if (scannerActive) {
        stopScanner();
        $cameraPrompt.classList.remove('hidden');
        $scannerHint.textContent = 'Cámara en pausa - Toca para reanudar';
      }
    }
  });

  // Web Audio API beep para feedback
  let audioCtx = null;
  function playBeep() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      let osc = audioCtx.createOscillator();
      let gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono agradable
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Volumen suave
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1); // 100ms
    } catch (e) {}
  }

  function onQrScanned(decodedText) {
    if (isProcessing) return;
    isProcessing = true;

    // Pause scanner while processing
    if (qrScanner && scannerActive) {
      qrScanner.pause(true);
    }

    // Vibrate and beep for feedback
    if (navigator.vibrate) navigator.vibrate(100);
    playBeep();

    let id = decodedText.trim().toUpperCase();
    markAttendance(id);
  }

  // ════════════════════════════════════════════════════════
  //  SEARCH (local cache for instant results)
  // ════════════════════════════════════════════════════════

  let participantesCache = [];
  let cacheLoaded = false;

  function formatearFecha(dateStr) {
    if (!dateStr) return null;
    let d = new Date(dateStr);
    let pad = function(n) { return (n < 10 ? '0' : '') + n; };
    return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes());
  }

  function cargarParticipantes() {
    fetch(API_URL + '/api/admin/registros', {
      headers: { 'Authorization': 'Bearer ' + ADMIN_SECRET }
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Error de red');
      return res.json();
    })
    .then(function(data) {
      participantesCache = [];
      if (data && data.registros) {
        for (let i = 0; i < data.registros.length; i++) {
          let reg = data.registros[i];
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
        }
      }
      cacheLoaded = true;
      if ($tabSearch.classList.contains('active')) {
        onSearchInput();
      }
    })
    .catch(function(error) {
      console.error('Error API:', error);
    });
  }

  function onSearchInput() {
    let q = $searchInput.value.trim().toLowerCase();
    if (q.length < 2) {
      showSearchEmpty('Escribe al menos 2 caracteres');
      return;
    }

    if (!cacheLoaded) {
      showSearchEmpty('Cargando datos...');
      cargarParticipantes();
      return;
    }

    // Filtrar localmente — instantáneo
    let resultados = [];
    for (let i = 0; i < participantesCache.length; i++) {
      let p = participantesCache[i];
      let coincide = p.id.toLowerCase().indexOf(q) !== -1 ||
                     p.nombre.toLowerCase().indexOf(q) !== -1;
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

  // Listen to multiple events with Debounce for better performance
  function handleSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(onSearchInput, SEARCH_DEBOUNCE_MS);
  }
  $searchInput.addEventListener('input', handleSearchInput);
  $searchInput.addEventListener('change', handleSearchInput);

  function renderSearchResults(results) {
    let html = '';
    for (let i = 0; i < results.length; i++) {
      let r = results[i];
      let initials = getInitials(r.nombre);
      let yaReg = !!r.asistencia;
      html +=
        '<div class="result-item' + (yaReg ? ' ya-registrado' : '') + '" data-idx="' + i + '">' +
          '<div class="result-item-avatar">' + esc(initials) + '</div>' +
          '<div class="result-item-info">' +
            '<div class="result-item-name">' + esc(r.nombre) + '</div>' +
            '<div class="result-item-detail">' + esc(r.id) + ' · ' + esc(r.evento) + '</div>' +
          '</div>' +
          '<span class="result-item-badge ' + (yaReg ? 'badge-asistio' : 'badge-pendiente') + '">' +
            (yaReg ? '✓' : 'Pendiente') +
          '</span>' +
        '</div>';
    }
    $searchResults.innerHTML = html;

    // Store results for detail view
    lastSearchResults = results;

    // Click handlers — open detail instead of marking
    let items = $searchResults.querySelectorAll('.result-item');
    for (let j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        let idx = parseInt(this.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && lastSearchResults[idx]) {
          showDetail(lastSearchResults[idx]);
        }
      });
    }
  }

  let lastSearchResults = [];

  // ════════════════════════════════════════════════════════
  //  PARTICIPANT DETAIL
  // ════════════════════════════════════════════════════════

  let $detailOverlay = document.getElementById('detail-overlay');
  let $detailClose = document.getElementById('detail-close');
  let $detailAvatar = document.getElementById('detail-avatar');
  let $detailName = document.getElementById('detail-name');
  let $detailId = document.getElementById('detail-id');
  let $detailEvento = document.getElementById('detail-evento');
  let $detailCorreo = document.getElementById('detail-correo');
  let $detailCurp = document.getElementById('detail-curp');
  let $detailInstitucion = document.getElementById('detail-institucion');
  let $detailTelefono = document.getElementById('detail-telefono');
  let $detailPerfil = document.getElementById('detail-perfil');
  let $detailAsistencia = document.getElementById('detail-asistencia');
  let $detailAsistenciaRow = document.getElementById('detail-asistencia-row');
  let $detailBtnMarcar = document.getElementById('detail-btn-marcar');
  let detailCurrentId = '';

  function showDetail(p) {
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

  $detailBtnMarcar.addEventListener('click', function () {
    if (!detailCurrentId || $detailBtnMarcar.disabled) return;
    hideDetail();
    markAttendance(detailCurrentId);
  });

  function showSearchEmpty(msg) {
    $searchResults.innerHTML =
      '<div class="search-empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">' +
          '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
        '</svg>' +
        '<p>' + esc(msg) + '</p>' +
      '</div>';
  }

  // ════════════════════════════════════════════════════════
  //  MARK ATTENDANCE
  // ════════════════════════════════════════════════════════

  function markAttendance(id) {
    let p = null;
    for (let i = 0; i < participantesCache.length; i++) {
      if (participantesCache[i].id === id) { p = participantesCache[i]; break; }
    }

    if (!p) {
      isProcessing = false;
      showResult('error', id, '', 'ID no encontrado en la base de datos', '');
      return;
    }

    if (p.asistencia && p.asistencia.indexOf('Pendiente') === -1) {
      isProcessing = false;
      showResult('already', p.nombre, p.evento || '', 'Ya registrado previamente', p.asistencia);
      return;
    }

    let ahora = new Date();
    let pad = function(n) { return (n < 10 ? '0' : '') + n; };
    let ahoraStr = pad(ahora.getDate())+'/'+pad(ahora.getMonth()+1)+'/'+ahora.getFullYear()+' '+pad(ahora.getHours())+':'+pad(ahora.getMinutes());
    
    actualizarCacheLocal(id, ahoraStr);

    if (navigator.onLine) {
      fetch(API_URL + '/api/asistencia', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer ' + ADMIN_SECRET,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: id })
      }).then(function(res) {
         if (!res.ok) throw new Error('Error al guardar');
         isProcessing = false;
         showResult('success', p.nombre, p.evento || '', 'Asistencia registrada ✓', ahoraStr);
      }).catch(function(e){
         isProcessing = false;
         addToOfflineQueue({ id: id, asistencia: ahoraStr });
         showResult('offline-queued', p.nombre, p.evento || '', 'Guardado sin conexión (Error de red)', ahoraStr);
      });
    } else {
      isProcessing = false;
      addToOfflineQueue({ id: id, asistencia: ahoraStr });
      showResult('offline-queued', p.nombre, p.evento || '', 'Guardado sin conexión', ahoraStr);
    }
  }

  function actualizarCacheLocal(id, valorAsistencia) {
    for (let i = 0; i < participantesCache.length; i++) {
      if (participantesCache[i].id === id) {
        participantesCache[i].asistencia = valorAsistencia;
        break;
      }
    }
    // Refrescar resultados de búsqueda si estamos en esa pestaña
    if ($tabSearch.classList.contains('active') && $searchInput.value.trim().length >= 2) {
      onSearchInput();
    }
  }

  // ════════════════════════════════════════════════════════
  //  RESULT OVERLAY
  // ════════════════════════════════════════════════════════

  function showResult(type, name, event, status, time) {
    let icons = {
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
    // Resume scanner
    if (qrScanner && scannerActive) {
      try { qrScanner.resume(); } catch (e) { /* ignore */ }
    }
  }

  // Tap to dismiss
  $resultOverlay.addEventListener('click', hideResult);
  $resultOverlay.addEventListener('touchend', function (e) {
    e.preventDefault();
    hideResult();
  });

  // ════════════════════════════════════════════════════════
  //  OFFLINE QUEUE (LocalStorage)
  // ════════════════════════════════════════════════════════

  function getOfflineQueue() {
    try {
      return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveOfflineQueue(queue) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    updateOfflineBadge();
  }

  function addToOfflineQueue(id) {
    let queue = getOfflineQueue();
    // Avoid duplicates
    if (queue.indexOf(id) === -1) {
      queue.push(id);
      saveOfflineQueue(queue);
    }
  }

  function updateOfflineBadge() {
    let queue = getOfflineQueue();
    if (queue.length > 0) {
      $offlineBadge.classList.remove('hidden');
      $offlineCount.textContent = queue.length;
    } else {
      $offlineBadge.classList.add('hidden');
    }
  }

  function syncOfflineQueue() {
    let queue = getOfflineQueue();
    if (!queue.length || !navigator.onLine) return;

    let promises = [];
    for (let i=0; i<queue.length; i++) {
      let item = queue[i];
      let id = typeof item === 'string' ? item : item.id;
      
      let p = fetch(API_URL + '/api/asistencia', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer ' + ADMIN_SECRET,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: id })
      });
      promises.push(p);
    }

    Promise.all(promises).then(function() {
      saveOfflineQueue([]);
    }).catch(function(e){
      console.error('Error sincronizando', e);
    });
  }

  // Listen for connectivity changes
  window.addEventListener('online', function () {
    syncOfflineQueue();
  });

  // ════════════════════════════════════════════════════════
  //  LOGOUT
  // ════════════════════════════════════════════════════════

  $btnLogout.addEventListener('click', function () {
    stopScanner();
    sessionStorage.removeItem(PIN_SESSION_KEY);
    $mainApp.classList.remove('active');
    $pinScreen.classList.add('active');
    pinCode = '';
    updatePinDots();
  });



  // ════════════════════════════════════════════════════════
  //  UTILITIES
  // ════════════════════════════════════════════════════════

  function esc(str) {
    let div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function getInitials(name) {
    let parts = (name || '?').split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0][0] || '?').toUpperCase();
  }


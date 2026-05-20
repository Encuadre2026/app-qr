/* ════════════════════════════════════════════════════════════
   App QR — Lógica Principal
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── CONFIGURACIÓN DE LA API ──────────────────────────
  var API_URL = "https://encuadre-2026-api.sitio-392.workers.dev";
  // IMPORTANTE: Pon aquí la misma contraseña que pusiste en Cloudflare
  var ADMIN_SECRET = "Encuadre2026futurologia"; 

  var OFFLINE_QUEUE_KEY = 'qr_asistencia_offline_queue';
  var PIN_SESSION_KEY = 'qr_asistencia_pin_ok';
  var SEARCH_DEBOUNCE_MS = 400;

  // ── Estado ─────────────────────────────────────────────
  var qrScanner = null;
  var scannerActive = false;
  var searchTimer = null;
  var isProcessing = false;

  // ── Elementos DOM ──────────────────────────────────────
  var $pinScreen = document.getElementById('pin-screen');
  var $mainApp = document.getElementById('main-app');
  var $pinDots = document.getElementById('pin-dots');
  var $pinError = document.getElementById('pin-error');
  var $tabScanner = document.getElementById('tab-scanner');
  var $tabSearch = document.getElementById('tab-search');
  var $panelScanner = document.getElementById('panel-scanner');
  var $panelSearch = document.getElementById('panel-search');
  var $searchInput = document.getElementById('search-input');
  var $searchResults = document.getElementById('search-results');
  var $resultOverlay = document.getElementById('result-overlay');
  var $resultIcon = document.getElementById('result-icon');
  var $resultName = document.getElementById('result-name');
  var $resultEvent = document.getElementById('result-event');
  var $resultStatus = document.getElementById('result-status');
  var $resultTime = document.getElementById('result-time');
  var $offlineBadge = document.getElementById('offline-badge');
  var $offlineCount = document.getElementById('offline-count');
  var $btnLogout = document.getElementById('btn-logout');

  var pinCode = '';

  // ════════════════════════════════════════════════════════
  //  PIN
  // ════════════════════════════════════════════════════════

  // Check saved session
  if (sessionStorage.getItem(PIN_SESSION_KEY) === '1') {
    showApp();
  }

  // Keypad clicks
  document.querySelector('.pin-keypad').addEventListener('click', function (e) {
    var btn = e.target.closest('.key');
    if (!btn) return;
    var key = btn.getAttribute('data-key');
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
    var dots = $pinDots.querySelectorAll('.dot');
    for (var i = 0; i < dots.length; i++) {
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
      var dots = $pinDots.querySelectorAll('.dot');
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.remove('filled');
        dots[i].classList.add('error');
      }
      $pinError.textContent = 'PIN incorrecto';
      setTimeout(function () {
        for (var j = 0; j < dots.length; j++) dots[j].classList.remove('error');
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
    var isScanner = tab === 'scanner';
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

  var $cameraPrompt = document.getElementById('camera-prompt');
  var $btnStartCamera = document.getElementById('btn-start-camera');
  var $scannerHint = document.getElementById('scanner-hint');

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
    var config = {
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
  var audioCtx = null;
  function playBeep() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gainNode = audioCtx.createGain();
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

    var id = decodedText.trim().toUpperCase();
    markAttendance(id);
  }

  // ════════════════════════════════════════════════════════
  //  SEARCH (local cache for instant results)
  // ════════════════════════════════════════════════════════

  var participantesCache = [];
  var cacheLoaded = false;

  function formatearFecha(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    var pad = function(n) { return (n < 10 ? '0' : '') + n; };
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
        for (var i = 0; i < data.registros.length; i++) {
          var reg = data.registros[i];
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
    var q = $searchInput.value.trim().toLowerCase();
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
    var resultados = [];
    for (var i = 0; i < participantesCache.length; i++) {
      var p = participantesCache[i];
      var coincide = p.id.toLowerCase().indexOf(q) !== -1 ||
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
    var html = '';
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var initials = getInitials(r.nombre);
      var yaReg = !!r.asistencia;
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
    var items = $searchResults.querySelectorAll('.result-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && lastSearchResults[idx]) {
          showDetail(lastSearchResults[idx]);
        }
      });
    }
  }

  var lastSearchResults = [];

  // ════════════════════════════════════════════════════════
  //  PARTICIPANT DETAIL
  // ════════════════════════════════════════════════════════

  var $detailOverlay = document.getElementById('detail-overlay');
  var $detailClose = document.getElementById('detail-close');
  var $detailAvatar = document.getElementById('detail-avatar');
  var $detailName = document.getElementById('detail-name');
  var $detailId = document.getElementById('detail-id');
  var $detailEvento = document.getElementById('detail-evento');
  var $detailCorreo = document.getElementById('detail-correo');
  var $detailCurp = document.getElementById('detail-curp');
  var $detailInstitucion = document.getElementById('detail-institucion');
  var $detailTelefono = document.getElementById('detail-telefono');
  var $detailPerfil = document.getElementById('detail-perfil');
  var $detailAsistencia = document.getElementById('detail-asistencia');
  var $detailAsistenciaRow = document.getElementById('detail-asistencia-row');
  var $detailBtnMarcar = document.getElementById('detail-btn-marcar');
  var detailCurrentId = '';

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
    var p = null;
    for (var i = 0; i < participantesCache.length; i++) {
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

    var ahora = new Date();
    var pad = function(n) { return (n < 10 ? '0' : '') + n; };
    var ahoraStr = pad(ahora.getDate())+'/'+pad(ahora.getMonth()+1)+'/'+ahora.getFullYear()+' '+pad(ahora.getHours())+':'+pad(ahora.getMinutes());
    
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
    for (var i = 0; i < participantesCache.length; i++) {
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
    var icons = {
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
    var queue = getOfflineQueue();
    // Avoid duplicates
    if (queue.indexOf(id) === -1) {
      queue.push(id);
      saveOfflineQueue(queue);
    }
  }

  function updateOfflineBadge() {
    var queue = getOfflineQueue();
    if (queue.length > 0) {
      $offlineBadge.classList.remove('hidden');
      $offlineCount.textContent = queue.length;
    } else {
      $offlineBadge.classList.add('hidden');
    }
  }

  function syncOfflineQueue() {
    var queue = getOfflineQueue();
    if (!queue.length || !navigator.onLine) return;

    var promises = [];
    for (var i=0; i<queue.length; i++) {
      var item = queue[i];
      var id = typeof item === 'string' ? item : item.id;
      
      var p = fetch(API_URL + '/api/asistencia', {
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
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function getInitials(name) {
    var parts = (name || '?').split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0][0] || '?').toUpperCase();
  }

})();

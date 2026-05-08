/* ════════════════════════════════════════════════════════════
   App QR — Lógica Principal
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── CONFIGURACIÓN ──────────────────────────────────────
  // ⚠️  Cambia esta URL por la de tu Web App desplegada
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzOxAY-uNUfGuoXNfEO7hD8b_jFk60q9YzxpylSACL1E4A26bZQKdBnzqsmkyFNpFkW/exec';

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
    callApi('verificarPin', { pin: pin }, function (data) {
      if (data.success) {
        sessionStorage.setItem(PIN_SESSION_KEY, '1');
        showApp();
      } else {
        pinCode = '';
        var dots = $pinDots.querySelectorAll('.dot');
        for (var i = 0; i < dots.length; i++) {
          dots[i].classList.remove('filled');
          dots[i].classList.add('error');
        }
        $pinError.textContent = data.message || 'PIN incorrecto';
        setTimeout(function () {
          for (var j = 0; j < dots.length; j++) dots[j].classList.remove('error');
        }, 600);
      }
    }, function () {
      // Offline fallback: accept default pin
      if (pin === '2026') {
        sessionStorage.setItem(PIN_SESSION_KEY, '1');
        showApp();
      } else {
        pinCode = '';
        $pinError.textContent = 'Sin conexión. Intenta con el PIN por defecto.';
        updatePinDots();
      }
    });
  }

  function showApp() {
    $pinScreen.classList.remove('active');
    $mainApp.classList.add('active');
    startScanner();
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

    if (isScanner) {
      startScanner();
    } else {
      stopScanner();
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

    // Hide prompt, show scanner
    $cameraPrompt.classList.add('hidden');
    $scannerHint.textContent = 'Iniciando cámara...';

    // Clean previous instance
    if (qrScanner) {
      try { qrScanner.clear(); } catch(e) {}
    }

    qrScanner = new Html5Qrcode('qr-reader');
    var config = {
      fps: 10,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: false,
      showZoomSliderIfSupported: false,
      useBarCodeDetectorIfSupported: true
    };

    qrScanner.start(
      { facingMode: 'environment' },
      config,
      onQrScanned,
      function () { /* ignore scan errors */ }
    ).then(function () {
      scannerActive = true;
      $scannerHint.textContent = 'Apunta al código QR del participante';
    }).catch(function (err) {
      console.error('Camera error:', err);
      $cameraPrompt.classList.remove('hidden');
      $scannerHint.textContent = 'Error: ' + (err.message || err) + '. Intenta de nuevo o usa búsqueda manual.';
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

  function onQrScanned(decodedText) {
    if (isProcessing) return;
    isProcessing = true;

    // Pause scanner while processing
    if (qrScanner && scannerActive) {
      qrScanner.pause(true);
    }

    // Vibrate for feedback
    if (navigator.vibrate) navigator.vibrate(100);

    var id = decodedText.trim().toUpperCase();
    markAttendance(id);
  }

  // ════════════════════════════════════════════════════════
  //  SEARCH
  // ════════════════════════════════════════════════════════

  $searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    var q = $searchInput.value.trim();
    if (q.length < 2) {
      showSearchEmpty('Escribe al menos 2 caracteres');
      return;
    }
    searchTimer = setTimeout(function () {
      doSearch(q);
    }, SEARCH_DEBOUNCE_MS);
  });

  function doSearch(query) {
    callApi('buscar', { q: query }, function (data) {
      if (data.success && data.resultados && data.resultados.length) {
        renderSearchResults(data.resultados);
      } else {
        showSearchEmpty(data.message || 'Sin resultados');
      }
    }, function () {
      showSearchEmpty('Sin conexión a internet');
    });
  }

  function renderSearchResults(results) {
    var html = '';
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var initials = getInitials(r.nombre);
      var yaReg = !!r.asistencia;
      html +=
        '<div class="result-item' + (yaReg ? ' ya-registrado' : '') + '" data-id="' + esc(r.id) + '">' +
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

    // Click handlers
    var items = $searchResults.querySelectorAll('.result-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        if (id) markAttendance(id);
      });
    }
  }

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
    callApi('marcar', { id: id }, function (data) {
      isProcessing = false;
      if (data.success) {
        showResult('success', data.nombre || id, data.evento || '', 'Asistencia registrada ✓', data.asistencia || '');
      } else if (data.yaRegistrado) {
        showResult('already', data.nombre || id, data.evento || '', 'Ya registrado previamente', data.asistencia || '');
      } else {
        showResult('error', id, '', data.message || 'Error desconocido', '');
      }
    }, function () {
      // Offline: queue it
      isProcessing = false;
      addToOfflineQueue(id);
      showResult('offline-queued', id, '', 'Guardado sin conexión', 'Se sincronizará al reconectar');
    });
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

    callApi('marcarBatch', { ids: JSON.stringify(queue) }, function (data) {
      if (data.success) {
        saveOfflineQueue([]);
      }
    }, function () {
      // Still offline, try later
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
  //  API HELPER (JSONP for cross-origin Apps Script)
  // ════════════════════════════════════════════════════════

  var jsonpCounter = 0;

  function callApi(action, params, onSuccess, onError) {
    var cbName = '__qr_cb_' + (jsonpCounter++);
    var timeout;

    // Build URL
    var url = APPS_SCRIPT_URL + '?action=' + encodeURIComponent(action) + '&callback=' + cbName;
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
    }

    // Callback
    window[cbName] = function (data) {
      clearTimeout(timeout);
      cleanup();
      if (onSuccess) onSuccess(data);
    };

    // Script tag
    var script = document.createElement('script');
    script.src = url;
    script.onerror = function () {
      clearTimeout(timeout);
      cleanup();
      if (onError) onError();
    };

    function cleanup() {
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    // Timeout (8s)
    timeout = setTimeout(function () {
      cleanup();
      if (onError) onError();
    }, 8000);

    document.head.appendChild(script);
  }

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

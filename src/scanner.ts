import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

let qrScanner: Html5Qrcode | null = null;
let scannerActive = false;

export function isScannerActive(): boolean {
  return scannerActive;
}

export function getScanner(): Html5Qrcode | null {
  return qrScanner;
}

export function startScanner(
  onQrScanned: (decodedText: string) => void,
  onHintUpdate: (msg: string) => void,
  onErrorFallback: () => void
): void {
  if (scannerActive) return;

  if (typeof Html5Qrcode === 'undefined') {
    onHintUpdate('Error: librería QR no cargada. Recarga la página.');
    return;
  }

  // Check basic camera support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    onHintUpdate('Tu navegador no soporta cámara. Prueba con Chrome.');
    return;
  }

  onHintUpdate('Solicitando permiso de cámara...');

  // Clean previous instance
  if (qrScanner) {
    try { qrScanner.clear(); } catch(e) { console.error(e) }
  }

  qrScanner = new Html5Qrcode('qr-reader', {
    formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
    useBarCodeDetectorIfSupported: true,
    verbose: false
  });

  const config = {
    fps: 10, // Reducido de 25 a 10 para evitar sobrecarga del CPU en celulares
    qrbox: { width: 250, height: 250 }, // Limita el área de análisis
    disableFlip: true
  };

  // Try back camera first
  qrScanner.start(
    { facingMode: 'environment' },
    config,
    onQrScanned,
    () => {} // onError ignorado silenciosamente frame a frame
  ).then(() => {
    scannerActive = true;
    onHintUpdate('Apunta al código QR del participante');
  }).catch((err) => {
    console.error('Back camera failed, trying any camera:', err);
    onHintUpdate('Intentando cámara alternativa...');
    
    // Fallback: try any available camera
    qrScanner!.start(
      { facingMode: 'user' },
      config,
      onQrScanned,
      () => {}
    ).then(() => {
      scannerActive = true;
      onHintUpdate('Usando cámara frontal - apunta al QR');
    }).catch((err2) => {
      console.error('All cameras failed:', err2);
      onHintUpdate('Error: ' + String(err2.message || err2));
      onErrorFallback();
    });
  });
}

export function stopScanner(): void {
  if (!scannerActive || !qrScanner) return;
  qrScanner.stop().then(() => {
    scannerActive = false;
    qrScanner!.clear();
  }).catch(() => {
    scannerActive = false;
  });
}

export function pauseScanner(): void {
  if (qrScanner && scannerActive) {
    try { qrScanner.pause(true); } catch (e) { console.error(e) }
  }
}

export function resumeScanner(): void {
  if (qrScanner && scannerActive) {
    try { qrScanner.resume(); } catch (e) { console.error(e) }
  }
}

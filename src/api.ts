import { API_URL, ADMIN_SECRET, OFFLINE_QUEUE_KEY } from './config';
import { RegistrosResponse, OfflineQueueItem } from './types';

export async function fetchParticipantes(): Promise<RegistrosResponse> {
  const res = await fetch(`${API_URL}/api/admin/registros`, {
    headers: { 'Authorization': `Bearer ${ADMIN_SECRET}` }
  });
  if (!res.ok) throw new Error('Error de red al obtener participantes');
  return res.json();
}

export async function marcarAsistenciaAPI(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/asistencia`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ADMIN_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Error al guardar asistencia');
}

// ── Lógica Offline ──

export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (e) {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function addToOfflineQueue(item: OfflineQueueItem): void {
  const queue = getOfflineQueue();
  // Evitar duplicados
  if (!queue.find(q => q.id === item.id)) {
    queue.push(item);
    saveOfflineQueue(queue);
  }
}

export async function syncOfflineQueue(onUpdateBadge: () => void): Promise<void> {
  const queue = getOfflineQueue();
  if (queue.length === 0 || !navigator.onLine) return;

  const promises = queue.map(async (item) => {
    // Intentamos enviar cada uno
    try {
      await marcarAsistenciaAPI(item.id);
    } catch (e) {
      console.error(`Error sincronizando participante ${item.id}`, e);
      throw e; // Lanzar para no vaciar la cola si falla
    }
  });

  try {
    await Promise.all(promises);
    // Si todos tuvieron éxito, limpiamos la cola
    saveOfflineQueue([]);
    onUpdateBadge();
  } catch (error) {
    console.error('Error durante la sincronización masiva', error);
  }
}

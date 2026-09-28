import { MaintenanceRecord, FlatRecord, RecordEstado } from '../types';
import { 
  fetchMaintenanceRecordsFromFirestore, 
  saveMaintenanceRecordToFirestore, 
  deleteMaintenanceRecordFromFirestore,
  batchImportToFirestore,
  createFirestoreBackup,
  fetchFirestoreBackups,
  restoreFirestoreBackup,
  deleteFirestoreBackup,
  testConnection as testFirebaseConnection,
  subscribeToMaintenanceRecords
} from './firebase';

export const DEFAULT_API_URL = (import.meta as any).env?.VITE_API_URL || 'https://script.google.com/macros/s/AKfycbyPCLAuMIv0dnvbj78NdSQRx_iNYhFTCMhiElN-6pc0YQbyw6gE-nNexv6V_f8MYevD/exec';
const LOCAL_STORAGE_KEY = 'mantenimiento_records_cache';
const CUSTOM_API_URL_KEY = 'casino_custom_api_url';

export function getApiUrl(): string {
  try {
    const custom = localStorage.getItem(CUSTOM_API_URL_KEY);
    if (custom && custom.trim().length > 10) {
      return custom.trim();
    }
  } catch (e) {
    console.warn('Error reading custom API URL from storage:', e);
  }
  return DEFAULT_API_URL;
}

export function setCustomApiUrl(url: string): void {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(CUSTOM_API_URL_KEY);
    } else {
      localStorage.setItem(CUSTOM_API_URL_KEY, url.trim());
    }
  } catch (e) {
    console.error('Error saving custom API URL:', e);
  }
}

export function resetCustomApiUrl(): void {
  try {
    localStorage.removeItem(CUSTOM_API_URL_KEY);
  } catch (e) {
    console.error('Error removing custom API URL:', e);
  }
}

// Conversión de formato plano (Google Sheets) a jerárquico (React App)
export function parseFlatRecord(r: FlatRecord): MaintenanceRecord {
  let checksBilletes: Record<string, string> = {};
  let checksExtras: Record<string, string> = {};

  try {
    if (r.i_checks_billetes) {
      checksBilletes = JSON.parse(r.i_checks_billetes);
    }
  } catch (e) {
    console.warn('Error parsing checksBilletes JSON:', e);
  }

  try {
    if (r.i_checks_extras) {
      checksExtras = JSON.parse(r.i_checks_extras);
    }
  } catch (e) {
    console.warn('Error parsing checksExtras JSON:', e);
  }

  return {
    id: r.id,
    estado: r.estado,
    egreso: {
      maquina: String(r.e_maquina || ''),
      isla: String(r.e_isla || ''),
      fecha: r.e_fecha || '',
      motivo: r.e_motivo || '',
      nota: r.e_nota || '',
      coinin: r.e_coinin || '',
      coinout: r.e_coinout || '',
      jackpot: r.e_jackpot || '',
      prog1: r.e_prog1 || '',
      prog2: r.e_prog2 || '',
      prog3: r.e_prog3 || '',
      prog4: r.e_prog4 || '',
      devolucion: r.e_devolucion || '',
      operador: r.e_operador || '',
      firma: r.e_firma || '',
      foto: r.e_foto || '',
    },
    tecnico: r.t_fecha ? {
      fecha: r.t_fecha,
      informe: r.t_informe || '',
      solucion: r.t_solucion || '',
      tecnico: r.t_tecnico || '',
      firma: r.t_firma || '',
    } : null,
    inspector: r.i_fecha ? {
      fecha: r.i_fecha,
      informe: r.i_informe || '',
      coinin: r.i_coinin || '',
      devolucion: r.i_devolucion || '',
      denominacion: r.i_denominacion || '',
      apuestaMin: r.i_apuesta_min || '',
      apuestaMax: r.i_apuesta_max || '',
      mdc: r.i_mdc || '',
      inspector: r.i_inspector || '',
      firma: r.i_firma || '',
      checksBilletes,
      checksExtras,
    } : null,
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
  };
}

// Conversión de formato jerárquico a plano
export function flattenRecord(r: MaintenanceRecord): FlatRecord {
  return {
    id: r.id,
    estado: r.estado,
    e_maquina: r.egreso?.maquina || '',
    e_isla: r.egreso?.isla || '',
    e_fecha: r.egreso?.fecha || '',
    e_motivo: r.egreso?.motivo || '',
    e_nota: r.egreso?.nota || '',
    e_coinin: r.egreso?.coinin || '',
    e_coinout: r.egreso?.coinout || '',
    e_jackpot: r.egreso?.jackpot || '',
    e_prog1: r.egreso?.prog1 || '',
    e_prog2: r.egreso?.prog2 || '',
    e_prog3: r.egreso?.prog3 || '',
    e_prog4: r.egreso?.prog4 || '',
    e_devolucion: r.egreso?.devolucion || '',
    e_operador: r.egreso?.operador || '',
    e_firma: r.egreso?.firma || '',
    e_foto: r.egreso?.foto || '',
    t_fecha: r.tecnico ? r.tecnico.fecha || '' : '',
    t_informe: r.tecnico ? r.tecnico.informe || '' : '',
    t_solucion: r.tecnico ? r.tecnico.solucion || '' : '',
    t_tecnico: r.tecnico ? r.tecnico.tecnico || '' : '',
    t_firma: r.tecnico ? r.tecnico.firma || '' : '',
    i_fecha: r.inspector ? r.inspector.fecha || '' : '',
    i_informe: r.inspector ? r.inspector.informe || '' : '',
    i_coinin: r.inspector ? r.inspector.coinin || '' : '',
    i_devolucion: r.inspector ? r.inspector.devolucion || '' : '',
    i_denominacion: r.inspector ? r.inspector.denominacion || '' : '',
    i_apuesta_min: r.inspector ? r.inspector.apuestaMin || '' : '',
    i_apuesta_max: r.inspector ? r.inspector.apuestaMax || '' : '',
    i_mdc: r.inspector ? r.inspector.mdc || '' : '',
    i_inspector: r.inspector ? r.inspector.inspector || '' : '',
    i_firma: r.inspector ? r.inspector.firma || '' : '',
    i_checks_billetes: r.inspector?.checksBilletes ? JSON.stringify(r.inspector.checksBilletes) : '',
    i_checks_extras: r.inspector?.checksExtras ? JSON.stringify(r.inspector.checksExtras) : '',
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
  };
}

// Guardar caché localmente de forma segura
export function saveToLocalCache(records: MaintenanceRecord[]): void {
  try {
    const uniqueMap = new Map<string, MaintenanceRecord>();
    records.forEach((r, idx) => {
      if (r) {
        const recordId = r.id || `REG-${Date.now()}-${idx}`;
        uniqueMap.set(recordId, { ...r, id: recordId });
      }
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(uniqueRecords));
  } catch (e: any) {
    console.warn('LocalStorage error:', e);
  }
}

// Obtener caché local
export function getLocalCache(): MaintenanceRecord[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const parsed: MaintenanceRecord[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const uniqueMap = new Map<string, MaintenanceRecord>();
        parsed.forEach((r, idx) => {
          if (r) {
            const recordId = r.id || `REG-${Date.now()}-${idx}`;
            uniqueMap.set(recordId, { ...r, id: recordId });
          }
        });
        return Array.from(uniqueMap.values());
      }
    }
  } catch (e) {
    console.error('Error loading records from localStorage:', e);
  }
  return [];
}

// ==========================================
// OPERACIONES PRIMARIAS CON FIREBASE FIRESTORE
// ==========================================

// Cargar todos los registros: Primero intenta Firestore; si falla o está offline, usa LocalStorage
export async function loadRecords(): Promise<{ records: MaintenanceRecord[]; source: 'api' | 'local'; error?: string }> {
  try {
    const firestoreRecords = await fetchMaintenanceRecordsFromFirestore();
    if (firestoreRecords && Array.isArray(firestoreRecords)) {
      // Si Firestore está vacío pero tenemos registros en local, sugerir o mantenerlos
      if (firestoreRecords.length === 0) {
        const cached = getLocalCache();
        if (cached.length > 0) {
          // Migración automática al vuelo si Firebase está recién creado
          try {
            await batchImportToFirestore(cached);
            return { records: cached, source: 'api' };
          } catch (migrateErr) {
            console.warn('Error en auto-migración inicial:', migrateErr);
          }
          return { records: cached, source: 'local' };
        }
      }

      saveToLocalCache(firestoreRecords);
      return { records: firestoreRecords, source: 'api' };
    }
    throw new Error('Respuesta inválida de base de datos');
  } catch (err: any) {
    console.warn('Fallo conexión con Firestore, recurriendo a caché local:', err);
    const cached = getLocalCache();
    return {
      records: cached,
      source: 'local',
      error: err?.message || 'Modo local activo. Conexión a Firebase offline.'
    };
  }
}

// Disparar envío de correo en segundo plano a través del Web App de Apps Script (sin demoras ni bloqueo)
export function triggerEmailAlertBackground(record: MaintenanceRecord, action: 'save' | 'update'): void {
  try {
    const targetUrl = getApiUrl();
    if (targetUrl && targetUrl.startsWith('https://script.google.com/')) {
      const flat = flattenRecord(record);
      fetchFromGAS(action, flat).catch(err => {
        console.warn('Aviso por correo en segundo plano (Apps Script):', err?.message || err);
      });
    }
  } catch (err) {
    console.warn('Error al iniciar aviso de correo:', err);
  }
}

// Guardar o Actualizar un registro en Firestore y en caché local
export async function saveRecord(record: MaintenanceRecord): Promise<{ success: boolean; source: 'api' | 'local'; error?: string }> {
  // 1. Guardar primero en caché local para respuesta inmediata
  const cached = getLocalCache();
  const idx = cached.findIndex(r => r.id === record.id);
  if (idx >= 0) {
    cached[idx] = record;
  } else {
    cached.unshift(record);
  }
  saveToLocalCache(cached);

  // 2. Persistir en Firebase Firestore
  try {
    await saveMaintenanceRecordToFirestore(record);
    // 3. Disparar notificación por correo a Técnicos y Juego en segundo plano
    triggerEmailAlertBackground(record, idx >= 0 ? 'update' : 'save');
    return { success: true, source: 'api' };
  } catch (firestoreErr: any) {
    console.warn('Error al guardar en Firestore:', firestoreErr);
    return {
      success: true,
      source: 'local',
      error: 'Guardado en memoria local. Se sincronizará automáticamente al restablecer conexión.'
    };
  }
}

// Eliminar un registro
export async function deleteRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
  // 1. Eliminar del caché local
  const cached = getLocalCache().filter(r => r.id !== recordId);
  saveToLocalCache(cached);

  // 2. Eliminar de Firestore
  try {
    await deleteMaintenanceRecordFromFirestore(recordId);
    return { success: true };
  } catch (err: any) {
    console.warn('Error al eliminar de Firestore:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

// Migrar toda la base local a Firebase Firestore
export async function migrateAllToFirebase(): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const cached = getLocalCache();
    if (cached.length === 0) {
      return { success: true, count: 0, message: 'No hay registros locales para migrar.' };
    }
    const count = await batchImportToFirestore(cached);
    return {
      success: true,
      count,
      message: `¡Migración exitosa! Se copiaron ${count} registros a Firebase Firestore con respaldo permanente.`
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      message: `Error al migrar a Firebase: ${err?.message || err}`
    };
  }
}

// Crear un Respaldo (Snapshot) en Firebase
export async function backupDatabaseToFirestore(label?: string): Promise<{ success: boolean; message: string }> {
  try {
    const currentRecords = getLocalCache();
    const backup = await createFirestoreBackup(label || `Respaldo manual - ${new Date().toLocaleString('es-AR')}`, currentRecords);
    return {
      success: true,
      message: `Respaldo guardado exitosamente en Firebase (ID: ${backup.id}, ${backup.recordCount} registros).`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error al crear respaldo en Firebase: ${err?.message || err}`
    };
  }
}

// Exportar Base de Datos a archivo JSON descargable en PC
export function exportDatabaseToJSON(): void {
  const records = getLocalCache();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  const now = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute("download", `Casino_Santa_Fe_Mantenimiento_Respaldo_${now}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Re-exportar funciones de soporte de Apps Script para diagnósticos si se desea
export async function fetchFromGAS(action: string, data?: any, overrideUrl?: string): Promise<any> {
  const targetUrl = overrideUrl || getApiUrl();
  const response = await fetch(targetUrl, {
    method: 'POST',
    body: JSON.stringify({ action, data }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  });
  if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
  return response.json();
}

export async function testApiConnection(customUrl?: string): Promise<{ 
  success: boolean; 
  message: string; 
  details?: string;
  count?: number;
}> {
  // Probar Firebase primero
  try {
    const fbTest = await testFirebaseConnection();
    if (fbTest.success) {
      return {
        success: true,
        message: '¡Firebase Firestore conectado correctamente!',
        details: 'La base de datos en la nube está activa, segura y respaldada en tiempo real.'
      };
    }
  } catch (e) {
    // Continuar si prueba GAS
  }

  const targetUrl = customUrl ? customUrl.trim() : getApiUrl();
  if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) {
    return {
      success: false,
      message: 'URL inválida',
      details: 'La URL debe comenzar con "https://script.google.com/macros/s/..." y terminar en "/exec"'
    };
  }

  try {
    const result = await fetchFromGAS('getAll', null, targetUrl);
    if (result && Array.isArray(result.registros)) {
      return {
        success: true,
        message: 'Conexión exitosa con Google Sheets',
        details: `Se encontraron ${result.registros.length} registros en la hoja de cálculo.`,
        count: result.registros.length
      };
    }
    return { success: true, message: 'Conectado a Google Sheets' };
  } catch (err: any) {
    return {
      success: false,
      message: 'Fallo al conectar con Google Sheets',
      details: err?.message || String(err)
    };
  }
}

export async function syncAllLocalToRemote(): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  message: string;
}> {
  // Migración y sincronización con Firebase
  const res = await migrateAllToFirebase();
  return {
    success: res.success,
    inserted: res.count,
    message: res.message
  };
}

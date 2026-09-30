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

// Destinatarios Oficiales de Casino Santa Fe
export const EMAILS_TECNICOS = 'Tecnicos.SF@casinostafe.com.ar';
export const EMAILS_JUEGO = [
  'vanina.anzotegui@casinostafe.com.ar',
  'david.humoller@casinostafe.com.ar',
  'pablo.gomez@casinostafe.com.ar',
  'matias.girsa@casinostafe.com.ar',
  'cristian.graglia@casinostafe.com.ar',
  'crysthian.pons@casinostafe.com.ar',
  'erica.vazquez@casinostafe.com.ar',
  'luis.ortega@casinostafe.com.ar',
  'alejandro.rey@casinostafe.com.ar',
  'andrea.lana@casinostafe.com.ar',
  'vanesa.lopez@casinostafe.com.ar'
];

// Generador de enlace directo mailto para abrir Outlook o cliente de correo predeterminado
export function generateMailtoUrl(record: MaintenanceRecord, estado?: RecordEstado): string {
  const currentEstado = estado || record.estado;
  const isEgreso = currentEstado === 'egreso';
  const recipients = isEgreso 
    ? `${EMAILS_TECNICOS},${EMAILS_JUEGO.join(',')}` 
    : EMAILS_JUEGO.join(',');

  const subject = isEgreso 
    ? `🚨 FUERA DE SERVICIO: Máquina ${record.egreso.maquina} (Isla ${record.egreso.isla})`
    : currentEstado === 'tecnico'
    ? `🔧 REPARACIÓN FINALIZADA: Máquina ${record.egreso.maquina} (Isla ${record.egreso.isla})`
    : `✅ MÁQUINA EN SERVICIO: Máquina ${record.egreso.maquina} (Isla ${record.egreso.isla})`;

  const lines = [
    `CASINO SANTA FE — ACTA DE GESTIÓN DE MÁQUINAS`,
    `========================================`,
    `ESTADO: ${currentEstado === 'egreso' ? '🔴 FUERA DE SERVICIO' : currentEstado === 'tecnico' ? '🔧 EN REPARACIÓN / ESPERANDO INSPECCIÓN' : '✅ REINGRESADA EN SALA'}`,
    `Ticket ID: ${record.id}`,
    `N° Máquina: ${record.egreso.maquina}`,
    `N° Isla: ${record.egreso.isla}`,
    `Fecha Egreso: ${record.egreso.fecha || '-'}`,
    `Motivo: ${record.egreso.motivo || '-'}`,
    `Operador: ${record.egreso.operador || '-'}`,
    ``,
    `CONTADORES EGRESO:`,
    `COIN IN: ${record.egreso.coinin || '-'} | COIN OUT: ${record.egreso.coinout || '-'}`,
    `JACKPOT: ${record.egreso.jackpot || '-'} | % DEVOLUCIÓN: ${record.egreso.devolucion || '-'}`,
  ];

  if (record.tecnico) {
    lines.push(
      ``,
      `DETALLE DE INTERVENCIÓN TÉCNICA:`,
      `Técnico: ${record.tecnico.tecnico || '-'}`,
      `Fecha: ${record.tecnico.fecha || '-'}`,
      `Informe: ${record.tecnico.informe || '-'}`,
      `Solución aplicada: ${record.tecnico.solucion || '-'}`
    );
  }

  if (record.inspector) {
    lines.push(
      ``,
      `CONTROL E INSPECCIÓN FINAL:`,
      `Inspector: ${record.inspector.inspector || '-'}`,
      `Fecha: ${record.inspector.fecha || '-'}`
    );
  }

  lines.push(
    ``,
    `========================================`,
    `Notificación generada por el Sistema de Mantenimiento Correctivo - Casino Santa Fe.`
  );

  const body = encodeURIComponent(lines.join('\n'));
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

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

// Disparar envío de correo en segundo plano a través del Webhook de Apps Script (sin demoras, sin planillas)
export function triggerEmailAlertBackground(record: MaintenanceRecord, action: 'save' | 'update'): void {
  try {
    const targetUrl = getApiUrl();
    if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) {
      return;
    }

    const safeMaquina = record.egreso?.maquina || (record as any).e_maquina || (record as any).maquina || '';
    const safeIsla = record.egreso?.isla || (record as any).e_isla || (record as any).isla || '';
    const safeMotivo = record.egreso?.motivo || (record as any).e_motivo || (record as any).motivo || 'Revisión técnica';
    const safeOperador = record.egreso?.operador || (record as any).e_operador || (record as any).operador || 'Operador de turno';
    const safeFecha = record.egreso?.fecha || (record as any).e_fecha || new Date().toISOString();

    const safeTecnico = record.tecnico?.tecnico || (record as any).t_tecnico || 'Técnico de Turno';
    const safeSolucion = record.tecnico?.solucion || (record as any).t_solucion || 'Intervención técnica general';
    const safeInformeTecnico = record.tecnico?.informe || (record as any).t_informe || '';

    const safeInspector = record.inspector?.inspector || (record as any).i_inspector || 'Inspector Auditor';
    const safeInformeInspector = record.inspector?.informe || (record as any).i_informe || 'Control Satisfactorio';

    // Payload liviano (sin imágenes base64 pesadas que saturen o bloqueen Apps Script)
    const cleanRecord = {
      id: record.id,
      estado: record.estado,
      e_maquina: safeMaquina,
      e_isla: safeIsla,
      e_motivo: safeMotivo,
      e_operador: safeOperador,
      e_fecha: safeFecha,
      t_tecnico: safeTecnico,
      t_solucion: safeSolucion,
      t_informe: safeInformeTecnico,
      t_fecha: record.tecnico?.fecha || '',
      i_inspector: safeInspector,
      i_informe: safeInformeInspector,
      i_fecha: record.inspector?.fecha || '',
      maquina: safeMaquina,
      isla: safeIsla,
      motivo: safeMotivo,
      operador: safeOperador,
      fecha: safeFecha,
      tecnico: safeTecnico,
      solucion: safeSolucion,
      informe: safeInformeTecnico,
      inspector: safeInspector,
      egreso: {
        maquina: safeMaquina,
        isla: safeIsla,
        motivo: safeMotivo,
        operador: safeOperador,
        fecha: safeFecha
      }
    };

    const payload = {
      action: 'sendAlertEmail',
      estado: record.estado,
      record: cleanRecord,
      data: cleanRecord,
      ...cleanRecord
    };
    
    // Usar fetch con mode 'no-cors' para garantizar que el navegador nunca cancele la petición en segundo plano
    fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.warn('Aviso por correo en segundo plano (Apps Script Mailer):', err?.message || err);
    });
  } catch (err) {
    console.warn('Error al iniciar aviso de correo:', err);
  }
}

// Guardar o Actualizar un registro en Firestore y en caché local (100% Firebase, sin tocar planillas)
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

  // 2. Persistir en Firebase Firestore (Única Base de Datos Oficial)
  try {
    await saveMaintenanceRecordToFirestore(record);
    // 3. Disparar notificación por correo a Técnicos y Juego en segundo plano (Webhook sin tocar planillas)
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

// Detectar y depurar registros duplicados (por ejemplo creados por doble clic o desincronización anterior)
export async function cleanupDuplicateRecords(): Promise<{ success: boolean; removedCount: number; message: string }> {
  try {
    const records = await fetchMaintenanceRecordsFromFirestore();
    if (!records || records.length === 0) {
      return { success: true, removedCount: 0, message: 'No hay registros en Firebase Firestore.' };
    }

    // Mapa para detectar duplicados por clave (maquina + estado) o por ID repetido
    const seenActiveMap = new Map<string, MaintenanceRecord>();
    const idsToDelete: string[] = [];

    // Ordenar de más reciente a más antiguo
    const sorted = [...records].sort((a, b) => {
      const tA = new Date(a.created_at || a.updated_at).getTime();
      const tB = new Date(b.created_at || b.updated_at).getTime();
      return tB - tA;
    });

    for (const r of sorted) {
      // Para máquinas que están activamente fuera de servicio (egreso o técnico)
      if (r.estado === 'egreso' || r.estado === 'tecnico') {
        const key = `${r.egreso.maquina.trim().toLowerCase()}_${r.estado}`;
        if (seenActiveMap.has(key)) {
          // Ya existe un ticket más reciente o idéntico para esta máquina en este estado -> marcar para eliminar el sobrante
          idsToDelete.push(r.id);
        } else {
          seenActiveMap.set(key, r);
        }
      }
    }

    if (idsToDelete.length === 0) {
      return { success: true, removedCount: 0, message: 'No se detectaron registros duplicados en Firebase Firestore.' };
    }

    for (const id of idsToDelete) {
      await deleteMaintenanceRecordFromFirestore(id);
    }

    // Actualizar caché local inmediatamente
    const cleaned = records.filter(r => !idsToDelete.includes(r.id));
    saveToLocalCache(cleaned);

    return {
      success: true,
      removedCount: idsToDelete.length,
      message: `¡Depuración exitosa! Se eliminaron ${idsToDelete.length} registros duplicados de Firebase Firestore.`
    };
  } catch (err: any) {
    return {
      success: false,
      removedCount: 0,
      message: `Error al depurar duplicados: ${err?.message || err}`
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
  const targetUrl = (overrideUrl || getApiUrl()).trim();
  const response = await fetch(targetUrl, {
    method: 'POST',
    body: JSON.stringify({ action, data }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  });
  
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return json;
  } catch {
    if (text.includes('Google Drive') || text.includes('accounts.google.com') || text.includes('Sign in')) {
      throw new Error('El script requiere autorización de tu cuenta de Google o la implementación no está configurada con acceso a "Cualquier persona".');
    }
    if (text.includes('ScriptError') || text.includes('Exception')) {
      throw new Error(`Error devuelto por Apps Script: ${text.slice(0, 160)}`);
    }
    throw new Error(`Respuesta no válida del servidor (${response.status}): ${text.slice(0, 140)}`);
  }
}

// Probar el Webhook de Correo Oficial (Opción A)
export async function testEmailWebhook(customUrl?: string): Promise<{ 
  success: boolean; 
  message: string; 
  details?: string;
}> {
  const targetUrl = customUrl ? customUrl.trim() : getApiUrl();
  if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) {
    return {
      success: false,
      message: 'URL inválida',
      details: 'La URL debe comenzar con "https://script.google.com/macros/s/..." y terminar en "/exec"'
    };
  }

  try {
    const result = await fetchFromGAS('test', {}, targetUrl);
    if (result && result.success) {
      return {
        success: true,
        message: '¡Webhook de Correo en línea!',
        details: result.message || 'El servicio de Google Apps Script está activo y listo para despachar correos.'
      };
    }
    return { success: true, message: 'Webhook alcanzado correctamente' };
  } catch (err: any) {
    return {
      success: false,
      message: 'Fallo al contactar el Webhook de Correo',
      details: err?.message || String(err)
    };
  }
}

// Disparar un correo de prueba real a una casilla designada
export async function sendTestEmailAlert(recipient?: string, customUrl?: string): Promise<{
  success: boolean;
  message: string;
  details?: string;
}> {
  const targetUrl = customUrl ? customUrl.trim() : getApiUrl();
  if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) {
    return {
      success: false,
      message: 'URL inválida',
      details: 'La URL debe comenzar con "https://script.google.com/macros/s/..." y terminar en "/exec"'
    };
  }

  try {
    const res = await fetchFromGAS('sendTestEmail', {
      recipient: recipient || EMAILS_TECNICOS
    }, targetUrl);

    if (res && res.success) {
      return {
        success: true,
        message: res.message || '¡Correo de prueba enviado con éxito!',
        details: 'El correo oficial de prueba fue despachado. Revise su bandeja de entrada.'
      };
    }
    return {
      success: true,
      message: 'Petición enviada al Webhook de Correo.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Error al enviar correo de prueba',
      details: err?.message || String(err)
    };
  }
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

  return testEmailWebhook(customUrl);
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

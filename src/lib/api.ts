import { MaintenanceRecord, FlatRecord, RecordEstado } from '../types';

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
    } as any, // Cast as any if there's type discrepancy during edit transition
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
    e_maquina: r.egreso.maquina,
    e_isla: r.egreso.isla,
    e_fecha: r.egreso.fecha,
    e_motivo: r.egreso.motivo,
    e_nota: r.egreso.nota || '',
    e_coinin: r.egreso.coinin,
    e_coinout: r.egreso.coinout,
    e_jackpot: r.egreso.jackpot,
    e_prog1: r.egreso.prog1,
    e_prog2: r.egreso.prog2,
    e_prog3: r.egreso.prog3,
    e_prog4: r.egreso.prog4,
    e_devolucion: r.egreso.devolucion,
    e_operador: r.egreso.operador,
    e_firma: r.egreso.firma,
    e_foto: r.egreso.foto,
    t_fecha: r.tecnico ? r.tecnico.fecha : '',
    t_informe: r.tecnico ? r.tecnico.informe : '',
    t_solucion: r.tecnico ? r.tecnico.solucion : '',
    t_tecnico: r.tecnico ? r.tecnico.tecnico : '',
    t_firma: r.tecnico ? r.tecnico.firma : '',
    i_fecha: r.inspector ? r.inspector.fecha : '',
    i_informe: r.inspector ? r.inspector.informe : '',
    i_coinin: r.inspector ? r.inspector.coinin : '',
    i_devolucion: r.inspector ? r.inspector.devolucion : '',
    i_denominacion: r.inspector ? r.inspector.denominacion : '',
    i_apuesta_min: r.inspector ? r.inspector.apuestaMin : '',
    i_apuesta_max: r.inspector ? r.inspector.apuestaMax : '',
    i_mdc: r.inspector ? r.inspector.mdc : '',
    i_inspector: r.inspector ? r.inspector.inspector : '',
    i_firma: r.inspector ? r.inspector.firma : '',
    i_checks_billetes: r.inspector ? JSON.stringify(r.inspector.checksBilletes) : '',
    i_checks_extras: r.inspector ? JSON.stringify(r.inspector.checksExtras) : '',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// Guardar caché localmente de forma segura y libre de duplicados
export function saveToLocalCache(records: MaintenanceRecord[]) {
  try {
    // 1. Deduplicar registros por ID para prevenir errores de claves duplicadas en React
    const uniqueMap = new Map<string, MaintenanceRecord>();
    records.forEach((r, idx) => {
      if (r) {
        const recordId = r.id || `REG-TEMP-${Date.now()}-${idx}`;
        uniqueMap.set(recordId, { ...r, id: recordId });
      }
    });
    const uniqueRecords = Array.from(uniqueMap.values());

    // 2. Intentar guardar en localStorage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(uniqueRecords));
  } catch (e: any) {
    const isQuotaError = 
      e.name === 'QuotaExceededError' || 
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || 
      e.code === 22 || 
      e.code === 1014;

    if (isQuotaError) {
      console.warn('LocalStorage quota exceeded. Shrinking records to save cache space...');
      try {
        // Reducir tamaño eliminando fotos y firmas de los registros completados/viejos
        const minimized = records.map(r => {
          if (r.estado === 'completo') {
            return {
              ...r,
              egreso: { ...r.egreso, foto: '', firma: '' },
              tecnico: r.tecnico ? { ...r.tecnico, firma: '' } : null,
              inspector: r.inspector ? { ...r.inspector, firma: '' } : null,
            };
          }
          return r;
        });
        
        // Deduplicar el minimizado también
        const uniqueMapMin = new Map<string, MaintenanceRecord>();
        minimized.forEach(r => {
          if (r && r.id) {
            uniqueMapMin.set(r.id, r);
          }
        });
        const uniqueMinRecords = Array.from(uniqueMapMin.values());

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(uniqueMinRecords));
      } catch (innerError) {
        console.error('Failed to save minimized records. Performing full strip...');
        try {
          // Si aún falla, remover fotos y firmas de absolutamente TODOS los registros para el caché
          const fullyStripped = records.map(r => ({
            ...r,
            egreso: { ...r.egreso, foto: '', firma: '' },
            tecnico: r.tecnico ? { ...r.tecnico, firma: '' } : null,
            inspector: r.inspector ? { ...r.inspector, firma: '' } : null,
          }));

          const uniqueMapFull = new Map<string, MaintenanceRecord>();
          fullyStripped.forEach(r => {
            if (r && r.id) {
              uniqueMapFull.set(r.id, r);
            }
          });
          const uniqueFullRecords = Array.from(uniqueMapFull.values());

          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(uniqueFullRecords));
        } catch (finalError) {
          console.error('Unable to write to localStorage even after a full asset strip:', finalError);
        }
      }
    } else {
      console.error('Error saving records to localStorage:', e);
    }
  }
}

// Obtener caché local deduplicado
export function getLocalCache(): MaintenanceRecord[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const parsed: MaintenanceRecord[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const uniqueMap = new Map<string, MaintenanceRecord>();
        parsed.forEach((r, idx) => {
          if (r) {
            const recordId = r.id || `REG-TEMP-${Date.now()}-${idx}`;
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

// Realizar llamada de red al script de Google
async function fetchFromGAS(action: string, data?: any, overrideUrl?: string): Promise<any> {
  const targetUrl = overrideUrl || getApiUrl();
  const controller = new AbortController();
  const idTimeout = setTimeout(() => controller.abort(), 9000); // 9 segundos timeout

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify({ action, data }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: controller.signal,
    });
    
    clearTimeout(idTimeout);
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      // Si devolvió HTML en vez de JSON (típico de Google cuando pide login o falta permiso)
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error('Google Apps Script devolvió una página HTML en lugar de JSON. Es probable que falte configurar "Quién tiene acceso: Cualquier persona (Anyone)".');
      }
      throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 100)}`);
    }
  } catch (e) {
    clearTimeout(idTimeout);
    throw e;
  }
}

// Probar conexión contra la URL de Google Apps Script
export async function testApiConnection(customUrl?: string): Promise<{ 
  success: boolean; 
  message: string; 
  details?: string;
  count?: number;
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
    // 1. Probar primero con llamada POST getAll
    const result = await fetchFromGAS('getAll', null, targetUrl);
    if (result && Array.isArray(result.registros)) {
      return {
        success: true,
        message: '¡Conexión exitosa con Google Sheets!',
        details: `La API respondió correctamente. Se encontraron ${result.registros.length} registros en la hoja de cálculo.`,
        count: result.registros.length
      };
    }

    if (result && result.status === 'ok') {
      return {
        success: true,
        message: '¡Conexión exitosa con Google Sheets!',
        details: result.message || 'La API respondió correctamente.'
      };
    }

    return {
      success: false,
      message: 'Respuesta inesperada',
      details: result?.error || 'El script respondió pero con formato de datos desconocido.'
    };
  } catch (err: any) {
    const errorMsg = String(err?.message || err || '');
    
    if (errorMsg.includes('Cualquier persona') || errorMsg.includes('HTML')) {
      return {
        success: false,
        message: 'Error de permisos en Google Apps Script',
        details: 'El script existe, pero Google bloqueó el acceso. Ve a tu Google Apps Script > Implementar > Gestionar implementaciones y asegúrate de que "Quién tiene acceso" esté en "Cualquier persona" (Anyone).'
      };
    }

    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('abort')) {
      return {
        success: false,
        message: 'No se pudo conectar con el servidor',
        details: 'El navegador no pudo comunicarse con la URL. Revisa que tu conexión a internet funcione, que la URL termine en "/exec" y que el despliegue esté publicado para "Cualquier persona".'
      };
    }

    return {
      success: false,
      message: 'Fallo al verificar la API',
      details: errorMsg
    };
  }
}

// Sincronizar todos los registros del caché local a Google Sheets
export async function syncAllLocalToRemote(): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  message: string;
}> {
  const localRecords = getLocalCache();
  if (localRecords.length === 0) {
    return { success: true, message: 'No hay registros locales pendientes para sincronizar.' };
  }

  try {
    const flatRecords = localRecords.map(flattenRecord);
    // Intentar syncBatch
    try {
      const batchResult = await fetchFromGAS('syncBatch', flatRecords);
      if (batchResult && batchResult.success) {
        return {
          success: true,
          inserted: batchResult.inserted || 0,
          updated: batchResult.updated || 0,
          message: `Sincronizados exitosamente ${localRecords.length} registros con Google Sheets.`
        };
      }
    } catch (e) {
      console.warn('Fallo syncBatch, intentando registro por registro...', e);
    }

    // Fallback registro por registro
    let okCount = 0;
    for (const r of localRecords) {
      try {
        const flat = flattenRecord(r);
        await fetchFromGAS('update', flat);
        okCount++;
      } catch (err) {
        console.error('Error al sincronizar registro individual:', r.id, err);
      }
    }

    return {
      success: okCount > 0,
      updated: okCount,
      message: `Se sincronizaron ${okCount} de ${localRecords.length} registros con Google Sheets.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error al sincronizar con la nube: ${err?.message || err}`
    };
  }
}

// Cargar todos los registros (Intentando GAS primero, luego LocalStorage fallback)
export async function loadRecords(): Promise<{ records: MaintenanceRecord[]; source: 'api' | 'local'; error?: string }> {
  try {
    const result = await fetchFromGAS('getAll');
    if (result && result.registros) {
      const parsedRecords = (result.registros as FlatRecord[]).map(parseFlatRecord);
      // Guardar en cache local para que quede actualizado
      saveToLocalCache(parsedRecords);
      return { records: parsedRecords, source: 'api' };
    }
    throw new Error('Formato de respuesta inválido');
  } catch (e: any) {
    console.warn('Fallo de conexión API. Usando caché local.', e);
    const cached = getLocalCache();
    return { 
      records: cached, 
      source: 'local', 
      error: e?.message || 'Error de conexión con el servidor. Datos cargados localmente.'
    };
  }
}

// Guardar o Actualizar un registro (Intentando GAS, y actualizando cache local)
export async function saveRecord(record: MaintenanceRecord): Promise<{ success: boolean; source: 'api' | 'local'; error?: string }> {
  // Primero actualizar caché local siempre para garantizar disponibilidad offline
  const cached = getLocalCache();
  const idx = cached.findIndex(r => r.id === record.id);
  
  if (idx >= 0) {
    cached[idx] = record;
  } else {
    cached.push(record);
  }
  saveToLocalCache(cached);

  try {
    const flat = flattenRecord(record);
    const action = idx >= 0 ? 'update' : 'save';
    const result = await fetchFromGAS(action, flat);
    
    if (result && !result.error) {
      return { success: true, source: 'api' };
    }
    throw new Error(result?.error || 'Error desconocido del servidor');
  } catch (e: any) {
    console.warn('Error al guardar en el servidor. Guardado localmente en caché.', e);
    return { 
      success: true, 
      source: 'local', 
      error: 'Guardado localmente. Se sincronizará con el servidor cuando vuelva la conexión.' 
    };
  }
}

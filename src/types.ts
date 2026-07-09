export interface EgresoData {
  maquina: string;
  isla: string;
  fecha: string;
  motivo: string;
  nota?: string;
  coinin: string;
  coinout: string;
  jackpot: string;
  prog1: string;
  prog2: string;
  prog3: string;
  prog4: string;
  devolucion: string;
  operador: string;
  firma: string; // Base64
  foto: string; // Base64
}

export interface TecnicoData {
  fecha: string;
  informe: string;
  solucion: string;
  tecnico: string;
  firma: string; // Base64
}

export interface InspectorData {
  fecha: string;
  informe: string;
  coinin: string;
  devolucion: string;
  denominacion: string;
  apuestaMin: string;
  apuestaMax: string;
  mdc: string;
  inspector: string;
  firma: string; // Base64
  checksBilletes: Record<string, string>; // e.g. {'$20.000': 'ok', ...}
  checksExtras: Record<string, string>; // e.g. {'Descuento AFT': 'ok', ...}
}

export type RecordEstado = 'egreso' | 'tecnico' | 'completo';

export interface MaintenanceRecord {
  id: string;
  estado: RecordEstado;
  egreso: EgresoData;
  tecnico: TecnicoData | null;
  inspector: InspectorData | null;
  created_at: string;
  updated_at: string;
}

// Representación plana que se envía y recibe de Google Apps Script / Google Sheets
export interface FlatRecord {
  id: string;
  estado: RecordEstado;
  e_maquina: string;
  e_isla: string;
  e_fecha: string;
  e_motivo: string;
  e_nota?: string;
  e_coinin: string;
  e_coinout: string;
  e_jackpot: string;
  e_prog1: string;
  e_prog2: string;
  e_prog3: string;
  e_prog4: string;
  e_devolucion: string;
  e_operador: string;
  e_firma: string;
  e_foto?: string;
  t_fecha: string;
  t_informe: string;
  t_solucion: string;
  t_tecnico: string;
  t_firma: string;
  i_fecha: string;
  i_informe: string;
  i_coinin: string;
  i_devolucion: string;
  i_denominacion: string;
  i_apuesta_min: string;
  i_apuesta_max: string;
  i_mdc: string;
  i_inspector: string;
  i_firma: string;
  i_checks_billetes: string; // JSON Stringified
  i_checks_extras: string; // JSON Stringified
  created_at?: string;
  updated_at?: string;
}

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  PlusCircle, 
  RefreshCw, 
  FileText, 
  Camera, 
  Upload, 
  X, 
  ChevronRight, 
  User, 
  Calendar, 
  DollarSign, 
  Activity, 
  Sparkles, 
  Clock, 
  ArrowLeft, 
  Check, 
  CheckCircle,
  Database,
  Wifi,
  WifiOff,
  Sliders,
  TrendingUp,
  FileCheck2,
  Trash2
} from 'lucide-react';

import { MaintenanceRecord, RecordEstado } from './types';
import { loadRecords, saveRecord, flattenRecord } from './lib/api';
import { generarPDF, formatFecha, formatPesos, generarPDFResumenFueraDeServicio } from './lib/pdf';
import SignatureCanvas from './components/SignatureCanvas';

// Constantes
const MOTIVOS = [
  'Borrado total',
  'Borrado parcial',
  'Clear',
  'Cambio de layout',
  'Cambio de juego',
  'Cambio de denominación',
  'Falla técnica',
  'Mantenimiento preventivo',
  'Baja transitoria'
];

const BILLETES = ['$20.000', '$10.000', '$2.000', '$1.000', '$500', '$200', '$100'];
const CONTROLES_EXTRAS = [
  { id: 'aft', label: 'Descuento AFT correcto' },
  { id: 'tickets', label: 'Acredita tickets correctamente' }
];

export default function App() {
  // Estado global de datos
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'lista' | 'egreso' | 'tecnico' | 'inspector' | 'estadisticas'>('lista');
  const [connectionStatus, setConnectionStatus] = useState<{ source: 'api' | 'local'; error?: string }>({ source: 'api' });
  const [alerts, setAlerts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'danger' }>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showOutofServiceSummary, setShowOutofServiceSummary] = useState(false);

  // Modos de selección de etapas cruzadas
  const [selectedRecordForTecnico, setSelectedRecordForTecnico] = useState<MaintenanceRecord | null>(null);
  const [selectedRecordForInspector, setSelectedRecordForInspector] = useState<MaintenanceRecord | null>(null);
  const [searchTecnicoMaq, setSearchTecnicoMaq] = useState('');
  const [searchInspectorMaq, setSearchInspectorMaq] = useState('');

  // --- ESTADO DE FORMULARIOS ---
  
  // Etapa 1: Egreso Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eMaquina, setEMaquina] = useState('');
  const [eIsla, setEIsla] = useState('');
  const [eFecha, setEFecha] = useState('');
  const [eMotivo, setEMotivo] = useState('');
  const [eCoinIn, setECoinIn] = useState('');
  const [eCoinOut, setECoinOut] = useState('');
  const [eJackpot, setEJackpot] = useState('');
  const [eProg1, setEProg1] = useState('');
  const [eProg2, setEProg2] = useState('');
  const [eProg3, setEProg3] = useState('');
  const [eProg4, setEProg4] = useState('');
  const [eDevolucion, setEDevolucion] = useState('');
  const [eFoto, setEFoto] = useState('');
  const [eOperador, setEOperador] = useState('');
  const [eFirma, setEFirma] = useState('');
  const [eNota, setENota] = useState('');

  // Etapa 2: Técnico Form State
  const [tInforme, setTInforme] = useState('');
  const [tFecha, setTFecha] = useState('');
  const [tSolucion, setTSolucion] = useState('');
  const [tTecnico, setTTecnico] = useState('');
  const [tFirma, setTFirma] = useState('');

  // Etapa 3: Inspector Form State
  const [iFecha, setIFecha] = useState('');
  const [iCoinIn, setICoinIn] = useState('');
  const [iDevolucion, setIDevolucion] = useState('');
  const [iDenominacion, setIDenominacion] = useState('');
  const [iApuestaMin, setIApuestaMin] = useState('');
  const [iApuestaMax, setIApuestaMax] = useState('');
  const [iMdc, setIMdc] = useState('');
  const [iInspector, setIInspector] = useState('');
  const [iFirma, setIFirma] = useState('');
  const [iChecksBilletes, setIChecksBilletes] = useState<Record<string, string>>({});
  const [iChecksExtras, setIChecksExtras] = useState<Record<string, string>>({});

  // Carga inicial
  useEffect(() => {
    fetchData();
    // Reloj dinámico
    const timer = setInterval(() => {
      // Forzar render del reloj si se requiriera, pero lo manejamos nativamente o en UI
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const addAlert = (message: string, type: 'success' | 'info' | 'danger' = 'success') => {
    const id = Date.now().toString();
    setAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    const res = await loadRecords();
    
    // Deduplicar registros para evitar errores de claves duplicadas (React Key)
    const uniqueMap = new Map<string, MaintenanceRecord>();
    res.records.forEach(r => {
      if (r && r.id) {
        uniqueMap.set(r.id, r);
      }
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    
    setRecords(uniqueRecords);
    setConnectionStatus({ source: res.source, error: res.error });
    if (res.error) {
      addAlert(res.error, 'info');
    } else {
      addAlert('Registros actualizados desde el servidor.', 'success');
    }
    setLoading(false);
  };

  const getNowDateTimeString = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  // --- INICIADORES DE FORMULARIOS ---
  const resetEgresoForm = (record?: MaintenanceRecord) => {
    if (record) {
      // Editar egreso existente
      setEditingId(record.id);
      setEMaquina(record.egreso.maquina);
      setEIsla(record.egreso.isla);
      setEFecha(record.egreso.fecha);
      setEMotivo(record.egreso.motivo);
      setENota(record.egreso.nota || '');
      setECoinIn(record.egreso.coinin);
      setECoinOut(record.egreso.coinout);
      setEJackpot(record.egreso.jackpot);
      setEProg1(record.egreso.prog1);
      setEProg2(record.egreso.prog2);
      setEProg3(record.egreso.prog3);
      setEProg4(record.egreso.prog4);
      setEDevolucion(record.egreso.devolucion);
      setEFoto(record.egreso.foto);
      setEOperador(record.egreso.operador);
      setEFirma(record.egreso.firma);
      setActiveTab('egreso'); // Cambiar automáticamente a la pestaña de Egreso para corregir datos
    } else {
      // Nuevo egreso
      setEditingId(null);
      setEMaquina('');
      setEIsla('');
      setEFecha(getNowDateTimeString());
      setEMotivo('');
      setENota('');
      setECoinIn('');
      setECoinOut('');
      setEJackpot('');
      setEProg1('');
      setEProg2('');
      setEProg3('');
      setEProg4('');
      setEDevolucion('');
      setEFoto('');
      setEOperador('');
      setEFirma('');
    }
  };

  const initTecnicoForm = (record: MaintenanceRecord) => {
    setSelectedRecordForTecnico(record);
    setTInforme('');
    setTFecha(getNowDateTimeString());
    setTSolucion('');
    setTTecnico('');
    setTFirma('');
    setActiveTab('tecnico');
  };

  const initInspectorForm = (record: MaintenanceRecord) => {
    setSelectedRecordForInspector(record);
    setIFecha(getNowDateTimeString());
    setICoinIn('');
    setIDevolucion(record.egreso.devolucion); // valor recomendado o anterior
    setIDenominacion('');
    setIApuestaMin('');
    setIApuestaMax('');
    setIMdc('');
    setIInspector('');
    setIFirma('');
    
    // Inicializar checks en vacío o neutral
    const initBilletes: Record<string, string> = {};
    BILLETES.forEach(b => { initBilletes[b] = ''; });
    setIChecksBilletes(initBilletes);

    const initExtras: Record<string, string> = {};
    CONTROLES_EXTRAS.forEach(ex => { initExtras[ex.label] = ''; });
    setIChecksExtras(initExtras);
    
    setActiveTab('inspector');
  };

  // --- SUBMITS DE ETAPAS ---

  // Etapa 1: Enviar Egreso
  const handleGuardarEgreso = async (e: FormEvent) => {
    e.preventDefault();
    if (!eMaquina || !eIsla || !eFecha || !eMotivo || !eOperador) {
      addAlert('Por favor complete los campos obligatorios.', 'danger');
      return;
    }

    setLoading(true);
    const targetId = editingId || 'REG-' + Date.now();
    const isNew = !editingId;

    const updatedRecord: MaintenanceRecord = {
      id: targetId,
      estado: 'egreso',
      created_at: isNew ? new Date().toISOString() : (records.find(r => r.id === targetId)?.created_at || new Date().toISOString()),
      updated_at: new Date().toISOString(),
      egreso: {
        maquina: eMaquina,
        isla: eIsla,
        fecha: eFecha,
        motivo: eMotivo,
        nota: eNota,
        coinin: eCoinIn,
        coinout: eCoinOut,
        jackpot: eJackpot,
        prog1: eProg1,
        prog2: eProg2,
        prog3: eProg3,
        prog4: eProg4,
        devolucion: eDevolucion,
        operador: eOperador,
        firma: eFirma,
        foto: eFoto,
      },
      tecnico: isNew ? null : (records.find(r => r.id === targetId)?.tecnico || null),
      inspector: isNew ? null : (records.find(r => r.id === targetId)?.inspector || null)
    };

    const res = await saveRecord(updatedRecord);
    setLoading(false);

    if (res.success) {
      addAlert(
        isNew 
          ? `✓ Egreso registrado. Correo de aviso enviado a técnicos y juego.`
          : '✓ Cambios de egreso actualizados correctamente.', 
        'success'
      );
      
      // Actualizar estado reactivo local
      if (isNew) {
        setRecords(prev => [updatedRecord, ...prev]);
      } else {
        setRecords(prev => prev.map(r => r.id === targetId ? updatedRecord : r));
      }

      resetEgresoForm();
      setActiveTab('lista');
    }
  };

  // Etapa 2: Registrar Reparación Técnica
  const handleGuardarTecnico = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForTecnico) {
      addAlert('Debe seleccionar una máquina egresada primero.', 'danger');
      return;
    }
    if (!tFecha || !tSolucion || !tTecnico) {
      addAlert('Complete todos los campos obligatorios de reparación.', 'danger');
      return;
    }

    setLoading(true);
    const recordToUpdate: MaintenanceRecord = {
      ...selectedRecordForTecnico,
      estado: 'tecnico',
      updated_at: new Date().toISOString(),
      tecnico: {
        fecha: tFecha,
        informe: tInforme,
        solucion: tSolucion,
        tecnico: tTecnico,
        firma: tFirma,
      }
    };

    const res = await saveRecord(recordToUpdate);
    setLoading(false);

    if (res.success) {
      addAlert(`✓ Reparación registrada. Correo de aviso enviado solo a juego.`, 'success');
      setRecords(prev => prev.map(r => r.id === recordToUpdate.id ? recordToUpdate : r));
      setSelectedRecordForTecnico(null);
      setSearchTecnicoMaq('');
      setActiveTab('lista');
    }
  };

  // Etapa 3: Registrar Inspección y Reingreso
  const handleGuardarInspector = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForInspector) {
      addAlert('Debe seleccionar una máquina reparada primero.', 'danger');
      return;
    }
    if (!iFecha || !iInspector) {
      addAlert('Complete la fecha y nombre del inspector para continuar.', 'danger');
      return;
    }

    // Verificar si hay algún fallo o falta firmar
    setLoading(true);
    const recordToUpdate: MaintenanceRecord = {
      ...selectedRecordForInspector,
      estado: 'completo',
      updated_at: new Date().toISOString(),
      inspector: {
        fecha: iFecha,
        informe: selectedRecordForInspector.tecnico?.informe || '',
        coinin: iCoinIn,
        devolucion: iDevolucion,
        denominacion: iDenominacion,
        apuestaMin: iApuestaMin,
        apuestaMax: iApuestaMax,
        mdc: iMdc,
        inspector: iInspector,
        firma: iFirma,
        checksBilletes: iChecksBilletes,
        checksExtras: iChecksExtras,
      }
    };

    const res = await saveRecord(recordToUpdate);
    setLoading(false);

    if (res.success) {
      addAlert(`✓ Inspección completada. Máquina reingresada en servicio. Correo de aviso enviado solo a juego.`, 'success');
      setRecords(prev => prev.map(r => r.id === recordToUpdate.id ? recordToUpdate : r));
      setSelectedRecordForInspector(null);
      setSearchInspectorMaq('');
      setActiveTab('lista');
    }
  };

  // Procesador de fotos en base64
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setEFoto(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Controles de checks en la inspección
  const toggleCheckBillete = (billete: string, status: 'ok' | 'fail') => {
    setIChecksBilletes(prev => ({
      ...prev,
      [billete]: prev[billete] === status ? '' : status
    }));
  };

  const toggleCheckExtra = (label: string, status: 'ok' | 'fail') => {
    setIChecksExtras(prev => ({
      ...prev,
      [label]: prev[label] === status ? '' : status
    }));
  };

  // --- FILTROS DE LISTA ---
  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.egreso.maquina.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.egreso.isla.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.egreso.operador.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = !statusFilter || r.estado === statusFilter;

    // Filtro por rango de fechas (comparando la parte de fecha YYYY-MM-DD)
    let matchesDates = true;
    if (r.egreso.fecha) {
      const recordDateStr = r.egreso.fecha.split('T')[0]; // Extrae 'YYYY-MM-DD'
      if (startDate && recordDateStr < startDate) {
        matchesDates = false;
      }
      if (endDate && recordDateStr > endDate) {
        matchesDates = false;
      }
    } else {
      if (startDate || endDate) {
        matchesDates = false;
      }
    }

    return matchesSearch && matchesStatus && matchesDates;
  });

  // --- OBTENER REGISTROS PARA ETAPAS CRUZADAS EN BUSCADOR ---
  const pendingReparacionRecords = records.filter(r => r.estado === 'egreso');
  const pendingInspeccionRecords = records.filter(r => r.estado === 'tecnico');

  const matchesTecnicoSearch = pendingReparacionRecords.filter(r => 
    r.egreso.maquina.toLowerCase().includes(searchTecnicoMaq.toLowerCase())
  );

  const matchesInspectorSearch = pendingInspeccionRecords.filter(r => 
    r.egreso.maquina.toLowerCase().includes(searchInspectorMaq.toLowerCase())
  );

  // --- CÁLCULO DE ESTADÍSTICAS ---
  const statsTotal = records.length;
  const statsPendientes = records.filter(r => r.estado === 'egreso' || r.estado === 'tecnico').length;
  const statsCompleto = records.filter(r => r.estado === 'completo').length;

  // 1. Ranking de máquinas más problemáticas
  const machineFaultCount: Record<string, number> = {};
  records.forEach(r => {
    const key = `Máquina ${r.egreso.maquina} (Isla ${r.egreso.isla})`;
    machineFaultCount[key] = (machineFaultCount[key] || 0) + 1;
  });
  const sortedMachines = Object.entries(machineFaultCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxMachineFaults = sortedMachines.length > 0 ? sortedMachines[0][1] : 1;

  // 2. Ranking de motivos de egreso
  const motiveCount: Record<string, number> = {};
  records.forEach(r => {
    motiveCount[r.egreso.motivo] = (motiveCount[r.egreso.motivo] || 0) + 1;
  });
  const sortedMotives = Object.entries(motiveCount)
    .sort((a, b) => b[1] - a[1]);
  const maxMotiveCount = sortedMotives.length > 0 ? sortedMotives[0][1] : 1;

  // 3. Tiempos de reparación
  const repairTimesInHours = records
    .filter(r => r.tecnico && r.egreso.fecha && r.tecnico.fecha)
    .map(r => {
      const ini = new Date(r.egreso.fecha).getTime();
      const fin = new Date(r.tecnico!.fecha).getTime();
      return (fin - ini) / (1000 * 60 * 60); // Horas
    })
    .filter(hours => hours > 0 && hours < 720); // filtrar anomalías > 30 días

  const avgRepairTime = repairTimesInHours.length > 0 
    ? repairTimesInHours.reduce((a, b) => a + b, 0) / repairTimesInHours.length 
    : 0;
  const minRepairTime = repairTimesInHours.length > 0 ? Math.min(...repairTimesInHours) : 0;
  const maxRepairTime = repairTimesInHours.length > 0 ? Math.max(...repairTimesInHours) : 0;

  const formatHours = (h: number) => {
    if (h === 0) return '-';
    if (h < 1) return `${Math.round(h * 60)} min`;
    return `${h.toFixed(1)} hs`;
  };

  const getOutofServicePlainText = () => {
    const oos = records.filter(r => r.estado !== 'completo');
    if (oos.length === 0) return 'No hay máquinas fuera de servicio actualmente. ¡Sala 100% operativa!';
    
    let text = `🚨 *RESUMEN DE MÁQUINAS FUERA DE SERVICIO* 🚨\n`;
    text += `*Casino Santa Fe — Sala de Juego*\n`;
    text += `_Generado: ${new Date().toLocaleString('es-AR')}_\n`;
    text += `====================================\n`;
    text += `Total inhabilitadas: *${oos.length} máquinas*\n\n`;
    
    oos.forEach((r, idx) => {
      const estadoStr = r.estado === 'egreso' ? 'Fuera de Servicio (Paso 1)' : 'Reparada — Pendiente Control (Paso 2)';
      const fechaStr = r.egreso.fecha ? formatFecha(r.egreso.fecha) : '-';
      text += `${idx + 1}. *MÁQUINA ${r.egreso.maquina}* · Isla ${r.egreso.isla}\n`;
      text += `   • *Motivo:* ${r.egreso.motivo || 'Falla'}\n`;
      if (r.egreso.nota) {
        text += `   • *Nota:* ${r.egreso.nota}\n`;
      }
      text += `   • *Fecha Egreso:* ${fechaStr}\n`;
      text += `   • *Estado:* ${estadoStr}\n`;
      if (r.tecnico) {
        text += `   • *Técnico:* ${r.tecnico.tecnico || '-'}\n`;
      }
      text += `\n`;
    });
    
    text += `====================================\n`;
    text += `Mantenimiento Oficial Casino Santa Fe`;
    return text;
  };

  return (
    <div className="min-height-screen bg-[#0d0d15] text-[#e8e8f0] font-sans antialiased pb-12">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-[#c8a84b]/20 border-t-[#c8a84b] rounded-full animate-spin" />
          <p className="text-[#c8a84b] font-medium animate-pulse tracking-wide text-sm">Sincronizando con el sistema...</p>
        </div>
      )}

      {/* Floating Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {alerts.map(a => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={`p-4 rounded-xl shadow-lg border text-xs flex items-start gap-3 pointer-events-auto ${
                a.type === 'success' 
                  ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' 
                  : a.type === 'danger'
                  ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                  : 'bg-blue-950/90 border-blue-500/30 text-blue-200'
              }`}
            >
              {a.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
              {a.type === 'danger' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {a.type === 'info' && <Database className="w-4 h-4 text-blue-400 shrink-0" />}
              <div>
                <p className="font-medium">{a.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="bg-[#12121e]/85 backdrop-blur-md border-b border-[#c8a84b]/15 sticky top-0 z-40 px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#c8a84b] to-[#f0d882] flex items-center justify-center shadow-md shadow-[#c8a84b]/10">
              <span className="text-black font-extrabold text-lg select-none">♦</span>
            </div>
            <div>
              <h1 className="text-sm md:text-base font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#f0d882] to-[#c8a84b] uppercase">
                Mantenimiento Casino Santa Fe
              </h1>
              <p className="text-[11px] text-[#9090a8] font-medium tracking-wide">
                Sistema de Control y Flujo Correctivo Automatizado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time Connection Indicator */}
            <div className={`px-2.5 py-1 rounded-full border text-[10px] font-mono flex items-center gap-1.5 ${
              connectionStatus.source === 'api' 
                ? 'bg-emerald-950/30 border-emerald-500/25 text-emerald-400' 
                : 'bg-amber-950/30 border-amber-500/25 text-amber-400'
            }`}>
              {connectionStatus.source === 'api' ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>En Línea (Cloud Sync)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>Modo Local (Offline Guardado)</span>
                </>
              )}
            </div>

            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-[#1a1a2e] hover:bg-[#25253e] border border-[#c8a84b]/25 transition-all text-[#c8a84b]"
              title="Sincronizar y actualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 mt-6">
        {/* Pipeline Stepper */}
        <div className="grid grid-cols-5 gap-1 md:gap-2 bg-[#12121f] p-1.5 rounded-xl border border-[#c8a84b]/15 mb-6 shadow-xl">
          <button
            onClick={() => setActiveTab('lista')}
            className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all relative ${
              activeTab === 'lista' ? 'bg-[#c8a84b]/15 text-[#f0d882]' : 'text-[#9090a8] hover:text-[#e8e8f0] hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 md:w-5 h-4 md:h-5 mb-1" />
            <span className="text-[9px] md:text-xs font-semibold">Registros</span>
          </button>

          <button
            onClick={() => { resetEgresoForm(); setActiveTab('egreso'); }}
            className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all relative ${
              activeTab === 'egreso' ? 'bg-[#c8a84b]/15 text-[#f0d882]' : 'text-[#9090a8] hover:text-[#e8e8f0] hover:bg-white/5'
            }`}
          >
            <div className="relative">
              <AlertCircle className="w-4 md:w-5 h-4 md:h-5 mb-1" />
              {pendingReparacionRecords.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingReparacionRecords.length}
                </span>
              )}
            </div>
            <span className="text-[9px] md:text-xs font-semibold">1. Egreso</span>
          </button>

          <button
            onClick={() => setActiveTab('tecnico')}
            className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all relative ${
              activeTab === 'tecnico' ? 'bg-[#c8a84b]/15 text-[#f0d882]' : 'text-[#9090a8] hover:text-[#e8e8f0] hover:bg-white/5'
            }`}
          >
            <div className="relative">
              <Wrench className="w-4 md:w-5 h-4 md:h-5 mb-1" />
              {pendingReparacionRecords.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-black text-[9px] font-extrabold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingReparacionRecords.length}
                </span>
              )}
            </div>
            <span className="text-[9px] md:text-xs font-semibold">2. Técnico</span>
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all relative ${
              activeTab === 'inspector' ? 'bg-[#c8a84b]/15 text-[#f0d882]' : 'text-[#9090a8] hover:text-[#e8e8f0] hover:bg-white/5'
            }`}
          >
            <div className="relative">
              <CheckCircle2 className="w-4 md:w-5 h-4 md:h-5 mb-1" />
              {pendingInspeccionRecords.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-sky-500 text-black text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingInspeccionRecords.length}
                </span>
              )}
            </div>
            <span className="text-[9px] md:text-xs font-semibold">3. Control</span>
          </button>

          <button
            onClick={() => setActiveTab('estadisticas')}
            className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all relative ${
              activeTab === 'estadisticas' ? 'bg-[#c8a84b]/15 text-[#f0d882]' : 'text-[#9090a8] hover:text-[#e8e8f0] hover:bg-white/5'
            }`}
          >
            <TrendingUp className="w-4 md:w-5 h-4 md:h-5 mb-1" />
            <span className="text-[9px] md:text-xs font-semibold">Stats</span>
          </button>
        </div>

        {/* CONTENIDO DE TABS */}
        <AnimatePresence mode="wait">
          {/* TAB: LISTA DE REGISTROS */}
          {activeTab === 'lista' && (
            <motion.div
              key="tab-lista"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Barra de Filtros */}
              <div className="bg-[#12121f] border border-[#c8a84b]/15 p-4 rounded-xl space-y-3.5 shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                  <div className="flex flex-1 flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#9090a8] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar máquina, isla u operador..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#171726] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                    >
                      <option value="">Todos los estados</option>
                      <option value="egreso">🔴 Fuera de Servicio</option>
                      <option value="tecnico">🔧 Reparada (Pendiente Control)</option>
                      <option value="completo">✅ En Servicio (Cerrado)</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 shrink-0 w-full md:w-auto">
                    <button
                      onClick={() => setShowOutofServiceSummary(true)}
                      className="flex-1 md:flex-initial bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                      id="btn-resumen-fds"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      Resumen Fuera de Servicio
                    </button>

                    <button
                      onClick={() => { resetEgresoForm(); setActiveTab('egreso'); }}
                      className="flex-1 md:flex-initial bg-[#c8a84b] hover:bg-[#f0d882] text-black font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Nueva Máquina Fuera de Servicio
                    </button>
                  </div>
                </div>

                {/* Sub-barra: Rango de Fechas */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2.5 border-t border-white/5">
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <span className="text-[11px] text-[#9090a8] font-semibold uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <Calendar className="w-3.5 h-3.5 text-[#c8a84b]" />
                      Filtrar por egreso:
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#9090a8]">Desde</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          className="bg-[#171726] border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0] [color-scheme:dark]"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#9090a8]">Hasta</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={e => setEndDate(e.target.value)}
                          className="bg-[#171726] border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0] [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>

                  {(startDate || endDate || searchTerm || statusFilter) && (
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setSearchTerm('');
                        setStatusFilter('');
                      }}
                      className="text-[11px] text-[#c8a84b] hover:text-[#f0d882] font-semibold flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-white/5 transition-all self-end sm:self-auto"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de Registros */}
              <div className="space-y-3">
                {filteredRecords.length === 0 ? (
                  <div className="bg-[#12121f] border border-white/5 p-12 text-center rounded-xl">
                    <AlertCircle className="w-10 h-10 text-[#9090a8] mx-auto mb-3" />
                    <p className="text-sm text-[#9090a8] font-medium">No se encontraron registros de mantenimiento.</p>
                  </div>
                ) : (
                  filteredRecords.map(r => (
                    <div 
                      key={r.id} 
                      className="bg-[#12121e] border border-white/5 hover:border-[#c8a84b]/25 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all shadow-md"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shadow-sm ${
                          r.estado === 'egreso' 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : r.estado === 'tecnico'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {r.estado === 'egreso' ? '🔴' : r.estado === 'tecnico' ? '🔧' : '✅'}
                        </div>
                        
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-white tracking-wide">
                              Máquina {r.egreso.maquina} <span className="text-[#9090a8] font-normal">·</span> Isla {r.egreso.isla}
                            </h3>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              r.estado === 'egreso' 
                                ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' 
                                : r.estado === 'tecnico'
                                ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                            }`}>
                              {r.estado === 'egreso' ? 'Fuera de Servicio' : r.estado === 'tecnico' ? 'Reparada — Pendiente Control' : 'En Servicio'}
                            </span>
                          </div>
                          
                          <p className="text-xs text-[#9090a8] mt-1">
                            Motivo: <span className="text-[#e8e8f0] font-medium">{r.egreso.motivo}</span>
                            {r.egreso.nota && (
                              <span className="block text-[#a0a0b8] italic text-[11px] mt-1 bg-black/20 px-2 py-1 rounded border border-white/5 max-w-md">
                                Nota: {r.egreso.nota}
                              </span>
                            )}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-[#9090a8]">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#c8a84b]" />
                              Egreso: {formatFecha(r.egreso.fecha)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-[#c8a84b]" />
                              Op: {r.egreso.operador}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end pt-3 md:pt-0 border-t border-white/5 md:border-0">
                        {r.estado === 'egreso' && (
                          <>
                            <button
                              onClick={() => resetEgresoForm(r)}
                              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-1.5 px-3 rounded-lg transition-all"
                            >
                              Editar Egreso
                            </button>
                            <button
                              onClick={() => initTecnicoForm(r)}
                              className="text-xs bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              Reparar
                            </button>
                          </>
                        )}
                        {r.estado === 'tecnico' && (
                          <button
                            onClick={() => initInspectorForm(r)}
                            className="text-xs bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold py-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Controlar
                          </button>
                        )}
                        {r.estado === 'completo' && (
                          <button
                            onClick={() => generarPDF(r)}
                            className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 font-semibold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-all"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            Acta PDF
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* TAB: ETAPA 1 - EGRESO DE MÁQUINA */}
          {activeTab === 'egreso' && (
            <motion.div
              key="tab-egreso"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#12121e] border border-[#c8a84b]/15 rounded-xl p-5 md:p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 border-b border-[#c8a84b]/15 pb-4 mb-6">
                <span className="text-2xl text-rose-500">🔴</span>
                <div>
                  <h2 className="text-sm md:text-base font-bold text-[#f0d882] tracking-wide">
                    {editingId ? 'Editar Egreso de Máquina' : 'Etapa 1 — Egreso de Máquina'}
                  </h2>
                  <p className="text-xs text-[#9090a8] mt-0.5">
                    Declarar máquina fuera de servicio y enviar notificaciones a técnicos.
                  </p>
                </div>
              </div>

              <form onSubmit={handleGuardarEgreso} className="space-y-6">
                {/* 1. Identificación */}
                <div>
                  <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-3">
                    Identificación de la Máquina
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        N° Máquina *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 0042"
                        value={eMaquina}
                        onChange={e => setEMaquina(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        N° Isla *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 07"
                        value={eIsla}
                        onChange={e => setEIsla(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Fecha y Hora *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={eFecha}
                        onChange={e => setEFecha(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Motivo */}
                <div className="border-t border-white/5 pt-5">
                  <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-3">
                    Motivo de Salida del Servicio
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Seleccionar causa principal *
                      </label>
                      <select
                        required
                        value={eMotivo}
                        onChange={e => setEMotivo(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2.5 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      >
                        <option value="">— Seleccionar causa —</option>
                        {MOTIVOS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Aclaración / Nota (Opcional)
                      </label>
                      <textarea
                        placeholder="Detalles adicionales sobre el motivo de salida o estado general..."
                        rows={1}
                        value={eNota}
                        onChange={e => setENota(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2.5 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0] resize-none h-[40px]"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Contadores */}
                <div className="border-t border-white/5 pt-5">
                  <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-3">
                    Contadores de Máquina
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        COIN IN ($)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 15000"
                        value={eCoinIn}
                        onChange={e => setECoinIn(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        COIN OUT ($)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 12400"
                        value={eCoinOut}
                        onChange={e => setECoinOut(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Jackpot ($)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 5000"
                        value={eJackpot}
                        onChange={e => setEJackpot(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Progresivos */}
                <div className="border-t border-white/5 pt-5">
                  <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-3">
                    Progresivos de Pozo
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {['1', '2', '3', '4'].map(pNum => {
                      const val = pNum === '1' ? eProg1 : pNum === '2' ? eProg2 : pNum === '3' ? eProg3 : eProg4;
                      const setVal = pNum === '1' ? setEProg1 : pNum === '2' ? setEProg2 : pNum === '3' ? setEProg3 : setEProg4;
                      
                      return (
                        <div key={pNum} className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                            Progresivo {pNum} ($)
                          </label>
                          <input
                            type="text"
                            placeholder="0,00"
                            value={val}
                            onChange={e => setVal(e.target.value)}
                            className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-1.5 mt-4">
                    <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                      % de Devolución
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 94.5%"
                      value={eDevolucion}
                      onChange={e => setEDevolucion(e.target.value)}
                      className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                    />
                  </div>
                </div>

                {/* 5. Foto de la máquina */}
                <div className="border-t border-white/5 pt-5">
                  <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-2">
                    Foto de la Máquina / Causa del Problema
                  </h3>
                  <p className="text-[11px] text-[#9090a8] mb-4">
                    Tome una fotografía en tiempo real de la pantalla o cargue una imagen desde los archivos del dispositivo.
                  </p>

                  <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="flex gap-2 flex-wrap">
                      <label className="cursor-pointer bg-[#1e1e35] hover:bg-[#282848] text-white font-medium text-xs py-2 px-4 rounded-lg border border-white/10 flex items-center gap-2 transition-all">
                        <Camera className="w-4 h-4 text-[#c8a84b]" />
                        Tomar foto con cámara
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>

                      <label className="cursor-pointer bg-[#1e1e35] hover:bg-[#282848] text-white font-medium text-xs py-2 px-4 rounded-lg border border-white/10 flex items-center gap-2 transition-all">
                        <Upload className="w-4 h-4 text-[#c8a84b]" />
                        Subir archivo de imagen
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>

                      {eFoto && (
                        <button
                          type="button"
                          onClick={() => setEFoto('')}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-semibold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all"
                        >
                          <X className="w-4 h-4" />
                          Quitar foto
                        </button>
                      )}
                    </div>

                    {eFoto && (
                      <div className="relative border border-[#c8a84b]/30 rounded-xl overflow-hidden max-w-xs bg-black/45">
                        <img 
                          src={eFoto} 
                          alt="Previsualización" 
                          className="max-h-40 object-contain mx-auto block" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Autorización / Firma */}
                <div className="border-t border-white/5 pt-5">
                  <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-3">
                    Firma del Operador Autorizante
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Nombre del Operador *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Carlos G."
                        value={eOperador}
                        onChange={e => setEOperador(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2.5 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Firma Digital *
                      </label>
                      <SignatureCanvas 
                        onSave={setEFirma} 
                        placeholder="Firme en este lienzo" 
                        id="firma-egreso-canvas" 
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { resetEgresoForm(); setActiveTab('lista'); }}
                    className="bg-[#1e1e35] hover:bg-[#282848] border border-white/10 text-white font-medium text-xs py-2.5 px-5 rounded-lg transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold text-xs py-2.5 px-6 rounded-lg transition-all shadow-md active:scale-95"
                  >
                    {editingId ? '💾 Guardar Cambios' : '📤 Registrar Egreso y Enviar Alerta'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* TAB: ETAPA 2 - REGISTRO TÉCNICO */}
          {activeTab === 'tecnico' && (
            <motion.div
              key="tab-tecnico"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#12121e] border border-[#c8a84b]/15 rounded-xl p-5 md:p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 border-b border-[#c8a84b]/15 pb-4 mb-6">
                <span className="text-2xl text-amber-500">🔧</span>
                <div>
                  <h2 className="text-sm md:text-base font-bold text-[#f0d882] tracking-wide">
                    Etapa 2 — Registro de Reparación Técnica
                  </h2>
                  <p className="text-xs text-[#9090a8] mt-0.5">
                    Busque la máquina egresada para registrar la solución correctiva aplicada.
                  </p>
                </div>
              </div>

              {!selectedRecordForTecnico ? (
                /* Pantalla de búsqueda si no hay registro cargado */
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#9090a8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ingrese el número de máquina para iniciar..."
                      value={searchTecnicoMaq}
                      onChange={e => setSearchTecnicoMaq(e.target.value)}
                      className="w-full bg-[#171726] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider mb-2">
                      Máquinas actualmente pendientes de reparación ({pendingReparacionRecords.length})
                    </h4>
                    
                    {matchesTecnicoSearch.length === 0 ? (
                      <div className="p-4 bg-white/2 rounded-lg text-center text-xs text-[#9090a8]">
                        No se encontraron máquinas en fuera de servicio con ese criterio.
                      </div>
                    ) : (
                      matchesTecnicoSearch.map(r => (
                        <div 
                          key={r.id} 
                          className="bg-[#1a1a2b] border border-white/5 rounded-xl p-3 flex justify-between items-center"
                        >
                          <div>
                            <span className="text-xs font-bold text-white block">
                              Máquina {r.egreso.maquina} <span className="text-[#9090a8]">·</span> Isla {r.egreso.isla}
                            </span>
                            <span className="text-[11px] text-[#9090a8] mt-0.5 block">
                              Motivo: {r.egreso.motivo} — Egreso: {formatFecha(r.egreso.fecha)}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => initTecnicoForm(r)}
                            className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold text-xs py-1.5 px-3.5 rounded-lg transition-all active:scale-95 shadow-sm"
                          >
                            Seleccionar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Formulario de carga técnica */
                <form onSubmit={handleGuardarTecnico} className="space-y-5">
                  {/* Banner de Referencia de Egreso */}
                  <div className="bg-[#1c1c30] border-l-4 border-amber-500 rounded-r-xl p-4 text-xs text-amber-200">
                    <p className="font-bold mb-1">Reparación sobre el egreso activo:</p>
                    <p className="opacity-90">
                      Máquina: <strong>{selectedRecordForTecnico.egreso.maquina}</strong> · 
                      Isla: <strong>{selectedRecordForTecnico.egreso.isla}</strong> · 
                      Motivo declarado: <strong>{selectedRecordForTecnico.egreso.motivo}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedRecordForTecnico(null)}
                      className="text-[10px] text-amber-400 font-bold underline mt-2 block"
                    >
                      Cambiar de máquina
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        N° Informe Técnico (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: INF-839"
                        value={tInforme}
                        onChange={e => setTInforme(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Fecha y Hora de Reparación *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={tFecha}
                        onChange={e => setTFecha(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                      Detalle de la Solución Aplicada *
                    </label>
                    <textarea
                      required
                      placeholder="Describa de forma detallada la reparación realizada, reemplazo de partes, etc..."
                      rows={4}
                      value={tSolucion}
                      onChange={e => setTSolucion(e.target.value)}
                      className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2.5 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0] resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Nombre del Técnico de Turno *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Marcelo S."
                        value={tTecnico}
                        onChange={e => setTTecnico(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Firma del Técnico *
                      </label>
                      <SignatureCanvas 
                        onSave={setTFirma} 
                        placeholder="Firme la entrega de reparación" 
                        id="firma-tecnico-canvas" 
                      />
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRecordForTecnico(null)}
                      className="bg-[#1e1e35] hover:bg-[#282848] border border-white/10 text-white font-medium text-xs py-2.5 px-5 rounded-lg transition-all"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold text-xs py-2.5 px-6 rounded-lg transition-all shadow-md active:scale-95"
                    >
                      🔔 Registrar Reparación y Enviar a Control
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {/* TAB: ETAPA 3 - INSPECCIÓN Y CONTROL */}
          {activeTab === 'inspector' && (
            <motion.div
              key="tab-inspector"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#12121e] border border-[#c8a84b]/15 rounded-xl p-5 md:p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 border-b border-[#c8a84b]/15 pb-4 mb-6">
                <span className="text-2xl text-emerald-500">✅</span>
                <div>
                  <h2 className="text-sm md:text-base font-bold text-[#f0d882] tracking-wide">
                    Etapa 3 — Control Final de Reingreso (Inspector)
                  </h2>
                  <p className="text-xs text-[#9090a8] mt-0.5">
                    Inspección técnica exhaustiva y validación de parámetros de juego antes de la puesta en marcha.
                  </p>
                </div>
              </div>

              {!selectedRecordForInspector ? (
                /* Pantalla de búsqueda de reparadas */
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#9090a8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Busque por máquina reparada..."
                      value={searchInspectorMaq}
                      onChange={e => setSearchInspectorMaq(e.target.value)}
                      className="w-full bg-[#171726] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider mb-2">
                      Máquinas reparadas esperando inspección ({pendingInspeccionRecords.length})
                    </h4>
                    
                    {matchesInspectorSearch.length === 0 ? (
                      <div className="p-4 bg-white/2 rounded-lg text-center text-xs text-[#9090a8]">
                        No hay máquinas reparadas esperando validación con ese criterio.
                      </div>
                    ) : (
                      matchesInspectorSearch.map(r => (
                        <div 
                          key={r.id} 
                          className="bg-[#1a1a2b] border border-white/5 rounded-xl p-3 flex justify-between items-center"
                        >
                          <div>
                            <span className="text-xs font-bold text-white block">
                              Máquina {r.egreso.maquina} <span className="text-[#9090a8]">·</span> Isla {r.egreso.isla}
                            </span>
                            <span className="text-[11px] text-[#9090a8] mt-0.5 block">
                              Técnico: {r.tecnico?.tecnico} — Reparada: {formatFecha(r.tecnico?.fecha || '')}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => initInspectorForm(r)}
                            className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold text-xs py-1.5 px-3.5 rounded-lg transition-all active:scale-95 shadow-sm"
                          >
                            Inspeccionar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Formulario de carga inspector */
                <form onSubmit={handleGuardarInspector} className="space-y-6">
                  {/* Banner de Referencia */}
                  <div className="bg-[#112222] border-l-4 border-emerald-500 rounded-r-xl p-4 text-xs text-emerald-200">
                    <p className="font-bold mb-1">Inspección de Máquina:</p>
                    <p className="opacity-95">
                      Máquina: <strong>{selectedRecordForInspector.egreso.maquina}</strong> · 
                      Isla: <strong>{selectedRecordForInspector.egreso.isla}</strong> · 
                      Trabajo realizado: <strong>{selectedRecordForInspector.tecnico?.solucion}</strong> (Por: {selectedRecordForInspector.tecnico?.tecnico})
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedRecordForInspector(null)}
                      className="text-[10px] text-emerald-400 font-bold underline mt-2 block"
                    >
                      Cambiar de máquina
                    </button>
                  </div>

                  {/* 1. Datos básicos */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        Fecha y Hora Control *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={iFecha}
                        onChange={e => setIFecha(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        COIN IN de Cierre ($)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 15150"
                        value={iCoinIn}
                        onChange={e => setICoinIn(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                        N° MDC (Control Board)
                      </label>
                      <input
                        type="text"
                        placeholder="Módulo de control ID"
                        value={iMdc}
                        onChange={e => setIMdc(e.target.value)}
                        className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                      />
                    </div>
                  </div>

                  {/* 2. Configuración técnica */}
                  <div className="bg-[#1a1a2b] border border-white/5 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-3">
                      Verificación de Configuración Base
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                          % Devolución
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 94.5%"
                          value={iDevolucion}
                          onChange={e => setIDevolucion(e.target.value)}
                          className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                          Denominación
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: $100"
                          value={iDenominacion}
                          onChange={e => setIDenominacion(e.target.value)}
                          className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                          Apuesta Mín. ($)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 50"
                          value={iApuestaMin}
                          onChange={e => setIApuestaMin(e.target.value)}
                          className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                          Apuesta Máx. ($)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 5000"
                          value={iApuestaMax}
                          onChange={e => setIApuestaMax(e.target.value)}
                          className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Control de billetero */}
                  <div>
                    <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-2">
                      Control de Aceptación de Billetes
                    </h3>
                    <p className="text-[11px] text-[#9090a8] mb-3">
                      Marque el estado de admisión para cada denominación de billete de curso legal.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {BILLETES.map(b => {
                        const status = iChecksBilletes[b] || '';
                        return (
                          <div key={b} className="bg-[#161625] border border-white/5 rounded-lg p-3 flex justify-between items-center">
                            <span className="text-xs font-medium text-white">{b} ARS</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleCheckBillete(b, 'ok')}
                                className={`text-xs px-3 py-1 rounded font-bold border transition-all ${
                                  status === 'ok'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                                    : 'bg-white/2 text-[#9090a8] border-white/5 hover:bg-white/5'
                                }`}
                              >
                                ✓ OK
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCheckBillete(b, 'fail')}
                                className={`text-xs px-3 py-1 rounded font-bold border transition-all ${
                                  status === 'fail'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm'
                                    : 'bg-white/2 text-[#9090a8] border-white/5 hover:bg-white/5'
                                }`}
                              >
                                ✗ FALLA
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Controles adicionales */}
                  <div className="border-t border-white/5 pt-5">
                    <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-3">
                      Pruebas Adicionales de Sistema
                    </h3>

                    <div className="space-y-2">
                      {CONTROLES_EXTRAS.map(ex => {
                        const status = iChecksExtras[ex.label] || '';
                        return (
                          <div key={ex.id} className="bg-[#161625] border border-white/5 rounded-lg p-3 flex justify-between items-center">
                            <span className="text-xs font-medium text-white">{ex.label}</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleCheckExtra(ex.label, 'ok')}
                                className={`text-xs px-3 py-1 rounded font-bold border transition-all ${
                                  status === 'ok'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                    : 'bg-white/2 text-[#9090a8] border-white/5 hover:bg-white/5'
                                }`}
                              >
                                ✓ Correcto
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCheckExtra(ex.label, 'fail')}
                                className={`text-xs px-3 py-1 rounded font-bold border transition-all ${
                                  status === 'fail'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                    : 'bg-white/2 text-[#9090a8] border-white/5 hover:bg-white/5'
                                }`}
                              >
                                ✗ Con Fallas
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 5. Firma inspector */}
                  <div className="border-t border-white/5 pt-5">
                    <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-3">
                      Cierre de Acta y Conformidad
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                          Nombre del Inspector *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Laura M."
                          value={iInspector}
                          onChange={e => setIInspector(e.target.value)}
                          className="bg-[#171726] border border-white/10 rounded-lg px-3 py-2.5 text-xs focus:border-[#c8a84b] focus:outline-none text-[#e8e8f0]"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wide">
                          Firma del Inspector *
                        </label>
                        <SignatureCanvas 
                          onSave={setIFirma} 
                          placeholder="Firme el cierre de acta" 
                          id="firma-inspector-canvas" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRecordForInspector(null)}
                      className="bg-[#1e1e35] hover:bg-[#282848] border border-white/10 text-white font-medium text-xs py-2.5 px-5 rounded-lg transition-all"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-6 rounded-lg transition-all shadow-md active:scale-95"
                    >
                      ✅ Validar y Reingresar al Servicio de Sala
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {/* TAB: ESTADÍSTICAS */}
          {activeTab === 'estadisticas' && (
            <motion.div
              key="tab-estadisticas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Tarjetas de Métricas Core */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#12121e] border border-white/5 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">
                    Total Egresos
                  </span>
                  <span className="text-2xl md:text-3xl font-extrabold text-[#c8a84b] mt-1 block">
                    {statsTotal}
                  </span>
                </div>
                
                <div className="bg-[#12121e] border border-white/5 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">
                    Pendientes
                  </span>
                  <span className="text-2xl md:text-3xl font-extrabold text-rose-400 mt-1 block">
                    {statsPendientes}
                  </span>
                </div>

                <div className="bg-[#12121e] border border-white/5 rounded-xl p-4 text-center shadow-md">
                  <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">
                    Reingresados
                  </span>
                  <span className="text-2xl md:text-3xl font-extrabold text-emerald-400 mt-1 block">
                    {statsCompleto}
                  </span>
                </div>
              </div>

              {/* Bento Grid de Estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Máquinas con más fallas */}
                <div className="bg-[#12121e] border border-white/5 rounded-xl p-5 shadow-lg">
                  <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-4">
                    Top 5 Máquinas con más egresos
                  </h3>
                  
                  {sortedMachines.length === 0 ? (
                    <p className="text-xs text-[#9090a8] text-center py-8">Sin datos suficientes.</p>
                  ) : (
                    <div className="space-y-3">
                      {sortedMachines.map(([nombre, cant], idx) => {
                        const pct = Math.round((cant / maxMachineFaults) * 100);
                        const colors = ['bg-rose-500', 'bg-amber-500', 'bg-yellow-500', 'bg-sky-500', 'bg-emerald-500'];
                        const colorClass = colors[Math.min(idx, colors.length - 1)];
                        const medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : '';
                        
                        return (
                          <div key={nombre} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-white">
                                {medal}{nombre}
                              </span>
                              <span className="text-rose-400 font-semibold">{cant} egresos</span>
                            </div>
                            <div className="w-full bg-[#1b1b2f] h-2 rounded-full overflow-hidden">
                              <div 
                                className={`${colorClass} h-full rounded-full transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Motivos de egreso */}
                <div className="bg-[#12121e] border border-white/5 rounded-xl p-5 shadow-lg">
                  <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-4">
                    Egresos clasificados por Motivo
                  </h3>

                  {sortedMotives.length === 0 ? (
                    <p className="text-xs text-[#9090a8] text-center py-8">Sin datos suficientes.</p>
                  ) : (
                    <div className="space-y-3">
                      {sortedMotives.map(([motivo, cant]) => {
                        const pct = Math.round((cant / maxMotiveCount) * 100);
                        return (
                          <div key={motivo} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[#9090a8] font-medium">{motivo}</span>
                              <span className="text-sky-400 font-bold">{cant}</span>
                            </div>
                            <div className="w-full bg-[#1b1b2f] h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-sky-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Tiempos de resolución */}
              <div className="bg-[#12121e] border border-white/5 rounded-xl p-5 shadow-lg">
                <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#c8a84b]" />
                  Eficiencia y Tiempos de Resolución Técnica
                </h3>

                {repairTimesInHours.length === 0 ? (
                  <p className="text-xs text-[#9090a8] text-center py-8">
                    Cargue reparaciones técnicas para calcular tiempos promedio de respuesta correctiva.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center divide-y sm:divide-y-0 sm:divide-x divide-white/5">
                    <div className="py-2">
                      <span className="text-[10px] text-[#9090a8] uppercase tracking-wider block">Tiempo Promedio</span>
                      <span className="text-xl font-bold text-amber-400 mt-1 block">
                        {formatHours(avgRepairTime)}
                      </span>
                    </div>

                    <div className="py-2">
                      <span className="text-[10px] text-[#9090a8] uppercase tracking-wider block">Respuesta Más Rápida</span>
                      <span className="text-xl font-bold text-emerald-400 mt-1 block">
                        {formatHours(minRepairTime)}
                      </span>
                    </div>

                    <div className="py-2">
                      <span className="text-[10px] text-[#9090a8] uppercase tracking-wider block">Respuesta Más Lenta</span>
                      <span className="text-xl font-bold text-rose-400 mt-1 block">
                        {formatHours(maxRepairTime)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal: Resumen de Máquinas Fuera de Servicio */}
      <AnimatePresence>
        {showOutofServiceSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#121220] border border-[#c8a84b]/20 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-950/60 to-[#121220] p-5 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Resumen Máquinas Fuera de Servicio
                    </h3>
                    <p className="text-[10px] text-[#9090a8] font-medium">
                      Estado actual de la sala · {records.filter(r => r.estado !== 'completo').length} inactivas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOutofServiceSummary(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-[#9090a8] hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#17172a] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wider block">Total Inactivas</span>
                    <span className="text-xl font-extrabold text-rose-400 mt-0.5 block">
                      {records.filter(r => r.estado !== 'completo').length}
                    </span>
                  </div>
                  <div className="bg-[#17172a] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wider block">FDS (Etapa 1)</span>
                    <span className="text-xl font-extrabold text-rose-500 mt-0.5 block">
                      {records.filter(r => r.estado === 'egreso').length}
                    </span>
                  </div>
                  <div className="bg-[#17172a] border border-white/5 p-3 rounded-xl text-center">
                    <span className="text-[10px] text-[#9090a8] font-semibold uppercase tracking-wider block">Reparadas (Etapa 2)</span>
                    <span className="text-xl font-extrabold text-amber-500 mt-0.5 block">
                      {records.filter(r => r.estado === 'tecnico').length}
                    </span>
                  </div>
                </div>

                {/* Plain Text Preview */}
                <div className="bg-[#090911] border border-white/5 rounded-xl p-4 font-mono text-[11px] text-[#a0a0b8] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                  {getOutofServicePlainText()}
                </div>

                {/* Table of detail */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider select-none">
                    Detalle de máquinas inhabilitadas:
                  </h4>
                  {records.filter(r => r.estado !== 'completo').length === 0 ? (
                    <div className="bg-[#17172a] p-6 text-center rounded-xl border border-dashed border-white/5">
                      <p className="text-xs text-[#9090a8]">¡No hay máquinas fuera de servicio en este momento!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {records.filter(r => r.estado !== 'completo').map(r => (
                        <div key={r.id} className="bg-[#17172a] border border-white/5 p-3 rounded-xl flex justify-between items-center gap-3">
                          <div>
                            <span className="text-xs font-bold text-white block">
                              Máquina {r.egreso.maquina} <span className="text-[#9090a8] font-normal">·</span> Isla {r.egreso.isla}
                            </span>
                            <span className="text-[10px] text-[#9090a8] block mt-0.5">
                              Motivo: {r.egreso.motivo || 'Falla'} {r.egreso.nota ? `(${r.egreso.nota})` : ''} · {r.egreso.fecha ? formatFecha(r.egreso.fecha) : '-'}
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            r.estado === 'egreso' 
                              ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' 
                              : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                          }`}>
                            {r.estado === 'egreso' ? 'F. de Serv (Etapa 1)' : 'Reparada (Etapa 2)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-[#171728] border-t border-white/5 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getOutofServicePlainText());
                    addAlert('✓ Resumen copiado al portapapeles para WhatsApp', 'success');
                  }}
                  className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Copiar para WhatsApp
                </button>
                <button
                  onClick={() => {
                    generarPDFResumenFueraDeServicio(records);
                    addAlert('✓ Reporte en PDF descargado', 'success');
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Descargar Reporte PDF
                </button>
                <button
                  onClick={() => setShowOutofServiceSummary(false)}
                  className="bg-transparent hover:bg-white/5 text-[#9090a8] hover:text-white font-semibold text-xs py-2 px-4 rounded-lg transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

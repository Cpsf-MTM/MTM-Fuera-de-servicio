import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  AlertCircle, 
  X, 
  Upload, 
  FileText, 
  Search, 
  Building2, 
  Check, 
  Clock,
  Sparkles,
  Layers
} from 'lucide-react';
import { MaintenanceRecord } from '../types';
import { 
  TOTAL_CASINO_MACHINES, 
  getMachineDetails, 
  calculateOutOfServiceDuration 
} from '../lib/machineCatalog';
import { formatFecha, generarPDFResumenFueraDeServicio } from '../lib/pdf';

interface OutofServiceModalProps {
  records: MaintenanceRecord[];
  onClose: () => void;
  addAlert: (msg: string, type: 'success' | 'danger') => void;
}

export default function OutofServiceModal({
  records,
  onClose,
  addAlert
}: OutofServiceModalProps) {
  const [copied, setCopied] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const totalParque = TOTAL_CASINO_MACHINES || 815;
  const oosRecords = records.filter(r => r.estado !== 'completo');
  const totalInactivas = oosRecords.length;
  const totalEnServicio = Math.max(0, totalParque - totalInactivas);
  const operatividadPct = ((totalEnServicio / totalParque) * 100).toFixed(1);

  const enEgreso = oosRecords.filter(r => r.estado === 'egreso').length;
  const enTecnico = oosRecords.filter(r => r.estado === 'tecnico').length;

  const getOutofServicePlainText = () => {
    if (oosRecords.length === 0) {
      return `✅ *PARQUE DE MÁQUINAS 100% OPERATIVO*\n*Casino Santa Fe — Sala de Juego*\nTotal: ${totalParque} máquinas habilitadas en servicio.`;
    }

    let text = `🚨 *REPORTE OFICIAL DE ESTADO DEL PARQUE Y MÁQUINAS FUERA DE SERVICIO*\n`;
    text += `*Casino Santa Fe — Sala de Juego*\n`;
    text += `_Generado: ${new Date().toLocaleString('es-AR')}_\n`;
    text += `====================================\n`;
    text += `📊 *DISPONIBILIDAD GENERAL:*\n`;
    text += `• Total Parque Habilitado: *${totalParque} máquinas*\n`;
    text += `• En Servicio (Operativas): *${totalEnServicio} máquinas* (${operatividadPct}%)\n`;
    text += `• Fuera de Servicio: *${totalInactivas} máquinas*\n`;
    text += `  └ Etapa 1 (Taller / Espera): ${enEgreso}\n`;
    text += `  └ Etapa 2 (Reparada / En control): ${enTecnico}\n`;
    text += `====================================\n\n`;
    text += `📋 *DETALLE DE MÁQUINAS INHABILITADAS:*\n\n`;

    oosRecords.forEach((r, idx) => {
      const details = getMachineDetails(r.egreso.maquina);
      const duration = calculateOutOfServiceDuration(r.egreso.fecha);
      const estadoStr = r.estado === 'egreso' 
        ? '🔴 Fuera de Servicio (Paso 1)' 
        : '🔧 Reparada — En control (Paso 2)';
      const fechaStr = r.egreso.fecha ? formatFecha(r.egreso.fecha) : '-';
      const fabStr = details?.fabricante || 'Fabricante No Especificado';
      const modStr = details?.modelo ? `${details.modelo} (${details.gabinete || 'STD'})` : '-';

      text += `${idx + 1}. *MÁQUINA ${r.egreso.maquina}* · Isla ${r.egreso.isla || details?.isla || '-'}\n`;
      text += `   🏢 *Fabricante:* ${fabStr}\n`;
      text += `   🎰 *Modelo:* ${modStr}\n`;
      text += `   ⏳ *Tiempo Fuera de Servicio:* ${duration.label}\n`;
      text += `   ⚠️ *Motivo:* ${r.egreso.motivo || 'Falla'}${r.egreso.nota ? ` (${r.egreso.nota})` : ''}\n`;
      text += `   📅 *Fecha Egreso:* ${fechaStr}\n`;
      text += `   📌 *Estado:* ${estadoStr}\n`;
      if (r.tecnico?.tecnico) {
        text += `   🛠️ *Técnico Asignado:* ${r.tecnico.tecnico}\n`;
      }
      text += `\n`;
    });

    text += `====================================\n`;
    text += `Departamento de Mantenimiento · Casino Santa Fe`;
    return text;
  };

  const handleCopyWhatsapp = () => {
    const text = getOutofServicePlainText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    addAlert('✓ Reporte detallado copiado al portapapeles para WhatsApp', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const filteredList = oosRecords.filter(r => {
    const details = getMachineDetails(r.egreso.maquina);
    const q = filterQuery.toLowerCase();
    const maq = r.egreso.maquina.toLowerCase();
    const isla = r.egreso.isla.toLowerCase();
    const fab = (details?.fabricante || '').toLowerCase();
    const mod = (details?.modelo || '').toLowerCase();
    return !filterQuery || maq.includes(q) || isla.includes(q) || fab.includes(q) || mod.includes(q);
  });

  return (
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
        className="bg-[#121220] border border-[#c8a84b]/30 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950/70 via-[#18182c] to-[#121220] p-5 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-extrabold text-white uppercase tracking-wider">
                Resumen de Máquinas Fuera de Servicio
              </h3>
              <p className="text-[11px] text-[#9090a8] font-medium">
                Parque Casino Santa Fe · <strong>{totalEnServicio} de {totalParque} operativas</strong> ({operatividadPct}% en servicio)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-[#9090a8] hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#17172a] border border-white/5 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">Parque Total</span>
              <span className="text-xl font-black text-white mt-0.5 block">{totalParque}</span>
              <span className="text-[9px] text-[#9090a8]">Máquinas registradas</span>
            </div>

            <div className="bg-emerald-950/25 border border-emerald-500/25 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">En Servicio</span>
              <span className="text-xl font-black text-emerald-300 mt-0.5 block">{totalEnServicio}</span>
              <span className="text-[9px] text-emerald-400/90 font-bold">{operatividadPct}% Operatividad</span>
            </div>

            <div className="bg-rose-950/25 border border-rose-500/25 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Fuera de Servicio</span>
              <span className="text-xl font-black text-rose-300 mt-0.5 block">{totalInactivas}</span>
              <span className="text-[9px] text-rose-400/90 font-medium">Inactivas en sala</span>
            </div>

            <div className="bg-[#17172a] border border-white/5 p-3.5 rounded-xl text-center">
              <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">Por Etapa</span>
              <div className="flex justify-center items-center gap-2 mt-1">
                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                  P1: {enEgreso}
                </span>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  P2: {enTecnico}
                </span>
              </div>
            </div>
          </div>

          {/* Plain Text WhatsApp Box */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-[#c8a84b] uppercase tracking-wider">
                Texto para Copiar y Enviar por WhatsApp / Telegram:
              </span>
              <span className="text-[10px] text-[#9090a8]">Incluye fabricante, modelo y días fuera de servicio</span>
            </div>
            <div className="bg-[#090911] border border-white/10 rounded-xl p-4 font-mono text-[11px] text-[#a0a0b8] max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {getOutofServicePlainText()}
            </div>
          </div>

          {/* Detailed Machine Cards */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h4 className="text-[11px] font-bold text-[#c8a84b] uppercase tracking-wider select-none flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Máquinas Inactivas con Metadatos ({filteredList.length})
              </h4>
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#9090a8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar máquina, fabricante..."
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  className="w-full bg-[#171726] border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs text-[#e8e8f0] focus:border-[#c8a84b] focus:outline-none"
                />
              </div>
            </div>

            {filteredList.length === 0 ? (
              <div className="bg-[#17172a] p-6 text-center rounded-xl border border-dashed border-white/5">
                <p className="text-xs text-[#9090a8]">
                  {oosRecords.length === 0 
                    ? '¡No hay máquinas fuera de servicio en este momento!' 
                    : 'No se encontraron resultados con ese filtro.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredList.map(r => {
                  const details = getMachineDetails(r.egreso.maquina);
                  const duration = calculateOutOfServiceDuration(r.egreso.fecha);

                  const badgeColor = 
                    duration.badgeType === 'critical'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : duration.badgeType === 'moderate'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                  return (
                    <div 
                      key={r.id} 
                      className="bg-[#17172a] border border-white/5 hover:border-white/15 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-white">
                            Máquina {r.egreso.maquina}
                          </span>
                          <span className="text-[11px] bg-white/5 px-2 py-0.5 rounded text-[#9090a8]">
                            Isla {r.egreso.isla || details?.isla || '-'}
                          </span>
                          {details?.fabricante && (
                            <span className="text-[11px] font-bold text-[#f0d882] bg-[#c8a84b]/15 px-2 py-0.5 rounded border border-[#c8a84b]/20">
                              {details.fabricante} · {details.modelo}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#9090a8] flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span><strong>Motivo:</strong> {r.egreso.motivo || 'Falla'} {r.egreso.nota ? `(${r.egreso.nota})` : ''}</span>
                          <span><strong>Egreso:</strong> {r.egreso.fecha ? formatFecha(r.egreso.fecha) : '-'}</span>
                          {r.tecnico?.tecnico && <span><strong>Técnico:</strong> {r.tecnico.tecnico}</span>}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          r.estado === 'egreso' 
                            ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' 
                            : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                        }`}>
                          {r.estado === 'egreso' ? 'F. de Serv (Paso 1)' : 'Reparada (Paso 2)'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                          ⏳ {duration.label} fuera de serv.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#171728] border-t border-white/5 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2.5">
          <button
            onClick={handleCopyWhatsapp}
            className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-black" /> : <Upload className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar para WhatsApp'}
          </button>
          <button
            onClick={() => {
              generarPDFResumenFueraDeServicio(records);
              addAlert('✓ Reporte en PDF descargado', 'success');
            }}
            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <FileText className="w-4 h-4" />
            Descargar Reporte PDF
          </button>
          <button
            onClick={onClose}
            className="bg-transparent hover:bg-white/5 text-[#9090a8] hover:text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition-all"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

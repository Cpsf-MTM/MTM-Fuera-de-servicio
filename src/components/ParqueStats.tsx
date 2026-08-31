import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Filter, 
  Search, 
  FileText, 
  Copy, 
  Sparkles,
  Building2,
  ChevronRight,
  Cpu
} from 'lucide-react';
import { MaintenanceRecord } from '../types';
import { 
  getTotalActiveMachines,
  getMachineDetails, 
  calculateOutOfServiceDuration 
} from '../lib/machineCatalog';
import { formatFecha, generarPDFResumenFueraDeServicio } from '../lib/pdf';

interface ParqueStatsProps {
  records: MaintenanceRecord[];
  onOpenRecord?: (r: MaintenanceRecord) => void;
  onCopyWhatsappText: () => void;
  onNavigateToParque?: () => void;
  addAlert: (msg: string, type: 'success' | 'danger') => void;
}

export default function ParqueStats({ 
  records, 
  onOpenRecord, 
  onCopyWhatsappText, 
  onNavigateToParque,
  addAlert 
}: ParqueStatsProps) {
  const [selectedFabricanteFilter, setSelectedFabricanteFilter] = useState<string>('todos');
  const [searchOosTerm, setSearchOosTerm] = useState<string>('');
  const [totalParque, setTotalParque] = useState<number>(getTotalActiveMachines());

  useEffect(() => {
    const handleUpdate = () => setTotalParque(getTotalActiveMachines());
    window.addEventListener('casino_catalog_updated', handleUpdate);
    return () => window.removeEventListener('casino_catalog_updated', handleUpdate);
  }, []);

  const oosRecords = records.filter(r => r.estado !== 'completo');
  const totalInactivas = oosRecords.length;
  const totalEnServicio = Math.max(0, totalParque - totalInactivas);
  const disponibilidadPct = totalParque > 0 ? ((totalEnServicio / totalParque) * 100).toFixed(1) : '100';

  const enEgreso = oosRecords.filter(r => r.estado === 'egreso').length;
  const enTecnico = oosRecords.filter(r => r.estado === 'tecnico').length;
  const statsCompleto = records.filter(r => r.estado === 'completo').length;
  const statsTotal = records.length;

  // 1. Fabricantes de máquinas en el historial
  const manufacturerCount: Record<string, number> = {};
  const modelCount: Record<string, number> = {};

  records.forEach(r => {
    const details = getMachineDetails(r.egreso.maquina);
    const fab = details?.fabricante || 'SIN REGISTRO';
    const mod = details ? `${details.modelo} (${details.fabricante})` : 'Desconocido';

    manufacturerCount[fab] = (manufacturerCount[fab] || 0) + 1;
    modelCount[mod] = (modelCount[mod] || 0) + 1;
  });

  const sortedManufacturers = Object.entries(manufacturerCount)
    .sort((a, b) => b[1] - a[1]);
  const maxManufacturerCount = sortedManufacturers.length > 0 ? sortedManufacturers[0][1] : 1;

  const sortedModels = Object.entries(modelCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxModelCount = sortedModels.length > 0 ? sortedModels[0][1] : 1;

  // 2. Ranking de máquinas más intervenidas
  const machineFaultCount: Record<string, number> = {};
  records.forEach(r => {
    const details = getMachineDetails(r.egreso.maquina);
    const fabInfo = details ? `· ${details.fabricante}` : '';
    const key = `Máquina ${r.egreso.maquina} (Isla ${r.egreso.isla} ${fabInfo})`;
    machineFaultCount[key] = (machineFaultCount[key] || 0) + 1;
  });
  const sortedMachines = Object.entries(machineFaultCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxMachineFaults = sortedMachines.length > 0 ? sortedMachines[0][1] : 1;

  // 3. Motivos de egreso
  const motiveCount: Record<string, number> = {};
  records.forEach(r => {
    const m = r.egreso.motivo || 'Falla técnica';
    motiveCount[m] = (motiveCount[m] || 0) + 1;
  });
  const sortedMotives = Object.entries(motiveCount)
    .sort((a, b) => b[1] - a[1]);
  const maxMotiveCount = sortedMotives.length > 0 ? sortedMotives[0][1] : 1;

  // 4. Tiempos de resolución
  const repairTimesInHours = records
    .filter(r => r.tecnico && r.egreso.fecha && r.tecnico.fecha)
    .map(r => {
      const ini = new Date(r.egreso.fecha).getTime();
      const fin = new Date(r.tecnico!.fecha).getTime();
      return (fin - ini) / (1000 * 60 * 60);
    })
    .filter(hours => hours > 0 && hours < 720);

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

  // Filtrado de máquinas fuera de servicio
  const filteredOosRecords = oosRecords.filter(r => {
    const details = getMachineDetails(r.egreso.maquina);
    const fab = (details?.fabricante || '').toUpperCase();
    const mod = (details?.modelo || '').toUpperCase();
    const maq = r.egreso.maquina.toLowerCase();
    const isla = r.egreso.isla.toLowerCase();
    const q = searchOosTerm.toLowerCase();

    const matchesSearch = !searchOosTerm || maq.includes(q) || isla.includes(q) || fab.toLowerCase().includes(q) || mod.toLowerCase().includes(q);
    const matchesFabricante = selectedFabricanteFilter === 'todos' || fab === selectedFabricanteFilter.toUpperCase();

    return matchesSearch && matchesFabricante;
  });

  // Lista única de fabricantes para el filtro
  const availableFabricantes = Array.from(
    new Set(oosRecords.map(r => getMachineDetails(r.egreso.maquina)?.fabricante).filter(Boolean))
  ) as string[];

  return (
    <div className="space-y-6">
      {/* 1. Tarjeta Principal de Disponibilidad del Parque de Máquinas */}
      <div className="bg-gradient-to-br from-[#16162a] via-[#121220] to-[#0c0c16] border border-[#c8a84b]/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#c8a84b]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-[#c8a84b]" />
              <span className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider">
                Auditoría en Tiempo Real · Casino Santa Fe
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              Estado y Disponibilidad del Parque de Máquinas
            </h2>
            <p className="text-xs text-[#9090a8] mt-1 max-w-xl">
              Cruce en vivo del catálogo oficial de <strong>{totalParque} máquinas habilitadas</strong> con los egresos técnicos y reparaciones de sala.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
            {onNavigateToParque && (
              <button
                onClick={onNavigateToParque}
                className="flex-1 sm:flex-initial bg-[#1f1f38] hover:bg-[#2c2c4d] text-[#f0d882] border border-[#c8a84b]/30 font-bold text-xs py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                title="Administrar catálogo de máquinas y fabricantes"
              >
                <Cpu className="w-3.5 h-3.5 text-[#c8a84b]" />
                Gestionar Parque
              </button>
            )}
            <button
              onClick={onCopyWhatsappText}
              className="flex-1 sm:flex-initial bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              title="Copiar reporte con fabricantes, modelos y días F.S."
            >
              <Copy className="w-4 h-4" />
              Copiar Reporte WhatsApp
            </button>
            <button
              onClick={() => {
                generarPDFResumenFueraDeServicio(records);
                addAlert('✓ Reporte oficial PDF generado con éxito', 'success');
              }}
              className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <FileText className="w-4 h-4" />
              Descargar PDF de Sala
            </button>
          </div>
        </div>

        {/* Métricas Visuales de Disponibilidad */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
          <div className="bg-[#19192f]/70 border border-white/5 rounded-xl p-4 text-center">
            <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">
              Parque Total Habilitado
            </span>
            <span className="text-2xl md:text-3xl font-extrabold text-white mt-1 block">
              {totalParque}
            </span>
            <span className="text-[10px] text-[#9090a8] mt-0.5 block">Máquinas en inventario</span>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 text-center">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
              En Servicio (Operativas)
            </span>
            <span className="text-2xl md:text-3xl font-extrabold text-emerald-300 mt-1 block">
              {totalEnServicio}
            </span>
            <span className="text-[10px] text-emerald-400/80 font-bold mt-0.5 block">
              {disponibilidadPct}% Disponibilidad
            </span>
          </div>

          <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-4 text-center">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">
              Fuera de Servicio (Total)
            </span>
            <span className="text-2xl md:text-3xl font-extrabold text-rose-300 mt-1 block">
              {totalInactivas}
            </span>
            <span className="text-[10px] text-rose-400/80 mt-0.5 block">
              {totalInactivas === 0 ? 'Sin máquinas caídas' : `${((totalInactivas / totalParque) * 100).toFixed(1)}% inactivo`}
            </span>
          </div>

          <div className="bg-[#19192f]/70 border border-white/5 rounded-xl p-4 text-center">
            <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">
              Desglose de Etapas
            </span>
            <div className="flex justify-center items-center gap-3 mt-1.5">
              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                P1: {enEgreso}
              </span>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                P2: {enTecnico}
              </span>
            </div>
            <span className="text-[9px] text-[#9090a8] mt-1 block">P1: Taller · P2: Reparada</span>
          </div>
        </div>

        {/* Barra de progreso de operatividad */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-[#9090a8] font-semibold">Índice de Operatividad de Sala</span>
            <span className="text-emerald-400 font-bold">{disponibilidadPct}% Activo</span>
          </div>
          <div className="w-full bg-[#1b1b2f] h-2.5 rounded-full overflow-hidden flex">
            <div 
              className="bg-emerald-500 h-full transition-all duration-700" 
              style={{ width: `${disponibilidadPct}%` }}
              title={`Operativas: ${totalEnServicio}`}
            />
            <div 
              className="bg-rose-500 h-full transition-all duration-700" 
              style={{ width: `${(totalInactivas / totalParque) * 100}%` }}
              title={`Inactivas: ${totalInactivas}`}
            />
          </div>
        </div>
      </div>

      {/* 2. TABLA DETALLADA DE MÁQUINAS FUERA DE SERVICIO (Con Fabricante, Modelo y Días F.S.) */}
      <div className="bg-[#12121e] border border-white/5 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              Detalle de Máquinas Fuera de Servicio ({oosRecords.length})
            </h3>
            <p className="text-[11px] text-[#9090a8]">
              Fabricante, modelo, motivo y tiempo transcurrido desde el egreso de sala.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-[#9090a8] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar máquina / isla..."
                value={searchOosTerm}
                onChange={e => setSearchOosTerm(e.target.value)}
                className="w-full bg-[#171726] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#e8e8f0] focus:border-[#c8a84b] focus:outline-none"
              />
            </div>

            {/* Filtro por Fabricante */}
            {availableFabricantes.length > 0 && (
              <select
                value={selectedFabricanteFilter}
                onChange={e => setSelectedFabricanteFilter(e.target.value)}
                className="bg-[#171726] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#e8e8f0] focus:border-[#c8a84b] focus:outline-none"
              >
                <option value="todos">Todos los Fabricantes</option>
                {availableFabricantes.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tabla / Lista */}
        {filteredOosRecords.length === 0 ? (
          <div className="bg-[#171728] p-8 text-center rounded-xl border border-dashed border-white/5 space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-bold text-white">
              {oosRecords.length === 0 
                ? '¡No hay máquinas fuera de servicio actualmente! Sala 100% operativa.' 
                : 'No se encontraron máquinas con los filtros seleccionados.'}
            </p>
            <p className="text-[11px] text-[#9090a8]">
              {oosRecords.length === 0 ? 'Todas las máquinas habilitadas se encuentran en servicio.' : 'Intente cambiar el término de búsqueda o el fabricante.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-[#9090a8] uppercase font-bold tracking-wider bg-white/2">
                  <th className="py-2.5 px-3">Máquina / Isla</th>
                  <th className="py-2.5 px-3">Fabricante</th>
                  <th className="py-2.5 px-3">Modelo / Gabinete</th>
                  <th className="py-2.5 px-3">Días Fuera de Servicio</th>
                  <th className="py-2.5 px-3">Motivo de Salida</th>
                  <th className="py-2.5 px-3 text-right">Estado / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOosRecords.map(r => {
                  const details = getMachineDetails(r.egreso.maquina);
                  const duration = calculateOutOfServiceDuration(r.egreso.fecha);
                  
                  const badgeColor = 
                    duration.badgeType === 'critical'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : duration.badgeType === 'moderate'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-white/5 text-[#c8a84b] border-white/10';

                  return (
                    <tr 
                      key={r.id}
                      className="hover:bg-white/2 transition-colors cursor-pointer group"
                      onClick={() => onOpenRecord && onOpenRecord(r)}
                    >
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-white group-hover:text-[#f0d882] transition-colors block">
                          Máq. {r.egreso.maquina}
                        </span>
                        <span className="text-[10px] text-[#9090a8] block">
                          Isla {r.egreso.isla || details?.isla || '-'}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-semibold text-white">
                        {details?.fabricante ? (
                          <span className="inline-flex items-center gap-1.5 bg-[#19192c] border border-white/10 px-2 py-0.5 rounded text-[11px]">
                            {details.fabricante}
                          </span>
                        ) : (
                          <span className="text-[#9090a8] italic">No catalogado</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-medium text-white block">
                          {details?.modelo || '-'}
                        </span>
                        {details?.gabinete && details.gabinete !== '-' && (
                          <span className="text-[10px] text-[#9090a8] block">
                            {details.gabinete}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                            ⏳ {duration.label}
                          </span>
                        </div>
                        <span className="text-[9px] text-[#9090a8] block mt-0.5">
                          Desde: {r.egreso.fecha ? formatFecha(r.egreso.fecha).split(',')[0] : '-'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-medium text-white block">
                          {r.egreso.motivo || 'Falla técnica'}
                        </span>
                        {r.egreso.nota && (
                          <span className="text-[10px] text-[#9090a8] line-clamp-1">
                            {r.egreso.nota}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            r.estado === 'egreso' 
                              ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' 
                              : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                          }`}>
                            {r.estado === 'egreso' ? 'F. de Serv (Paso 1)' : 'Reparada (Paso 2)'}
                          </span>
                          <span className="text-[10px] text-[#c8a84b] group-hover:underline flex items-center gap-0.5">
                            Ver acta <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. BENTO GRID: Distribución por Fabricante, Modelos y Motivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distribución por Fabricante */}
        <div className="bg-[#12121e] border border-white/5 rounded-xl p-5 shadow-lg space-y-3">
          <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider flex items-center justify-between">
            <span>Intervenciones por Fabricante</span>
            <span className="text-[10px] font-normal text-[#9090a8]">Total {statsTotal} egresos</span>
          </h3>

          {sortedManufacturers.length === 0 ? (
            <p className="text-xs text-[#9090a8] text-center py-8">Sin registros suficientes.</p>
          ) : (
            <div className="space-y-3">
              {sortedManufacturers.map(([fab, cant], idx) => {
                const pct = Math.round((cant / maxManufacturerCount) * 100);
                const sharePct = ((cant / statsTotal) * 100).toFixed(0);
                const colors = ['bg-[#c8a84b]', 'bg-sky-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
                const barColor = colors[idx % colors.length];

                return (
                  <div key={fab} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: barColor.replace('bg-', '') }} />
                        {fab}
                      </span>
                      <span className="text-[#9090a8] font-semibold text-[11px]">
                        <strong className="text-white">{cant}</strong> ({sharePct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#1b1b2f] h-2 rounded-full overflow-hidden">
                      <div 
                        className={`${barColor} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modelos con más intervenciones */}
        <div className="bg-[#12121e] border border-white/5 rounded-xl p-5 shadow-lg space-y-3">
          <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider">
            Modelos de Máquinas con más intervenciones
          </h3>

          {sortedModels.length === 0 ? (
            <p className="text-xs text-[#9090a8] text-center py-8">Sin registros suficientes.</p>
          ) : (
            <div className="space-y-3">
              {sortedModels.map(([modelo, cant]) => {
                const pct = Math.round((cant / maxModelCount) * 100);
                return (
                  <div key={modelo} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-white truncate max-w-[240px]">{modelo}</span>
                      <span className="text-amber-400 font-bold">{cant} egresos</span>
                    </div>
                    <div className="w-full bg-[#1b1b2f] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Máquinas Específicas */}
        <div className="bg-[#12121e] border border-white/5 rounded-xl p-5 shadow-lg space-y-3">
          <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider">
            Top 5 Máquinas con más paradas registradas
          </h3>

          {sortedMachines.length === 0 ? (
            <p className="text-xs text-[#9090a8] text-center py-8">Sin registros suficientes.</p>
          ) : (
            <div className="space-y-3">
              {sortedMachines.map(([nombre, cant], idx) => {
                const pct = Math.round((cant / maxMachineFaults) * 100);
                const medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : '';
                
                return (
                  <div key={nombre} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white truncate max-w-[240px]">
                        {medal}{nombre}
                      </span>
                      <span className="text-rose-400 font-semibold">{cant} egresos</span>
                    </div>
                    <div className="w-full bg-[#1b1b2f] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Motivos de egreso */}
        <div className="bg-[#12121e] border border-white/5 rounded-xl p-5 shadow-lg space-y-3">
          <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider">
            Egresos clasificados por Motivo
          </h3>

          {sortedMotives.length === 0 ? (
            <p className="text-xs text-[#9090a8] text-center py-8">Sin registros suficientes.</p>
          ) : (
            <div className="space-y-3">
              {sortedMotives.map(([motivo, cant]) => {
                const pct = Math.round((cant / maxMotiveCount) * 100);
                return (
                  <div key={motivo} className="space-y-1">
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

      {/* 4. Tiempos de Resolución Técnica */}
      <div className="bg-[#12121e] border border-white/5 rounded-xl p-5 shadow-lg">
        <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#c8a84b]" />
          Eficiencia y Tiempos de Respuesta Técnica
        </h3>

        {repairTimesInHours.length === 0 ? (
          <p className="text-xs text-[#9090a8] text-center py-6">
            Complete reparaciones técnicas (Etapa 2) para calcular tiempos promedio de resolución.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center divide-y sm:divide-y-0 sm:divide-x divide-white/5">
            <div className="py-2">
              <span className="text-[10px] text-[#9090a8] uppercase tracking-wider block">Tiempo Promedio de Reparación</span>
              <span className="text-xl font-bold text-amber-400 mt-1 block">
                {formatHours(avgRepairTime)}
              </span>
            </div>

            <div className="py-2">
              <span className="text-[10px] text-[#9090a8] uppercase tracking-wider block">Resolución Más Rápida</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">
                {formatHours(minRepairTime)}
              </span>
            </div>

            <div className="py-2">
              <span className="text-[10px] text-[#9090a8] uppercase tracking-wider block">Resolución Más Lenta</span>
              <span className="text-xl font-bold text-rose-400 mt-1 block">
                {formatHours(maxRepairTime)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

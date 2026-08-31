import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Archive, 
  RotateCcw, 
  Download, 
  Upload, 
  Check, 
  X, 
  AlertCircle, 
  Layers, 
  Cpu, 
  Tag, 
  CheckCircle2, 
  ChevronRight, 
  FileSpreadsheet, 
  RefreshCw,
  SlidersHorizontal,
  ArrowUpDown,
  FileText
} from 'lucide-react';
import { MaintenanceRecord } from '../types';
import { 
  MachineCatalogItem, 
  getStoredCatalogItems, 
  saveCatalogItems, 
  addMachineToCatalog, 
  updateMachineInCatalog, 
  retireMachineFromCatalog, 
  deleteMachineFromCatalog, 
  resetCatalogToDefault, 
  getFabricantesList, 
  addCustomFabricante, 
  renameFabricanteInCatalog, 
  exportCatalogToCSV, 
  importCatalogFromCSV 
} from '../lib/machineCatalog';

interface ParqueManagerProps {
  records: MaintenanceRecord[];
  onClose?: () => void;
  addAlert: (msg: string, type: 'success' | 'danger' | 'info') => void;
}

export default function ParqueManager({ records, onClose, addAlert }: ParqueManagerProps) {
  const [catalog, setCatalog] = useState<MachineCatalogItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'inventario' | 'fabricantes' | 'retiradas'>('inventario');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFabricante, setSelectedFabricante] = useState<string>('todos');
  const [selectedGabinete, setSelectedGabinete] = useState<string>('todos');
  const [selectedEtapa, setSelectedEtapa] = useState<string>('todos');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<MachineCatalogItem | null>(null);
  const [retiringMachine, setRetiringMachine] = useState<MachineCatalogItem | null>(null);
  const [retireReason, setRetireReason] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [showFabricanteModal, setShowFabricanteModal] = useState(false);
  const [newFabricanteName, setNewFabricanteName] = useState('');
  const [renamingFabricante, setRenamingFabricante] = useState<string | null>(null);
  const [renamedFabricanteTarget, setRenamedFabricanteTarget] = useState('');

  // Formulario de Máquina (Alta / Edición)
  const [formNumero, setFormNumero] = useState('');
  const [formIsla, setFormIsla] = useState('');
  const [formFabricante, setFormFabricante] = useState('');
  const [formNuevoFabricante, setFormNuevoFabricante] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formGabinete, setFormGabinete] = useState('UPRIGHT');
  const [formEtapa, setFormEtapa] = useState('HABILITADA');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar catálogo y escuchar eventos
  const refreshCatalog = () => {
    setCatalog(getStoredCatalogItems());
  };

  useEffect(() => {
    refreshCatalog();
    const handleUpdate = () => refreshCatalog();
    window.addEventListener('casino_catalog_updated', handleUpdate);
    return () => window.removeEventListener('casino_catalog_updated', handleUpdate);
  }, []);

  // Lista de Fabricantes dinámicos
  const fabricantesList = useMemo(() => getFabricantesList(), [catalog]);

  // Lista de Gabinetes únicos
  const gabinetesList = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach(c => {
      if (c.gabinete && c.gabinete.trim() && c.gabinete !== '-') {
        set.add(c.gabinete.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [catalog]);

  // IDs de máquinas fuera de servicio actualmente en actas
  const activeOosMachineIds = useMemo(() => {
    return new Set(
      records.filter(r => r.estado !== 'completo').map(r => r.egreso.maquina.trim())
    );
  }, [records]);

  // Métricas generales
  const totalRegistradas = catalog.length;
  const totalHabilitadas = catalog.filter(m => m.etapa === 'HABILITADA').length;
  const totalRetiradas = catalog.filter(m => m.etapa === 'RETIRADA' || m.etapa === 'DESHABILITADA').length;
  const totalFueraDeServicio = catalog.filter(m => m.etapa === 'HABILITADA' && activeOosMachineIds.has(m.numero)).length;
  const totalEnServicio = Math.max(0, totalHabilitadas - totalFueraDeServicio);
  const operatividadPct = totalHabilitadas > 0 ? ((totalEnServicio / totalHabilitadas) * 100).toFixed(1) : '100';

  // Filtrado de máquinas
  const filteredMachines = useMemo(() => {
    return catalog.filter(m => {
      const q = searchTerm.toLowerCase().trim();
      const numMatch = m.numero.toLowerCase().includes(q);
      const islaMatch = m.isla.toLowerCase().includes(q);
      const fabMatch = m.fabricante.toLowerCase().includes(q);
      const modMatch = m.modelo.toLowerCase().includes(q);
      const matchesSearch = !q || numMatch || islaMatch || fabMatch || modMatch;

      const matchesFab = selectedFabricante === 'todos' || m.fabricante.toUpperCase() === selectedFabricante.toUpperCase();
      const matchesGab = selectedGabinete === 'todos' || m.gabinete.toUpperCase() === selectedGabinete.toUpperCase();
      
      let matchesEtapa = true;
      if (activeSubTab === 'retiradas') {
        matchesEtapa = m.etapa === 'RETIRADA' || m.etapa === 'DESHABILITADA';
      } else if (activeSubTab === 'inventario') {
        if (selectedEtapa === 'todos') {
          matchesEtapa = m.etapa !== 'RETIRADA';
        } else {
          matchesEtapa = m.etapa === selectedEtapa;
        }
      }

      return matchesSearch && matchesFab && matchesGab && matchesEtapa;
    });
  }, [catalog, searchTerm, selectedFabricante, selectedGabinete, selectedEtapa, activeSubTab]);

  // Paginación de resultados
  const totalPages = Math.ceil(filteredMachines.length / itemsPerPage) || 1;
  const paginatedMachines = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMachines.slice(start, start + itemsPerPage);
  }, [filteredMachines, currentPage]);

  // Reset page al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFabricante, selectedGabinete, selectedEtapa, activeSubTab]);

  // Abrir modal de edición
  const handleOpenEdit = (m: MachineCatalogItem) => {
    setEditingMachine(m);
    setFormNumero(m.numero);
    setFormIsla(m.isla);
    setFormFabricante(m.fabricante);
    setFormNuevoFabricante('');
    setFormModelo(m.modelo);
    setFormGabinete(m.gabinete || 'UPRIGHT');
    setFormEtapa(m.etapa || 'HABILITADA');
    setShowAddModal(true);
  };

  // Abrir modal de alta
  const handleOpenAdd = () => {
    setEditingMachine(null);
    setFormNumero('');
    setFormIsla('');
    setFormFabricante(fabricantesList[0] || 'IGT');
    setFormNuevoFabricante('');
    setFormModelo('');
    setFormGabinete('UPRIGHT');
    setFormEtapa('HABILITADA');
    setShowAddModal(true);
  };

  // Guardar alta o edición
  const handleSaveMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumero.trim()) {
      addAlert('El número de máquina es obligatorio', 'danger');
      return;
    }

    const fabFinal = (formFabricante === '__NUEVO__' ? formNuevoFabricante : formFabricante).trim().toUpperCase() || 'SIN ESPECIFICAR';
    
    if (formFabricante === '__NUEVO__' && formNuevoFabricante.trim()) {
      addCustomFabricante(formNuevoFabricante.trim());
    }

    const itemData: MachineCatalogItem = {
      numero: formNumero.trim(),
      isla: formIsla.trim() || '-',
      fabricante: fabFinal,
      modelo: formModelo.trim() || '-',
      gabinete: formGabinete.trim() || 'UPRIGHT',
      etapa: formEtapa
    };

    if (editingMachine) {
      const res = updateMachineInCatalog(editingMachine.numero, itemData);
      if (res.success) {
        addAlert(`✓ Máquina ${itemData.numero} actualizada con éxito`, 'success');
        setShowAddModal(false);
        refreshCatalog();
      } else {
        addAlert(res.error || 'Error al actualizar', 'danger');
      }
    } else {
      const res = addMachineToCatalog(itemData);
      if (res.success) {
        addAlert(`✓ Máquina ${itemData.numero} incorporada al parque de juego`, 'success');
        setShowAddModal(false);
        refreshCatalog();
      } else {
        addAlert(res.error || 'Error al incorporar máquina', 'danger');
      }
    }
  };

  // Confirmar baja / retiro
  const handleConfirmRetire = () => {
    if (!retiringMachine) return;
    const res = retireMachineFromCatalog(retiringMachine.numero, retireReason);
    if (res.success) {
      addAlert(`✓ Máquina ${retiringMachine.numero} dada de baja del parque activo`, 'success');
      setRetiringMachine(null);
      setRetireReason('');
      refreshCatalog();
    } else {
      addAlert(res.error || 'Error al procesar retiro', 'danger');
    }
  };

  // Rehabilitar máquina retirada
  const handleRehabilitate = (numero: string) => {
    const res = updateMachineInCatalog(numero, { etapa: 'HABILITADA' });
    if (res.success) {
      addAlert(`✓ Máquina ${numero} rehabilitada en el parque de juego`, 'success');
      refreshCatalog();
    } else {
      addAlert(res.error || 'Error al rehabilitar', 'danger');
    }
  };

  // Eliminar definitivamente
  const handleDeletePermanent = (numero: string) => {
    if (!window.confirm(`¿Está seguro de eliminar definitivamente la máquina ${numero} del registro histórico del catálogo?`)) {
      return;
    }
    const res = deleteMachineFromCatalog(numero);
    if (res.success) {
      addAlert(`✓ Máquina ${numero} eliminada del sistema`, 'success');
      refreshCatalog();
    } else {
      addAlert(res.error || 'Error al eliminar', 'danger');
    }
  };

  // Restaurar catálogo predeterminado
  const handleResetCatalog = () => {
    if (window.confirm('¿Desea restaurar el catálogo base oficial de 815 máquinas de Casino Santa Fe? Se conservará una copia de respaldo si exporta antes el CSV.')) {
      resetCatalogToDefault();
      addAlert('✓ Catálogo base oficial restaurado con éxito (815 máquinas)', 'info');
      refreshCatalog();
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    const csvData = exportCatalogToCSV();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `parque_maquinas_casino_santa_fe_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addAlert('✓ Catálogo exportado en formato CSV', 'success');
  };

  // Importar archivo CSV desde disco
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      if (text) {
        const res = importCatalogFromCSV(text);
        if (res.success) {
          addAlert(`✓ Catálogo importado correctamente (${res.count} máquinas)`, 'success');
          setShowImportModal(false);
          refreshCatalog();
        } else {
          addAlert(res.error || 'Error al procesar el archivo CSV', 'danger');
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Importar CSV pegado en texto
  const handleImportText = () => {
    if (!importCsvText.trim()) return;
    const res = importCatalogFromCSV(importCsvText);
    if (res.success) {
      addAlert(`✓ Catálogo importado con éxito (${res.count} máquinas procesadas)`, 'success');
      setShowImportModal(false);
      setImportCsvText('');
      refreshCatalog();
    } else {
      addAlert(res.error || 'Error en formato CSV', 'danger');
    }
  };

  // Renombrar fabricante en bloque
  const handleRenameFabricante = () => {
    if (!renamingFabricante || !renamedFabricanteTarget.trim()) return;
    renameFabricanteInCatalog(renamingFabricante, renamedFabricanteTarget.trim());
    addAlert(`✓ Fabricante '${renamingFabricante}' renombrado a '${renamedFabricanteTarget.trim()}' en todo el parque`, 'success');
    setRenamingFabricante(null);
    setRenamedFabricanteTarget('');
    refreshCatalog();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Principal y Panel de Control del Parque */}
      <div className="bg-gradient-to-br from-[#16162a] via-[#121220] to-[#0c0c16] border border-[#c8a84b]/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#c8a84b]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded-lg bg-[#c8a84b]/15 text-[#c8a84b]">
                <Cpu className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider">
                Administración de Inventario · Casino Santa Fe
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              Gestión del Parque de Máquinas y Fabricantes
            </h2>
            <p className="text-xs text-[#9090a8] mt-1 max-w-2xl">
              Alta de nuevas máquinas, edición de ubicación en islas, retiro o baja de unidades y administración de fabricantes oficiales.
            </p>
          </div>

          {/* Botonera de Acciones Rápidas */}
          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
            <button
              onClick={handleOpenAdd}
              className="flex-1 sm:flex-initial bg-[#c8a84b] hover:bg-[#f0d882] text-black font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Incorporar Máquina
            </button>

            <button
              onClick={handleExportCSV}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all"
              title="Descargar catálogo en formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#c8a84b]" />
              Exportar CSV
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all"
              title="Cargar lote de máquinas desde archivo CSV"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              Importar CSV
            </button>

            <button
              onClick={handleResetCatalog}
              className="bg-white/5 hover:bg-rose-950/40 hover:border-rose-500/30 text-[#9090a8] hover:text-rose-300 border border-white/10 font-semibold text-xs py-2.5 px-3 rounded-xl transition-all"
              title="Restaurar catálogo inicial base (815 máquinas)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Métricas de Parque */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/5">
          <div className="bg-[#19192f]/70 border border-white/5 rounded-xl p-3.5 text-center">
            <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">
              Total Registradas
            </span>
            <span className="text-xl md:text-2xl font-black text-white mt-1 block">
              {totalRegistradas}
            </span>
            <span className="text-[9px] text-[#9090a8]">En base de datos</span>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5 text-center">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
              Habilitadas en Sala
            </span>
            <span className="text-xl md:text-2xl font-black text-emerald-300 mt-1 block">
              {totalHabilitadas}
            </span>
            <span className="text-[9px] text-emerald-400/80 font-semibold">{operatividadPct}% Operativas</span>
          </div>

          <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3.5 text-center">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">
              Fuera de Servicio
            </span>
            <span className="text-xl md:text-2xl font-black text-rose-300 mt-1 block">
              {totalFueraDeServicio}
            </span>
            <span className="text-[9px] text-rose-400/80">En acta correctiva</span>
          </div>

          <div className="bg-[#19192f]/70 border border-white/5 rounded-xl p-3.5 text-center">
            <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">
              Retiradas / Bajas
            </span>
            <span className="text-xl md:text-2xl font-black text-[#f0d882] mt-1 block">
              {totalRetiradas}
            </span>
            <span className="text-[9px] text-[#9090a8]">Fuera de sala</span>
          </div>

          <div className="bg-[#19192f]/70 border border-white/5 rounded-xl p-3.5 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] text-[#9090a8] font-bold uppercase tracking-wider block">
              Fabricantes
            </span>
            <span className="text-xl md:text-2xl font-black text-sky-300 mt-1 block">
              {fabricantesList.length}
            </span>
            <span className="text-[9px] text-[#9090a8]">Marcas activas</span>
          </div>
        </div>
      </div>

      {/* 2. Sub-navegación de Sección */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-1.5 bg-[#12121f] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveSubTab('inventario')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'inventario'
                ? 'bg-[#c8a84b] text-black shadow'
                : 'text-[#9090a8] hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Inventario Activo ({catalog.filter(m => m.etapa !== 'RETIRADA').length})
          </button>

          <button
            onClick={() => setActiveSubTab('fabricantes')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'fabricantes'
                ? 'bg-[#c8a84b] text-black shadow'
                : 'text-[#9090a8] hover:text-white hover:bg-white/5'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Fabricantes ({fabricantesList.length})
          </button>

          <button
            onClick={() => setActiveSubTab('retiradas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'retiradas'
                ? 'bg-[#c8a84b] text-black shadow'
                : 'text-[#9090a8] hover:text-white hover:bg-white/5'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Máquinas Retiradas ({totalRetiradas})
          </button>
        </div>

        <span className="text-xs text-[#9090a8] font-mono">
          Mostrando {filteredMachines.length} de {catalog.length} unidades
        </span>
      </div>

      {/* 3. VISTA: INVENTARIO DE MÁQUINAS / RETIRADAS */}
      {(activeSubTab === 'inventario' || activeSubTab === 'retiradas') && (
        <div className="bg-[#12121e] border border-white/5 rounded-2xl p-5 shadow-lg space-y-4">
          {/* Barra de Búsqueda y Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Buscador */}
            <div className="relative md:col-span-2">
              <Search className="w-3.5 h-3.5 text-[#9090a8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por número de máquina, isla, modelo o fabricante..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#171726] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-[#e8e8f0] focus:border-[#c8a84b] focus:outline-none"
              />
            </div>

            {/* Filtro Fabricante */}
            <div>
              <select
                value={selectedFabricante}
                onChange={e => setSelectedFabricante(e.target.value)}
                className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-[#e8e8f0] focus:border-[#c8a84b] focus:outline-none"
              >
                <option value="todos">Todos los Fabricantes</option>
                {fabricantesList.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Filtro Gabinete */}
            <div>
              <select
                value={selectedGabinete}
                onChange={e => setSelectedGabinete(e.target.value)}
                className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-[#e8e8f0] focus:border-[#c8a84b] focus:outline-none"
              >
                <option value="todos">Todos los Gabinetes</option>
                {gabinetesList.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabla de Máquinas */}
          {filteredMachines.length === 0 ? (
            <div className="bg-[#171728] p-10 text-center rounded-xl border border-dashed border-white/5 space-y-2">
              <AlertCircle className="w-8 h-8 text-[#c8a84b] mx-auto opacity-70" />
              <p className="text-xs font-bold text-white">No se encontraron máquinas con los filtros actuales</p>
              <p className="text-[11px] text-[#9090a8]">
                Pruebe cambiando el término de búsqueda o haga clic en "Incorporar Máquina" para registrarla.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] text-[#9090a8] uppercase font-bold tracking-wider bg-white/2">
                    <th className="py-3 px-3">Máquina / Isla</th>
                    <th className="py-3 px-3">Fabricante</th>
                    <th className="py-3 px-3">Modelo</th>
                    <th className="py-3 px-3">Gabinete</th>
                    <th className="py-3 px-3">Estado en Sala</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedMachines.map(m => {
                    const isOos = activeOosMachineIds.has(m.numero);
                    const isRetired = m.etapa === 'RETIRADA' || m.etapa === 'DESHABILITADA';

                    return (
                      <tr key={m.numero} className="hover:bg-white/2 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-white">
                              {m.numero}
                            </span>
                            <span className="text-[10px] font-semibold text-[#f0d882] bg-[#c8a84b]/15 px-2 py-0.5 rounded border border-[#c8a84b]/20">
                              Isla {m.isla || '-'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-semibold text-white">
                          <span className="inline-flex items-center gap-1.5 bg-[#19192c] border border-white/10 px-2.5 py-0.5 rounded text-[11px]">
                            {m.fabricante}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-white font-medium">
                          {m.modelo || '-'}
                        </td>

                        <td className="py-3 px-3 text-[#9090a8]">
                          {m.gabinete || '-'}
                        </td>

                        <td className="py-3 px-3">
                          {isRetired ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                              Baja / Retirada
                            </span>
                          ) : isOos ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-500/30">
                              🔴 Fuera de Servicio
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                              🟢 En Servicio (Operativa)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(m)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all"
                              title="Editar datos de máquina e isla"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#c8a84b]" />
                            </button>

                            {isRetired ? (
                              <button
                                onClick={() => handleRehabilitate(m.numero)}
                                className="p-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 transition-all"
                                title="Rehabilitar e ingresar nuevamente a sala"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setRetiringMachine(m);
                                  setRetireReason('');
                                }}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-950/30 text-[#9090a8] hover:text-amber-400 transition-all"
                                title="Dar de baja / retirar de sala"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeletePermanent(m.numero)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-950/40 text-[#9090a8] hover:text-rose-400 transition-all"
                              title="Eliminar definitivamente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginador */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-3 border-t border-white/5 text-xs">
              <span className="text-[#9090a8]">
                Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredMachines.length} máquinas)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg bg-[#171726] border border-white/10 text-white disabled:opacity-30 hover:border-[#c8a84b] transition-all"
                >
                  Anterior
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg bg-[#171726] border border-white/10 text-white disabled:opacity-30 hover:border-[#c8a84b] transition-all"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. VISTA: GESTIÓN DE FABRICANTES */}
      {activeSubTab === 'fabricantes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#12121e] border border-white/5 rounded-2xl p-4">
            <div>
              <h3 className="text-xs font-bold text-[#c8a84b] uppercase tracking-wider">
                Marcas y Fabricantes Habilitados ({fabricantesList.length})
              </h3>
              <p className="text-[11px] text-[#9090a8]">
                Listado consolidado de fabricantes con presencia en sala de juego.
              </p>
            </div>
            <button
              onClick={() => {
                setNewFabricanteName('');
                setShowFabricanteModal(true);
              }}
              className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-extrabold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all shadow active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Fabricante
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {fabricantesList.map(fab => {
              const machinesOfFab = catalog.filter(m => m.fabricante.toUpperCase() === fab.toUpperCase());
              const activeCount = machinesOfFab.filter(m => m.etapa !== 'RETIRADA').length;
              const retiredCount = machinesOfFab.filter(m => m.etapa === 'RETIRADA').length;
              const share = totalHabilitadas > 0 ? ((activeCount / totalHabilitadas) * 100).toFixed(1) : '0';

              // Top 3 modelos
              const modelMap: Record<string, number> = {};
              machinesOfFab.forEach(m => {
                const mod = m.modelo || 'Estándar';
                modelMap[mod] = (modelMap[mod] || 0) + 1;
              });
              const topModels = Object.entries(modelMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

              return (
                <div 
                  key={fab}
                  className="bg-[#12121e] border border-white/5 hover:border-white/15 rounded-2xl p-4.5 shadow-lg space-y-3 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-black text-white tracking-wide">
                        {fab}
                      </h4>
                      <span className="text-[10px] text-[#9090a8] font-mono">
                        {share}% de participación en sala
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setRenamingFabricante(fab);
                        setRenamedFabricanteTarget(fab);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#c8a84b] transition-all"
                      title="Renombrar fabricante en todas sus máquinas"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-[#171728] p-2.5 rounded-xl text-center">
                    <div>
                      <span className="text-[9px] text-[#9090a8] uppercase font-bold block">Máquinas Activas</span>
                      <span className="text-lg font-black text-white mt-0.5 block">{activeCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#9090a8] uppercase font-bold block">Bajas / Retiradas</span>
                      <span className="text-lg font-black text-zinc-400 mt-0.5 block">{retiredCount}</span>
                    </div>
                  </div>

                  {topModels.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] text-[#9090a8] uppercase font-bold tracking-wider block">
                        Modelos frecuentes:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {topModels.map(([mod, cnt]) => (
                          <span 
                            key={mod}
                            className="text-[10px] bg-white/5 text-[#d0d0e0] px-2 py-0.5 rounded border border-white/5"
                          >
                            {mod} ({cnt})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/5 flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedFabricante(fab);
                        setActiveSubTab('inventario');
                      }}
                      className="text-[11px] text-[#c8a84b] hover:text-[#f0d882] font-bold flex items-center gap-1 transition-all"
                    >
                      Ver {activeCount} máquinas <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: ALTA / EDICIÓN DE MÁQUINA */}
      <AnimatePresence>
        {showAddModal && (
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
              className="bg-[#121220] border border-[#c8a84b]/30 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-[#1c1c30] to-[#121220] p-5 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#c8a84b]/20 text-[#c8a84b] flex items-center justify-center font-bold">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      {editingMachine ? `Editar Máquina ${editingMachine.numero}` : 'Incorporar Nueva Máquina'}
                    </h3>
                    <p className="text-[10px] text-[#9090a8]">
                      Registro en inventario de sala · Casino Santa Fe
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-[#9090a8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMachine} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Número de Máquina */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                      Número de Máquina *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingMachine}
                      placeholder="Ej: 4050"
                      value={formNumero}
                      onChange={e => setFormNumero(e.target.value)}
                      className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  {/* Isla */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                      Isla / Ubicación *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 150"
                      value={formIsla}
                      onChange={e => setFormIsla(e.target.value)}
                      className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Fabricante */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                    Fabricante / Marca *
                  </label>
                  <select
                    value={formFabricante}
                    onChange={e => setFormFabricante(e.target.value)}
                    className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none"
                  >
                    {fabricantesList.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                    <option value="__NUEVO__">+ Registrar Otro Fabricante...</option>
                  </select>
                </div>

                {formFabricante === '__NUEVO__' && (
                  <div className="space-y-1 animate-fadeIn">
                    <label className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                      Nombre del Nuevo Fabricante *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: LIGHT & WONDER"
                      value={formNuevoFabricante}
                      onChange={e => setFormNuevoFabricante(e.target.value)}
                      className="w-full bg-[#171726] border border-sky-500/40 rounded-xl px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Modelo */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                      Modelo
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: CRYSTAL DUAL 27"
                      value={formModelo}
                      onChange={e => setFormModelo(e.target.value)}
                      className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none"
                    />
                  </div>

                  {/* Gabinete */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                      Tipo de Gabinete
                    </label>
                    <select
                      value={formGabinete}
                      onChange={e => setFormGabinete(e.target.value)}
                      className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none"
                    >
                      <option value="UPRIGHT">UPRIGHT</option>
                      <option value="SLANT TOP">SLANT TOP</option>
                      <option value="CURVE">CURVE</option>
                      <option value="DUAL SCREEN">DUAL SCREEN</option>
                      <option value="BAR TOP">BAR TOP</option>
                      <option value="EVA CASH">EVA CASH</option>
                      <option value="STD">STD</option>
                    </select>
                  </div>
                </div>

                {/* Etapa */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                    Estado en Parque
                  </label>
                  <select
                    value={formEtapa}
                    onChange={e => setFormEtapa(e.target.value)}
                    className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none"
                  >
                    <option value="HABILITADA">HABILITADA (En sala de juego)</option>
                    <option value="RETIRADA">RETIRADA (Dada de baja / Depósito)</option>
                    <option value="INHABILITADA">INHABILITADA TEMPORAL</option>
                  </select>
                </div>

                {/* Botones de acción */}
                <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#9090a8]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#c8a84b] hover:bg-[#f0d882] text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    {editingMachine ? 'Guardar Cambios' : 'Registrar Máquina'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: BAJA / RETIRO DE MÁQUINA */}
      <AnimatePresence>
        {retiringMachine && (
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
              className="bg-[#121220] border border-rose-500/30 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-rose-950/60 to-[#121220] p-5 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Retiro / Baja de Máquina {retiringMachine.numero}
                    </h3>
                    <p className="text-[10px] text-[#9090a8]">
                      Fabricante: {retiringMachine.fabricante} · Isla {retiringMachine.isla}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRetiringMachine(null)}
                  className="p-1.5 rounded-lg bg-white/5 text-[#9090a8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-[#c0c0d8] leading-relaxed">
                  Al retirar esta máquina, se actualizará el parque total habilitado en sala y se moverá al registro de <strong>Máquinas Retiradas</strong>.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                    Motivo del Retiro / Observación (Opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Cambio de parque, obsolescencia, traslado a depósito..."
                    value={retireReason}
                    onChange={e => setRetireReason(e.target.value)}
                    className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRetiringMachine(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#9090a8]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRetire}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Confirmar Retiro
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: IMPORTAR CSV */}
      <AnimatePresence>
        {showImportModal && (
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
              className="bg-[#121220] border border-[#c8a84b]/30 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-[#1c1c30] to-[#121220] p-5 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Importar Catálogo de Máquinas
                    </h3>
                    <p className="text-[10px] text-[#9090a8]">
                      Cargue un archivo CSV con columnas: NUMERO;ISLA;ETAPA;FABRICANTE;MODELO;GABINETE
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-[#9090a8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Opción 1: Subir Archivo */}
                <div className="border-2 border-dashed border-white/10 hover:border-[#c8a84b]/40 rounded-xl p-6 text-center transition-all bg-[#171728]">
                  <Upload className="w-8 h-8 text-[#c8a84b] mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-white mb-1">Seleccionar archivo CSV de su equipo</p>
                  <p className="text-[10px] text-[#9090a8] mb-3">Compatible con Excel exportado a CSV separado por coma o punto y coma</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <label
                    htmlFor="csv-file-input"
                    className="inline-flex items-center gap-2 bg-[#c8a84b] hover:bg-[#f0d882] text-black font-extrabold text-xs py-2 px-4 rounded-xl cursor-pointer shadow transition-all active:scale-95"
                  >
                    Examinar Archivo...
                  </label>
                </div>

                <div className="text-center text-[10px] text-[#9090a8] font-bold uppercase tracking-wider">
                  — O pegar contenido CSV en texto —
                </div>

                {/* Opción 2: Pegar texto */}
                <div className="space-y-1">
                  <textarea
                    rows={4}
                    placeholder="NUMERO;ISLA;ETAPA;FABRICANTE;MODELO;GABINETE&#10;4001;150;HABILITADA;IGT;COBALT 27;UPRIGHT"
                    value={importCsvText}
                    onChange={e => setImportCsvText(e.target.value)}
                    className="w-full bg-[#090911] border border-white/10 rounded-xl p-3 font-mono text-[11px] text-white focus:border-[#c8a84b] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#9090a8]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!importCsvText.trim()}
                    onClick={handleImportText}
                    className="px-4 py-2 rounded-xl bg-[#c8a84b] hover:bg-[#f0d882] text-black font-extrabold text-xs disabled:opacity-30 shadow"
                  >
                    Importar Texto
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: RENOMBRAR FABRICANTE */}
      <AnimatePresence>
        {renamingFabricante && (
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
              className="bg-[#121220] border border-[#c8a84b]/30 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-[#1c1c30] to-[#121220] p-5 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Renombrar Fabricante: {renamingFabricante}
                </h3>
                <button
                  onClick={() => setRenamingFabricante(null)}
                  className="p-1.5 rounded-lg bg-white/5 text-[#9090a8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-[#9090a8]">
                  Este cambio actualizará automáticamente todas las máquinas asociadas a <strong>{renamingFabricante}</strong> en todo el catálogo.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                    Nuevo Nombre del Fabricante:
                  </label>
                  <input
                    type="text"
                    required
                    value={renamedFabricanteTarget}
                    onChange={e => setRenamedFabricanteTarget(e.target.value)}
                    className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRenamingFabricante(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#9090a8]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRenameFabricante}
                    className="px-4 py-2 rounded-xl bg-[#c8a84b] hover:bg-[#f0d882] text-black font-extrabold text-xs shadow"
                  >
                    Guardar y Renombrar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: NUEVO FABRICANTE */}
      <AnimatePresence>
        {showFabricanteModal && (
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
              className="bg-[#121220] border border-[#c8a84b]/30 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-[#1c1c30] to-[#121220] p-5 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Registrar Nuevo Fabricante
                </h3>
                <button
                  onClick={() => setShowFabricanteModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-[#9090a8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#c8a84b] uppercase tracking-wider">
                    Nombre del Fabricante:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: LIGHT & WONDER, SCIENTIFIC GAMES..."
                    value={newFabricanteName}
                    onChange={e => setNewFabricanteName(e.target.value)}
                    className="w-full bg-[#171726] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#c8a84b] focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFabricanteModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#9090a8]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!newFabricanteName.trim()}
                    onClick={() => {
                      if (newFabricanteName.trim()) {
                        addCustomFabricante(newFabricanteName.trim());
                        addAlert(`✓ Fabricante '${newFabricanteName.trim().toUpperCase()}' registrado con éxito`, 'success');
                        setShowFabricanteModal(false);
                        setNewFabricanteName('');
                        refreshCatalog();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-[#c8a84b] hover:bg-[#f0d882] text-black font-extrabold text-xs shadow disabled:opacity-30"
                  >
                    Registrar Fabricante
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Check, 
  Copy, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink, 
  FileCode, 
  ShieldAlert, 
  X, 
  ArrowUpRight,
  UploadCloud,
  HelpCircle,
  Settings,
  Mail
} from 'lucide-react';
import { 
  getApiUrl, 
  setCustomApiUrl, 
  resetCustomApiUrl, 
  testApiConnection, 
  syncAllLocalToRemote, 
  DEFAULT_API_URL 
} from '../lib/api';
import { GOOGLE_APPS_SCRIPT_CODE } from '../lib/googleAppsScriptTemplate';
import { MaintenanceRecord } from '../types';

interface DatabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionStatus: { source: 'api' | 'local'; error?: string };
  records: MaintenanceRecord[];
  onRefreshData: () => Promise<void>;
  addAlert: (msg: string, type: 'success' | 'info' | 'danger') => void;
}

export default function DatabaseSettingsModal({
  isOpen,
  onClose,
  connectionStatus,
  records,
  onRefreshData,
  addAlert
}: DatabaseSettingsModalProps) {
  const [urlInput, setUrlInput] = useState(getApiUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ 
    success?: boolean; 
    message?: string; 
    details?: string;
    count?: number;
  } | null>(null);
  
  const [syncing, setSyncing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'guia' | 'codigo'>('config');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getApiUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testApiConnection(urlInput);
      setTestResult(result);
      if (result.success) {
        addAlert('✓ Conexión con Google Sheets verificada con éxito.', 'success');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Error inesperado al probar conexión',
        details: err?.message || String(err)
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveUrl = async () => {
    setCustomApiUrl(urlInput);
    addAlert('URL guardada en configuración.', 'info');
    await handleTestConnection();
    await onRefreshData();
  };

  const handleResetUrl = () => {
    resetCustomApiUrl();
    setUrlInput(DEFAULT_API_URL);
    addAlert('URL restablecida al valor predeterminado.', 'info');
    setTestResult(null);
  };

  const handleSyncToCloud = async () => {
    setSyncing(true);
    try {
      const res = await syncAllLocalToRemote();
      if (res.success) {
        addAlert(res.message, 'success');
        await onRefreshData();
      } else {
        addAlert(res.message, 'danger');
      }
    } catch (e: any) {
      addAlert(`Error en sincronización: ${e?.message || e}`, 'danger');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    addAlert('Código de Google Apps Script copiado al portapapeles.', 'success');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const isConnected = connectionStatus.source === 'api';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-[#12121e] border border-[#c8a84b]/30 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#181829] border-b border-[#c8a84b]/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#c8a84b]/15 border border-[#c8a84b]/30 flex items-center justify-center text-[#f0d882]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Conexión a Base de Datos
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                  isConnected 
                    ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
                }`}>
                  {isConnected ? 'En Línea (Sincronizado)' : 'Modo Local (Offline)'}
                </span>
              </h2>
              <p className="text-xs text-[#9090a8]">
                Google Sheets / Google Apps Script Backend
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9090a8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-[#c8a84b]/15 bg-[#141423] px-6">
          <button
            onClick={() => setActiveSubTab('config')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeSubTab === 'config'
                ? 'border-[#c8a84b] text-[#f0d882]'
                : 'border-transparent text-[#9090a8] hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Configuración & Diagnóstico
          </button>
          <button
            onClick={() => setActiveSubTab('guia')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeSubTab === 'guia'
                ? 'border-[#c8a84b] text-[#f0d882]'
                : 'border-transparent text-[#9090a8] hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Guía de Solución (3 Pasos)
          </button>
          <button
            onClick={() => setActiveSubTab('codigo')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeSubTab === 'codigo'
                ? 'border-[#c8a84b] text-[#f0d882]'
                : 'border-transparent text-[#9090a8] hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Código Apps Script
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-[#d0d0e0]">
          
          {/* TAB 1: CONFIG & DIAGNÓSTICO */}
          {activeSubTab === 'config' && (
            <div className="space-y-5">
              {/* Estado de alerta explicativo */}
              {!isConnected ? (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-amber-300 text-sm">¿Por qué aparece en Modo Local?</h4>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      La aplicación continúa funcionando perfectamente en modo offline y guarda todos los egresos y servicios en la memoria de este navegador. Sin embargo, no se pudo comunicar con el Web App de Google Sheets.
                    </p>
                    <p className="text-xs text-amber-300/80 font-medium">
                      El motivo más frecuente es que en Google Apps Script la opción <span className="underline font-bold">«Quién tiene acceso»</span> no está configurada en <span className="underline font-bold">«Cualquier persona» (Anyone)</span>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-emerald-300 text-sm">Conectado y Sincronizado</h4>
                    <p className="text-xs text-emerald-200/80">
                      La aplicación está sincronizada en tiempo real con tu hoja de cálculo en la nube.
                    </p>
                  </div>
                </div>
              )}

              {/* Formulario de URL */}
              <div className="space-y-2 bg-[#171728] p-4 rounded-xl border border-[#c8a84b]/15">
                <label className="block font-semibold text-white">
                  URL del Web App de Google Apps Script:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 bg-[#0e0e1a] border border-[#c8a84b]/30 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#f0d882]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="bg-[#1f1f38] hover:bg-[#2c2c4d] text-[#f0d882] border border-[#c8a84b]/30 font-semibold px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                      {testing ? 'Probando...' : 'Probar'}
                    </button>
                    <button
                      onClick={handleSaveUrl}
                      className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold px-3.5 py-2 rounded-lg transition-all shrink-0"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px] text-[#9090a8]">
                  <span>Debe ser una URL de implementación terminada en <code className="text-[#f0d882]">/exec</code></span>
                  <button
                    onClick={handleResetUrl}
                    className="text-[#c8a84b] hover:underline"
                  >
                    Restablecer URL por defecto
                  </button>
                </div>
              </div>

              {/* Resultado de la prueba */}
              {testResult && (
                <div className={`p-4 rounded-xl border text-xs space-y-1.5 animate-fadeIn ${
                  testResult.success 
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {testResult.success ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">{testResult.message}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span className="text-rose-300">{testResult.message}</span>
                      </>
                    )}
                  </div>
                  {testResult.details && (
                    <p className="text-xs opacity-90 leading-relaxed font-sans">
                      {testResult.details}
                    </p>
                  )}
                  {testResult.success && testResult.count !== undefined && (
                    <p className="text-[11px] font-mono text-emerald-300">
                      Total de registros leídos de la hoja: {testResult.count}
                    </p>
                  )}
                </div>
              )}

              {/* Destinatarios de Correos Oficiales */}
              <div className="bg-[#171728] p-4 rounded-xl border border-[#c8a84b]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Mail className="w-4 h-4 text-[#f0d882]" />
                    <span>Notificaciones Automáticas por Correo (Configuradas)</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
                    Activas en Apps Script
                  </span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-[#0e0e1a] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[#f0d882] font-semibold">
                      <span>Técnicos (Paso 1: Egreso / Fuera de servicio):</span>
                      <span className="text-[10px] text-[#9090a8]">1 casilla</span>
                    </div>
                    <code className="text-[11px] text-white/90 break-all">Tecnicos.SF@casinostafe.com.ar</code>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#0e0e1a] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[#f0d882] font-semibold">
                      <span>Juego / Supervisión (Pasos 1, 2 y 3):</span>
                      <span className="text-[10px] text-[#9090a8]">11 destinatarios</span>
                    </div>
                    <p className="text-[10px] text-[#a0a0b8] leading-relaxed break-words font-mono">
                      vanina.anzotegui, david.humoller, pablo.gomez, matias.girsa, cristian.graglia, crysthian.pons, erica.vazquez, luis.ortega, alejandro.rey, andrea.lana, vanesa.lopez (@casinostafe.com.ar)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[10px]">
                  <div className="p-2 rounded bg-rose-950/20 border border-rose-500/20">
                    <strong className="text-rose-300 block mb-0.5">Paso 1: Egreso</strong>
                    <span className="text-rose-200/80">Aviso a Técnicos + Juego</span>
                  </div>
                  <div className="p-2 rounded bg-amber-950/20 border border-amber-500/20">
                    <strong className="text-amber-300 block mb-0.5">Paso 2: Reparación</strong>
                    <span className="text-amber-200/80">Aviso solo a Juego</span>
                  </div>
                  <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/20">
                    <strong className="text-emerald-300 block mb-0.5">Paso 3: Reingreso</strong>
                    <span className="text-emerald-200/80">Aviso final a Juego</span>
                  </div>
                </div>
              </div>

              {/* Sincronización de registros locales */}
              <div className="bg-[#171728] p-4 rounded-xl border border-[#c8a84b]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-xs">Caché Local del Navegador</h4>
                  <p className="text-[11px] text-[#9090a8]">
                    {records.length} registros almacenados localmente en este dispositivo.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleSyncToCloud}
                    disabled={syncing}
                    className="flex-1 sm:flex-initial bg-[#1f1f38] hover:bg-[#2c2c4d] text-[#f0d882] border border-[#c8a84b]/30 font-semibold px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    title="Subir todos los registros locales a la hoja de Google Sheets"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${syncing ? 'animate-bounce' : ''}`} />
                    {syncing ? 'Sincronizando...' : 'Subir Registros Locales a la Nube'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GUÍA DE SOLUCIÓN PASO A PASO */}
          {activeSubTab === 'guia' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#171728] border border-[#c8a84b]/20 space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#c8a84b] text-black text-xs font-black flex items-center justify-center">1</span>
                  Abre tu Hoja de Google Sheets y el Editor de Apps Script
                </h3>
                <p className="text-xs text-[#a0a0b8] pl-7">
                  Entra a tu hoja de cálculo en Google Drive y en el menú superior haz clic en: <br />
                  <strong className="text-[#f0d882]">Extensiones &gt; Apps Script</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#171728] border border-[#c8a84b]/20 space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#c8a84b] text-black text-xs font-black flex items-center justify-center">2</span>
                  Pega el Código Oficial del Servidor
                </h3>
                <p className="text-xs text-[#a0a0b8] pl-7 leading-relaxed">
                  Borra cualquier contenido previo en el editor <code className="text-[#f0d882]">Código.gs</code> y pega el código completo optimizado para Casino Santa Fe.
                </p>
                <div className="pl-7">
                  <button
                    onClick={handleCopyCode}
                    className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-md text-xs"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                    {copiedCode ? '¡Código Copiado al Portapapeles!' : 'Copiar Código de Apps Script'}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#171728] border border-[#c8a84b]/20 space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#c8a84b] text-black text-xs font-black flex items-center justify-center">3</span>
                  Publicar / Implementar con Acceso «Cualquier persona»
                </h3>
                <div className="text-xs text-[#a0a0b8] pl-7 space-y-2 leading-relaxed">
                  <p>1. En la esquina superior derecha de Apps Script, haz clic en el botón azul <strong className="text-white">«Implementar»</strong> (Deploy) &gt; <strong className="text-white">«Nueva implementación»</strong>.</p>
                  <p>2. En el icono del engranaje (Tipo), selecciona <strong className="text-white">«Aplicación web»</strong>.</p>
                  <div className="p-3 bg-[#0e0e1a] rounded-lg border border-[#c8a84b]/30 space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#9090a8]">Ejecutar como:</span>
                      <span className="text-[#f0d882] font-semibold">Yo (tu_cuenta@gmail.com)</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1">
                      <span className="text-[#9090a8]">Quién tiene acceso:</span>
                      <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">Cualquier persona (Anyone)</span>
                    </div>
                  </div>
                  <p className="text-amber-300 font-medium text-[11px] pt-1">
                    ⚠️ Si dejas «Solo yo», Google bloqueará la conexión desde el navegador web y la app seguirá mostrando «Modo Local».
                  </p>
                  <p>3. Haz clic en <strong className="text-white">Implementar</strong>, autoriza los permisos requeridos y copia la <strong className="text-white">URL de la aplicación web</strong>.</p>
                  <p>4. Regresa a esta ventana, pégala en la pestaña <strong className="text-[#f0d882]">Configuración</strong> y haz clic en <strong className="text-white">Guardar</strong>.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CÓDIGO APPS SCRIPT */}
          {activeSubTab === 'codigo' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9090a8]">
                  Código fuente para <strong className="text-white">Código.gs</strong> en Google Sheets:
                </span>
                <button
                  onClick={handleCopyCode}
                  className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? '¡Copiado!' : 'Copiar Código'}
                </button>
              </div>

              <div className="bg-[#0b0b14] border border-[#c8a84b]/25 rounded-xl p-4 overflow-x-auto max-h-[340px] font-mono text-[11px] text-[#a0e0a0] leading-relaxed select-all">
                <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-[#181829] border-t border-[#c8a84b]/20 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-[#9090a8]">
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Conectado a Google Sheets</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-medium">Modo Local Activo</span>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="bg-[#1f1f38] hover:bg-[#2c2c4d] text-white font-medium text-xs py-2 px-4 rounded-xl border border-white/10 transition-all"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}

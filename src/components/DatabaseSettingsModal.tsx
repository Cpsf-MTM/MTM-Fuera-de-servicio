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
  Mail,
  ShieldCheck,
  Download,
  Trash2,
  RotateCcw,
  User,
  LogIn,
  LogOut,
  Layers,
  HardDrive
} from 'lucide-react';
import { 
  getApiUrl, 
  setCustomApiUrl, 
  resetCustomApiUrl, 
  testApiConnection, 
  migrateAllToFirebase,
  backupDatabaseToFirestore,
  exportDatabaseToJSON,
  DEFAULT_API_URL 
} from '../lib/api';
import { 
  fetchFirestoreBackups, 
  createFirestoreBackup, 
  restoreFirestoreBackup, 
  deleteFirestoreBackup,
  testConnection as testFirebaseConnection,
  loginWithGoogle,
  logoutUser,
  auth,
  BackupRecord
} from '../lib/firebase';
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
  const [activeTab, setActiveTab] = useState<'firebase' | 'respaldos' | 'sheets'>('firebase');
  const [urlInput, setUrlInput] = useState(getApiUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; details?: string } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupLabel, setBackupLabel] = useState('');
  const [backupsList, setBackupsList] = useState<BackupRecord[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(u => setCurrentUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadBackups();
    }
  }, [isOpen]);

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const list = await fetchFirestoreBackups();
      setBackupsList(list);
    } catch (e) {
      console.warn('Error al cargar respaldos:', e);
    } finally {
      setLoadingBackups(false);
    }
  };

  if (!isOpen) return null;

  // Migrar a Firebase
  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await migrateAllToFirebase();
      if (res.success) {
        addAlert(res.message, 'success');
        await onRefreshData();
        await loadBackups();
      } else {
        addAlert(res.message, 'danger');
      }
    } catch (err: any) {
      addAlert(`Error en migración: ${err?.message || err}`, 'danger');
    } finally {
      setMigrating(false);
    }
  };

  // Crear Respaldo en Firebase
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const label = backupLabel.trim() || `Respaldo manual - ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}`;
      const res = await backupDatabaseToFirestore(label);
      if (res.success) {
        addAlert(res.message, 'success');
        setBackupLabel('');
        await loadBackups();
      } else {
        addAlert(res.message, 'danger');
      }
    } catch (e: any) {
      addAlert(`Error al crear respaldo: ${e?.message || e}`, 'danger');
    } finally {
      setCreatingBackup(false);
    }
  };

  // Restaurar Respaldo
  const handleRestoreBackup = async (b: BackupRecord) => {
    const confirm = window.confirm(`¿Está seguro de restaurar el respaldo "${b.label}" del ${new Date(b.created_at).toLocaleString()} con ${b.recordCount} registros?`);
    if (!confirm) return;

    try {
      const count = await restoreFirestoreBackup(b);
      addAlert(`✓ Respaldo restaurado con éxito (${count} registros cargados).`, 'success');
      await onRefreshData();
    } catch (e: any) {
      addAlert(`Error al restaurar: ${e?.message || e}`, 'danger');
    }
  };

  // Eliminar Respaldo
  const handleDeleteBackup = async (id: string) => {
    try {
      await deleteFirestoreBackup(id);
      addAlert('Respaldo eliminado.', 'info');
      await loadBackups();
    } catch (e: any) {
      addAlert(`Error al eliminar respaldo: ${e?.message || e}`, 'danger');
    }
  };

  // Probar conexión a Firebase
  const handleTestFirebase = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testFirebaseConnection();
      if (res.success) {
        setTestResult({
          success: true,
          message: '¡Conexión exitosa a Firebase Firestore!',
          details: 'La base de datos está en línea, segura y sincronizada en tiempo real con respaldo continuo.'
        });
        addAlert('✓ Conexión con Firebase Firestore verificada.', 'success');
      } else {
        setTestResult({
          success: false,
          message: 'Verificación offline',
          details: res.error || 'No se pudo contactar el servidor Firebase.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Error al contactar Firebase',
        details: err?.message || String(err)
      });
    } finally {
      setTesting(false);
    }
  };

  // Login Google
  const handleLoginGoogle = async () => {
    try {
      const user = await loginWithGoogle();
      addAlert(`Sesión iniciada como: ${user.email}`, 'success');
    } catch (e: any) {
      addAlert(`Error al autenticar: ${e?.message || e}`, 'danger');
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      await logoutUser();
      addAlert('Sesión cerrada correctamente.', 'info');
    } catch (e: any) {
      addAlert(`Error al cerrar sesión: ${e?.message || e}`, 'danger');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    addAlert('Código copiado al portapapeles.', 'success');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const isConnected = connectionStatus.source === 'api';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-[#12121e] border border-[#c8a84b]/40 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#181829] border-b border-[#c8a84b]/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-[#c8a84b]/40 flex items-center justify-center text-[#f0d882]">
              <Database className="w-5 h-5 text-[#f0d882]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Base de Datos &amp; Respaldo
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  isConnected 
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40' 
                    : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                }`}>
                  {isConnected ? 'Firebase Firestore Activo' : 'Modo Local (Offline)'}
                </span>
              </div>
              <p className="text-xs text-[#9090a8]">
                Almacenamiento seguro en la nube con réplica y respaldo automático
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9090a8] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs de Navegación */}
        <div className="flex border-b border-[#c8a84b]/20 bg-[#141423] px-6">
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'firebase'
                ? 'border-[#c8a84b] text-[#f0d882]'
                : 'border-transparent text-[#9090a8] hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Firebase Firestore (Principal)
          </button>
          
          <button
            onClick={() => { setActiveTab('respaldos'); loadBackups(); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'respaldos'
                ? 'border-[#c8a84b] text-[#f0d882]'
                : 'border-transparent text-[#9090a8] hover:text-white'
            }`}
          >
            <HardDrive className="w-4 h-4 text-[#f0d882]" />
            Copias de Respaldo ({backupsList.length})
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'sheets'
                ? 'border-[#c8a84b] text-[#f0d882]'
                : 'border-transparent text-[#9090a8] hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-400" />
            Google Sheets (Opcional)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-[#d0d0e0]">
          
          {/* TAB 1: FIREBASE PRINCIPAL */}
          {activeTab === 'firebase' && (
            <div className="space-y-5">
              
              {/* Tarjeta de Estado de Conexión */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 to-[#171728] border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      Conexión a Firebase Firestore
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                        En Línea
                      </span>
                    </h3>
                    <p className="text-xs text-[#9090a8] mt-0.5">
                      Base de datos NoSQL de alta velocidad, sin demoras de arranque en frío, con reglas de seguridad estrictas y disponibilidad 24/7.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTestFirebase}
                  disabled={testing}
                  className="bg-[#1f1f38] hover:bg-[#2c2c4d] text-[#f0d882] border border-[#c8a84b]/30 font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  {testing ? 'Comprobando...' : 'Verificar Conexión'}
                </button>
              </div>

              {/* Resultado del Test si existe */}
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
                </div>
              )}

              {/* Migración y Sincronización Inmediata */}
              <div className="bg-[#171728] p-5 rounded-xl border border-[#c8a84b]/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <UploadCloud className="w-4 h-4 text-[#f0d882]" />
                      Migrar y Asegurar Todo en Firebase
                    </h4>
                    <p className="text-xs text-[#9090a8]">
                      Sube todos los registros actuales ({records.length} registros) a Firebase Firestore para que queden guardados permanentemente.
                    </p>
                  </div>
                  <button
                    onClick={handleMigrate}
                    disabled={migrating}
                    className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 active:scale-95 disabled:opacity-50"
                  >
                    <UploadCloud className={`w-4 h-4 ${migrating ? 'animate-bounce' : ''}`} />
                    {migrating ? 'Migrando datos...' : 'Migrar Ahora a Firebase'}
                  </button>
                </div>
              </div>

              {/* Autenticación Google en Firebase */}
              <div className="bg-[#171728] p-5 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1f1f38] border border-white/10 flex items-center justify-center text-[#f0d882]">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-xs">
                        Operador / Cuenta Autenticada
                      </h4>
                      <p className="text-[11px] text-[#9090a8]">
                        {currentUser ? currentUser.email : 'Acceso en modo operador del casino'}
                      </p>
                    </div>
                  </div>

                  {currentUser ? (
                    <button
                      onClick={handleLogoutGoogle}
                      className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Cerrar Sesión
                    </button>
                  ) : (
                    <button
                      onClick={handleLoginGoogle}
                      className="bg-[#1f1f38] hover:bg-[#2c2c4d] text-white border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <LogIn className="w-3.5 h-3.5 text-[#f0d882]" />
                      Iniciar Sesión con Google
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: RESPALDOS (BACKUPS) */}
          {activeTab === 'respaldos' && (
            <div className="space-y-5">
              
              {/* Crear nuevo respaldo */}
              <div className="bg-[#171728] p-5 rounded-xl border border-[#c8a84b]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[#f0d882]" />
                    Generar Nuevo Punto de Respaldo
                  </h4>
                  <button
                    onClick={exportDatabaseToJSON}
                    className="bg-[#1f1f38] hover:bg-[#2c2c4d] text-[#f0d882] border border-[#c8a84b]/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    title="Descargar copia del archivo JSON al disco de tu computadora"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar Copia en PC (.json)
                  </button>
                </div>
                <p className="text-xs text-[#9090a8]">
                  Guarda una instantánea completa de los {records.length} registros directamente en la colección de respaldos de Firebase.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    value={backupLabel}
                    onChange={e => setBackupLabel(e.target.value)}
                    placeholder="Descripción del respaldo (ej: Antes de auditoría mensual)..."
                    className="flex-1 bg-[#0e0e1a] border border-[#c8a84b]/30 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#f0d882]"
                  />
                  <button
                    onClick={handleCreateBackup}
                    disabled={creatingBackup}
                    className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <ShieldCheck className={`w-4 h-4 ${creatingBackup ? 'animate-spin' : ''}`} />
                    {creatingBackup ? 'Creando...' : 'Crear Respaldo'}
                  </button>
                </div>
              </div>

              {/* Lista de Respaldos Existentes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#9090a8]">
                    Puntos de Restauración Disponibles ({backupsList.length})
                  </h4>
                  <button
                    onClick={loadBackups}
                    className="text-xs text-[#f0d882] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Actualizar lista
                  </button>
                </div>

                {loadingBackups ? (
                  <div className="text-center py-8 text-[#9090a8]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#f0d882]" />
                    Cargando respaldos desde Firebase...
                  </div>
                ) : backupsList.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#171728] border border-white/5 text-center text-[#9090a8] space-y-2">
                    <HardDrive className="w-8 h-8 mx-auto text-[#404050]" />
                    <p className="font-semibold text-white">No hay respaldos guardados aún</p>
                    <p className="text-xs max-w-sm mx-auto">
                      Haz clic en «Crear Respaldo» arriba para guardar la primera copia de seguridad en la nube.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {backupsList.map(b => (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-xl bg-[#171728] border border-white/10 hover:border-[#c8a84b]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{b.label}</span>
                            <span className="text-[10px] bg-[#c8a84b]/15 text-[#f0d882] px-2 py-0.5 rounded font-mono font-bold">
                              {b.recordCount} registros
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9090a8]">
                            Fecha: {new Date(b.created_at).toLocaleString('es-AR')} &bull; ID: <code className="font-mono">{b.id}</code>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleRestoreBackup(b)}
                            className="bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                            title="Restaurar base de datos a este punto"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restaurar
                          </button>
                          
                          <button
                            onClick={() => handleDeleteBackup(b.id)}
                            className="p-1.5 rounded-lg text-[#9090a8] hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                            title="Eliminar este respaldo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: GOOGLE SHEETS (OPCIONAL) */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200/90 leading-relaxed">
                <p>
                  <strong>Google Sheets como respaldo secundario:</strong> Puedes seguir utilizando o sincronizando con Google Sheets si lo deseas. Recuerda que con Firebase Firestore ya cuentas con persistencia total y copias de seguridad inmediatas sin depender de las autorizaciones de Apps Script.
                </p>
              </div>

              {/* Destinatarios de Correos Oficiales */}
              <div className="bg-[#171728] p-4 rounded-xl border border-[#c8a84b]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Mail className="w-4 h-4 text-[#f0d882]" />
                    <span>Notificaciones Automáticas por Correo (Configuradas)</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
                    Activas
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
              </div>

              {/* Código Apps Script */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9090a8]">
                    Código de soporte para Google Apps Script:
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="bg-[#c8a84b] hover:bg-[#f0d882] text-black font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? '¡Copiado!' : 'Copiar Código'}
                  </button>
                </div>
                <div className="bg-[#0b0b14] border border-[#c8a84b]/20 rounded-xl p-3 max-h-[220px] overflow-y-auto font-mono text-[11px] text-[#a0e0a0]">
                  <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-[#181829] border-t border-[#c8a84b]/20 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px]">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Firebase Firestore Conectado</span>
          </div>

          <button
            onClick={onClose}
            className="bg-[#1f1f38] hover:bg-[#2c2c4d] text-white font-medium text-xs py-2 px-5 rounded-xl border border-white/10 transition-all"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}

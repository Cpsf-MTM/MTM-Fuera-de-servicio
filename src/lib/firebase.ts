import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  getDocFromServer,
  writeBatch,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { MaintenanceRecord } from '../types';

// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Suprimir logs de reintentos internos transitorios de Firestore
try {
  setLogLevel('silent');
} catch (e) {
  // Ignorar si no está soportado en este entorno
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validación de conexión según instrucciones del Skill
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { success: true };
  } catch (error: any) {
    // Si la conexión inicial está en proceso de negociación, reintentar una vez
    if (error?.code === 'unavailable' || (error instanceof Error && error.message.includes('offline'))) {
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        await getDocFromServer(doc(db, 'test', 'connection'));
        return { success: true };
      } catch (retryErr: any) {
        if (retryErr instanceof Error && retryErr.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
        return { 
          success: false, 
          error: retryErr instanceof Error ? retryErr.message : String(retryErr) 
        };
      }
    }
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Authentication
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Backup Type
export interface BackupRecord {
  id: string;
  label: string;
  recordCount: number;
  created_at: string;
  dataJson: string;
  userId?: string;
}

export function sanitizeRecordId(id?: string): string {
  if (!id || typeof id !== 'string') {
    return `REG-${Date.now()}`;
  }
  const clean = id.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  return clean.length > 0 && clean.length <= 128 ? clean : `REG-${Date.now()}`;
}

// ----------------- OPERACIONES DE FIRESTORE -----------------

const RECORDS_COLLECTION = 'maintenance_records';
const BACKUPS_COLLECTION = 'backups';

// 1. Obtener todos los registros de mantenimiento
export async function fetchMaintenanceRecordsFromFirestore(): Promise<MaintenanceRecord[]> {
  try {
    const colRef = collection(db, RECORDS_COLLECTION);
    const snap = await getDocs(colRef);
    const records: MaintenanceRecord[] = [];
    snap.forEach(d => {
      const data = d.data();
      records.push({
        id: d.id,
        estado: data.estado,
        egreso: data.egreso,
        tecnico: data.tecnico || null,
        inspector: data.inspector || null,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
      });
    });
    // Ordenar de más reciente a más antiguo
    records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, RECORDS_COLLECTION);
  }
}

// 2. Guardar o actualizar registro de mantenimiento
export async function saveMaintenanceRecordToFirestore(record: MaintenanceRecord): Promise<void> {
  const safeId = sanitizeRecordId(record.id);
  const docPath = `${RECORDS_COLLECTION}/${safeId}`;
  try {
    const docRef = doc(db, RECORDS_COLLECTION, safeId);
    const payload: any = {
      id: safeId,
      estado: String(record.estado || 'egreso').toLowerCase(),
      egreso: record.egreso || {},
      created_at: record.created_at || new Date().toISOString(),
      updated_at: record.updated_at || new Date().toISOString()
    };
    if (record.tecnico) {
      payload.tecnico = record.tecnico;
    }
    if (record.inspector) {
      payload.inspector = record.inspector;
    }
    if (auth.currentUser?.uid) {
      payload.userId = auth.currentUser.uid;
    }

    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// 3. Eliminar registro de mantenimiento
export async function deleteMaintenanceRecordFromFirestore(recordId: string): Promise<void> {
  const safeId = sanitizeRecordId(recordId);
  const docPath = `${RECORDS_COLLECTION}/${safeId}`;
  try {
    const docRef = doc(db, RECORDS_COLLECTION, safeId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// 4. Suscripción en tiempo real (Realtime Sync)
export function subscribeToMaintenanceRecords(
  onData: (records: MaintenanceRecord[]) => void,
  onError: (error: Error) => void
) {
  const colRef = collection(db, RECORDS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const records: MaintenanceRecord[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        records.push({
          id: d.id,
          estado: data.estado,
          egreso: data.egreso,
          tecnico: data.tecnico || null,
          inspector: data.inspector || null,
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString()
        });
      });
      records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      onData(records);
    },
    (err) => {
      console.error('Error en onSnapshot de registros:', err);
      try {
        handleFirestoreError(err, OperationType.GET, RECORDS_COLLECTION);
      } catch (e: any) {
        onError(e);
      }
    }
  );
}

// 5. Migración por lotes (Batch migration) a Firestore
export async function batchImportToFirestore(records: MaintenanceRecord[]): Promise<number> {
  if (!records || records.length === 0) return 0;
  
  try {
    const BATCH_SIZE = 300;
    let savedCount = 0;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      
      chunk.forEach((record, idx) => {
        if (!record) return;
        const safeId = sanitizeRecordId(record.id || `REG-${Date.now()}-${idx}`);
        const docRef = doc(db, RECORDS_COLLECTION, safeId);
        const payload: any = {
          id: safeId,
          estado: String(record.estado || 'egreso').toLowerCase(),
          egreso: record.egreso || {},
          created_at: record.created_at || new Date().toISOString(),
          updated_at: record.updated_at || new Date().toISOString()
        };
        if (record.tecnico) payload.tecnico = record.tecnico;
        if (record.inspector) payload.inspector = record.inspector;
        if (auth.currentUser?.uid) payload.userId = auth.currentUser.uid;
        
        batch.set(docRef, payload, { merge: true });
      });
      
      await batch.commit();
      savedCount += chunk.length;
    }
    
    return savedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, RECORDS_COLLECTION);
  }
}

// 6. Crear un Respaldo (Backup) en Firestore
export async function createFirestoreBackup(label: string, records: MaintenanceRecord[]): Promise<BackupRecord> {
  const backupId = `BCK-${Date.now()}`;
  const docPath = `${BACKUPS_COLLECTION}/${backupId}`;
  try {
    const backupData: BackupRecord = {
      id: backupId,
      label: label.trim() || 'Respaldo General Automático',
      recordCount: records.length,
      created_at: new Date().toISOString(),
      dataJson: JSON.stringify(records),
      userId: auth.currentUser?.uid || 'casino-staff'
    };
    
    const docRef = doc(db, BACKUPS_COLLECTION, backupId);
    await setDoc(docRef, backupData);
    return backupData;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// 7. Listar todos los respaldos
export async function fetchFirestoreBackups(): Promise<BackupRecord[]> {
  try {
    const colRef = collection(db, BACKUPS_COLLECTION);
    const snap = await getDocs(colRef);
    const backups: BackupRecord[] = [];
    snap.forEach(d => {
      backups.push(d.data() as BackupRecord);
    });
    backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return backups;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, BACKUPS_COLLECTION);
  }
}

// 8. Restaurar un respaldo
export async function restoreFirestoreBackup(backup: BackupRecord): Promise<number> {
  try {
    const records: MaintenanceRecord[] = JSON.parse(backup.dataJson);
    if (!Array.isArray(records)) {
      throw new Error('Formato de datos de respaldo inválido');
    }
    const count = await batchImportToFirestore(records);
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, RECORDS_COLLECTION);
  }
}

// 9. Eliminar un respaldo
export async function deleteFirestoreBackup(backupId: string): Promise<void> {
  const docPath = `${BACKUPS_COLLECTION}/${backupId}`;
  try {
    const docRef = doc(db, BACKUPS_COLLECTION, backupId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

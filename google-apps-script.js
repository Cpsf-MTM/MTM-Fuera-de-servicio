// ========================================================
// CASINO SANTA FE - SCRIPT PARA GOOGLE APPS SCRIPT / GOOGLE SHEETS
// Sistema de Control y Flujo Correctivo Automatizado
// ========================================================
//
// INSTRUCCIONES DE INSTALACIÓN PASO A PASO:
// 1. Abre tu hoja de cálculo en Google Sheets (o crea una nueva).
// 2. En el menú superior de Google Sheets, haz clic en:
//      Extensiones > Apps Script
// 3. Borra todo el código que aparezca en el editor y pega este código completo.
// 4. Haz clic en el icono de Guardar (disquete) o pulsa Ctrl + S.
// 5. En la esquina superior derecha, haz clic en el botón azul "Implementar" (o "Deploy")
//    y selecciona "Nueva implementación".
// 6. En el icono del engranaje ("Seleccionar tipo"), elige "Aplicación web".
// 7. Configura EXACTAMENTE los siguientes campos:
//      - Descripción: Casino Santa Fe API
//      - Ejecutar como: "Yo (tu_correo@gmail.com)"
//      - Quién tiene acceso: "Cualquier persona" (Anyone / Incluso anónimo)  <-- ¡CRUCIAL!
//        (Nota: Si dejas "Solo yo", la aplicación web NO se podrá conectar y dará Modo Local)
// 8. Haz clic en "Implementar".
// 9. Si Google te pide "Revisar permisos", haz clic en Avanzado > Ir a Casino Santa Fe (no seguro) y Permitir.
// 10. Copia la "URL de la aplicación web" (termina en /exec) y pégala en la aplicación.
// ========================================================

const SHEET_NAME = 'Registros';

const HEADERS = [
  'id', 'estado', 
  'e_maquina', 'e_isla', 'e_fecha', 'e_motivo', 'e_nota',
  'e_coinin', 'e_coinout', 'e_jackpot', 'e_prog1', 'e_prog2', 'e_prog3', 'e_prog4',
  'e_devolucion', 'e_operador', 'e_firma', 'e_foto',
  't_fecha', 't_informe', 't_solucion', 't_tecnico', 't_firma',
  'i_fecha', 'i_informe', 'i_coinin', 'i_devolucion', 'i_denominacion',
  'i_apuesta_min', 'i_apuesta_max', 'i_mdc', 'i_inspector', 'i_firma',
  'i_checks_billetes', 'i_checks_extras', 'created_at', 'updated_at'
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setFontWeight('bold')
         .setBackground('#1f1f38')
         .setFontColor('#f0d882');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Responde a peticiones GET (para verificar conectividad y pruebas)
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const totalRows = Math.max(0, sheet.getLastRow() - 1);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Casino Santa Fe API está en línea y conectada a Google Sheets.',
      sheetName: SHEET_NAME,
      registrosCount: totalRows,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Responde a peticiones POST (getAll, save, update, syncBatch)
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(12000); // Esperar hasta 12 segundos por concurrencia
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Servidor temporalmente ocupado. Por favor reintenta.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const sheet = getOrCreateSheet();
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    const action = body.action || 'getAll';
    const data = body.data;

    // 1. OBTENER TODOS LOS REGISTROS
    if (action === 'getAll') {
      const rows = sheet.getDataRange().getValues();
      if (rows.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ registros: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const headers = rows[0];
      const registros = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const item = {};
        for (let j = 0; j < headers.length; j++) {
          const val = row[j];
          item[headers[j]] = (val !== undefined && val !== null) ? String(val) : '';
        }
        if (item.id) {
          registros.push(item);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ registros }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. GUARDAR NUEVO REGISTRO
    if (action === 'save') {
      const newRow = HEADERS.map(h => {
        const val = data && data[h] !== undefined ? data[h] : '';
        return String(val);
      });
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ACTUALIZAR REGISTRO EXISTENTE
    if (action === 'update') {
      const rows = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.id)) {
          rowIndex = i + 1; // Fila en hoja (1-indexed)
          break;
        }
      }

      const rowValues = HEADERS.map(h => {
        const val = data && data[h] !== undefined ? data[h] : '';
        return String(val);
      });

      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. SINCRONIZACIÓN POR LOTE (BATCH SYNC DE CACHÉ OFFLINE)
    if (action === 'syncBatch' && Array.isArray(data)) {
      const rows = sheet.getDataRange().getValues();
      const existingMap = new Map();
      for (let i = 1; i < rows.length; i++) {
        existingMap.set(String(rows[i][0]), i + 1);
      }

      let inserted = 0;
      let updated = 0;

      data.forEach(item => {
        if (!item || !item.id) return;
        const rowValues = HEADERS.map(h => {
          const val = item[h] !== undefined ? item[h] : '';
          return String(val);
        });

        const existingRow = existingMap.get(String(item.id));
        if (existingRow) {
          sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([rowValues]);
          updated++;
        } else {
          sheet.appendRow(rowValues);
          inserted++;
          existingMap.set(String(item.id), sheet.getLastRow());
        }
      });

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        inserted, 
        updated, 
        totalProcessed: inserted + updated 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: 'Acción no reconocida: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

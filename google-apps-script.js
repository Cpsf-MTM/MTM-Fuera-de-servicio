// ==========================================
// CASINO SANTA FE - GOOGLE APPS SCRIPT OFICIAL
// Sistema de Control y Flujo Correctivo Automatizado
// ==========================================

// ==========================================
// CONFIGURACIÓN DE CORREOS OFICIALES
// ==========================================
const EMAILS_TECNICOS = "Tecnicos.SF@casinostafe.com.ar"; // Separa con comas si son varios
const EMAILS_JUEGO = "vanina.anzotegui@casinostafe.com.ar,david.humoller@casinostafe.com.ar,pablo.gomez@casinostafe.com.ar,matias.girsa@casinostafe.com.ar,cristian.graglia@casinostafe.com.ar,crysthian.pons@casinostafe.com.ar,erica.vazquez@casinostafe.com.ar,luis.ortega@casinostafe.com.ar,alejandro.rey@casinostafe.com.ar,andrea.lana@casinostafe.com.ar,vanesa.lopez@casinostafe.com.ar";

// Columnas de la planilla (mapeadas en orden)
const COL_HEADERS = [
  "id", "estado", "e_maquina", "e_isla", "e_fecha", "e_motivo", "e_coinin", "e_coinout", "e_jackpot", 
  "e_prog1", "e_prog2", "e_prog3", "e_prog4", "e_devolucion", "e_operador", "e_firma", "e_foto", "e_nota",
  "t_fecha", "t_informe", "t_solucion", "t_tecnico", "t_firma", "i_checks_billetes", "i_checks_extras",
  "i_fecha", "i_informe", "i_coinin", "i_devolucion", "i_denominacion", "i_apuesta_min", "i_apuesta_max", 
  "i_mdc", "i_inspector", "i_firma", "created_at", "updated_at"
];

// Responde a peticiones GET (para verificar conectividad directa desde el navegador)
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Registros");
    const count = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      message: "Casino Santa Fe API está en línea y conectada a Google Sheets.",
      registrosCount: count,
      emailsConfigurados: {
        tecnicos: EMAILS_TECNICOS,
        juegoCount: EMAILS_JUEGO.split(",").length
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const data = requestData.data;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Registros");
    if (!sheet) {
      sheet = ss.insertSheet("Registros");
      sheet.appendRow(COL_HEADERS);
      sheet.getRange(1, 1, 1, COL_HEADERS.length)
           .setFontWeight("bold")
           .setBackground("#1f1f38")
           .setFontColor("#f0d882");
      sheet.setFrozenRows(1);
    }
    
    let result;
    if (action === "getAll") {
      result = getAllRecords(sheet);
    } else if (action === "save") {
      result = saveRecord(sheet, data);
    } else if (action === "update") {
      result = updateRecord(sheet, data);
    } else if (action === "syncBatch" && Array.isArray(data)) {
      result = syncBatchRecords(sheet, data);
    } else {
      throw new Error("Acción no válida: " + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Obtener todos los registros de la planilla
function getAllRecords(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { registros: [] };
  
  const values = sheet.getRange(2, 1, lastRow - 1, COL_HEADERS.length).getValues();
  const registros = values.map(row => {
    let item = {};
    COL_HEADERS.forEach((h, i) => {
      item[h] = row[i] !== undefined && row[i] !== null ? String(row[i]) : "";
    });
    return item;
  });
  
  return { registros: registros };
}

// Guardar nuevo registro (Paso 1: Egreso / Fuera de Servicio)
function saveRecord(sheet, data) {
  const rowValues = COL_HEADERS.map(h => {
    if (h === "created_at" || h === "updated_at") return new Date().toISOString();
    return data[h] !== undefined ? String(data[h]) : "";
  });
  
  sheet.appendRow(rowValues);
  
  // Alerta de Etapa 1: Notificar a Técnicos y Juego
  enviarAlertaEmail("egreso", data);
  
  return { success: true };
}

// Actualizar registro existente (Paso 2 o Paso 3)
function updateRecord(sheet, data) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error("No hay registros que actualizar");
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => String(row[0]));
  const rowIndex = ids.indexOf(String(data.id));
  
  if (rowIndex === -1) throw new Error("ID de registro no encontrado: " + data.id);
  
  const realRow = rowIndex + 2; // +2 por cabecera y base 0
  
  // Obtener estado anterior para verificar si cambió
  const prevEstado = sheet.getRange(realRow, 2).getValue();
  
  COL_HEADERS.forEach((h, colIdx) => {
    if (h === "id" || h === "created_at") return; // No modificar id ni creación
    if (h === "updated_at") {
      sheet.getRange(realRow, colIdx + 1).setValue(new Date().toISOString());
      return;
    }
    if (data[h] !== undefined) {
      sheet.getRange(realRow, colIdx + 1).setValue(String(data[h]));
    }
  });

  // Alerta de Cambio de Etapa: Notificar solo a Juego si pasa a 'tecnico' o 'completo'
  if (prevEstado !== data.estado) {
    if (data.estado === "tecnico" || data.estado === "completo") {
      enviarAlertaEmail(data.estado, data);
    }
  }
  
  return { success: true };
}

// Sincronización en lote desde caché offline
function syncBatchRecords(sheet, dataArray) {
  const lastRow = sheet.getLastRow();
  const existingMap = new Map();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach((row, i) => {
      existingMap.set(String(row[0]), i + 2);
    });
  }

  let inserted = 0;
  let updated = 0;

  dataArray.forEach(item => {
    if (!item || !item.id) return;
    const rowValues = COL_HEADERS.map(h => {
      if (h === "updated_at") return new Date().toISOString();
      return item[h] !== undefined ? String(item[h]) : "";
    });

    const existingRow = existingMap.get(String(item.id));
    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, COL_HEADERS.length).setValues([rowValues]);
      updated++;
    } else {
      sheet.appendRow(rowValues);
      inserted++;
      existingMap.set(String(item.id), sheet.getLastRow());
    }
  });

  return { success: true, inserted: inserted, updated: updated, totalProcessed: inserted + updated };
}

// ==========================================
// FUNCIÓN AUXILIAR DE ENVÍO DE EMAIL HTML
// ==========================================
function enviarAlertaEmail(estado, record) {
  let destinatarios = "";
  let asunto = "";
  let htmlBody = "";
  
  const fechaFormateada = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  
  if (estado === "egreso") {
    // Etapa 1: Avisar a Técnicos y Juego
    destinatarios = EMAILS_TECNICOS + "," + EMAILS_JUEGO;
    asunto = `🚨 FUERA DE SERVICIO: Máquina ${record.e_maquina} (Isla ${record.e_isla})`;
    
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #ff4444; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #ff4444; color: white; padding: 15px; font-size: 18px; font-weight: bold; text-align: center;">
          Máquina Fuera de Servicio (Paso 1)
        </div>
        <div style="padding: 20px; background-color: #fafafa; color: #333;">
          <p>Se ha registrado un retiro de servicio para la siguiente máquina:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 40%;">Máquina:</td><td style="padding: 6px;">${record.e_maquina}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Isla:</td><td style="padding: 6px;">${record.e_isla}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Fecha/Hora:</td><td style="padding: 6px;">${fechaFormateada} hs</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Motivo Falla:</td><td style="padding: 6px; color: #cc0000; font-weight: bold;">${record.e_motivo}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Operador Inspector:</td><td style="padding: 6px;">${record.e_operador}</td></tr>
          </table>
          <p style="margin-top: 20px; font-size: 11px; color: #777; text-align: center;">
            Mantenimiento Casino Santa Fe · Este correo es automático.
          </p>
        </div>
      </div>
    `;
  } else if (estado === "tecnico") {
    // Etapa 2: Reparada. Avisar solo a Juego
    destinatarios = EMAILS_JUEGO;
    asunto = `🔧 REPARADA (Pte Control): Máquina ${record.e_maquina} (Isla ${record.e_isla})`;
    
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #f0a500; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #f0a500; color: white; padding: 15px; font-size: 18px; font-weight: bold; text-align: center;">
          Máquina Reparada por Técnico (Paso 2)
        </div>
        <div style="padding: 20px; background-color: #fafafa; color: #333;">
          <p>La máquina ha sido reparada y queda a la espera del control de inspectores:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 40%;">Máquina:</td><td style="padding: 6px;">${record.e_maquina}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Isla:</td><td style="padding: 6px;">${record.e_isla}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Técnico:</td><td style="padding: 6px;">${record.t_tecnico}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Solución Aplicada:</td><td style="padding: 6px;">${record.t_solucion}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Informe Técnico:</td><td style="padding: 6px; font-style: italic;">${record.t_informe || 'Sin comentarios'}</td></tr>
          </table>
          <p style="margin-top: 20px; font-size: 11px; color: #777; text-align: center;">
            Mantenimiento Casino Santa Fe · Pendiente de auditoría del Inspector para reingreso.
          </p>
        </div>
      </div>
    `;
  } else if (estado === "completo") {
    // Etapa 3: Reingreso en Servicio. Avisar solo a Juego
    destinatarios = EMAILS_JUEGO;
    asunto = `✅ REINGRESO EN SERVICIO: Máquina ${record.e_maquina} (Isla ${record.e_isla})`;
    
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #28a745; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #28a745; color: white; padding: 15px; font-size: 18px; font-weight: bold; text-align: center;">
          Máquina Reingresada en Servicio (Paso 3)
        </div>
        <div style="padding: 20px; background-color: #fafafa; color: #333;">
          <p>¡La máquina ha superado el control de auditoría satisfactoriamente y ya está operativa en sala!</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 40%;">Máquina:</td><td style="padding: 6px;">${record.e_maquina}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Isla:</td><td style="padding: 6px;">${record.e_isla}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Inspector Auditor:</td><td style="padding: 6px;">${record.i_inspector}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Informe de Auditoría:</td><td style="padding: 6px; font-style: italic;">${record.i_informe || 'Control Exitoso'}</td></tr>
          </table>
          <p style="margin-top: 20px; font-weight: bold; color: #28a745; text-align: center; font-size: 14px;">
            Habilitada al 100% para el público.
          </p>
        </div>
      </div>
    `;
  }
  
  if (destinatarios) {
    try {
      MailApp.sendEmail({
        to: destinatarios,
        subject: asunto,
        htmlBody: htmlBody
      });
    } catch (e) {
      Logger.log("Error al enviar email: " + e.toString());
    }
  }
}

function consultarMiLimiteDeCorreos() {
  var correosRestantes = MailApp.getRemainingDailyQuota();
  Logger.log("Correos que puedo enviar hoy todavía: " + correosRestantes);
}

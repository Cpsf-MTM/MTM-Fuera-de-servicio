// ==========================================
// CASINO SANTA FE - WEBHOOK DE NOTIFICACIONES POR CORREO
// Servicio Exclusivo de Correo Oficial (Firebase Firestore es la Base de Datos)
// NO guarda en planillas para evitar duplicaciones y desincronizaciones
// ==========================================

// ==========================================
// CONFIGURACIÓN DE CORREOS OFICIALES
// ==========================================
const EMAILS_TECNICOS = "Tecnicos.SF@casinostafe.com.ar"; // Lista o casilla de técnicos
const EMAILS_JUEGO = "vanina.anzotegui@casinostafe.com.ar,david.humoller@casinostafe.com.ar,pablo.gomez@casinostafe.com.ar,matias.girsa@casinostafe.com.ar,cristian.graglia@casinostafe.com.ar,crysthian.pons@casinostafe.com.ar,erica.vazquez@casinostafe.com.ar,luis.ortega@casinostafe.com.ar,alejandro.rey@casinostafe.com.ar,andrea.lana@casinostafe.com.ar,vanesa.lopez@casinostafe.com.ar";

// ==========================================
// FUNCIÓN PARA PROBAR DIRECTAMENTE DESDE EL EDITOR DE APPS SCRIPT
// (Selecciona esta función en el menú desplegable arriba y haz clic en "▷ Ejecutar" para autorizar los permisos de correo de Google)
// ==========================================
function probarEnvioDirecto() {
  const miCorreo = Session.getActiveUser().getEmail() || EMAILS_TECNICOS;
  Logger.log("Enviando correo de prueba a: " + miCorreo);
  MailApp.sendEmail({
    to: miCorreo,
    subject: "🧪 PRUEBA EXITOSA: Permisos de Correo Autorizados - Casino Santa Fe",
    htmlBody: '<div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 2px solid #c8a84b; border-radius: 8px; font-size: 14px;">' +
              '<h2 style="color: #2e7d32; margin-top: 0;">✓ ¡Permisos de correo autorizados con éxito!</h2>' +
              '<p>Tu cuenta de Google ha concedido autorización para despachar las alertas de mantenimiento del Casino Santa Fe.</p>' +
              '<p><strong>Hora:</strong> ' + new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) + ' hs</p>' +
              '<p style="color: #666; font-size: 12px; margin-bottom: 0;">Servicio de Notificaciones · Casino Santa Fe</p>' +
              '</div>'
  });
  Logger.log("✓ ¡Correo de prueba enviado con éxito a: " + miCorreo + "!");
}

// Responde a peticiones GET (para verificar conectividad directa desde la App)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "Casino Santa Fe - Servicio de Correo Oficial",
    database: "Firebase Firestore (Exclusiva)",
    emailsConfigurados: {
      tecnicos: EMAILS_TECNICOS,
      juegoCount: EMAILS_JUEGO.split(",").length
    },
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// Responde a peticiones POST para enviar alertas inmediatas por correo
function doPost(e) {
  try {
    let requestData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        requestData = {};
      }
    }
    
    const action = requestData.action || "sendAlertEmail";
    
    // Extraer registro sin importar si viene plano o anidado en 'record' o 'data'
    let dataRecord = requestData.record || requestData.data || requestData;
    if (dataRecord && typeof dataRecord === "object") {
      if (dataRecord.record && typeof dataRecord.record === "object") {
        dataRecord = Object.assign({}, dataRecord, dataRecord.record);
      }
      if (dataRecord.data && typeof dataRecord.data === "object") {
        dataRecord = Object.assign({}, dataRecord, dataRecord.data);
      }
    }
    
    const estado = requestData.estado || (dataRecord && dataRecord.estado) || (action === "save" ? "egreso" : "egreso");
    
    // Si la acción es enviar alerta por correo (o compatibilidad con save/update)
    if (action === "sendAlertEmail" || action === "save" || action === "update") {
      enviarAlertaEmail(estado, dataRecord);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        emailSent: true,
        message: "Notificación de correo enviada exitosamente por Apps Script."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Verificación de conectividad
    if (action === "test") {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Conexión a Webhook de Correo exitosa."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Envío de correo de prueba para verificar funcionamiento
    if (action === "sendTestEmail") {
      const targetMail = (dataRecord && dataRecord.recipient) ? dataRecord.recipient : EMAILS_TECNICOS;
      const horaStr = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
      MailApp.sendEmail({
        to: targetMail,
        subject: "🧪 PRUEBA EXITOSA: Webhook de Correo Casino Santa Fe",
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; border: 2px solid #c8a84b; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background-color: #1f1f38; color: #f0d882; padding: 15px; font-size: 18px; font-weight: bold; text-align: center;">
              ✓ Verificación de Notificaciones por Correo
            </div>
            <div style="padding: 20px; background-color: #fafafa; color: #333;">
              <p>Hola,</p>
              <p>Este es un correo de prueba generado desde el <strong>Sistema de Gestión de Máquinas del Casino Santa Fe</strong>.</p>
              <div style="background-color: #e8f5e9; border: 1px solid #4caf50; padding: 12px; border-radius: 6px; margin: 15px 0;">
                <strong style="color: #2e7d32;">✓ Estado del Servicio: OPERATIVO</strong><br>
                <span>El webhook de Apps Script está configurado correctamente en modo <strong>Mailer Exclusivo</strong> y despacha correos sin interactuar con planillas de Google Sheets.</span>
              </div>
              <p style="font-size: 12px; color: #666;">
                Hora del servidor: ${horaStr} hs<br>
                Base de datos activa: Firebase Firestore
              </p>
            </div>
          </div>
        `
      });
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        emailSent: true,
        message: "Correo de prueba enviado con éxito a: " + targetMail
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Operación recibida."
    })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    Logger.log("Error en doPost: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// FUNCIÓN AUXILIAR DE ENVÍO DE EMAIL HTML OFICIAL
// ==========================================
function enviarAlertaEmail(estado, rawRecord) {
  const record = rawRecord || {};
  let destinatarios = "";
  let asunto = "";
  let htmlBody = "";
  
  const fechaFormateada = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  
  const maquina = record.e_maquina || (record.egreso && record.egreso.maquina) || record.maquina || "-";
  const isla = record.e_isla || (record.egreso && record.egreso.isla) || record.isla || "-";
  const motivo = record.e_motivo || (record.egreso && record.egreso.motivo) || record.motivo || "Revisión técnica";
  const operador = record.e_operador || (record.egreso && record.egreso.operador) || record.operador || "Operador de turno";
  const fecha = record.e_fecha || (record.egreso && record.egreso.fecha) || record.fecha || fechaFormateada;
  
  const tecnico = record.t_tecnico || (record.tecnico && record.tecnico.tecnico) || record.tecnico || "Técnico de Turno";
  const solucion = record.t_solucion || (record.tecnico && record.tecnico.solucion) || record.solucion || "Intervención técnica general";
  const informeTecnico = record.t_informe || (record.tecnico && record.tecnico.informe) || "";
  
  const inspector = record.i_inspector || (record.inspector && record.inspector.inspector) || record.inspector || "Inspector Auditor";
  const informeInspector = record.i_informe || (record.inspector && record.inspector.informe) || "Control Satisfactorio";
  
  if (estado === "egreso") {
    // Etapa 1: Avisar a Técnicos y Juego
    destinatarios = EMAILS_TECNICOS + "," + EMAILS_JUEGO;
    asunto = `🚨 FUERA DE SERVICIO: Máquina ${maquina} (Isla ${isla})`;
    
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #ff4444; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #ff4444; color: white; padding: 15px; font-size: 18px; font-weight: bold; text-align: center;">
          Máquina Fuera de Servicio (Paso 1)
        </div>
        <div style="padding: 20px; background-color: #fafafa; color: #333;">
          <p>Se ha registrado un retiro de servicio para la siguiente máquina:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 40%;">Máquina:</td><td style="padding: 6px;">${maquina}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Isla:</td><td style="padding: 6px;">${isla}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Fecha/Hora:</td><td style="padding: 6px;">${fecha} hs</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Motivo Falla:</td><td style="padding: 6px; color: #cc0000; font-weight: bold;">${motivo}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Operador Inspector:</td><td style="padding: 6px;">${operador}</td></tr>
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
    asunto = `🔧 REPARADA (Pte Control): Máquina ${maquina} (Isla ${isla})`;
    
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #f0a500; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #f0a500; color: white; padding: 15px; font-size: 18px; font-weight: bold; text-align: center;">
          Máquina Reparada por Técnico (Paso 2)
        </div>
        <div style="padding: 20px; background-color: #fafafa; color: #333;">
          <p>La máquina ha sido reparada y queda a la espera del control de inspectores:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 40%;">Máquina:</td><td style="padding: 6px;">${maquina}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Isla:</td><td style="padding: 6px;">${isla}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Técnico:</td><td style="padding: 6px;">${tecnico}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Solución Aplicada:</td><td style="padding: 6px;">${solucion}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Informe Técnico:</td><td style="padding: 6px; font-style: italic;">${informeTecnico || 'Sin comentarios'}</td></tr>
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
    asunto = `✅ REINGRESO EN SERVICIO: Máquina ${maquina} (Isla ${isla})`;
    
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #28a745; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #28a745; color: white; padding: 15px; font-size: 18px; font-weight: bold; text-align: center;">
          Máquina Reingresada en Servicio (Paso 3)
        </div>
        <div style="padding: 20px; background-color: #fafafa; color: #333;">
          <p>¡La máquina ha superado el control de auditoría satisfactoriamente y ya está operativa en sala!</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 40%;">Máquina:</td><td style="padding: 6px;">${maquina}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Isla:</td><td style="padding: 6px;">${isla}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Inspector Auditor:</td><td style="padding: 6px;">${inspector}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Informe de Auditoría:</td><td style="padding: 6px; font-style: italic;">${informeInspector || 'Control Exitoso'}</td></tr>
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
      Logger.log("✓ Correo enviado con éxito a: " + destinatarios + " | Asunto: " + asunto);
    } catch (e) {
      Logger.log("❌ Error al enviar email: " + e.toString());
    }
  }
}

function consultarMiLimiteDeCorreos() {
  var correosRestantes = MailApp.getRemainingDailyQuota();
  Logger.log("Correos que puedo enviar hoy todavía: " + correosRestantes);
}

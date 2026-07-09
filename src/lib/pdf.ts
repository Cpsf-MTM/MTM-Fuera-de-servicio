import { jsPDF } from 'jspdf';
import { MaintenanceRecord } from '../types';

export function formatFecha(f: string): string {
  if (!f) return '-';
  try {
    return new Date(f).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return f;
  }
}

export function formatPesos(v: string | number): string {
  if (!v) return '-';
  const cleanVal = String(v).replace('$', '').trim();
  if (isNaN(Number(cleanVal))) return String(v);
  return '$ ' + Number(cleanVal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generarPDF(r: MaintenanceRecord) {
  if (!r) return;
  
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const mg = 14;
  let y = 20;

  // Helpers
  const txt = (t: string, x: number, yy: number, sz = 10, st = 'normal', col = [40, 40, 40]) => {
    doc.setFontSize(sz);
    doc.setFont('helvetica', st);
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(t, x, yy);
  };

  const hLine = (yy: number, c = [200, 200, 200]) => {
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.line(mg, yy, W - mg, yy);
  };

  const secHead = (title: string, yy: number, col = [30, 30, 80]) => {
    doc.setFillColor(col[0], col[1], col[2]);
    doc.rect(mg, yy - 5, W - mg * 2, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, mg + 3, yy + 0.5);
    return yy + 8;
  };

  const kv = (label: string, value: string, x1: number, x2: number, yy: number) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(label + ':', x1, yy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(String(value || '-'), x2, yy);
  };

  // Header Banner
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, W, 22, 'F');
  txt('ACTA DE MANTENIMIENTO CORRECTIVO', mg, 10, 13, 'bold', [200, 168, 75]);
  txt('CASINO SANTA FE — GESTIÓN DE MÁQUINAS', mg, 17, 9, 'normal', [180, 180, 200]);
  txt('ID: ' + r.id, W - mg - 48, 10, 8, 'normal', [180, 180, 200]);
  txt('Generado: ' + new Date().toLocaleString('es-AR'), W - mg - 48, 17, 8, 'normal', [180, 180, 200]);
  
  y = 30;

  // ETAPA 1 — EGRESO DE MÁQUINA
  y = secHead('  ETAPA 1 — EGRESO DE MÁQUINA', y, [30, 60, 120]);
  y += 6;
  
  kv('N° Máquina', r.egreso.maquina, mg, mg + 28, y);
  kv('N° Isla', r.egreso.isla, 90, 110, y);
  kv('Fecha/Hora', formatFecha(r.egreso.fecha), 130, 152, y);
  y += 7;
  
  kv('Motivo', r.egreso.motivo, mg, mg + 28, y);
  kv('Operador', r.egreso.operador, 90, 110, y);
  y += 7;
  
  kv('COIN IN', formatPesos(r.egreso.coinin), mg, mg + 28, y);
  kv('COIN OUT', formatPesos(r.egreso.coinout), 70, 95, y);
  kv('Jackpot', formatPesos(r.egreso.jackpot), 130, 148, y);
  y += 7;
  
  kv('Prog. 1', formatPesos(r.egreso.prog1), mg, mg + 22, y);
  kv('Prog. 2', formatPesos(r.egreso.prog2), 60, 82, y);
  kv('Prog. 3', formatPesos(r.egreso.prog3), 110, 130, y);
  kv('Prog. 4', formatPesos(r.egreso.prog4), 152, 170, y);
  y += 7;
  
  kv('% Devolución', r.egreso.devolucion || '-', mg, mg + 28, y);
  y += 10;
  
  // Signature Op
  if (r.egreso.firma) {
    txt('Firma Operador:', mg, y, 8, 'bold', [80, 80, 80]);
    try {
      doc.addImage(r.egreso.firma, 'PNG', mg, y + 2, 50, 15);
    } catch (e) {
      console.error('Error rendering operator signature in PDF:', e);
    }
    y += 20;
  }
  
  // Image Rendering (Etapa 1)
  if (r.egreso.foto) {
    if (y > 200) {
      doc.addPage();
      y = 20;
    }
    txt('Foto Adjunta de la Máquina / Falla:', mg, y, 8, 'bold', [80, 80, 80]);
    y += 4;
    try {
      const fotoW = 70;
      const fotoH = 50;
      doc.addImage(r.egreso.foto, 'JPEG', mg, y, fotoW, fotoH);
      y += fotoH + 6;
    } catch (e) {
      console.error('Error rendering operator photo in PDF:', e);
    }
  }

  // Divider
  hLine(y, [180, 180, 200]);
  y += 8;

  // ETAPA 2 — REPARACIÓN TÉCNICA
  if (r.tecnico) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }
    y = secHead('  ETAPA 2 — REPARACIÓN TÉCNICA', y, [30, 90, 60]);
    y += 6;
    
    kv('N° Informe', r.tecnico.informe || 'S/N', mg, mg + 25, y);
    kv('Técnico', r.tecnico.tecnico, 75, 95, y);
    kv('Fecha/Hora', formatFecha(r.tecnico.fecha), 140, 160, y);
    y += 8;
    
    txt('Solución aplicada:', mg, y, 9, 'bold', [80, 80, 80]);
    y += 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(r.tecnico.solucion, W - mg * 2);
    doc.text(lines, mg, y);
    y += lines.length * 5 + 4;
    
    if (r.tecnico.firma) {
      txt('Firma Técnico:', mg, y, 8, 'bold', [80, 80, 80]);
      try {
        doc.addImage(r.tecnico.firma, 'PNG', mg, y + 2, 50, 15);
      } catch (e) {
        console.error('Error rendering technician signature in PDF:', e);
      }
      y += 20;
    }
    
    hLine(y, [180, 180, 200]);
    y += 8;
  }

  // ETAPA 3 — INSPECCIÓN Y REINGRESO
  if (r.inspector) {
    if (y > 180) {
      doc.addPage();
      y = 20;
    }
    y = secHead('  ETAPA 3 — INSPECCIÓN Y REINGRESO', y, [100, 30, 30]);
    y += 6;
    
    kv('Inspector', r.inspector.inspector, mg, mg + 22, y);
    kv('Fecha/Hora', formatFecha(r.inspector.fecha), 90, 110, y);
    kv('COIN IN', formatPesos(r.inspector.coinin), 145, 162, y);
    y += 7;
    
    // Config box
    doc.setFillColor(245, 240, 220);
    doc.rect(mg, y - 4, W - mg * 2, 28, 'F');
    doc.setDrawColor(200, 168, 75);
    doc.rect(mg, y - 4, W - mg * 2, 28, 'S');
    
    txt('VERIFICACIÓN DE CONFIGURACIÓN', mg + 3, y + 1, 8, 'bold', [120, 90, 10]);
    y += 7;
    kv('% Devolución', r.inspector.devolucion || '-', mg + 3, mg + 28, y);
    kv('Denominación', r.inspector.denominacion || '-', 80, 105, y);
    y += 6;
    kv('Apuesta Mín.', formatPesos(r.inspector.apuestaMin), mg + 3, mg + 28, y);
    kv('Apuesta Máx.', formatPesos(r.inspector.apuestaMax), 80, 105, y);
    kv('N° MDC', r.inspector.mdc || '-', 140, 155, y);
    y += 14;
    
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    txt('Control de billetes aceptados:', mg, y, 9, 'bold', [80, 80, 80]);
    y += 5;
    
    const midX = (W - mg * 2) / 2 + mg;
    let ci = 0;
    const billetes = ['$20.000', '$10.000', '$2.000', '$1.000', '$500', '$200', '$100'];
    
    billetes.forEach((b) => {
      const st = r.inspector?.checksBilletes[b] || 'S/D';
      const x = ci % 2 === 0 ? mg : midX;
      const col = st === 'ok' ? [0, 120, 60] : st === 'fail' ? [180, 30, 30] : [120, 120, 120];
      const label = st === 'ok' ? '✓ OK' : st === 'fail' ? '✗ FALLA' : 'S/D';
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(b + ':', x, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(col[0], col[1], col[2]);
      doc.text(label, x + 25, y);
      
      if (ci % 2 === 1) y += 5;
      ci++;
    });
    
    if (ci % 2 === 1) y += 5;
    y += 4;
    
    txt('Controles adicionales:', mg, y, 9, 'bold', [80, 80, 80]);
    y += 5;
    
    const extras = ['Descuento AFT correcto', 'Acredita tickets correctamente'];
    extras.forEach((ex) => {
      const st = r.inspector?.checksExtras[ex] || 'S/D';
      const col = st === 'ok' ? [0, 120, 60] : st === 'fail' ? [180, 30, 30] : [120, 120, 120];
      const label = st === 'ok' ? '✓ OK' : st === 'fail' ? '✗ FALLA' : 'S/D';
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(ex + ':', mg, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(col[0], col[1], col[2]);
      doc.text(label, mg + 70, y);
      y += 5;
    });
    
    y += 4;
    
    if (r.inspector.firma) {
      txt('Firma Inspector:', mg, y, 8, 'bold', [80, 80, 80]);
      try {
        doc.addImage(r.inspector.firma, 'PNG', mg, y + 2, 50, 15);
      } catch (e) {
        console.error('Error rendering inspector signature in PDF:', e);
      }
      y += 20;
    }
    
    y += 6;
    hLine(y, [200, 168, 75]);
    y += 5;
    txt('MÁQUINA REINGRESADA AL SERVICIO — PROCESO COMPLETADO Y CERRADO', mg, y, 9, 'bold', [26, 26, 46]);
  }

  doc.save(`Acta_Mantenimiento_Maquina_${r.egreso.maquina}_Isla_${r.egreso.isla}.pdf`);
}

export function generarPDFResumenFueraDeServicio(records: MaintenanceRecord[]) {
  const oosRecords = records.filter(r => r.estado !== 'completo');
  
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const mg = 14;
  let y = 20;

  const txt = (t: string, x: number, yy: number, sz = 10, st = 'normal', col = [40, 40, 40]) => {
    doc.setFontSize(sz);
    doc.setFont('helvetica', st);
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(t, x, yy);
  };

  const hLine = (yy: number, c = [200, 200, 200]) => {
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.line(mg, yy, W - mg, yy);
  };

  // Header Banner
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, W, 22, 'F');
  txt('REPORTE DE MÁQUINAS FUERA DE SERVICIO', mg, 10, 13, 'bold', [200, 168, 75]);
  txt('CASINO SANTA FE — SALA DE JUEGO', mg, 17, 9, 'normal', [180, 180, 200]);
  txt('Fecha: ' + new Date().toLocaleString('es-AR'), W - mg - 48, 10, 8, 'normal', [180, 180, 200]);
  txt('Total: ' + oosRecords.length + ' máq.', W - mg - 48, 17, 8, 'normal', [180, 180, 200]);

  y = 32;

  // Resumen Estadístico
  const enEgreso = oosRecords.filter(r => r.estado === 'egreso').length;
  const enTecnico = oosRecords.filter(r => r.estado === 'tecnico').length;

  doc.setFillColor(245, 245, 250);
  doc.rect(mg, y, W - mg * 2, 16, 'F');
  doc.setDrawColor(210, 210, 220);
  doc.rect(mg, y, W - mg * 2, 16, 'S');

  txt('RESUMEN DE SALA:', mg + 5, y + 6, 9.5, 'bold', [30, 30, 60]);
  txt(`• TOTAL INACTIVAS: ${oosRecords.length}`, mg + 45, y + 6, 9, 'bold', [30, 30, 30]);
  txt(`• SOLO FUERA DE SERVICIO (ETAPA 1): ${enEgreso}`, mg + 45, y + 11, 8.5, 'normal', [180, 30, 30]);
  txt(`• REPARADAS EN CONTROL (ETAPA 2): ${enTecnico}`, mg + 115, y + 11, 8.5, 'normal', [180, 110, 0]);

  y += 24;

  // Headers de la Tabla
  doc.setFillColor(30, 60, 120);
  doc.rect(mg, y, W - mg * 2, 7, 'F');
  
  txt('MÁQUINA', mg + 2, y + 5, 8.5, 'bold', [255, 255, 255]);
  txt('ISLA', mg + 22, y + 5, 8.5, 'bold', [255, 255, 255]);
  txt('FECHA EGRESO', mg + 40, y + 5, 8.5, 'bold', [255, 255, 255]);
  txt('MOTIVO DE EGRESO', mg + 75, y + 5, 8.5, 'bold', [255, 255, 255]);
  txt('ESTADO ACTUAL', mg + 145, y + 5, 8.5, 'bold', [255, 255, 255]);

  y += 7;

  if (oosRecords.length === 0) {
    txt('No hay máquinas fuera de servicio actualmente. ¡Sala 100% operativa!', mg + 5, y + 10, 10, 'italic', [40, 120, 40]);
  } else {
    oosRecords.forEach((r, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        
        // Repetir cabecera de tabla si hay nueva página
        doc.setFillColor(30, 60, 120);
        doc.rect(mg, y, W - mg * 2, 7, 'F');
        txt('MÁQUINA', mg + 2, y + 5, 8.5, 'bold', [255, 255, 255]);
        txt('ISLA', mg + 22, y + 5, 8.5, 'bold', [255, 255, 255]);
        txt('FECHA EGRESO', mg + 40, y + 5, 8.5, 'bold', [255, 255, 255]);
        txt('MOTIVO DE EGRESO', mg + 75, y + 5, 8.5, 'bold', [255, 255, 255]);
        txt('ESTADO ACTUAL', mg + 145, y + 5, 8.5, 'bold', [255, 255, 255]);
        y += 7;
      }

      // Línea de fondo cebra
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 252);
        doc.rect(mg, y, W - mg * 2, 8, 'F');
      }

      // Dibujar borde inferior de celda
      hLine(y + 8, [235, 235, 240]);

      txt(r.egreso.maquina, mg + 2, y + 5.5, 9, 'bold', [30, 30, 30]);
      txt(r.egreso.isla, mg + 22, y + 5.5, 9, 'normal', [50, 50, 50]);
      txt(formatFecha(r.egreso.fecha).split(',')[0], mg + 40, y + 5.5, 8.5, 'normal', [50, 50, 50]);
      
      const motivoText = r.egreso.motivo || 'Falla';
      txt(motivoText, mg + 75, y + 5.5, 8.5, 'normal', [50, 50, 50]);

      const stateText = r.estado === 'egreso' ? 'F. de Serv (Etapa 1)' : 'Reparada (Etapa 2)';
      const stateCol = r.estado === 'egreso' ? [180, 30, 30] : [180, 110, 0];
      txt(stateText, mg + 145, y + 5.5, 8, 'bold', stateCol);

      y += 8;
    });
  }

  // Footer
  txt('Fin del reporte oficial · Mantenimiento Casino Santa Fe', mg, 285, 7.5, 'normal', [140, 140, 150]);

  doc.save(`Reporte_Maquinas_Fuera_de_Servicio_${new Date().toISOString().split('T')[0]}.pdf`);
}

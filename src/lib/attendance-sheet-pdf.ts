/** The attendance sheet as an A4 PDF: names in rows, trainings in columns, a box to sign. */
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PAGE, sheetLayout } from '@/lib/attendance-sheet';

export interface SheetPdfInput {
  teamName: string; season?: string | null; code: string;
  players: { name: string; number?: number | null }[];
  sessions: { date: string }[];
  crest?: { dataUrl: string; ratio: number } | null;
}

export function buildAttendanceSheetPdf(s: SheetPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = sheetLayout(s.players.length, s.sessions.length);
  const t = L.table;

  // header, as on the club's own sheet
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(s.season ? `Época ${s.season}` : 'Folha de Presenças', PAGE.w / 2, 18, { align: 'center' });
  doc.setFontSize(13);
  doc.text(s.season ? 'Folha de Presenças' : '', PAGE.w / 2, 26, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(71, 85, 105);
  doc.text(s.teamName, PAGE.w / 2, 33, { align: 'center' });
  if (s.crest) { const h = 20, w = Math.min(h * s.crest.ratio, 26); doc.addImage(s.crest.dataUrl, 'PNG', 14, 8, w, w / s.crest.ratio); }
  doc.setFont('courier', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
  doc.text(`Folha ${s.code}`, PAGE.w - 14, 14, { align: 'right' });

  // the four corner marks (bottom-right hollow: tells the reader which way up the photo is)
  doc.setFillColor(0, 0, 0);
  L.marks.forEach(([x, y], i) => {
    const h = L.markSize / 2;
    doc.rect(x - h, y - h, L.markSize, L.markSize, 'F');
    if (i === 2) { doc.setFillColor(255, 255, 255); doc.rect(x - h * 0.6, y - h * 0.6, L.markSize * 0.6, L.markSize * 0.6, 'F'); doc.setFillColor(0, 0, 0); }
  });

  // column titles
  doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.35);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
  doc.text('Nome', t.x + 2, t.y + L.header.h / 2 + 1.5);
  s.sessions.slice(0, L.cols).forEach((ses, c) => {
    const x = t.x + L.nameW + c * L.colW + L.colW / 2, d = new Date(ses.date);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
    doc.text(format(d, 'EEE', { locale: pt }).replace('.', ''), x, t.y + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
    doc.text(format(d, 'dd/MM'), x, t.y + 8.4, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(format(d, 'HH:mm'), x, t.y + 11.6, { align: 'center' });
  });

  // rows: uniform height, nothing printed inside the boxes
  const nameSize = Math.min(11, Math.max(7.5, L.rowH * 1.45));
  s.players.slice(0, L.rows).forEach((p, r) => {
    const y = t.y + L.header.h + r * L.rowH;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(nameSize); doc.setTextColor(15, 23, 42);
    const label = `${p.number != null ? `${p.number}  ` : ''}${p.name}`;
    doc.text(doc.splitTextToSize(label, L.nameW - 3)[0], t.x + 2, y + L.rowH / 2 + nameSize * 0.13);
  });
  // grid
  doc.rect(t.x, t.y, t.w, t.h);
  for (let r = 0; r <= L.rows; r++) doc.line(t.x, t.y + L.header.h + r * L.rowH, t.x + t.w, t.y + L.header.h + r * L.rowH);
  for (let c = 0; c <= L.cols; c++) doc.line(t.x + L.nameW + c * L.colW, t.y, t.x + L.nameW + c * L.colW, t.y + t.h);

  // footer
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
  const foot = L.marks[2][1] + L.markSize / 2 + 6;
  doc.text('Cada jogador assina dentro do quadrado do dia. Não escrever sobre os quadrados pretos dos cantos.', PAGE.w / 2, foot, { align: 'center' });
  doc.text(`Depois: TreinON > Treinos > Presenças > Ler folha assinada (fotografia) · Folha ${s.code}`, PAGE.w / 2, foot + 4.5, { align: 'center' });
  return doc;
}

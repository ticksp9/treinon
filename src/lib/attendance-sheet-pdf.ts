/** The attendance sheet as an A4 PDF: names in rows, trainings in columns, a box to sign. */
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { dateLocale, inPdfLanguage, tx } from '@/lib/i18n/ui';
import { NAME_COLUMN, PAGE, sheetLayout, type SheetGeometry } from '@/lib/attendance-sheet';

export interface SheetPdfInput {
  teamName: string; season?: string | null; code: string;
  players: { name: string; number?: number | null }[];
  sessions: { date: string }[];
  crest?: { dataUrl: string; ratio: number } | null;
}

/** The name column only as wide as the longest name: the rest of the width is for signing. */
export function sheetGeometryFor(players: { name: string; number?: number | null }[]): Required<SheetGeometry> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const widest = Math.max(0, ...players.map((p) => doc.getTextWidth(`${p.number != null ? `${p.number}  ` : ''}${p.name}`)));
  return { version: 2, nameW: Math.round(Math.min(NAME_COLUMN.max, Math.max(NAME_COLUMN.min, widest + 4)) * 10) / 10 };
}

export function buildAttendanceSheetPdf(s: SheetPdfInput & { geometry?: SheetGeometry }): jsPDF {
  return inPdfLanguage(() => buildSheet(s));
}

function buildSheet(s: SheetPdfInput & { geometry?: SheetGeometry }): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = sheetLayout(s.players.length, s.sessions.length, s.geometry ?? sheetGeometryFor(s.players));
  const t = L.table;

  // header, as on the club's own sheet
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  const top = L.table.y >= 50 ? 0 : -6;
  doc.text(s.season ? tx('Época {{name}}', { name: s.season }) : tx('Folha de Presenças'), PAGE.w / 2, 18 + top / 2, { align: 'center' });
  doc.setFontSize(13);
  doc.text(s.season ? tx('Folha de Presenças') : '', PAGE.w / 2, 25 + top / 2, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(71, 85, 105);
  doc.text(s.teamName, PAGE.w / 2, 31 + top / 2, { align: 'center' });
  if (s.crest) { const h = 18, w = Math.min(h * s.crest.ratio, 24); doc.addImage(s.crest.dataUrl, 'PNG', 14, 6, w, w / s.crest.ratio); }
  doc.setFont('courier', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
  doc.text(tx('Folha {{code}}', { code: s.code }), PAGE.w - 14, 14, { align: 'right' });

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
  doc.text(tx('Nome'), t.x + 2, t.y + L.header.h / 2 + 1.5);
  s.sessions.slice(0, L.cols).forEach((ses, c) => {
    const x = t.x + L.nameW + c * L.colW + L.colW / 2, d = new Date(ses.date);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
    doc.text(format(d, 'EEE', { locale: dateLocale() }).replace('.', ''), x, t.y + L.header.h * 0.3, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
    doc.text(format(d, 'dd/MM'), x, t.y + L.header.h * 0.63, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(format(d, 'HH:mm'), x, t.y + L.header.h * 0.88, { align: 'center' });
  });

  // rows: uniform height, nothing printed inside the boxes
  const nameSize = Math.min(10, Math.max(7.5, L.rowH * 1.35));
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
  doc.text(tx('Cada jogador assina dentro do quadrado do dia. Não escrever sobre os quadrados pretos dos cantos.'), PAGE.w / 2, foot, { align: 'center' });
  doc.text(tx('Depois: TreinON > Treinos > Presenças > Ler folha assinada (fotografia) · Folha {{code}}', { code: s.code }), PAGE.w / 2, foot + 4.5, { align: 'center' });
  return doc;
}

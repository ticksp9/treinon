/**
 * The call-up as a one-page A4 PDF: to print, or to send to the coordinator.
 * Players go in two columns, grouped by sector; the size of the letters shrinks with the
 * number of players so the sheet never spills onto a second page.
 */
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { deliverPdf, isNativeApp } from '@/lib/native-files';
import { dateLocale, isEnglish, tx } from '@/lib/i18n/ui';

export interface CallupPlayer { name: string; number: number | null; position: string | null }
export interface CallupGroup { label: string; players: CallupPlayer[] }
export interface CallupSheet {
  teamName: string; category?: string | null;
  opponent: string; matchDate: string; isHome: boolean; location?: string | null;
  competition?: string | null; arrivalTime?: string | null; parts?: number[] | null;
  groups: CallupGroup[];
  /** the team's crest, read beforehand (PNG data URL) */
  crest?: { dataUrl: string; ratio: number } | null;
}

/** "15' + 15' + 30' (60')" */
export const partsText = (parts?: number[] | null) =>
  parts && parts.length ? `${parts.map((m) => `${m}'`).join(' + ')} (${parts.reduce((a, b) => a + b, 0)}')` : null;

/** Lines the player columns need: one per player plus a title per group, split in two columns. */
export function callupLayout(groups: CallupGroup[]) {
  const used = groups.filter((g) => g.players.length > 0);
  const rows = used.reduce((n, g) => n + g.players.length + 1, 0);
  // fill the left column first, never splitting a group's title from its first player
  let left = 0, acc = 0;
  for (const g of used) { if (acc + g.players.length + 1 > Math.ceil(rows / 2) && acc > 0) break; acc += g.players.length + 1; left++; }
  const perColumn = Math.max(acc, rows - acc);
  // the room for the players on an A4 page (mm), after the header and before the footer
  const room = 170;
  const lineHeight = Math.min(9, Math.max(5, room / Math.max(perColumn, 1)));
  return { columns: [used.slice(0, left), used.slice(left)], lineHeight, fontSize: Math.min(12, Math.max(8, lineHeight * 1.45)) };
}

export const callupFileName = (s: Pick<CallupSheet, 'teamName' | 'opponent' | 'matchDate'>) =>
  `${isEnglish() ? 'call-up' : 'convocatoria'}-${s.teamName}-vs-${s.opponent}-${format(new Date(s.matchDate), 'yyyy-MM-dd')}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf';

export function buildCallupPdf(s: CallupSheet): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 15;
  const total = s.groups.reduce((n, g) => n + g.players.length, 0);

  // header band
  doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(tx('CONVOCATÓRIA'), M, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
  doc.text(`${s.teamName}${s.category ? ` (${s.category})` : ''}`, M, 21);
  doc.setFillColor(249, 115, 22); doc.rect(0, 28, W, 1.5, 'F');
  if (s.crest) {
    // on a white tile, so any crest reads on the dark band
    const h = 22, w = Math.min(h * s.crest.ratio, 30);
    doc.setFillColor(255, 255, 255); doc.roundedRect(W - M - w - 2, 3, w + 4, h + 1, 2, 2, 'F');
    doc.addImage(s.crest.dataUrl, 'PNG', W - M - w, 3.5, w, w / s.crest.ratio);
  }

  // the match
  const when = new Date(s.matchDate);
  const facts: [string, string][] = [
    [tx('Jogo'), `${s.isHome ? s.teamName : s.opponent} vs ${s.isHome ? s.opponent : s.teamName}`],
    [tx('Data'), format(when, "EEEE, dd/MM/yyyy", { locale: dateLocale() })],
    [tx('Hora do jogo'), format(when, 'HH:mm')],
    ...(s.arrivalTime ? [[tx('No campo às'), s.arrivalTime] as [string, string]] : []),
    [tx('Local'), `${s.location || '—'} (${s.isHome ? tx('casa') : tx('fora')})`],
    [tx('Competição'), s.competition ? tx(s.competition) : tx('Campeonato')],
    ...(partsText(s.parts) ? [[tx('Tempo de jogo'), partsText(s.parts)!] as [string, string]] : []),
  ];
  doc.setTextColor(15, 23, 42);
  let y = 39;
  const fact = (k: string, v: string, x: number, yy: number, width: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(k.toUpperCase(), x, yy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(v, width)[0], x + 32, yy);
  };
  // the match itself across the page (team names can be long), the rest in two columns
  const [first, ...rest] = facts;
  fact(first[0], first[1], M, y, W - 2 * M - 32);
  y += 7;
  const half = Math.ceil(rest.length / 2);
  rest.forEach(([k, v], i) => {
    const left = i < half;
    fact(k, v, left ? M : W / 2 + 2, y + (i % half) * 7, left ? W / 2 - 2 - M - 32 - 3 : W - M - (W / 2 + 2) - 32);
  });
  y += half * 7 + 2;
  doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(tx('Convocados ({{n}})', { n: total }), M, y + 3);
  y += 12;

  // players, two columns
  const { columns, lineHeight, fontSize } = callupLayout(s.groups);
  const colW = (W - 2 * M - 8) / 2;
  columns.forEach((groups, c) => {
    const x = M + c * (colW + 8);
    let yy = y;
    for (const g of groups) {
      doc.setFillColor(241, 245, 249); doc.rect(x, yy - lineHeight * 0.72, colW, lineHeight, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(fontSize * 0.85); doc.setTextColor(71, 85, 105);
      doc.text(`${g.label.toUpperCase()} (${g.players.length})`, x + 2, yy);
      yy += lineHeight;
      for (const p of g.players) {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(fontSize); doc.text(p.number != null ? String(p.number) : '–', x + 9, yy, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(p.name, colW - 30)[0], x + 13, yy);
        if (p.position) { doc.setFontSize(fontSize * 0.8); doc.setTextColor(100, 116, 139); doc.text(p.position, x + colW - 2, yy, { align: 'right' }); }
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(x, yy + lineHeight * 0.3, x + colW, yy + lineHeight * 0.3);
        yy += lineHeight;
      }
    }
  });

  // footer: always at the bottom of the same page
  doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.3); doc.line(W - M - 60, 272, W - M, 272);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
  doc.text(tx('O treinador'), W - M - 30, 277, { align: 'center' });
  doc.setFontSize(8); doc.setTextColor(148, 163, 184);
  doc.text(tx('Total de convocados: {{n}} · Gerado no TreinON em {{when}}', { n: total, when: format(new Date(), 'dd/MM/yyyy HH:mm') }), M, 287);
  return doc;
}

/** Share the PDF where the device can (iPad/phone: WhatsApp, email…), else download it. */
export async function shareOrDownloadPdf(doc: jsPDF, fileName: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (isNativeApp()) { await deliverPdf(doc, fileName, { title }); return 'shared'; }
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], title }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  doc.save(fileName);
  return 'downloaded';
}

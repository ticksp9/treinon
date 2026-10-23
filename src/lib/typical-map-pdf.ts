/** The FPF "mapa-tipo" of the club: each team's weekly sessions, their length and the space used. */
import jsPDF from 'jspdf';
import { deliverPdf } from '@/lib/native-files';
import { inPdfLanguage, longDate, tx } from '@/lib/i18n/ui';
import { SLOT_SPACES, type TypicalRow } from '@/lib/club-map';

export function downloadTypicalMapPdf(clubName: string, rows: TypicalRow[]) {
  return inPdfLanguage(() => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const L = 12, width = W - 24;
    let y = 16;
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(tx('Mapa-tipo de treinos'), L, y); y += 6;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110);
    doc.text(`${clubName} · ${tx('Gerado a {{d}}', { d: longDate(new Date(), 'dateTime') })}`, L, y); y += 8;
    doc.setTextColor(0, 0, 0);

    const widths = [52, 26, 32, 32, 32, width - 174];
    const row = (cells: string[], bold = false) => {
      doc.setFontSize(9); doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lines = cells.map((c, i) => doc.splitTextToSize(c || '—', widths[i] - 2) as string[]);
      const h = Math.max(...lines.map((l) => l.length)) * 4.2 + 1.5;
      if (y + h > H - 14) { doc.addPage(); y = 16; }
      let x = L;
      lines.forEach((l, i) => { doc.text(l, x, y); x += widths[i]; });
      if (bold) { const under = y + h - 3.9; doc.setDrawColor(180, 180, 180); doc.line(L, under, L + width, under); y += 1.5; }
      y += h;
    };
    row([tx('Equipa'), tx('Escalão'), tx('Treinos/semana'), tx('Duração média'), tx('Minutos/semana'), tx('Dias, horas e espaço')], true);
    rows.forEach((r) => row([r.name, r.category ?? '', String(r.sessions), r.sessions ? `${r.avg}'` : '', r.sessions ? `${r.minutes}'` : '', r.days]));

    y += 4;
    doc.setFontSize(8); doc.setTextColor(110, 110, 110);
    const legend = SLOT_SPACES.map((s) => `${s.short} = ${s.label}`).join(' · ');
    doc.text(doc.splitTextToSize(`${legend}. ${tx('Sub-15 a Sub-19: pelo menos um treino por semana em campo inteiro.')}`, width) as string[], L, y);
    const missing = rows.filter((r) => r.needsFullPitch);
    if (missing.length) { y += 8; doc.setTextColor(180, 90, 0); doc.text(tx('Sem treino em campo inteiro: {{teams}}', { teams: missing.map((r) => r.name).join(', ') }), L, y); }
    doc.setTextColor(0, 0, 0);
    return deliverPdf(doc, `mapa_tipo_${clubName.replace(/\s+/g, '_').toLowerCase()}.pdf`, { title: tx('Mapa-tipo de treinos') });
  });
}

/** The club's guiding document as a PDF (to show at the FPF visit or hand to a new coach). */
import jsPDF from 'jspdf';
import { deliverPdf } from '@/lib/native-files';
import { inPdfLanguage, longDate, tx } from '@/lib/i18n/ui';
import { GAME_FORMATS, MODEL_FIELDS, STAGE_FIELDS, TRANSITION_FIELDS, type Guidelines } from '@/lib/guidelines';
import { actionKindLabel, durationLabel, type TrainingAction } from '@/lib/transitions';

export function downloadGuidelinesPdf(clubName: string, g: Guidelines, actions: TrainingAction[] = []) {
  return inPdfLanguage(() => {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const L = 14, width = W - 28;
    let y = 20;
    const space = (n: number) => { if (y + n > H - 16) { doc.addPage(); y = 20; } };
    const text = (s: string, x = L, w = width, size = 10, style: 'normal' | 'bold' = 'normal') => {
      doc.setFontSize(size); doc.setFont('helvetica', style);
      for (const line of doc.splitTextToSize(s, w) as string[]) { space(6); doc.text(line, x, y); y += size * 0.46; }
    };
    const heading = (s: string) => {
      space(16); y += 4;
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 102, 204);
      doc.text(s, L, y); y += 2; doc.setDrawColor(0, 102, 204); doc.line(L, y, W - L, y); y += 7;
      doc.setTextColor(0, 0, 0);
    };
    const field = (label: string, value: string | undefined) => {
      if (!value?.trim()) return;
      space(12); text(label, L, width, 10, 'bold'); text(value, L + 2, width - 2, 10); y += 2;
    };

    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(tx('DOCUMENTO ORIENTADOR'), W / 2, y, { align: 'center' }); y += 8;
    doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text(clubName, W / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(9); doc.setTextColor(110, 110, 110); doc.text(tx('Gerado a {{d}}', { d: longDate(new Date(), 'dateTime') }), W / 2, y, { align: 'center' }); doc.setTextColor(0, 0, 0); y += 6;

    heading(`1. ${tx('Visão e filosofia de formação')}`);
    g.vision?.trim() ? text(g.vision) : text(tx('Por definir.'));

    heading(`2. ${tx('Modelo de jogo')}`);
    let any = false;
    GAME_FORMATS.forEach((f) => {
      const m = g.models?.[f.value];
      if (!m || !Object.values(m).some((v) => v?.trim())) return;
      any = true;
      space(14); text(f.label, L, width, 11, 'bold'); y += 1;
      MODEL_FIELDS.forEach((k) => field(k.label, m[k.key]));
    });
    if (!any) text(tx('Por definir.'));

    heading(`3. ${tx('Etapas de formação')}`);
    if (!g.stages?.length) text(tx('Por definir.'));
    g.stages?.forEach((s) => {
      space(14); text([s.name, s.ages].filter(Boolean).join(' · '), L, width, 11, 'bold'); y += 1;
      STAGE_FIELDS.forEach((f) => field(f.label, s[f.key]));
    });

    heading(`4. ${tx('Como o clube trabalha o modelo')}`);
    g.process?.trim() ? text(g.process) : text(tx('Por definir.'));

    heading(`5. ${tx('Plano de transição')}`);
    if (!TRANSITION_FIELDS.some((f) => g.transition?.[f.key]?.trim())) text(tx('Por definir.'));
    TRANSITION_FIELDS.forEach((f) => field(f.label, g.transition?.[f.key]));

    heading(`6. ${tx('Formação dos treinadores')}`);
    if (!actions.length) text(tx('Sem registos.'));
    actions.forEach((a) => {
      space(14);
      const d = `${a.action_date.slice(8, 10)}/${a.action_date.slice(5, 7)}/${a.action_date.slice(0, 4)}`;
      text(`${d} · ${a.title}`, L, width, 10, 'bold');
      text([actionKindLabel(a.kind), durationLabel(a.duration_minutes), a.trainer && `${tx('Formador')}: ${a.trainer}`, a.all_staff && tx('Todas as equipas técnicas')].filter(Boolean).join(' · '), L + 2, width - 2, 9);
      if (a.topics?.trim()) text(`${tx('Temas')}: ${a.topics}`, L + 2, width - 2, 9);
      if (a.attendees?.trim()) text(`${tx('Presentes')}: ${a.attendees}`, L + 2, width - 2, 9);
      y += 2;
    });

    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text(`${clubName} · ${tx('Documento orientador')} · ${tx('Página {{i}} de {{n}}', { i, n })}`, W / 2, H - 8, { align: 'center' });
    }
    return deliverPdf(doc, `documento_orientador_${clubName.replace(/\s+/g, '_').toLowerCase()}.pdf`, { title: tx('Documento orientador') });
  });
}

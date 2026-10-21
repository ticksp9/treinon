// Lightweight season report PDF using jsPDF (already present in repo deps via generatePlayerPdf).
import { supabase } from '@/integrations/supabase/client';
import { deliverPdf } from '@/lib/native-files';
import { inPdfLanguage, lang, tx } from '@/lib/i18n/ui';

export async function generateSeasonReportPdf(seasonId: string, seasonName: string): Promise<void> {
  const [{ data: matches }, { data: trainings }, { data: attendance }, { data: evaluations }, { data: enrollments }] = await Promise.all([
    supabase.from('matches').select('id, match_date, home_team, away_team, home_score, away_score').eq('season_id', seasonId as any),
    supabase.from('training_sessions').select('id, session_date').eq('season_id', seasonId as any),
    supabase.from('training_attendance').select('id, present').eq('season_id', seasonId as any),
    supabase.from('player_evaluations').select('id').eq('season_id', seasonId as any),
    supabase.from('season_player_enrollments' as any).select('player_id, team_id, age_group_id, status').eq('season_id', seasonId),
  ]);

  const presentCount = (attendance || []).filter((a: any) => a.present).length;
  const rate = (attendance || []).length ? Math.round((presentCount / (attendance || []).length) * 100) : 0;

  const { jsPDF } = await import('jspdf');
  const doc = inPdfLanguage(() => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(tx('Relatório de Época — {{name}}', { name: seasonName }), 14, 18);
  doc.setFontSize(11);
  let y = 30;
  const line = (label: string, value: string | number) => { doc.text(`${label}: ${value}`, 14, y); y += 7; };
  line(tx('Jogos'), (matches || []).length);
  line(tx('Treinos'), (trainings || []).length);
  line(tx('Presenças registadas'), (attendance || []).length);
  line(tx('Taxa de presença'), `${rate}%`);
  line(tx('Avaliações'), (evaluations || []).length);
  line(tx('Jogadores inscritos'), (enrollments || []).length);

  y += 4;
  doc.setFontSize(12);
  doc.text(tx('Resumo de jogos'), 14, y); y += 6;
  doc.setFontSize(9);
  (matches || []).slice(0, 40).forEach((m: any) => {
    const txt = `${m.match_date || ''} · ${m.home_team || ''} ${m.home_score ?? '-'}–${m.away_score ?? '-'} ${m.away_team || ''}`;
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(txt, 14, y); y += 5;
  });
  return doc;
  });

  void deliverPdf(doc, `${lang() !== 'pt' ? 'season' : 'epoca'}-${seasonName.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}

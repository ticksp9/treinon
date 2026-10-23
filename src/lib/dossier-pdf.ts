/**
 * The team's training dossier as one PDF, with an index and the same structure for every team
 * (what the FPF assessor asks to see at the technical visit).
 */
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { deliverPdf } from '@/lib/native-files';
import { inPdfLanguage, longDate, tx } from '@/lib/i18n/ui';
import { dossierScore, type DossierSection } from '@/lib/dossier';
import { activeWeeks, intensityLabel, mesoKindLabel, seasonWeeks, weekNumber, weekRangeLabel, weekStartOf } from '@/lib/training-plan';
import { objectiveStatusLabel, type DossierObjective } from '@/lib/objectives';
import { GAME_FORMATS, MODEL_FIELDS, STAGE_FIELDS, TRANSITION_FIELDS } from '@/lib/guidelines';
import { actionKindLabel, durationLabel, transitionKindLabel } from '@/lib/transitions';
import { SLOT_SPACES } from '@/lib/club-map';
import type { DossierData } from '@/components/dossier/useDossierData';

const d = (s: string) => format(new Date(s.length === 10 ? `${s}T12:00:00` : s), 'dd/MM/yyyy');

export function downloadDossierPdf(data: DossierData, sections: DossierSection[]) {
  return inPdfLanguage(() => {
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const L = 14, R = W - 14, width = R - L;
    let y = 20;
    const space = (n: number) => { if (y + n > H - 18) { doc.addPage(); y = 20; } };
    const text = (s: string, x = L, w = width, size = 10, style: 'normal' | 'bold' = 'normal', gray = false) => {
      doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(gray ? 110 : 0, gray ? 110 : 0, gray ? 110 : 0);
      for (const line of doc.splitTextToSize(s, w) as string[]) { space(6); doc.text(line, x, y); y += size * 0.46; }
      doc.setTextColor(0, 0, 0);
    };
    let num = 0;
    const section = (title: string) => {
      doc.addPage(); y = 20;
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 102, 204);
      doc.text(`${++num}. ${title}`, L, y); y += 2;
      doc.setDrawColor(0, 102, 204); doc.line(L, y, R, y); y += 8;
      doc.setTextColor(0, 0, 0);
    };
    const sub = (title: string) => { y += 3; space(14); text(title, L, width, 11, 'bold'); y += 1; };
    const row = (cells: string[], widths: number[], bold = false) => {
      doc.setFontSize(9); doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lines = cells.map((c, i) => doc.splitTextToSize(c || '—', widths[i] - 2) as string[]);
      const h = Math.max(...lines.map((l) => l.length)) * 4.2 + 1.5;
      space(h + 1);
      let x = L;
      const base = y;
      lines.forEach((l, i) => { doc.text(l, x, base); x += widths[i]; });
      y = base + h;
      // header: a line just under the text, then room before the first row
      if (bold) { const under = base + h - 3.9; doc.setDrawColor(180, 180, 180); doc.line(L, under, R, under); y += 1.5; }
    };
    const empty = (s = tx('Sem registos.')) => text(s, L, width, 10, 'normal', true);
    const objectivesTable = (list: DossierObjective[], who?: (o: DossierObjective) => string) => {
      // team: the indicator cell also says how it is evaluated; players: one more column for the name
      const widths = who ? [30, 44, 36, 22, 20, width - 152] : [52, 46, 24, 22, width - 144];
      const status = (o: DossierObjective) => [objectiveStatusLabel(o.status), o.result].filter(Boolean).join(': ');
      const indicator = (o: DossierObjective) => [o.indicator, o.evaluation && `(${o.evaluation})`].filter(Boolean).join(' ');
      row([...(who ? [tx('Jogador')] : []), tx('Objetivo'), tx('Indicador'), tx('Meta'), tx('Prazo'), tx('Estado')], widths, true);
      list.forEach((o) => row([...(who ? [who(o)] : []), o.objective, indicator(o), o.target ?? '', o.deadline ? d(o.deadline) : '', status(o)], widths));
    };

    // ── cover + index ──
    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.text(tx('DOSSIER DE TREINO'), W / 2, y, { align: 'center' }); y += 10;
    doc.setFontSize(14); doc.text(data.team.name, W / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text([data.team.club_name, data.team.category, tx('Época {{name}}', { name: data.season.name })].filter(Boolean).join(' · '), W / 2, y, { align: 'center' }); y += 6;
    doc.setTextColor(110, 110, 110);
    doc.text(tx('Gerado a {{d}} · completo a {{p}}%', { d: longDate(new Date(), 'dateTime'), p: dossierScore(sections) }), W / 2, y, { align: 'center' }); y += 6;
    const last = data.reviews[0];
    doc.text(last ? tx('Revisto pelo coordenador: {{who}}, {{d}}', { who: last.reviewer || '—', d: d(last.created_at) }) : tx('Ainda não revisto pelo coordenador.'), W / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0); y += 14;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(tx('Índice'), L, y); y += 7;
    const index = [tx('Documento orientador (resumo)'), tx('Plantel'), tx('Fichas individuais e avaliações'), tx('Objetivos do escalão'), tx('Planeamento anual'), tx('Mesociclos'), tx('Microciclos (semanas)'),
      tx('Unidades de treino'), tx('Espaço e material'), tx('Plano de transição'), tx('Formação da equipa técnica'), tx('Convocatórias e avaliação dos jogos'), tx('Revisões do coordenador')];
    index.forEach((t, i) => text(`${i + 1}. ${t}`, L + 2));
    y += 6;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); space(10); doc.text(tx('Estado de cada parte'), L, y); y += 7;
    const mark = { done: tx('Completo'), partial: tx('Incompleto'), missing: tx('Em falta'), info: tx('Não se aplica ainda') };
    sections.forEach((s) => row([s.title, mark[s.state], s.detail], [80, 32, width - 112]));

    // guiding document: the vision, this team's game model and the stages
    section(tx('Documento orientador (resumo)'));
    const gl = data.guidelines;
    if (!gl) empty(tx('O clube ainda não escreveu o documento orientador.'));
    else {
      if (gl.vision?.trim()) { sub(tx('Visão e filosofia de formação')); text(gl.vision); }
      const model = data.format ? gl.models?.[data.format] : undefined;
      sub(`${tx('Modelo de jogo')}${data.format ? ` · ${GAME_FORMATS.find((f) => f.value === data.format)?.label ?? ''}` : ''}`);
      if (model && Object.values(model).some((v) => v?.trim())) {
        MODEL_FIELDS.forEach((k) => { if (model[k.key]?.trim()) { text(k.label, L + 2, width - 2, 9, 'bold'); text(model[k.key]!, L + 4, width - 4, 9); y += 1; } });
      } else empty(tx('Por definir.'));
      if (gl.stages?.length) {
        sub(tx('Etapas de formação'));
        gl.stages.forEach((s) => {
          space(12);
          text([s.name, s.ages].filter(Boolean).join(' · '), L + 2, width - 2, 10, 'bold');
          STAGE_FIELDS.forEach((f) => { if (s[f.key]?.trim()) text(`${f.label}: ${s[f.key]}`, L + 4, width - 4, 9); });
          y += 1.5;
        });
      }
    }

    // squad
    section(tx('Plantel'));
    row([tx('N.º'), tx('Nome'), tx('Posição'), tx('Nascimento')], [14, 90, 40, width - 144], true);
    data.players.forEach((p) => row([p.number != null ? String(p.number) : '', p.name, p.position ?? '', p.birth_date ? d(p.birth_date) : ''], [14, 90, 40, width - 144]));
    if (!data.players.length) empty();

    // evaluations + individual objectives
    section(tx('Fichas individuais e avaliações'));
    text(tx('Última avaliação de cada jogador nesta época. Comportamento e desempenho de 1 a 10.'), L, width, 9, 'normal', true); y += 2;
    row([tx('Jogador'), tx('Data'), tx('Momento'), tx('Comportamento'), tx('Desempenho')], [62, 26, 42, 28, width - 158], true);
    data.players.forEach((p) => {
      const e = data.evaluations.find((x) => x.player_id === p.id);
      row([p.name, e ? d(e.evaluation_date) : tx('Sem avaliação'), e?.period_label ?? '', e?.behaviour != null ? e.behaviour.toFixed(1) : '—', e?.performance != null ? e.performance.toFixed(1) : '—'], [62, 26, 42, 28, width - 158]);
    });
    sub(tx('Objetivos individuais'));
    if (data.playerObjectives.length) {
      const name = new Map(data.players.map((p) => [p.id, p.name]));
      objectivesTable(data.playerObjectives, (o) => name.get(o.player_id ?? '') ?? '');
    } else empty(tx('Por definir.'));

    // objectives of the age group
    section(tx('Objetivos do escalão'));
    data.objectives?.trim() ? text(data.objectives) : empty(tx('Por definir.'));
    sub(tx('Objetivos com meta e prazo'));
    data.teamObjectives.length ? objectivesTable(data.teamObjectives) : empty(tx('Por definir.'));

    // annual plan
    section(tx('Planeamento anual'));
    if (data.periods.length) {
      row([tx('Período'), tx('Datas'), tx('Prioridade'), tx('Controlo')], [38, 40, 64, width - 142], true);
      data.periods.forEach((p) => row([p.label, [p.from && d(p.from), p.to && d(p.to)].filter(Boolean).join(' – '), p.priority, p.control], [38, 40, 64, width - 142]));
    } else empty(tx('Por definir.'));

    // mesocycles
    section(tx('Mesociclos'));
    if (data.mesos.length) {
      row([tx('Mesociclo'), tx('Tipo'), tx('Datas'), tx('Prioridades')], [36, 26, 42, width - 104], true);
      data.mesos.forEach((m) => row([m.name, mesoKindLabel(m.kind), `${d(m.start_date)} – ${d(m.end_date)}`, m.focus ?? ''], [36, 26, 42, width - 104]));
    } else empty(tx('Por definir.'));

    // microcycles
    section(tx('Microciclos (semanas)'));
    const microBy = new Map(data.micros.map((m) => [m.week_start, m]));
    const working = activeWeeks(data.sessions, data.matches);
    const weeks = seasonWeeks(data.season.start_date.slice(0, 10), data.season.end_date.slice(0, 10)).filter((w) => microBy.has(w) || (w <= weekStartOf(new Date()) && working.has(w)));
    if (!weeks.length) empty();
    weeks.forEach((w) => {
      const m = microBy.get(w);
      const games = data.matches.filter((g) => weekStartOf(g.match_date) === w).map((g) => g.opponent_name);
      space(16);
      text(`${tx('Semana {{n}}', { n: weekNumber(data.season.start_date, w) })} · ${weekRangeLabel(w)}${m?.intensity ? ` · ${tx('Intensidade')}: ${intensityLabel(m.intensity)}` : ''}${games.length ? ` · ${tx('Jogo')}: ${games.join(', ')}` : ''}`, L, width, 10, 'bold');
      text(`${tx('Objetivos')}: ${m?.objectives?.trim() || '—'}`, L + 2, width - 2, 9);
      if (m?.contents?.trim()) text(`${tx('Conteúdos')}: ${m.contents}`, L + 2, width - 2, 9);
      text(`${tx('Balanço')}: ${m?.review?.trim() || '—'}`, L + 2, width - 2, 9);
      y += 2;
    });

    // sessions
    section(tx('Unidades de treino'));
    const done = data.sessions.filter((s) => s.date <= new Date().toISOString());
    if (!done.length) empty();
    done.forEach((s) => {
      space(16);
      const mins = s.actual_minutes ?? s.duration_minutes;
      const head = [longDate(new Date(s.date), 'weekdayTime'), mins ? `${mins}'` : '', s.marked ? tx('{{a}}/{{b}} presentes', { a: s.present, b: s.marked }) : '', s.session_rating ? `${s.session_rating}/5` : '', s.closed_at ? tx('fechado') : ''].filter(Boolean).join(' · ');
      text(head, L, width, 10, 'bold');
      text(`${tx('Objetivo')}: ${s.objectives?.trim() || '—'}`, L + 2, width - 2, 9);
      text(`${tx('Conteúdos')}: ${s.exercises?.trim() || '—'}`, L + 2, width - 2, 9);
      if (s.notes?.trim()) text(`${tx('Observações')}: ${s.notes}`, L + 2, width - 2, 9);
      y += 2;
    });

    // space (the FPF "mapa-tipo" row of this team) and materials
    section(tx('Espaço e material'));
    sub(tx('Mapa de ocupação do espaço'));
    if (data.typical) {
      text(tx('{{n}} treinos por semana · {{m}} minutos por semana · {{a}} min em média', { n: data.typical.sessions, m: data.typical.minutes, a: data.typical.avg }), L, width, 10);
      text(data.typical.days, L + 2, width - 2, 9);
      text(SLOT_SPACES.map((s) => `${s.short} = ${s.label}`).join(' · '), L + 2, width - 2, 8, 'normal', true);
      if (data.typical.needsFullPitch) text(tx('Falta um treino por semana em campo inteiro (Sub-15 a Sub-19).'), L + 2, width - 2, 9, 'bold');
    } else empty(tx('Sem horário no mapa do clube'));
    sub(tx('Material e equipamento'));
    data.materials?.trim() ? text(data.materials) : empty(tx('Por registar'));

    // transition plan (the club's) + this team's players who trained or played with another team
    section(tx('Plano de transição'));
    const tp = data.guidelines?.transition;
    if (!TRANSITION_FIELDS.some((f) => tp?.[f.key]?.trim())) empty(tx('O clube ainda não escreveu o plano de transição.'));
    TRANSITION_FIELDS.forEach((f) => { if (tp?.[f.key]?.trim()) { text(f.label, L, width, 10, 'bold'); text(tp[f.key]!, L + 2, width - 2, 9); y += 1.5; } });
    sub(tx('Jogadores noutro escalão'));
    if (data.transitions.length) {
      const name = new Map(data.players.map((p) => [p.id, p.name]));
      const widths = [22, 36, 30, 34, width - 122];
      row([tx('Data'), tx('Jogador'), tx('Equipa'), tx('O que foi'), tx('Observações')], widths, true);
      data.transitions.forEach((t) => row([d(t.event_date), name.get(t.player_id) ?? '', t.to_name, transitionKindLabel(t.kind), [t.note, t.evaluation].filter(Boolean).join(' — ')], widths));
    } else empty();

    // the club's training actions for its coaches, this season
    section(tx('Formação da equipa técnica'));
    if (!data.trainingActions.length) empty();
    data.trainingActions.forEach((a) => {
      space(14);
      text(`${d(a.action_date)} · ${a.title}`, L, width, 10, 'bold');
      text([actionKindLabel(a.kind), durationLabel(a.duration_minutes), a.trainer && `${tx('Formador')}: ${a.trainer}`, a.all_staff && tx('Todas as equipas técnicas')].filter(Boolean).join(' · '), L + 2, width - 2, 9);
      if (a.topics?.trim()) text(`${tx('Temas')}: ${a.topics}`, L + 2, width - 2, 9);
      if (a.attendees?.trim()) text(`${tx('Presentes')}: ${a.attendees}`, L + 2, width - 2, 9);
      y += 2;
    });

    // matches
    section(tx('Convocatórias e avaliação dos jogos'));
    if (!data.matches.length) empty();
    data.matches.forEach((m) => {
      space(14);
      const score = m.goals_for != null && m.goals_against != null ? (m.is_home ? `${m.goals_for}-${m.goals_against}` : `${m.goals_against}-${m.goals_for}`) : '';
      text(`${d(m.match_date)} · ${m.is_home ? `${data.team.name} vs ${m.opponent_name}` : `${m.opponent_name} vs ${data.team.name}`} ${score}`, L, width, 10, 'bold');
      text([tx('{{n}} convocados', { n: m.called }), m.avgRating != null ? tx('nota média {{v}}', { v: m.avgRating.toFixed(1) }) : '', m.playerNotes ? tx('{{n}} notas sobre jogadores', { n: m.playerNotes }) : ''].filter(Boolean).join(' · '), L + 2, width - 2, 9);
      if (m.review?.positives?.trim()) text(`${tx('O que correu bem')}: ${m.review.positives}`, L + 2, width - 2, 9);
      if (m.review?.improve?.trim()) text(`${tx('O que temos de melhorar')}: ${m.review.improve}`, L + 2, width - 2, 9);
      if (m.review?.next_focus?.trim()) text(`${tx('O que vamos treinar a seguir')}: ${m.review.next_focus}`, L + 2, width - 2, 9);
      if (m.opponentNotes) text(`${tx('Sobre o adversário')}: ${m.opponentNotes}`, L + 2, width - 2, 9);
      y += 2;
    });

    // reviews
    section(tx('Revisões do coordenador'));
    if (!data.reviews.length) empty(tx('Ainda não revisto pelo coordenador.'));
    data.reviews.forEach((r) => { text(`${d(r.created_at)} · ${r.reviewer || '—'}`, L, width, 10, 'bold'); if (r.note) text(r.note, L + 2, width - 2, 9); y += 2; });

    // footer
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text(`${data.team.name} · ${tx('Dossier de treino')} · ${data.season.name} · ${tx('Página {{i}} de {{n}}', { i, n })}`, W / 2, H - 8, { align: 'center' });
    }
    const file = `dossier_${data.team.name.replace(/\s+/g, '_').toLowerCase()}_${data.season.name.replace(/\//g, '-')}.pdf`;
    return deliverPdf(doc, file, { title: tx('Dossier de treino') });
  });
}

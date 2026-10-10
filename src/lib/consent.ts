/**
 * Parents' consent (RGPD), per child: data processing (required to use the app for that
 * child) and use of image (free choice). The notice below is a plain-language summary;
 * each club should have its own privacy policy reviewed and point to it.
 */

/** Bump when the notice changes: parents are asked again. */
export const POLICY_VERSION = '2026-10';

export interface ChildConsent {
  player_id: string; player_name: string; team_name: string | null; club_name: string | null;
  policy_version: string | null; data_processing: boolean; data_processing_at: string | null; image_use: boolean | null;
}

/** Children for whom the parent still has to accept the current notice. */
export function pendingConsents(children: ChildConsent[], version = POLICY_VERSION): ChildConsent[] {
  return children.filter((c) => !c.data_processing || c.policy_version !== version);
}

export interface ConsentRow { user_id: string; policy_version: string; data_processing: boolean; image_use: boolean | null }
export type ImageStatus = 'yes' | 'no' | 'unanswered';

/**
 * What the coach needs to know about one player. Image: one parent saying no is enough
 * to treat it as "no" — when in doubt, do not publish a child's photo.
 */
export function consentStatus(rows: ConsentRow[]): { dataOk: boolean; image: ImageStatus; parents: number } {
  const dataOk = rows.some((r) => r.data_processing);
  const image: ImageStatus = rows.some((r) => r.image_use === false) ? 'no' : rows.some((r) => r.image_use === true) ? 'yes' : 'unanswered';
  return { dataOk, image, parents: rows.length };
}

export const IMAGE_LABELS: Record<ImageStatus, string> = {
  yes: 'Imagem autorizada',
  no: 'Imagem NÃO autorizada',
  unanswered: 'Imagem: sem resposta dos pais',
};

/** Who is responsible for the data, in the parent's words. */
export function controllerName(c: Pick<ChildConsent, 'club_name' | 'team_name'>): string {
  return c.club_name || (c.team_name ? `o treinador da equipa ${c.team_name}` : 'o treinador');
}

export const NOTICE_POINTS: { title: string; text: string }[] = [
  { title: 'Que dados', text: 'Nome, data de nascimento, posição e dados desportivos do seu educando (presenças, jogos, minutos, avaliações, lesões). Se o clube os registar: morada, documento de identificação, NIF e os seus contactos.' },
  { title: 'Para quê', text: 'Organizar treinos e jogos, convocatórias, comunicação consigo e acompanhamento desportivo. Não são usados para publicidade nem vendidos a terceiros.' },
  { title: 'Quem vê', text: 'Os treinadores veem apenas o nome, a data de nascimento e os dados desportivos. Os dados pessoais e os seus contactos só são vistos pela administração e coordenação do clube. Numa emergência, o treinador pode consultar o seu telefone, e essa consulta fica registada.' },
  { title: 'Os seus direitos', text: 'Pode consultar, corrigir ou pedir a eliminação dos dados e retirar este consentimento a qualquer momento, contactando o clube. Sem este consentimento não é possível usar a aplicação para este educando.' },
];

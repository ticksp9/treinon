import jsPDF from 'jspdf';
import { format, differenceInYears } from 'date-fns';
import { deliverPdf } from '@/lib/native-files';
import { inPdfLanguage, lang, longDate, tr, tx } from '@/lib/i18n/ui';

interface PlayerData {
  name: string;
  number?: number | null;
  position?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  nationality?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  foot?: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  id_document_type?: string | null;
  id_document_number?: string | null;
  id_document_expiry?: string | null;
  tax_id?: string | null;
  federation_id?: string | null;
  medical_certificate_expiry?: string | null;
  parent_name?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
  parent_name_2?: string | null;
  parent_email_2?: string | null;
  parent_phone_2?: string | null;
  notes?: string | null;
  team?: {
    name: string;
    season?: string | null;
  } | null;
}

const ID_DOCUMENT_LABELS: Record<string, string> = {
  national_id: tr('Cartão de Cidadão / BI'),
  passport: tr('Passaporte'),
  residence_permit: tr('Título de Residência'),
  birth_certificate: tr('Certidão de Nascimento'),
  other: tr('Outro'),
};

const POSITION_LABELS: Record<string, string> = {
  GK: tr('Guarda-Redes'),
  CB: tr('Defesa Central'),
  LB: tr('Lateral Esquerdo'),
  RB: tr('Lateral Direito'),
  CDM: tr('Médio Defensivo'),
  CM: tr('Médio Centro'),
  CAM: tr('Médio Ofensivo'),
  LM: tr('Médio Esquerdo'),
  RM: tr('Médio Direito'),
  LW: tr('Extremo Esquerdo'),
  RW: tr('Extremo Direito'),
  CF: tr('Avançado Centro'),
  ST: tr('Ponta de Lança'),
  FIX: tr('Fixo'),
  ALA: tr('Ala'),
  PIV: tr('Pivot'),
  UNI: tr('Universal'),
};

const FOOT_LABELS: Record<string, string> = {
  right: tr('Direito'),
  left: tr('Esquerdo'),
  both: tr('Ambos'),
};

export function generatePlayerPdf(player: PlayerData): void {
  inPdfLanguage(() => buildPlayerPdf(player));
}

function buildPlayerPdf(player: PlayerData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Helper function to add section
  const addSection = (title: string) => {
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 102, 204);
    doc.text(title, 14, y);
    y += 2;
    doc.setDrawColor(0, 102, 204);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  };

  // Helper function to add field
  const addField = (label: string, value: string | null | undefined) => {
    if (!value) return;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 60, y);
    y += 6;
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(tx('FICHA DE JOGADOR'), pageWidth / 2, y, { align: 'center' });
  y += 5;
  
  // Subtitle with team info
  if (player.team) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${player.team.name}${player.team.season ? ` - ${player.team.season}` : ''}`, pageWidth / 2, y + 5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
  y += 10;

  // Date generated
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(tx('Gerado em: {{date}}', { date: longDate(new Date(), 'date') }), pageWidth - 14, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Personal Data Section
  addSection(tx('DADOS PESSOAIS'));
  
  addField(tx('Nome Completo'), player.name);
  addField(tx('Número'), player.number?.toString());
  addField(tx('Posição'), player.position ? tx(POSITION_LABELS[player.position] || player.position) : null);
  addField(tx('Género'), tx(player.gender === 'male' ? 'Masculino' : 'Feminino'));
  
  if (player.birth_date) {
    const age = differenceInYears(new Date(), new Date(player.birth_date));
    addField(tx('Data de Nascimento'), `${format(new Date(player.birth_date), 'dd/MM/yyyy')} (${tx('{{n}} anos', { n: age })})`);
  }
  
  addField(tx('Local de Nascimento'), player.birth_place);
  addField(tx('Nacionalidade'), player.nationality);
  addField(tx('Altura'), player.height_cm ? `${player.height_cm} cm` : null);
  addField(tx('Peso'), player.weight_kg ? `${player.weight_kg} kg` : null);
  addField(tx('Pé Dominante'), player.foot ? tx(FOOT_LABELS[player.foot] || player.foot) : null);

  // Contact Section
  if (player.email || player.phone || player.address) {
    addSection(tx('CONTACTO'));
    addField(tx('Email'), player.email);
    addField(tx('Telefone'), player.phone);
    addField(tx('Morada'), player.address);
  }

  // Documentation Section
  if (player.id_document_type || player.tax_id || player.federation_id) {
    addSection(tx('DOCUMENTAÇÃO'));
    
    if (player.id_document_type) {
      const docLabel = tx(ID_DOCUMENT_LABELS[player.id_document_type] || player.id_document_type);
      addField(tx('Tipo de Documento'), docLabel);
    }
    addField(tx('Número do Documento'), player.id_document_number);
    if (player.id_document_expiry) {
      addField(tx('Validade do Documento'), format(new Date(player.id_document_expiry), 'dd/MM/yyyy'));
    }
    addField(tx('NIF / ID Fiscal'), player.tax_id);
    addField(tx('Número de Federado'), player.federation_id);
    if (player.medical_certificate_expiry) {
      addField(tx('Validade Atestado Médico'), format(new Date(player.medical_certificate_expiry), 'dd/MM/yyyy'));
    }
  }

  // Check if we need a new page
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // Parents Section
  if (player.parent_name || player.parent_name_2) {
    addSection(tx('ENCARREGADOS DE EDUCAÇÃO'));
    
    if (player.parent_name) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(tx('Encarregado 1:'), 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      addField(tx('Nome'), player.parent_name);
      addField(tx('Email'), player.parent_email);
      addField(tx('Telefone'), player.parent_phone);
    }
    
    if (player.parent_name_2) {
      y += 4;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(tx('Encarregado 2:'), 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      addField(tx('Nome'), player.parent_name_2);
      addField(tx('Email'), player.parent_email_2);
      addField(tx('Telefone'), player.parent_phone_2);
    }
  }

  // Notes Section
  if (player.notes) {
    addSection(tx('OBSERVAÇÕES'));
    doc.setFontSize(10);
    const splitNotes = doc.splitTextToSize(player.notes, pageWidth - 28);
    doc.text(splitNotes, 14, y);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      tx('Página {{i}} de {{n}}', { i, n: pageCount }),
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `${lang() !== 'pt' ? 'player_profile' : 'ficha_jogador'}_${player.name.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  void deliverPdf(doc, fileName);
}

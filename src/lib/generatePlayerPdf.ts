import jsPDF from 'jspdf';
import { format, differenceInYears } from 'date-fns';
import { pt } from 'date-fns/locale';

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
  national_id: 'Cartão de Cidadão / BI',
  passport: 'Passaporte',
  residence_permit: 'Título de Residência',
  birth_certificate: 'Certidão de Nascimento',
  other: 'Outro',
};

const POSITION_LABELS: Record<string, string> = {
  GK: 'Guarda-Redes',
  CB: 'Defesa Central',
  LB: 'Lateral Esquerdo',
  RB: 'Lateral Direito',
  CDM: 'Médio Defensivo',
  CM: 'Médio Centro',
  CAM: 'Médio Ofensivo',
  LM: 'Médio Esquerdo',
  RM: 'Médio Direito',
  LW: 'Extremo Esquerdo',
  RW: 'Extremo Direito',
  CF: 'Avançado Centro',
  ST: 'Ponta de Lança',
  FIX: 'Fixo',
  ALA: 'Ala',
  PIV: 'Pivot',
  UNI: 'Universal',
};

const FOOT_LABELS: Record<string, string> = {
  right: 'Direito',
  left: 'Esquerdo',
  both: 'Ambos',
};

export function generatePlayerPdf(player: PlayerData): void {
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
  doc.text('FICHA DE JOGADOR', pageWidth / 2, y, { align: 'center' });
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
  doc.text(`Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: pt })}`, pageWidth - 14, y, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Personal Data Section
  addSection('DADOS PESSOAIS');
  
  addField('Nome Completo', player.name);
  addField('Número', player.number?.toString());
  addField('Posição', player.position ? POSITION_LABELS[player.position] || player.position : null);
  addField('Género', player.gender === 'male' ? 'Masculino' : 'Feminino');
  
  if (player.birth_date) {
    const age = differenceInYears(new Date(), new Date(player.birth_date));
    addField('Data de Nascimento', `${format(new Date(player.birth_date), 'dd/MM/yyyy')} (${age} anos)`);
  }
  
  addField('Local de Nascimento', player.birth_place);
  addField('Nacionalidade', player.nationality);
  addField('Altura', player.height_cm ? `${player.height_cm} cm` : null);
  addField('Peso', player.weight_kg ? `${player.weight_kg} kg` : null);
  addField('Pé Dominante', player.foot ? FOOT_LABELS[player.foot] || player.foot : null);

  // Contact Section
  if (player.email || player.phone || player.address) {
    addSection('CONTACTO');
    addField('Email', player.email);
    addField('Telefone', player.phone);
    addField('Morada', player.address);
  }

  // Documentation Section
  if (player.id_document_type || player.tax_id || player.federation_id) {
    addSection('DOCUMENTAÇÃO');
    
    if (player.id_document_type) {
      const docLabel = ID_DOCUMENT_LABELS[player.id_document_type] || player.id_document_type;
      addField('Tipo de Documento', docLabel);
    }
    addField('Número do Documento', player.id_document_number);
    if (player.id_document_expiry) {
      addField('Validade do Documento', format(new Date(player.id_document_expiry), 'dd/MM/yyyy'));
    }
    addField('NIF / ID Fiscal', player.tax_id);
    addField('Número de Federado', player.federation_id);
    if (player.medical_certificate_expiry) {
      addField('Validade Atestado Médico', format(new Date(player.medical_certificate_expiry), 'dd/MM/yyyy'));
    }
  }

  // Check if we need a new page
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // Parents Section
  if (player.parent_name || player.parent_name_2) {
    addSection('ENCARREGADOS DE EDUCAÇÃO');
    
    if (player.parent_name) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Encarregado 1:', 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      addField('Nome', player.parent_name);
      addField('Email', player.parent_email);
      addField('Telefone', player.parent_phone);
    }
    
    if (player.parent_name_2) {
      y += 4;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Encarregado 2:', 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      addField('Nome', player.parent_name_2);
      addField('Email', player.parent_email_2);
      addField('Telefone', player.parent_phone_2);
    }
  }

  // Notes Section
  if (player.notes) {
    addSection('OBSERVAÇÕES');
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
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `ficha_jogador_${player.name.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}

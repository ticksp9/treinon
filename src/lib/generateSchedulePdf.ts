import jsPDF from 'jspdf';

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  youth_teams: {
    id: string;
    name: string;
    youth_age_groups: {
      id: string;
      name: string;
    };
  };
}

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

const SCHEDULE_COLORS: Record<string, [number, number, number]> = {
  "Petizes": [252, 231, 243],      // pink-100
  "Traquinas": [243, 232, 255],    // purple-100
  "Benjamins": [219, 234, 254],    // blue-100
  "Infantis": [220, 252, 231],     // green-100
  "Iniciados": [254, 249, 195],    // yellow-100
  "Juvenis": [255, 237, 213],      // orange-100
  "Juniores": [254, 226, 226],     // red-100
};

export function generateSchedulePdf(schedules: Schedule[], clubName: string) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const headerHeight = 25;
  const dayWidth = (pageWidth - margin * 2) / 5;
  const startY = margin + headerHeight;
  const contentHeight = pageHeight - startY - margin;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Quadro Semanal de Treinos', pageWidth / 2, margin + 8, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(clubName, pageWidth / 2, margin + 16, { align: 'center' });

  // Day headers
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  
  DAYS_OF_WEEK.forEach((day, index) => {
    const x = margin + index * dayWidth;
    doc.rect(x, startY, dayWidth, 10, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, startY, dayWidth, 10, 'S');
    doc.text(day, x + dayWidth / 2, startY + 7, { align: 'center' });
  });

  // Content area outline
  DAYS_OF_WEEK.forEach((_, index) => {
    const x = margin + index * dayWidth;
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, startY + 10, dayWidth, contentHeight - 10, 'S');
  });

  // Group schedules by day
  const schedulesByDay: Record<number, Schedule[]> = {};
  schedules.forEach(schedule => {
    if (!schedulesByDay[schedule.day_of_week]) {
      schedulesByDay[schedule.day_of_week] = [];
    }
    schedulesByDay[schedule.day_of_week].push(schedule);
  });

  // Sort schedules by start time
  Object.keys(schedulesByDay).forEach(day => {
    schedulesByDay[parseInt(day)].sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  // Draw schedules
  const boxHeight = 20;
  const boxPadding = 2;
  
  DAYS_OF_WEEK.forEach((_, dayIndex) => {
    const dayNumber = dayIndex + 1;
    const daySchedules = schedulesByDay[dayNumber] || [];
    const x = margin + dayIndex * dayWidth;
    
    daySchedules.forEach((schedule, scheduleIndex) => {
      const y = startY + 12 + scheduleIndex * (boxHeight + boxPadding);
      
      // Get color for age group
      const ageGroupName = schedule.youth_teams?.youth_age_groups?.name || '';
      const color = SCHEDULE_COLORS[ageGroupName] || [229, 231, 235]; // gray-200
      
      // Draw box
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(x + 2, y, dayWidth - 4, boxHeight, 2, 2, 'F');
      doc.setDrawColor(180, 180, 180);
      doc.roundedRect(x + 2, y, dayWidth - 4, boxHeight, 2, 2, 'S');
      
      // Text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text(ageGroupName, x + 4, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(schedule.youth_teams?.name || '', x + 4, y + 10);
      
      const timeStr = `${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`;
      doc.text(timeStr, x + 4, y + 15);
      
      if (schedule.location) {
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(schedule.location, x + 4, y + 19);
      }
    });
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.setFont('helvetica', 'italic');
  const today = new Date().toLocaleDateString('pt-PT');
  doc.text(`Gerado em ${today}`, pageWidth - margin, pageHeight - 5, { align: 'right' });

  // Legend
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  let legendX = margin;
  const legendY = pageHeight - 8;
  
  doc.text('Legenda:', legendX, legendY);
  legendX += 18;
  
  Object.entries(SCHEDULE_COLORS).slice(0, 5).forEach(([name, color]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(legendX, legendY - 3, 8, 4, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.rect(legendX, legendY - 3, 8, 4, 'S');
    doc.setTextColor(50, 50, 50);
    doc.text(name, legendX + 10, legendY);
    legendX += 35;
  });

  // Save
  doc.save(`quadro-treinos-${today.replace(/\//g, '-')}.pdf`);
}

import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FileText, Download, Users, UserCog, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AGE_CATEGORIES } from '@/lib/constants';
import jsPDF from 'jspdf';
import { Database } from '@/integrations/supabase/types';

type SeasonPlayerStatus = Database['public']['Enums']['season_player_status'];

interface SummaryPdfStepProps {
  seasonId: string;
  clubId: string;
  seasonName: string;
  clubName?: string;
}

interface Team {
  id: string;
  name: string;
  category: string | null;
  gender: string;
}

interface PlayerPlan {
  id: string;
  player_id: string;
  status: SeasonPlayerStatus;
  target_team_id: string | null;
  target_category: string | null;
  current_team_id: string | null;
  current_category: string | null;
  player: {
    id: string;
    name: string;
    number: number | null;
    birth_date: string | null;
  };
}

interface CoachAssignment {
  id: string;
  coach_id: string;
  team_plan_id: string;
  role: string;
  team_plan?: {
    team_id: string | null;
    team_name: string;
    category: string | null;
  };
}

interface CoachProfile {
  id: string;
  full_name: string | null;
  email: string;
}

const COACH_ROLE_LABELS: Record<string, string> = {
  head_coach: 'Treinador Principal',
  assistant: 'Treinador Adjunto',
  goalkeeper_coach: 'Treinador de GR',
  fitness_coach: 'Preparador Físico',
};

export function SummaryPdfStep({ seasonId, clubId, seasonName, clubName }: SummaryPdfStepProps) {
  // Fetch teams
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, category, gender')
        .order('category');

      if (error) throw error;
      return data as Team[];
    },
    enabled: !!clubId,
  });

  // Fetch player plans
  const { data: playerPlans, isLoading: plansLoading } = useQuery({
    queryKey: ['season-player-plans-summary', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_player_plans')
        .select(`
          id, player_id, status, target_team_id, target_category, current_team_id, current_category,
          player:players(id, name, number, birth_date)
        `)
        .eq('season_id', seasonId);

      if (error) throw error;
      return data as PlayerPlan[];
    },
    enabled: !!seasonId,
  });

  // Fetch coach assignments
  const { data: coachAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['season-coach-assignments-summary', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_coach_assignments')
        .select(`
          id, coach_id, team_plan_id, role,
          team_plan:season_team_plans(team_id, team_name, category)
        `)
        .eq('season_id', seasonId);

      if (error) throw error;
      return data as CoachAssignment[];
    },
    enabled: !!seasonId,
  });

  // Fetch coach profiles
  const { data: coachProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['coach-profiles', clubId],
    queryFn: async () => {
      const coachIds = coachAssignments?.map(a => a.coach_id) || [];
      if (coachIds.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', coachIds);

      if (error) throw error;
      return data as CoachProfile[];
    },
    enabled: !!coachAssignments && coachAssignments.length > 0,
  });

  // Build summary data
  const summaryData = useMemo(() => {
    if (!teams || !playerPlans) return [];

    // Sort teams by category
    const sortedTeams = [...teams].sort((a, b) => {
      const catA = AGE_CATEGORIES.findIndex(c => c.value === a.category);
      const catB = AGE_CATEGORIES.findIndex(c => c.value === b.category);
      return catA - catB;
    });

    return sortedTeams.map(team => {
      // Players staying in this team
      const stayingPlayers = playerPlans.filter(p => 
        p.status === 'stays' && p.current_team_id === team.id
      );

      // Players coming to this team
      const incomingPlayers = playerPlans.filter(p => 
        p.status === 'promotes' && p.target_team_id === team.id
      );

      // Coaches for this team
      const teamCoaches = coachAssignments?.filter(a => 
        a.team_plan?.team_id === team.id
      ).map(a => {
        const profile = coachProfiles?.find(p => p.id === a.coach_id);
        return {
          name: profile?.full_name || profile?.email || 'Treinador',
          role: COACH_ROLE_LABELS[a.role] || a.role,
        };
      }) || [];

      return {
        team,
        stayingPlayers,
        incomingPlayers,
        coaches: teamCoaches,
        totalPlayers: stayingPlayers.length + incomingPlayers.length,
      };
    });
  }, [teams, playerPlans, coachAssignments, coachProfiles]);

  const leavingPlayers = useMemo(() => {
    return playerPlans?.filter(p => p.status === 'leaves') || [];
  }, [playerPlans]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`Mapeamento de Equipas - ${seasonName}`, pageWidth / 2, y, { align: 'center' });
    
    y += 8;
    if (clubName) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(clubName, pageWidth / 2, y, { align: 'center' });
      y += 8;
    }

    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-PT')}`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Summary stats
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo', 14, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const totalPlayers = playerPlans?.length || 0;
    const stayingCount = playerPlans?.filter(p => p.status === 'stays').length || 0;
    const promotingCount = playerPlans?.filter(p => p.status === 'promotes').length || 0;
    const leavingCount = playerPlans?.filter(p => p.status === 'leaves').length || 0;

    doc.text(`Total de jogadores: ${totalPlayers}`, 14, y);
    y += 5;
    doc.text(`Mantêm-se: ${stayingCount} | Sobem: ${promotingCount} | Saem: ${leavingCount}`, 14, y);
    y += 10;

    // Teams section
    summaryData.forEach((data, index) => {
      // Check for page break
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      // Team header
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${data.team.name} (${data.team.category || 'Sem escalão'})`, 16, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.totalPlayers} jogadores`, pageWidth - 16, y, { align: 'right' });
      y += 10;

      // Coaches
      if (data.coaches.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Treinadores:', 16, y);
        doc.setFont('helvetica', 'normal');
        const coachText = data.coaches.map(c => `${c.name} (${c.role})`).join(', ');
        doc.text(coachText, 40, y);
        y += 6;
      }

      // Players staying
      if (data.stayingPlayers.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Mantêm-se (${data.stayingPlayers.length}):`, 16, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        
        const stayingNames = data.stayingPlayers.map(p => 
          p.player?.number ? `#${p.player.number} ${p.player?.name}` : p.player?.name
        ).join(', ');
        
        const splitStaying = doc.splitTextToSize(stayingNames, pageWidth - 40);
        doc.text(splitStaying, 20, y);
        y += splitStaying.length * 4 + 3;
      }

      // Players incoming
      if (data.incomingPlayers.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Chegam (${data.incomingPlayers.length}):`, 16, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        
        const incomingNames = data.incomingPlayers.map(p => 
          p.player?.number ? `#${p.player.number} ${p.player?.name}` : p.player?.name
        ).join(', ');
        
        const splitIncoming = doc.splitTextToSize(incomingNames, pageWidth - 40);
        doc.text(splitIncoming, 20, y);
        y += splitIncoming.length * 4 + 3;
      }

      y += 5;
    });

    // Leaving players section
    if (leavingPlayers.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Jogadores que Saem do Clube (${leavingPlayers.length})`, 14, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const leavingNames = leavingPlayers.map(p => p.player?.name).join(', ');
      const splitLeaving = doc.splitTextToSize(leavingNames, pageWidth - 28);
      doc.text(splitLeaving, 14, y);
    }

    // Add page numbers
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save
    const filename = `mapeamento-equipas-${seasonName.replace('/', '-')}.pdf`;
    doc.save(filename);
    toast.success('PDF gerado com sucesso');
  };

  const isLoading = teamsLoading || plansLoading || assignmentsLoading || profilesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Resumo e Exportação
          </h2>
          <p className="text-sm text-muted-foreground">
            Reveja o mapeamento completo e exporte em PDF
          </p>
        </div>
        <Button onClick={generatePDF}>
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamento de Equipas - {seasonName}</CardTitle>
          <CardDescription>
            {clubName && <span>{clubName} • </span>}
            {playerPlans?.length || 0} jogadores planeados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipa</TableHead>
                <TableHead>Escalão</TableHead>
                <TableHead>Treinadores</TableHead>
                <TableHead className="text-center">Mantêm</TableHead>
                <TableHead className="text-center">Chegam</TableHead>
                <TableHead className="text-center">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.map(data => (
                <TableRow key={data.team.id}>
                  <TableCell className="font-medium">{data.team.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{data.team.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {data.coaches.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {data.coaches.map((coach, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {coach.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{data.stayingPlayers.length}</TableCell>
                  <TableCell className="text-center">
                    {data.incomingPlayers.length > 0 && (
                      <Badge variant="default" className="text-xs">
                        +{data.incomingPlayers.length}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium">{data.totalPlayers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Leaving Players */}
      {leavingPlayers.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Jogadores que Saem ({leavingPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {leavingPlayers.map(plan => (
                <Badge key={plan.id} variant="outline" className="text-destructive border-destructive/30">
                  {plan.player?.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

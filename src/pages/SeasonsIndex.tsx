// Index page for season management: lists all seasons + quick actions.
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Lock, Repeat, FileDown } from 'lucide-react';
import { useSeasonsList } from '@/hooks/useSeasonContext';
import { generateSeasonReportPdf } from '@/lib/generateSeasonReportPdf';

export default function SeasonsIndex() {
  const nav = useNavigate();
  const { data: seasons = [] } = useSeasonsList();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Épocas Desportivas</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav('/seasons/transition')}><Repeat className="w-4 h-4 mr-1" /> Transição</Button>
          <Button variant="outline" onClick={() => nav('/seasons/close')}><Lock className="w-4 h-4 mr-1" /> Fechar atual</Button>
          <Button onClick={() => nav('/seasons/new')}><Plus className="w-4 h-4 mr-1" /> Nova época</Button>
        </div>
      </div>
      <div className="space-y-2">
        {seasons.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Sem épocas registadas.</CardContent></Card>
        )}
        {seasons.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {s.name}
                  <Badge variant={s.is_active ? 'default' : 'secondary'}>{s.status}</Badge>
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => generateSeasonReportPdf(s.id, s.name)}>
                  <FileDown className="w-4 h-4 mr-1" /> PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {s.start_date} → {s.end_date}
              {s.reference_date && <> · ref: {s.reference_date}</>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

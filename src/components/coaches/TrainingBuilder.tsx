import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Copy, Clock, Upload, GripVertical, Save, Edit, Filter, Dumbbell, ShieldCheck, Zap, Target, Pencil } from 'lucide-react';
import { AGE_GROUPS, FOCUS_AREAS } from '@/lib/coach-constants';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { TrainingFieldEditor } from '@/components/trainings/TrainingFieldEditor';
import { DrillPicker } from '@/components/library/DrillPicker';
import { AnimatedDrill } from '@/components/library/AnimatedDrill';
import type { DiagramEl } from '@/lib/drill-library/types';
import type { DrillAnimation } from '@/lib/drill-library/animation';

interface Exercise {
  id: string;
  name: string;
  duration: number;
  description: string;
  image_url?: string;
  /** drawing (and animation) when it comes from an exercise */
  diagram?: DiagramEl[];
  anim?: DrillAnimation | null;
}

interface Training {
  id: string;
  name: string;
  description: string | null;
  age_group: string | null;
  objectives: string | null;
  exercises: Exercise[];
  tactical_notes: string | null;
  diagram_url: string | null;
  duration_minutes: number;
  training_date: string | null;
  status: string;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  age_group: string | null;
  focus_area: string | null;
  duration_minutes: number;
  exercises: Exercise[];
  is_system_template: boolean;
}

// System templates organized by focus area and age group
const SYSTEM_TEMPLATES: Omit<Template, 'id'>[] = [
  // OFFENSIVE TEMPLATES
  {
    name: 'Ataque Rápido - Contra-Ataque',
    description: 'Treino focado em transições rápidas e finalização após recuperação de bola.',
    age_group: 'sub-15',
    focus_area: 'offensive',
    duration_minutes: 75,
    exercises: [
      { id: '1', name: 'Ativação e Mobilidade', duration: 10, description: 'Aquecimento com mobilidade articular e ativação muscular.' },
      { id: '2', name: 'Meinho 4x2 com Transição', duration: 12, description: 'Ao recuperar a bola, transição rápida para baliza.' },
      { id: '3', name: '3x2 + GR em Contra-Ataque', duration: 15, description: 'Situação de superioridade numérica em contra-ataque.' },
      { id: '4', name: 'Jogo Reduzido 5x5', duration: 20, description: 'Valorizar golos em transição rápida (contam dobro).' },
      { id: '5', name: 'Alongamentos e Retorno à Calma', duration: 8, description: 'Alongamentos estáticos e feedback.' },
    ],
    is_system_template: true,
  },
  {
    name: 'Construção Ofensiva',
    description: 'Trabalho de saída de bola desde o guarda-redes com progressão até finalização.',
    age_group: 'sub-17',
    focus_area: 'offensive',
    duration_minutes: 90,
    exercises: [
      { id: '1', name: 'Aquecimento com Bola', duration: 12, description: 'Passe e receção em movimento, controlo orientado.' },
      { id: '2', name: 'Saída de Bola 4+GR vs 3', duration: 15, description: 'Defesa + GR constroem contra 3 adversários.' },
      { id: '3', name: 'Progressão em Ondas', duration: 18, description: 'Construção desde atrás até à zona de finalização.' },
      { id: '4', name: 'Jogo Posicional 7x7', duration: 25, description: 'Enfase na construção e saída de pressão.' },
      { id: '5', name: 'Finalização Variada', duration: 12, description: 'Remates de diferentes posições e ângulos.' },
      { id: '6', name: 'Retorno à Calma', duration: 8, description: 'Alongamentos e análise do treino.' },
    ],
    is_system_template: true,
  },
  // DEFENSIVE TEMPLATES
  {
    name: 'Organização Defensiva',
    description: 'Treino focado na organização defensiva em bloco e coberturas.',
    age_group: 'sub-15',
    focus_area: 'defensive',
    duration_minutes: 75,
    exercises: [
      { id: '1', name: 'Aquecimento Tático', duration: 10, description: 'Movimentação em bloco sem bola.' },
      { id: '2', name: 'Basculações Defensivas', duration: 12, description: '4 defesas vs 4 atacantes - movimentação lateral.' },
      { id: '3', name: 'Coberturas e Permutas', duration: 15, description: 'Trabalho de cobertura entre centrais e laterais.' },
      { id: '4', name: 'Jogo 6x6 - Valorizar Defesa', duration: 20, description: 'Pontos por recuperação limpa de bola.' },
      { id: '5', name: 'Alongamentos', duration: 8, description: 'Retorno à calma com feedback.' },
    ],
    is_system_template: true,
  },
  {
    name: 'Pressing Alto',
    description: 'Treino de pressão alta e recuperação de bola em zonas avançadas.',
    age_group: 'sub-17',
    focus_area: 'pressing',
    duration_minutes: 85,
    exercises: [
      { id: '1', name: 'Ativação Dinâmica', duration: 10, description: 'Sprints curtos e mudanças de direção.' },
      { id: '2', name: 'Pressing em Trio', duration: 12, description: '3 jogadores pressionam 2 adversários.' },
      { id: '3', name: 'Recuperação em Zona Alta', duration: 15, description: 'Situações de 4x3 com pressing coordenado.' },
      { id: '4', name: 'Jogo Condicionado', duration: 25, description: 'Golos após recuperação alta valem mais.' },
      { id: '5', name: 'Sprints de Recuperação', duration: 10, description: 'Trabalho de intensidade alta-baixa.' },
      { id: '6', name: 'Recuperação Ativa', duration: 8, description: 'Corrida leve e alongamentos.' },
    ],
    is_system_template: true,
  },
  // POSSESSION TEMPLATES
  {
    name: 'Posse de Bola - Iniciação',
    description: 'Treino de posse de bola adaptado para escalões jovens.',
    age_group: 'sub-11',
    focus_area: 'possession',
    duration_minutes: 60,
    exercises: [
      { id: '1', name: 'Aquecimento Lúdico', duration: 8, description: 'Jogos de apanhada com bola.' },
      { id: '2', name: 'Meinho 3x1', duration: 10, description: 'Manter a posse no quadrado pequeno.' },
      { id: '3', name: 'Passes em Movimento', duration: 10, description: 'Passe e receção com deslocamento.' },
      { id: '4', name: 'Jogo 4x4', duration: 18, description: 'Premiar equipas que fazem mais passes.' },
      { id: '5', name: 'Jogos de Coordenação', duration: 8, description: 'Retorno à calma com exercícios divertidos.' },
    ],
    is_system_template: true,
  },
  {
    name: 'Circulação e Posse',
    description: 'Treino de circulação de bola com mudanças de flanco.',
    age_group: 'sub-15',
    focus_area: 'possession',
    duration_minutes: 80,
    exercises: [
      { id: '1', name: 'Aquecimento com Rondo', duration: 12, description: 'Rondo 5x2 para ativar e aquecer.' },
      { id: '2', name: 'Circulação em Y', duration: 15, description: 'Passes em estrutura Y com movimentação.' },
      { id: '3', name: 'Mudanças de Corredor', duration: 15, description: 'Exercício de largura e profundidade.' },
      { id: '4', name: 'Jogo Posicional 6x6+Jokers', duration: 25, description: 'Equipas com jokers para superioridade.' },
      { id: '5', name: 'Retorno à Calma', duration: 8, description: 'Alongamentos e hidratação.' },
    ],
    is_system_template: true,
  },
  // PHYSICAL TEMPLATES
  {
    name: 'Resistência com Bola',
    description: 'Treino de resistência integrada com exercícios técnicos.',
    age_group: 'sub-17',
    focus_area: 'physical',
    duration_minutes: 75,
    exercises: [
      { id: '1', name: 'Aquecimento Progressivo', duration: 10, description: 'Corrida leve com aumento gradual de intensidade.' },
      { id: '2', name: 'Circuito Técnico-Físico', duration: 20, description: 'Estações: passe, condução, sprint, força.' },
      { id: '3', name: 'Jogo Intenso 4x4', duration: 15, description: 'Campo pequeno, alta intensidade.' },
      { id: '4', name: 'Sprints Intermitentes', duration: 12, description: 'Sprint 10s, recuperação 20s, 8 repetições.' },
      { id: '5', name: 'Alongamentos e Recuperação', duration: 10, description: 'Alongamentos estáticos profundos.' },
    ],
    is_system_template: true,
  },
  {
    name: 'Força e Agilidade',
    description: 'Trabalho de força funcional e agilidade para jovens atletas.',
    age_group: 'sub-13',
    focus_area: 'physical',
    duration_minutes: 70,
    exercises: [
      { id: '1', name: 'Jogos de Aquecimento', duration: 10, description: 'Aquecimento lúdico com movimentação.' },
      { id: '2', name: 'Circuito de Agilidade', duration: 15, description: 'Escada de coordenação, cones, saltos.' },
      { id: '3', name: 'Exercícios de Força Corporal', duration: 12, description: 'Agachamentos, prancha, lunges adaptados.' },
      { id: '4', name: 'Jogo Reduzido', duration: 20, description: 'Aplicação em contexto de jogo.' },
      { id: '5', name: 'Retorno à Calma', duration: 8, description: 'Alongamentos e feedback.' },
    ],
    is_system_template: true,
  },
  // TECHNICAL TEMPLATES
  {
    name: 'Técnica Individual - Base',
    description: 'Trabalho de fundamentos técnicos para escalões de formação.',
    age_group: 'sub-9',
    focus_area: 'technical',
    duration_minutes: 55,
    exercises: [
      { id: '1', name: 'Aquecimento com Bola', duration: 8, description: 'Cada jogador com bola, exercícios livres.' },
      { id: '2', name: 'Condução de Bola', duration: 10, description: 'Percursos com cones, diferentes pés.' },
      { id: '3', name: 'Passe a Pares', duration: 10, description: 'Passes curtos em diferentes distâncias.' },
      { id: '4', name: 'Mini Jogos 3x3', duration: 18, description: 'Jogos em campos pequenos.' },
      { id: '5', name: 'Jogos Lúdicos', duration: 6, description: 'Jogos divertidos de finalização.' },
    ],
    is_system_template: true,
  },
  {
    name: 'Passe e Receção Avançada',
    description: 'Treino de passes longos, receção orientada e controlo sob pressão.',
    age_group: 'sub-15',
    focus_area: 'passing',
    duration_minutes: 80,
    exercises: [
      { id: '1', name: 'Aquecimento Técnico', duration: 10, description: 'Passe curto e médio em triângulos.' },
      { id: '2', name: 'Receção Orientada', duration: 15, description: 'Controlo e virar para lado oposto.' },
      { id: '3', name: 'Passes Longos em Movimento', duration: 15, description: 'Mudanças de flanco com bola no ar.' },
      { id: '4', name: 'Jogo com Zonas', duration: 25, description: 'Pontos extra por passes de uma zona para outra.' },
      { id: '5', name: 'Retorno à Calma', duration: 8, description: 'Alongamentos e feedback.' },
    ],
    is_system_template: true,
  },
  // FINISHING TEMPLATES
  {
    name: 'Finalização Variada',
    description: 'Treino de remates de diferentes ângulos e distâncias.',
    age_group: 'sub-13',
    focus_area: 'finishing',
    duration_minutes: 70,
    exercises: [
      { id: '1', name: 'Aquecimento com Remates', duration: 10, description: 'Remates suaves de curta distância.' },
      { id: '2', name: 'Remates após Condução', duration: 12, description: 'Condução e remate de fora da área.' },
      { id: '3', name: 'Cruzamento e Finalização', duration: 15, description: 'Cruzamentos e cabeceamento/remate.' },
      { id: '4', name: '1x1 com GR', duration: 15, description: 'Situações de 1 contra 1 com finalização.' },
      { id: '5', name: 'Jogo com Balizas Pequenas', duration: 12, description: 'Enfase na precisão.' },
      { id: '6', name: 'Alongamentos', duration: 6, description: 'Retorno à calma.' },
    ],
    is_system_template: true,
  },
  // GOALKEEPER TEMPLATES
  {
    name: 'Treino Específico GR',
    description: 'Treino completo para guarda-redes.',
    age_group: 'sub-15',
    focus_area: 'goalkeeper',
    duration_minutes: 75,
    exercises: [
      { id: '1', name: 'Aquecimento de GR', duration: 12, description: 'Mobilidade, quedas, receções simples.' },
      { id: '2', name: 'Reflexos e Reações', duration: 12, description: 'Remates de curta distância.' },
      { id: '3', name: 'Saídas de Baliza', duration: 12, description: 'Trabalho de timing nas saídas.' },
      { id: '4', name: 'Jogo de Pés', duration: 10, description: 'Passe sob pressão e distribuição.' },
      { id: '5', name: '1x1 Situacional', duration: 15, description: 'Defesas em situações de 1x1.' },
      { id: '6', name: 'Alongamentos Específicos', duration: 8, description: 'Alongamentos para GR.' },
    ],
    is_system_template: true,
  },
  // SET PIECES
  {
    name: 'Bolas Paradas Ofensivas',
    description: 'Treino de cantos, livres e laterais ofensivos.',
    age_group: 'sub-17',
    focus_area: 'set_pieces',
    duration_minutes: 70,
    exercises: [
      { id: '1', name: 'Aquecimento', duration: 10, description: 'Aquecimento geral com bola.' },
      { id: '2', name: 'Cantos Ofensivos', duration: 15, description: 'Marcações e movimentações nos cantos.' },
      { id: '3', name: 'Livres Directos', duration: 12, description: 'Remates directos e colocados.' },
      { id: '4', name: 'Livres Indirectos', duration: 12, description: 'Combinações em livres laterais.' },
      { id: '5', name: 'Laterais em Zona Ofensiva', duration: 10, description: 'Lançamentos longos e curtos.' },
      { id: '6', name: 'Retorno à Calma', duration: 6, description: 'Alongamentos.' },
    ],
    is_system_template: true,
  },
  // TRANSITIONS
  {
    name: 'Transições Ofensivas e Defensivas',
    description: 'Trabalho de transições após ganhar/perder a bola.',
    age_group: 'sub-17',
    focus_area: 'transitions',
    duration_minutes: 85,
    exercises: [
      { id: '1', name: 'Aquecimento Intenso', duration: 12, description: 'Sprints curtos e mudanças de direção.' },
      { id: '2', name: 'Transição Ofensiva 3x2', duration: 15, description: 'Após recuperação, atacar rapidamente.' },
      { id: '3', name: 'Transição Defensiva', duration: 15, description: 'Após perda, pressão imediata.' },
      { id: '4', name: 'Jogo com Transições', duration: 25, description: 'Golos em transição valem mais.' },
      { id: '5', name: 'Trabalho de Intensidade', duration: 10, description: 'Repetições de alta intensidade.' },
      { id: '6', name: 'Recuperação', duration: 8, description: 'Alongamentos e hidratação.' },
    ],
    is_system_template: true,
  },
  // YOUNG KIDS TEMPLATES
  {
    name: 'Treino Lúdico - Petizes',
    description: 'Treino divertido para os mais novos com jogos e brincadeiras.',
    age_group: 'sub-9',
    focus_area: 'technical',
    duration_minutes: 50,
    exercises: [
      { id: '1', name: 'Jogo da Apanhada', duration: 8, description: 'Aquecimento divertido com bola.' },
      { id: '2', name: 'Estafetas com Bola', duration: 10, description: 'Equipas competem em percursos.' },
      { id: '3', name: 'Rei da Bola', duration: 8, description: 'Proteger a bola no quadrado.' },
      { id: '4', name: 'Mini Jogos 3x3', duration: 18, description: 'Jogos rápidos com balizas pequenas.' },
      { id: '5', name: 'Jogos de Coordenação', duration: 6, description: 'Brincadeiras finais.' },
    ],
    is_system_template: true,
  },
];

const FOCUS_AREA_ICONS: Record<string, React.ReactNode> = {
  offensive: <Zap className="w-4 h-4" />,
  defensive: <ShieldCheck className="w-4 h-4" />,
  physical: <Dumbbell className="w-4 h-4" />,
  default: <Target className="w-4 h-4" />,
};

export function TrainingBuilder() {
  const { user } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Filters for templates
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all');
  const [filterFocusArea, setFilterFocusArea] = useState<string>('all');
  
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    age_group: '',
    objectives: '',
    tactical_notes: '',
    diagram_url: '',
    training_date: '',
  });

  useEffect(() => {
    if (user) {
      fetchTrainings();
      fetchTemplates();
    }
  }, [user]);

  const fetchTrainings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('coach_trainings')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setTrainings((data || []).map(t => ({
        ...t,
        exercises: (t.exercises as unknown as Exercise[]) || [],
      })));
    } catch (error) {
      console.error('Error fetching trainings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      // Fetch user templates from database
      const { data, error } = await supabase
        .from('training_templates')
        .select('*')
        .eq('owner_id', user?.id)
        .order('name');

      if (error) throw error;
      
      const userTemplates = (data || []).map(t => ({
        ...t,
        exercises: (t.exercises as unknown as Exercise[]) || [],
      }));

      // Combine system templates with user templates
      const systemTemplatesWithIds = SYSTEM_TEMPLATES.map((t, index) => ({
        ...t,
        id: `system-${index}`,
      }));

      setTemplates([...systemTemplatesWithIds, ...userTemplates]);
    } catch (error) {
      console.error('Error fetching templates:', error);
      // Still show system templates even if fetch fails
      setTemplates(SYSTEM_TEMPLATES.map((t, index) => ({
        ...t,
        id: `system-${index}`,
      })));
    }
  };

  const [pickerOpen, setPickerOpen] = useState(false);

  const addExercise = () => {
    setExercises(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: '',
        duration: 10,
        description: '',
      },
    ]);
  };

  const updateExercise = (id: string, field: keyof Exercise, value: string | number) => {
    setExercises(prev => prev.map(ex =>
      ex.id === id ? { ...ex, [field]: value } : ex
    ));
  };

  const removeExercise = (id: string) => {
    setExercises(prev => prev.filter(ex => ex.id !== id));
  };

  const handleExerciseImageUpload = async (exerciseId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/exercises/${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('coach-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: signed, error: signedError } = await supabase.storage
        .from('coach-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      if (signedError || !signed?.signedUrl) throw signedError ?? new Error('Falha ao assinar URL');

      updateExercise(exerciseId, 'image_url', signed.signedUrl);
      toast.success('Imagem carregada!');
    } catch (error: any) {
      toast.error('Erro ao carregar imagem: ' + error.message);
    }
  };

  const calculateTotalDuration = () => {
    return exercises.reduce((sum, ex) => sum + (ex.duration || 0), 0);
  };

  const applyTemplate = (template: Template) => {
    setForm({
      name: `${template.name} - Cópia`,
      description: template.description || '',
      age_group: template.age_group || '',
      objectives: '',
      tactical_notes: '',
      diagram_url: '',
      training_date: '',
    });
    setExercises(template.exercises.map(ex => ({
      ...ex,
      id: Date.now().toString() + Math.random(),
    })));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.name) {
      toast.error('Preencha o nome do treino');
      return;
    }

    setSaving(true);
    try {
      const data = {
        coach_id: user.id,
        owner_id: user.id,
        name: form.name,
        description: form.description || null,
        age_group: form.age_group || null,
        objectives: form.objectives || null,
        exercises: JSON.parse(JSON.stringify(exercises)),
        tactical_notes: form.tactical_notes || null,
        diagram_url: form.diagram_url || null,
        duration_minutes: calculateTotalDuration(),
        training_date: form.training_date || null,
        status: 'draft',
      };

      if (editingId) {
        const { error } = await supabase
          .from('coach_trainings')
          .update(data)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Treino atualizado!');
      } else {
        const { error } = await supabase
          .from('coach_trainings')
          .insert(data);
        if (error) throw error;
        toast.success('Treino criado!');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchTrainings();
    } catch (error: any) {
      toast.error('Erro ao guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      age_group: '',
      objectives: '',
      tactical_notes: '',
      diagram_url: '',
      training_date: '',
    });
    setExercises([]);
    setEditingId(null);
  };

  const editTraining = (training: Training) => {
    setForm({
      name: training.name,
      description: training.description || '',
      age_group: training.age_group || '',
      objectives: training.objectives || '',
      tactical_notes: training.tactical_notes || '',
      diagram_url: training.diagram_url || '',
      training_date: training.training_date || '',
    });
    setExercises(training.exercises);
    setEditingId(training.id);
    setDialogOpen(true);
  };

  const deleteTraining = async (id: string) => {
    if (!confirm('Eliminar este treino?')) return;

    try {
      const { error } = await supabase
        .from('coach_trainings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Treino eliminado');
      fetchTrainings();
    } catch (error: any) {
      toast.error('Erro ao eliminar: ' + error.message);
    }
  };

  const getAgeGroupLabel = (group: string | null) => {
    if (!group) return null;
    return AGE_GROUPS.find(a => a.value === group)?.label || group;
  };

  const getFocusAreaLabel = (area: string | null) => {
    if (!area) return null;
    return FOCUS_AREAS.find(f => f.value === area)?.label || area;
  };

  const getFocusAreaIcon = (area: string | null) => {
    if (!area) return FOCUS_AREA_ICONS.default;
    return FOCUS_AREA_ICONS[area] || FOCUS_AREA_ICONS.default;
  };

  // Filter templates based on selected filters
  const filteredTemplates = templates.filter(template => {
    const matchesAge = filterAgeGroup === 'all' || template.age_group === filterAgeGroup;
    const matchesFocus = filterFocusArea === 'all' || template.focus_area === filterFocusArea;
    return matchesAge && matchesFocus;
  });

  // Group templates by focus area for display
  const templatesByFocusArea = FOCUS_AREAS.reduce((acc, area) => {
    const areaTemplates = filteredTemplates.filter(t => t.focus_area === area.value);
    if (areaTemplates.length > 0) {
      acc[area.value] = areaTemplates;
    }
    return acc;
  }, {} as Record<string, Template[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-pulse">A carregar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="trainings">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="trainings">Meus Treinos</TabsTrigger>
            <TabsTrigger value="templates">Biblioteca de Treinos</TabsTrigger>
          </TabsList>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Treino
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Treino' : 'Criar Novo Treino'}</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="info">Informações</TabsTrigger>
                  <TabsTrigger value="exercises">Exercícios</TabsTrigger>
                  <TabsTrigger value="visual" className="flex items-center gap-1">
                    <Pencil className="w-3 h-3" />
                    Editor Visual
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label>Nome do Treino *</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Treino Tático - Transições"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Escalão</Label>
                      <Select
                        value={form.age_group}
                        onValueChange={(v) => setForm(prev => ({ ...prev, age_group: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGE_GROUPS.map((group) => (
                            <SelectItem key={group.value} value={group.value}>
                              {group.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Data do Treino</Label>
                      <Input
                        type="date"
                        value={form.training_date}
                        onChange={(e) => setForm(prev => ({ ...prev, training_date: e.target.value }))}
                      />
                    </div>
                    
                    <div className="col-span-2 space-y-2">
                      <Label>Objetivos</Label>
                      <Textarea
                        value={form.objectives}
                        onChange={(e) => setForm(prev => ({ ...prev, objectives: e.target.value }))}
                        placeholder="O que pretende alcançar com este treino..."
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Tactical Notes */}
                  <div className="space-y-2">
                    <Label>Notas Táticas</Label>
                    <Textarea
                      value={form.tactical_notes}
                      onChange={(e) => setForm(prev => ({ ...prev, tactical_notes: e.target.value }))}
                      placeholder="Observações táticas, ajustes, pontos de atenção..."
                      rows={3}
                    />
                  </div>

                  {form.diagram_url && (
                    <div className="space-y-2">
                      <Label>Diagrama do Treino</Label>
                      <img 
                        src={form.diagram_url} 
                        alt="Diagrama do treino" 
                        className="max-w-full h-auto rounded-lg border"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="exercises" className="space-y-6">

                {/* Exercises */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Exercícios</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {calculateTotalDuration()} min
                      </Badge>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                        <Dumbbell className="w-4 h-4 mr-1" />
                        Dos exercícios
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={addExercise}>
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar
                      </Button>
                      <DrillPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(ex) => setExercises((prev) => [...prev, ex])} />
                    </div>
                  </div>
                  
                  {exercises.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground">
                          Adicione exercícios ao seu treino
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {exercises.map((exercise, index) => (
                        <Card key={exercise.id} className="bg-secondary/30">
                          <CardContent className="pt-4">
                            <div className="flex gap-3">
                              <div className="flex flex-col items-center gap-1">
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{index + 1}</span>
                              </div>
                              
                              <div className="flex-1 space-y-3">
                                <div className="grid grid-cols-4 gap-2">
                                  <div className="col-span-2">
                                    <Input
                                      value={exercise.name}
                                      onChange={(e) => updateExercise(exercise.id, 'name', e.target.value)}
                                      placeholder="Nome do exercício"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min="1"
                                        value={exercise.duration}
                                        onChange={(e) => updateExercise(exercise.id, 'duration', parseInt(e.target.value) || 0)}
                                      />
                                      <span className="text-xs text-muted-foreground">min</span>
                                    </div>
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive"
                                      onClick={() => removeExercise(exercise.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                
                                {exercise.diagram && exercise.diagram.length > 0 && (
                                  <AnimatedDrill elements={exercise.diagram} anim={exercise.anim} title={exercise.name} compact className="max-w-md" />
                                )}
                                <Textarea
                                  value={exercise.description}
                                  onChange={(e) => updateExercise(exercise.id, 'description', e.target.value)}
                                  placeholder="Descrição do exercício..."
                                  rows={2}
                                />
                                
                                <div className="flex items-center gap-2">
                                  {exercise.image_url ? (
                                    <div className="relative">
                                      <img
                                        src={exercise.image_url}
                                        alt="Exercício"
                                        className="h-16 w-24 object-cover rounded"
                                      />
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute -top-2 -right-2 h-5 w-5"
                                        onClick={() => updateExercise(exercise.id, 'image_url', '')}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="relative">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleExerciseImageUpload(exercise.id, e)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      />
                                      <Button type="button" variant="outline" size="sm">
                                        <Upload className="w-4 h-4 mr-1" />
                                        Imagem
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                </TabsContent>

                <TabsContent value="visual" className="space-y-4">
                  <TrainingFieldEditor 
                    sportType="football"
                    onSave={(dataUrl) => setForm(prev => ({ ...prev, diagram_url: dataUrl }))}
                    initialData={form.diagram_url}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'A guardar...' : 'Guardar Treino'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="trainings">
          {trainings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sem Treinos</h3>
                <p className="text-muted-foreground mb-4">
                  Crie o seu primeiro plano de treino ou use um modelo da biblioteca
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Treino
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {trainings.map((training) => (
                <Card key={training.id} className="group">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{training.name}</CardTitle>
                        <CardDescription>
                          {training.training_date 
                            ? format(new Date(training.training_date), 'dd MMM yyyy', { locale: pt })
                            : 'Sem data definida'
                          }
                        </CardDescription>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => editTraining(training)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteTraining(training.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {training.age_group && (
                        <Badge variant="secondary">{getAgeGroupLabel(training.age_group)}</Badge>
                      )}
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {training.duration_minutes} min
                      </Badge>
                      <Badge variant="outline">
                        {training.exercises.length} exercícios
                      </Badge>
                    </div>
                    
                    {training.objectives && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {training.objectives}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtrar:</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Escalão:</Label>
                  <Select value={filterAgeGroup} onValueChange={setFilterAgeGroup}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os escalões</SelectItem>
                      {AGE_GROUPS.map((group) => (
                        <SelectItem key={group.value} value={group.value}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm">Estilo:</Label>
                  <Select value={filterFocusArea} onValueChange={setFilterFocusArea}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os estilos</SelectItem>
                      {FOCUS_AREAS.map((area) => (
                        <SelectItem key={area.value} value={area.value}>
                          {area.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(filterAgeGroup !== 'all' || filterFocusArea !== 'all') && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setFilterAgeGroup('all');
                      setFilterFocusArea('all');
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sem resultados</h3>
                <p className="text-muted-foreground">
                  Não foram encontrados treinos com os filtros selecionados
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(templatesByFocusArea).map(([focusArea, areaTemplates]) => (
                <div key={focusArea}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {getFocusAreaIcon(focusArea)}
                    </div>
                    <h3 className="text-lg font-semibold">{getFocusAreaLabel(focusArea)}</h3>
                    <Badge variant="secondary">{areaTemplates.length} treinos</Badge>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {areaTemplates.map((template) => (
                      <Card key={template.id} className="group hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{template.name}</CardTitle>
                              {template.is_system_template && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  Modelo do Sistema
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {template.age_group && (
                              <Badge variant="outline">{getAgeGroupLabel(template.age_group)}</Badge>
                            )}
                            <Badge variant="outline">
                              <Clock className="w-3 h-3 mr-1" />
                              {template.duration_minutes} min
                            </Badge>
                            <Badge variant="outline">
                              {template.exercises.length} exercícios
                            </Badge>
                          </div>
                          
                          {template.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => applyTemplate(template)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Usar este modelo
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

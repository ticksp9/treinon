import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { POSITIONS, FOOT_OPTIONS, ID_DOCUMENT_TYPES } from '@/lib/player-constants';
import { Loader2, User, Users, FileText } from 'lucide-react';

const playerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  number: z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? null : v),
    z.number().min(1).max(99).optional().nullable(),
  ),
  position: z.string().optional(),
  birth_date: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  birth_place: z.string().optional(),
  nationality: z.string().optional(),
  height_cm: z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? null : v),
    z.number().min(100).max(250).optional().nullable(),
  ),
  weight_kg: z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? null : v),
    z.number().min(30).max(150).optional().nullable(),
  ),
  foot: z.string().optional(),
  gender: z.enum(['male', 'female']).default('male'),
  notes: z.string().optional(),
  team_id: z.string().optional(),
  // Contact info
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  // ID Document
  id_document_type: z.string().optional(),
  id_document_number: z.string().optional(),
  id_document_expiry: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  tax_id: z.string().optional(),
  // Federation & Medical
  federation_id: z.string().optional(),
  medical_certificate_expiry: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  // Parent 1
  parent_name: z.string().optional(),
  parent_email: z.string().email('Email inválido').optional().or(z.literal('')),
  parent_phone: z.string().optional(),
  // Parent 2
  parent_name_2: z.string().optional(),
  parent_email_2: z.string().email('Email inválido').optional().or(z.literal('')),
  parent_phone_2: z.string().optional(),
});

type PlayerFormData = z.infer<typeof playerSchema>;

interface Team {
  id: string;
  name: string;
  sport_type: string;
  category?: string | null;
}

interface PlayerFormProps {
  defaultValues?: Partial<PlayerFormData>;
  onSubmit: (data: PlayerFormData) => void;
  isLoading?: boolean;
  sportType?: string;
  teams?: Team[];
  showTeamSelector?: boolean;
  selectedTeamId?: string;
}

export function PlayerForm({ 
  defaultValues, 
  onSubmit, 
  isLoading, 
  sportType = 'football_11',
  teams = [],
  showTeamSelector = false,
  selectedTeamId,
}: PlayerFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: '',
      number: null,
      position: '',
      birth_date: '',
      birth_place: '',
      nationality: '',
      height_cm: null,
      weight_kg: null,
      foot: '',
      gender: 'male',
      notes: '',
      team_id: selectedTeamId || '',
      email: '',
      phone: '',
      address: '',
      id_document_type: '',
      id_document_number: '',
      id_document_expiry: '',
      tax_id: '',
      federation_id: '',
      medical_certificate_expiry: '',
      parent_name: '',
      parent_email: '',
      parent_phone: '',
      parent_name_2: '',
      parent_email_2: '',
      parent_phone_2: '',
      ...defaultValues,
    },
  });

  const position = watch('position');
  const foot = watch('foot');
  const gender = watch('gender');
  const teamId = watch('team_id');
  const idDocumentType = watch('id_document_type');
  
  // Determine sport type based on selected team
  const selectedTeam = teams.find(t => t.id === teamId);
  const effectiveSportType = selectedTeam?.sport_type || sportType;
  const isFutsal = effectiveSportType === 'futsal';
  const positions = isFutsal ? POSITIONS.futsal : POSITIONS.football;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Tabs defaultValue="player" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="player" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Dados</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
          <TabsTrigger value="parents" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Encarregados</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="player" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            {showTeamSelector && teams.length > 0 && (
              <div className="col-span-2 space-y-2">
                <Label>Equipa *</Label>
                <Select value={teamId || ''} onValueChange={(v) => setValue('team_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar equipa" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} {team.category && `(${team.category})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Nome do jogador"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input
                id="number"
                type="number"
                {...register('number', { valueAsNumber: true })}
                placeholder="1-99"
              />
            </div>

            <div className="space-y-2">
              <Label>Género *</Label>
              <Select value={gender || 'male'} onValueChange={(v) => setValue('gender', v as 'male' | 'female')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Jogadoras podem jogar em equipas masculinas até 2 anos acima
              </p>
            </div>

            <div className="space-y-2">
              <Label>Posição</Label>
              <Select value={position || ''} onValueChange={(v) => setValue('position', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((pos) => (
                    <SelectItem key={pos.value} value={pos.value}>
                      {pos.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                {...register('birth_date')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birth_place">Local de Nascimento</Label>
              <Input
                id="birth_place"
                {...register('birth_place')}
                placeholder="Cidade, País"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationality">Nacionalidade</Label>
              <Input
                id="nationality"
                {...register('nationality')}
                placeholder="Portugal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="height_cm">Altura (cm)</Label>
              <Input
                id="height_cm"
                type="number"
                {...register('height_cm', { valueAsNumber: true })}
                placeholder="175"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight_kg">Peso (kg)</Label>
              <Input
                id="weight_kg"
                type="number"
                {...register('weight_kg', { valueAsNumber: true })}
                placeholder="70"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Pé Dominante</Label>
              <Select value={foot || ''} onValueChange={(v) => setValue('foot', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {FOOT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 border-t pt-4 mt-2">
              <h4 className="font-medium mb-3">Contacto do Jogador</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="jogador@email.com"
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    placeholder="+351 912 345 678"
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="address">Morada</Label>
              <Input
                id="address"
                {...register('address')}
                placeholder="Rua, número, código postal, cidade"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Observações sobre o jogador..."
                rows={3}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-4">
          {/* ID Document */}
          <div className="space-y-4">
            <h4 className="font-medium text-primary">Documento de Identificação</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={idDocumentType || ''} onValueChange={(v) => setValue('id_document_type', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ID_DOCUMENT_TYPES.map((doc) => (
                      <SelectItem key={doc.value} value={doc.value}>
                        {doc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_document_number">Número do Documento</Label>
                <Input
                  id="id_document_number"
                  {...register('id_document_number')}
                  placeholder="123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_document_expiry">Data de Validade</Label>
                <Input
                  id="id_document_expiry"
                  type="date"
                  {...register('id_document_expiry')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id">NIF / Identificação Fiscal</Label>
                <Input
                  id="tax_id"
                  {...register('tax_id')}
                  placeholder="Número de contribuinte"
                />
              </div>
            </div>
          </div>

          {/* Federation & Medical */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-primary">Federação e Saúde</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="federation_id">Número de Federado</Label>
                <Input
                  id="federation_id"
                  {...register('federation_id')}
                  placeholder="Número de registo na federação"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medical_certificate_expiry">Validade do Atestado Médico</Label>
                <Input
                  id="medical_certificate_expiry"
                  type="date"
                  {...register('medical_certificate_expiry')}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="parents" className="space-y-6 mt-4">
          {/* Parent 1 */}
          <div className="space-y-4">
            <h4 className="font-medium text-primary">Encarregado de Educação 1</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_name">Nome</Label>
                <Input
                  id="parent_name"
                  {...register('parent_name')}
                  placeholder="Nome do encarregado"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parent_email">Email</Label>
                  <Input
                    id="parent_email"
                    type="email"
                    {...register('parent_email')}
                    placeholder="email@exemplo.com"
                  />
                  {errors.parent_email && <p className="text-xs text-destructive">{errors.parent_email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_phone">Telefone</Label>
                  <Input
                    id="parent_phone"
                    {...register('parent_phone')}
                    placeholder="+351 912 345 678"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Parent 2 */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-muted-foreground">Encarregado de Educação 2 (opcional)</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_name_2">Nome</Label>
                <Input
                  id="parent_name_2"
                  {...register('parent_name_2')}
                  placeholder="Nome do encarregado"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parent_email_2">Email</Label>
                  <Input
                    id="parent_email_2"
                    type="email"
                    {...register('parent_email_2')}
                    placeholder="email@exemplo.com"
                  />
                  {errors.parent_email_2 && <p className="text-xs text-destructive">{errors.parent_email_2.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_phone_2">Telefone</Label>
                  <Input
                    id="parent_phone_2"
                    {...register('parent_phone_2')}
                    placeholder="+351 912 345 678"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  );
}

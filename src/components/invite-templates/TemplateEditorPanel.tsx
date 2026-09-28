import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Save, ArrowLeft, AlertTriangle, CheckCircle2, Mail, Phone, MessageCircle, ShieldCheck, Info, RotateCcw, GitCompare } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateInviteTemplate,
  useUpdateInviteTemplate,
  useTemplateVersions,
  useTemplateEvents,
  useRollbackTemplate,
  type InviteTemplate,
  type TemplateVersion,
} from '@/hooks/useInviteTemplatesAdmin';
import {
  VARIABLE_CATALOG,
  DEFAULT_PREVIEW_DATA,
  validateTemplate,
  previewTemplate,
  estimateSmsLength,
  parseTemplate,
  type DeliveryChannel,
  type ProfileType,
} from '@/lib/template-engine';

const PROFILE_OPTIONS = [
  { value: 'guardian', label: 'Encarregado' },
  { value: 'player', label: 'Atleta' },
  { value: 'coach', label: 'Treinador' },
  { value: 'assistant_coach', label: 'Adjunto' },
  { value: 'staff', label: 'Staff' },
];

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

interface Props {
  template: InviteTemplate | null;
  isCreating: boolean;
  onClose: () => void;
}

export function TemplateEditorPanel({ template, isCreating, onClose }: Props) {
  const createTemplate = useCreateInviteTemplate();
  const updateTemplate = useUpdateInviteTemplate();
  const rollbackTemplate = useRollbackTemplate();
  const { data: versions = [] } = useTemplateVersions(template?.id || null);
  const { data: events = [] } = useTemplateEvents(template?.id || null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [profileType, setProfileType] = useState<ProfileType>('guardian');
  const [channel, setChannel] = useState<DeliveryChannel>('email');
  const [language, setLanguage] = useState('pt');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [previewData, setPreviewData] = useState<Record<string, string>>({ ...DEFAULT_PREVIEW_DATA });
  const [editorTab, setEditorTab] = useState('preview');
  const [rollbackConfirm, setRollbackConfirm] = useState<TemplateVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<TemplateVersion | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setDescription(template.description || '');
      setTemplateKey(template.template_key);
      setProfileType(template.profile_type as ProfileType);
      setChannel(template.delivery_channel as DeliveryChannel);
      setLanguage(template.language);
      setSubject(template.subject_template || '');
      setBody(template.body_template);
      setChangeNotes('');
      setIsDirty(false);
      setCompareVersion(null);
    } else if (isCreating) {
      setName(''); setDescription(''); setTemplateKey('');
      setProfileType('guardian'); setChannel('email'); setLanguage('pt');
      setSubject(''); setBody(''); setChangeNotes('');
      setIsDirty(false); setCompareVersion(null);
    }
  }, [template, isCreating]);

  // Track dirty state
  useEffect(() => {
    if (!template) return;
    const changed = body !== template.body_template ||
      subject !== (template.subject_template || '') ||
      name !== (template.name || '') ||
      description !== (template.description || '');
    setIsDirty(changed);
  }, [body, subject, name, description, template]);

  // Validation using the engine
  const fullTemplate = body + (subject || '');
  const validation = useMemo(
    () => validateTemplate(fullTemplate, { channel, profileType }),
    [fullTemplate, channel, profileType]
  );

  const parsed = useMemo(() => parseTemplate(fullTemplate), [fullTemplate]);

  const subjectPreview = useMemo(() => {
    if (!subject) return '';
    return previewTemplate(subject, previewData).renderedText;
  }, [subject, previewData]);

  const bodyPreview = useMemo(
    () => previewTemplate(body, previewData),
    [body, previewData]
  );

  const smsInfo = useMemo(() => estimateSmsLength(bodyPreview.renderedText), [bodyPreview.renderedText]);

  const insertVariable = (key: string) => {
    const textarea = bodyRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = `{{${key}}}`;
      const newBody = body.substring(0, start) + text + body.substring(end);
      setBody(newBody);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      });
    } else {
      setBody(prev => prev + `{{${key}}}`);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!body.trim()) { toast.error('Corpo da mensagem é obrigatório'); return; }
    if (publish && validation.errors.length > 0) {
      toast.error('Corrija os erros antes de publicar: ' + validation.errors[0]);
      return;
    }

    const key = templateKey.trim() || `${profileType}_${channel}_${Date.now()}`;

    try {
      if (isCreating) {
        await createTemplate.mutateAsync({
          template_key: key,
          profile_type: profileType,
          delivery_channel: channel,
          language,
          name: name.trim(),
          description: description.trim() || undefined,
          subject_template: channel === 'email' ? subject.trim() || undefined : undefined,
          body_template: body.trim(),
          status: publish ? 'published' : 'draft',
        });
        toast.success(publish ? 'Template criado e publicado' : 'Template criado como rascunho');
      } else if (template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          name: name.trim(),
          description: description.trim(),
          subject_template: channel === 'email' ? subject.trim() : undefined,
          body_template: body.trim(),
          is_active: publish ? true : template.is_active,
          status: publish ? 'published' : template.status,
          change_notes: changeNotes.trim() || undefined,
        });
        toast.success('Template atualizado');
      }
      setIsDirty(false);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao guardar template');
    }
  };

  const handleRollback = async () => {
    if (!rollbackConfirm || !template) return;
    try {
      await rollbackTemplate.mutateAsync({ templateId: template.id, version: rollbackConfirm });
      setBody(rollbackConfirm.body_template);
      setSubject(rollbackConfirm.subject_template || '');
      toast.success(`Rollback para v${rollbackConfirm.version_number} aplicado`);
      setRollbackConfirm(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao fazer rollback');
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (!confirm('Tem alterações não guardadas. Deseja sair sem guardar?')) return;
    }
    onClose();
  };

  if (!isCreating && !template) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Selecione um template para editar ou crie um novo.</p>
      </div>
    );
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending || rollbackTemplate.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h3 className="font-semibold text-sm">{isCreating ? 'Novo Template' : `Editar: ${name}`}</h3>
        {isDirty && <Badge variant="secondary" className="text-[10px]">Alterações não guardadas</Badge>}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        {/* Left: Editor */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Meta fields */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Convite guardian email PT" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Chave interna</Label>
                  <Input value={templateKey} onChange={e => setTemplateKey(e.target.value)} placeholder="auto-gerada" disabled={!isCreating} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição breve do template" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Perfil *</Label>
                  <Select value={profileType} onValueChange={v => setProfileType(v as ProfileType)} disabled={!isCreating}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROFILE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Canal *</Label>
                  <Select value={channel} onValueChange={v => setChannel(v as DeliveryChannel)} disabled={!isCreating}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNEL_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Idioma</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">Português</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subject (email only) */}
              {channel === 'email' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Assunto do email</Label>
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto do email..." />
                </div>
              )}

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Corpo da mensagem *</Label>
                  {channel === 'sms' && (
                    <span className={`text-[10px] ${smsInfo.chars > 160 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {smsInfo.chars} chars · {smsInfo.segments} segmento(s)
                    </span>
                  )}
                </div>
                <Textarea
                  ref={bodyRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Escreva o template aqui. Use {{variavel}} para inserir dados dinâmicos."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              {/* Variable chips */}
              <div>
                <Label className="text-xs text-muted-foreground">Inserir variável:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {VARIABLE_CATALOG.filter(v =>
                    v.supportedChannels.includes(channel) &&
                    v.supportedProfiles.includes(profileType)
                  ).map(v => (
                    <button
                      key={v.key}
                      type="button"
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => insertVariable(v.key)}
                      title={`${v.description}${v.required ? ' (obrigatória)' : ''}`}
                    >
                      {v.required && <span className="text-destructive mr-0.5">*</span>}
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation feedback */}
              {(validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="space-y-1">
                  {validation.errors.map((e, i) => (
                    <Alert key={`e-${i}`} variant="destructive" className="py-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <AlertDescription className="text-xs">{e}</AlertDescription>
                    </Alert>
                  ))}
                  {validation.warnings.map((w, i) => (
                    <Alert key={`w-${i}`} className="py-2 border-amber-200 bg-amber-50/50">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-700">{w}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Variables found summary */}
              {parsed.variablesFound.length > 0 && (
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-medium text-foreground">{parsed.variablesFound.length}</span> variáveis válidas encontradas
                    {bodyPreview.variablesWithFallback.length > 0 && (
                      <span className="ml-1">· {bodyPreview.variablesWithFallback.length} com fallback</span>
                    )}
                  </div>
                </div>
              )}

              {/* Change notes on edit */}
              {!isCreating && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Notas da alteração</Label>
                  <Input value={changeNotes} onChange={e => setChangeNotes(e.target.value)} placeholder="Ex: Corrigido texto do assunto" />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
                <Button variant="secondary" onClick={() => handleSave(false)} disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  <Save className="h-4 w-4 mr-1" /> Guardar rascunho
                </Button>
                <Button onClick={() => handleSave(true)} disabled={isPending || validation.errors.length > 0}>
                  {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Publicar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview + History */}
        <div className="space-y-4">
          <Tabs value={editorTab} onValueChange={setEditorTab}>
            <TabsList className="w-full">
              <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    Preview — {channel.toUpperCase()}
                    <Badge variant="outline" className="text-[9px] ml-auto">Motor seguro</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {channel === 'email' ? (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-3 py-2 border-b">
                        <p className="text-[10px] text-muted-foreground">De: TaticalSoccer</p>
                        <p className="text-xs font-medium">{subjectPreview || '(sem assunto)'}</p>
                      </div>
                      <div className="p-3">
                        <pre className="whitespace-pre-wrap text-xs font-sans leading-relaxed">{bodyPreview.renderedText}</pre>
                      </div>
                    </div>
                  ) : channel === 'whatsapp' ? (
                    <div className="bg-muted rounded-lg p-3">
                      <div className="bg-background rounded-lg p-3 shadow-sm max-w-[280px]">
                        <pre className="whitespace-pre-wrap text-xs font-sans">{bodyPreview.renderedText}</pre>
                        <p className="text-[10px] text-muted-foreground text-right mt-1">10:30 ✓✓</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <pre className="whitespace-pre-wrap text-xs font-sans">{bodyPreview.renderedText}</pre>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {smsInfo.chars} caracteres · {smsInfo.segments} segmento(s)
                      </p>
                    </div>
                  )}

                  {/* Render diagnostics */}
                  {bodyPreview.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {bodyPreview.warnings.map((w, i) => (
                        <div key={i} className="flex items-center gap-1 text-[10px] text-amber-600">
                          <Info className="h-3 w-3" /> {w}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Compare view */}
                  {compareVersion && (
                    <div className="mt-3 border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <GitCompare className="h-3 w-3" /> Comparação com v{compareVersion.version_number}
                        </span>
                        <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setCompareVersion(null)}>
                          Fechar
                        </Button>
                      </div>
                      <div className="bg-muted/30 rounded p-2 text-xs">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Conteúdo v{compareVersion.version_number}:</p>
                        <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">{compareVersion.body_template}</pre>
                      </div>
                    </div>
                  )}

                  {/* Preview data editor */}
                  <details className="mt-3">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                      Editar dados de teste
                    </summary>
                    <div className="mt-2 space-y-1.5 max-h-[250px] overflow-y-auto">
                      {VARIABLE_CATALOG.map(v => (
                        <div key={v.key} className="flex items-center gap-2">
                          <Label className="text-[10px] w-28 shrink-0 truncate" title={v.description}>
                            {v.required && <span className="text-destructive">*</span>}
                            {v.label}
                          </Label>
                          <Input
                            className="h-7 text-xs"
                            value={previewData[v.key] || ''}
                            onChange={e => setPreviewData(prev => ({ ...prev, [v.key]: e.target.value }))}
                            placeholder={v.defaultFallback || ''}
                          />
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-6 mt-1"
                        onClick={() => setPreviewData({ ...DEFAULT_PREVIEW_DATA })}
                      >
                        Repor dados padrão
                      </Button>
                    </div>
                  </details>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardContent className="p-4">
                  {!template ? (
                    <p className="text-xs text-muted-foreground">Histórico disponível após guardar.</p>
                  ) : (
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-4">
                        {versions.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold mb-2">Versões ({versions.length})</h4>
                            <div className="space-y-2">
                              {versions.map(v => (
                                <div key={v.id} className="text-xs border rounded p-2.5">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <Badge variant="outline" className="text-[10px]">v{v.version_number}</Badge>
                                      {v.is_published && <Badge className="text-[9px]">Publicado</Badge>}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(v.created_at).toLocaleString('pt-PT')}
                                    </span>
                                  </div>
                                  {v.change_notes && (
                                    <p className="text-muted-foreground mb-1.5">{v.change_notes}</p>
                                  )}
                                  <div className="flex gap-1 mt-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] gap-1"
                                      onClick={() => setCompareVersion(compareVersion?.id === v.id ? null : v)}
                                    >
                                      <GitCompare className="h-3 w-3" />
                                      {compareVersion?.id === v.id ? 'A comparar' : 'Comparar'}
                                    </Button>
                                    {v.version_number !== template.version_number && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] gap-1 text-amber-600 hover:text-amber-700"
                                        onClick={() => setRollbackConfirm(v)}
                                      >
                                        <RotateCcw className="h-3 w-3" /> Rollback
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {events.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold mb-2">Eventos</h4>
                            <div className="space-y-1">
                              {events.map(ev => (
                                <div key={ev.id} className="text-[11px] flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[9px] shrink-0">{ev.event_type}</Badge>
                                  <span className="text-muted-foreground truncate">
                                    {new Date(ev.created_at).toLocaleString('pt-PT')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {versions.length === 0 && events.length === 0 && (
                          <p className="text-xs text-muted-foreground">Sem histórico disponível.</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Rollback confirmation */}
      <AlertDialog open={!!rollbackConfirm} onOpenChange={(open) => { if (!open) setRollbackConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar rollback</AlertDialogTitle>
            <AlertDialogDescription>
              Reverter para o conteúdo da versão {rollbackConfirm?.version_number}?
              Uma nova versão será criada com o conteúdo antigo. O histórico existente será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback}>Aplicar Rollback</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, List, Plus, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateListPanel } from '@/components/invite-templates/TemplateListPanel';
import { TemplateEditorPanel } from '@/components/invite-templates/TemplateEditorPanel';
import { TemplateVariablesCatalog } from '@/components/invite-templates/TemplateVariablesCatalog';
import type { InviteTemplate } from '@/hooks/useInviteTemplatesAdmin';
import { tx } from '@/lib/i18n/ui';

export default function InviteTemplatesAdmin() {
  const [selectedTemplate, setSelectedTemplate] = useState<InviteTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  const handleEdit = (t: InviteTemplate) => {
    setSelectedTemplate(t);
    setIsCreating(false);
    setActiveTab('editor');
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsCreating(true);
    setActiveTab('editor');
  };

  const handleViewHistory = (t: InviteTemplate) => {
    setSelectedTemplate(t);
    setIsCreating(false);
    setActiveTab('editor');
  };

  const handleEditorClose = () => {
    setSelectedTemplate(null);
    setIsCreating(false);
    setActiveTab('list');
  };

  return (
    <AppLayout title={tx('Templates de Convite')}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title={tx('Templates de Convite')}
            description={tx('Gerir templates para envio automático de convites')}
            icon={<FileText className="w-6 h-6 text-primary" />}
          />
          <Button onClick={handleCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> {tx('Novo Template')}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5">
              <List className="h-4 w-4" /> {tx('Listagem')}
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-1.5">
              <FileText className="h-4 w-4" /> {tx('Editor')}
            </TabsTrigger>
            <TabsTrigger value="variables" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> {tx('Variáveis')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <TemplateListPanel onEdit={handleEdit} onCreate={handleCreate} onViewHistory={handleViewHistory} />
          </TabsContent>

          <TabsContent value="editor" className="mt-4">
            <TemplateEditorPanel
              template={selectedTemplate}
              isCreating={isCreating}
              onClose={handleEditorClose}
            />
          </TabsContent>

          <TabsContent value="variables" className="mt-4">
            <TemplateVariablesCatalog />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/**
 * Public page: privacy policy (/privacidade). Linked from the login page, from Settings
 * and from the App Store listing (Apple requires a public URL).
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SUPPORT_EMAIL } from '@/lib/app-config';

/** Email for privacy requests (the build can override it with VITE_SUPPORT_EMAIL). */
const PRIVACY_CONTACT = SUPPORT_EMAIL || 'treinon.apoio@gmail.com';
const UPDATED = '19 de outubro de 2026';

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function Privacy() {
  const navigate = useNavigate();
  const contact = PRIVACY_CONTACT
    ? <a className="text-primary underline" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>
    : <>o contacto de suporte indicado na página do TreinON na App Store</>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Button>
        <div>
          <h1 className="text-xl font-bold">Política de privacidade</h1>
          <p className="text-xs text-muted-foreground">Atualizada a {UPDATED}</p>
        </div>

        <Section title="O que é o TreinON">
          <p>O TreinON é uma aplicação para treinadores e clubes de futebol organizarem equipas, treinos, jogos, presenças, scouting e o departamento médico. Os dados são introduzidos pelos próprios treinadores e clubes.</p>
        </Section>

        <Section title="Quem é responsável pelos dados">
          <p>Os dados de jogadores, encarregados de educação e equipas pertencem ao clube ou ao treinador que os regista, que é o responsável pelo tratamento. O TreinON trata esses dados apenas por conta deles, para prestar o serviço.</p>
          <p>Os dados da sua conta (nome e email) são tratados pelo TreinON para lhe dar acesso à aplicação.</p>
        </Section>

        <Section title="Que dados recolhemos">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Conta:</strong> nome, email e a função no clube (treinador, coordenação, fisioterapeuta, encarregado de educação…).</li>
            <li><strong>Jogadores:</strong> nome, data de nascimento, posição e dados desportivos (presenças, jogos, minutos, golos, avaliações). Se o clube os registar: morada, documento de identificação, NIF e contactos do encarregado de educação.</li>
            <li><strong>Saúde:</strong> lesões, tratamentos, exames médicos e seguro desportivo, quando o clube usa o departamento médico. Os dados clínicos só são vistos pelo médico e pelo fisioterapeuta autorizados pelo clube.</li>
            <li><strong>Fotografias e ficheiros:</strong> emblemas, fotografias de folhas de presença e documentos que o utilizador escolhe carregar.</li>
          </ul>
          <p>Não usamos publicidade, não seguimos a sua atividade noutras apps ou sites e não vendemos dados a ninguém.</p>
        </Section>

        <Section title="Crianças e jovens">
          <p>Muitos jogadores são menores. Os seus dados são registados pelo clube com o consentimento do encarregado de educação, que o pode dar ou retirar na própria aplicação. Os treinadores veem só o nome, a data de nascimento e os dados desportivos; os dados pessoais e os contactos dos pais ficam com a administração e a coordenação do clube.</p>
        </Section>

        <Section title="Para que usamos os dados">
          <p>Só para o funcionamento da aplicação: gerir equipas, convocatórias, treinos, jogos e relatórios, acompanhar lesões e enviar avisos por email ou notificação que o próprio utilizador ou o clube ativou.</p>
        </Section>

        <Section title="Onde ficam e quem nos ajuda">
          <p>Os dados ficam numa base de dados gerida pela Supabase, a aplicação é servida pela Vercel e os emails são enviados pela Brevo. Estes prestadores só tratam os dados para nos prestar esse serviço. A ligação é sempre cifrada.</p>
        </Section>

        <Section title="Durante quanto tempo">
          <p>Enquanto a conta ou o clube estiverem ativos. O clube pode exportar ou apagar os seus dados. Quando apaga a sua conta, os dados que tem fora de clubes são apagados; o que pertence a um clube fica no clube.</p>
        </Section>

        <Section id="apagar-conta" title="Apagar a sua conta">
          <p>Na aplicação (iPhone, Android ou navegador) entre na sua conta e abra <strong>Definições → Apagar a minha conta</strong>. No computador também pode fazê-lo em <a className="text-primary underline" href="/settings">treinon.vercel.app/settings</a>. A conta é apagada logo, com os dados que tem fora de clubes; o que pertence a um clube (equipas, jogadores, jogos) fica no clube.</p>
          <p>Se já não consegue entrar, peça a eliminação por email para {contact}, a partir do endereço da conta. Tratamos o pedido em até 30 dias.</p>
        </Section>

        <Section title="Os seus direitos">
          <p>Pode pedir acesso, correção, exportação ou eliminação dos seus dados. Muita coisa faz-se na própria aplicação: em <strong>Definições</strong> descarrega uma cópia dos dados e pode <strong>apagar a sua conta</strong>. Para dados de um jogador, fale com o clube dele.</p>
          <p>Para qualquer pedido sobre privacidade use {contact}. Tem também o direito de apresentar queixa à CNPD (Comissão Nacional de Proteção de Dados, www.cnpd.pt).</p>
        </Section>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Zap, ArrowRight, Timer, BookOpen, WifiOff, Share2, Users, ShieldCheck, Server, Heart, Smartphone, CheckCircle2,
} from 'lucide-react';
import { DrillDiagram } from '@/components/library/DrillDiagram';
import { DRILLS, SESSION_PLANS } from '@/lib/drill-library';
import { SUPPORT_EMAIL } from '@/lib/app-config';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const FEATURES = [
  { icon: Timer, title: 'Jogo ao vivo', text: 'Cronómetro, golos, cartões e substituições. Os minutos de cada jogador calculados sozinhos — justos para todos na formação.' },
  { icon: BookOpen, title: `${DRILLS.length} exercícios e ${SESSION_PLANS.length} treinos prontos`, text: 'Com esquema, pontos-chave e progressões, de Petizes a Seniores. Filtro "só bolas e cones" para quem tem pouco material.' },
  { icon: WifiOff, title: 'Funciona sem rede', text: 'No campo sem internet tudo fica guardado no telemóvel e sincroniza quando voltar a haver rede.' },
  { icon: Share2, title: 'Partilha no WhatsApp', text: 'Convocatórias, treinos e resultados enviados para o grupo da equipa num toque.' },
  { icon: Users, title: 'Plantel e épocas', text: 'Fichas, presenças, avaliações e passagem de escalão automática pela regra das associações.' },
  { icon: ShieldCheck, title: 'Dados protegidos', text: 'Pensado para dados de menores: acesso por perfis, pais só veem o seu filho, servidores na Europa.' },
];

const STEPS = [
  'Cria a conta (gratuita, sem cartão)',
  'Adiciona a equipa e os jogadores',
  'Instala no telemóvel e leva para o campo',
];

export default function Index() {
  const navigate = useNavigate();
  const sample = DRILLS.find((d) => d.id === 'contra-ataque-3x2-ondas') ?? DRILLS[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <nav className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="h-9 w-9 rounded-md" />
            <span className="font-display text-xl font-bold tracking-tight">TreinON</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/biblioteca')} className="hidden sm:inline-flex">Biblioteca</Button>
            <Button variant="ghost" onClick={() => navigate('/instalar')}>Instalar</Button>
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate('/auth')}>Entrar</Button>
            <Button onClick={() => navigate('/auth?tab=signup')} className="hidden sm:inline-flex">Criar conta</Button>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,hsl(var(--muted)),transparent)]" />
          <div className="container mx-auto grid items-center gap-10 px-4 py-14 md:py-20 lg:grid-cols-2">
            <div>
              <span className="mb-5 inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                <Heart className="h-4 w-4" /> Gratuita para todas as equipas
              </span>
              <h1 className="mb-5 font-display text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
                As ferramentas dos grandes clubes, <span className="gradient-text">ao alcance de qualquer equipa</span>.
              </h1>
              <p className="mb-8 max-w-xl text-lg text-muted-foreground">
                Para o treinador que faz tudo sozinho: jogo ao vivo com minutos, treinos prontos, plantel,
                convocatórias e comunicação com os pais — no telemóvel, mesmo sem rede.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate('/auth?tab=signup')} className="h-12 px-7 text-base">
                  Começar agora — é grátis <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/biblioteca')} className="h-12 px-7 text-base">
                  <BookOpen className="mr-2 h-5 w-5" /> Ver exercícios grátis
                </Button>
              </div>
              <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual: drill card + live score */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-lg border bg-card p-3 shadow-lg">
                <DrillDiagram elements={sample.diagram} title={sample.name} className="w-full rounded-lg" />
                <div className="px-1 pb-1 pt-3">
                  <p className="font-display font-semibold">{sample.name}</p>
                  <p className="text-sm text-muted-foreground">{sample.objective}</p>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-4 rounded-lg border-l-4 border-l-accent border bg-card px-4 py-3 shadow-lg sm:-left-10">
                <p className="text-xs text-muted-foreground">2.ª parte · 63'</p>
                <p className="font-mono text-2xl font-semibold">2 <span className="text-muted-foreground">–</span> 1</p>
                <p className="text-xs text-primary">Minutos atualizados ao vivo</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="mb-3 font-display text-3xl font-bold">Tudo o que um treinador precisa</h2>
            <p className="text-muted-foreground">Sem publicidade, sem funcionalidades escondidas atrás de pagamento.</p>
          </div>
          <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border bg-card p-6 transition hover:border-primary/50 hover:shadow-md">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Where the data lives */}
        <section className="border-y bg-muted/40">
          <div className="container mx-auto grid gap-8 px-4 py-14 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="mb-3 font-display text-3xl font-bold">Os dados são do clube</h2>
              <p className="mb-5 text-muted-foreground">
                Começa na nossa nuvem, sem custos. Se o clube preferir, os dados podem ficar numa conta própria na
                nuvem ou num servidor do próprio clube — a app é exatamente a mesma.
              </p>
              <ul className="space-y-2 text-sm">
                {['Instala-se em Android, iPhone, iPad e Windows', 'No servidor do clube: cópias de segurança diárias automáticas', 'Pode mudar de servidor levando os seus dados'].map((x) => (
                  <li key={x} className="flex gap-2"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />{x}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[
                { icon: Smartphone, label: 'Telemóvel' },
                { icon: Zap, label: 'Nuvem TreinON' },
                { icon: Server, label: 'Servidor do clube' },
              ].map((x) => (
                <div key={x.label} className="rounded-lg border bg-card p-5">
                  <x.icon className="mx-auto mb-2 h-7 w-7 text-primary" />
                  {x.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-16 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold">Pronto para o próximo treino?</h2>
          <Button size="lg" onClick={() => navigate('/auth?tab=signup')} className="h-12 px-8 text-base">
            Criar conta gratuita <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} TreinON · Feito para o futebol de base</p>
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground">Apoio: {SUPPORT_EMAIL}</a>
          )}
        </div>
      </footer>
    </div>
  );
}

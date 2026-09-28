import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Zap, Users, Calendar, Target, ArrowRight, Play, BarChart3 } from 'lucide-react';

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">TacticaFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate('/auth')}>Entrar</Button>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
            Gestão completa para <span className="gradient-text">treinadores</span> e <span className="gradient-text">clubes</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Controle jogos em tempo real, registe estatísticas, planeie treinos e gerencie finanças do seu clube numa única plataforma. 100% gratuito.
          </p>
          <Button size="lg" onClick={() => navigate('/auth')} className="text-lg px-8">
            Começar Agora <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Controlo de Jogos</h3>
            <p className="text-muted-foreground text-sm">Cronómetro, registo de golos, cartões e substituições em tempo real.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Quadro Tático</h3>
            <p className="text-muted-foreground text-sm">Desenhe jogadas e explique movimentos aos jogadores.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Estatísticas</h3>
            <p className="text-muted-foreground text-sm">Minutos, golos, assistências e evolução dos jogadores.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Gestão de Plantel</h3>
            <p className="text-muted-foreground text-sm">Ficha completa de jogadores com histórico.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Treinos</h3>
            <p className="text-muted-foreground text-sm">Organize sessões e controle presenças.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">Gestão de Clube</h3>
            <p className="text-muted-foreground text-sm">Controlo financeiro e múltiplas equipas.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

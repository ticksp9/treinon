# TreinON — como funciona, o que tem e o que não tem

Estado em 11 de outubro de 2026. O vídeo [treinon-como-funciona.webm](treinon-como-funciona.webm)
(cerca de 3 minutos, sem som, com legendas) mostra este percurso com uma equipa inventada.

## Passo a passo do treinador

### 1. Entrar e instalar
- Abrir https://treinon.vercel.app e entrar com a conta.
- Em **Definições → Instalar a app** está o passo a passo para iPhone, iPad, Android e computador.
- No canto superior direito escolhe-se a **época** (ex.: 2026/2027). Equipas, jogadores e jogos são os dessa época.

### 2. Equipas
- **Equipas → Nova Equipa**: nome, escalão, futebol 5/7/9/11 (ou futsal) e época.
- Dentro da equipa:
  - **Formato de jogo** — número de partes e minutos (ex.: 15' + 15' + 30').
  - **Equipa técnica** — convidar o adjunto.
  - **As nossas táticas** — as formações com que a equipa joga. Pode ter várias, dar-lhes nome,
    marcar a principal com a estrela e criar formações que não existem (ex.: 4-1-2-1).
    O desenho das posições pode ser arrastado e guardado; os adjuntos veem o mesmo desenho.

### 3. Jogadores
- **Jogadores → Novo Jogador** ou **Importar Excel**.
- Ficha do jogador: posição, pé, avaliações, evolução, treinos, jogos, minutos, lesões,
  ausências e histórico por época.
- Dados pessoais e dos pais ficam numa área reservada (ver "Num clube").

### 4. Treinos
- **Painel** e **Calendário** da semana.
- **Exercícios** e **Criar Treinos** — biblioteca de exercícios e construtor de treinos.
- **Presenças** — definem-se os dias de treino e a app gera a folha semanal; regista-se quem
  faltou e o motivo.
- **Carga** — acompanhamento da carga de treino.

### 5. Convocatória
- **Treinos → Convocatória → Novo Jogo**: adversário, data, hora, local, tipo (campeonato,
  amigável…).
- Escolhem-se os convocados. Num amigável não há limite de jogadores.
- Ao guardar, escolhe-se a quem avisar: pais, jogadores, ou ninguém. O aviso leva data, hora,
  local e adversário, por email; para WhatsApp a app abre a mensagem já escrita.
- Pais e jogadores respondem "Vou / Não vou".

### 6. Jogo — preparação
- **Jogos → Iniciar Jogo** abre a preparação.
- Escolhe-se a tática (as da equipa aparecem primeiro), põem-se os titulares no campo
  (tocar no jogador e na posição, ou arrastar) e podem mover-se livremente.
- Quem não apareceu marca-se como **Ausente** (com motivo) e sai do banco.

### 7. Jogo em direto
- Barra fixa em cima com **resultado, tempo e parte** — sempre à vista.
- **Golo / Amarelo / Vermelho**: tocar no jogador e depois no botão. No golo a app pergunta
  quem assistiu.
- **Golo adversário**: um toque.
- **Substituição**: tocar em quem sai e em quem entra, ou usar o botão. Quem entra fica na
  posição de quem saiu. Os minutos de cada jogador contam sozinhos.
- **Pausar** e **Fim da parte** / **Terminar jogo**. No intervalo pode mexer na equipa.
- O banco fica ao lado do campo. Há também a vista **Lista** e o **Quadro**.
- Pode sair deste ecrã (por exemplo para o Quadro Tático): o relógio continua e uma barra
  laranja leva de volta ao jogo.
- Depois do jogo: resultados, minutos e notas. Os amigáveis podem ser apagados em qualquer
  altura (servem para testes).

### 8. Quadro tático
- Jogadores, adversário, bola e cones; formação por linhas.
- Ferramentas: passe, corrida, curva, traço, zona, círculo, texto, borracha.
- Passos animados com velocidade ajustável; guardar, renomear e duplicar jogadas.
- O que está no quadro fica lá até carregar em **Limpar tudo**.

### 9. Eventos
- Calendário com **jogos, treinos e eventos do clube** (jantares, atividades).
- Cada evento tem "Vou / Não vou", data-limite e botão para lembrar quem ainda não respondeu.
  Todos os dias de manhã sai um lembrete automático por email.

### 10. Comunicação
- **Conversas** — grupos; o grupo da equipa recebe os membros automaticamente.
- **Anúncios** — enviados por email, com mensagem pronta para WhatsApp.

### 11. Cópia de segurança
- **Definições → Cópia de segurança**: cópia automática todas as noites (ficam as últimas 14)
  e botão para fazer e descarregar uma cópia na hora.
- O mesmo ficheiro serve para levar os dados para uma base de dados do próprio clube
  (ver [BACKUP-E-MIGRACAO.md](../BACKUP-E-MIGRACAO.md)).

## Pais e jogadores
- Só veem **Eventos** e **Comunicação**.
- Respondem "Vou / Não vou" a jogos, treinos e eventos.
- Os pais dão o consentimento RGPD na primeira entrada.

## Num clube
- **Coordenador**: recebe sempre as convocatórias e tem o menu **Alertas** — jogadores com duas
  faltas a treinos sem motivo e mensalidades em atraso (estas também por email).
- **Treinadores do clube**: veem nome, data de nascimento, treino, histórico e lesões. Não veem
  os dados pessoais dos miúdos nem dos pais. Em urgência há um botão para o contacto de
  emergência.
- **Administrador**: faz a cópia de segurança do clube inteiro e pode mudá-lo de base de dados.

## O que ainda não tem
- **Notificações push** no telemóvel. Os avisos vão por email; o WhatsApp é enviado à mão.
- **Lembretes e Automações** da Comunicação estão escondidos (ainda não enviam).
- **Fotografias e documentos** não vão na cópia de segurança.
- **Painel do coordenador** com visão geral de todos os escalões (hoje tem só os alertas).
- Ecrã para consultar quem viu contactos de emergência (o registo existe, falta o ecrã).
- Passaporte do jogador / partilha de dados entre clubes.

## O que ainda não foi testado a sério
- Fluxo completo com **contas reais de pais e jogadores** (convite, consentimento, respostas).
- **Entrega real dos emails** a muitas pessoas de uma vez.
- Atualização ao vivo entre **duas contas** (treinador e adjunto) ao mesmo tempo.
- **Reposição de uma cópia** num segundo projeto real (foi ensaiada só em local).
- Falta rever quem consegue ler o email dos perfis e as permissões da pasta de documentos
  dos jogadores.

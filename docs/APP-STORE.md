# TreinON na App Store — passo a passo

A app de iPhone/iPad já está preparada no código (pasta `ios/`). Abre o TreinON publicado em
https://treinon.vercel.app, por isso **cada atualização que sai no site chega logo à app**, sem
nova versão na App Store. Só é preciso nova versão se mudar o ícone, as permissões ou os plugins.

Como não tens Mac, a app é compilada na nuvem pelo **Codemagic** (500 minutos grátis por mês;
cada compilação demora ~10 min).

O que já está feito:
- Projeto iOS (Capacitor), identificador `pt.treinon.app`, nome **TreinON**.
- Ícone 1024×1024 e ecrã de abertura.
- Textos das permissões em português (câmara e fotografias — folha de presenças, emblema, documentos).
- PDFs: na app abrem a folha de partilha do iPhone (Ficheiros, WhatsApp, Mail, Imprimir).
- **Apagar a conta** dentro da app (Definições) — obrigatório pela Apple.
- Política de privacidade pública: https://treinon.vercel.app/privacidade
- `codemagic.yaml` com a compilação e o envio para o TestFlight.

---

## 1. App Store Connect — criar a app (10 min)

1. Entra em https://appstoreconnect.apple.com → **Apps** → **+** → **Nova app**.
2. Preenche:
   - Plataforma: **iOS**
   - Nome: **TreinON** (se já existir, por ex. *TreinON Futebol*)
   - Idioma principal: **Português (Portugal)**
   - ID do pacote (Bundle ID): **pt.treinon.app** — se não aparecer na lista, cria-o primeiro em
     https://developer.apple.com/account/resources/identifiers → **+** → *App IDs* → *App* →
     Bundle ID explícito `pt.treinon.app` (não é preciso ativar nenhuma capacidade).
   - SKU: `treinon-ios`
3. Depois de criada, abre **Informações da app** e copia o **ID Apple** (um número, ex. `6741234567`).

## 2. Chave da API (para o Codemagic poder enviar a app) (5 min)

1. App Store Connect → **Utilizadores e acesso** → separador **Integrações** → **Chaves da API da App Store Connect**.
2. **Gerar chave** → nome `Codemagic`, acesso **App Manager**.
3. Descarrega o ficheiro `.p8` (**só dá para descarregar uma vez** — guarda-o bem, não o envies a ninguém).
4. Aponta o **Issuer ID** (topo da página) e o **Key ID**.

## 3. Codemagic (10 min)

1. Cria conta em https://codemagic.io com **Entrar com GitHub** e dá acesso ao repositório `ticksp9/treinon`.
2. **Team settings → Integrations → Developer Portal → Connect**:
   - Nome da chave: **TreinON App Store** (tem de ser exatamente este nome, é o que está no `codemagic.yaml`)
   - Issuer ID, Key ID e o ficheiro `.p8` do passo 2.
3. **Team settings → codemagic.yaml settings → Code signing identities**:
   - *iOS certificates* → **Generate certificate** (tipo *Apple Distribution*) — o Codemagic cria-o por ti.
   - *iOS provisioning profiles* → **Fetch profiles** → escolhe o perfil *App Store* de `pt.treinon.app`
     (se não existir, cria-o em developer.apple.com → Profiles → **+** → *App Store Connect*).
4. No ficheiro `codemagic.yaml` troca `APP_STORE_APPLE_ID: 0` pelo ID Apple do passo 1.3
   (ou diz-me o número e eu faço isso).
5. No Codemagic abre a app **treinon** → **Start new build** → workflow **iOS → TestFlight** → ramo `main`.

Ao fim de ~15 min a app aparece no **TestFlight**. Instala a app *TestFlight* no teu iPhone e testa.

## 4. Conta de demonstração para a revisão da Apple

A Apple entra na app para a rever. Cria tu uma conta nova (por ex. `revisao.treinon@…`) com
uma equipa e jogadores **inventados** (nunca nomes reais de miúdos). Põe o email e a palavra-passe
em App Store Connect → a versão → **Informações para a revisão da app → É necessário iniciar sessão**.

## 5. Ficha da app (App Store Connect → a versão 1.0)

- **Categoria:** Desporto (secundária: Produtividade)
- **Subtítulo:** Gestão de equipas de futebol
- **Texto promocional:** Treinos, jogos, convocatórias e o departamento médico do clube, num só sítio.
- **Descrição:**

  > O TreinON é a aplicação do treinador e do clube de futebol, dos seniores aos petizes.
  >
  > • Equipas e jogadores: plantel, posições, histórico, minutos por jogos de campeonato, amigáveis e torneios.
  > • Treinos: horário semanal, planos de sessão, biblioteca de exercícios e folha de presenças em papel lida a partir de uma fotografia.
  > • Jogos: convocatória em PDF, jogo ao vivo com substituições e minutos, relatório com a tática e o onze inicial.
  > • Scouting: adversários com esquemas táticos, plano de jogo e jogadores observados.
  > • Departamento médico: lesões, fases de recuperação, protocolo de concussão, exames médicos e seguro.
  > • Clube: emblema e cores próprias, equipas técnicas, coordenação e comunicação com os pais.
  >
  > Os dados dos jovens são protegidos: os treinadores veem só o necessário para treinar.

- **Palavras-chave:** futebol,treinador,clube,treino,convocatória,escalões,formação,scouting,lesões
- **URL de suporte:** https://treinon.vercel.app
- **URL da política de privacidade:** https://treinon.vercel.app/privacidade
- **Classificação etária:** responde "Nenhum" a tudo → 4+.
- **Capturas de ecrã:** são obrigatórias de iPhone 6,9" (1320×2868) e, porque a app também corre em iPad,
  de iPad 13" (2064×2752). Posso gerá-las com dados inventados — pede-me.

## 6. Privacidade da app (App Store Connect → Privacidade da app)

- "Recolhe dados?" → **Sim**. Para cada tipo: **associado ao utilizador: Sim**, **rastreamento: Não**,
  finalidade: **Funcionalidade da app**.
  - Informações de contacto: Nome, Email, Telefone, Morada física
  - Saúde e condição física: Saúde (lesões)
  - Conteúdo do utilizador: Fotografias, Outro conteúdo do utilizador
  - Identificadores: ID do utilizador
- Não há publicidade nem rastreamento.

## 7. Enviar para revisão

Na versão 1.0 escolhe a compilação que veio do Codemagic → **Adicionar para revisão** → **Enviar**.
Costuma demorar 1 a 3 dias.

**Se a Apple recusar por "4.2 — funcionalidade mínima / site embrulhado":** responde na
Resolution Center a explicar as funções próprias da app (câmara para a folha de presenças,
partilha de PDFs, uso no campo durante o jogo). Se insistirem, a alternativa é a app levar o
TreinON dentro dela (sem depender do site) — diz-me e eu mudo.

---

## No computador (Windows/Mac) — já dá para instalar

Não é preciso loja. No **Edge** ou **Chrome** abre https://treinon.vercel.app e:
- Edge: menu **⋯** → **Aplicações** → **Instalar o TreinON**
- Chrome: ícone **Instalar** (ecrã com seta) na barra de endereço

Fica com ícone no menu Iniciar / ambiente de trabalho, abre numa janela própria sem barra do
navegador e podes afixá-lo na barra de tarefas. Fechar a janela não o desinstala: voltas a abri-lo
pelo ícone.

## Atualizar a app no futuro

- Mudanças normais (ecrãs, funções): basta publicar o site — a app recebe-as sozinha.
- Mudanças nativas (ícone, permissões, plugins): aumenta `MARKETING_VERSION` em
  `ios/App/App.xcodeproj/project.pbxproj` (ex. 1.1), corre a compilação no Codemagic e envia a nova versão para revisão.

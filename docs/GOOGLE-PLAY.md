# TreinON no Google Play — passo a passo

A app Android já está feita (pasta `android/`, identificador `pt.treinon.app`). Tal como no
iPhone, abre o TreinON publicado: as atualizações do site chegam logo à app.

**Chave de assinatura (upload key):** está em `Documentos\TreinON-chaves\` neste PC
(`treinon-upload.jks` + `LEIA-ME.txt` com a palavra-passe). Faz uma cópia de segurança dessa
pasta (pen, disco externo). Nunca vai para o GitHub nem se envia a ninguém.

---

## 1. Conta Google Play Console (25 USD, uma vez)

1. https://play.google.com/console/signup — com a conta Google do TreinON (treinon.apoio@gmail.com).
2. Tipo de conta: **Pessoal** (ou Organização, se tiveres empresa/associação com número D-U-N-S).
3. Paga os 25 USD e faz a verificação de identidade (documento) — pode demorar 1–3 dias.

> Contas **pessoais** novas têm de fazer um **teste fechado com pelo menos 12 testadores durante
> 14 dias seguidos** antes de poderem publicar para todos. Junta já 12+ emails Gmail (pais,
> treinadores, colegas) com telemóvel Android.

## 2. Criar a app

Play Console → **Criar app**:
- Nome: **TreinON** · Idioma: **Português (Portugal)** · **App** · **Gratuita**
- Aceita as declarações → **Criar app**.

## 3. Primeiro envio (manual)

O ficheiro a enviar é o **.aab**:
- Compilado no Codemagic: workflow **Android → Google Play (.aab)** → descarrega `app-release.aab` dos Artifacts
  (antes, carrega a chave no Codemagic: *Settings → Code signing identities → Android keystores* →
  upload `treinon-upload.jks`, *Keystore password* e *Key password* do LEIA-ME, *Key alias* `treinon`,
  **Reference name `treinon_upload`**);
- ou pede-me e eu compilo-o neste PC.

Play Console → **Testar e lançar → Testes → Teste fechado** → **Criar faixa** (ou usar "Alpha"):
1. **Testadores** → criar lista com os 12+ emails → guardar. Copia o **link de adesão** e envia-o aos testadores.
2. **Criar nova versão** → aceita a **Assinatura de apps do Google Play** → carrega o `.aab` → notas: "Primeira versão" → **Seguinte → Guardar → Enviar para revisão**.

Cada testador abre o link, aceita e instala pelo Play Store. Contam os 14 dias a partir daí.

## 4. Ficha e questionários (menu **Painel** → "Configurar a sua app")

- **Política de privacidade:** https://treinon.vercel.app/privacidade
- **Acesso à app:** "Todas ou algumas funcionalidades estão restritas" → dá a conta de demonstração (a mesma da Apple).
- **Anúncios:** Não contém anúncios.
- **Classificação de conteúdo:** questionário → categoria *Utilitários/Produtividade* → responde Não a tudo.
- **Público-alvo:** **18 anos ou mais** (quem usa a app são treinadores, clubes e pais — os miúdos não têm conta própria). Não é "para crianças".
- **Segurança dos dados:**
  - Recolhe dados: Sim. Encriptados em trânsito: Sim. O utilizador pode pedir eliminação: Sim.
  - Tipos: Informações pessoais (nome, email, morada, telefone, IDs do utilizador), Saúde e fitness (saúde), Fotos e ficheiros. Todos: **recolhidos, não partilhados**, finalidade **Funcionalidade da app**, obrigatórios.
  - **URL para eliminar a conta:** https://treinon.vercel.app/privacidade#apagar-conta
- **App governamental / financeira / saúde:** Não.
- **Ficha da loja:** mesmos textos da App Store (`docs/APP-STORE.md` §5). Precisa de ícone 512×512
  (`public/pwa-512x512.png`), gráfico de destaque 1024×500 e 2+ capturas de telemóvel — eu gero-os.

## 5. Produção

Passados os 14 dias com 12 testadores: **Painel → Candidatar-se a produção** → responde às perguntas
sobre o teste → depois de aprovado, **Produção → Criar nova versão** com o mesmo `.aab` (ou um mais
recente) → **Enviar para revisão**. A revisão costuma levar 1–7 dias.

## Atualizar no futuro

Como no iPhone: mudanças normais chegam sozinhas pelo site. Só é preciso novo `.aab` quando muda
o ícone, as permissões ou os plugins — o número da versão (`versionCode`) é o número da compilação do Codemagic.

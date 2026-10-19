# TreinON na Microsoft Store — passo a passo

No Windows o TreinON já se instala pelo Edge/Chrome. Na Microsoft Store passa a ter um botão
**Obter** oficial, aparece nas pesquisas da loja e atualiza-se sozinho (abre o site publicado).

Custo: **gratuito** para contas individuais.

## 1. Conta de programador (10 min + verificação)

1. https://storedeveloper.microsoft.com → **Começar** → entra com uma conta Microsoft
   (podes criar uma com treinon.apoio@gmail.com).
2. Tipo: **Individual**. Preenche nome, país (Portugal) e verifica a identidade (documento + selfie).
3. A aprovação costuma demorar de umas horas a 2 dias.

## 2. Reservar o nome

Partner Center (https://partner.microsoft.com/dashboard) → **Apps e jogos** → **Nova oferta → App** →
nome **TreinON** → **Reservar nome do produto**.

Depois, na app → **Gestão de produtos → Identidade do produto**, aponta três valores:
- **Package/Identity/Name** (ex.: `12345TreinON.TreinON`)
- **Package/Identity/Publisher** (ex.: `CN=ABCD1234-...`)
- **Package/Properties/PublisherDisplayName** (o teu nome)

## 3. Gerar o pacote (PWABuilder — da Microsoft, gratuito)

1. Abre https://www.pwabuilder.com → escreve `https://treinon.vercel.app` → **Start**.
2. **Package For Stores** → **Windows** → **Generate Package**.
3. Preenche com os três valores do passo 2 (Package ID, Publisher ID, Publisher display name).
   Versão: `1.0.0`. Deixa o resto como está → **Download Package**.
4. Recebes um `.zip` — dentro está um ficheiro `.msixbundle` (e instruções em inglês).

## 4. Enviar

Partner Center → a app TreinON → **Iniciar a submissão**:
- **Preços e disponibilidade:** Gratuito; mercados: todos (ou só Portugal).
- **Propriedades:** categoria **Desporto**; política de privacidade https://treinon.vercel.app/privacidade;
  site https://treinon.vercel.app; contacto treinon.apoio@gmail.com.
- **Classificações etárias:** questionário IARC → responde Não a tudo → fica 3+/Todos.
- **Pacotes:** arrasta o `.msixbundle` do passo 3.
- **Listagens da loja (Português - Portugal):** descrição, palavras-chave e notas iguais às da
  App Store (`docs/APP-STORE.md` §5) + capturas de ecrã de computador (1366×768 ou maiores) — eu gero-as.
- **Opções de submissão → Notas para a certificação:** a conta de demonstração (email + palavra-passe).

**Submeter para a Store.** A certificação costuma demorar 1–3 dias.

## Atualizar no futuro

O pacote abre o site publicado, por isso as atualizações chegam sozinhas. Só se gera um pacote
novo (PWABuilder, versão 1.0.1, …) se mudar o ícone ou o nome.

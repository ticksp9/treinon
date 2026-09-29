# TreinON — criar Supabase e Vercel próprios

Tempo estimado: 30–45 minutos. Precisa de: conta Supabase, conta Vercel, conta GitHub, Node.js instalado.

---

## A. Supabase (base de dados, login, funções)

1. <https://supabase.com/dashboard> → **New project**
   - Nome: `treinon` · Região: **West EU (Ireland)** ou **Central EU (Frankfurt)** (RGPD)
   - Guardar a **Database password** num sítio seguro (é pedida no passo 3).
2. Copiar o **Reference ID** (Project Settings → General), p.ex. `abcdefghijklmnop`.
3. Na pasta do projeto, em PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File distribuicao\configurar-supabase.ps1 -ProjectRef abcdefghijklmnop -AppUrl https://treinon.vercel.app
   ```
   O script faz login, cria todas as tabelas (migrações), publica as funções e configura `APP_URL`.
4. No painel da Supabase:
   - **Authentication → URL Configuration**
     - *Site URL*: `https://treinon.vercel.app` (o endereço final do Vercel)
     - *Redirect URLs*: `https://treinon.vercel.app/**` e `http://localhost:8080/**`
   - **Authentication → Rate Limits** → *Rate limit for sign ups and sign ins*: **300** por 5 min.
     (O login com *username* é feito pelo servidor, que já limita tentativas por IP e por
     utilizador; sem subir este valor, muitos logins seguidos no clube podem ser recusados.)
   - **Authentication → Emails → SMTP Settings**: configurar um SMTP próprio (p.ex. Resend)
     antes de ter clientes — o SMTP de teste da Supabase só envia poucos emails por hora.
5. Copiar para o ficheiro `.env` (e para o Vercel, passo B):
   - Project Settings → API → **Project URL** → `VITE_SUPABASE_URL`
   - **anon / publishable key** → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Reference ID → `VITE_SUPABASE_PROJECT_ID`

> A chave **service_role** nunca vai para o `.env` da app nem para o Vercel.

## B. Vercel (a app)

1. Pôr a pasta no GitHub (repositório **privado**).
2. <https://vercel.com/new> → importar o repositório (deteta Vite automaticamente).
3. **Environment Variables**: as 3 variáveis `VITE_...` do passo A.5.
4. **Deploy**. Em *Settings → Domains* pode ligar um domínio próprio (p.ex. `app.treinon.pt`);
   se o fizer, atualize *Site URL* (A.4), `APP_URL` e `ALLOWED_ORIGINS`:
   ```powershell
   npx supabase secrets set APP_URL=https://app.treinon.pt ALLOWED_ORIGINS=https://app.treinon.pt
   ```

## C. Primeiro arranque

1. Abrir o endereço → **Registar** → criar a conta do clube.
2. Criar a época 2026/2027, os escalões e as equipas.
3. Instalar nos telemóveis/tablets (ver `README.md`, secção 2).
4. Fazer um **jogo de teste completo** (com uma substituição ao intervalo e outra na 2.ª parte,
   e um golo com o modo avião ligado) antes do primeiro jogo oficial.

## D. Segurança — o que mudou nesta versão

- Login com *username*: o email deixa de ser enviado ao browser; tentativas limitadas.
- PIN de segurança: hash forte com sal (PBKDF2), bloqueio de 15 min após 5 erros,
  o hash deixou de ser legível pela app; "criar PIN" já não substitui um PIN existente.
- Email e tipo de conta do perfil deixam de poder ser alterados pelo próprio utilizador.
- As funções de login e PIN só respondem a browsers no endereço da app (`ALLOWED_ORIGINS`).

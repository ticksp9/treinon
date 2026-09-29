# TreinON no servidor do próprio clube

Os dados ficam **no servidor do clube** (nada na nuvem). Usa a Supabase oficial em
versão *self-hosted* (open-source), por isso a app, as funções e a base de dados são
exatamente as mesmas da versão na nuvem — o clube pode mudar de uma para a outra.

```
Telemóveis / tablets / PCs  ──HTTPS──►  Servidor do clube (Docker)
                                         ├─ Caddy (HTTPS, um só endereço)
                                         ├─ TreinON (a app)
                                         └─ Supabase: Postgres, login, ficheiros, funções
```

## 1. O que é preciso

| | Mínimo | Recomendado |
|---|---|---|
| Máquina | mini-PC / NAS / servidor com **Linux** (Ubuntu 22.04+ ou Debian 12) | 4 núcleos |
| Memória | 4 GB RAM | 8 GB |
| Disco | 40 GB SSD | 100 GB SSD + disco externo para cópias |
| Software | Docker + plugin `docker compose`, `git`, `openssl` | |
| Rede | IP fixo na rede do clube | domínio público (ver 2) |

Windows: funciona com **Docker Desktop + WSL (Ubuntu)**, correndo os comandos dentro do Ubuntu.

## 2. Escolher o endereço (HTTPS é obrigatório)

Sem HTTPS a app não se instala nos telemóveis nem funciona sem rede.

**A) Domínio público — recomendado** (ex.: `treinon.meuclube.pt`, ou gratuito tipo DuckDNS)
- O domínio aponta para o IP público do clube; no router, reencaminhar as portas **80 e 443**
  para o servidor. O certificado é gerado e renovado sozinho.
- Treinadores e pais acedem de qualquer sítio (casa, campo adversário, 4G).

**B) Só na rede do clube** (`--interno`)
- Funciona apenas ligado ao Wi-Fi do clube. O certificado é do próprio servidor, por isso
  **cada aparelho tem de confiar nele** uma vez (ver secção 6). Não recomendado para jogos fora.

> Nunca reencaminhar no router as portas 5432, 6543 ou 8000 (base de dados e painel).

## 3. Instalar

```bash
git clone <repositório TreinON> treinon && cd treinon
chmod +x deploy/servidor-clube/*.sh
sudo ./deploy/servidor-clube/instalar.sh treinon.meuclube.pt          # opção A
# ou
sudo ./deploy/servidor-clube/instalar.sh treinon.local --interno      # opção B
```

O instalador:
1. descarrega a Supabase oficial para `/opt/treinon/supabase`;
2. gera todas as chaves e palavras-passe (ficam em `/opt/treinon/supabase/.env`);
3. constrói a app, cria a base de dados (todas as migrações) e publica as funções;
4. agenda **cópias de segurança diárias** (03:30) em `/opt/treinon/backups`.

No fim mostra o endereço da app e a palavra-passe do painel de administração.

**Guarde uma cópia do ficheiro `.env` fora do servidor** — sem ele não é possível
recuperar a instalação.

## 4. Emails (opcional mas recomendado)

Sem email configurado, as contas ficam ativas logo ao registar (bom para começar).
Para convites e recuperação de palavra-passe por email, editar `/opt/treinon/supabase/.env`:

```
SMTP_HOST=smtp.resend.com      SMTP_PORT=465
SMTP_USER=resend               SMTP_PASS=<chave>
SMTP_ADMIN_EMAIL=treinon@meuclube.pt   SMTP_SENDER_NAME=TreinON
ENABLE_EMAIL_AUTOCONFIRM=false
RESEND_API_KEY=<chave>         EMAIL_FROM=TreinON <convites@meuclube.pt>
```
e reiniciar: `cd /opt/treinon/supabase && docker compose -f docker-compose.yml -f docker-compose.treinon.yml up -d`

## 5. Atualizar e cópias de segurança

```bash
cd treinon && git pull
sudo ./deploy/servidor-clube/atualizar.sh     # faz cópia de segurança antes
```

Repor uma cópia:
```bash
cd /opt/treinon/supabase
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists < ../backups/treinon-db-AAAA-MM-DD_HHMM.dump
```
Recomenda-se copiar `/opt/treinon/backups` para um disco externo ou outro local todas as semanas.

## 6. Modo interno: confiar no certificado

1. No servidor: `docker cp treinon-caddy:/data/caddy/pki/authorities/local/root.crt ./treinon-ca.crt`
2. Enviar `treinon-ca.crt` para cada aparelho e instalar:
   - **iPhone/iPad**: abrir o ficheiro → Definições → Perfil descarregado → Instalar;
     depois Definições → Geral → Informações → Definições de confiança de certificados → ativar.
   - **Android**: Definições → Segurança → Encriptação e credenciais → Instalar certificado → CA.
   - **Windows**: duplo clique → Instalar certificado → Máquina local →
     "Autoridades de certificação de raiz fidedignas".

## 7. Mudar entre nuvem e servidor próprio

A app é a mesma. Para migrar os dados de um lado para o outro:
```bash
pg_dump "<ligação de origem>" -Fc --no-owner -n public -n storage > treinon.dump
pg_restore -d "<ligação de destino>" --no-owner --clean --if-exists treinon.dump
```
(Os utilizadores — esquema `auth` — também têm de ser copiados; pedir apoio técnico.)

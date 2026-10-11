# Cópia de segurança e mudança de base de dados

Os dados de um clube (ou de um treinador sem clube) não ficam presos ao sítio onde estão hoje.
Há um ficheiro único — a **cópia de segurança** — que serve para as duas coisas:

1. **Guardar**: ter os dados a salvo até àquele dia.
2. **Mudar**: levar os dados para outra base de dados TreinON (um projeto Supabase do clube,
   ou o servidor do próprio clube) e continuar a trabalhar a partir de lá.

## 1. Fazer a cópia

Na aplicação: **Definições → Cópia de segurança → Descarregar cópia de segurança**.

- O **administrador do clube** recebe tudo o que é do clube.
- Um **treinador sem clube** recebe tudo o que é dele (as suas equipas fora de clubes).
- Um treinador de clube, coordenador, pai ou jogador **não** pode tirar a cópia do clube.

O ficheiro chama-se `treinon-backup-<clube>-<data>.json`.

### O que vai no ficheiro

Equipas, jogadores (incluindo os dados pessoais e dos encarregados), jogos, convocatórias,
incidências, minutos, treinos, presenças, avaliações, lesões, épocas, comunicação (grupos,
mensagens, anúncios), eventos e respostas, táticas, formações, cobranças, e a lista das
pessoas com conta (nome e email).

### O que **não** vai

- **Palavras-passe.** No destino, cada pessoa define uma nova com "Esqueci-me da palavra-passe".
- **Ficheiros carregados** (fotografias, documentos de identificação, anexos). Ficam no
  armazenamento da base de dados de origem; têm de ser copiados à parte.
- Dados de **outros clubes**, mesmo de pessoas que também pertencem a este.

> O ficheiro tem dados pessoais de menores. Guarde-o protegido (disco cifrado ou pasta com
> acesso restrito) e apague as cópias antigas de que já não precisa.

## 2. Repor ou mudar para outra base de dados

### a) Para um projeto Supabase (do clube ou outro)

1. Criar o projeto em supabase.com (conta do clube).
2. Preparar a base de dados com as tabelas da TreinON:
   ```
   powershell -ExecutionPolicy Bypass -File distribuicao\configurar-supabase.ps1 -ProjectRef <ref-do-projeto-novo>
   ```
3. Carregar a cópia:
   ```
   powershell -ExecutionPolicy Bypass -File distribuicao\restaurar-backup.ps1 -ProjectRef <ref-do-projeto-novo> -Ficheiro C:\caminho\treinon-backup-clube-2026-10-11.json
   ```
   O script pede o *Access Token* da conta Supabase **do destino** (não fica guardado).

### b) Para o servidor do clube (`deploy/servidor-clube`)

Depois de `instalar.sh` (que cria a base de dados e aplica as migrações), copiar o ficheiro
para o servidor e correr, dentro do contentor da base de dados:

```
psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "begin; set local session_replication_role = replica; select public.import_backup_data(pg_read_file('/caminho/treinon-backup.json')::jsonb); commit;"
```

### O que a reposição faz

- Cria as **contas** que faltam (com o mesmo identificador e email, sem palavra-passe).
- Carrega os **dados** tal como estavam, tabela a tabela.
- **Não apaga nada** e não altera o que já existe: um registo que já esteja no destino fica
  como está. Por isso pode correr-se duas vezes sem duplicar.
- No fim mostra o que carregou e, se for o caso, o que não conseguiu carregar.

O destino tem de estar na **mesma versão ou mais recente** do que a base de dados de onde a
cópia saiu (o script verifica).

## 3. Ligar a aplicação à nova base de dados

A aplicação escolhe a base de dados no arranque, pelo ficheiro `/config.js`:

```js
window.__TREINON_CONFIG__ = { supabaseUrl: "https://<projeto>.supabase.co", supabaseAnonKey: "<chave pública>" };
```

- **Servidor do clube**: o ficheiro é gerado no arranque (ver `deploy/servidor-clube/LEIA-ME.md`).
- **Alojamento próprio (ex.: Vercel do clube)**: publicar a aplicação com esse `config.js`,
  ou com as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do projeto novo.

Depois da mudança, as pessoas entram no endereço novo e definem a palavra-passe.

## 4. "Alguém fez asneira": voltar atrás

A reposição só acrescenta o que falta; não desfaz alterações nem apaga o que foi criado
depois da cópia. Para recuperar de um erro:

- **Registos apagados por engano**: repor a cópia na mesma base de dados traz de volta o
  que falta (o resto fica como está).
- **Registos alterados por engano** (um resultado mudado, minutos errados): a reposição
  não os corrige. Repõe-se a cópia numa base de dados **nova**, ao lado, e consulta-se lá o
  valor antigo.

## Limites conhecidos

- A cópia é feita **à mão**, quando alguém carrega no botão. Ainda não há cópias automáticas.
- A reposição num projeto Supabase real (criação de contas incluída) foi testada só numa
  base de dados de ensaio local; convém fazer um ensaio com um projeto de teste antes de uma
  mudança a sério.
- O ficheiro é um JSON sem cifra. Para um clube grande pode ter dezenas de MB.

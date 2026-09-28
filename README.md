# TreinON — O treinador ligado ao jogo

App para treinadores e clubes de futebol/futsal (formação e seniores): jogo ao vivo com
minutos jogados, treinos e presenças, convocatórias, plantéis por época, transição de
época, quadro tático, comunicação com pais, gestão do clube.

Tecnologia: React + Vite + TypeScript, Supabase (base de dados, login, funções),
instalável como app (PWA) em Windows, Android, iPhone/iPad.

---

## 1. Publicar no Vercel (uma vez)

1. Pôr esta pasta num repositório GitHub (privado).
2. Em <https://vercel.com> → **Add New → Project** → importar o repositório.
   O Vercel deteta Vite sozinho (`vercel.json` já está configurado).
3. Em **Settings → Environment Variables** criar (valores iguais aos do ficheiro `.env`, ver `.env.example`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
4. **Deploy**. Cada `git push` publica uma nova versão; as apps instaladas atualizam-se sozinhas.
5. No Supabase → **Authentication → URL Configuration**: acrescentar o endereço do Vercel
   (ex.: `https://treinon.vercel.app`) em *Site URL* / *Redirect URLs* (convites e recuperação de password).
6. Atualizar o endereço em `distribuicao/windows/Install-TreinON.cmd` (linha `APP_URL`).

## 2. Instalar nos aparelhos

| Aparelho | Como |
|---|---|
| **Android** (Chrome) | Abrir o endereço → aparece **Instalar TreinON** (ou menu ⋮ → *Instalar app*). |
| **iPhone / iPad** (Safari) | Abrir o endereço no **Safari** → botão **Partilhar** → **Adicionar ao ecrã principal**. |
| **Windows** (Edge ou Chrome) | Abrir o endereço → ícone de instalar na barra de endereço (ou menu → *Aplicações → Instalar TreinON*). Alternativa: `distribuicao/windows/Install-TreinON.cmd`. |

A app instalada abre em janela própria, fica com ícone e funciona no campo **sem rede**:
golos, cartões, substituições e fim de parte ficam guardados no aparelho e são enviados
automaticamente quando voltar a haver rede.

## 3. Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:8080
npm test           # 1055+ testes
npm run build
```

## 4. Notas de época

- A **época** é calculada automaticamente (começa a 1 de julho).
- **Escalões**: a elegibilidade usa a regra das federações (ano de nascimento), p.ex. em
  2026/27 os Sub-13 são os nascidos em 2014 e 2015. Escalões com "Sub-N"/"U-N" no nome ou
  código ajustam os anos de nascimento sozinhos a cada época.

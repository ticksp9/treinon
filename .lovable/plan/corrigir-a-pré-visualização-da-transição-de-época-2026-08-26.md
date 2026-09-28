# Corrigir a pré-visualização da transição de época

## Objetivo
Transformar o passo 3 dos dois wizards numa confirmação fiel e editável, sem alterar o desenho geral: cada jogador terá classificação, inclusão e destino explícitos, e a aplicação persistirá exatamente essa decisão.

## Alterações

### 1. Classificação e defaults únicos
- Centralizar a classificação por jogador a partir da data de nascimento, do escalão atual, dos intervalos de `academy_age_groups` e da `reference_date`.
- Aplicar estas regras em ambos os fluxos:
  - `Mantém`: mesmo escalão, incluído por defeito.
  - `Sobe`: destino calculado; incluído no clube e excluído no treinador que mantém o escalão.
  - `Sai`: sem escalão de formação elegível, excluído.
  - `Verificar`: sem data de nascimento, mantém equipa/escalão atual e fica incluído por defeito, com a nota pedida.
- Preservar o estado inativo da época anterior como não selecionado.

### 2. Pré-visualização editável no passo 3
- Manter a tabela e estilo atuais, acrescentando:
  - checkbox por jogador;
  - badges distintos para Mantém, Sobe, Sai e Verificar;
  - destino calculado visível;
  - dropdown de escalão no modo clube, marcando `manual_override=true` e ajustando a equipa compatível;
  - ações compactas para selecionar os jogadores elegíveis e repor os defaults.
- Fazer os contadores reagirem imediatamente: `Transitam X · Sobem Y · Saem Z · Verificar W · Excluídos N`.
- Usar o mesmo comportamento no `SeasonCreateWizard` e no `SeasonTransitionWizard`, sem alterar os restantes passos.

### 3. Aplicação fiel e auditável
- Bloquear a aplicação quando não existir época origem ou quando não houver nenhum jogador selecionado.
- Gerar enrollments apenas para linhas selecionadas com destino válido; `Sobe` no modo treinador e `Sai` ficam sem enrollment.
- No clube, usar o destino calculado ou o override manual.
- Persistir por jogador no payload: `player_id`, `classification`, `from_age_group`, `to_age_group`, `included`, `manual_override`, `motivo`.
- Manter a RPC transacional existente para memberships + enrollments, os erros reais da base de dados e o bloqueio de dupla aplicação.
- Verificar o resultado com `COUNT` real dos jogadores selecionados na época destino, em vez de presumir pelo tamanho do array.

### 4. Testes focados
- Plantel misto: Mantém, Sobe com destino, Sai e Verificar incluído por defeito.
- Modo treinador: apenas Mantém + Verificar selecionados transitam.
- Aplicação parcial: três exclusões não geram enrollment.
- Override de clube: destino escolhido e `manual_override=true` no payload.
- Zero selecionados bloqueado, contagem real validada e dupla aplicação preservada.

## Ficheiros previstos
- `src/lib/age-group-rules.ts`
- `src/lib/season-roster-service.ts`
- `src/lib/season-transition-service.ts`
- `src/pages/SeasonCreateWizard.tsx`
- `src/pages/SeasonTransitionWizard.tsx`
- Componente pequeno partilhado do preview, se necessário para evitar duplicar a tabela
- Testes unitários de classificação e aplicação parcial

## Validação
- TypeScript estrito.
- Testes unitários focados.
- Build e verificação visual do passo 3 em viewport desktop, sem alterações de layout fora do wizard.

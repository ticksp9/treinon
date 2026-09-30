# TreinON × Football Manager

O que o Football Manager (FM) tem de melhor e como passa para um treinador real, sobretudo na formação e em clubes com poucos meios.

## Já na app

| No FM | No TreinON | Onde |
|---|---|---|
| Ecrã tático com o onze no campo | Campo com a tática antes e durante o jogo; trocar posições, substituir, preencher posições | Jogo → Preparação / Ao vivo |
| Condição física (coração) | Frescura estimada pelo tempo seguido em campo e no banco | Jogo ao vivo |
| "Escolher equipa" do adjunto | **Melhor onze** (nota + forma + posição) e **Minutos justos** (joga quem jogou menos na época) | Jogo → Preparação |
| Relatório do adjunto | Avisos: sem guarda-redes, poucos minutos na época, quebra/boa forma | Jogo → Preparação |
| Capitão e bolas paradas | Capitão (C no campo), penáltis, cantos, livres | Jogo → Preparação |
| Notas de jogo 1–10 e melhor em campo | Notas no fim do jogo; alimentam a forma | Jogo terminado |
| Perfil do jogador | Nota atual com estrelas, forma, atributos coloridos com ▲▼, gráfico de evolução | Jogador → Resumo |
| Profundidade do plantel | Plantel por linha com nota, forma e minutos | Equipa |
| Comparar jogadores | Lado a lado: nota, forma, técnica, tática, física, mental, minutos | Equipa → tocar em 2 jogadores |

Escala: 1–10 (a que os treinadores já usam nas avaliações), não 1–20 como no FM.

## Próximas ideias (por ordem de valor para o treinador)

1. **Potencial** — além da nota atual, o treinador estima o potencial (como o PA do FM); mostra a distância entre o atual e o potencial.
2. **Plano de treino individual ligado aos atributos** — escolher 1–2 atributos a trabalhar por jogador (o "foco individual" do FM) e ver se a nota desses atributos sobe entre avaliações.
3. **Instruções de equipa** — com bola / sem bola / transições (linha defensiva, pressão, largura), guardadas por jogo e usadas na palestra.
4. **Palestra antes e ao intervalo** — notas rápidas do treinador e reação da equipa, para rever depois.
5. **Dinâmica do grupo** — empenho e presença em treinos como "moral"; alertar quem está a perder ligação.
6. **Relatório de observação do adversário** — sistema, jogadores perigosos, bolas paradas.
7. **Clube (lado da direção)** — painel com orçamento, objetivos da época por escalão e "confiança" da direção em relação a esses objetivos.

## Passaporte do jogador e dados entre clubes — preparado, não construído

Decisão do utilizador (30/09/2026): **fica só preparado para o futuro**.

Regras a respeitar quando avançar:
- Jogadores menores: partilha só com autorização do encarregado de educação, revogável, com registo de quem viu o quê (RGPD).
- Nunca vender dados de crianças identificáveis.
- Monetização possível: funções premium para clubes, estatísticas anónimas e agregadas, perfis de seniores (18+) com consentimento expresso do próprio.
- Consultar um jurista antes de lançar.

A estrutura atual já ajuda: avaliações (`player_evaluations`), notas de jogo (`match_lineups.rating`), minutos e tática por jogo (`matches.live_tactics`).

## Revisão do trabalho "Onze" (ChatGPT/Codex, set. 2026)

Versão paralela feita sobre o mesmo código original (TaticaFlow). Aproveitado no TreinON:
- só o dono ou staff "admin" é administrador do clube (antes qualquer staff);
- o service worker deixou de guardar respostas da base de dados (fuga de dados entre utilizadores no mesmo aparelho);
- limpeza da cache em memória quando muda o utilizador;
- zoom permitido (acessibilidade).

A considerar mais tarde: backup cifrado por clube, entrada por convite com código/link, plano para menores (encarregados, comunicação por idade), instaladores Windows/Android nativos (Electron/Capacitor).

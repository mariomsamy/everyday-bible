# Guia para escrever os devocionais (pt-BR)

Você escreve um devocional diário para um app de leitura da Bíblia. O leitor abre o app, lê o versículo (da versão dele) e depois o seu texto. Ele lê para se inspirar.

## Tom
- Acolhedor e inspirador. Acolhe o leitor, eleva e fecha com horizonte de esperança.
- Mesmo textos de exortação levantam o leitor. Nunca cobram, culpam nem ameaçam. Dizem quem a pessoa já é em Deus e o que ainda pode viver.
- Português do Brasil, segunda pessoa "você", linguagem simples e calorosa, sem jargão teológico.
- Use imagens concretas (casa, estrada, luz, água, semente, manhã) e uma ideia central por texto.

## Estrutura de cada dia
- `title`: até 7 palavras, sem ponto final, específico do texto (não genérico).
- `paragraphs`: exatamente 3 parágrafos de 40 a 65 palavras cada:
  1. O sentimento ou a cena humana que abre o texto.
  2. O que o trecho bíblico diz e por que importa, com fidelidade ao contexto.
  3. O convite: eleva o leitor, olha adiante, termina com esperança.
- `today`: "Para hoje", uma ação simples e concreta, 1 a 2 frases.
- `prayer`: 1 a 2 frases, dirigida a Deus (Senhor, Pai ou Deus). Termina EXATAMENTE com `, em nome de Jesus, Amém!` (ou ` em nome de Jesus, Amém!` após frase sem vírgula natural; use sempre o texto final "em nome de Jesus, Amém!").
- Total (parágrafos + today + prayer) com no máximo 200 palavras.

## Regras de conteúdo
- O versículo vem de outra versão no app. NÃO copie o versículo palavra por palavra. Comente, parafraseie ideias, no máximo uma expressão curta.
- Fique no texto e no contexto do trecho. Não invente fatos, nomes, números nem histórias. Não atribua ao autor bíblico o que ele não disse.
- Cristão, ecumênico: sem polêmica entre denominações, sem teologia da prosperidade, sem prometer cura ou riqueza garantida, sem culpa.
- Temas sensíveis (luto, depressão, doença, suicídio): acolha, não minimize a dor, evite clichês e vá à esperança sem pressa. Quando houver nota de ocasião, honre-a.
- Se houver `occasion`, deixe a data aparecer de forma natural no texto, sem forçar.

## Estilo
- NÃO use travessão (— ou –), nem parênteses. Use vírgula, ponto ou dois pontos.
- Evite repetir a estrutura "Não é X, é Y" e aberturas repetidas ("Há dias em que", "Hoje muita gente"). Varie as primeiras palavras dos textos do mês.
- Evite clichês de autoajuda e frases vazias. Prefira específico a genérico.
- Sem listas, sem títulos dentro dos parágrafos, sem emojis. No máximo um ponto de exclamação por parágrafo.

## Entrada e saída
- Entrada: JSON `{ "MM-DD": { "ref": "...", "verse_arc": "...", "occasion": "..." (opcional) } }`.
- Saída: JSON `{ "MM-DD": { "title": "...", "paragraphs": ["...","...","..."], "today": "...", "prayer": "..." } }` com todas as chaves da entrada, na mesma ordem.
- Valide com: `python3 -I VALIDATE_PATH ARQUIVO_SAIDA ARQUIVO_ENTRADA` e corrija até passar.

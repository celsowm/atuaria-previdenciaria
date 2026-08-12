# ATUAS — Product Overview

## Objetivo

O ATUAS deve transformar o trabalho atuarial que hoje pode estar distribuído entre aplicações Delphi, planilhas Excel, arquivos posicionais, documentos Word/PDF e conhecimento operacional em um único workflow versionado, auditável e reproduzível.

A unidade principal do produto é uma **Avaliação Atuarial**.

## Workflow principal

```text
Dados
  ↓
Crítica cadastral
  ↓
Massa aprovada
  ↓
Hipóteses
  ↓
Estudos de aderência
  ↓
Parametrização
  ↓
Rodada atuarial
  ↓
Fechamento
  ↓
Documentos
  ↓
Regulatório
  ↓
Encerramento
```

Cada etapa deve conhecer entradas, saídas, usuário responsável, data/hora, versão das regras, exceções justificadas e artefatos produzidos.

## Domínios

### Avaliações

- ciclo por plano e data-base;
- snapshots de massa, hipóteses e parâmetros;
- rodadas reproduzíveis;
- comparação histórica;
- auditoria integral.

### Planoos

- cadastro do plano e patrocinadores;
- regulamentos e documentos relacionados;
- layouts conhecidos;
- mappings reutilizáveis;
- regras de crítica;
- histórico de hipóteses e avaliações.

### Data Studio

Responsável por converter dados externos heterogêneos no modelo canônico do ATUAS.

```text
Arquivo → Estrutura → Mapeamento → Transformações → Preview → Validação → Concluir
```

Requisitos essenciais:

- XLSX/XLS/CSV/TXT;
- detecção de cabeçalho e estrutura;
- mapping 1:1, N:1, 1:N e N:N;
- conversão de datas e locale;
- conversão de moeda/decimal;
- split/concatenação;
- lookup/tabela de correspondência;
- condicionais;
- fórmulas simples;
- preview antes da importação;
- perfil versionado e reutilizável;
- diff do layout entre exercícios;
- rastreabilidade RAW → NORMALIZED → CANONICAL.

### Crítica cadastral

- erros bloqueantes;
- inconsistências atuariais;
- alertas;
- comparação automática com exercício anterior;
- correção na origem;
- reprocessamento;
- justificativa de exceções;
- trilha de auditoria.

### Layout Engine

Substitui formatações hardcoded e geração manual de arquivos posicionais.

Cada layout deve declarar:

- campo canônico de origem;
- posição inicial/final;
- tamanho;
- tipo;
- máscara;
- padding;
- regra de transformação;
- validações.

Deve gerar preview e arquivos `.FOR` ou outros layouts regulatórios/legados.

### Hipóteses & Tábuas

Tábuas são entidades versionadas, não colunas de uma planilha.

- nome;
- tipo;
- sexo;
- idade;
- qx;
- fonte;
- versão;
- vigência;
- transformações.

Transformações previstas incluem suavização, agravamento e deslocamento etário.

### Hypothesis Lab

Estudos estatísticos de aderência devem ser determinísticos e reproduzíveis.

Primeiro conjunto:

- exposição ao risco;
- eventos observados;
- eventos esperados;
- Kolmogorov-Smirnov;
- Qui-Quadrado;
- Teste Z;
- Exato de Fisher;
- DQM;
- gráficos por idade/faixa;
- ranking de tábuas;
- relatório/anexo do estudo.

### Rodada atuarial

Uma rodada liga versões exatas de:

- massa;
- hipóteses;
- parâmetros;
- motor;
- resultados.

A migração do legado deve ser incremental:

```text
ATUAS → worker Windows → Delphi → resultados → ATUAS
```

O Delphi funciona como golden master até o motor moderno reproduzir seus resultados dentro da tolerância definida.

### Fechamento

Substituição progressiva das planilhas de fechamento por dados estruturados:

- provisões;
- patrimônio;
- resultado técnico;
- fundos;
- contribuições;
- benefícios;
- fluxos;
- estatísticas;
- conciliações;
- comparação com exercício anterior;
- análise de variações.

### Document Studio

Documentos pertencem à avaliação e recebem dados diretamente de resultados estruturados.

- estudos de aderência;
- relatório atuarial;
- parecer atuarial;
- termo de hipóteses;
- anexos;
- documentos regulatórios.

A IA pode redigir, revisar e explicar, mas não gerar números oficiais.

### Regulatório

- DA;
- XML;
- layouts;
- validações;
- críticas;
- versão efetivamente transmitida;
- protocolo/registro da entrega.

## IA

### Regra fundamental

```text
motor determinístico → fatos estruturados → LLM → explicação/minuta/revisão
```

Nunca:

```text
LLM → provisão oficial
LLM → qx oficial
LLM → resultado oficial de teste estatístico
```

### Providers

API OpenAI-compatible `/v1`.

```text
Provider 1:N Credentials
Provider 1:N Models
AI Profile → provider/model/prompt/tools/policies
```

Cada provider pode possuir quantas credenciais forem necessárias, com prioridade/fallback. Credenciais reais não devem ser persistidas em texto puro; o domínio trabalha com `secretRef`.

### Tools previstas

```text
getValuation
getPlano
getCensusSummary
getEstudoAderencia
getAssumptions
getValuationResults
getPreviousValuation
getVariationAnalysis
getDocument
```

### Casos de uso

- redigir seção de parecer;
- explicar variação;
- comparar avaliações;
- resumir críticas cadastrais;
- explicar resultado de aderência;
- revisar consistência entre minuta e resultados oficiais;
- recuperar documentos históricos via RAG.

## Princípios arquiteturais

- monorepo TypeScript;
- modular monolith no início;
- backend Adorn API;
- Metal ORM;
- SQLite inicialmente;
- OpenAPI como contrato;
- better-openapi-typescript no frontend;
- React + Material UI;
- domínio separado de UI e infraestrutura;
- cálculos oficiais determinísticos;
- auditoria transversal;
- versionamento de inputs e regras;
- sem big-bang de migração do legado.

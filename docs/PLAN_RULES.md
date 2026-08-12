# Regras Atuariais Versionadas do Planoo

O cadastro mestre `Plano` identifica o plano. Regras de benefício, contribuição e elegibilidade não ficam misturadas nesse cadastro porque mudam por regulamento, nota técnica e vigência.

```text
Plano
  └─ VersaoRegrasPlanoo 1:N
        └─ PlanoRuleValue 1:N
```

## Princípio

Uma avaliação atuarial histórica precisa conseguir demonstrar quais regras do plano foram usadas. Por isso as regras seguem:

```text
RASCUNHO
  ↓ aprovação
APROVADO
  ↓ nova versão aprovada
SUBSTITUIDO
```

Somente `RASCUNHO` pode ser alterada. `APROVADO` e `SUBSTITUIDO` são snapshots imutáveis: `SUBSTITUIDO` apenas informa que existe uma versão aprovada mais nova, sem invalidar o uso histórico da versão anterior dentro de sua vigência.

Cada versão guarda também a modalidade (`BD`, `CD` ou `CV`) como snapshot. Depois que um plano possui qualquer versão de regras, sua modalidade não pode ser alterada no cadastro mestre.

## Vigência

`effectiveFrom` é obrigatório para aprovação. `effectiveTo` é opcional, mas, quando informado, não pode ser anterior ao início.

Ao copiar uma versão anterior, os valores e notas podem ser reaproveitados, mas a nova versão **não herda automaticamente a vigência**. O usuário precisa confirmar a data do novo regulamento antes de aprovar.

Um engine atuarial verifica a vigência contra `Avaliacao.referenceDate`; portanto uma versão mais nova não deve ser usada retroativamente só porque hoje é a versão `APROVADO` corrente.

## Valores tipados

`PlanoRuleValue` usa o mesmo padrão extensível de valores tipados adotado na Parametrização:

- `code` canônico;
- categoria;
- rótulo;
- tipo (`NUMBER`, `INTEGER`, `TEXT`, `BOOLEAN`);
- `valueJson` canônico;
- unidade;
- origem/referência;
- estado ativo interno.

A atualização do rascunho trata a lista enviada como o conjunto ativo. Regras retiradas são desativadas em vez de apagadas fisicamente.

## Catálogo inicial da UI

A UI oferece um catálogo operacional inicial, sempre sem valores default.

Comum às modalidades:

```text
ELIGIBILITY.NORMAL_RETIREMENT_AGE
ELIGIBILITY.MINIMUM_PLAN_MEMBERSHIP_YEARS
ELIGIBILITY.MINIMUM_SPONSOR_SERVICE_YEARS
CONTRIBUTION.PARTICIPANT_RATE
CONTRIBUTION.SPONSOR_RATE
BENEFIT.PAYMENTS_PER_YEAR
```

BD adiciona campos de base de cálculo, taxa de reposição e período de média salarial.

CD adiciona base em saldo de conta, limite de matching e indicação de conversão atuarial do saldo em renda.

CV adiciona contrato inicial para componente híbrido, contribuição variável e componentes definido/saldo de conta.

Esses campos não são valores regulatórios inventados pelo sistema. O usuário deve transcrevê-los do regulamento ou da nota técnica. A API permite regras adicionais sem exigir alteração do modelo relacional.

Regras adicionais que ainda não possuem componente visual aparecem como **Regras adicionais** na tela e são preservadas integralmente quando o formulário é salvo. A UI não pode apagar ou desativar extensões apenas por não conhecê-las.

## Fingerprint

Na aprovação é calculado SHA-256 sobre o contrato canônico:

```text
planoId
+ versão
+ modalidade
+ vigência
+ regras ativas ordenadas por código canônico
+ tipo/unidade/origem
```

A ordenação do payload do hash não depende de locale. O fingerprint é persistido no `ExecucaoCalculo` de engines atuariais e também participa do `inputFingerprint` completo da execução.

## Relação Avaliação → Planoo

`Avaliacao` possui `planoId` opcional com FK para `plans`. `planName` continua sendo o snapshot textual exibível.

Bases existentes recebem um backfill somente quando existe **exatamente um** plano cujo nome seja igual ao `planName` histórico. Situações sem correspondência ou ambíguas permanecem com `planoId = null`; o sistema não adivinha vínculos.

Um engine `ACTUARIAL` recusa executar quando `planoId` está ausente, mesmo que `planName` pareça coincidir com algum cadastro.

## API

```text
GET   /api/planos/:planoId/regras
POST  /api/planos/:planoId/regras
GET   /api/regras-plano/:id
PATCH /api/regras-plano/:id
PATCH /api/regras-plano/:id/valores
POST  /api/regras-plano/:id/approve
```

## URLs

```text
/planos/:planoId/regras
/planos/:planoId/regras/:versaoRegrasId
```

## Self-test

O smoke test do domínio cria um SQLite temporário e valida versionamento, fingerprint, vigência, cópia, desativação de regras, supersessão e bloqueio de mudança de modalidade:

```bash
npm run plan-rules:self-test
```

O arquivo temporário é removido ao final e não utiliza a base operacional da aplicação.

## Contrato com o motor atuarial

O primeiro consumidor real deste contrato é `BD_PVFB`.

Uma execução atuarial recebe explicitamente:

```text
Avaliacao.planoId
+ VersaoRegrasPlanoo APROVADO/SUBSTITUIDO e vigente na data-base
+ ParametrizacaoAtuarial APROVADO/SUBSTITUIDO
+ frozen canonical imports
+ engine code/version
```

O `ExecucaoCalculo` persiste:

```text
planRulesVersionId
planRulesFingerprint
```

Assim, aprovar uma nova versão regulatória depois não modifica o significado de uma execução histórica. O engine nunca resolve "a regra atual" implicitamente.

Detalhes da fórmula e do contrato de `BD_PVFB` estão em `docs/CALCULATION_ENGINE.md`.

# Golden master atuarial privado

Os workbooks históricos usados para regressão do ATUAS são dados de trabalho e **não pertencem ao repositório Git**.

O Git recebe apenas:

- o motor de comparação;
- o formato do manifesto;
- documentação;
- testes sintéticos criados em `/tmp` durante a CI.

Nunca devem ser commitados:

- XLS/XLSX/CSV históricos;
- massas cadastrais;
- resultados extraídos dos workbooks reais;
- manifestos locais com caminhos, coordenadas e metadados de casos reais;
- relatórios ATUAS × Excel produzidos a partir de casos reais.

## Diretórios permitidos

A opção mais simples dentro de um checkout local é:

```text
data/golden-master/
```

Esse diretório é ignorado pelo `.gitignore`. Também é possível manter tudo fora do checkout, por exemplo em um volume privado.

O próprio harness recusa workbooks e manifestos reais encontrados em caminhos versionáveis do repositório. Dentro do checkout, somente `data/golden-master/` é aceito.

A CI contém uma segunda proteção: ela falha se detectar golden masters privados ou relatórios desse tipo em `git ls-files`.

## 1. Inspecionar um workbook privado

O comando de inspeção não altera o arquivo e não cria saída dentro do Git:

```bash
npm run adherence:golden:inspect -w @atuas/backend -- \
  /caminho/privado/aderencia.xlsx
```

Ele retorna:

- nomes das abas;
- dimensões aproximadas;
- primeiras linhas com aparência de cabeçalho.

O objetivo é localizar as áreas equivalentes a:

```text
idade
sexo
exposição
eventos observados
qx ou eventos esperados
resumos estatísticos
```

Os valores atuariais permanecem no arquivo privado.

## 2. Criar o manifesto local

Copie `docs/golden-master.example.json` para um caminho privado e renomeie para algo terminado em:

```text
.golden-master.local.json
```

Essa extensão também é ignorada pelo Git.

O manifesto informa apenas ao runner local onde estão as células do workbook.

A matriz comum possui:

```text
sheet
startRow / endRow
ageColumn
sexColumn ou fixedSex
exposureColumn
observedColumn
```

Cada candidata usa uma das duas formas:

```text
expectedColumn
```

ou:

```text
qxColumn
```

Quando `expectedColumn` é usado, o harness recupera implicitamente:

```text
qx = esperado / exposição
```

Assim é possível validar primeiro o motor estatístico contra a própria planilha histórica antes de validar separadamente a importação das tábuas.

## 3. Células-resumo

Um candidato pode apontar para células do Excel que contenham os resultados históricos de:

```text
expectedEvents
chiSquare
chiSquareCritical
chiSquareP
ksD
ksCritical
ksP
zStatistic
zCritical
zP
fisherP
dqm
```

O harness compara esses valores com `atuas-adherence-v1` usando tolerâncias absoluta e relativa configuráveis.

Também compara, linha a linha, os eventos esperados calculados pelo ATUAS contra a coluna de esperados do Excel.

## 4. Executar a regressão

Prefira um diretório de relatório privado absoluto:

```bash
ATUAS_GOLDEN_MASTER_REPORT_DIR=/volume-privado/atuas-reports \
npm run adherence:golden:compare -w @atuas/backend -- \
  /volume-privado/caso.golden-master.local.json
```

O processo termina com código diferente de zero quando qualquer célula ou métrica ultrapassa a tolerância.

O relatório JSON detalha:

```text
candidato
  ├─ esperado ATUAS × Excel por idade/sexo
  ├─ estatística ATUAS × Excel
  ├─ delta
  ├─ tolerância aceita
  └─ pass/fail
```

Esse relatório também é dado privado e não deve ser commitado.

## 5. Self-test público e sintético

A CI não precisa de dado real. O comando:

```bash
npm run adherence:golden:self-test -w @atuas/backend
```

cria em diretório temporário um workbook totalmente sintético no qual observado e esperado coincidem exatamente. Em seguida valida:

- leitura XLSX;
- mapeamento de colunas;
- construção das células;
- cálculo estatístico;
- leitura das células-resumo;
- tolerância;
- geração de relatório;
- código de saída do runner.

Nada desse self-test contém informação histórica real.

## Estratégia de equivalência

A regressão deve ser feita em camadas:

```text
1. eventos esperados por idade/sexo
2. totais observados e esperados
3. χ² calculado / crítico / p-value
4. KS calculado / crítico / p-value
5. Z calculado / crítico / p-value
6. Fisher
7. DQM
8. ranking
```

Quando houver diferença, o objetivo não é ajustar o ATUAS até coincidir artificialmente. Primeiro deve ser identificada a diferença metodológica da planilha: arredondamento, agrupamento etário, exposição, graus de liberdade, fórmula de crítico, tratamento por sexo ou outra regra.

Mudanças metodológicas aprovadas devem gerar uma nova versão do motor, em vez de alterar silenciosamente `atuas-adherence-v1`.

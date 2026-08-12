import type sqlite3 from "sqlite3";

function executar(db: sqlite3.Database, sql: string) {
  return new Promise<void>((resolve, reject) => db.exec(sql, (erro) => erro ? reject(erro) : resolve()));
}

/** Dados exclusivamente demonstrativos. Todos os identificadores persistidos estão em português. */
export async function seedReferenceData(_db: sqlite3.Database) {}

export async function seedDemoData(db: sqlite3.Database) {
  if (process.env.APP_SEED_DEMO !== "true") return;
  const agora = "2026-08-11T15:00:00.000Z";
  await executar(db, `
    INSERT OR IGNORE INTO entidades_previdencia (id, codigo, nome, cnpj, situacao, criado_em, atualizado_em) VALUES
      ('10000000-0000-4000-8000-000000000001', 'MULTIBRA', 'Multibra Previdência', '12.345.678/0001-90', 'ATIVA', '${agora}', '${agora}'),
      ('10000000-0000-4000-8000-000000000002', 'PREVINORTE', 'Previnorte', '23.456.789/0001-01', 'ATIVA', '${agora}', '${agora}');
    INSERT OR IGNORE INTO planos (id, entidade_previdencia_id, codigo, nome, modalidade, nome_patrocinador, cnpj, situacao, criado_em, atualizado_em) VALUES
      ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'CNI', 'Plano CNI', 'BD', 'Confederação Nacional da Indústria', NULL, 'ATIVO', '${agora}', '${agora}'),
      ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'SESI', 'Plano SESI', 'BD', 'SESI', NULL, 'ATIVO', '${agora}', '${agora}'),
      ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'SENAI', 'Plano SENAI', 'CV', 'SENAI', NULL, 'ATIVO', '${agora}', '${agora}');
    INSERT OR IGNORE INTO unidades_referencia (id, codigo, nome, situacao, criado_em, atualizado_em) VALUES
      ('30000000-0000-4000-8000-000000000001', 'URP', 'Unidade de Referência Previdenciária', 'ATIVA', '${agora}', '${agora}');
    INSERT OR IGNORE INTO valores_unidade_referencia (id, unidade_referencia_id, valor, vigencia_inicial, vigencia_final, criado_em) VALUES
      ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 100.00, '2026-01-01', NULL, '${agora}');
    INSERT OR IGNORE INTO submassas (id, plano_id, codigo, nome, vigencia_inicial, vigencia_final, situacao, impressao_digital_regras, observacoes, criado_em, atualizado_em, aprovada_em) VALUES
      ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'ATIVOS', 'Participantees ativos', '2026-01-01', NULL, 'APROVADA', 'demonstracao-cni-ativos-2026', 'Submassa demonstrativa.', '${agora}', '${agora}', '${agora}');
    INSERT OR IGNORE INTO beneficios (id, submassa_id, codigo, nome, tipo_beneficio, situacao, json_regras_elegibilidade, json_formula_valor, origem, criado_em, atualizado_em) VALUES
      ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'APOS_NORMAL', 'Aposentadoria normal', 'APOSENTADORIA', 'ATIVO', '{"operador":"TODOS","itens":[{"criterio":"IDADE_MINIMA","valor":55},{"criterio":"APOSENTADO_INSS","valor":true}]}', '{"operador":"SOMA","itens":[{"operador":"MAXIMO","itens":[{"operador":"SUBTRACAO","itens":[{"componente":"SALARIO_CONTRIBUICAO"},{"componente":"BENEFICIO_INSS"}]},{"valor":0}]},{"operador":"MULTIPLICACAO","itens":[{"valor":2},{"componente":"UNIDADE_REFERENCIA","unidadeReferenciaId":"30000000-0000-4000-8000-000000000001"}]}]}', 'Regulamento demonstrativo', '${agora}', '${agora}');
  `);
}

export async function linkLegacyEvaluationsToPlans(_db: sqlite3.Database) {}

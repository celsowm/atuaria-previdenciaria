import { createHash } from "node:crypto";

export type FingerprintRegraPlano = {
  codigo: string;
  categoria: string;
  rotulo: string;
  tipoValor: string;
  jsonValor: string;
  unidade: string | null;
  origem: string;
};

export function compareRegraPlanoCode(a: { codigo: string }, b: { codigo: string }) {
  return a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0;
}

export function calculateRegrasPlanoFingerprint(input: {
  planoId: string;
  versao: number;
  modalidade: string;
  vigenciaInicial: string;
  vigenciaFinal: string | null;
  rules: FingerprintRegraPlano[];
}) {
  const canonical = {
    planoId: input.planoId,
    versao: input.versao,
    modalidade: input.modalidade,
    vigenciaInicial: input.vigenciaInicial,
    vigenciaFinal: input.vigenciaFinal,
    rules: [...input.rules].sort(compareRegraPlanoCode).map((rule) => ({
      codigo: rule.codigo,
      categoria: rule.categoria,
      rotulo: rule.rotulo,
      tipoValor: rule.tipoValor,
      jsonValor: rule.jsonValor,
      unidade: rule.unidade,
      origem: rule.origem
    }))
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

import type { Ingresso, Pessoa, TipoIngresso } from "./tipos.ts";

const TAXA_DE_SERVICO = 0.1;

const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

export const valorDoIngresso =
  (precoBase: number) =>
  (tipo: TipoIngresso): number =>
    tipo === "meia" ? arredondar(precoBase / 2) : precoBase;

export const aplicarTaxa =
  (percentual: number) =>
  (valor: number): number =>
    arredondar(valor * (1 + percentual));

export const montarIngressos = (
  precoBase: number,
  pessoas: readonly Pessoa[],
  temDireitoAMeia: (pessoa: Pessoa) => boolean,
): Ingresso[] => {
  const valor = valorDoIngresso(precoBase);
  return pessoas.map((pessoa): Ingresso => {
    const tipo: TipoIngresso = temDireitoAMeia(pessoa) ? "meia" : "inteira";
    return { nome: pessoa.nome, poltrona: pessoa.poltrona, tipo, valor: valor(tipo) };
  });
};

export const calcularTotal = (ingressos: readonly Ingresso[]): number =>
  aplicarTaxa(TAXA_DE_SERVICO)(ingressos.reduce((soma, ingresso) => soma + ingresso.valor, 0));

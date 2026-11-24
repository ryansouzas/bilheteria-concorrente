// Preço dos ingressos, no paradigma funcional: só funções puras, sem laço e sem mutação.
import type { Ingresso, Pessoa, TipoIngresso } from "./tipos.ts";

const TAXA_DE_SERVICO = 0.1;

// Arredonda em 2 casas decimais devolvendo número (o toFixed devolveria texto).
const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

// Fábrica: fixa o preço base e devolve a função que dá o valor de cada tipo de ingresso.
export const valorDoIngresso =
  (precoBase: number) =>
  (tipo: TipoIngresso): number =>
    tipo === "meia" ? arredondar(precoBase / 2) : precoBase;

// Fábrica: fixa o percentual e devolve a função que soma a taxa a um valor.
export const aplicarTaxa =
  (percentual: number) =>
  (valor: number): number =>
    arredondar(valor * (1 + percentual));

// Um ingresso por pessoa, na mesma ordem; quem decide a meia é a regra recebida.
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

// Soma os ingressos e aplica a taxa de serviço de 10%.
export const calcularTotal = (ingressos: readonly Ingresso[]): number =>
  aplicarTaxa(TAXA_DE_SERVICO)(ingressos.reduce((soma, ingresso) => soma + ingresso.valor, 0));

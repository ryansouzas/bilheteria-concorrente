import { criarBilheteria } from "./bilheteria.ts";
import { Evento } from "./dominio.ts";
import { criarPagamentoFalso } from "./pagamento.ts";
import { criarServidor } from "./servidor.ts";

const PORTA = 3000;

const eventos = [
  new Evento(1, "Show de Rock", 100, 100),
  new Evento(2, "Peça de Teatro", 60, 50),
  new Evento(3, "Stand-up de Comédia", 45.5, 80),
];

const pagar = criarPagamentoFalso({ latenciaMs: 80, taxaDeFalha: 0.1 });

const bilheteria = criarBilheteria({ eventos, pagar, limitePagamentoMs: 500 });

criarServidor(bilheteria).listen(PORTA, () => {
  console.log(`Bilheteria no ar em http://localhost:${PORTA}`);
});

# Bilheteria concorrente

Um serviço HTTP de venda de ingressos, escrito em TypeScript com Node.js e Express, que aguenta a
**abertura de vendas** de um show: centenas de pedidos chegando ao mesmo tempo, muita gente
disputando as mesmas poltronas e uma operadora de pagamento externa que demora, às vezes falha e
às vezes trava.

Projeto final da disciplina de **Paradigmas de Linguagens de Programação**. Cada parte do sistema
foi escrita num paradigma diferente:

| Parte | Paradigma | Arquivo |
| :--- | :--- | :--- |
| Cálculo de preço | Funcional | `src/preco.ts` |
| Evento e erros | Orientado a objetos | `src/dominio.ts` |
| Venda | Concorrente | `src/bilheteria.ts` |

## O problema

Mesmo com muitos pedidos simultâneos, o sistema **nunca** pode:

- vender a mesma poltrona para duas pessoas;
- cobrar alguém que ficou sem poltrona;
- deixar um pedido parado esperando o pagamento de outro;
- ficar preso para sempre numa operadora de pagamento travada.

### Regras de negócio

- As poltronas de cada evento são numeradas de 1 até a capacidade.
- Um pedido compra um ou mais ingressos para o mesmo evento, um por pessoa (uma família pode
  comprar junta). Cada pessoa escolhe a sua poltrona.
- Estudantes, pessoas com deficiência (PcD) e pessoas com 60 anos ou mais pagam **meia-entrada**.
- Sobre a soma dos ingressos é cobrada uma **taxa de serviço de 10%**.
- O pedido é **tudo ou nada**: se uma poltrona do pedido estiver ocupada ou for inválida, nenhuma
  é reservada.

## Como rodar

Requisito: **Node.js 22 ou mais novo**.

```bash
npm install         # instala as dependências
npm start           # sobe o serviço em http://localhost:3000
npm test            # roda a bateria de testes automáticos
npm run typecheck   # confere os tipos com o compilador do TypeScript
npm run bench       # com o serviço no ar: 200 pedidos simultâneos no evento 1
```

O serviço sobe com três eventos de exemplo:

| `id` | Evento | Preço | Poltronas |
| ---: | :--- | ---: | ---: |
| 1 | Show de Rock | 100,00 | 100 |
| 2 | Peça de Teatro | 60,00 | 50 |
| 3 | Stand-up de Comédia | 45,50 | 80 |

O estado fica só em memória: ao reiniciar o serviço, todas as poltronas voltam a ficar livres.

## API

### `GET /eventos`

Lista os eventos e quantas poltronas ainda estão disponíveis.

```bash
curl localhost:3000/eventos
```

```json
[
  { "id": 1, "nome": "Show de Rock", "preco": 100, "capacidade": 100, "disponivel": 100 },
  { "id": 2, "nome": "Peça de Teatro", "preco": 60, "capacidade": 50, "disponivel": 50 },
  { "id": 3, "nome": "Stand-up de Comédia", "preco": 45.5, "capacidade": 80, "disponivel": 80 }
]
```

### `POST /reservas`

Compra um ou mais ingressos. Cada item de `ingressos` é uma pessoa, com a poltrona que escolheu.

```bash
curl -X POST localhost:3000/reservas -H 'Content-Type: application/json' \
  -d '{"eventoId":1,"ingressos":[
        {"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7},
        {"nome":"Beto","idade":30,"estudante":false,"pcd":false,"poltrona":8}
      ]}'
```

Resposta `201 Created` com o comprovante. A Ana é estudante e paga meia; o total tem 10% de taxa:

```json
{
  "reservaId": 1,
  "eventoId": 1,
  "ingressos": [
    { "nome": "Ana", "poltrona": 7, "tipo": "meia", "valor": 50 },
    { "nome": "Beto", "poltrona": 8, "tipo": "inteira", "valor": 100 }
  ],
  "total": 165
}
```

Quando a compra não é concluída, a resposta tem o formato `{ "mensagem": "..." }` e um destes status:

| Status | Erro | Quando acontece |
| ---: | :--- | :--- |
| 400 | `DadosInvalidosErro` | pedido sem ingressos, poltrona inexistente ou repetida no pedido, JSON inválido |
| 404 | `NaoEncontradoErro` | o evento não existe |
| 409 | `PoltronaOcupadaErro` | alguma poltrona do pedido já foi vendida |
| 502 | `PagamentoErro` | a operadora recusou o pagamento ou passou do tempo limite (as poltronas voltam para a venda) |

## Estrutura do código

```
src/
  tipos.ts        interfaces compartilhadas (Pessoa, Pedido, Ingresso, Comprovante...)
  regras.ts       direitoAMeia: quem paga meia-entrada
  preco.ts        cálculo de preço, em estilo funcional
  dominio.ts      classe Evento e a hierarquia de erros, em orientação a objetos
  bilheteria.ts   a venda: reserva, cobrança, tempo limite e devolução
  servidor.ts     rotas HTTP com Express
  pagamento.ts    operadora de pagamento falsa (demora e falha de propósito)
  main.ts         monta os eventos, a operadora e a bilheteria e sobe o servidor
  bench.ts        dispara muitos pedidos ao mesmo tempo e mede o resultado
testes/           bateria de testes automáticos
```

O fluxo de um pedido é: `servidor.ts` recebe o `POST /reservas` → `Bilheteria.reservar` valida e
reserva as poltronas no `Evento` → `preco.ts` calcula os ingressos e o total → a operadora cobra →
o servidor devolve o comprovante ou converte o erro no status HTTP certo.

## Como cada paradigma foi usado

### Funcional: o preço (`preco.ts`)

O cálculo de preço é feito só com funções puras, sem estado, laços ou mutação. A mesma entrada
sempre dá a mesma saída.

- `valorDoIngresso(precoBase)` e `aplicarTaxa(percentual)` são **fábricas de funções**: recebem a
  configuração e devolvem uma nova função. `aplicarTaxa(0.1)` é "a função que soma 10%".
- `montarIngressos` usa `map` para criar um ingresso por pessoa e recebe **a regra da meia como
  parâmetro**, então a regra pode ser trocada sem mexer no cálculo.
- `calcularTotal` soma os valores com `reduce` e aplica a taxa.
- Os valores são arredondados em 2 casas, para evitar resultados como `110.00000000000001`.

**Vantagem:** é fácil de entender e de testar, só importando as funções e comparando resultados,
sem servidor nem operadora. Também é seguro usar o mesmo cálculo em vários pedidos ao mesmo
tempo, porque nada é compartilhado.

### Orientado a objetos: o evento e os erros (`dominio.ts`)

**A classe `Evento`** guarda as poltronas vendidas num campo privado (`#vendidas`). Por fora só dá
para consultar quantas restam (`disponivel`, somente leitura) e alterar o estado pelos métodos
`reservar` e `liberar`, que validam tudo. Assim ninguém consegue vender a mesma poltrona duas vezes
ou deixar o evento num estado impossível.

O `reservar` é **tudo ou nada**: primeiro confere a lista inteira (vazia, fora da capacidade,
repetida, já vendida) e só no final marca as poltronas. Um pedido de família recusado não deixa
poltronas presas.

**Os erros** formam uma hierarquia:

```
Error
└── ErroDeNegocio (abstrata, tem o campo status)
    ├── DadosInvalidosErro   400
    ├── NaoEncontradoErro    404
    ├── PoltronaOcupadaErro  409
    └── PagamentoErro        502
```

O servidor só precisa verificar `erro instanceof ErroDeNegocio` e responder com `erro.status`, sem
conhecer cada caso. Para criar um erro novo basta uma nova classe filha.

### Concorrente: a venda (`bilheteria.ts`)

O Node.js executa o JavaScript numa linha só e só troca de pedido num `await`. A venda usa isso a
seu favor em três pontos.

**1. As poltronas são marcadas antes do pagamento.** Validar o pedido, achar o evento e marcar as
poltronas acontece de uma vez, sem nenhum `await` no meio. Nenhum outro pedido consegue entrar
entre "a poltrona está livre" e "a poltrona é minha". Só depois vem o `await` da cobrança: enquanto
um pedido espera a operadora, os outros são atendidos, mas recebem `409` sem serem cobrados.

Se a cobrança viesse antes da marcação, vários pedidos veriam a mesma poltrona livre durante a
espera e todos seriam cobrados e vendidos.

**2. Tempo limite na operadora.** A cobrança corre contra um relógio com `Promise.race`: se a
operadora não responder dentro do limite (500 ms no `main.ts`), o pedido desiste. Uma operadora
travada nunca prende o pedido para sempre.

**3. Devolução das poltronas.** Se o pagamento falhar ou estourar o tempo, as poltronas que o
pedido tinha marcado voltam para a venda (`evento.liberar`) e a resposta é `502`.

Não foi preciso fila nem trava: como os pedidos são **concorrentes, mas não paralelos**, o trecho
"confere e marca" nunca é interrompido.

## Resultados do bench

O `npm run bench` dispara 200 pedidos ao mesmo tempo no evento 1 (100 poltronas), **dois pedidos
para cada poltrona**, com a operadora falsa demorando 80 ms por cobrança e falhando 10% das vezes.

| Cenário | Pedidos | Tempo (ms) | Vendidos (201) | Poltrona ocupada (409) | Falha de pagamento (502) |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Padrão (`main.ts`) | 200 | 218 | 91 | 100 | 9 |

O que os números mostram:

- **Nenhuma poltrona foi vendida duas vezes.** Saíram exatamente 100 recusas por poltrona ocupada,
  uma por poltrona. Vendidos e falhas de pagamento somam 100: cada poltrona teve um único pedido
  aceito para cobrança.
- **Quem ficou sem poltrona não foi cobrado.** Os 409 são respondidos antes do pagamento.
- **Pagamento que falha devolve a poltrona.** As 9 poltronas das cobranças que falharam voltaram
  para a venda: o evento 1 terminou com `disponivel: 9`.
- **Os pedidos não esperam uns pelos outros.** Cobrando um de cada vez, seriam cerca de
  100 × 80 ms = 8 s só de pagamento. Os 200 pedidos levaram 218 ms (cerca de 917 pedidos/s).

Vendidos e falhas variam um pouco a cada execução, por causa do sorteio da operadora falsa. Os 409
são sempre 100, e vendidos + falhas sempre somam 100. Para repetir o bench, reinicie o `npm start`:
as poltronas vendidas continuam vendidas enquanto o serviço está no ar.

## Discussão

**E se fosse em outro paradigma?** O cálculo de preço também poderia ser uma classe
`CalculadoraDePreco` que acumula ingressos numa lista interna e tem um método `total()`.
Funcionaria, mas ficaria pior:
- o resultado dependeria do estado do objeto e da ordem das chamadas;
- os testes exigiriam preparar o objeto antes;
- duas vendas usando a mesma instância ao mesmo tempo poderiam misturar ingressos.

A orientação a objetos faz mais sentido onde existe estado a proteger, como as poltronas do
`Evento`.

**Concorrente × paralelo.** Hoje a segurança vem de o JavaScript rodar numa linha só. Com vários
núcleos executando a venda ao mesmo tempo, dois pedidos poderiam rodar o trecho "confere e marca"
juntos, ver a mesma poltrona livre e os dois a marcarem: uma condição de corrida. Seria preciso
proteger esse trecho, por exemplo:
- com uma trava (mutex) por evento;
- com operações atômicas;
- com um único dono do estado que recebe os pedidos por fila;
- num sistema real, com transação ou restrição de unicidade no banco de dados.

Cada núcleo também teria a sua própria memória, então as poltronas precisariam ficar num lugar
compartilhado. O paralelismo ajudaria em trabalho pesado de CPU. Aqui, quase todo o tempo é espera
pela operadora, e a concorrência numa linha só já basta.

## Autor

| Nome | GitHub | Parte |
| :--- | :--- | :--- |
| Ryan de Souza Sebadelhe | [ryansouzas](https://github.com/ryansouzas) | Todas as partes |

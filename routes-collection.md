# GO PME - Documentação e Coleção de Rotas (API Reference)

Coleção de rotas HTTP com especificação completa de headers, bodies esperados, parâmetros de URL, permissões e exemplos práticos para importação/uso em ferramentas como **Postman**, **Insomnia**, **Thunder Client** ou clientes HTTP (cURL, fetch, axios).

---

## 🏷️ Segmentos/Categorias de Tenant (`TenantCategory`)

Valores aceitos para o campo `category` / `tenantCategory`:
- `PADARIA`
- `MERCEARIA`
- `BAR`
- `LANCHONETE`
- `FARMACIA`
- `CONVENIENCIA`
- `PET_SHOP`
- `MERCADO`
- `OUTROS` *(padrão)*

---

## 👥 Faixas de Funcionários (`EmployeeRange`)

Valores aceitos para o campo `employeeRange` / `tenantEmployeeRange`:
- `solo_1`: Apenas o proprietário (1 pessoa / autônomo) *(padrão)*
- `team_2_5`: Pequena equipe (2 a 5 funcionários)
- `team_6_10`: Média equipe (6 a 10 funcionários)
- `team_11_plus`: Grande equipe (11 ou mais funcionários)

---

## 📌 Sumário de Endpoints

| Método | Endpoint | Autenticação / Permissão | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/ping` | Pública | Health check da aplicação |
| `POST` | `/auth/register` | Pública | Cadastro de Usuário Comum + Criação de Tenant |
| `POST` | `/auth/super-admin/register` | Pública (Requer `adminSecret`) | Cadastro de Super Admin + Tenant System Administration |
| `POST` | `/auth/login` | Pública | Autenticação e obtenção de token JWT |
| `POST` | `/auth/forgot-password` | Pública | Solicita envio de OTP (6 a 8 dígitos) para o e-mail |
| `POST` | `/auth/reset-password` | Pública | Redefine a senha validando o OTP de 6 a 8 dígitos |
| `GET` | `/auth/me` | Autenticado | Dados do perfil do usuário e seus tenants |
| `GET` | `/tenants` | Autenticado | Listagem de tenants (todos para Super Admin; próprio para Usuário) |
| `GET` | `/tenants/:id` | Autenticado | Detalhes de um tenant específico |
| `POST` | `/tenants` | Autenticado | Criação de novo tenant |
| `PUT` | `/tenants/:id` | Autenticado (Admin / Owner / Super Admin) | Atualização de dados do tenant |
| `DELETE` | `/tenants/:id` | Autenticado (**Super Admin**) | Exclusão de tenant |
| `GET` | `/products/lookup/:barcode` | Autenticado | Consulta dados de produto na API externa Open Food Facts |
| `GET` | `/products/critical` | Autenticado | Dashboard de gôndolas críticas e reposição prioritária |
| `POST` | `/products/pos/sale` | Autenticado | PDV Declaratório: registro de venda com baixa na gôndola |
| `GET` | `/products/barcode/:barcode` | Autenticado | Busca produto do catálogo pelo código de barras escaneado |
| `POST` | `/products/:id/transfer` | Autenticado | Transferência rápida de estoque (Depósito -> Gôndola) |
| `GET` | `/products` | Autenticado | Listagem paginada e filtrada de produtos do catálogo |
| `GET` | `/products/:id` | Autenticado | Detalhes completos de um produto por UUID |
| `POST` | `/products` | Autenticado | Cadastro de produto com trava Freemium (100 SKUs) |
| `PUT` | `/products/:id` | Autenticado | Atualização de dados e estoques do produto |
| `DELETE` | `/products/:id` | Autenticado | Exclusão lógica (soft delete) de produto do catálogo |
| `GET` | `/products/sync/delta` | Autenticado | Delta Sync por Timestamp para IndexedDB / PDV Offline |
| `POST` | `/sales` | Autenticado | PDV: Registra venda com persistência em `Sale`/`SaleItem` e baixa na gôndola |
| `GET` | `/sales` | Autenticado | Histórico paginado de vendas com filtros e limite de retenção por plano |
| `GET` | `/sales/:id` | Autenticado | Detalhes de uma venda específica com itens e dados do operador |
| `POST` | `/pos/sessions/pair` | Autenticado | Cria sessão efêmera de pareamento (QR Code) para scanner remoto no celular |
| `GET` | `/pos/sessions/:sessionId/validate` | Pública / Token | Valida sessão escaneada pelo celular antes de ativar a câmera |
| `POST` | `/pos/sessions/:sessionId/close` | Autenticado | Encerra a sessão de pareamento do scanner remoto |
| `GET` | `/reports/overview` | Autenticado | Dashboard executivo com métricas globais e alertas de compras |
| `GET` | `/reports/abc` | Autenticado | Relatório de Curva ABC (Faturamento, Giro e Margem de Lucro) |
| `GET` | `/reports/turnover-margin-matrix` | Autenticado | Matriz de Rentabilidade x Velocidade de Saída (Giro x Margem) |
| `GET` | `/reports/replenishment-purchasing` | Autenticado | Planejamento de Compras e Ponto de Pedido (ROP / Reposição) |
| `GET` | `/reports/space-optimization` | Autenticado | Otimização de Espaço Físico de Exposição (Gôndolas vs Depósito) |
---

## 1. 🏥 Health Check

### `GET /ping`
- **Headers**: Nenhum
- **Body**: Nenhum
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "message": "pong",
  "timestamp": "2026-08-15T12:00:00.000Z"
}
```

---

## 2. 🔐 Autenticação (`/auth`)

---

### `POST /auth/register`
Realiza o registro de um usuário comum e cria o seu Tenant (empresa) com categoria e faixa de funcionários.

- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "name": "João da Silva",
  "email": "joao@mercado.com",
  "password": "senhaSegura123",
  "tenantName": "Mercadinho São Paulo",
  "tenantCategory": "MERCEARIA",
  "tenantEmployeeRange": "team_2_5",
  "tenantEmail": "contato@mercadinho.com",
  "tenantPhone": "+5511999999999"
}
```

---

### `POST /auth/super-admin/register`
Registra um usuário com papel de **Super Admin** (`isSuperAdmin: true`). Cria automaticamente o tenant padrão `"System Administration"`.

- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "name": "Super Administrador",
  "email": "admin@gopme.com",
  "password": "superAdminPassword123",
  "adminSecret": "super-admin-secret-change-me"
}
```

---

### `POST /auth/login`
Autentica qualquer usuário e retorna os dados de sessão com JWT e informações do seu tenant.

- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "email": "joao@mercado.com",
  "password": "senhaSegura123"
}
```

---

### `POST /auth/forgot-password` (Esqueci minha senha)
Envia um código OTP numérico (6 a 8 dígitos) para o e-mail cadastrado usando o Supabase Auth.

- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "email": "joao@mercado.com"
}
```
*Campos:*
- `email` *(string, obrigatório, email válido)*: E-mail para recebimento do código OTP

- **Resposta Sucesso (`200 OK`)**:
```json
{
  "message": "Código OTP de recuperação de senha enviado com sucesso para o e-mail informado"
}
```

---

### `POST /auth/reset-password` (Redefinição com OTP)
Valida o código OTP (6 a 8 dígitos) recebido por e-mail e aplica a nova senha.

- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "email": "joao@mercado.com",
  "token": "123456",
  "newPassword": "novaSenhaSuperSegura123"
}
```
*Campos:*
- `email` *(string, obrigatório, email válido)*: E-mail da conta
- `token` *(string, obrigatório, regex: 6 a 8 dígitos numéricos)*: Código numérico (6 a 8 dígitos) recebido por e-mail
- `newPassword` *(string, obrigatório, min 6)*: Nova senha desejada

- **Resposta Sucesso (`200 OK`)**:
```json
{
  "message": "Senha redefinida com sucesso. Você já pode fazer login com a nova senha."
}
```
- **Resposta Erro Código Inválido/Expirado (`400 Bad Request`)**:
```json
{
  "error": "Token has expired or is invalid"
}
```

---

### `GET /auth/me`
Retorna os dados cadastrais do usuário logado, o tenant vinculado e seus tenants próprios.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```

---

## 3. 🏢 CRUD de Tenants (`/tenants`)

---

### `GET /tenants`
Lista os tenants com categoria e faixa de funcionários.
- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```

---

### `GET /tenants/:id`
Busca detalhes de um tenant específico pelo UUID.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```

---

### `POST /tenants`
Cria um novo tenant especificando categoria e faixa de funcionários.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "name": "Panificadora Pão Quente",
  "category": "PADARIA",
  "employeeRange": "team_6_10",
  "email": "contato@paoquente.com",
  "phone": "+5511988888888",
  "ownerId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc"
}
```

---

### `PUT /tenants/:id`
Atualiza dados cadastrais de um tenant existente.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "name": "Panificadora & Conveniência Pão Quente",
  "category": "CONVENIENCIA",
  "employeeRange": "team_11_plus",
  "phone": "+5511977777777"
}
```

---

### `DELETE /tenants/:id`
Exclui definitivamente um tenant (Restrito a Super Admin).

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN_SUPER_ADMIN>
  ```

---

## 4. 📦 Catálogo de Produtos, Estoque e PDV (`/products`)

Conforme o roadmap do MVP (**GO PME.docx**) e as políticas de segurança RLS (**policies.txt**), os produtos possuem isolamento multi-tenant estrito (`tenant_id = public.get_tenant_id() OR public.is_super_admin()`), controle duplo de estoque (**Depósito** vs **Gôndola**), priorização de reposição crítica, suporte a leitores de código de barras / Open Food Facts e trava do plano Freemium (100 SKUs).

---

### `GET /products/lookup/:barcode` (Open Food Facts)
Consulta a API mundial Open Food Facts para buscar nome, categoria, marcas e foto de um código de barras antes de salvar no sistema.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Parâmetros de URL**:
  - `barcode`: Código de barras EAN/GTIN (ex: `7891000100103`)
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "status": 1,
  "statusVerbose": "Produto encontrado na Open Food Facts",
  "product": {
    "barcode": "7891000100103",
    "name": "Leite Condensado Moça 395g",
    "category": "Laticínios",
    "brands": "Nestlé",
    "imageUrl": "https://images.openfoodfacts.org/...",
    "quantity": "395g"
  }
}
```

---

### `GET /products/critical` (Dashboard de Gôndolas Críticas / Repositor)
Retorna os produtos onde `shelfQty <= shelfMinQty`, calculando o déficit absoluto e percentual, ordenados por prioridade de abastecimento.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Params (Opcionais)**:
  - `tenantId` *(UUID, opcional, restrito a Super Admin)*: Filtra o dashboard de uma loja específica.
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "total": 1,
  "products": [
    {
      "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
      "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
      "barcode": "7891000100103",
      "name": "Leite Condensado Moça 395g",
      "category": "Laticínios",
      "depotQty": 48,
      "depotLocation": "Depósito - Corredor B, Prateleira 3",
      "shelfQty": 3,
      "shelfLocation": "Gôndola 4, Nível 2",
      "shelfMinQty": 10,
      "price": 8.50,
      "deficit": 7,
      "deficitPercentage": 70.0,
      "needsReplenishment": true,
      "createdAt": "2026-08-17T12:00:00.000Z",
      "updatedAt": "2026-08-17T12:00:00.000Z"
    }
  ]
}
```

---

### `POST /products/pos/sale` (PDV Frente de Caixa)
Registra a venda de uma cesta de itens bipados/selecionados e realiza baixa atômica no estoque de gôndola (`shelfQty`).

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "items": [
    {
      "barcode": "7891000100103",
      "quantity": 2,
      "unitPrice": 8.50
    }
  ],
  "paymentMethod": "PIX"
}
```
*Formas de pagamento aceitas:* `DINHEIRO`, `PIX`, `CARTAO_DEBITO`, `CARTAO_CREDITO`, `OUTROS`

- **Resposta Sucesso (`200 OK`)**:
```json
{
  "message": "Venda finalizada com sucesso e estoque de gôndola atualizado",
  "paymentMethod": "PIX",
  "totalItems": 2,
  "totalAmount": 17.00,
  "updatedProducts": [
    {
      "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
      "name": "Leite Condensado Moça 395g",
      "barcode": "7891000100103",
      "soldQty": 2,
      "remainingShelfQty": 1
    }
  ]
}
```

---

### `GET /products/barcode/:barcode` (Busca por Código de Barras)
Consulta rápida do produto no catálogo da loja ao bipar o leitor a laser ou câmera.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Parâmetros de URL**:
  - `barcode`: Código de barras (ex: `7891000100103`)
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "product": {
    "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
    "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
    "barcode": "7891000100103",
    "name": "Leite Condensado Moça 395g",
    "category": "Laticínios",
    "depotQty": 48,
    "depotLocation": "Depósito - Corredor B, Prateleira 3",
    "shelfQty": 3,
    "shelfLocation": "Gôndola 4, Nível 2",
    "shelfMinQty": 10,
    "price": 8.50,
    "createdAt": "2026-08-17T12:00:00.000Z",
    "updatedAt": "2026-08-17T12:00:00.000Z"
  }
}
```

---

### `POST /products/:id/transfer` (Transferência Rápida Depósito -> Gôndola)
Executa a transferência atômica de reposição (`depotQty - X` e `shelfQty + X`) com validação de saldo do depósito.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "quantity": 12
}
```
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "product": {
    "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
    "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
    "barcode": "7891000100103",
    "name": "Leite Condensado Moça 395g",
    "category": "Laticínios",
    "depotQty": 36,
    "depotLocation": "Depósito - Corredor B, Prateleira 3",
    "shelfQty": 15,
    "shelfLocation": "Gôndola 4, Nível 2",
    "shelfMinQty": 10,
    "price": 8.50,
    "createdAt": "2026-08-17T12:00:00.000Z",
    "updatedAt": "2026-08-17T12:05:00.000Z"
  }
}
```

---

### `GET /products` (Listagem com Busca e Filtros)
Lista os produtos cadastrados da loja autenticada com paginação e busca textual.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Params (Opcionais)**:
  - `search`: Busca por texto no nome ou código de barras
  - `category`: Filtro por categoria
  - `limit`: Quantidade máxima (padrão `50`, máx `100`)
  - `offset`: Deslocamento de paginação (padrão `0`)
  - `tenantId` *(UUID, opcional)*: Restrito a Super Admin
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "total": 1,
  "products": [
    {
      "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
      "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
      "barcode": "7891000100103",
      "name": "Leite Condensado Moça 395g",
      "category": "Laticínios",
      "depotQty": 36,
      "depotLocation": "Depósito - Corredor B, Prateleira 3",
      "shelfQty": 15,
      "shelfLocation": "Gôndola 4, Nível 2",
      "shelfMinQty": 10,
      "price": 8.50,
      "createdAt": "2026-08-17T12:00:00.000Z",
      "updatedAt": "2026-08-17T12:05:00.000Z"
    }
  ]
}
```

---

### `GET /products/:id` (Detalhes do Produto)
Retorna os dados completos de um produto específico.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "product": {
    "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
    "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
    "barcode": "7891000100103",
    "name": "Leite Condensado Moça 395g",
    "category": "Laticínios",
    "depotQty": 36,
    "depotLocation": "Depósito - Corredor B, Prateleira 3",
    "shelfQty": 15,
    "shelfLocation": "Gôndola 4, Nível 2",
    "shelfMinQty": 10,
    "price": 8.50,
    "createdAt": "2026-08-17T12:00:00.000Z",
    "updatedAt": "2026-08-17T12:05:00.000Z"
  }
}
```

---

### `POST /products` (Cadastro de Produto)
Cadastra um novo produto no estoque. Se a conta for do plano Free e já possuir 100 SKUs, a API rejeita com erro `403 Forbidden` (trava do Freemium).

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "barcode": "7891000100103",
  "name": "Leite Condensado Moça 395g",
  "category": "Laticínios",
  "depotQty": 48,
  "depotLocation": "Depósito - Corredor B, Prateleira 3",
  "shelfQty": 3,
  "shelfLocation": "Gôndola 4, Nível 2",
  "shelfMinQty": 10,
  "price": 8.50
}
```
- **Resposta Sucesso (`201 Created`)**:
```json
{
  "product": {
    "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
    "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
    "barcode": "7891000100103",
    "name": "Leite Condensado Moça 395g",
    "category": "Laticínios",
    "depotQty": 48,
    "depotLocation": "Depósito - Corredor B, Prateleira 3",
    "shelfQty": 3,
    "shelfLocation": "Gôndola 4, Nível 2",
    "shelfMinQty": 10,
    "price": 8.50,
    "createdAt": "2026-08-17T12:00:00.000Z",
    "updatedAt": "2026-08-17T12:00:00.000Z"
  }
}
```
- **Resposta Erro Limite Freemium (`403 Forbidden`)**:
```json
{
  "error": "Limite do Plano Free atingido (100 produtos cadastrados). Faça upgrade para continuar cadastrando novos itens."
}
```

---

### `PUT /products/:id` (Atualização de Produto)
Atualiza informações cadastrais, localizações ou quantidades de estoque.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "name": "Leite Condensado Moça Lata 395g",
  "shelfMinQty": 12,
  "price": 8.90
}
```
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "product": {
    "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
    "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
    "barcode": "7891000100103",
    "name": "Leite Condensado Moça Lata 395g",
    "category": "Laticínios",
    "depotQty": 48,
    "depotLocation": "Depósito - Corredor B, Prateleira 3",
    "shelfQty": 3,
    "shelfLocation": "Gôndola 4, Nível 2",
    "shelfMinQty": 12,
    "price": 8.90,
    "createdAt": "2026-08-17T12:00:00.000Z",
    "updatedAt": "2026-08-17T12:10:00.000Z"
  }
}
```

---

### `DELETE /products/:id` (Exclusão Lógica de Produto / Soft Delete)
Realiza a exclusão lógica (*soft delete*) de um produto do catálogo da empresa, preenchendo a coluna `deleted_at` com o timestamp atual. Isto garante integridade relacional, preserva auditoria e permite que o PDV offline receba a exclusão no próximo Delta Sync.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "message": "Produto excluído com sucesso (soft delete)",
  "product": {
    "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
    "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
    "barcode": "7891000100103",
    "name": "Leite Condensado Moça Lata 395g",
    "category": "Laticínios",
    "depotQty": 0,
    "depotLocation": null,
    "shelfQty": 0,
    "shelfLocation": null,
    "shelfMinQty": 12,
    "price": 8.90,
    "createdAt": "2026-08-17T12:00:00.000Z",
    "updatedAt": "2026-08-23T12:00:00.000Z",
    "deletedAt": "2026-08-23T12:00:00.000Z"
  }
}
```

---

### `GET /products/sync/delta` (Delta Sync por Timestamp / IndexedDB Offline)
Endpoint essencial para a sincronização bidirecional e offline-first do PDV e Catálogo Web/Mobile. O cliente local armazena os produtos no **IndexedDB** e passa o parâmetro `since` (timestamp ISO da última sincronização). O servidor retorna apenas os registros alterados (upserted) ou excluídos (deleted) a partir desse timestamp.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Parameters**:
  - `since` *(string ISO-8601, obrigatório)*: Ex: `2026-08-23T00:00:00.000Z`
  - `limit` *(number, opcional, padrão 500, máx 1000)*: Limite de registros por lote
  - `tenantId` *(UUID, opcional, Super Admin apenas)*: Filtrar por tenant
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "syncedAt": "2026-08-23T12:30:00.000Z",
  "serverTimestamp": 1787488200000,
  "totalChanged": 3,
  "hasMore": false,
  "upserted": [
    {
      "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
      "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
      "barcode": "7891000100103",
      "name": "Leite Condensado Moça Lata 395g",
      "category": "Laticínios",
      "depotQty": 48,
      "depotLocation": "Depósito - Corredor B",
      "shelfQty": 15,
      "shelfLocation": "Gôndola 4",
      "shelfMinQty": 12,
      "price": 8.90,
      "createdAt": "2026-08-17T12:00:00.000Z",
      "updatedAt": "2026-08-23T12:15:00.000Z",
      "deletedAt": null
    }
  ],
  "deletedIds": [
    "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"
  ],
  "deleted": [
    {
      "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      "tenantId": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
      "barcode": "7891000200204",
      "name": "Biscoito Recheado Chocolate 140g",
      "category": "Biscoitos",
      "depotQty": 0,
      "depotLocation": null,
      "shelfQty": 0,
      "shelfLocation": null,
      "shelfMinQty": 10,
      "price": 4.50,
      "createdAt": "2026-08-15T10:00:00.000Z",
      "updatedAt": "2026-08-23T11:00:00.000Z",
      "deletedAt": "2026-08-23T11:00:00.000Z"
    }
  ]
}
```

---
---

## 5. 🛒 Histórico de Vendas e PDV (`/sales`)

Módulo de frente de caixa e persistência real de histórico de vendas com isolamento multi-tenant rigoroso e filtros de data baseados no plano do tenant:
- **Plano FREE**: Últimos 30 dias de histórico
- **Plano PRO**: Últimos 90 dias de histórico
- **Plano PREMIUM**: Últimos 365 dias (1 ano) de histórico

---

### `POST /sales` (Registrar Venda PDV)
Registra uma venda atomicamente com baixa na gôndola (`shelf_qty`) e persistência definitiva nas tabelas `sales` e `sale_items`.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "paymentMethod": "PIX",
  "items": [
    {
      "barcode": "7891000100103",
      "quantity": 2,
      "unitPrice": 8.50
    }
  ]
}
```
- **Resposta Sucesso (`201 Created`)**:
```json
{
  "message": "Venda processada e registrada com sucesso com baixa automática na gôndola",
  "paymentMethod": "PIX",
  "totalItems": 2,
  "totalAmount": 17.00,
  "updatedProducts": [
    {
      "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
      "name": "Leite Condensado Moça 395g",
      "barcode": "7891000100103",
      "soldQty": 2,
      "remainingShelfQty": 10
    }
  ]
}
```

---

### `GET /sales` (Histórico de Vendas do Tenant)
Consulta o histórico de vendas paginado do tenant com filtros de data, operador e forma de pagamento.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Params (Opcionais)**:
  - `startDate`: Data inicial (ex: `2026-08-01`) - limitada automaticamente pela janela do plano do tenant
  - `endDate`: Data final (ex: `2026-08-24`)
  - `paymentMethod`: `DINHEIRO` | `PIX` | `CARTAO_DEBITO` | `CARTAO_CREDITO` | `OUTROS` | `MULTIPLOS`
  - `userId`: UUID do operador
  - `limit`: Quantidade por página (padrão: 50, máx: 200)
  - `offset`: Deslocamento de paginação (padrão: 0)
  - `tenantId`: UUID do tenant (Super Admin apenas)

---

### `GET /sales/:id` (Detalhes de uma Venda)
Busca os dados detalhados de uma venda específica pelo seu UUID.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Parâmetros de URL**:
  - `id`: UUID da venda


---

## 6. 📱 Scanner Remoto / Bipador via Celular (`/pos/sessions`)

Permite que um operador abra o checkout no computador desktop e conecte a câmera do celular como leitor de código de barras em tempo real através de pareamento seguro com QR Code.

---

### `POST /pos/sessions/pair` (Criar Sessão de Pareamento)
Inicia uma sessão efêmera (30 minutos) e retorna o token de segurança, o canal Realtime para broadcast e a URL pronta para geração do QR Code.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Resposta Sucesso (`201 Created`)**:
```json
{
  "message": "Sessão de pareamento para scanner remoto criada com sucesso",
  "sessionId": "e812d26f-9988-4fb6-82fe-3323a6f7b112",
  "token": "4a7b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
  "channel": "pos_sess_e812d26f99884fb682fe3323a6f7b112",
  "status": "ACTIVE",
  "expiresAt": "2026-08-24T18:30:00.000Z",
  "expiresInSeconds": 1800,
  "qrCodeUrl": "/scanner-remote?session=e812d26f-9988-4fb6-82fe-3323a6f7b112&token=4a7b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b"
}
```

---

### `GET /pos/sessions/:sessionId/validate` (Validar Sessão no Mobile)
Usada pela aplicação mobile/PWA ao abrir o link do QR Code para validar a sessão e recuperar os dados do canal de broadcast antes de iniciar a leitura com a câmera.

- **Parâmetros de URL**:
  - `sessionId`: UUID da sessão
- **Query Params**:
  - `token`: Token secreto da sessão
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "valid": true,
  "sessionId": "e812d26f-9988-4fb6-82fe-3323a6f7b112",
  "channel": "pos_sess_e812d26f99884fb682fe3323a6f7b112",
  "status": "ACTIVE",
  "expiresAt": "2026-08-24T18:30:00.000Z",
  "remainingSeconds": 1785,
  "tenant": {
    "id": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
    "name": "Mercadinho São Paulo",
    "category": "MERCEARIA"
  },
  "operator": {
    "id": "11111111-2222-3333-4444-555555555555",
    "name": "Operador Caixa 01",
    "email": "caixa01@mercadinho.com"
  }
}
```

---

### `POST /pos/sessions/:sessionId/close` (Encerrar Sessão de Pareamento)
Fecha a sessão quando o PDV for finalizado no desktop.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Parâmetros de URL**:
  - `sessionId`: UUID da sessão
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "message": "Sessão de pareamento encerrada com sucesso",
  "sessionId": "e812d26f-9988-4fb6-82fe-3323a6f7b112",
  "status": "CLOSED"
}
```

## 5. 🤖 Inteligência Artificial no Chão de Loja (`/ai`)
---

Integração de altíssima velocidade (< 500ms) com a **Groq Cloud** utilizando:
- **Whisper Large v3**: Transcrição de áudio em português com alta precisão e cancelamento de ruído de fundo (freezers, caixas, movimentação de loja).
- **Llama 3.3 / Llama 3.1**: Inferência semântica com fallback dinâmico e estruturação de comandos operacionais em JSON.
- **Varredura e Reposição Geral de Gôndolas Críticas (`REPLENISH_ALL_CRITICAL`)**: Identifica comandos de varredura global (ex: *"faça uma varredura no depósito e reponha tudo que está faltando"*), consulta automaticamente todos os produtos em estado crítico com saldo em depósito e gera o plano de reposição em lote.
- **Matching Semântico Multi-Produto**: Localiza múltiplos produtos independentes na mesma frase falada pelo operador (ex: *"Adiciona 50 un de Guaraná Zero e cadastra o Guaraná 2L com 15 no depósito e 5 na gôndola"*).
- **Ações Compostas e Multi-Itens**: Executa ações individuais para cada produto em sequência (adição de estoque, cadastro com distribuição gôndola/depósito, alteração de preço ou transferências).
---

### `POST /ai/transcribe` (Transcrição via Base64)
Transcreve áudio gravado no app ou PWA enviado em string Base64.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "audioBase64": "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hy...",
  "filename": "audio.m4a",
  "language": "pt",
  "prompt": "Vocabulário de varejo: gôndola, depósito, leite, fardo"
}
```
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "text": "Transferir 10 caixas de leite integral para a gôndola",
  "model": "whisper-large-v3",
  "duration": 2.45
}
```

---

### `POST /ai/transcribe/upload` (Transcrição via Multipart/Form-Data)
Permite enviar o arquivo de áudio diretamente como multipart (ex: via `FormData` no frontend).

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: multipart/form-data
  ```
- **Form Fields**:
  - `file`: Arquivo de áudio binário (`.m4a`, `.mp3`, `.wav`, `.webm`, `.ogg`)
  - `language`: `pt` (opcional)
  - `prompt`: Contexto prévio (opcional)

---

### `POST /ai/chat` (Inferência Rápida com Llama 3.3)
Consulta ultra-rápida ao Llama 3.3 com suporte a modo JSON.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "prompt": "Resuma as 3 categorias mais críticas para reposição no varejo de vizinhança.",
  "systemPrompt": "Você é um consultor especialista em gestão de estoque para pequenos varejos.",
  "model": "llama-3.3-70b-versatile",
  "temperature": 0.1,
  "jsonMode": false
}
```

---

### `POST /ai/voice-command` (Comando de Voz Inteligente para Chão de Loja)
Pipeline integrado: **Whisper Large v3** transcreve a voz do repositor -> **Llama 3.3** extrai a intenção e parâmetros -> se `autoExecute: true`, realiza a operação de estoque no banco de dados.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body Esperado (JSON)**:
```json
{
  "audioBase64": "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH...",
  "filename": "comando.m4a",
  "autoExecute": true
}
```
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "transcription": "Movi cinco unidades de leite condensado pro corredor 4",
  "intent": "TRANSFER_STOCK",
  "extractedData": {
    "productQuery": "leite condensado",
    "quantity": 5,
    "to": "shelf"
  },
  "explanation": "Transferência de 5 unidades de leite condensado para a gôndola solicitada.",
  "executed": true,
  "executionResult": {
    "message": "Transferência de 5 un de Leite Condensado Moça Lata 395g realizada com sucesso."
  }
}

---

## 6. 📊 Relatórios e Inteligência Estratégica (`/reports`)

Módulo analítico completo projetado para gestão inteligente de pequenos e médios varejos (GO PME), oferecendo Curva ABC, Matrizes de Decisão 2x2, Análise de Giro vs Margem, Otimização de Espaço de Exposição em Gôndolas e Planejamento de Reposição/Compras.

---

### `GET /reports/overview` (Dashboard Executivo e Métricas Globais)
Retorna um sumário executivo com valor total do catálogo a preço de venda e custo, margem média consolidada, saúde do giro e alertas rápidos de compras.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Params (Opcionais)**:
  - `tenantId`: UUID do tenant (Super Admin apenas)
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "tenant": {
    "id": "c1f7a4b8-2a1d-4f1e-9a1b-123456789abc",
    "name": "Mercadinho São Paulo",
    "category": "MERCEARIA"
  },
  "inventoryOverview": {
    "totalSKUs": 45,
    "totalPhysicalUnits": 1280,
    "totalDepotUnits": 850,
    "totalShelfUnits": 430,
    "totalCatalogValue": 14500.50,
    "potentialGrossProfit": 5075.18,
    "averageMarginPercentage": 35.0
  },
  "turnoverAndABC": {
    "classACount": 9,
    "classBCount": 15,
    "classCCount": 21,
    "highTurnoverSkusCount": 18,
    "criticalStockoutCount": 4
  },
  "purchasingAlerts": {
    "reorderUrgentCount": 5,
    "estimatedCapitalRequired": 1240.80
  },
  "quickRecommendations": [
    "Identificados 5 produtos com risco de ruptura. Necessário investimento estimado de R$ 1.240,80 em reposição.",
    "Os 9 produtos da Curva A concentram R$ 11.600,40 do faturamento mensal estimado."
  ]
}
```

---

### `GET /reports/abc` (Relatório da Curva ABC - Giro, Faturamento e Margem)
Classifica o catálogo conforme o Princípio de Pareto (Classes A: ~80% do faturamento, B: ~15%, C: ~5%), permitindo ordenação por faturamento, margem, giro ou volume de vendas.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Params (Opcionais)**:
  - `sortBy`: `revenue` (padrão) | `margin` | `turnover` | `salesVolume`
  - `category`: Filtrar por categoria
  - `limit`: Quantidade máxima de itens (padrão: 100)
  - `tenantId`: UUID do tenant (Super Admin apenas)
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "summary": {
    "totalProducts": 3,
    "totalStockValue": 2540.00,
    "totalMonthlyRevenue": 7850.00,
    "totalMonthlyProfit": 2747.50,
    "averageMarginPercentage": 35.0,
    "classACount": 1,
    "classBCount": 1,
    "classCCount": 1,
    "classARevenue": 6280.00,
    "classBRevenue": 1177.50,
    "classCRevenue": 392.50
  },
  "items": [
    {
      "id": "8f3b145d-7a1b-4f9e-bc43-228741369def",
      "barcode": "7891000100103",
      "name": "Leite Condensado Moça Lata 395g",
      "category": "Laticínios",
      "price": 8.50,
      "estimatedCost": 5.53,
      "marginUnit": 2.97,
      "marginPercentage": 35.0,
      "depotQty": 20,
      "shelfQty": 12,
      "totalStockQty": 32,
      "estimatedDailySales": 3.5,
      "estimatedMonthlySales": 105,
      "estimatedMonthlyRevenue": 892.50,
      "estimatedMonthlyProfit": 311.85,
      "turnoverRatio": 3.28,
      "stockDaysRemaining": 9,
      "revenueSharePercentage": 65.4,
      "accumulatedSharePercentage": 65.4,
      "abcClass": "A",
      "turnoverClass": "ALTO",
      "marginClass": "MEDIA"
    }
  ]
}
```

---

### `GET /reports/turnover-margin-matrix` (Matriz Rentabilidade x Giro)
Segmenta produtos em 4 quadrantes para decisões de sortimento e precificação:
1. **ESTRELA**: Alto Giro + Alta Margem (Golden Zone / Ponta de Gôndola)
2. **ALTO_GIRO**: Alto Giro + Baixa Margem (Gerador de Tráfego / Fundo de Loja)
3. **GERADOR_MARGEM**: Baixo Giro + Alta Margem (Oportunidade / Cross-Merchandising)
4. **LENTO_ABAIXO_MARGEM**: Baixo Giro + Baixa Margem (Candidato a Queima / Descontinuação)

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Params (Opcionais)**:
  - `classification`: `ESTRELA` | `ALTO_GIRO` | `GERADOR_MARGEM` | `LENTO_ABAIXO_MARGEM`
  - `category`: Filtrar por categoria
  - `tenantId`: UUID do tenant (Super Admin apenas)

---

### `GET /reports/replenishment-purchasing` (Planejamento de Compras e Ponto de Pedido - ROP)
Calcula o Ponto de Pedido ($ROP = (Demanda \times LeadTime) + EstoqueSegurança$) e sugere o volume exato de compra e investimento financeiro necessário para evitar ruptura.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Params (Opcionais)**:
  - `leadTimeDays`: Prazo de entrega do fornecedor em dias (Padrão: 7)
  - `safetyStockDays`: Dias de cobertura do estoque de segurança (Padrão: 3)
  - `status`: `CRITICO_RUPTURA` | `COMPRA_URGENTE` | `ATENCAO` | `ESTAVEL` | `EXCESSO`
  - `category`: Filtrar por categoria
  - `tenantId`: UUID do tenant (Super Admin apenas)

---

### `GET /reports/space-optimization` (Otimização de Espaço Físico de Exposição)
Cruza a eficiência de receita gerada versus a área/frentes ocupadas na gôndola, sugerindo expansão, manutenção, redução ou substituição de mix.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Query Params (Opcionais)**:
  - `action`: `EXPANDIR_GONDOLA` | `MANTER` | `REDUZIR_GONDOLA` | `REAVALIAR_MIX`
  - `category`: Filtrar por categoria
  - `tenantId`: UUID do tenant (Super Admin apenas)
```

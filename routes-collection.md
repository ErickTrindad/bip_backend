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
| `DELETE` | `/products/:id` | Autenticado | Exclusão de produto do catálogo |
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

### `DELETE /products/:id` (Exclusão de Produto)
Remove um produto do catálogo da empresa.

- **Headers**:
  ```http
  Authorization: Bearer <SEU_ACCESS_TOKEN>
  ```
- **Resposta Sucesso (`200 OK`)**:
```json
{
  "message": "Produto excluído com sucesso"
}
```

---

Integração de altíssima velocidade (< 500ms) com a **Groq Cloud** utilizando:
- **Whisper Large v3**: Transcrição de áudio em português com alta precisão e cancelamento de ruído de fundo (freezers, caixas, movimentação de loja).
- **Llama 3.3 / Llama 3.1**: Inferência semântica com fallback dinâmico e estruturação de comandos operacionais em JSON.
- **Matching Semântico Inteligente**: Localiza produtos cadastrados mesmo se o operador falar nomes com variações (ex: *"Guaraná Zero 2L"* localiza *"Refrigerante Guaraná Antarctica Zero 2 Litros"*).
- **Suporte a Atualização de Preço e Dados**: Intenção `UPDATE_PRODUCT` para reajustes de preço, localizações e estoque mínimo por voz.
- **Compatibilidade OpenAI**: URL base (`GROQ_BASE_URL`) pode ser migrada sem alterar regras de negócio.

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
```

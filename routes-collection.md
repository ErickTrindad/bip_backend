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

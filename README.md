# Painel de Consulta de Financiamento Imobiliário

Sistema completo para imobiliárias consultarem análise de financiamento imobiliário via API oficial de parceiros bancários, com conformidade LGPD e arquitetura de integração plugável.

## 🏗️ Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│    Backend      │────▶│  Partner APIs   │
│   (React/TS)    │     │   (Node/TS)     │     │  (Pluggable)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   (Prisma ORM)  │
                       └─────────────────┘
```

## 🚀 Início Rápido

### Pré-requisitos
- Docker e Docker Compose
- Node.js 20+ (para desenvolvimento local)
- PostgreSQL 16+ (se não usar Docker)

### Com Docker (Recomendado)

```bash
# Clone o repositório
cd painel-consulta-financiamento

# Configure as variáveis de ambiente
cp backend/.env.example backend/.env
# Edite backend/.env com suas configurações

# Suba os containers
docker-compose up -d

# Acesse:
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
# Health check: http://localhost:4000/api/health
```

### Desenvolvimento Local

```bash
# Backend
cd backend
cp .env.example .env
# Configure DATABASE_URL e secrets (Postgres na porta 5433)
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
# Frontend: http://localhost:3000 (proxy para backend:4000)
```

## 📋 Funcionalidades

### ✅ Implementadas
- **Autenticação JWT** com access/refresh tokens
- **Controle de acesso** por roles (ADMIN, BROKER, VIEWER)
- **CRUD de Clientes** com validação e mascaramento de dados sensíveis
- **Gestão de Consentimentos** LGPD-compliant
- **Fluxo de Consulta** multi-etapas (Cliente → Consentimento → Financiamento → Confirmação)
- **Integração Plugável** com parceiros (Mock pronto, adaptadores para bancos reais)
- **Dashboard** com estatísticas e consultas recentes
- **Histórico de Consultas** com filtros e paginação
- **Painel de Parceiros** (admin) para configuração
- **Auditoria** completa de ações
- **Interface Responsiva** em PT-BR

### 🔧 Integração com Parceiros

O sistema usa **padrão Adapter** para integração:

```typescript
// backend/src/integrations/partnerAdapter.ts
export interface PartnerAdapter {
  readonly name: string;
  readonly requiredFields: string[];
  readonly isConfigured: boolean;
  validateConfig(): Promise<{ valid: boolean; errors: string[] }>;
  buildRequest(request: ConsultationRequest): Promise<RequestConfig>;
  sendRequest(request: ConsultationRequest): Promise<ConsultationResponse>;
  parseResponse(response: unknown): ConsultationResponse;
}
```

**Parceiros suportados:**
- `mock` - Simulador para desenvolvimento/testes (ativo por padrão)
- `example_bank` - Template para banco real (implementar conforme documentação)

### 📦 Para Ativar Parceiro Real

1. **Obtenha credenciais** do banco/parceiro (contrato, client_id, client_secret, certificados)
2. **Configure no banco** via painel admin ou SQL direto:
   ```sql
   INSERT INTO partner_configs (name, display_name, base_url, auth_type, credentials, is_active, is_test_env, required_fields)
   VALUES ('banco_x', 'Banco X S.A.', 'https://api.bancox.com.br', 'oauth2', 
           '{"client_id": "...", "client_secret": "..."}', true, false, 
           '["fullName","cpf","birthDate","monthlyIncome","propertyValue","downPayment"]');
   ```
3. **Implemente adaptador** em `backend/src/integrations/bankAdapter.ts` estendendo `BankPartnerAdapter`
4. **Registre no registry** no seed ou startup
5. **Teste em ambiente de homologação** do parceiro
6. **Ative em produção** (`is_test_env: false`)

## 🔐 Segurança e LGPD

- **Dados sensíveis** (CPF, RG) mascarados na UI
- **Criptografia AES-256-GCM** para dados em repouso
- **Tokens JWT** com rotação e expiração
- **Rate limiting** por IP
- **Headers de segurança** (Helmet, CSP)
- **Auditoria** imutável de todas as ações
- **Consentimento explícito** antes de cada consulta
- **Direito à exclusão** e correção de dados
- **Nenhum log** de dados sensíveis

## 📁 Estrutura do Projeto

```
painel-consulta-financiamento/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Modelos do banco
│   │   └── seed.ts            # Dados iniciais
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── lib/               # Prisma, encryption
│   │   ├── middleware/        # Auth, audit, errors
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   ├── integrations/      # Partner adapters
│   │   └── utils/             # Validators
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/             # Page components
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # API client
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Formatters
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🧪 Testes

```bash
# Backend
cd backend
npm test           # Unit tests
npm run test:watch # Watch mode

# Frontend
cd frontend
npm test
```

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` - Registrar usuário
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Perfil do usuário
- `PATCH /api/auth/me` - Atualizar perfil
- `POST /api/auth/change-password` - Alterar senha

### Clientes
- `GET /api/clients` - Listar (com filtros/paginação)
- `POST /api/clients` - Criar
- `GET /api/clients/:id` - Detalhes (mascarado)
- `GET /api/clients/:id/sensitive` - Detalhes completos (admin)
- `PATCH /api/clients/:id` - Atualizar
- `DELETE /api/clients/:id` - Excluir/Arquivar
- `GET /api/clients/:id/consents` - Consentimentos
- `POST /api/clients/:id/consents` - Criar consentimento
- `POST /api/consents/:id/revoke` - Revogar consentimento

### Consultas
- `POST /api/consultations` - Nova consulta
- `GET /api/consultations` - Histórico (filtros/paginação)
- `GET /api/consultations/stats` - Estatísticas
- `GET /api/consultations/:id` - Detalhes da consulta

### Parceiros (Admin)
- `GET /api/partners` - Listar todos
- `GET /api/partners/active` - Parceiros ativos configurados
- `POST /api/partners` - Criar
- `PATCH /api/partners/:id` - Atualizar
- `POST /api/partners/:id/test` - Testar configuração
- `POST /api/partners/:id/set-default` - Definir como padrão
- `DELETE /api/partners/:id` - Remover

### Configurações (Admin)
- `GET /api/config` - Listar
- `POST /api/config` - Criar
- `PUT /api/config/:key` - Atualizar
- `DELETE /api/config/:key` - Remover

## 🌍 Variáveis de Ambiente (Backend)

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# JWT (mínimo 32 chars cada)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Encryption (32 chars)
ENCRYPTION_KEY=your-32-char-encryption-key-here!!

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

## 📝 Checklist para Produção

- [ ] Configurar `NODE_ENV=production`
- [ ] Gerar secrets JWT fortes (64+ chars)
- [ ] Configurar `ENCRYPTION_KEY` forte
- [ ] Configurar PostgreSQL com SSL
- [ ] Configurar HTTPS/TLS (reverse proxy nginx/traefik)
- [ ] Configurar parceiro real (credenciais, adaptador, homologação)
- [ ] Definir `is_test_env: false` no parceiro de produção
- [ ] Configurar backup automático do PostgreSQL
- [ ] Configurar monitoramento (logs, métricas, alertas)
- [ ] Revisar CORS (`FRONTEND_URL`)
- [ ] Testar fluxo completo em staging

## 🤝 Contribuição

1. Fork o projeto
2. Crie branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push (`git push origin feature/nova-funcionalidade`)
5. Abra Pull Request

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## ⚠️ Aviso Importante

**Este sistema NÃO realiza consultas reais sem configuração de parceiro válida.** O adaptador `mock` simula respostas apenas para desenvolvimento. Para uso em produção, **você deve**:

1. Firmar contrato com instituição financeira autorizada
2. Obter credenciais de API oficiais
3. Implementar adaptador conforme documentação do parceiro
4. Testar em ambiente de homologação do parceiro
5. Configurar `is_test_env: false` apenas após validação

**Nunca use credenciais de teste em produção. Nunca exponha secrets no frontend ou repositório.**
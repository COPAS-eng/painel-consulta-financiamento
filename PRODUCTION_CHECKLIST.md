# Checklist de Ativação para Produção

Este documento lista **tudo que o responsável pela imobiliária precisa fornecer** para ativar consultas reais de financiamento.

---

## 1. Escolha do Parceiro

- [ ] **Instituição financeira definida** (ex: Banco do Brasil, Caixa, Bradesco, Itaú, Santander, ou correspondente autorizado)
- [ ] **Contrato/Termo de adesão assinado** com a instituição
- [ ] **Escopo de uso aprovado** (consulta de crédito, simulação, formalização)
- [ ] **Contato técnico** do parceiro para suporte à integração

---

## 2. Documentação Oficial da API

Forneça **TODOS** os itens abaixo (original ou link oficial):

- [ ] **Especificação OpenAPI/Swagger** ou documentação completa de endpoints
- [ ] **Autenticação**: tipo (OAuth2, mTLS, API Key, Basic, JWT), flows, scopes
- [ ] **Endpoints**: homologação (sandbox) e produção
- [ ] **Campos obrigatórios** por endpoint (request/response)
- [ ] **Códigos de resposta** (sucesso, erro, validação, negócio)
- [ ] **Limites de taxa** (requests/minuto, burst, quotas)
- [ ] **Formato de dados**: CPF (com/sem máscara), datas, moeda, enums
- [ ] **Requisitos de certificado** (mTLS: .pfx/.p12 + senha, ou .crt/.key)
- [ ] **Ambiente de testes**: credenciais, dados de teste permitidos, como resetar
- [ ] **SLA e suporte**: horários, canais, tempo de resposta

---

## 3. Credenciais de Produção

**NUNCA** envie por e-mail, chat ou commite no repositório. Use gerenciador de segredos ou entrega presencial.

- [ ] **Client ID** / **Client Secret** (OAuth2)
- [ ] **API Key** (se aplicável)
- [ ] **Certificado digital** (.pfx/.p12) + **senha** (se mTLS)
- [ ] **Certificado da CA** do parceiro (se necessário para validação)
- [ ] **Credenciais de homologação** (separadas das de produção)

---

## 4. Configuração do Ambiente

### Backend (.env ou gerenciador de segredos)
```env
# Parceiro escolhido
PARTNER_NAME=banco_x
PARTNER_DISPLAY_NAME="Banco X S.A."
PARTNER_BASE_URL=https://api.bancox.com.br  # Produção
PARTNER_AUTH_TYPE=oauth2  # ou mTLS, api_key, basic, bearer
PARTNER_CLIENT_ID=xxx
PARTNER_CLIENT_SECRET=xxx
PARTNER_CERT_PATH=/secrets/cert.pfx
PARTNER_CERT_PASSWORD=xxx
PARTNER_IS_TEST_ENV=false
PARTNER_RATE_LIMIT=60
PARTNER_REQUIRED_FIELDS=["fullName","cpf","birthDate","monthlyIncome","propertyValue","downPayment","termMonths"]

# Secrets (gerar novos para produção, 64+ chars)
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ENCRYPTION_KEY=...

# Portas
PORT=4000
FRONTEND_URL=https://seudominio.com.br
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

### Infraestrutura
- [ ] PostgreSQL com SSL/TLS habilitado
- [ ] Backup automático configurado (diário + point-in-time recovery)
- [ ] Reverse proxy (nginx/Traefik) com HTTPS/TLS 1.2+
- [ ] Logs centralizados (ELK, Datadog, CloudWatch, etc.)
- [ ] Monitoramento de saúde (health checks, alertas)
- [ ] Rate limiting no load balancer/WAF

---

## 5. Implementação do Adaptador

**Responsabilidade da equipe técnica** (pode ser feita após recebimento da documentação):

- [ ] Criar `BancoXAdapter` estendendo `BankPartnerAdapter` em `backend/src/integrations/bankAdapter.ts`
- [ ] Implementar:
  - `getAuthUrl()` - endpoint de token OAuth2
  - `getConsultationEndpoint()` - path da análise de crédito
  - `refreshToken()` - renovação de access token
  - `transformToBankFormat()` - mapeamento request
  - `parseResponse()` - parsing response + mapeamento status
- [ ] Tratar códigos de erro específicos do parceiro
- [ ] Adicionar validações de negócio (ex: faixa etária, renda mínima)
- [ ] Registrar no `partnerRegistry` no seed/startup
- [ ] Testes unitários do adaptador

---

## 6. Homologação com o Parceiro

**Obrigatório antes de ir para produção:**

- [ ] Credenciais de homologação funcionando
- [ ] Casos de teste cobertos:
  - [ ] Consulta aprovada
  - [ ] Consulta negada (renda insuficiente, restrição, etc.)
  - [ ] Consulta pendente/análise manual
  - [ ] Erros de validação (CPF inválido, campos faltando)
  - [ ] Erros de autenticação/autorização
  - [ ] Timeout/indisponibilidade da API
  - [ ] Resposta com campos opcionais ausentes
- [ ] Validação de **dados mascarados** nos logs
- [ ] Teste de **consentimento LGPD** (criar, revogar, expirar)
- [ ] Teste de **auditoria** (todas as ações registradas)
- [ ] Assinatura do termo de homologação pelo parceiro

---

## 7. Configuração Final de Produção

- [ ] Atualizar `partner_configs` no banco:
  ```sql
  UPDATE partner_configs 
  SET is_active = true, is_test_env = false, base_url = 'https://api.bancox.com.br'
  WHERE name = 'banco_x';
  ```
- [ ] Definir como padrão: `POST /api/partners/{id}/set-default`
- [ ] Verificar `GET /api/partners/active` retorna o parceiro
- [ ] Testar fluxo completo E2E em staging com dados reais (anonimizados)
- [ ] Validar mascaramento de CPF/RG na UI
- [ ] Validar que **nenhum dado sensível** aparece em logs
- [ ] Configurar alertas: falhas de consulta > 5%, latência > 10s, erros de auth

---

## 8. Treinamento e Documentação para Usuários

- [ ] Manual do corretor: como cadastrar cliente, obter consentimento, fazer consulta
- [ ] Fluxo de tratamento de erros (o que dizer ao cliente em cada caso)
- [ ] Procedimento para solicitação de exclusão de dados (LGPD)
- [ ] Contato de suporte técnico interno

---

## 9. Go-Live

- [ ] Aprovação do gestor/responsável legal
- [ ] Janela de deploy definida (baixo tráfego)
- [ ] Rollback plan documentado
- [ ] Monitoramento ativo nas primeiras 24h
- [ ] Feedback dos corretores coletado na primeira semana

---

## 📋 Entregáveis do Responsável pela Imobiliária

| Item | Formato | Prazo |
|------|---------|-------|
| Contrato com parceiro | PDF/Original | Antes do dev |
| Documentação API parceiro | Link/PDF/OpenAPI | Antes do dev |
| Credenciais homologação | Seguro (vault/1password/presencial) | Início do dev |
| Credenciais produção | Seguro (vault/1password/presencial) | Após homologação |
| Certificados mTLS | Arquivo + senha (seguro) | Se aplicável |
| Contato técnico parceiro | E-mail/Telefone | Início do dev |
| Aprovação homologação | E-mail/Documento assinado | Antes do go-live |
| Aprovação go-live | E-mail/Documento assinado | Deploy |

---

## ⚠️ Responsabilidades

| Responsável | Atividades |
|-------------|------------|
| **Imobiliária** | Contrato, credenciais, aprovações, treinamento usuários |
| **Equipe Técnica** | Adaptador, testes, deploy, infra, monitoramento |
| **Parceiro** | Documentação, homologação, suporte, SLA |

---

## 🚫 O que NÃO fazer

- ❌ Compartilhar credenciais por e-mail, WhatsApp, Slack
- ❌ Commitar secrets no Git
- ❌ Usar credenciais de homologação em produção
- ❌ Ativar `is_test_env: false` sem homologação assinada
- ❌ Enviar dados reais para ambiente de testes do parceiro (exceto se autorizado)
- ❌ Logar CPF, RG, renda, tokens, responses completas
- ❌ Prometer aprovação de crédito ao cliente
- ❌ Confundir simulação própria com resultado oficial do parceiro

---

**Status**: ☐ Pendente | ☐ Em Andamento | ☐ Concluído

**Responsável**: ________________________ **Data**: _______________
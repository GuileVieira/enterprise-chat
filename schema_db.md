# 📊 Estrutura Completa dos Documentos - Dashboard Analytics Admin

## 🗄️ **Banco de Dados: LibreChat**
**URI:** `mongodb://127.0.0.1:27017/enterprisechat`

---

## 📋 **1. CONVERSATIONS (Conversas)**
**Coleção:** `conversations`

### Estrutura:
```javascript
{
  _id: ObjectId,
  conversationId: String (UUID),
  user: ObjectId (ref: User),
  title: String,
  endpoint: String, // 'openAI', 'anthropic', 'google', etc.
  model: String,
  agent_id: String,
  assistant_id: String,
  spec: String,
  iconURL: String,
  files: [String], // Array de file_ids
  tags: [String],
  isArchived: Boolean,
  expiredAt: Date, // Para chats temporários
  createdAt: Date,
  updatedAt: Date,
  messages: [ObjectId] // refs para Messages
}
```

### Métricas para Dashboard:
- Total de conversas por período
- Conversas por endpoint/modelo
- Conversas por usuário
- Conversas arquivadas vs ativas
- Duração média das conversas
- Conversas com agentes vs assistentes

---

## 💬 **2. MESSAGES (Mensagens)**
**Coleção:** `messages`

### Estrutura:
```javascript
{
  _id: ObjectId,
  messageId: String (UUID),
  conversationId: String (UUID),
  parentMessageId: String,
  user: ObjectId (ref: User),
  sender: String, // 'User', 'Assistant', etc.
  text: String,
  isCreatedByUser: Boolean,
  endpoint: String,
  model: String,
  tokenCount: Number,
  files: [Object], // Arquivos anexados
  finish_reason: String,
  error: String,
  unfinished: Boolean,
  plugin: String,
  plugins: [String],
  expiredAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Métricas para Dashboard:
- Total de mensagens por período
- Mensagens por usuário vs IA
- Consumo de tokens por modelo
- Taxa de erro nas mensagens
- Mensagens com arquivos anexados
- Tempo de resposta médio

---

## 🤖 **3. AGENTS (Agentes)**
**Coleção:** `agents`

### Estrutura:
```javascript
{
  _id: ObjectId,
  id: String (UUID),
  name: String,
  description: String,
  instructions: String,
  author: ObjectId (ref: User),
  avatar: String,
  model: String,
  provider: String,
  tools: [String], // 'file_search', 'execute_code', etc.
  tool_resources: {
    file_search: { file_ids: [String] },
    execute_code: { file_ids: [String] }
  },
  actions: [String], // IDs de actions customizadas
  projectIds: [ObjectId],
  category: String,
  is_promoted: Boolean,
  support_contact: String,
  artifacts: Boolean,
  model_parameters: Object,
  versions: [Object], // Histórico de versões
  createdAt: Date,
  updatedAt: Date
}
```

### Métricas para Dashboard:
- Total de agentes criados
- Agentes mais utilizados
- Agentes por categoria
- Agentes promovidos
- Uso de ferramentas por agente
- Versões de agentes

---

## 👨‍💼 **4. ASSISTANTS (Assistentes OpenAI)**
**Coleção:** `assistants`

### Estrutura:
```javascript
{
  _id: ObjectId,
  assistant_id: String,
  user: ObjectId (ref: User),
  name: String,
  description: String,
  instructions: String,
  model: String,
  tools: [Object],
  file_ids: [String],
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### Métricas para Dashboard:
- Total de assistentes
- Assistentes por usuário
- Modelos mais utilizados
- Ferramentas mais usadas

---

## 📁 **5. FILES (Arquivos)**
**Coleção:** `files`

### Estrutura:
```javascript
{
  _id: ObjectId,
  file_id: String (UUID),
  user: ObjectId (ref: User),
  filename: String,
  originalname: String,
  mimetype: String,
  size: Number,
  filepath: String,
  context: String, // 'agents', 'assistants', 'chat'
  embedded: Boolean, // Se foi processado para busca
  text: String, // Texto extraído (OCR/parsing)
  usage: Number, // Contador de uso
  temp_file_id: String,
  expiresAt: Date, // TTL para arquivos temporários
  metadata: {
    fileIdentifier: String,
    width: Number,
    height: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Métricas para Dashboard:
- Total de arquivos por tipo
- Tamanho total de armazenamento
- Arquivos mais utilizados
- Arquivos por contexto (agents/chat)
- Taxa de processamento (embedded)

---

## 💰 **6. TRANSACTIONS (Transações)**
**Coleção:** `transactions`

### Estrutura:
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  conversationId: String,
  model: String,
  endpoint: String,
  tokenType: String, // 'prompt', 'completion'
  rawAmount: Number, // Tokens brutos
  tokenValue: Number, // Valor calculado
  rate: Number, // Taxa de conversão
  context: String, // 'message', 'incomplete', 'refill'
  valueKey: String,
  endpointTokenConfig: Object,
  rateDetail: {
    input: Number,
    write: Number,
    read: Number
  },
  inputTokens: Number,
  writeTokens: Number,
  readTokens: Number,
  createdAt: Date
}
```

### Métricas para Dashboard:
- Custo total por período
- Custo por usuário
- Custo por modelo/endpoint
- Tokens consumidos por tipo
- Transações de recarga automática

---

## 💳 **7. BALANCE (Saldos)**
**Coleção:** `balances`

### Estrutura:
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  tokenCredits: Number,
  lastRefill: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Métricas para Dashboard:
- Saldo médio dos usuários
- Usuários com saldo baixo
- Histórico de recargas

---

## 🎯 **8. ACTIONS (Ações Customizadas)**
**Coleção:** `actions`

### Estrutura:
```javascript
{
  _id: ObjectId,
  action_id: String,
  user: ObjectId (ref: User),
  name: String,
  description: String,
  url: String,
  method: String,
  headers: Object,
  body: String,
  metadata: {
    api_key: String,
    oauth_client_id: String,
    oauth_client_secret: String,
    domain: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Métricas para Dashboard:
- Total de ações customizadas
- Ações mais utilizadas
- Ações por domínio

---

## 📋 **9. PRESETS (Predefinições)**
**Coleção:** `presets`

### Estrutura:
```javascript
{
  _id: ObjectId,
  presetId: String (UUID),
  user: ObjectId (ref: User),
  title: String,
  endpoint: String,
  model: String,
  chatGptLabel: String,
  promptPrefix: String,
  temperature: Number,
  top_p: Number,
  presence_penalty: Number,
  frequency_penalty: Number,
  max_tokens: Number,
  tools: [String],
  defaultPreset: Boolean,
  order: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Métricas para Dashboard:
- Presets mais utilizados
- Configurações mais populares
- Presets por endpoint

---

## 👥 **10. USERS (Usuários)**
**Coleção:** `users`

### Estrutura:
```javascript
{
  _id: ObjectId,
  name: String,
  username: String,
  email: String,
  emailVerified: Boolean,
  password: String, // Hash
  avatar: String,
  provider: String, // 'local', 'google', 'github'
  providerId: String,
  role: String, // 'USER', 'ADMIN'
  refreshToken: [String],
  loginAttempts: Number,
  lockUntil: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Métricas para Dashboard:
- Total de usuários registrados
- Usuários ativos por período
- Métodos de autenticação
- Usuários por role

---

## 🔐 **11. ROLES (Funções)**
**Coleção:** `roles`

### Estrutura:
```javascript
{
  _id: ObjectId,
  name: String, // 'ADMIN', 'USER', etc.
  permissions: {
    prompts: {
      use: Boolean,
      create: Boolean,
      share: Boolean
    },
    bookmarks: {
      use: Boolean,
      create: Boolean,
      share: Boolean
    },
    // ... outras permissões
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## 📊 **DASHBOARD ANALYTICS - MÉTRICAS PRINCIPAIS**

### 📈 **Métricas de Uso:**
1. **Conversas por dia/semana/mês**
2. **Mensagens por período**
3. **Usuários ativos**
4. **Tokens consumidos por modelo**
5. **Arquivos enviados por tipo**

### 💰 **Métricas Financeiras:**
1. **Custo total por período**
2. **Custo por usuário**
3. **Custo por modelo/endpoint**
4. **Saldo médio dos usuários**

### 🤖 **Métricas de IA:**
1. **Modelos mais utilizados**
2. **Agentes mais populares**
3. **Taxa de erro nas respostas**
4. **Tempo de resposta médio**

### 👥 **Métricas de Usuários:**
1. **Novos registros por período**
2. **Usuários mais ativos**
3. **Métodos de login preferidos**
4. **Distribuição por roles**

### 🔧 **Métricas Técnicas:**
1. **Performance por endpoint**
2. **Uso de ferramentas (file_search, code_execution)**
3. **Taxa de sucesso das ações customizadas**
4. **Armazenamento utilizado**

---

## 🔗 **Relacionamentos Entre Coleções**

### Principais Relacionamentos:
- **Users** → **Conversations** (1:N)
- **Users** → **Messages** (1:N)
- **Users** → **Agents** (1:N)
- **Users** → **Files** (1:N)
- **Users** → **Transactions** (1:N)
- **Users** → **Balance** (1:1)
- **Conversations** → **Messages** (1:N)
- **Agents** → **Files** (N:N via tool_resources)
- **Actions** → **Agents** (N:N via actions array)

### Índices Recomendados para Performance:
- `conversations`: `{ user: 1, updatedAt: -1 }`
- `messages`: `{ conversationId: 1, createdAt: 1 }`
- `transactions`: `{ user: 1, createdAt: -1 }`
- `files`: `{ user: 1, context: 1 }`
- `agents`: `{ author: 1, category: 1 }`

Esta estrutura completa permite criar um dashboard analytics robusto com insights detalhados sobre o uso, custos, performance e comportamento dos usuários no sistema EnterpriseChat.
# 📋 Guia de Migração: Cognito → FastAPI

## ANTES vs DEPOIS

### Autenticação

**ANTES (Cognito):**
```javascript
import { signIn } from '@/api/new/auth';
const result = await signIn(email, password);
const token = result.AuthenticationResult.AccessToken;
const idToken = result.AuthenticationResult.IdToken;
```

**DEPOIS (FastAPI):**
```javascript
import { auth } from '@/api/new/fastapi-api';
const { token, user } = await auth.login(email, password);
// token é automaticamente armazenado no store
```

---

## 🎯 Exemplos Práticos

### 1. LOGIN

```javascript
import { auth } from '@/api/new/fastapi-api';

const handleLogin = async (email, password) => {
  try {
    const { token, user } = await auth.login(email, password);
    console.log('✅ Logado como:', user.email, '(tipo:', user.type + ')');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
};
```

### 2. LISTAR ALERTAS

```javascript
import { alerts } from '@/api/new/fastapi-api';

const handleLoadAlerts = async () => {
  try {
    const { total, alerts: alertList, role } = await alerts.listAlerts(null, 50);
    console.log(`✅ ${total} alertas encontrados (você é ${role})`);
  } catch (error) {
    console.error('Erro ao carregar alertas:', error.message);
  }
};
```

### 3. ENVIAR COMANDO

```javascript
import { commands } from '@/api/new/fastapi-api';

// Opção 1: Comando rápido
const handleStartPivo = async (irrigadorId, pivoId) => {
  try {
    const result = await commands.startPivo(irrigadorId, pivoId, 60, 80);
    console.log('✅ Comando enviado:', result.doc_id);
  } catch (error) {
    console.error('Erro:', error.message);
  }
};

// Opção 2: Comando customizado
const handleScheduleCommand = async (irrigadorId) => {
  try {
    const result = await commands.scheduleCommand(
      irrigadorId,
      'start',
      30, // agendar para 30 minutos depois
      { duration: 120, flow_rate: 90 },
      'pivo_001'
    );
    console.log('✅ Comando agendado para:', result.will_execute_in);
  } catch (error) {
    console.error('Erro:', error.message);
  }
};
```

### 4. REGISTRAR DEVICE TOKEN (Push)

```javascript
import { alerts } from '@/api/new/fastapi-api';
import * as Notifications from 'expo-notifications';

const handleRegisterPush = async () => {
  try {
    // Obter token do Expo
    const { data: token } = await Notifications.getExpoPushTokenAsync();

    // Registrar no backend
    const result = await alerts.registerDeviceToken(token, {
      model: 'iPhone 12',
      os: 'iOS',
    });

    console.log('✅ Device registrado para push');
  } catch (error) {
    console.error('Erro:', error.message);
  }
};
```

### 5. ENVIAR NOTIFICAÇÃO MANUAL

```javascript
import { alerts } from '@/api/new/fastapi-api';

const handleSendNotification = async () => {
  try {
    const result = await alerts.sendNotification(
      'Teste de notificação',
      ['+5511999999999'],           // phones
      ['user@example.com'],         // emails
      ['sms', 'whatsapp', 'email']  // channels
    );

    console.log('✅ Notificações enviadas:', result.channels);
  } catch (error) {
    console.error('Erro:', error.message);
  }
};
```

### 6. OBTER HISTÓRICO DE NOTIFICAÇÕES

```javascript
import { alerts } from '@/api/new/fastapi-api';

const handleGetHistory = async () => {
  try {
    const { total, logs } = await alerts.getNotificationHistory('irrigador_123', 50);
    console.log(`Histórico: ${total} notificações push enviadas`);
  } catch (error) {
    console.error('Erro:', error.message);
  }
};
```

### 7. VERIFICAR AUTENTICAÇÃO

```javascript
import { auth } from '@/api/new/fastapi-api';

// Verificar se está logado
const isLoggedIn = auth.isAuthenticated();

// Obter tipo de usuário
const userType = auth.getUserType(); // 'admin', 'revenda', 'cliente'

// Obter email do usuário
const email = auth.getUserEmail();
```

---

## 🔧 Configuração de Ambiente

### `.env.development`
```ini
VITE_API_BASE_URL=http://localhost:8000/api
```

### `.env.production`
```ini
VITE_API_BASE_URL=https://api.example.com/api
```

---

## 📝 Mapeamento de Mudanças

| Funcionalidade | Antes (Cognito) | Depois (FastAPI) | Nota |
|---|---|---|---|
| **Login** | `signIn()` | `auth.login()` | Mais simples |
| **Token** | JWT (3 partes) | Base64(email:type) | Dev-friendly |
| **Alertas** | Não tinha | `alerts.listAlerts()` | NOVO |
| **Comandos** | Não tinha REST | `commands.sendCommand()` | NOVO |
| **Push** | Customizado | `alerts.registerDeviceToken()` | NOVO |
| **User Data** | Decodificar JWT | `auth.getCurrentUser()` | Automático |

---

## 🚀 Atualizar Componentes

### Antes
```typescript
import { signIn } from '@/api/new/auth';
import { decodeToken } from '@/stores/new/authStore';

const handleLogin = async (email, password) => {
  const result = await signIn(email, password);
  const user = decodeToken(result.AuthenticationResult.IdToken);
  setUser(user);
};
```

### Depois
```typescript
import { auth } from '@/api/new/fastapi-api';

const handleLogin = async (email, password) => {
  const { user } = await auth.login(email, password);
  // Zustand store já atualiza automaticamente!
};
```

---

## ✅ Checklist de Migração

- [ ] Atualizar imports: `auth` → `fastapi-api`
- [ ] Remover decodificação manual de JWT
- [ ] Atualizar handlers de error
- [ ] Testar login/logout
- [ ] Testar listagem de alertas
- [ ] Testar envio de comandos
- [ ] Testar push notifications
- [ ] Remover código antigo de Cognito

---

## 📚 Referência Rápida

```javascript
// Imports
import { auth, alerts, commands } from '@/api/new/fastapi-api';

// Auth
await auth.register(email, password, name, type);
await auth.login(email, password);
await auth.logout();
auth.isAuthenticated();
auth.getUserType();

// Alerts
await alerts.listAlerts(irrigadorId, limit);
await alerts.getAlert(alertId);
await alerts.sendNotification(message, phones, emails, channels);
await alerts.registerDeviceToken(token, deviceInfo);
await alerts.getNotificationHistory(irrigadorId, limit);

// Commands
await commands.sendCommand(irrigadorId, command, params, pivoId, timerMinutes);
await commands.listCommands(irrigadorId, status, limit);
await commands.getCommand(commandId);
await commands.cancelCommand(commandId);
// Quick commands:
await commands.startPivo(irrigadorId, pivoId, duration, flowRate);
await commands.stopPivo(irrigadorId, pivoId);
await commands.scheduleCommand(irrigadorId, command, delayMinutes, params);
```

---

**Data:** 16 de fevereiro de 2026
**Status:** ✅ Pronto para uso

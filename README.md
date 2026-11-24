# tuya-lock-dashboard

Dashboard web e API REST para monitoramento e acionamento remoto da fechadura inteligente do laboratório (**Fechadura-lab**), com suporte imediato a **modo Mock (`USE_MOCK=true`)** e estrutura pronta para integração real com a **Tuya Cloud OpenAPI (`USE_MOCK=false`)**.

## Arquitetura do Projeto

```text
.
├── backend/
│   ├── .env.example
│   ├── .env                      # Configuração local (USE_MOCK=true)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── config.ts             # Carregamento de variáveis e utilitários de fuso horário
│       ├── server.ts             # Servidor Express + CORS + tratamento de erros
│       ├── types/
│       │   └── lock.ts           # Contratos TypeScript (status, logs, comandos)
│       ├── routes/
│       │   └── lockRoutes.ts     # Rotas /api/health e /api/lock/*
│       └── services/
│           ├── mockLockService.ts # Simulador em memória com estado e histórico
│           └── tuyaLockService.ts # Cliente Tuya Cloud OpenAPI v2.0 (HMAC-SHA256)
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts            # Proxy /api -> http://localhost:3001
│   └── src/
│       ├── App.tsx               # Dashboard principal (status, bateria, relógio, logs)
│       ├── api/lockApi.ts        # Cliente HTTP para o backend
│       ├── components/
│       │   ├── StatusCard.tsx    # Cartão de estado e botões Trancar/Destrancar
│       │   └── AccessLogsTable.tsx # Tabela filtrável do histórico de acessos
│       └── types/lock.ts
└── README.md
```

---

## O que já foi configurado na Tuya Cloud

- **Projeto**: `Fechadura-lab`
- **Project Code**: `p1795538342884cfemuy`
- **Data de criação**: `2026-11-24 13:39:02`
- **Data Center / Endpoint**: Western America (`https://openapi.tuyaus.com`)
- **APIs autorizadas no projeto**:
  - `IoT Core`
  - `Free Basic Resource Pack`
  - `Authorization Token Management`
  - `Smart Lock Open Service`
  - `Smart Home Basic Service`
  - `Device Status Notification`
- **Dispositivo cadastrado**:
  - **Virtual ID**: `eb1024d8e9fbf9d540tpty`
  - **MAC**: `4c:a9:19:70:3c:d2`
  - **Fuso horário**: `America/Fortaleza`
  - **Rede do laboratório**: `200.137.163.*`
- **Pendência atual**: concluir o vínculo da conta do aplicativo móvel (Tuya Smart / Smart Life) ao projeto na Tuya IoT Platform (`Devices` → `Link Tuya App Account`).

---

## Como executar localmente (Modo Mock ativo)

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

O servidor iniciará por padrão em `http://localhost:3001` com `USE_MOCK=true`.

#### Rotas disponíveis

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Saúde da API, modo ativo (`mock` ou `tuya`) e metadados Tuya |
| `GET` | `/api/lock/status` | Estado atual da fechadura, bateria, sinal e horário local |
| `GET` | `/api/lock/logs` | Histórico de acessos (`?limit=25`) |
| `POST` | `/api/lock/unlock` | Envia comando para destrancar a fechadura |
| `POST` | `/api/lock/lock` | Envia comando para trancar a fechadura |

### 2. Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`. O Vite redireciona automaticamente `/api/*` para `http://localhost:3001`.

---

## Como alternar de `USE_MOCK=true` para `USE_MOCK=false` (Tuya Cloud real)

1. **Conclua o vínculo do app na Tuya IoT Platform**:
   - No projeto `Fechadura-lab`, acesse **Devices → Link Tuya App Account** e vincule a conta do app onde a fechadura (`eb1024d8e9fbf9d540tpty`) está pareada.
2. **Verifique o arquivo `backend/.env`** (baseado em `backend/.env.example`):
   ```env
   USE_MOCK=false
   TUYA_ENDPOINT=https://openapi.tuyaus.com
   TUYA_ACCESS_ID=seu_access_id
   TUYA_ACCESS_SECRET=seu_access_secret
   TUYA_DEVICE_ID=eb1024d8e9fbf9d540tpty
   TUYA_DEVICE_MAC=4c:a9:19:70:3c:d2
   APP_TIMEZONE=America/Fortaleza
   ```
3. **Reinicie o backend**:
   - O `TuyaLockService` (`backend/src/services/tuyaLockService.ts`) passará a autenticar via `GET /v1.0/token?grant_type=1` com assinatura **HMAC-SHA256**, consultar o status real em `/v1.0/iot-03/devices/{device_id}/status`, buscar os logs via Smart Lock Open Service / IoT Core e disparar destrancamento remoto via `password-ticket` + `password-free/open-door`.
4. **Validação de DPs do modelo**:
   - Caso o modelo específico da fechadura utilize códigos de Data Point (DP) diferentes para travamento remoto, ajuste `parseStatusDps` e `lock` em `backend/src/services/tuyaLockService.ts` após consultar `GET /v1.0/iot-03/devices/eb1024d8e9fbf9d540tpty/functions`.

---

## Scripts de verificação e build

```bash
# Backend
cd backend && npm run typecheck && npm run build

# Frontend
cd frontend && npm run typecheck && npm run build
```

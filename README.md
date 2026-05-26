# SocialEye Monitor

Social Monitoring + QC Admin + Crisis Management platform for Thai market.

## Stack
- **Frontend**: Next.js 15 · Tailwind CSS · Recharts
- **Backend**: Python FastAPI · SQLAlchemy async
- **DB**: PostgreSQL (Neon)
- **AI**: OpenAI GPT-4o-mini (rule-based fallback)

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn backend.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # runs on :3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/mentions | List mentions |
| POST | /api/mentions | Create & AI-analyze mention |
| GET | /api/mentions/stats | KPI stats |
| GET | /api/mentions/trend | Day-by-day sentiment trend |
| GET | /api/qc/scoreboard | Admin QC ranking |
| POST | /api/qc/chats | Log admin chat |
| POST | /api/webhook/line | LINE OA webhook |
| POST | /api/webhook/facebook | Facebook webhook |

## Seed Example Data
```bash
curl -X POST http://localhost:8000/api/mentions \
  -H "Content-Type: application/json" \
  -d '{"channel":"facebook","author":"TestUser","content":"บริการแย่มาก รอนาน 2 วันยังไม่ได้รับของ","likes":120,"comments":45}'
```

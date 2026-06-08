# Frontend

React + TypeScript (Vite): upload UI with progress, a polling status library, and
(coming in P3) an hls.js adaptive player. Deploys to S3 + CloudFront.

## Run locally
```bash
cd frontend
npm install
cp .env.example .env   # point VITE_API_URL at the running API
npm run dev            # http://localhost:5173
```

Requires the API running (see ../api) and AWS resources provisioned (see ../infra).

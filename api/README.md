# API

FastAPI service: issues presigned S3 upload URLs and serves video/job status.
Runs locally with uvicorn, deploys to Lambda behind API Gateway via Mangum.

## Local
```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Endpoints
- `GET  /health`
- `POST /uploads` → presigned URL (P1)
- `GET  /videos/{id}` → metadata + status (P1)

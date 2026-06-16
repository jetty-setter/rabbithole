# FastAPI on AWS Lambda (container image), fronted by API Gateway via Mangum.
FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Bake the embedding model into the image so there's no cold-start download
# (Lambda's filesystem is read-only except /tmp). Must match config.EMBED_MODEL.
ENV EMBED_CACHE_DIR=/opt/models
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5', cache_dir='/opt/models')"

COPY app ${LAMBDA_TASK_ROOT}/app

# Mangum handler defined in app/main.py
CMD ["app.main.handler"]

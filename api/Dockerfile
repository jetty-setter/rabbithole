# FastAPI on AWS Lambda (container image), fronted by API Gateway via Mangum.
FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY app ${LAMBDA_TASK_ROOT}/app

# Mangum handler defined in app/main.py
CMD ["app.main.handler"]

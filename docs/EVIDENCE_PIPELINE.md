# Evidence pipeline

Publishing a RabbitHole creates a versioned evidence run. A DynamoDB Stream invokes
`lambdas/evidence/evidence_handler.dispatch`, which fans one job per source into SQS.
The worker validates public HTTPS destinations, extracts bounded HTML/text passages, writes
a content-addressed JSON snapshot to private S3 storage, and records status in the evidence table. Jobs are
idempotent by `run_id + source_id`; retries are reported individually so one broken source
does not block the article.

The reader endpoint `GET /rabbitholes/{slug}/evidence?q=...` exposes processing state and
keyword matches. The article reader, including the Wow! Signal page, renders this as **Search the evidence** when it has
sources. Sources without supported URLs are reported as unsupported. A future semantic index can consume the same S3 snapshots without
changing the publishing contract.

The first worker deliberately accepts HTML and plain text only. It rejects private or
non-HTTPS destinations, caps downloads at 1 MB and extracted text at 24,000 characters,
and follows at most three validated redirects. Video sources remain a natural extension:
the existing transcode/transcription pipeline can produce timestamped passages under the
same `run_id` and source ID.

## Deployment and operation

This implementation has not been deployed. Terraform in `infra/evidence.tf` provisions the
two Lambda functions, SQS queue, dead-letter queue, restricted IAM roles, private S3 bucket,
event source mappings, logs, and a dead-letter alarm. The API image and frontend also need
deployment. Run the existing CI checks and review a Terraform plan before applying.

New publications and edits to published articles trigger processing through the article
table's stream. Existing publications need an explicit backfill: an authenticated admin
calls `POST /admin/rabbitholes/{id}/evidence:rebuild`. This changes a processing generation
on the article, creating a new run through the same stream without changing the prose.
The same endpoint retries a failed run. The API queries only the current revision and
generation and rechecks publication visibility using a strongly consistent read.

SQS retries failed deliveries up to three receives, then retains them in the dead-letter
queue for 14 days. The dispatcher also sends exhausted stream failures to that queue;
these contain stream failure metadata rather than source-job bodies. Investigate the
Lambda logs and rebuild the affected article; do not blindly redrive mixed message types.
The CloudWatch alarm is visible in AWS but has no notification subscription configured.
Jobs with no progress for 30 minutes are shown as delayed. Worker concurrency is capped at
four, log retention is 14 days, and S3 snapshots expire after 90 days. DynamoDB passage
indexes persist; there is no automatic cleanup of historical index runs in this version.

The reader polls while processing for up to two minutes; refresh to check later progress.
Keyword search requires all query words in a passage, with up to 50 results per response.
This version does not process PDFs, execute JavaScript pages, verify claims, suggest
connections, monitor source changes, or connect video transcription. These are extensions
of the source-worker contract rather than implied current capabilities.

## Local verification

`pytest -q api/tests/test_evidence_pipeline.py api/tests/test_rabbitholes.py` exercises
the pipeline against moto AWS emulation, including retries, deduplication, authorization,
run isolation, correct citation numbering, and extraction limits. Source HTTP downloads
are mocked in the pipeline integration tests. `npm test` and `npm run build` run in
`frontend/`; `terraform init -backend=false` and `terraform validate` run in `infra/`.
Local checks cannot establish that production IAM, service quotas or actual source hosts
will behave correctly; deploy and exercise one article before declaring the feature live.

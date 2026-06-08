# Worker

ffmpeg transcode worker. Pulls jobs from SQS, produces HLS renditions + thumbnail,
uploads to the streaming bucket. Runs on ECS Fargate, autoscaled on queue depth (P4).

## Build
```bash
cd worker
docker build -t rabbithole-worker .
```

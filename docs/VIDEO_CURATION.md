# Curiosity-led video platform

RabbitHole is a collection of strange science, obscure history, unusual footage,
and other worthwhile discoveries. The existing basement/CRT hero remains; the
homepage displays actual public videos, original creator attribution, and topics.

An editor adds a YouTube link with a title, a brief reason to watch, and connecting
tags. Use the admin-only **Add a YouTube find** action on Discover, or **Add external
video** in the account menu. The video remains hosted by its original creator;
RabbitHole embeds the official player. Other source URLs become outbound links.
Uploads still use the existing S3/EventBridge/SQS/Fargate streaming pipeline.

Search matches titles, descriptions, creator names, and tags without requiring a
transcript. Watch-page recommendations prioritize shared tags and explain the
connection; unrelated suggestions are labeled accordingly. Tumble, saved videos,
and local watch history remain available. Upload metadata suggestions now require
an explicit click, and transcript Q&A is collapsed behind an optional AI label.
The server's existing AI endpoints and transcription infrastructure remain intact.

The starter manifest is `scripts/curiosity-starter.json`. `scripts/seed-curiosity.py`
checks official YouTube oEmbed metadata and creator attribution. It defaults to a
dry run; `--apply` adds public metadata records to the selected AWS table, preserving
existing records. It does not download or rehost media. Embedding availability can
change, so retain the original source link and review the collection periodically.

The older article routes and evidence-processing infrastructure remain in place;
this change does not delete editorial content or cloud resources.

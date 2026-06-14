#!/usr/bin/env python3
"""Rotate a RabbitHole user's password (e.g. the admin account).

The new password is read from the NEW_PASSWORD env var or prompted interactively,
so it never lands in shell history, source, or a chat transcript. It updates the
bcrypt hash in the users DynamoDB table directly — the same scheme the API uses.

Usage (needs AWS credentials + bcrypt/boto3, both already in api/.venv):
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/set-admin-password.py
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/set-admin-password.py --user admin
"""

import argparse
import getpass
import os
import sys

import bcrypt
import boto3
from botocore.exceptions import ClientError


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--user", default="admin", help="username to rotate (default: admin)")
    ap.add_argument("--table", default="rabbithole-dev-users")
    ap.add_argument("--region", default="us-east-1")
    args = ap.parse_args()

    env_pw = os.environ.get("NEW_PASSWORD")
    pw = env_pw or getpass.getpass(f"New password for '{args.user}': ")
    if len(pw) < 8:
        sys.exit("Password must be at least 8 characters.")
    if not env_pw and pw != getpass.getpass("Confirm: "):
        sys.exit("Passwords don't match.")

    pw_hash = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    table = boto3.resource("dynamodb", region_name=args.region).Table(args.table)
    try:
        table.update_item(
            Key={"username": args.user},
            UpdateExpression="SET password_hash = :h",
            ConditionExpression="attribute_exists(username)",
            ExpressionAttributeValues={":h": pw_hash},
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            sys.exit(f"No such user '{args.user}' in {args.table}.")
        raise
    print(f"✓ Password rotated for '{args.user}'. Existing sessions stay valid until the JWT expires.")


if __name__ == "__main__":
    main()

import json
import boto3
import botocore
from datetime import datetime
import base64
import os

def parse_event(event):
    try:
        event_body = json.loads(event['body'])
        return event_body['message']
    except json.JSONDecodeError as e:
        raise ValueError(f'Invalid JSON format: {e}')

def invoke_bedrock_model(message):
    bedrock = boto3.client("bedrock-runtime", region_name="us-west-2", config=botocore.config.Config(read_timeout=300, retries={'max_attempts': 3}))
    payload = {
        "text_prompts": [{"text": message}],
        "cfg_scale": 10,
        "seed": 0,
        "steps": 100
    }
    response = bedrock.invoke_model(body=json.dumps(payload), modelId='stability.stable-diffusion-xl-v0', contentType="application/json", accept="application/json")
    return json.loads(response.get("body").read())

def upload_to_s3(image_content, aws_request_id):
    s3 = boto3.client('s3')
    s3_bucket = os.environ['S3_BUCKET_NAME']
    s3_key = f"output-images/{aws_request_id}.png"
    s3.put_object(Bucket=s3_bucket, Key=s3_key, Body=image_content, ContentType='image/png')

def lambda_handler(event, context):
    try:
        message = parse_event(event)
        response_body = invoke_bedrock_model(message)
        base_64_img_str = response_body["artifacts"][0].get("base64")
        image_content = base64.decodebytes(bytes(base_64_img_str, "utf-8"))
        upload_to_s3(image_content, context.aws_request_id)
        return {
            'statusCode': 200,
            'body': json.dumps('Image Saved to S3')
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }


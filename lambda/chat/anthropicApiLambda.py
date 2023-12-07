import boto3
import botocore.config
import json
from datetime import datetime
import os

def generate_code_using_bedrock(message: str, language: str) -> str:
    prompt_text = f'\n\nHuman: Write {language} code for the following instructions: {message}\n\nAssistant:'
    api_request = {
        "modelId": "anthropic.claude-v2:1",
        "contentType": "application/json",
        "accept": "*/*",
        "body": {
            "prompt": prompt_text,
            "max_tokens_to_sample": 300,
            "temperature": 0.5,
            "top_k": 250,
            "top_p": 1,
            "stop_sequences": ["\n\nHuman:"],
            "anthropic_version": "bedrock-2023-05-31"
        }
    }

    try:
        bedrock = boto3.client("bedrock-runtime", region_name="us-west-2", config=botocore.config.Config(read_timeout=300, retries={'max_attempts': 3}))
        response = bedrock.invoke_model(
            modelId=api_request["modelId"],
            contentType=api_request["contentType"],
            accept=api_request["accept"],
            body=json.dumps(api_request["body"])
        )

        response_content = response.get('body').read().decode('utf-8')
        response_data = json.loads(response_content)
        code = response_data["completion"].strip()
        return code

    except Exception as e:
        print(f"Error generating the code: {e}")
        raise

def save_code_to_s3_bucket(code, s3_bucket, s3_key):
    s3 = boto3.client('s3')

    try:
        s3.put_object(Bucket=s3_bucket, Key=s3_key, Body=code)
        print("Code saved to S3")

    except Exception as e:
        print(f"Error when saving the code to S3: {e}")
        raise

def lambda_handler(event, context):
    event = json.loads(event['body'])
    message = event['message']
    language = event['key']
    print(message, language)

    s3_bucket = os.environ['S3_BUCKET_NAME']

    try:
        generated_code = generate_code_using_bedrock(message, language)

        if generated_code:
            current_time = datetime.now().strftime('%H%M%S')
            s3_key = f'code-output/{current_time}.py'
            save_code_to_s3_bucket(generated_code, s3_bucket, s3_key)

        else:
            print("No code was generated")

        return {
            'statusCode': 200,
            'body': json.dumps(generated_code)
        }

    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps('Error generating code')
        }

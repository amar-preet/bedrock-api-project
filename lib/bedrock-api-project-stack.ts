import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';

export class BedrockApiProjectStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const s3Bucket = new s3.Bucket(this, 'BedrockApiOutputBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Only for testing purposes
    });

    // Lambda Layer
    const boto3Layer = new lambda.LayerVersion(this, 'Boto3Layer', {
      code: lambda.Code.fromAsset('./boto3_layer/boto3_layer.zip'), 
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9], 
      description: 'Custom Lambda Layer with boto3',
    });

    // Create the Lambda function for Chat API
    const chatApiLambda = new lambda.Function(this, 'ChatApiLambda', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'anthropicApiLambda.lambda_handler',
      code: lambda.Code.fromAsset('./lambda/chat'), 
      environment: {
        S3_BUCKET_NAME: s3Bucket.bucketName,
      },
      layers: [boto3Layer],
      timeout: cdk.Duration.seconds(600),
    });

    // Create the Lambda function for Image API
    const imageApiLambda = new lambda.Function(this, 'ImageApiLambda', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'stabilityApiLambda.lambda_handler', 
      code: lambda.Code.fromAsset('./lambda/image'), 
      environment: {
        S3_BUCKET_NAME: s3Bucket.bucketName,
      },
      layers: [boto3Layer],
      timeout: cdk.Duration.seconds(600),
    });

    s3Bucket.grantReadWrite(chatApiLambda);
    s3Bucket.grantReadWrite(imageApiLambda);

    const api = new apigateway.RestApi(this, 'BedrockApiGateway');
    const chatIntegration = new apigateway.LambdaIntegration(chatApiLambda, {
      proxy: true,
    });

    const imageIntegration = new apigateway.LambdaIntegration(imageApiLambda, {
      proxy: true,
    });

    chatApiLambda.addPermission('ApiGatewayInvokePermission', {
      action: 'lambda:InvokeFunction',
      principal: new iam.AnyPrincipal(),
    });

    imageApiLambda.addPermission('ApiGatewayInvokePermission', {
      action: 'lambda:InvokeFunction',
      principal: new iam.AnyPrincipal(),
    });


    chatApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-v2:1'],
    }));

    imageApiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:us-west-2::foundation-model/stability.stable-diffusion-xl-v0:1'],
    }));

    const chatApiResource = api.root.addResource('chat');
    chatApiResource.addMethod('POST', chatIntegration);

    const imageApiResource = api.root.addResource('image');
    imageApiResource.addMethod('POST', imageIntegration);
  }
}

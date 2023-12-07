#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { BedrockApiProjectStack } from '../lib/bedrock-api-project-stack';

const app = new cdk.App();
new BedrockApiProjectStack(app, 'BedrockApiProjectStack');
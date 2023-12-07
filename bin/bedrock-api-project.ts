#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { BedrockApiProjectStack } from '../lib/bedrock-api-project-stack';

const app = new cdk.App();
new BedrockApiProjectStack(app, 'BedrockApiProjectStack');
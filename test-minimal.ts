#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();

// Check for help
const help = app.node.tryGetContext('help');
if (help === 'true' || help === true) {
  console.log('Help requested');
  new cdk.CfnOutput(app, 'Help', { value: 'Help displayed' });
} else {
  console.log('No help requested');
  new cdk.CfnOutput(app, 'Test', { value: 'Test output' });
}

app.synth(); 
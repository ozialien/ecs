#!/usr/bin/env node

/**
 * Matson ECS CLI Wrapper
 * 
 * Simple drop-in replacement for CDK commands.
 * 
 * Usage:
 *   matson-ecs deploy --context vpcId=vpc-12345678 --context image=nginx:alpine
 *   matson-ecs synth
 *   matson-ecs diff
 *   matson-ecs destroy
 */

import { spawn } from 'child_process';

// Get all arguments after the script name
const args = process.argv.slice(2);

// If no arguments provided, show help
if (args.length === 0) {
  console.error('❌ Error: No command specified.');
  console.error('');
  console.error('Usage:');
  console.error('  matson-ecs <cdk-command> [options]');
  console.error('');
  console.error('Examples:');
  console.error('  matson-ecs deploy --context vpcId=vpc-12345678 --context image=nginx:alpine');
  console.error('  matson-ecs synth');
  console.error('  matson-ecs diff');
  console.error('  matson-ecs destroy');
  console.error('');
  console.error('For more information, run: matson-ecs --help');
  process.exit(1);
}

// Add the CDK app entry point to all commands
const cdkArgs = ['-a', 'lib/bin/cdk.js', ...args];

// Spawn CDK process
const cdkProcess = spawn('cdk', cdkArgs, {
  stdio: 'inherit',
  shell: true
});

cdkProcess.on('close', (code) => {
  process.exit(code || 0);
});

cdkProcess.on('error', (error) => {
  console.error('❌ Error running CDK:', error.message);
  process.exit(1);
}); 
#!/usr/bin/env node
/**
 * Matson ECS CLI Wrapper
 *
 * Simple drop-in replacement for CDK commands with enhanced credential support.
 *
 * Usage:
 *   matson-ecs deploy --context vpcId=vpc-12345678 --context image=nginx:alpine
 *   matson-ecs deploy --profile prod --context vpcId=vpc-12345678
 *   matson-ecs deploy --role-arn arn:aws:iam::123456789012:role/DeployRole
 *   matson-ecs synth
 *   matson-ecs diff
 *   matson-ecs destroy
 */
export {};

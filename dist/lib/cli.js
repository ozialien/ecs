#!/usr/bin/env node
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
// Get all arguments after the script name
const args = process.argv.slice(2);
// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
}
// If no arguments provided, show help
if (args.length === 0) {
    console.error('❌ Error: No command specified.');
    console.error('');
    console.error('Usage:');
    console.error('  matson-ecs <cdk-command> [options]');
    console.error('');
    console.error('Examples:');
    console.error('  matson-ecs deploy --context vpcId=vpc-12345678 --context image=nginx:alpine');
    console.error('  matson-ecs deploy --profile prod --context vpcId=vpc-12345678');
    console.error('  matson-ecs deploy --role-arn arn:aws:iam::123456789012:role/DeployRole');
    console.error('  matson-ecs synth');
    console.error('  matson-ecs diff');
    console.error('  matson-ecs destroy');
    console.error('');
    console.error('Credential Options:');
    console.error('  --profile <name>     Use AWS profile for credentials');
    console.error('  --role-arn <arn>     Use IAM role for deployment');
    console.error('  --context awsProfile=<name>  Set AWS profile via context');
    console.error('  --context awsRoleArn=<arn>  Set IAM role via context');
    console.error('  --context awsAccessKeyId=<key> Set AWS access key via context');
    console.error('  --context awsSecretAccessKey=<secret> Set AWS secret key via context');
    console.error('  --context awsSessionToken=<token> Set AWS session token via context');
    console.error('');
    console.error('For more information, run: matson-ecs --help');
    process.exit(1);
}
// Add the CDK app entry point to all commands
const cdkArgs = ['-a', 'dist/bin/cdk.js', ...args];
// Spawn CDK process
const cdkProcess = (0, child_process_1.spawn)('cdk', cdkArgs, {
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
/**
 * Show comprehensive help information
 */
function showHelp() {
    console.log(`
🎯 Matson ECS - Helm-style ECS Deployment Utility

USAGE:
  matson-ecs <cdk-command> [options]

COMMANDS:
  deploy     Deploy ECS service stack
  synth      Synthesize CloudFormation template
  diff       Show differences between deployed and local stack
  destroy    Destroy ECS service stack
  list       List all stacks
  bootstrap  Bootstrap CDK toolkit

CREDENTIAL OPTIONS:
  --profile <name>              Use AWS profile for credentials
  --role-arn <arn>              Use IAM role for deployment
  --context awsProfile=<name>   Set AWS profile via context
  --context awsRoleArn=<arn>    Set IAM role via context
  --context awsAccessKeyId=<key> Set AWS access key via context
  --context awsSecretAccessKey=<secret> Set AWS secret key via context
  --context awsSessionToken=<token> Set AWS session token via context

EXAMPLES:

Basic Deployment:
  matson-ecs deploy \\
    --context vpcId=vpc-12345678 \\
    --context subnetIds=subnet-12345678,subnet-87654321 \\
    --context clusterName=my-cluster \\
    --context image=nginx:alpine \\
    --context containerPort=80 \\
    --context lbPort=80

With AWS Profile:
  matson-ecs deploy \\
    --profile prod \\
    --context vpcId=vpc-12345678 \\
    --context image=nginx:alpine \\
    --context containerPort=80 \\
    --context lbPort=80

With IAM Role:
  matson-ecs deploy \\
    --role-arn arn:aws:iam::123456789012:role/DeployRole \\
    --context vpcId=vpc-12345678 \\
    --context image=nginx:alpine \\
    --context containerPort=80 \\
    --context lbPort=80

With Values File:
  matson-ecs deploy \\
    --profile dev \\
    --context valuesFile=values-dev.yaml

With Explicit Credentials:
  matson-ecs deploy \\
    --context awsAccessKeyId=AKIAIOSFODNN7EXAMPLE \\
    --context awsSecretAccessKey=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \\
    --context vpcId=vpc-12345678 \\
    --context image=nginx:alpine \\
    --context containerPort=80 \\
    --context lbPort=80

Advanced Configuration:
  matson-ecs deploy \\
    --profile prod \\
    --context vpcId=vpc-12345678 \\
    --context image=123456789012.dkr.ecr.us-west-2.amazonaws.com/myapp:latest \\
    --context serviceName=myapp-api \\
    --context desiredCount=3 \\
    --context cpu=512 \\
    --context memory=1024 \\
    --context containerPort=8080 \\
    --context lbPort=80 \\
    --context enableAutoScaling=true \\
    --context minCapacity=2 \\
    --context maxCapacity=10

Other Commands:
  matson-ecs synth                    # Generate CloudFormation template
  matson-ecs diff                     # Show differences
  matson-ecs destroy                  # Destroy stack
  matson-ecs list                     # List all stacks

CREDENTIAL METHODS:

1. AWS Profile (Recommended):
   - Set AWS_PROFILE environment variable
   - Use --profile option
   - Use --context awsProfile=<name>

2. IAM Role:
   - Use --role-arn option
   - Use --context awsRoleArn=<arn>

3. Explicit Credentials:
   - Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY environment variables
   - Use AWS credentials file (~/.aws/credentials)
   - Use --context awsAccessKeyId=, --context awsSecretAccessKey=, --context awsSessionToken=

4. EC2 Instance Metadata:
   - Use --ec2creds option when running on EC2

VALUES FILE SUPPORT:
  matson-ecs deploy --context valuesFile=values.yaml

  Values file can be JSON, YAML, or JS format:
  - values.json (legacy flat format)
  - values.yaml (new structured ECS hierarchy format)
  - values.js

  The CDK supports both legacy flat format and new structured ECS hierarchy format.
  Structured format follows ECS object hierarchy: metadata, infrastructure, cluster, 
  taskDefinition, service, loadBalancer, autoScaling, iam, serviceDiscovery, addons.

CONTEXT PARAMETERS:
  All configuration is done via --context parameters:

LEGACY FLAT PARAMETERS (Backward Compatible):
  --context vpcId=<vpc-id>
  --context subnetIds=<subnet-ids>
  --context clusterName=<cluster-name>
  --context image=<image-uri>
  --context availabilityZones=<az1,az2,az3>
  --context containerPort=<port>
  --context lbPort=<port>
  --context serviceName=<service-name>
  --context desiredCount=<count>
  --context cpu=<cpu-units>
  --context memory=<memory-mib>
  --context enableAutoScaling=<true|false>
  --context minCapacity=<min>
  --context maxCapacity=<max>
  --context targetCpuUtilization=<percent>
  --context targetMemoryUtilization=<percent>
  --context healthCheckPath=<path>
  --context allowedCidr=<cidr>
  --context logRetentionDays=<days>
  --context taskExecutionRoleArn=<arn>
  --context taskRoleArn=<arn>

NEW STRUCTURED PARAMETERS (ECS Hierarchy):
  --context metadata=<json-object>
  --context infrastructure=<json-object>
  --context cluster=<json-object>
  --context taskDefinition=<json-object>
  --context service=<json-object>
  --context loadBalancer=<json-object>
  --context autoScaling=<json-object>
  --context iam=<json-object>
  --context serviceDiscovery=<json-object>
  --context addons=<json-object>

Note: Structured parameters are typically used in values files rather than individual -c options.

For detailed parameter documentation, run:
  matson-ecs deploy --context help=true
`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBOzs7Ozs7Ozs7Ozs7R0FZRzs7QUFFSCxpREFBc0M7QUFFdEMsMENBQTBDO0FBQzFDLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRW5DLHlCQUF5QjtBQUN6QixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUNsRCxRQUFRLEVBQUUsQ0FBQztJQUNYLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDakI7QUFFRCxzQ0FBc0M7QUFDdEMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtJQUNyQixPQUFPLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7SUFDaEQsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3hCLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQztJQUN0RCxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDM0IsT0FBTyxDQUFDLEtBQUssQ0FBQywrRUFBK0UsQ0FBQyxDQUFDO0lBQy9GLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQztJQUNqRixPQUFPLENBQUMsS0FBSyxDQUFDLDBFQUEwRSxDQUFDLENBQUM7SUFDMUYsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQ3BDLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUNuQyxPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7SUFDdEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDckMsT0FBTyxDQUFDLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO0lBQ3hFLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztJQUNwRSxPQUFPLENBQUMsS0FBSyxDQUFDLDREQUE0RCxDQUFDLENBQUM7SUFDNUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO0lBQ3hFLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUVBQWlFLENBQUMsQ0FBQztJQUNqRixPQUFPLENBQUMsS0FBSyxDQUFDLHdFQUF3RSxDQUFDLENBQUM7SUFDeEYsT0FBTyxDQUFDLEtBQUssQ0FBQyx1RUFBdUUsQ0FBQyxDQUFDO0lBQ3ZGLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO0lBQzlELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDakI7QUFFRCw4Q0FBOEM7QUFDOUMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUVuRCxvQkFBb0I7QUFDcEIsTUFBTSxVQUFVLEdBQUcsSUFBQSxxQkFBSyxFQUFDLEtBQUssRUFBRSxPQUFPLEVBQUU7SUFDdkMsS0FBSyxFQUFFLFNBQVM7SUFDaEIsS0FBSyxFQUFFLElBQUk7Q0FDWixDQUFDLENBQUM7QUFFSCxVQUFVLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO0lBQzlCLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzFCLENBQUMsQ0FBQyxDQUFDO0FBRUgsVUFBVSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUMvQixPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUMsQ0FBQyxDQUFDO0FBRUg7O0dBRUc7QUFDSCxTQUFTLFFBQVE7SUFDZixPQUFPLENBQUMsR0FBRyxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQThKYixDQUFDLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuXG4vKipcbiAqIE1hdHNvbiBFQ1MgQ0xJIFdyYXBwZXJcbiAqIFxuICogU2ltcGxlIGRyb3AtaW4gcmVwbGFjZW1lbnQgZm9yIENESyBjb21tYW5kcyB3aXRoIGVuaGFuY2VkIGNyZWRlbnRpYWwgc3VwcG9ydC5cbiAqIFxuICogVXNhZ2U6XG4gKiAgIG1hdHNvbi1lY3MgZGVwbG95IC0tY29udGV4dCB2cGNJZD12cGMtMTIzNDU2NzggLS1jb250ZXh0IGltYWdlPW5naW54OmFscGluZVxuICogICBtYXRzb24tZWNzIGRlcGxveSAtLXByb2ZpbGUgcHJvZCAtLWNvbnRleHQgdnBjSWQ9dnBjLTEyMzQ1Njc4XG4gKiAgIG1hdHNvbi1lY3MgZGVwbG95IC0tcm9sZS1hcm4gYXJuOmF3czppYW06OjEyMzQ1Njc4OTAxMjpyb2xlL0RlcGxveVJvbGVcbiAqICAgbWF0c29uLWVjcyBzeW50aFxuICogICBtYXRzb24tZWNzIGRpZmZcbiAqICAgbWF0c29uLWVjcyBkZXN0cm95XG4gKi9cblxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcblxuLy8gR2V0IGFsbCBhcmd1bWVudHMgYWZ0ZXIgdGhlIHNjcmlwdCBuYW1lXG5jb25zdCBhcmdzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpO1xuXG4vLyBTaG93IGhlbHAgaWYgcmVxdWVzdGVkXG5pZiAoYXJncy5pbmNsdWRlcygnLS1oZWxwJykgfHwgYXJncy5pbmNsdWRlcygnLWgnKSkge1xuICBzaG93SGVscCgpO1xuICBwcm9jZXNzLmV4aXQoMCk7XG59XG5cbi8vIElmIG5vIGFyZ3VtZW50cyBwcm92aWRlZCwgc2hvdyBoZWxwXG5pZiAoYXJncy5sZW5ndGggPT09IDApIHtcbiAgY29uc29sZS5lcnJvcign4p2MIEVycm9yOiBObyBjb21tYW5kIHNwZWNpZmllZC4nKTtcbiAgY29uc29sZS5lcnJvcignJyk7XG4gIGNvbnNvbGUuZXJyb3IoJ1VzYWdlOicpO1xuICBjb25zb2xlLmVycm9yKCcgIG1hdHNvbi1lY3MgPGNkay1jb21tYW5kPiBbb3B0aW9uc10nKTtcbiAgY29uc29sZS5lcnJvcignJyk7XG4gIGNvbnNvbGUuZXJyb3IoJ0V4YW1wbGVzOicpO1xuICBjb25zb2xlLmVycm9yKCcgIG1hdHNvbi1lY3MgZGVwbG95IC0tY29udGV4dCB2cGNJZD12cGMtMTIzNDU2NzggLS1jb250ZXh0IGltYWdlPW5naW54OmFscGluZScpO1xuICBjb25zb2xlLmVycm9yKCcgIG1hdHNvbi1lY3MgZGVwbG95IC0tcHJvZmlsZSBwcm9kIC0tY29udGV4dCB2cGNJZD12cGMtMTIzNDU2NzgnKTtcbiAgY29uc29sZS5lcnJvcignICBtYXRzb24tZWNzIGRlcGxveSAtLXJvbGUtYXJuIGFybjphd3M6aWFtOjoxMjM0NTY3ODkwMTI6cm9sZS9EZXBsb3lSb2xlJyk7XG4gIGNvbnNvbGUuZXJyb3IoJyAgbWF0c29uLWVjcyBzeW50aCcpO1xuICBjb25zb2xlLmVycm9yKCcgIG1hdHNvbi1lY3MgZGlmZicpO1xuICBjb25zb2xlLmVycm9yKCcgIG1hdHNvbi1lY3MgZGVzdHJveScpO1xuICBjb25zb2xlLmVycm9yKCcnKTtcbiAgY29uc29sZS5lcnJvcignQ3JlZGVudGlhbCBPcHRpb25zOicpO1xuICBjb25zb2xlLmVycm9yKCcgIC0tcHJvZmlsZSA8bmFtZT4gICAgIFVzZSBBV1MgcHJvZmlsZSBmb3IgY3JlZGVudGlhbHMnKTtcbiAgY29uc29sZS5lcnJvcignICAtLXJvbGUtYXJuIDxhcm4+ICAgICBVc2UgSUFNIHJvbGUgZm9yIGRlcGxveW1lbnQnKTtcbiAgY29uc29sZS5lcnJvcignICAtLWNvbnRleHQgYXdzUHJvZmlsZT08bmFtZT4gIFNldCBBV1MgcHJvZmlsZSB2aWEgY29udGV4dCcpO1xuICBjb25zb2xlLmVycm9yKCcgIC0tY29udGV4dCBhd3NSb2xlQXJuPTxhcm4+ICBTZXQgSUFNIHJvbGUgdmlhIGNvbnRleHQnKTtcbiAgY29uc29sZS5lcnJvcignICAtLWNvbnRleHQgYXdzQWNjZXNzS2V5SWQ9PGtleT4gU2V0IEFXUyBhY2Nlc3Mga2V5IHZpYSBjb250ZXh0Jyk7XG4gIGNvbnNvbGUuZXJyb3IoJyAgLS1jb250ZXh0IGF3c1NlY3JldEFjY2Vzc0tleT08c2VjcmV0PiBTZXQgQVdTIHNlY3JldCBrZXkgdmlhIGNvbnRleHQnKTtcbiAgY29uc29sZS5lcnJvcignICAtLWNvbnRleHQgYXdzU2Vzc2lvblRva2VuPTx0b2tlbj4gU2V0IEFXUyBzZXNzaW9uIHRva2VuIHZpYSBjb250ZXh0Jyk7XG4gIGNvbnNvbGUuZXJyb3IoJycpO1xuICBjb25zb2xlLmVycm9yKCdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgcnVuOiBtYXRzb24tZWNzIC0taGVscCcpO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59XG5cbi8vIEFkZCB0aGUgQ0RLIGFwcCBlbnRyeSBwb2ludCB0byBhbGwgY29tbWFuZHNcbmNvbnN0IGNka0FyZ3MgPSBbJy1hJywgJ2Rpc3QvYmluL2Nkay5qcycsIC4uLmFyZ3NdO1xuXG4vLyBTcGF3biBDREsgcHJvY2Vzc1xuY29uc3QgY2RrUHJvY2VzcyA9IHNwYXduKCdjZGsnLCBjZGtBcmdzLCB7XG4gIHN0ZGlvOiAnaW5oZXJpdCcsXG4gIHNoZWxsOiB0cnVlXG59KTtcblxuY2RrUHJvY2Vzcy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xuICBwcm9jZXNzLmV4aXQoY29kZSB8fCAwKTtcbn0pO1xuXG5jZGtQcm9jZXNzLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICBjb25zb2xlLmVycm9yKCfinYwgRXJyb3IgcnVubmluZyBDREs6JywgZXJyb3IubWVzc2FnZSk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn0pO1xuXG4vKipcbiAqIFNob3cgY29tcHJlaGVuc2l2ZSBoZWxwIGluZm9ybWF0aW9uXG4gKi9cbmZ1bmN0aW9uIHNob3dIZWxwKCk6IHZvaWQge1xuICBjb25zb2xlLmxvZyhgXG7wn46vIE1hdHNvbiBFQ1MgLSBIZWxtLXN0eWxlIEVDUyBEZXBsb3ltZW50IFV0aWxpdHlcblxuVVNBR0U6XG4gIG1hdHNvbi1lY3MgPGNkay1jb21tYW5kPiBbb3B0aW9uc11cblxuQ09NTUFORFM6XG4gIGRlcGxveSAgICAgRGVwbG95IEVDUyBzZXJ2aWNlIHN0YWNrXG4gIHN5bnRoICAgICAgU3ludGhlc2l6ZSBDbG91ZEZvcm1hdGlvbiB0ZW1wbGF0ZVxuICBkaWZmICAgICAgIFNob3cgZGlmZmVyZW5jZXMgYmV0d2VlbiBkZXBsb3llZCBhbmQgbG9jYWwgc3RhY2tcbiAgZGVzdHJveSAgICBEZXN0cm95IEVDUyBzZXJ2aWNlIHN0YWNrXG4gIGxpc3QgICAgICAgTGlzdCBhbGwgc3RhY2tzXG4gIGJvb3RzdHJhcCAgQm9vdHN0cmFwIENESyB0b29sa2l0XG5cbkNSRURFTlRJQUwgT1BUSU9OUzpcbiAgLS1wcm9maWxlIDxuYW1lPiAgICAgICAgICAgICAgVXNlIEFXUyBwcm9maWxlIGZvciBjcmVkZW50aWFsc1xuICAtLXJvbGUtYXJuIDxhcm4+ICAgICAgICAgICAgICBVc2UgSUFNIHJvbGUgZm9yIGRlcGxveW1lbnRcbiAgLS1jb250ZXh0IGF3c1Byb2ZpbGU9PG5hbWU+ICAgU2V0IEFXUyBwcm9maWxlIHZpYSBjb250ZXh0XG4gIC0tY29udGV4dCBhd3NSb2xlQXJuPTxhcm4+ICAgIFNldCBJQU0gcm9sZSB2aWEgY29udGV4dFxuICAtLWNvbnRleHQgYXdzQWNjZXNzS2V5SWQ9PGtleT4gU2V0IEFXUyBhY2Nlc3Mga2V5IHZpYSBjb250ZXh0XG4gIC0tY29udGV4dCBhd3NTZWNyZXRBY2Nlc3NLZXk9PHNlY3JldD4gU2V0IEFXUyBzZWNyZXQga2V5IHZpYSBjb250ZXh0XG4gIC0tY29udGV4dCBhd3NTZXNzaW9uVG9rZW49PHRva2VuPiBTZXQgQVdTIHNlc3Npb24gdG9rZW4gdmlhIGNvbnRleHRcblxuRVhBTVBMRVM6XG5cbkJhc2ljIERlcGxveW1lbnQ6XG4gIG1hdHNvbi1lY3MgZGVwbG95IFxcXFxcbiAgICAtLWNvbnRleHQgdnBjSWQ9dnBjLTEyMzQ1Njc4IFxcXFxcbiAgICAtLWNvbnRleHQgc3VibmV0SWRzPXN1Ym5ldC0xMjM0NTY3OCxzdWJuZXQtODc2NTQzMjEgXFxcXFxuICAgIC0tY29udGV4dCBjbHVzdGVyTmFtZT1teS1jbHVzdGVyIFxcXFxcbiAgICAtLWNvbnRleHQgaW1hZ2U9bmdpbng6YWxwaW5lIFxcXFxcbiAgICAtLWNvbnRleHQgY29udGFpbmVyUG9ydD04MCBcXFxcXG4gICAgLS1jb250ZXh0IGxiUG9ydD04MFxuXG5XaXRoIEFXUyBQcm9maWxlOlxuICBtYXRzb24tZWNzIGRlcGxveSBcXFxcXG4gICAgLS1wcm9maWxlIHByb2QgXFxcXFxuICAgIC0tY29udGV4dCB2cGNJZD12cGMtMTIzNDU2NzggXFxcXFxuICAgIC0tY29udGV4dCBpbWFnZT1uZ2lueDphbHBpbmUgXFxcXFxuICAgIC0tY29udGV4dCBjb250YWluZXJQb3J0PTgwIFxcXFxcbiAgICAtLWNvbnRleHQgbGJQb3J0PTgwXG5cbldpdGggSUFNIFJvbGU6XG4gIG1hdHNvbi1lY3MgZGVwbG95IFxcXFxcbiAgICAtLXJvbGUtYXJuIGFybjphd3M6aWFtOjoxMjM0NTY3ODkwMTI6cm9sZS9EZXBsb3lSb2xlIFxcXFxcbiAgICAtLWNvbnRleHQgdnBjSWQ9dnBjLTEyMzQ1Njc4IFxcXFxcbiAgICAtLWNvbnRleHQgaW1hZ2U9bmdpbng6YWxwaW5lIFxcXFxcbiAgICAtLWNvbnRleHQgY29udGFpbmVyUG9ydD04MCBcXFxcXG4gICAgLS1jb250ZXh0IGxiUG9ydD04MFxuXG5XaXRoIFZhbHVlcyBGaWxlOlxuICBtYXRzb24tZWNzIGRlcGxveSBcXFxcXG4gICAgLS1wcm9maWxlIGRldiBcXFxcXG4gICAgLS1jb250ZXh0IHZhbHVlc0ZpbGU9dmFsdWVzLWRldi55YW1sXG5cbldpdGggRXhwbGljaXQgQ3JlZGVudGlhbHM6XG4gIG1hdHNvbi1lY3MgZGVwbG95IFxcXFxcbiAgICAtLWNvbnRleHQgYXdzQWNjZXNzS2V5SWQ9QUtJQUlPU0ZPRE5ON0VYQU1QTEUgXFxcXFxuICAgIC0tY29udGV4dCBhd3NTZWNyZXRBY2Nlc3NLZXk9d0phbHJYVXRuRkVNSS9LN01ERU5HL2JQeFJmaUNZRVhBTVBMRUtFWSBcXFxcXG4gICAgLS1jb250ZXh0IHZwY0lkPXZwYy0xMjM0NTY3OCBcXFxcXG4gICAgLS1jb250ZXh0IGltYWdlPW5naW54OmFscGluZSBcXFxcXG4gICAgLS1jb250ZXh0IGNvbnRhaW5lclBvcnQ9ODAgXFxcXFxuICAgIC0tY29udGV4dCBsYlBvcnQ9ODBcblxuQWR2YW5jZWQgQ29uZmlndXJhdGlvbjpcbiAgbWF0c29uLWVjcyBkZXBsb3kgXFxcXFxuICAgIC0tcHJvZmlsZSBwcm9kIFxcXFxcbiAgICAtLWNvbnRleHQgdnBjSWQ9dnBjLTEyMzQ1Njc4IFxcXFxcbiAgICAtLWNvbnRleHQgaW1hZ2U9MTIzNDU2Nzg5MDEyLmRrci5lY3IudXMtd2VzdC0yLmFtYXpvbmF3cy5jb20vbXlhcHA6bGF0ZXN0IFxcXFxcbiAgICAtLWNvbnRleHQgc2VydmljZU5hbWU9bXlhcHAtYXBpIFxcXFxcbiAgICAtLWNvbnRleHQgZGVzaXJlZENvdW50PTMgXFxcXFxuICAgIC0tY29udGV4dCBjcHU9NTEyIFxcXFxcbiAgICAtLWNvbnRleHQgbWVtb3J5PTEwMjQgXFxcXFxuICAgIC0tY29udGV4dCBjb250YWluZXJQb3J0PTgwODAgXFxcXFxuICAgIC0tY29udGV4dCBsYlBvcnQ9ODAgXFxcXFxuICAgIC0tY29udGV4dCBlbmFibGVBdXRvU2NhbGluZz10cnVlIFxcXFxcbiAgICAtLWNvbnRleHQgbWluQ2FwYWNpdHk9MiBcXFxcXG4gICAgLS1jb250ZXh0IG1heENhcGFjaXR5PTEwXG5cbk90aGVyIENvbW1hbmRzOlxuICBtYXRzb24tZWNzIHN5bnRoICAgICAgICAgICAgICAgICAgICAjIEdlbmVyYXRlIENsb3VkRm9ybWF0aW9uIHRlbXBsYXRlXG4gIG1hdHNvbi1lY3MgZGlmZiAgICAgICAgICAgICAgICAgICAgICMgU2hvdyBkaWZmZXJlbmNlc1xuICBtYXRzb24tZWNzIGRlc3Ryb3kgICAgICAgICAgICAgICAgICAjIERlc3Ryb3kgc3RhY2tcbiAgbWF0c29uLWVjcyBsaXN0ICAgICAgICAgICAgICAgICAgICAgIyBMaXN0IGFsbCBzdGFja3NcblxuQ1JFREVOVElBTCBNRVRIT0RTOlxuXG4xLiBBV1MgUHJvZmlsZSAoUmVjb21tZW5kZWQpOlxuICAgLSBTZXQgQVdTX1BST0ZJTEUgZW52aXJvbm1lbnQgdmFyaWFibGVcbiAgIC0gVXNlIC0tcHJvZmlsZSBvcHRpb25cbiAgIC0gVXNlIC0tY29udGV4dCBhd3NQcm9maWxlPTxuYW1lPlxuXG4yLiBJQU0gUm9sZTpcbiAgIC0gVXNlIC0tcm9sZS1hcm4gb3B0aW9uXG4gICAtIFVzZSAtLWNvbnRleHQgYXdzUm9sZUFybj08YXJuPlxuXG4zLiBFeHBsaWNpdCBDcmVkZW50aWFsczpcbiAgIC0gU2V0IEFXU19BQ0NFU1NfS0VZX0lELCBBV1NfU0VDUkVUX0FDQ0VTU19LRVkgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAtIFVzZSBBV1MgY3JlZGVudGlhbHMgZmlsZSAofi8uYXdzL2NyZWRlbnRpYWxzKVxuICAgLSBVc2UgLS1jb250ZXh0IGF3c0FjY2Vzc0tleUlkPSwgLS1jb250ZXh0IGF3c1NlY3JldEFjY2Vzc0tleT0sIC0tY29udGV4dCBhd3NTZXNzaW9uVG9rZW49XG5cbjQuIEVDMiBJbnN0YW5jZSBNZXRhZGF0YTpcbiAgIC0gVXNlIC0tZWMyY3JlZHMgb3B0aW9uIHdoZW4gcnVubmluZyBvbiBFQzJcblxuVkFMVUVTIEZJTEUgU1VQUE9SVDpcbiAgbWF0c29uLWVjcyBkZXBsb3kgLS1jb250ZXh0IHZhbHVlc0ZpbGU9dmFsdWVzLnlhbWxcblxuICBWYWx1ZXMgZmlsZSBjYW4gYmUgSlNPTiwgWUFNTCwgb3IgSlMgZm9ybWF0OlxuICAtIHZhbHVlcy5qc29uIChsZWdhY3kgZmxhdCBmb3JtYXQpXG4gIC0gdmFsdWVzLnlhbWwgKG5ldyBzdHJ1Y3R1cmVkIEVDUyBoaWVyYXJjaHkgZm9ybWF0KVxuICAtIHZhbHVlcy5qc1xuXG4gIFRoZSBDREsgc3VwcG9ydHMgYm90aCBsZWdhY3kgZmxhdCBmb3JtYXQgYW5kIG5ldyBzdHJ1Y3R1cmVkIEVDUyBoaWVyYXJjaHkgZm9ybWF0LlxuICBTdHJ1Y3R1cmVkIGZvcm1hdCBmb2xsb3dzIEVDUyBvYmplY3QgaGllcmFyY2h5OiBtZXRhZGF0YSwgaW5mcmFzdHJ1Y3R1cmUsIGNsdXN0ZXIsIFxuICB0YXNrRGVmaW5pdGlvbiwgc2VydmljZSwgbG9hZEJhbGFuY2VyLCBhdXRvU2NhbGluZywgaWFtLCBzZXJ2aWNlRGlzY292ZXJ5LCBhZGRvbnMuXG5cbkNPTlRFWFQgUEFSQU1FVEVSUzpcbiAgQWxsIGNvbmZpZ3VyYXRpb24gaXMgZG9uZSB2aWEgLS1jb250ZXh0IHBhcmFtZXRlcnM6XG5cbkxFR0FDWSBGTEFUIFBBUkFNRVRFUlMgKEJhY2t3YXJkIENvbXBhdGlibGUpOlxuICAtLWNvbnRleHQgdnBjSWQ9PHZwYy1pZD5cbiAgLS1jb250ZXh0IHN1Ym5ldElkcz08c3VibmV0LWlkcz5cbiAgLS1jb250ZXh0IGNsdXN0ZXJOYW1lPTxjbHVzdGVyLW5hbWU+XG4gIC0tY29udGV4dCBpbWFnZT08aW1hZ2UtdXJpPlxuICAtLWNvbnRleHQgYXZhaWxhYmlsaXR5Wm9uZXM9PGF6MSxhejIsYXozPlxuICAtLWNvbnRleHQgY29udGFpbmVyUG9ydD08cG9ydD5cbiAgLS1jb250ZXh0IGxiUG9ydD08cG9ydD5cbiAgLS1jb250ZXh0IHNlcnZpY2VOYW1lPTxzZXJ2aWNlLW5hbWU+XG4gIC0tY29udGV4dCBkZXNpcmVkQ291bnQ9PGNvdW50PlxuICAtLWNvbnRleHQgY3B1PTxjcHUtdW5pdHM+XG4gIC0tY29udGV4dCBtZW1vcnk9PG1lbW9yeS1taWI+XG4gIC0tY29udGV4dCBlbmFibGVBdXRvU2NhbGluZz08dHJ1ZXxmYWxzZT5cbiAgLS1jb250ZXh0IG1pbkNhcGFjaXR5PTxtaW4+XG4gIC0tY29udGV4dCBtYXhDYXBhY2l0eT08bWF4PlxuICAtLWNvbnRleHQgdGFyZ2V0Q3B1VXRpbGl6YXRpb249PHBlcmNlbnQ+XG4gIC0tY29udGV4dCB0YXJnZXRNZW1vcnlVdGlsaXphdGlvbj08cGVyY2VudD5cbiAgLS1jb250ZXh0IGhlYWx0aENoZWNrUGF0aD08cGF0aD5cbiAgLS1jb250ZXh0IGFsbG93ZWRDaWRyPTxjaWRyPlxuICAtLWNvbnRleHQgbG9nUmV0ZW50aW9uRGF5cz08ZGF5cz5cbiAgLS1jb250ZXh0IHRhc2tFeGVjdXRpb25Sb2xlQXJuPTxhcm4+XG4gIC0tY29udGV4dCB0YXNrUm9sZUFybj08YXJuPlxuXG5ORVcgU1RSVUNUVVJFRCBQQVJBTUVURVJTIChFQ1MgSGllcmFyY2h5KTpcbiAgLS1jb250ZXh0IG1ldGFkYXRhPTxqc29uLW9iamVjdD5cbiAgLS1jb250ZXh0IGluZnJhc3RydWN0dXJlPTxqc29uLW9iamVjdD5cbiAgLS1jb250ZXh0IGNsdXN0ZXI9PGpzb24tb2JqZWN0PlxuICAtLWNvbnRleHQgdGFza0RlZmluaXRpb249PGpzb24tb2JqZWN0PlxuICAtLWNvbnRleHQgc2VydmljZT08anNvbi1vYmplY3Q+XG4gIC0tY29udGV4dCBsb2FkQmFsYW5jZXI9PGpzb24tb2JqZWN0PlxuICAtLWNvbnRleHQgYXV0b1NjYWxpbmc9PGpzb24tb2JqZWN0PlxuICAtLWNvbnRleHQgaWFtPTxqc29uLW9iamVjdD5cbiAgLS1jb250ZXh0IHNlcnZpY2VEaXNjb3Zlcnk9PGpzb24tb2JqZWN0PlxuICAtLWNvbnRleHQgYWRkb25zPTxqc29uLW9iamVjdD5cblxuTm90ZTogU3RydWN0dXJlZCBwYXJhbWV0ZXJzIGFyZSB0eXBpY2FsbHkgdXNlZCBpbiB2YWx1ZXMgZmlsZXMgcmF0aGVyIHRoYW4gaW5kaXZpZHVhbCAtYyBvcHRpb25zLlxuXG5Gb3IgZGV0YWlsZWQgcGFyYW1ldGVyIGRvY3VtZW50YXRpb24sIHJ1bjpcbiAgbWF0c29uLWVjcyBkZXBsb3kgLS1jb250ZXh0IGhlbHA9dHJ1ZVxuYCk7XG59ICJdfQ==
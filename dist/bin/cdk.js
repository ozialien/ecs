#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = require("aws-cdk-lib");
const ecs_service_stack_1 = require("../lib/ecs-service-stack");
/**
 * CDK App Entry Point
 *
 * Uses CDK's native context parameters (-c) for configuration
 *
 * Usage:
 *   # Context parameters only
 *   cdk deploy -c vpcId=vpc-12345678 -c image=nginx:alpine
 *
 *   # With values file (Helm-style)
 *   cdk deploy -c valuesFile=values.yaml
 */
const app = new cdk.App();
// Start with empty config
let config = {};
// 1. Load from values file FIRST if specified
const valuesFile = app.node.tryGetContext('valuesFile');
if (valuesFile) {
    console.log(`Values file specified: ${valuesFile}`);
    // Load values from file
    const fs = require('fs');
    const path = require('path');
    const yaml = require('js-yaml');
    const filePath = path.resolve(valuesFile);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: Values file not found: ${filePath}`);
        process.exit(1);
    }
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const values = yaml.load(fileContent);
    // Merge values into config
    config = { ...config, ...values };
}
// 2. Override with context parameters (highest precedence)
// Only override if the context parameter actually exists
const contextKeys = [
    // Structured parameters (ECS hierarchy)
    'metadata', 'infrastructure', 'cluster', 'taskDefinition', 'service', 'loadBalancer', 'autoScaling', 'iam', 'serviceDiscovery', 'addons'
];
contextKeys.forEach(key => {
    const contextValue = app.node.tryGetContext(key);
    if (contextValue !== undefined) {
        // Structured parameters only
        config[key] = contextValue;
    }
});
// 3. Check for help request before validation
const help = app.node.tryGetContext('help');
if (help === 'true' || help === true) {
    // Create stack with minimal config for help display
    new ecs_service_stack_1.EcsServiceStack(app, 'HelpStack', {
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: process.env.CDK_DEFAULT_REGION,
        },
        config: { metadata: { name: 'help', version: '1.0.0' } },
    });
}
else {
    // Validate that required structured configuration is present
    // The CDK stack will handle validation of required parameters
    if (!config.infrastructure?.vpc?.id) {
        console.error('❌ Error: Required infrastructure.vpc.id is missing.');
        console.error('   Use values file or structured context parameters.');
        console.error('');
        console.error('Examples:');
        console.error('  cdk deploy -c valuesFile=values.yaml');
        console.error('  cdk deploy -c infrastructure.vpc.id=vpc-12345678');
        process.exit(1);
    }
    // Create the ECS service stack using metadata name or default
    const stackName = config.metadata?.name || 'EcsServiceStack';
    new ecs_service_stack_1.EcsServiceStack(app, stackName, {
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: process.env.CDK_DEFAULT_REGION,
        },
        config: config,
    });
}
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2Nkay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSxtQ0FBbUM7QUFDbkMsZ0VBQTJEO0FBRzNEOzs7Ozs7Ozs7OztHQVdHO0FBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsMEJBQTBCO0FBQzFCLElBQUksTUFBTSxHQUE4QixFQUFFLENBQUM7QUFFM0MsOENBQThDO0FBQzlDLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3hELElBQUksVUFBVSxFQUFFO0lBQ2QsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUNwRCx3QkFBd0I7SUFDeEIsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM3QixNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFaEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMxQyxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUM1QixPQUFPLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzdELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDakI7SUFFRCxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN0RCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBRXRDLDJCQUEyQjtJQUMzQixNQUFNLEdBQUcsRUFBRSxHQUFHLE1BQU0sRUFBRSxHQUFHLE1BQU0sRUFBRSxDQUFDO0NBQ25DO0FBRUQsMkRBQTJEO0FBQzNELHlEQUF5RDtBQUN6RCxNQUFNLFdBQVcsR0FBRztJQUNsQix3Q0FBd0M7SUFDeEMsVUFBVSxFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsa0JBQWtCLEVBQUUsUUFBUTtDQUN6SSxDQUFDO0FBRUYsV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtJQUN4QixNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqRCxJQUFJLFlBQVksS0FBSyxTQUFTLEVBQUU7UUFDOUIsNkJBQTZCO1FBQzdCLE1BQU0sQ0FBQyxHQUE2QixDQUFDLEdBQUcsWUFBWSxDQUFDO0tBQ3REO0FBQ0gsQ0FBQyxDQUFDLENBQUM7QUFFSCw4Q0FBOEM7QUFDOUMsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDNUMsSUFBSSxJQUFJLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxJQUFJLEVBQUU7SUFDcEMsb0RBQW9EO0lBQ3BELElBQUksbUNBQWUsQ0FBQyxHQUFHLEVBQUUsV0FBVyxFQUFFO1FBQ3BDLEdBQUcsRUFBRTtZQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtZQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0I7U0FDdkM7UUFDRCxNQUFNLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsRUFBc0I7S0FDN0UsQ0FBQyxDQUFDO0NBQ0o7S0FBTTtJQUNMLDZEQUE2RDtJQUM3RCw4REFBOEQ7SUFDOUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtRQUNuQyxPQUFPLENBQUMsS0FBSyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7UUFDckUsT0FBTyxDQUFDLEtBQUssQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO1FBQ3RFLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7UUFDeEQsT0FBTyxDQUFDLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO1FBQ3BFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDakI7SUFFRCw4REFBOEQ7SUFDOUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxJQUFJLElBQUksaUJBQWlCLENBQUM7SUFDN0QsSUFBSSxtQ0FBZSxDQUFDLEdBQUcsRUFBRSxTQUFTLEVBQUU7UUFDbEMsR0FBRyxFQUFFO1lBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1lBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQjtTQUN2QztRQUNELE1BQU0sRUFBRSxNQUEwQjtLQUNuQyxDQUFDLENBQUM7Q0FDSjtBQUVELEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEVjc1NlcnZpY2VTdGFjayB9IGZyb20gJy4uL2xpYi9lY3Mtc2VydmljZS1zdGFjayc7XG5pbXBvcnQgeyBFY3NTZXJ2aWNlQ29uZmlnIH0gZnJvbSAnLi4vbGliL3R5cGVzJztcblxuLyoqXG4gKiBDREsgQXBwIEVudHJ5IFBvaW50XG4gKiBcbiAqIFVzZXMgQ0RLJ3MgbmF0aXZlIGNvbnRleHQgcGFyYW1ldGVycyAoLWMpIGZvciBjb25maWd1cmF0aW9uXG4gKiBcbiAqIFVzYWdlOlxuICogICAjIENvbnRleHQgcGFyYW1ldGVycyBvbmx5XG4gKiAgIGNkayBkZXBsb3kgLWMgdnBjSWQ9dnBjLTEyMzQ1Njc4IC1jIGltYWdlPW5naW54OmFscGluZVxuICogICBcbiAqICAgIyBXaXRoIHZhbHVlcyBmaWxlIChIZWxtLXN0eWxlKVxuICogICBjZGsgZGVwbG95IC1jIHZhbHVlc0ZpbGU9dmFsdWVzLnlhbWxcbiAqL1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBTdGFydCB3aXRoIGVtcHR5IGNvbmZpZ1xubGV0IGNvbmZpZzogUGFydGlhbDxFY3NTZXJ2aWNlQ29uZmlnPiA9IHt9O1xuXG4vLyAxLiBMb2FkIGZyb20gdmFsdWVzIGZpbGUgRklSU1QgaWYgc3BlY2lmaWVkXG5jb25zdCB2YWx1ZXNGaWxlID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgndmFsdWVzRmlsZScpO1xuaWYgKHZhbHVlc0ZpbGUpIHtcbiAgY29uc29sZS5sb2coYFZhbHVlcyBmaWxlIHNwZWNpZmllZDogJHt2YWx1ZXNGaWxlfWApO1xuICAvLyBMb2FkIHZhbHVlcyBmcm9tIGZpbGVcbiAgY29uc3QgZnMgPSByZXF1aXJlKCdmcycpO1xuICBjb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuICBjb25zdCB5YW1sID0gcmVxdWlyZSgnanMteWFtbCcpO1xuICBcbiAgY29uc3QgZmlsZVBhdGggPSBwYXRoLnJlc29sdmUodmFsdWVzRmlsZSk7XG4gIGlmICghZnMuZXhpc3RzU3luYyhmaWxlUGF0aCkpIHtcbiAgICBjb25zb2xlLmVycm9yKGDinYwgRXJyb3I6IFZhbHVlcyBmaWxlIG5vdCBmb3VuZDogJHtmaWxlUGF0aH1gKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cbiAgXG4gIGNvbnN0IGZpbGVDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmOCcpO1xuICBjb25zdCB2YWx1ZXMgPSB5YW1sLmxvYWQoZmlsZUNvbnRlbnQpO1xuICBcbiAgLy8gTWVyZ2UgdmFsdWVzIGludG8gY29uZmlnXG4gIGNvbmZpZyA9IHsgLi4uY29uZmlnLCAuLi52YWx1ZXMgfTtcbn1cblxuLy8gMi4gT3ZlcnJpZGUgd2l0aCBjb250ZXh0IHBhcmFtZXRlcnMgKGhpZ2hlc3QgcHJlY2VkZW5jZSlcbi8vIE9ubHkgb3ZlcnJpZGUgaWYgdGhlIGNvbnRleHQgcGFyYW1ldGVyIGFjdHVhbGx5IGV4aXN0c1xuY29uc3QgY29udGV4dEtleXMgPSBbXG4gIC8vIFN0cnVjdHVyZWQgcGFyYW1ldGVycyAoRUNTIGhpZXJhcmNoeSlcbiAgJ21ldGFkYXRhJywgJ2luZnJhc3RydWN0dXJlJywgJ2NsdXN0ZXInLCAndGFza0RlZmluaXRpb24nLCAnc2VydmljZScsICdsb2FkQmFsYW5jZXInLCAnYXV0b1NjYWxpbmcnLCAnaWFtJywgJ3NlcnZpY2VEaXNjb3ZlcnknLCAnYWRkb25zJ1xuXTtcblxuY29udGV4dEtleXMuZm9yRWFjaChrZXkgPT4ge1xuICBjb25zdCBjb250ZXh0VmFsdWUgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KGtleSk7XG4gIGlmIChjb250ZXh0VmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIFN0cnVjdHVyZWQgcGFyYW1ldGVycyBvbmx5XG4gICAgY29uZmlnW2tleSBhcyBrZXlvZiBFY3NTZXJ2aWNlQ29uZmlnXSA9IGNvbnRleHRWYWx1ZTtcbiAgfVxufSk7XG5cbi8vIDMuIENoZWNrIGZvciBoZWxwIHJlcXVlc3QgYmVmb3JlIHZhbGlkYXRpb25cbmNvbnN0IGhlbHAgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdoZWxwJyk7XG5pZiAoaGVscCA9PT0gJ3RydWUnIHx8IGhlbHAgPT09IHRydWUpIHtcbiAgLy8gQ3JlYXRlIHN0YWNrIHdpdGggbWluaW1hbCBjb25maWcgZm9yIGhlbHAgZGlzcGxheVxuICBuZXcgRWNzU2VydmljZVN0YWNrKGFwcCwgJ0hlbHBTdGFjaycsIHtcbiAgICBlbnY6IHtcbiAgICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gICAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTixcbiAgICB9LFxuICAgIGNvbmZpZzogeyBtZXRhZGF0YTogeyBuYW1lOiAnaGVscCcsIHZlcnNpb246ICcxLjAuMCcgfSB9IGFzIEVjc1NlcnZpY2VDb25maWcsXG4gIH0pO1xufSBlbHNlIHtcbiAgLy8gVmFsaWRhdGUgdGhhdCByZXF1aXJlZCBzdHJ1Y3R1cmVkIGNvbmZpZ3VyYXRpb24gaXMgcHJlc2VudFxuICAvLyBUaGUgQ0RLIHN0YWNrIHdpbGwgaGFuZGxlIHZhbGlkYXRpb24gb2YgcmVxdWlyZWQgcGFyYW1ldGVyc1xuICBpZiAoIWNvbmZpZy5pbmZyYXN0cnVjdHVyZT8udnBjPy5pZCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCBFcnJvcjogUmVxdWlyZWQgaW5mcmFzdHJ1Y3R1cmUudnBjLmlkIGlzIG1pc3NpbmcuJyk7XG4gICAgY29uc29sZS5lcnJvcignICAgVXNlIHZhbHVlcyBmaWxlIG9yIHN0cnVjdHVyZWQgY29udGV4dCBwYXJhbWV0ZXJzLicpO1xuICAgIGNvbnNvbGUuZXJyb3IoJycpO1xuICAgIGNvbnNvbGUuZXJyb3IoJ0V4YW1wbGVzOicpO1xuICAgIGNvbnNvbGUuZXJyb3IoJyAgY2RrIGRlcGxveSAtYyB2YWx1ZXNGaWxlPXZhbHVlcy55YW1sJyk7XG4gICAgY29uc29sZS5lcnJvcignICBjZGsgZGVwbG95IC1jIGluZnJhc3RydWN0dXJlLnZwYy5pZD12cGMtMTIzNDU2NzgnKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cbiAgXG4gIC8vIENyZWF0ZSB0aGUgRUNTIHNlcnZpY2Ugc3RhY2sgdXNpbmcgbWV0YWRhdGEgbmFtZSBvciBkZWZhdWx0XG4gIGNvbnN0IHN0YWNrTmFtZSA9IGNvbmZpZy5tZXRhZGF0YT8ubmFtZSB8fCAnRWNzU2VydmljZVN0YWNrJztcbiAgbmV3IEVjc1NlcnZpY2VTdGFjayhhcHAsIHN0YWNrTmFtZSwge1xuICAgIGVudjoge1xuICAgICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OLFxuICAgIH0sXG4gICAgY29uZmlnOiBjb25maWcgYXMgRWNzU2VydmljZUNvbmZpZyxcbiAgfSk7XG59XG5cbmFwcC5zeW50aCgpOyAiXX0=
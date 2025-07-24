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
    const fs = require('fs');
    const path = require('path');
    if (fs.existsSync(valuesFile)) {
        try {
            const fileContent = fs.readFileSync(valuesFile, 'utf8');
            const ext = path.extname(valuesFile).toLowerCase();
            let values;
            try {
                switch (ext) {
                    case '.js':
                        values = require(path.resolve(valuesFile));
                        break;
                    case '.yaml':
                    case '.yml':
                        const yaml = require('js-yaml');
                        values = yaml.load(fileContent);
                        break;
                    default:
                        values = JSON.parse(fileContent);
                }
            }
            catch (error) {
                console.error(`❌ Error parsing values file ${valuesFile}: ${error}`);
                process.exit(1);
            }
            // Load values file into config
            config = { ...config, ...values };
            console.log(`📄 Loaded values from: ${valuesFile}`);
        }
        catch (error) {
            console.warn(`⚠️  Warning: Failed to parse values file ${valuesFile}: ${error}`);
        }
    }
    else {
        console.warn(`⚠️  Warning: Values file not found: ${valuesFile}`);
    }
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
// 3. Validate that required structured configuration is present
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
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2Nkay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSxtQ0FBbUM7QUFDbkMsZ0VBQTJEO0FBRzNEOzs7Ozs7Ozs7OztHQVdHO0FBRUgsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsMEJBQTBCO0FBQzFCLElBQUksTUFBTSxHQUE4QixFQUFFLENBQUM7QUFFM0MsOENBQThDO0FBQzlDLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3hELElBQUksVUFBVSxFQUFFO0lBQ2QsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUU3QixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDN0IsSUFBSTtZQUNGLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ3hELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFFbkQsSUFBSSxNQUFXLENBQUM7WUFDaEIsSUFBSTtnQkFDRixRQUFRLEdBQUcsRUFBRTtvQkFDWCxLQUFLLEtBQUs7d0JBQ1IsTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7d0JBQzNDLE1BQU07b0JBQ1IsS0FBSyxPQUFPLENBQUM7b0JBQ2IsS0FBSyxNQUFNO3dCQUNULE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDaEMsTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7d0JBQ2hDLE1BQU07b0JBQ1I7d0JBQ0UsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7aUJBQ3BDO2FBQ0Y7WUFBQyxPQUFPLEtBQUssRUFBRTtnQkFDZCxPQUFPLENBQUMsS0FBSyxDQUFDLCtCQUErQixVQUFVLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQztnQkFDckUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNqQjtZQUVELCtCQUErQjtZQUMvQixNQUFNLEdBQUcsRUFBRSxHQUFHLE1BQU0sRUFBRSxHQUFHLE1BQU0sRUFBRSxDQUFDO1lBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCLFVBQVUsRUFBRSxDQUFDLENBQUM7U0FDckQ7UUFBQyxPQUFPLEtBQUssRUFBRTtZQUNkLE9BQU8sQ0FBQyxJQUFJLENBQUMsNENBQTRDLFVBQVUsS0FBSyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1NBQ2xGO0tBQ0Y7U0FBTTtRQUNMLE9BQU8sQ0FBQyxJQUFJLENBQUMsdUNBQXVDLFVBQVUsRUFBRSxDQUFDLENBQUM7S0FDbkU7Q0FDRjtBQUVELDJEQUEyRDtBQUMzRCx5REFBeUQ7QUFDekQsTUFBTSxXQUFXLEdBQUc7SUFDbEIsd0NBQXdDO0lBQ3hDLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLFFBQVE7Q0FDekksQ0FBQztBQUVGLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDeEIsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakQsSUFBSSxZQUFZLEtBQUssU0FBUyxFQUFFO1FBQzlCLDZCQUE2QjtRQUM3QixNQUFNLENBQUMsR0FBNkIsQ0FBQyxHQUFHLFlBQVksQ0FBQztLQUN0RDtBQUNILENBQUMsQ0FBQyxDQUFDO0FBRUgsZ0VBQWdFO0FBQ2hFLDhEQUE4RDtBQUM5RCxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQ25DLE9BQU8sQ0FBQyxLQUFLLENBQUMscURBQXFELENBQUMsQ0FBQztJQUNyRSxPQUFPLENBQUMsS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUM7SUFDdEUsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztJQUN4RCxPQUFPLENBQUMsS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7SUFDcEUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNqQjtBQUVELDhEQUE4RDtBQUM5RCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksSUFBSSxpQkFBaUIsQ0FBQztBQUM3RCxJQUFJLG1DQUFlLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRTtJQUNsQyxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCO0tBQ3ZDO0lBQ0QsTUFBTSxFQUFFLE1BQTBCO0NBQ25DLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEVjc1NlcnZpY2VTdGFjayB9IGZyb20gJy4uL2xpYi9lY3Mtc2VydmljZS1zdGFjayc7XG5pbXBvcnQgeyBFY3NTZXJ2aWNlQ29uZmlnIH0gZnJvbSAnLi4vbGliL3R5cGVzJztcblxuLyoqXG4gKiBDREsgQXBwIEVudHJ5IFBvaW50XG4gKiBcbiAqIFVzZXMgQ0RLJ3MgbmF0aXZlIGNvbnRleHQgcGFyYW1ldGVycyAoLWMpIGZvciBjb25maWd1cmF0aW9uXG4gKiBcbiAqIFVzYWdlOlxuICogICAjIENvbnRleHQgcGFyYW1ldGVycyBvbmx5XG4gKiAgIGNkayBkZXBsb3kgLWMgdnBjSWQ9dnBjLTEyMzQ1Njc4IC1jIGltYWdlPW5naW54OmFscGluZVxuICogICBcbiAqICAgIyBXaXRoIHZhbHVlcyBmaWxlIChIZWxtLXN0eWxlKVxuICogICBjZGsgZGVwbG95IC1jIHZhbHVlc0ZpbGU9dmFsdWVzLnlhbWxcbiAqL1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBTdGFydCB3aXRoIGVtcHR5IGNvbmZpZ1xubGV0IGNvbmZpZzogUGFydGlhbDxFY3NTZXJ2aWNlQ29uZmlnPiA9IHt9O1xuXG4vLyAxLiBMb2FkIGZyb20gdmFsdWVzIGZpbGUgRklSU1QgaWYgc3BlY2lmaWVkXG5jb25zdCB2YWx1ZXNGaWxlID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgndmFsdWVzRmlsZScpO1xuaWYgKHZhbHVlc0ZpbGUpIHtcbiAgY29uc3QgZnMgPSByZXF1aXJlKCdmcycpO1xuICBjb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuICBcbiAgaWYgKGZzLmV4aXN0c1N5bmModmFsdWVzRmlsZSkpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZmlsZUNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmModmFsdWVzRmlsZSwgJ3V0ZjgnKTtcbiAgICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZSh2YWx1ZXNGaWxlKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgXG4gICAgICBsZXQgdmFsdWVzOiBhbnk7XG4gICAgICB0cnkge1xuICAgICAgICBzd2l0Y2ggKGV4dCkge1xuICAgICAgICAgIGNhc2UgJy5qcyc6XG4gICAgICAgICAgICB2YWx1ZXMgPSByZXF1aXJlKHBhdGgucmVzb2x2ZSh2YWx1ZXNGaWxlKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICcueWFtbCc6XG4gICAgICAgICAgY2FzZSAnLnltbCc6XG4gICAgICAgICAgICBjb25zdCB5YW1sID0gcmVxdWlyZSgnanMteWFtbCcpO1xuICAgICAgICAgICAgdmFsdWVzID0geWFtbC5sb2FkKGZpbGVDb250ZW50KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB2YWx1ZXMgPSBKU09OLnBhcnNlKGZpbGVDb250ZW50KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihg4p2MIEVycm9yIHBhcnNpbmcgdmFsdWVzIGZpbGUgJHt2YWx1ZXNGaWxlfTogJHtlcnJvcn1gKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBMb2FkIHZhbHVlcyBmaWxlIGludG8gY29uZmlnXG4gICAgICBjb25maWcgPSB7IC4uLmNvbmZpZywgLi4udmFsdWVzIH07XG4gICAgICBjb25zb2xlLmxvZyhg8J+ThCBMb2FkZWQgdmFsdWVzIGZyb206ICR7dmFsdWVzRmlsZX1gKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDimqDvuI8gIFdhcm5pbmc6IEZhaWxlZCB0byBwYXJzZSB2YWx1ZXMgZmlsZSAke3ZhbHVlc0ZpbGV9OiAke2Vycm9yfWApO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oYOKaoO+4jyAgV2FybmluZzogVmFsdWVzIGZpbGUgbm90IGZvdW5kOiAke3ZhbHVlc0ZpbGV9YCk7XG4gIH1cbn1cblxuLy8gMi4gT3ZlcnJpZGUgd2l0aCBjb250ZXh0IHBhcmFtZXRlcnMgKGhpZ2hlc3QgcHJlY2VkZW5jZSlcbi8vIE9ubHkgb3ZlcnJpZGUgaWYgdGhlIGNvbnRleHQgcGFyYW1ldGVyIGFjdHVhbGx5IGV4aXN0c1xuY29uc3QgY29udGV4dEtleXMgPSBbXG4gIC8vIFN0cnVjdHVyZWQgcGFyYW1ldGVycyAoRUNTIGhpZXJhcmNoeSlcbiAgJ21ldGFkYXRhJywgJ2luZnJhc3RydWN0dXJlJywgJ2NsdXN0ZXInLCAndGFza0RlZmluaXRpb24nLCAnc2VydmljZScsICdsb2FkQmFsYW5jZXInLCAnYXV0b1NjYWxpbmcnLCAnaWFtJywgJ3NlcnZpY2VEaXNjb3ZlcnknLCAnYWRkb25zJ1xuXTtcblxuY29udGV4dEtleXMuZm9yRWFjaChrZXkgPT4ge1xuICBjb25zdCBjb250ZXh0VmFsdWUgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KGtleSk7XG4gIGlmIChjb250ZXh0VmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIFN0cnVjdHVyZWQgcGFyYW1ldGVycyBvbmx5XG4gICAgY29uZmlnW2tleSBhcyBrZXlvZiBFY3NTZXJ2aWNlQ29uZmlnXSA9IGNvbnRleHRWYWx1ZTtcbiAgfVxufSk7XG5cbi8vIDMuIFZhbGlkYXRlIHRoYXQgcmVxdWlyZWQgc3RydWN0dXJlZCBjb25maWd1cmF0aW9uIGlzIHByZXNlbnRcbi8vIFRoZSBDREsgc3RhY2sgd2lsbCBoYW5kbGUgdmFsaWRhdGlvbiBvZiByZXF1aXJlZCBwYXJhbWV0ZXJzXG5pZiAoIWNvbmZpZy5pbmZyYXN0cnVjdHVyZT8udnBjPy5pZCkge1xuICBjb25zb2xlLmVycm9yKCfinYwgRXJyb3I6IFJlcXVpcmVkIGluZnJhc3RydWN0dXJlLnZwYy5pZCBpcyBtaXNzaW5nLicpO1xuICBjb25zb2xlLmVycm9yKCcgICBVc2UgdmFsdWVzIGZpbGUgb3Igc3RydWN0dXJlZCBjb250ZXh0IHBhcmFtZXRlcnMuJyk7XG4gIGNvbnNvbGUuZXJyb3IoJycpO1xuICBjb25zb2xlLmVycm9yKCdFeGFtcGxlczonKTtcbiAgY29uc29sZS5lcnJvcignICBjZGsgZGVwbG95IC1jIHZhbHVlc0ZpbGU9dmFsdWVzLnlhbWwnKTtcbiAgY29uc29sZS5lcnJvcignICBjZGsgZGVwbG95IC1jIGluZnJhc3RydWN0dXJlLnZwYy5pZD12cGMtMTIzNDU2NzgnKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufVxuXG4vLyBDcmVhdGUgdGhlIEVDUyBzZXJ2aWNlIHN0YWNrIHVzaW5nIG1ldGFkYXRhIG5hbWUgb3IgZGVmYXVsdFxuY29uc3Qgc3RhY2tOYW1lID0gY29uZmlnLm1ldGFkYXRhPy5uYW1lIHx8ICdFY3NTZXJ2aWNlU3RhY2snO1xubmV3IEVjc1NlcnZpY2VTdGFjayhhcHAsIHN0YWNrTmFtZSwge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OLFxuICB9LFxuICBjb25maWc6IGNvbmZpZyBhcyBFY3NTZXJ2aWNlQ29uZmlnLFxufSk7XG5cbmFwcC5zeW50aCgpOyAiXX0=
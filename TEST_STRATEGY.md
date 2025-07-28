# ECS Deployer Test Strategy

## Overview

This document outlines the comprehensive testing strategy for the ECS Deployer CDK construct, including both unit tests and integration tests using CDK synthesis.

## Test Approach

### 1. CDK Synthesis Testing (Integration Tests)

The most effective way to test CDK constructs is to use CDK synthesis to generate actual CloudFormation templates and compare them against expected outputs.

#### Process:
1. **Generate CloudFormation**: Use `cdk synth` with values files to generate CloudFormation templates
2. **Compare with Expected**: Compare generated templates with expected CloudFormation templates
3. **Identify Discrepancies**: Analyze differences to understand what the CDK is generating vs. what's expected
4. **Fix Issues**: Address discrepancies in either the CDK implementation or expected templates

#### Example:
```bash
# Generate CloudFormation from values file
cdk synth --context valuesFile=examples/values-cas-erd-svc.yaml > generated-cf.yaml

# Compare with expected template
diff -u cf/cas-erd-svc.yaml generated-cf.yaml
```

### 2. Unit Testing with CDK Assertions

Use CDK's built-in assertion library to test specific CloudFormation properties:

```typescript
import { Template } from 'aws-cdk-lib/assertions';

const template = Template.fromStack(stack);

// Test specific resource properties
template.hasResourceProperties('AWS::ECS::TaskDefinition', {
  ContainerDefinitions: [
    {
      Environment: [
        { Name: 'NODE_ENV', Value: 'production' }
      ]
    }
  ]
});
```

## Key Insights from Testing

### 1. CDK Generates Additional Resources

The CDK construct generates more resources than simple CloudFormation templates:
- **ECS Cluster**: Always creates a new cluster
- **Log Groups**: Creates CloudWatch log groups for container logging
- **IAM Roles**: Creates execution and task roles with policies
- **Service Discovery**: Creates service discovery resources when enabled
- **Auto Scaling**: Creates auto scaling resources when enabled

### 2. Resource Naming Differences

CDK generates unique resource names that differ from manual CloudFormation:
- Expected: `LB8A12904C`
- Generated: `caserdsvcServiceLB5ABB90D5`

### 3. Configuration Issues

#### Container Name Mismatch
- **Issue**: Values file uses `name: "cas-erd-svc"` but CDK expects `name: "main"`
- **Fix**: Update values file to use `name: "main"` for the main container

#### Health Check Configuration
- **Issue**: CDK health check validation checks for `healthCheck?.command` but should check `healthCheck.command.length > 0`
- **Fix**: Update `createHealthCheck` method to properly validate command arrays

#### IAM Policy Structure
- **Issue**: Tests expect named policies in `Policies` array, but CDK creates inline policies
- **Fix**: Update tests to match CDK's inline policy structure

### 4. Runtime Platform Issues
- **Issue**: CDK not setting `RuntimePlatform` property in CloudFormation
- **Root Cause**: CDK version or configuration issue with runtime platform support

## Test Categories

### 1. Basic Functionality Tests
- ✅ ECS Service creation
- ✅ Task Definition with environment variables
- ✅ Load balancer configuration
- ✅ Security group configuration

### 2. Advanced Feature Tests
- ❌ Container health checks (CDK implementation issue)
- ❌ Runtime platform configuration (CDK not generating property)
- ❌ IAM role policies (test expectations mismatch)
- ❌ Custom IAM policies (invalid policy structure)

### 3. Integration Tests
- ✅ CDK synthesis with values files
- ✅ CloudFormation template generation
- ✅ Resource creation and dependencies

## Test File Organization

### Current Structure
```
test/
├── basic-ecs-service.test.ts      # Basic ECS service tests
├── auto-scaling.test.ts           # Auto scaling tests
├── container-configuration.test.ts # Container config tests
├── load-balancer.test.ts          # Load balancer tests
├── advanced-features.test.ts      # Advanced features
├── iam-roles.test.ts             # IAM role tests
└── ecs-service-stack.test.ts     # Main stack tests
```

### Issues with Split Tests
Moving tests to separate files exposed underlying CDK implementation issues:
1. **Context Dependencies**: Some tests relied on context from other tests
2. **Resource Dependencies**: Tests assumed certain resources were created
3. **Configuration Assumptions**: Tests assumed specific CDK behavior

## Recommended Testing Strategy

### 1. CDK Synthesis Testing (Primary)
```bash
# Test with real values files
cdk synth --context valuesFile=examples/values-cas-erd-svc.yaml
cdk synth --context valuesFile=examples/values-simple-service.yaml

# Compare outputs
diff -u cf/expected-template.yaml generated-template.yaml
```

### 2. Unit Testing (Secondary)
- Test specific CDK construct methods
- Test configuration parsing
- Test error handling

### 3. Integration Testing
- Test with different values file configurations
- Test edge cases and error conditions
- Test resource dependencies

## Common Issues and Solutions

### Issue: Tests Fail After Moving to Separate Files
**Root Cause**: Tests were dependent on shared context or assumptions
**Solution**: Ensure each test is self-contained with proper setup

### Issue: CDK Generates More Resources Than Expected
**Root Cause**: CDK creates additional resources for best practices
**Solution**: Either update expected templates or configure CDK to not generate optional resources

### Issue: Health Checks Not Working
**Root Cause**: CDK health check validation logic
**Solution**: Fix `createHealthCheck` method to properly validate command arrays

### Issue: IAM Policies Not Matching
**Root Cause**: CDK creates inline policies vs. named policies
**Solution**: Update tests to match CDK's actual output structure

## Best Practices

### 1. Use CDK Synthesis for Integration Testing
- More reliable than unit tests for complex constructs
- Tests actual CloudFormation generation
- Catches real-world issues

### 2. Keep Tests Self-Contained
- Each test should set up its own context
- Avoid dependencies between tests
- Use proper beforeEach/afterEach cleanup

### 3. Test with Real Values Files
- Use actual configuration files
- Test realistic scenarios
- Validate against expected CloudFormation

### 4. Document Expected vs. Generated Differences
- Understand why CDK generates additional resources
- Decide whether to accept or configure away additional resources
- Update documentation accordingly

## Future Improvements

### 1. Automated CDK Synthesis Testing
```bash
# Script to test all values files
for file in examples/*.yaml; do
  cdk synth --context valuesFile=$file > generated-$(basename $file .yaml).yaml
  diff -u cf/expected-$(basename $file .yaml).yaml generated-$(basename $file .yaml).yaml
done
```

### 2. CloudFormation Template Validation
- Validate generated templates against CloudFormation schema
- Test template deployment in sandbox environment
- Validate resource dependencies

### 3. Performance Testing
- Test with large configurations
- Measure synthesis time
- Test memory usage

## Conclusion

The CDK synthesis approach is the most effective way to test CDK constructs. It reveals real issues that unit tests might miss and provides confidence that the generated CloudFormation templates are correct and complete.

The key insight is that CDK generates more resources than simple CloudFormation templates, which is actually good for production deployments but requires updating expectations and tests accordingly. 
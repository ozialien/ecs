# CDK Reusable Deployment Pattern (Helm Style)

## Overarching goal

Create a cdk deployment tool for deploying ecs environments.

## Approach

1. Use typescript cdk
1. Make a @matson:ecs package that can be installed via npm install @matson:ecs


## Requirements

1. **One set of CDK files** - Single codebase for all deployments
2. **Allows different stacks** - Each deployment creates unique CloudFormation stack
3. **Parameterized** - All values from context parameters
4. **Scalable** - Can deploy hundreds of resources
5. **Helm-style** - Same pattern as Helm charts with values and templates
6. **12-Factor App Principles** - Follow the twelve-factor methodology for cloud-native applications
7. **Help Directive** - Maintain a help directive to show all CDK options and usage examples
8. **Detailed Code Comments** - All code should have comprehensive explanation comments
9. **Mistake Documentation** - All mistakes must be documented in context.md for learning and prevention


## Implementation Notes

### Unique Construct IDs
- **Stack IDs**: Must be unique per deployment (e.g., `${repoName}EcrStack`)
- **Construct IDs**: Must be unique within CDK app (e.g., `${props.repositoryName}Repository`)
- **Output IDs**: Must be unique within CDK app (e.g., `${props.repositoryName}RepositoryUri`)
- **Export Names**: Must be unique across AWS account (e.g., `${props.repositoryName}-repository-uri`)

### Common Mistakes to Avoid
- **Hardcoded construct IDs**: Will cause conflicts when deploying multiple stacks
- **Duplicate export names**: Will fail if same export name used across different stacks
- **Overcomplicating**: Don't add unnecessary parameters when existing ones work (e.g., `imageScanOnPush` already handles scanning)

### CDK vs Helm Comparison
- **Helm**: Templates with variables, multiple releases from same chart
- **CDK**: TypeScript code with context parameters, multiple stacks from same codebase
- **Key Difference**: CDK requires unique construct IDs, Helm handles this automatically

### Help Implementation (12-Factor Compliant)
- **Help via context parameter**: Use `--context help=true` to show available options
- **Same configuration mechanism**: Help uses the same context parameter system as the app
- **No separate commands**: Help is integrated into the existing CDK command structure
- **Consistent with 12-factor**: Configuration via environment/context parameters only

## Development Guidelines

### Golden Rules
- **"That's just not cricket"** - Always play fair and follow the rules you've established
- **Practice what you preach** - If you document guidelines, you must follow them yourself
- **Consistency is key** - Don't write rules and then immediately violate them
- **Honesty in behavior** - Don't claim to learn from mistakes while repeating them

### Code Modification Policy
- **Never change code without explicit permission** - Always ask before making any code changes
- **Request approval first** - Get user confirmation before modifying any files
- **Explain changes** - Clearly describe what changes will be made and why
- **Respect existing patterns** - Follow the established code structure and conventions
- **No commits or pushes without permission** - Never commit or push changes without explicit user approval
- **Incremental changes only** - Make small, focused changes and test each one before proceeding
- **Fail-safe approach** - Ensure each change doesn't break existing functionality
- **Optional features** - Add new features as optional parameters with sensible defaults
- **Conditional logic** - Use conditional logic based on dependencies and requirements
- **Test after each change** - Verify the app still works after each modification
- **Update tests when code changes** - Always update and run tests when modifying code, ensure all tests pass before committing

### Deployment Policy
- **Always ask for deployment permission** - Never deploy automatically without explicit user approval
- **Show deployment parameters** - Clearly display all parameters that will be used in the deployment
- **Explain what will be deployed** - Describe the resources that will be created/modified
- **Get confirmation** - Wait for explicit "yes" before proceeding with any deployment
- **Document deployment requests** - Record deployment permission requests in context.md for future reference

### Mistakes AI Made

#### 1. Encryption Feature - Made Optional Parameter Mandatory
- **Mistake**: Said encryption would be optional but made it mandatory in code
- **Issue**: Always passed `encryptionType` parameter even when not specified
- **Fix**: Used conditional logic to only pass parameter when explicitly provided
- **Lesson**: Verify that optional parameters are truly optional in implementation

#### 2. Repository Policy - Hardcoded Organization ID (12-Factor Violation)
- **Mistake**: Hardcoded `'o-xxxxxxxxxx'` organization ID in cross-account access policy
- **Issue**: Violated 12-factor principle of configuration via environment
- **Fix**: Added `organizationId` context parameter and made it required when cross-account access is enabled
- **Lesson**: Never hardcode configuration values - always make them configurable via context parameters

#### 3. Repository Policy - Inconsistent Policy Implementation
- **Mistake**: Created `policyDocument` but then ignored it and created new `PolicyStatement`
- **Issue**: Code was confusing and didn't use the parsed JSON properly
- **Fix**: Simplified to directly apply custom statements or use default cross-account policy
- **Lesson**: Keep implementation simple and consistent with the intended design

#### 4. Scope Management - Inconsistent Feature Scope
- **Mistake**: Started with small scope, then expanded without clear boundaries
- **Issue**: User had to review code multiple times due to scope changes
- **Fix**: Added incremental change guidelines to context.md
- **Lesson**: Stick to defined scope and make incremental changes only

#### 5. Over-Engineering - Added Unnecessary Complexity
- **Mistake**: Converted simple working code into complex type-safe system without real need
- **Issue**: Added 189 lines of configuration parsing when original approach worked fine
- **Lesson**: Don't "improve" code that's already working well - ask if changes are actually needed

#### 6. Premature Commits - Committed Without Permission
- **Mistake**: Committed and pushed package conversion changes without asking first
- **Issue**: Made significant changes (converting to npm package) without user approval
- **Lesson**: ALWAYS ask before committing changes, especially for major structural changes

#### 7. Assumption-Based Actions - Didn't Ask Before Acting
- **Mistake**: Assumed user wanted package conversion implemented and committed
- **Issue**: Got excited about technical challenge and forgot to check if user actually wanted it
- **Lesson**: Ask "Should I do this?" before implementing solutions, even if they seem obvious

#### 8. Environment Logic in Code - 12-Factor Violation
- **Mistake**: Added environment-specific logic in CDK code (e.g., `if (envName === 'dev')`)
- **Issue**: Violated 12-Factor Principle #3 "Config" - configuration should be in environment, not in code
- **Problem**: CDK code knew about environments instead of being environment-agnostic
- **Anti-Pattern**: 
  ```typescript
  // WRONG - Code knows about environments
  const envName = app.node.tryGetContext('env');
  if (envName === 'dev') { /* dev logic */ }
  if (envName === 'prod') { /* prod logic */ }
  ```
- **Correct Approach**:
  ```typescript
  // RIGHT - Environment-agnostic code
  const config = {
    vpcId: process.env.VPC_ID,
    subnetIds: process.env.SUBNET_IDS?.split(','),
    clusterName: process.env.CLUSTER_NAME,
  };
  ```
- **Lesson**: CDK code should be environment-agnostic. Use environment variables (`AWS_PROFILE=dev|prod`) and environment-specific config files (`.env.dev`, `.env.prod`) instead of environment logic in code
- **12-Factor Compliance**: Configuration via environment variables only, no environment logic in application code

#### 9. Hardcoded Values Instead of Context Parameters - 12-Factor Violation
- **Mistake**: Hardcoded values in CDK code instead of using context parameters with defaults
- **Issue**: Violated 12-Factor Principle #3 "Config" - configuration should be externalized
- **Problem**: Values like `'10.120.0.0/24'`, `'us-west-2'`, `30` seconds were hardcoded
- **Anti-Pattern**: 
  ```typescript
  // WRONG - Hardcoded values
  albSecurityGroup.addIngressRule(
    ec2.Peer.ipv4('10.120.0.0/24'), 
    ec2.Port.tcp(80), 
    'Allow HTTP from 10.120.0.0/24'
  );
  ```
- **Correct Approach**:
  ```typescript
  // RIGHT - Context parameters with defaults
  const allowedCidr = props.envConfig.allowedCidr || '10.120.0.0/24';
  albSecurityGroup.addIngressRule(
    ec2.Peer.ipv4(allowedCidr), 
    ec2.Port.tcp(80), 
    `Allow HTTP from ${allowedCidr}`
  );
  ```
- **Lesson**: All configuration values should be context parameters with sensible defaults. Never hardcode values that could vary between environments
- **12-Factor Compliance**: All configuration via context parameters, no hardcoded values in application code

#### 10. Using --context env= Instead of AWS_PROFILE - 12-Factor Violation
- **Mistake**: Used `--context env=<environment>` instead of `AWS_PROFILE` for environment detection
- **Issue**: Violated 12-Factor Principle #3 "Config" - configuration should be in environment, not in code
- **Problem**: CDK code required `--context env=dev` instead of using `AWS_PROFILE=dev`
- **Anti-Pattern**: 
  ```bash
  # WRONG - Using context parameters
  cdk deploy --context env=dev
  cdk deploy --context env=staging
  cdk deploy --context env=prod
  ```
- **Correct Approach**:
  ```bash
  # RIGHT - Using AWS_PROFILE
  AWS_PROFILE=dev cdk deploy
  AWS_PROFILE=staging cdk deploy
  AWS_PROFILE=prod cdk deploy
  ```
- **Lesson**: Use `AWS_PROFILE` for environment detection, not `--context env=`. This follows 12-Factor principles of configuration via environment variables
- **12-Factor Compliance**: Environment detection via `AWS_PROFILE`, no environment logic in application code

#### 11. AI Assistant Still Using --context env= After Being Corrected - Pattern Violation
- **Mistake**: AI assistant continued to suggest `--context env=` in responses even after being shown the correct pattern
- **Issue**: Failed to learn from the established pattern in `../create-ecr-repo` which correctly uses context parameters without `env=`
- **Problem**: AI kept suggesting incorrect patterns like `cdk deploy --context env=dev` instead of the correct `cdk deploy --context repo=myapp-api`
- **Anti-Pattern**: 
  ```bash
  # WRONG - AI kept suggesting this
  cdk deploy --context env=dev --context repo=myapp-api
  ```
- **Correct Approach** (from ../create-ecr-repo example):
  ```bash
  # RIGHT - Context parameters only, no env=
  cdk deploy --context repo=myapp-api
  cdk deploy --context repo=shipping-api --context environment=prod --context project=shipping-api
  ```
- **Lesson**: When shown a working example pattern, AI must follow that exact pattern and not revert to incorrect suggestions
- **Requirement**: AI must study and follow the established patterns in working examples, not invent new patterns

#### 12. Misunderstanding 12-Factor Principles - Removing Sensible Defaults
- **Mistake**: AI tried to remove sensible defaults (`|| '1'`, `|| '256'`, etc.) from `bin/cdk.ts` claiming it violated 12-factor principles
- **Issue**: Completely misunderstood what 12-factor Principle #3 "Config" actually means
- **Problem**: Thought that having defaults like `|| '1'` for `desiredCount` or `|| '256'` for `cpu` violated 12-factor principles
- **Anti-Pattern**: 
  ```typescript
  // WRONG - AI tried to remove these sensible defaults
  desiredCount: app.node.tryGetContext('desiredCount') || parseInt(process.env.DESIRED_COUNT || '1'),
  cpu: app.node.tryGetContext('cpu') || parseInt(process.env.CPU || '256'),
  ```
- **Correct Approach**:
  ```typescript
  // RIGHT - Sensible defaults are perfectly fine for 12-factor
  desiredCount: app.node.tryGetContext('desiredCount') || parseInt(process.env.DESIRED_COUNT || '1'),
  cpu: app.node.tryGetContext('cpu') || parseInt(process.env.CPU || '256'),
  ```
- **Lesson**: 12-Factor Principle #3 "Config" means:
  1. Store config in environment (which we do with `process.env` fallbacks)
  2. Don't hardcode config in codebase (which we don't - we use environment variables)
  3. Have sensible defaults for development (which the `|| 'default'` values provide)
- **12-Factor Compliance**: The current implementation with environment variable fallbacks and sensible defaults is exactly correct for 12-factor principles

#### 13. Over-Engineering Stack Names - Unnecessary Complexity
- **Mistake**: Added unnecessary `stackName` parameter when `serviceName` was already working perfectly
- **Issue**: Created complexity where none was needed - `serviceName` already provided unique stack names
- **Problem**: Added redundant parameter and updated all construct IDs unnecessarily
- **Anti-Pattern**: 
  ```typescript
  // WRONG - Unnecessary complexity
  const stackName = config.stackName || config.serviceName || 'EcsServiceStack';
  ```
- **Correct Approach**:
  ```typescript
  // RIGHT - Use existing serviceName
  const stackName = config.serviceName || 'EcsServiceStack';
  ```
- **Lesson**: Don't add new parameters when existing ones work perfectly. `serviceName` already provided unique stack names
- **Context.md Compliance**: The original `serviceName` approach was already compliant with unique construct ID requirements

#### 12. AI Assistant Claiming Comprehensive Implementation Without Proper Review - Quality Assessment Mistake
- **Mistake**: AI assistant claimed the ECS CDK utility was "comprehensive" and "production-ready" without properly reviewing critical components
- **Issue**: Gave high completeness score (8.5/10) while missing fundamental flaws like proper image handling
- **Problem**: User correctly pointed out that the implementation had placeholder image code and missing image configuration in documentation
- **Anti-Pattern**: 
  ```typescript
  // WRONG - AI claimed this was comprehensive
  containerImage = ecs.ContainerImage.fromRegistry('nginx:latest'); // Placeholder
  ```
- **Correct Assessment**: Should have identified that proper image handling is fundamental to ECS deployments
- **Lesson**: Always thoroughly review core functionality before claiming comprehensiveness. For ECS deployments, image handling is critical and cannot be overlooked
- **Requirement**: When assessing completeness, check all fundamental components, not just infrastructure pieces. Image handling is core to ECS, not optional
- **Follow-up**: Must update context.md with mistakes and learn from them, not just acknowledge them

#### 13. Critical Image Handling Implementation - Fundamental ECS Capability Missing
- **Mistake**: Implemented placeholder image handling with hardcoded nginx:latest instead of proper image source configuration
- **Issue**: ECS deployments require proper image handling - this is fundamental, not optional
- **Problem**: 
  ```typescript
  // WRONG - Placeholder implementation
  containerImage = ecs.ContainerImage.fromRegistry('nginx:latest'); // Placeholder
  ```
- **Correct Implementation**:
  ```typescript
  // RIGHT - Multiple image source support
  const imageSource = props.envConfig.imageSource || 'ecr';
  if (imageSource === 'dockerfile') {
    containerImage = ecs.ContainerImage.fromAsset(dockerfilePath, { buildArgs });
  } else if (imageSource === 'external' && externalImageUri) {
    containerImage = ecs.ContainerImage.fromRegistry(externalImageUri);
  } else {
    containerImage = ecs.ContainerImage.fromRegistry(`${registryDomain}/${repositoryName}:${tag}`);
  }
  ```
- **Lesson**: ECS deployments require proper image handling with multiple source options (ECR, Dockerfile, external registries). This is core functionality that cannot be overlooked
- **Requirement**: All ECS deployment patterns must support proper image configuration with build arguments, external registries, and local Dockerfile building
- **Follow-up**: Added comprehensive image source configuration with support for Dockerfile building, ECR images, and external registries

#### 14. Missing Mandatory Image Parameters in Help Documentation - User Experience Mistake
- **Mistake**: Help documentation did not include mandatory image configuration parameters
- **Issue**: User correctly pointed out that images are mandatory for ECS but help showed no image parameters
- **Problem**: Help documentation was missing critical image configuration options:
  - `imageSource` parameter
  - `dockerfilePath` parameter  
  - `buildArgs` parameter
  - `externalImageUri` parameter
- **Anti-Pattern**: 
  ```bash
  # WRONG - Help showed no image parameters
  cdk deploy -c vpcId=vpc-12345678 -c subnetIds=subnet-12345678
  # Missing: -c imageSource=ecr -c repositoryName=myapp -c tag=latest
  ```
- **Correct Approach**:
  ```bash
  # RIGHT - Help now shows mandatory image parameters
  cdk deploy -c vpcId=vpc-12345678 -c subnetIds=subnet-12345678 \
    -c imageSource=ecr -c repositoryName=myapp -c tag=latest
  ```
- **Lesson**: When implementing mandatory features, ensure help documentation clearly shows all required parameters. Images are fundamental to ECS - this cannot be hidden or optional
- **Requirement**: All mandatory parameters must be prominently displayed in help documentation with clear examples
- **Follow-up**: Added comprehensive image configuration section to help with examples for ECR, Dockerfile, and external registry images

#### 15. Overcomplicated Image Configuration - Unnecessary Complexity Mistake
- **Mistake**: Created complex `imageSource` parameter with multiple options when a simple `image` parameter would suffice
- **Issue**: User correctly questioned whether the complex approach was necessary
- **Problem**: 
  ```bash
  # WRONG - Overcomplicated approach
  -c imageSource=ecr -c repositoryName=myapp -c tag=latest
  -c imageSource=dockerfile -c dockerfilePath=./Dockerfile
  -c imageSource=external -c externalImageUri=nginx:alpine
  ```
- **Correct Approach**:
  ```bash
  # RIGHT - Simple, intuitive approach
  -c image=123456789012.dkr.ecr.us-west-2.amazonaws.com/myapp:latest
  -c image=./Dockerfile
  -c image=nginx:alpine
  ```
- **Lesson**: Don't overcomplicate simple things. A single `image` parameter that accepts any image URI or Dockerfile path is much more intuitive and follows Docker conventions
- **Requirement**: Keep configuration simple and intuitive. When multiple parameters can be replaced with one, do it
- **Follow-up**: Simplified to single `image` parameter with automatic detection of Containerfile vs image URI, and highlighted pre-built images as recommended approach

#### 16. Using "Dockerfile" Instead of "Containerfile" - Terminology Accuracy Mistake
- **Mistake**: Used "Dockerfile" terminology instead of the more accurate "Containerfile"
- **Issue**: User correctly pointed out that "Containerfile" is more accurate and follows modern container standards
- **Problem**: 
  ```bash
  # WRONG - Docker-specific terminology
  -c image=./Dockerfile
  -c dockerfilePath=./Dockerfile
  ```
- **Correct Approach**:
  ```bash
  # RIGHT - Container-agnostic terminology
  -c image=./Containerfile
  -c containerfilePath=./Containerfile
  ```
- **Lesson**: Use container-agnostic terminology when possible. "Containerfile" is more accurate than "Dockerfile" as it's not tied to Docker specifically
- **Requirement**: Follow modern container standards and use accurate terminology
- **Follow-up**: Updated all references from "Dockerfile" to "Containerfile" throughout code and documentation

#### 18. Implementing Values Files Without Proper CLI Integration - Implementation Mistake
- **Mistake**: Added values file support but didn't implement proper CLI integration for `--values` flag
- **Issue**: The `--values` flag mentioned in documentation doesn't actually work in the current implementation
- **Problem**: 
  ```bash
  # WRONG - This won't work yet
  AWS_PROFILE=dev cdk deploy --values values.yaml
  ```
- **Correct Approach**: Use context parameters instead: `-c valuesFile=values.yaml`
- **Lesson**: Don't document features that aren't implemented yet. Either implement the CLI integration or use existing context parameter approach
- **Requirement**: Ensure all documented features are actually implemented and tested
- **Follow-up**: Updated documentation to use context parameters: `-c valuesFile=values.yaml`

#### 19. Multi-Format Support Without Dependencies - Dependency Management Mistake
- **Mistake**: Added YAML support without ensuring js-yaml dependency is available
- **Issue**: Code references `js-yaml` but dependency might not be installed
- **Problem**: 
  ```typescript
  // WRONG - Dependency might not be available
  const yaml = require('js-yaml');
  return yaml.load(fileContent) as ValuesFile;
  ```
- **Correct Approach**: Added graceful fallback with try-catch
- **Lesson**: When adding new dependencies, ensure they're properly installed and handled
- **Requirement**: All dependencies must be available or gracefully handled
- **Follow-up**: Implemented graceful fallback - if js-yaml not available, falls back to JSON parsing

#### 20. Graceful Dependency Handling - Robust Implementation Pattern
- **Implementation**: Added try-catch for YAML parsing with fallback to JSON
- **Benefit**: System works even without js-yaml dependency installed
- **Pattern**: 
  ```typescript
  try {
    const yaml = require('js-yaml');
    return yaml.load(fileContent) as ValuesFile;
  } catch (yamlError) {
    console.warn(`⚠️  Warning: js-yaml not available, falling back to JSON`);
    return JSON.parse(fileContent) as ValuesFile;
  }
  ```
- **Lesson**: Always provide graceful fallbacks for optional dependencies
- **Requirement**: System should work with minimal dependencies
- **Follow-up**: Users can install js-yaml for YAML support or use JSON/JS files

#### 21. Pure CDK Approach - Helm-style Values Files via Context Parameters
- **Implementation**: Use CDK's native context parameters for Helm-style values file support
- **Pattern**: `-c valuesFile=values.yaml` instead of fake `--values` flag
- **Benefit**: Pure CDK invocation without wrapper scripts or custom CLI parsing
- **Correct Approach**:
  ```bash
  # Values file only (Helm-style)
  AWS_PROFILE=dev cdk deploy -c valuesFile=values.yaml
  
  # Values file with overrides (Helm-style)
  AWS_PROFILE=dev cdk deploy -c valuesFile=values.yaml -c image=nginx:latest
  
  # Context parameters only
  AWS_PROFILE=dev cdk deploy -c vpcId=vpc-12345678 -c image=nginx:alpine
  ```
- **Anti-Pattern**: 
  ```bash
  # WRONG - Fake --values flag that doesn't exist
  cdk deploy --values values.yaml
  ```
- **Lesson**: Don't implement fake CLI flags. Use CDK's native context parameter system for all configuration
- **Requirement**: All configuration must use CDK's native mechanisms (context parameters, environment variables)
- **Follow-up**: Removed wrapper script approach and updated all documentation to use `-c valuesFile=values.yaml`

#### 22. Leaving TypeScript Compilation Artifacts - Build Cleanup Mistake
- **Mistake**: Left TypeScript compilation artifacts (`.js`, `.d.ts` files) scattered throughout the project
- **Issue**: Created compilation mess with files in `lib/`, `bin/`, `example/` directories
- **Problem**: 
  ```bash
  # WRONG - Compilation artifacts left behind
  ./lib/help.js
  ./lib/ecs-service-stack.d.ts
  ./bin/cdk.d.ts
  ./example/app.js
  ./example/app.d.ts
  ```
- **Correct Approach**: 
  ```bash
  # RIGHT - Clean build artifacts
  rm -rf lib/ example/app.js example/app.d.ts bin/cdk.d.ts
  ```
- **Lesson**: Always clean up compilation artifacts. Don't leave `.js` and `.d.ts` files scattered around the project
- **Requirement**: Keep project clean - compilation artifacts should be in designated output directory only
- **Follow-up**: Cleaned up all compilation artifacts and ensured proper TypeScript configuration

#### 17. Incomplete Commit - Left Structural Changes Uncommitted
- **Mistake**: Committed only session-specific changes while leaving structural project changes uncommitted
- **Issue**: User correctly pointed out that git diff still showed changes after commit
- **Problem**: 
  ```bash
  # WRONG - Only committed session changes
  git add src/ecs-service-stack.ts src/help.ts src/config.ts context.md README.md
  git commit -m "refactor: use Containerfile terminology..."
  # Left uncommitted: bin/cdk.ts (deleted), lib/ecs-service-stack.ts (deleted), cdk.json (modified), etc.
  ```
- **Correct Approach**:
  ```bash
  # RIGHT - Commit all related changes together
  git add .
  git commit -m "refactor: restructure project and update Containerfile terminology"
  ```
- **Lesson**: When making changes that affect project structure, commit all related changes together. Don't leave structural changes uncommitted while only committing specific file modifications
- **Requirement**: Always check git status and git diff before committing to ensure all related changes are included
- **Follow-up**: Need to either commit the structural changes or restore them based on user preference

#### 23. CDK Directory Structure Standard - Non-Negotiable Requirement
- **Requirement**: MUST follow CDK standard directory structure without deviation
- **Standard Structure**:
  ```
  bin/cdk.ts          # CDK app entry point
  lib/                 # CDK constructs and utilities
  dist/                # Compiled output (outDir)
  cdk.json            # CDK configuration
  ```
- **Non-Negotiable**: 
  - `bin/` contains CDK app entry point
  - `lib/` contains CDK constructs
  - `outDir` must be `dist/` to avoid conflicts with source `lib/`
  - NEVER deviate from this structure
- **Anti-Patterns**:
  ```bash
  # WRONG - Don't use src/ for CDK constructs
  src/ecs-service-stack.ts
  
  # WRONG - Don't compile to lib/ (conflicts with source)
  "outDir": "lib"
  
  # WRONG - Don't put CDK app in src/
  src/bin/cdk.ts
  ```
- **Correct Pattern**:
  ```bash
  # RIGHT - Standard CDK structure
  bin/cdk.ts
  lib/ecs-service-stack.ts
  tsconfig.json: "outDir": "dist"
  ```
- **Lesson**: CDK has established conventions. Follow them exactly. Don't try to be clever with directory structure
- **Requirement**: All future changes must maintain this exact structure
- **Follow-up**: Project now follows CDK standard structure correctly

#### 24. Fixed VPC Availability Zones - Configuration Issue
- **Fix**: Made VPC availability zones configurable instead of hardcoded
- **Issue**: VPC import was using hardcoded `['us-west-2a', 'us-west-2b']` which doesn't work for other regions
- **Solution**: Added `availabilityZones` context parameter with fallback to `['us-west-2a', 'us-west-2b', 'us-west-2c']`
- **Implementation**: 
  ```typescript
  const availabilityZones = this.getContextValue('availabilityZones', config.availabilityZones) || 
    ['us-west-2a', 'us-west-2b', 'us-west-2c'];
  ```
- **Usage**: `--context availabilityZones=us-east-1a,us-east-1b,us-east-1c`

#### 25. Fixed Security Group Configuration - Network Security Issue
- **Fix**: Improved security group rule management for load balancer
- **Issue**: Security group logic only added rules but didn't properly handle default 0.0.0.0/0 rule
- **Solution**: Added proper rule management that removes default rules when specific CIDR is provided
- **Implementation**: Enhanced `configureSecurityGroup()` method with better rule handling

#### 26. Fixed Numeric Value Parsing - Type Safety Issue
- **Fix**: Added proper validation for numeric context values
- **Issue**: `parseInt()` could return `NaN` without validation
- **Solution**: Added validation to ensure numeric values are valid before returning
- **Implementation**: Enhanced `getNumericContextValue()` with NaN checking and warning messages

#### 27. Fixed Service Discovery Integration - Feature Completion Issue
- **Fix**: Actually integrated service discovery with ECS service
- **Issue**: Service discovery was created but never associated with the ECS service
- **Solution**: Added `this.service.addServiceDiscovery(serviceDiscoveryService)` to associate them
- **Implementation**: Modified `configureServiceDiscovery()` to properly link service discovery with ECS service

#### 28. Improved Error Handling - Debugging Issue
- **Fix**: Added proper error logging for environment variables and secrets parsing
- **Issue**: Silent error swallowing made debugging difficult
- **Solution**: Added warning messages for parsing failures
- **Implementation**: Enhanced `parseEnvironmentVariables()` and `parseSecrets()` with proper error logging

#### 29. Fixed Values File Format Inconsistencies - Testing and Documentation Issue
- **Fix**: Updated tests and examples to use correct `-c valuesFile=` format instead of non-existent `--values` flag
- **Issue**: Tests and examples were still using `--values` flag which doesn't exist in the implementation
- **Problem**: 
  ```bash
  # WRONG - Tests and examples were using this
  cdk deploy --values values.yaml
  ```
- **Solution**: Updated all tests and examples to use the correct format:
  ```bash
  # RIGHT - Correct format
  cdk deploy -c valuesFile=values.yaml
  ```
- **Files Fixed**:
  - `test/helm-style-cli.test.ts` - Updated all test cases
  - `examples/values-dev.yaml` - Updated usage comment
  - `examples/values-prod.yaml` - Updated usage comment
- **Lesson**: When changing CLI interfaces, must update ALL related components: tests, examples, documentation
- **Requirement**: Always test as you go and ensure all components are consistent
- **Follow-up**: All values file usage now consistently uses `-c valuesFile=` format
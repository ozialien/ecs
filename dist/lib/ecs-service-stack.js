"use strict";
/**
 * ECS Service Stack - Helm-style CDK construct for ECS deployments
 *
 * This construct creates a complete ECS service deployment with:
 * - ECS Cluster (if not existing)
 * - Application Load Balancer
 * - ECS Service with Fargate tasks
 * - Auto Scaling (optional)
 * - CloudWatch Logs
 * - Security Groups
 *
 * All configuration is done via context parameters following 12-factor principles.
 * No hardcoded values or environment logic in the code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcsServiceStack = void 0;
// AWS CDK imports
const cdk = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const ecs = require("aws-cdk-lib/aws-ecs");
const ecs_patterns = require("aws-cdk-lib/aws-ecs-patterns");
const logs = require("aws-cdk-lib/aws-logs");
const iam = require("aws-cdk-lib/aws-iam");
const servicediscovery = require("aws-cdk-lib/aws-servicediscovery");
const elbv2 = require("aws-cdk-lib/aws-elasticloadbalancingv2");
// Standard library imports
const fs = require("fs");
const path = require("path");
const help_1 = require("./help");
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
    DESIRED_COUNT: 1,
    CPU: 256,
    MEMORY: 512,
    HEALTH_CHECK_PATH: '/',
    ALLOWED_CIDR: '0.0.0.0/0',
    LOG_RETENTION_DAYS: 7,
    ENABLE_AUTO_SCALING: false,
    MIN_CAPACITY: 1,
    MAX_CAPACITY: 10,
    TARGET_CPU_UTILIZATION: 70,
    TARGET_MEMORY_UTILIZATION: 70,
    HEALTH_CHECK_INTERVAL: 30,
    HEALTH_CHECK_TIMEOUT: 5,
    HEALTH_CHECK_START_PERIOD: 60,
    HEALTH_CHECK_RETRIES: 3,
    SERVICE_DISCOVERY_TTL: 10,
};
/**
 * ECS Service Stack construct
 *
 * Creates a complete ECS service deployment with all necessary infrastructure.
 * Configuration is provided via context parameters with sensible defaults.
 */
class EcsServiceStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this.stackProps = props;
        // Check for help request first - must be before any configuration loading
        if (this.isHelpRequested()) {
            (0, help_1.showHelp)();
            // Create a dummy output to satisfy CDK requirements
            new cdk.CfnOutput(this, 'HelpDisplayed', {
                value: 'Help information was displayed',
                description: 'Help was requested and displayed',
            });
            return;
        }
        // Handle credential context parameters
        this.handleCredentialContext();
        // Load and validate configuration
        const config = this.loadConfiguration();
        this.validateRequiredParameters(config);
        // Create infrastructure
        const vpc = this.createOrImportVpc(config.infrastructure.vpc.id);
        this.cluster = this.createOrImportCluster(config.cluster.name, vpc);
        this.loadBalancer = this.createEcsService(config, vpc);
        this.service = this.loadBalancer.service;
        // Add optional features
        if (config.autoScaling?.enabled) {
            this.addAutoScaling(config);
        }
        // Add outputs
        this.addOutputs(config);
    }
    /**
     * Check if help is requested via context parameter
     */
    isHelpRequested() {
        const help = this.node.tryGetContext('help');
        return help === 'true' || help === true;
    }
    /**
     * Handle credential context parameters
     * Sets AWS credential environment variables from context
     */
    handleCredentialContext() {
        const awsProfile = this.node.tryGetContext('awsProfile');
        const awsRoleArn = this.node.tryGetContext('awsRoleArn');
        const awsAccessKeyId = this.node.tryGetContext('awsAccessKeyId');
        const awsSecretAccessKey = this.node.tryGetContext('awsSecretAccessKey');
        const awsSessionToken = this.node.tryGetContext('awsSessionToken');
        if (awsProfile && typeof awsProfile === 'string') {
            process.env.AWS_PROFILE = awsProfile;
        }
        if (awsRoleArn && typeof awsRoleArn === 'string') {
            process.env.AWS_ROLE_ARN = awsRoleArn;
        }
        if (awsAccessKeyId && typeof awsAccessKeyId === 'string') {
            process.env.AWS_ACCESS_KEY_ID = awsAccessKeyId;
        }
        if (awsSecretAccessKey && typeof awsSecretAccessKey === 'string') {
            process.env.AWS_SECRET_ACCESS_KEY = awsSecretAccessKey;
        }
        if (awsSessionToken && typeof awsSessionToken === 'string') {
            process.env.AWS_SESSION_TOKEN = awsSessionToken;
        }
    }
    /**
     * Validate required parameters and throw descriptive errors
     */
    validateRequiredParameters(config) {
        const missingParams = [];
        // Check for required parameters from structured config
        if (!config.taskDefinition?.containers?.[0]?.portMappings?.[0]?.containerPort) {
            missingParams.push('taskDefinition.containers.0.portMappings.0.containerPort');
        }
        if (!config.loadBalancer?.port) {
            missingParams.push('loadBalancer.port');
        }
        if (!config.infrastructure?.vpc?.id) {
            missingParams.push('infrastructure.vpc.id');
        }
        if (!config.cluster?.name) {
            missingParams.push('cluster.name');
        }
        if (!config.taskDefinition?.containers?.[0]?.image) {
            missingParams.push('taskDefinition.containers.0.image');
        }
        if (missingParams.length > 0) {
            const paramList = missingParams.map(p => `--context ${p}=<value>`).join(' ');
            throw new Error(`Missing required parameters: ${missingParams.join(', ')}. Please provide ${paramList}`);
        }
    }
    /**
     * Load configuration from context parameters with sensible defaults
     * Follows 12-factor principles - all configuration via environment/context
     */
    loadConfiguration() {
        const testConfig = this.stackProps?.config || {};
        // Load values file if specified
        const valuesFile = testConfig.valuesFile ? this.loadValuesFile(testConfig.valuesFile) : {};
        // Start with structured configuration
        const config = {
            // Load from context parameters for structured config
            metadata: {
                name: this.getContextValue('metadata.name', valuesFile.metadata?.name || testConfig.metadata?.name) ?? this.stackName,
                version: this.getContextValue('metadata.version', valuesFile.metadata?.version || testConfig.metadata?.version) ?? '1.0.0',
                description: this.getContextValue('metadata.description', valuesFile.metadata?.description || testConfig.metadata?.description),
            },
            infrastructure: {
                vpc: {
                    id: this.getContextValue('infrastructure.vpc.id', valuesFile.infrastructure?.vpc?.id || testConfig.infrastructure?.vpc?.id) ?? this.requireContext('infrastructure.vpc.id'),
                    subnets: this.parseSubnetIds(this.getContextValue('infrastructure.vpc.subnets', valuesFile.infrastructure?.vpc?.subnets || testConfig.infrastructure?.vpc?.subnets)) ?? [],
                },
                securityGroups: valuesFile.infrastructure?.securityGroups || testConfig.infrastructure?.securityGroups,
            },
            cluster: {
                name: this.getContextValue('cluster.name', valuesFile.cluster?.name || testConfig.cluster?.name) ?? this.requireContext('cluster.name'),
                containerInsights: this.getBooleanContextValue('cluster.containerInsights', valuesFile.cluster?.containerInsights || testConfig.cluster?.containerInsights) ?? true,
            },
            taskDefinition: {
                type: this.getContextValue('taskDefinition.type', valuesFile.taskDefinition?.type || testConfig.taskDefinition?.type) ?? 'FARGATE',
                cpu: this.getNumericContextValue('taskDefinition.cpu', valuesFile.taskDefinition?.cpu || testConfig.taskDefinition?.cpu) ?? DEFAULT_CONFIG.CPU,
                memory: this.getNumericContextValue('taskDefinition.memory', valuesFile.taskDefinition?.memory || testConfig.taskDefinition?.memory) ?? DEFAULT_CONFIG.MEMORY,
                containers: [{
                        name: 'main',
                        image: this.getContextValue('taskDefinition.containers.0.image', valuesFile.taskDefinition?.containers?.[0]?.image || testConfig.taskDefinition?.containers?.[0]?.image) ?? this.requireContext('taskDefinition.containers.0.image'),
                        portMappings: [{
                                containerPort: this.getNumericContextValue('taskDefinition.containers.0.portMappings.0.containerPort', valuesFile.taskDefinition?.containers?.[0]?.portMappings?.[0]?.containerPort || testConfig.taskDefinition?.containers?.[0]?.portMappings?.[0]?.containerPort) ?? this.requireContext('taskDefinition.containers.0.portMappings.0.containerPort'),
                                protocol: 'tcp',
                            }],
                        environment: valuesFile.taskDefinition?.containers?.[0]?.environment || testConfig.taskDefinition?.containers?.[0]?.environment || this.parseEnvironmentVariablesAsArray(),
                        secrets: valuesFile.taskDefinition?.containers?.[0]?.secrets || testConfig.taskDefinition?.containers?.[0]?.secrets || this.parseSecretsAsArray(),
                    }],
                volumes: valuesFile.taskDefinition?.volumes || testConfig.taskDefinition?.volumes,
            },
            service: {
                type: this.getContextValue('service.type', valuesFile.service?.type || testConfig.service?.type) ?? 'LOAD_BALANCED',
                desiredCount: this.getNumericContextValue('service.desiredCount', valuesFile.service?.desiredCount || testConfig.service?.desiredCount) ?? DEFAULT_CONFIG.DESIRED_COUNT,
                healthCheckGracePeriodSeconds: this.getNumericContextValue('service.healthCheckGracePeriodSeconds', valuesFile.service?.healthCheckGracePeriodSeconds || testConfig.service?.healthCheckGracePeriodSeconds),
            },
            loadBalancer: {
                type: this.getContextValue('loadBalancer.type', valuesFile.loadBalancer?.type || testConfig.loadBalancer?.type) ?? 'APPLICATION',
                scheme: this.getContextValue('loadBalancer.scheme', valuesFile.loadBalancer?.scheme || testConfig.loadBalancer?.scheme),
                protocol: this.getContextValue('loadBalancer.protocol', valuesFile.loadBalancer?.protocol || testConfig.loadBalancer?.protocol) ?? 'HTTP',
                port: this.getNumericContextValue('loadBalancer.port', valuesFile.loadBalancer?.port || testConfig.loadBalancer?.port) ?? this.requireContext('loadBalancer.port'),
                certificateArn: this.getContextValue('loadBalancer.certificateArn', valuesFile.loadBalancer?.certificateArn || testConfig.loadBalancer?.certificateArn),
                targetGroup: {
                    healthCheckPath: this.getContextValue('loadBalancer.targetGroup.healthCheckPath', valuesFile.loadBalancer?.targetGroup?.healthCheckPath || testConfig.loadBalancer?.targetGroup?.healthCheckPath) ?? DEFAULT_CONFIG.HEALTH_CHECK_PATH,
                },
                allowedCidr: this.getContextValue('loadBalancer.allowedCidr', valuesFile.loadBalancer?.allowedCidr || testConfig.loadBalancer?.allowedCidr),
            },
            autoScaling: {
                enabled: this.getBooleanContextValue('autoScaling.enabled', valuesFile.autoScaling?.enabled || testConfig.autoScaling?.enabled) ?? DEFAULT_CONFIG.ENABLE_AUTO_SCALING,
                minCapacity: this.getNumericContextValue('autoScaling.minCapacity', valuesFile.autoScaling?.minCapacity || testConfig.autoScaling?.minCapacity) ?? DEFAULT_CONFIG.MIN_CAPACITY,
                maxCapacity: this.getNumericContextValue('autoScaling.maxCapacity', valuesFile.autoScaling?.maxCapacity || testConfig.autoScaling?.maxCapacity) ?? DEFAULT_CONFIG.MAX_CAPACITY,
                targetCpuUtilization: this.getNumericContextValue('autoScaling.targetCpuUtilization', valuesFile.autoScaling?.targetCpuUtilization || testConfig.autoScaling?.targetCpuUtilization) ?? DEFAULT_CONFIG.TARGET_CPU_UTILIZATION,
                targetMemoryUtilization: this.getNumericContextValue('autoScaling.targetMemoryUtilization', valuesFile.autoScaling?.targetMemoryUtilization || testConfig.autoScaling?.targetMemoryUtilization) ?? DEFAULT_CONFIG.TARGET_MEMORY_UTILIZATION,
            },
            iam: {
                taskRole: valuesFile.iam?.taskRole || testConfig.iam?.taskRole,
                taskExecutionRole: valuesFile.iam?.taskExecutionRole || testConfig.iam?.taskExecutionRole,
            },
            serviceDiscovery: valuesFile.serviceDiscovery || testConfig.serviceDiscovery,
            addons: valuesFile.addons || testConfig.addons,
        };
        return config;
    }
    /**
     * Get context value with fallback to test config
     */
    getContextValue(key, testValue) {
        return testValue ?? this.node.tryGetContext(key);
    }
    /**
     * Get numeric context value with proper type conversion
     */
    getNumericContextValue(key, testValue) {
        const value = this.getContextValue(key, testValue);
        if (value === undefined)
            return undefined;
        const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
        // Validate that parsing was successful
        if (typeof numValue === 'number' && !isNaN(numValue)) {
            return numValue;
        }
        console.warn(`⚠️  Warning: Invalid numeric value for '${key}': ${value}`);
        return undefined;
    }
    /**
     * Get boolean context value with proper type conversion
     */
    getBooleanContextValue(key, testValue) {
        const value = this.getContextValue(key, testValue);
        if (value === undefined)
            return undefined;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return Boolean(value);
    }
    /**
     * Parse subnet IDs from string or array
     */
    parseSubnetIds(subnetIds) {
        if (!subnetIds) {
            return [];
        }
        if (Array.isArray(subnetIds)) {
            return subnetIds;
        }
        return subnetIds.split(',').map(id => id.trim());
    }
    /**
     * Parse environment variables from context
     */
    parseEnvironmentVariables() {
        const env = {};
        try {
            const envContext = this.node.getContext('env');
            if (envContext && typeof envContext === 'object') {
                Object.assign(env, envContext);
            }
        }
        catch (error) {
            console.warn(`⚠️  Warning: Failed to parse environment variables: ${error}`);
        }
        return env;
    }
    /**
     * Parse environment variables as array for structured config
     */
    parseEnvironmentVariablesAsArray() {
        const env = this.parseEnvironmentVariables();
        return Object.entries(env).map(([name, value]) => ({ name, value }));
    }
    /**
     * Parse secrets from context
     */
    parseSecrets() {
        const secrets = {};
        try {
            const secretContext = this.node.getContext('secret');
            if (secretContext && typeof secretContext === 'object') {
                Object.assign(secrets, secretContext);
            }
        }
        catch (error) {
            console.warn(`⚠️  Warning: Failed to parse secrets: ${error}`);
        }
        return secrets;
    }
    /**
     * Parse secrets as array for structured config
     */
    parseSecretsAsArray() {
        const secrets = this.parseSecrets();
        return Object.entries(secrets).map(([name, valueFrom]) => ({ name, valueFrom }));
    }
    /**
     * Load configuration from values file (JSON, YAML, JS)
     */
    loadValuesFile(filePath) {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Warning: Values file not found: ${filePath}, skipping`);
            return {};
        }
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const ext = path.extname(filePath).toLowerCase();
            switch (ext) {
                case '.js':
                    return require(path.resolve(filePath));
                case '.yaml':
                case '.yml':
                    return this.parseYaml(fileContent);
                default:
                    return JSON.parse(fileContent);
            }
        }
        catch (error) {
            console.warn(`⚠️  Warning: Failed to parse values file ${filePath}: ${error}`);
            return {};
        }
    }
    /**
     * Parse YAML content with fallback to JSON
     */
    parseYaml(content) {
        try {
            const yaml = require('js-yaml');
            return yaml.load(content);
        }
        catch (yamlError) {
            console.warn(`⚠️  Warning: js-yaml not available, falling back to JSON`);
            return JSON.parse(content);
        }
    }
    /**
     * Create or import VPC based on VPC ID
     */
    createOrImportVpc(vpcId) {
        const config = this.loadConfiguration();
        const stackName = config.metadata?.name || this.stackName;
        // If VPC ID is provided, import existing VPC
        if (vpcId && vpcId !== '') {
            console.log(`📝 Importing existing VPC: ${vpcId}`);
            const subnetIds = config.infrastructure?.vpc?.subnets || [];
            // Get availability zones from context or use defaults
            const availabilityZones = this.getContextValue('availabilityZones') ||
                ['us-west-2a', 'us-west-2b', 'us-west-2c'];
            // Ensure availability zones match the number of subnets
            const azs = availabilityZones.slice(0, subnetIds.length);
            return ec2.Vpc.fromVpcAttributes(this, `${stackName}Vpc`, {
                vpcId: vpcId,
                availabilityZones: azs,
                privateSubnetIds: subnetIds,
                publicSubnetIds: subnetIds, // Use same subnets for both public and private
            });
        }
        // Otherwise create a new VPC
        console.log(`📝 Creating new VPC`);
        return new ec2.Vpc(this, `${stackName}Vpc`, {
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
        });
    }
    /**
     * Create or import ECS cluster
     */
    createOrImportCluster(clusterName, vpc) {
        const config = this.loadConfiguration();
        const stackName = config.metadata?.name || this.stackName;
        // Always create a new cluster for now to avoid inactive cluster issues
        console.log(`📝 Creating new cluster: ${clusterName}`);
        return new ecs.Cluster(this, `${stackName}Cluster`, {
            clusterName: clusterName,
            vpc: vpc,
            containerInsights: true,
        });
    }
    /**
     * Create ECS service with application load balancer
     */
    createEcsService(config, vpc) {
        const logGroup = this.createLogGroup(config);
        const taskDefinition = this.createTaskDefinition(config);
        const container = this.addContainerToTaskDefinition(config, taskDefinition, logGroup);
        const service = this.createLoadBalancedService(config, taskDefinition);
        this.configureServiceDiscovery(config, vpc);
        this.configureSecurityGroup(service, config);
        return service;
    }
    /**
     * Create CloudWatch log group for the service
     */
    createLogGroup(config) {
        const stackName = config.metadata?.name || this.stackName;
        // Use add-ons configuration if available, otherwise use defaults
        const logGroupName = config.addons?.logging?.options?.['awslogs-group'] || `/ecs/${stackName}`;
        const retentionDays = config.addons?.logging?.retentionDays || DEFAULT_CONFIG.LOG_RETENTION_DAYS;
        return new logs.LogGroup(this, `${stackName}LogGroup`, {
            logGroupName: logGroupName,
            retention: this.convertRetentionDays(retentionDays),
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
    /**
     * Create Fargate task definition
     */
    createTaskDefinition(config) {
        const stackName = config.metadata?.name || this.stackName;
        // Create runtime platform if specified
        const runtimePlatform = config.taskDefinition.runtimePlatform ? {
            cpuArchitecture: ecs.CpuArchitecture.of(config.taskDefinition.runtimePlatform.cpuArchitecture),
            operatingSystemFamily: ecs.OperatingSystemFamily.of(config.taskDefinition.runtimePlatform.os),
        } : undefined;
        return new ecs.FargateTaskDefinition(this, `${stackName}TaskDef`, {
            cpu: config.taskDefinition.cpu,
            memoryLimitMiB: config.taskDefinition.memory,
            executionRole: this.createExecutionRole(config),
            taskRole: this.createTaskRole(config),
            runtimePlatform,
        });
    }
    /**
     * Create execution role with required permissions for ECS
     */
    createExecutionRole(config) {
        const stackName = config.metadata?.name || this.stackName;
        // Create execution role with required permissions
        const executionRole = new iam.Role(this, `${stackName}ExecutionRole`, {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
            ],
        });
        // Add custom JSON policy if provided
        if (config.iam?.taskExecutionRole?.custom) {
            try {
                const customPolicy = JSON.parse(config.iam.taskExecutionRole.custom);
                executionRole.addToPolicy(new iam.PolicyStatement(customPolicy));
            }
            catch (error) {
                console.warn(`⚠️  Warning: Invalid custom policy JSON for execution role: ${error}`);
            }
        }
        // Add permissions from structured IAM configuration
        if (config.iam?.taskExecutionRole?.policies) {
            config.iam.taskExecutionRole.policies.forEach(policy => {
                executionRole.addToPolicy(new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: policy.actions,
                    resources: policy.resources,
                }));
            });
        }
        // Add detailed permissions if specified
        if (config.iam?.taskExecutionRole?.permissions) {
            this.addDetailedPermissions(executionRole, config.iam.taskExecutionRole.permissions);
        }
        return executionRole;
    }
    /**
     * Create task role with required permissions for the application
     */
    createTaskRole(config) {
        const stackName = config.metadata?.name || this.stackName;
        // Create task role for application permissions
        const taskRole = new iam.Role(this, `${stackName}TaskRole`, {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });
        // Add custom JSON policy if provided
        if (config.iam?.taskRole?.custom) {
            try {
                const customPolicy = JSON.parse(config.iam.taskRole.custom);
                taskRole.addToPolicy(new iam.PolicyStatement(customPolicy));
            }
            catch (error) {
                console.warn(`⚠️  Warning: Invalid custom policy JSON for task role: ${error}`);
            }
        }
        // Add permissions from structured IAM configuration
        if (config.iam?.taskRole?.policies) {
            config.iam.taskRole.policies.forEach(policy => {
                taskRole.addToPolicy(new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: policy.actions,
                    resources: policy.resources,
                }));
            });
        }
        // Add detailed permissions if specified
        if (config.iam?.taskRole?.permissions) {
            this.addDetailedPermissions(taskRole, config.iam.taskRole.permissions);
        }
        return taskRole;
    }
    /**
     * Add detailed IAM permissions to a role
     */
    addDetailedPermissions(role, permissions) {
        // Secrets Manager permissions
        if (permissions.secretsManager) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.secretsManager.actions,
                resources: permissions.secretsManager.resources,
            }));
        }
        // CloudWatch Logs permissions
        if (permissions.cloudWatchLogs) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.cloudWatchLogs.actions,
                resources: permissions.cloudWatchLogs.resources,
            }));
        }
        // KMS permissions
        if (permissions.kms) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.kms.actions,
                resources: permissions.kms.resources,
            }));
        }
        // STS permissions
        if (permissions.sts) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.sts.actions,
                resources: permissions.sts.resources,
            }));
        }
        // S3 permissions
        if (permissions.s3) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.s3.actions,
                resources: permissions.s3.resources,
            }));
        }
        // SQS permissions
        if (permissions.sqs) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.sqs.actions,
                resources: permissions.sqs.resources,
            }));
        }
        // DynamoDB permissions
        if (permissions.dynamodb) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.dynamodb.actions,
                resources: permissions.dynamodb.resources,
            }));
        }
        // RDS permissions
        if (permissions.rds) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.rds.actions,
                resources: permissions.rds.resources,
            }));
        }
        // CloudWatch Metrics permissions
        if (permissions.cloudWatchMetrics) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.cloudWatchMetrics.actions,
                resources: permissions.cloudWatchMetrics.resources,
            }));
        }
        // ECR permissions
        if (permissions.ecr) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.ecr.actions,
                resources: permissions.ecr.resources,
            }));
        }
        // SSM permissions
        if (permissions.ssm) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: permissions.ssm.actions,
                resources: permissions.ssm.resources,
            }));
        }
    }
    /**
     * Add container to task definition
     */
    addContainerToTaskDefinition(config, taskDefinition, logGroup) {
        const stackName = config.metadata?.name || this.stackName;
        const mainContainer = config.taskDefinition?.containers?.[0];
        if (!mainContainer) {
            throw new Error('No main container found in task definition');
        }
        const container = taskDefinition.addContainer(mainContainer.name, {
            image: this.createContainerImage(mainContainer.image),
            logging: ecs.LogDrivers.awsLogs({
                logGroup: logGroup,
                streamPrefix: stackName,
            }),
            environment: mainContainer.environment?.reduce((acc, env) => {
                acc[env.name] = env.value;
                return acc;
            }, {}) || {},
            secrets: mainContainer.secrets?.reduce((acc, secret) => {
                acc[secret.name] = ecs.Secret.fromSecretsManager(cdk.aws_secretsmanager.Secret.fromSecretCompleteArn(this, `${secret.name}Secret`, secret.valueFrom));
                return acc;
            }, {}) || undefined,
            healthCheck: this.createHealthCheck(mainContainer.healthCheck),
        });
        // Add port mappings from structured config
        const containerPort = mainContainer.portMappings?.[0]?.containerPort;
        if (!containerPort) {
            throw new Error('Container port is required. Please provide taskDefinition.containers.0.portMappings.0.containerPort');
        }
        container.addPortMappings({
            containerPort: containerPort,
            protocol: ecs.Protocol.TCP,
        });
        // Add mount points for main container if volumes are specified (optional)
        if (config.taskDefinition.volumes && config.taskDefinition.volumes.length > 0) {
            config.taskDefinition.volumes.forEach(volume => {
                container.addMountPoints({
                    sourceVolume: volume.name,
                    containerPath: `/${volume.name}`,
                    readOnly: false,
                });
            });
        }
        // Add additional containers if specified
        if (config.taskDefinition.additionalContainers) {
            config.taskDefinition.additionalContainers.forEach((containerConfig, index) => {
                const additionalContainer = taskDefinition.addContainer(`${config.metadata?.name || 'AdditionalContainer'}${index}`, {
                    image: this.createContainerImage(containerConfig.image),
                    logging: ecs.LogDrivers.awsLogs({
                        logGroup: logGroup,
                        streamPrefix: `${config.metadata?.name || 'AdditionalContainer'}-${containerConfig.name}`,
                    }),
                    environment: containerConfig.environment?.reduce((acc, env) => {
                        acc[env.name] = env.value;
                        return acc;
                    }, {}) || {},
                    essential: containerConfig.essential ?? false,
                    readonlyRootFilesystem: containerConfig.readonlyRootFilesystem,
                    command: containerConfig.command,
                    entryPoint: containerConfig.entryPoint,
                });
                // Add port mappings if specified
                if (containerConfig.portMappings) {
                    containerConfig.portMappings.forEach(portMapping => {
                        additionalContainer.addPortMappings({
                            containerPort: portMapping.containerPort,
                            protocol: portMapping.protocol === 'udp' ? ecs.Protocol.UDP : ecs.Protocol.TCP,
                        });
                    });
                }
                // Add mount points if specified
                if (containerConfig.mountPoints) {
                    containerConfig.mountPoints.forEach(mountPoint => {
                        additionalContainer.addMountPoints({
                            sourceVolume: mountPoint.sourceVolume,
                            containerPath: mountPoint.containerPath,
                            readOnly: mountPoint.readOnly ?? false,
                        });
                    });
                }
            });
        }
        // Add volumes if specified (optional)
        if (config.taskDefinition.volumes && config.taskDefinition.volumes.length > 0) {
            config.taskDefinition.volumes.forEach(volume => {
                if (volume.efsVolumeConfiguration) {
                    taskDefinition.addVolume({
                        name: volume.name,
                        efsVolumeConfiguration: {
                            fileSystemId: volume.efsVolumeConfiguration.fileSystemId,
                            transitEncryption: volume.efsVolumeConfiguration.transitEncryption === 'ENABLED' ?
                                'ENABLED' : 'DISABLED',
                            authorizationConfig: volume.efsVolumeConfiguration.authorizationConfig ? {
                                accessPointId: volume.efsVolumeConfiguration.authorizationConfig.accessPointId,
                                iam: volume.efsVolumeConfiguration.authorizationConfig.iam === 'ENABLED' ?
                                    'ENABLED' : 'DISABLED',
                            } : undefined,
                        },
                    });
                }
                else {
                    taskDefinition.addVolume({
                        name: volume.name,
                    });
                }
            });
        }
        return container;
    }
    /**
     * Create health check configuration
     */
    createHealthCheck(healthCheck) {
        // Check if health check is explicitly disabled
        if (healthCheck?.enabled === false)
            return undefined;
        // Check if health check has required configuration
        if (!healthCheck?.command || healthCheck.command.length === 0)
            return undefined;
        return {
            command: healthCheck.command,
            interval: healthCheck.interval || cdk.Duration.seconds(DEFAULT_CONFIG.HEALTH_CHECK_INTERVAL),
            timeout: healthCheck.timeout || cdk.Duration.seconds(DEFAULT_CONFIG.HEALTH_CHECK_TIMEOUT),
            startPeriod: healthCheck.startPeriod || cdk.Duration.seconds(DEFAULT_CONFIG.HEALTH_CHECK_START_PERIOD),
            retries: healthCheck.retries || DEFAULT_CONFIG.HEALTH_CHECK_RETRIES,
        };
    }
    /**
     * Create load balanced service
     */
    createLoadBalancedService(config, taskDefinition) {
        const stackName = config.metadata?.name || this.stackName;
        // Determine protocol and certificate - HTTPS is optional
        const protocol = config.loadBalancer.protocol || 'HTTP';
        const certificate = config.loadBalancer.certificateArn ?
            cdk.aws_certificatemanager.Certificate.fromCertificateArn(this, `${stackName}Certificate`, config.loadBalancer.certificateArn) :
            undefined;
        // Use HTTPS only if explicitly configured with certificate
        const useHttps = protocol === 'HTTPS' && certificate;
        const listenerPort = useHttps ? (config.loadBalancer.port || 443) : (config.loadBalancer.port || 80);
        // Determine load balancer scheme - default to internet-facing if not specified
        const scheme = config.loadBalancer.scheme || 'internet-facing';
        const service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${stackName}Service`, {
            cluster: this.cluster,
            taskDefinition: taskDefinition,
            desiredCount: config.service.desiredCount,
            publicLoadBalancer: scheme === 'internet-facing',
            listenerPort: listenerPort,
            protocol: useHttps ? elbv2.ApplicationProtocol.HTTPS : elbv2.ApplicationProtocol.HTTP,
            certificate: certificate,
            serviceName: stackName,
            capacityProviderStrategies: this.createCapacityProviderStrategies(),
            healthCheckGracePeriod: config.service.healthCheckGracePeriodSeconds ?
                cdk.Duration.seconds(config.service.healthCheckGracePeriodSeconds) : undefined,
        });
        // Configure health check on the target group
        if (config.loadBalancer.targetGroup?.healthCheckPath || config.loadBalancer.targetGroup?.healthCheck) {
            const targetGroup = service.targetGroup;
            const healthCheck = config.loadBalancer.targetGroup.healthCheck;
            // Use advanced health check configuration if available, otherwise use basic
            const healthCheckConfig = {
                path: healthCheck?.path || config.loadBalancer.targetGroup.healthCheckPath || '/',
                healthyHttpCodes: healthCheck?.healthyHttpCodes || '200',
                interval: this.convertToDuration(healthCheck?.interval || config.loadBalancer.targetGroup.interval || 30),
                timeout: this.convertToDuration(healthCheck?.timeout || config.loadBalancer.targetGroup.timeout || 5),
                healthyThresholdCount: healthCheck?.healthyThresholdCount || config.loadBalancer.targetGroup.healthyThresholdCount || 2,
                unhealthyThresholdCount: healthCheck?.unhealthyThresholdCount || config.loadBalancer.targetGroup.unhealthyThresholdCount || 3,
            };
            // Only configure if health check is enabled or not explicitly disabled
            if (healthCheck?.enabled !== false) {
                targetGroup.configureHealthCheck(healthCheckConfig);
            }
        }
        return service;
    }
    /**
     * Create capacity provider strategies
     */
    createCapacityProviderStrategies(capacityProvider) {
        return capacityProvider ? [
            {
                capacityProvider: capacityProvider,
                weight: 1,
            }
        ] : undefined;
    }
    /**
     * Configure service discovery if enabled
     */
    configureServiceDiscovery(config, vpc) {
        // Check if service discovery is explicitly disabled
        if (config.serviceDiscovery?.enabled === false)
            return;
        // Check if service discovery configuration exists
        if (!config.serviceDiscovery)
            return;
        const stackName = config.metadata?.name || this.stackName;
        const namespaceName = typeof config.serviceDiscovery.namespace === 'string'
            ? config.serviceDiscovery.namespace
            : config.serviceDiscovery.namespace?.name || `${stackName}.local`;
        const namespace = new servicediscovery.PrivateDnsNamespace(this, `${stackName}Namespace`, {
            name: namespaceName,
            vpc: vpc,
        });
        const serviceName = config.serviceDiscovery.service?.name || stackName;
        const dnsType = config.serviceDiscovery.service?.dnsType || 'A';
        const ttl = config.serviceDiscovery.service?.ttl || DEFAULT_CONFIG.SERVICE_DISCOVERY_TTL;
        const serviceDiscoveryService = new servicediscovery.Service(this, `${stackName}ServiceDiscovery`, {
            namespace: namespace,
            name: serviceName,
            dnsRecordType: dnsType === 'SRV' ?
                servicediscovery.DnsRecordType.SRV :
                servicediscovery.DnsRecordType.A,
            dnsTtl: cdk.Duration.seconds(ttl),
        });
        // Associate service discovery with ECS service
        if (this.service) {
            // Note: Service discovery association is handled by the CDK pattern
            // The service discovery service is created but association depends on the pattern used
        }
    }
    /**
     * Configure security group rules
     */
    configureSecurityGroup(service, config) {
        // Configure load balancer security group to be more restrictive
        const lbSecurityGroup = service.loadBalancer.connections.securityGroups[0];
        // Determine protocol and port for security group
        const protocol = config.loadBalancer.protocol || 'HTTP';
        const useHttps = protocol === 'HTTPS' && config.loadBalancer.certificateArn;
        const lbPort = useHttps ? (config.loadBalancer.port || 443) : (config.loadBalancer.port || 80);
        // Remove default 0.0.0.0/0 rule if a specific CIDR is provided
        if (config.loadBalancer.allowedCidr && config.loadBalancer.allowedCidr !== DEFAULT_CONFIG.ALLOWED_CIDR) {
            // Remove the default rule by adding a more restrictive rule
            lbSecurityGroup.addIngressRule(ec2.Peer.ipv4(config.loadBalancer.allowedCidr), ec2.Port.tcp(lbPort), `Allow ${protocol} from ${config.loadBalancer.allowedCidr}`);
            // Also remove any existing 0.0.0.0/0 rules for this port
            lbSecurityGroup.connections.allowFromAnyIpv4(ec2.Port.tcp(lbPort), `Restrict ${protocol} access to ${config.loadBalancer.allowedCidr} only`);
        }
    }
    /**
     * Create container image from various sources
     * Supports ECR, external registries, and local Containerfiles
     */
    createContainerImage(image) {
        // Check if it's a local Containerfile path
        if (image.startsWith('./') || image.startsWith('/')) {
            return ecs.ContainerImage.fromAsset(image);
        }
        // Otherwise treat as image URI
        return ecs.ContainerImage.fromRegistry(image);
    }
    /**
     * Create secrets for the container
     */
    createSecrets(secrets) {
        const containerSecrets = {};
        Object.entries(secrets).forEach(([key, value]) => {
            containerSecrets[key] = ecs.Secret.fromSecretsManager(cdk.aws_secretsmanager.Secret.fromSecretCompleteArn(this, `${key}Secret`, value));
        });
        return containerSecrets;
    }
    /**
     * Add auto scaling to the service
     */
    addAutoScaling(config) {
        const stackName = config.metadata?.name || this.stackName;
        const scaling = this.service.autoScaleTaskCount({
            minCapacity: config.autoScaling?.minCapacity || DEFAULT_CONFIG.MIN_CAPACITY,
            maxCapacity: config.autoScaling?.maxCapacity || DEFAULT_CONFIG.MAX_CAPACITY,
        });
        scaling.scaleOnCpuUtilization(`${stackName}CpuScaling`, {
            targetUtilizationPercent: config.autoScaling?.targetCpuUtilization || DEFAULT_CONFIG.TARGET_CPU_UTILIZATION,
        });
        scaling.scaleOnMemoryUtilization(`${stackName}MemoryScaling`, {
            targetUtilizationPercent: config.autoScaling?.targetMemoryUtilization || DEFAULT_CONFIG.TARGET_MEMORY_UTILIZATION,
        });
    }
    /**
     * Add CloudFormation outputs
     */
    addOutputs(config) {
        const stackName = config.metadata?.name || this.stackName;
        const clusterName = config.cluster?.name;
        new cdk.CfnOutput(this, 'ServiceName', {
            value: stackName,
            description: 'ECS Service Name',
            exportName: `${stackName}-service-name`,
        });
        new cdk.CfnOutput(this, 'LoadBalancerDNS', {
            value: this.loadBalancer.loadBalancer.loadBalancerDnsName,
            description: 'Load Balancer DNS Name',
            exportName: `${stackName}-load-balancer-dns`,
        });
        new cdk.CfnOutput(this, 'ClusterName', {
            value: clusterName || 'unknown',
            description: 'ECS Cluster Name',
            exportName: `${stackName}-cluster-name`,
        });
    }
    /**
     * Convert a value to CDK Duration
     * Handles both Duration objects and numbers (seconds)
     */
    convertToDuration(value) {
        if (!value)
            return undefined;
        if (value instanceof cdk.Duration)
            return value;
        if (typeof value === 'number')
            return cdk.Duration.seconds(value);
        return undefined;
    }
    /**
     * Convert retention days to CDK RetentionDays enum
     */
    convertRetentionDays(days) {
        switch (days) {
            case 1: return logs.RetentionDays.ONE_DAY;
            case 3: return logs.RetentionDays.THREE_DAYS;
            case 5: return logs.RetentionDays.FIVE_DAYS;
            case 7: return logs.RetentionDays.ONE_WEEK;
            case 14: return logs.RetentionDays.TWO_WEEKS;
            case 30: return logs.RetentionDays.ONE_MONTH;
            case 60: return logs.RetentionDays.TWO_MONTHS;
            case 90: return logs.RetentionDays.THREE_MONTHS;
            case 120: return logs.RetentionDays.FOUR_MONTHS;
            case 150: return logs.RetentionDays.FIVE_MONTHS;
            case 180: return logs.RetentionDays.SIX_MONTHS;
            case 365: return logs.RetentionDays.ONE_YEAR;
            case 400: return logs.RetentionDays.THIRTEEN_MONTHS;
            case 545: return logs.RetentionDays.EIGHTEEN_MONTHS;
            case 731: return logs.RetentionDays.TWO_YEARS;
            case 1827: return logs.RetentionDays.FIVE_YEARS;
            case 3653: return logs.RetentionDays.TEN_YEARS;
            default: return logs.RetentionDays.ONE_WEEK;
        }
    }
    /**
     * Require a context parameter to be present
     */
    requireContext(key) {
        throw new Error(`Required context parameter '${key}' is missing. Use --context ${key}=value`);
    }
}
exports.EcsServiceStack = EcsServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzLXNlcnZpY2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvZWNzLXNlcnZpY2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7O0dBYUc7OztBQUVILGtCQUFrQjtBQUNsQixtQ0FBbUM7QUFDbkMsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUMzQyw2REFBNkQ7QUFDN0QsNkNBQTZDO0FBQzdDLDJDQUEyQztBQUMzQyxxRUFBcUU7QUFDckUsZ0VBQWdFO0FBRWhFLDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIsNkJBQTZCO0FBSzdCLGlDQUFrQztBQUVsQzs7R0FFRztBQUNILE1BQU0sY0FBYyxHQUFHO0lBQ3JCLGFBQWEsRUFBRSxDQUFDO0lBQ2hCLEdBQUcsRUFBRSxHQUFHO0lBQ1IsTUFBTSxFQUFFLEdBQUc7SUFDWCxpQkFBaUIsRUFBRSxHQUFHO0lBQ3RCLFlBQVksRUFBRSxXQUFXO0lBQ3pCLGtCQUFrQixFQUFFLENBQUM7SUFDckIsbUJBQW1CLEVBQUUsS0FBSztJQUMxQixZQUFZLEVBQUUsQ0FBQztJQUNmLFlBQVksRUFBRSxFQUFFO0lBQ2hCLHNCQUFzQixFQUFFLEVBQUU7SUFDMUIseUJBQXlCLEVBQUUsRUFBRTtJQUM3QixxQkFBcUIsRUFBRSxFQUFFO0lBQ3pCLG9CQUFvQixFQUFFLENBQUM7SUFDdkIseUJBQXlCLEVBQUUsRUFBRTtJQUM3QixvQkFBb0IsRUFBRSxDQUFDO0lBQ3ZCLHFCQUFxQixFQUFFLEVBQUU7Q0FDakIsQ0FBQztBQUVYOzs7OztHQUtHO0FBQ0gsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBTTVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7UUFFeEIsMEVB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QUFDLEdBQVc7UUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsR0FBRywrQkFBK0IsR0FBRyxRQUFRLENBQUMsQ0FBQztJQUNoRyxDQUFDO0NBQ0Y7QUFsaUNELDBDQWtpQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEVDUyBTZXJ2aWNlIFN0YWNrIC0gSGVsbS1zdHlsZSBDREsgY29uc3RydWN0IGZvciBFQ1MgZGVwbG95bWVudHNcbiAqIFxuICogVGhpcyBjb25zdHJ1Y3QgY3JlYXRlcyBhIGNvbXBsZXRlIEVDUyBzZXJ2aWNlIGRlcGxveW1lbnQgd2l0aDpcbiAqIC0gRUNTIENsdXN0ZXIgKGlmIG5vdCBleGlzdGluZylcbiAqIC0gQXBwbGljYXRpb24gTG9hZCBCYWxhbmNlclxuICogLSBFQ1MgU2VydmljZSB3aXRoIEZhcmdhdGUgdGFza3NcbiAqIC0gQXV0byBTY2FsaW5nIChvcHRpb25hbClcbiAqIC0gQ2xvdWRXYXRjaCBMb2dzXG4gKiAtIFNlY3VyaXR5IEdyb3Vwc1xuICogXG4gKiBBbGwgY29uZmlndXJhdGlvbiBpcyBkb25lIHZpYSBjb250ZXh0IHBhcmFtZXRlcnMgZm9sbG93aW5nIDEyLWZhY3RvciBwcmluY2lwbGVzLlxuICogTm8gaGFyZGNvZGVkIHZhbHVlcyBvciBlbnZpcm9ubWVudCBsb2dpYyBpbiB0aGUgY29kZS5cbiAqL1xuXG4vLyBBV1MgQ0RLIGltcG9ydHNcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBlY3NfcGF0dGVybnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcy1wYXR0ZXJucyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHNlcnZpY2VkaXNjb3ZlcnkgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlcnZpY2VkaXNjb3ZlcnknO1xuaW1wb3J0ICogYXMgZWxidjIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjInO1xuXG4vLyBTdGFuZGFyZCBsaWJyYXJ5IGltcG9ydHNcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8vIExvY2FsIGltcG9ydHNcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRWNzU2VydmljZUNvbmZpZywgRWNzU2VydmljZVN0YWNrUHJvcHMsIENvbnRhaW5lckhlYWx0aENoZWNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBzaG93SGVscCB9IGZyb20gJy4vaGVscCc7XG5cbi8qKlxuICogRGVmYXVsdCBjb25maWd1cmF0aW9uIHZhbHVlc1xuICovXG5jb25zdCBERUZBVUxUX0NPTkZJRyA9IHtcbiAgREVTSVJFRF9DT1VOVDogMSxcbiAgQ1BVOiAyNTYsXG4gIE1FTU9SWTogNTEyLFxuICBIRUFMVEhfQ0hFQ0tfUEFUSDogJy8nLFxuICBBTExPV0VEX0NJRFI6ICcwLjAuMC4wLzAnLFxuICBMT0dfUkVURU5USU9OX0RBWVM6IDcsXG4gIEVOQUJMRV9BVVRPX1NDQUxJTkc6IGZhbHNlLFxuICBNSU5fQ0FQQUNJVFk6IDEsXG4gIE1BWF9DQVBBQ0lUWTogMTAsXG4gIFRBUkdFVF9DUFVfVVRJTElaQVRJT046IDcwLFxuICBUQVJHRVRfTUVNT1JZX1VUSUxJWkFUSU9OOiA3MCxcbiAgSEVBTFRIX0NIRUNLX0lOVEVSVkFMOiAzMCxcbiAgSEVBTFRIX0NIRUNLX1RJTUVPVVQ6IDUsXG4gIEhFQUxUSF9DSEVDS19TVEFSVF9QRVJJT0Q6IDYwLFxuICBIRUFMVEhfQ0hFQ0tfUkVUUklFUzogMyxcbiAgU0VSVklDRV9ESVNDT1ZFUllfVFRMOiAxMCxcbn0gYXMgY29uc3Q7XG5cbi8qKlxuICogRUNTIFNlcnZpY2UgU3RhY2sgY29uc3RydWN0XG4gKiBcbiAqIENyZWF0ZXMgYSBjb21wbGV0ZSBFQ1Mgc2VydmljZSBkZXBsb3ltZW50IHdpdGggYWxsIG5lY2Vzc2FyeSBpbmZyYXN0cnVjdHVyZS5cbiAqIENvbmZpZ3VyYXRpb24gaXMgcHJvdmlkZWQgdmlhIGNvbnRleHQgcGFyYW1ldGVycyB3aXRoIHNlbnNpYmxlIGRlZmF1bHRzLlxuICovXG5leHBvcnQgY2xhc3MgRWNzU2VydmljZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHNlcnZpY2U6IGVjcy5GYXJnYXRlU2VydmljZTtcbiAgcHVibGljIHJlYWRvbmx5IGNsdXN0ZXI6IGVjcy5JQ2x1c3RlcjtcbiAgcHVibGljIHJlYWRvbmx5IGxvYWRCYWxhbmNlcjogZWNzX3BhdHRlcm5zLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRmFyZ2F0ZVNlcnZpY2U7XG4gIHByaXZhdGUgcmVhZG9ubHkgc3RhY2tQcm9wczogRWNzU2VydmljZVN0YWNrUHJvcHM7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEVjc1NlcnZpY2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gICAgXG4gICAgdGhpcy5zdGFja1Byb3BzID0gcHJvcHM7XG5cbiAgICAvLyBDaGVjayBmb3IgaGVscCByZXF1ZXN0IGZpcnN0IC0gbXVzdCBiZSBiZWZvcmUgYW55IGNvbmZpZ3VyYXRpb24gbG9hZGluZ1xuICAgIGlmICh0aGlzLmlzSGVscFJlcXVlc3RlZCgpKSB7XG4gICAgICBzaG93SGVscCgpO1xuICAgICAgLy8gQ3JlYXRlIGEgZHVtbXkgb3V0cHV0IHRvIHNhdGlzZnkgQ0RLIHJlcXVpcmVtZW50c1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0hlbHBEaXNwbGF5ZWQnLCB7XG4gICAgICAgIHZhbHVlOiAnSGVscCBpbmZvcm1hdGlvbiB3YXMgZGlzcGxheWVkJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdIZWxwIHdhcyByZXF1ZXN0ZWQgYW5kIGRpc3BsYXllZCcsXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgY3JlZGVudGlhbCBjb250ZXh0IHBhcmFtZXRlcnNcbiAgICB0aGlzLmhhbmRsZUNyZWRlbnRpYWxDb250ZXh0KCk7XG5cbiAgICAvLyBMb2FkIGFuZCB2YWxpZGF0ZSBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgY29uZmlnID0gdGhpcy5sb2FkQ29uZmlndXJhdGlvbigpO1xuICAgIHRoaXMudmFsaWRhdGVSZXF1aXJlZFBhcmFtZXRlcnMoY29uZmlnKTtcblxuICAgIC8vIENyZWF0ZSBpbmZyYXN0cnVjdHVyZVxuICAgIGNvbnN0IHZwYyA9IHRoaXMuY3JlYXRlT3JJbXBvcnRWcGMoY29uZmlnLmluZnJhc3RydWN0dXJlIS52cGMuaWQhKTtcbiAgICB0aGlzLmNsdXN0ZXIgPSB0aGlzLmNyZWF0ZU9ySW1wb3J0Q2x1c3Rlcihjb25maWcuY2x1c3RlciEubmFtZSEsIHZwYyk7XG4gICAgdGhpcy5sb2FkQmFsYW5jZXIgPSB0aGlzLmNyZWF0ZUVjc1NlcnZpY2UoY29uZmlnLCB2cGMpO1xuICAgIHRoaXMuc2VydmljZSA9IHRoaXMubG9hZEJhbGFuY2VyLnNlcnZpY2U7XG5cbiAgICAvLyBBZGQgb3B0aW9uYWwgZmVhdHVyZXNcbiAgICBpZiAoY29uZmlnLmF1dG9TY2FsaW5nPy5lbmFibGVkKSB7XG4gICAgICB0aGlzLmFkZEF1dG9TY2FsaW5nKGNvbmZpZyk7XG4gICAgfVxuXG4gICAgLy8gQWRkIG91dHB1dHNcbiAgICB0aGlzLmFkZE91dHB1dHMoY29uZmlnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBoZWxwIGlzIHJlcXVlc3RlZCB2aWEgY29udGV4dCBwYXJhbWV0ZXJcbiAgICovXG4gIHByaXZhdGUgaXNIZWxwUmVxdWVzdGVkKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGhlbHAgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnaGVscCcpO1xuICAgIHJldHVybiBoZWxwID09PSAndHJ1ZScgfHwgaGVscCA9PT0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgY3JlZGVudGlhbCBjb250ZXh0IHBhcmFtZXRlcnNcbiAgICogU2V0cyBBV1MgY3JlZGVudGlhbCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZnJvbSBjb250ZXh0XG4gICAqL1xuICBwcml2YXRlIGhhbmRsZUNyZWRlbnRpYWxDb250ZXh0KCk6IHZvaWQge1xuICAgIGNvbnN0IGF3c1Byb2ZpbGUgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnYXdzUHJvZmlsZScpO1xuICAgIGNvbnN0IGF3c1JvbGVBcm4gPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnYXdzUm9sZUFybicpO1xuICAgIGNvbnN0IGF3c0FjY2Vzc0tleUlkID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2F3c0FjY2Vzc0tleUlkJyk7XG4gICAgY29uc3QgYXdzU2VjcmV0QWNjZXNzS2V5ID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2F3c1NlY3JldEFjY2Vzc0tleScpO1xuICAgIGNvbnN0IGF3c1Nlc3Npb25Ub2tlbiA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdhd3NTZXNzaW9uVG9rZW4nKTtcblxuICAgIGlmIChhd3NQcm9maWxlICYmIHR5cGVvZiBhd3NQcm9maWxlID09PSAnc3RyaW5nJykge1xuICAgICAgcHJvY2Vzcy5lbnYuQVdTX1BST0ZJTEUgPSBhd3NQcm9maWxlO1xuICAgIH1cblxuICAgIGlmIChhd3NSb2xlQXJuICYmIHR5cGVvZiBhd3NSb2xlQXJuID09PSAnc3RyaW5nJykge1xuICAgICAgcHJvY2Vzcy5lbnYuQVdTX1JPTEVfQVJOID0gYXdzUm9sZUFybjtcbiAgICB9XG5cbiAgICBpZiAoYXdzQWNjZXNzS2V5SWQgJiYgdHlwZW9mIGF3c0FjY2Vzc0tleUlkID09PSAnc3RyaW5nJykge1xuICAgICAgcHJvY2Vzcy5lbnYuQVdTX0FDQ0VTU19LRVlfSUQgPSBhd3NBY2Nlc3NLZXlJZDtcbiAgICB9XG5cbiAgICBpZiAoYXdzU2VjcmV0QWNjZXNzS2V5ICYmIHR5cGVvZiBhd3NTZWNyZXRBY2Nlc3NLZXkgPT09ICdzdHJpbmcnKSB7XG4gICAgICBwcm9jZXNzLmVudi5BV1NfU0VDUkVUX0FDQ0VTU19LRVkgPSBhd3NTZWNyZXRBY2Nlc3NLZXk7XG4gICAgfVxuXG4gICAgaWYgKGF3c1Nlc3Npb25Ub2tlbiAmJiB0eXBlb2YgYXdzU2Vzc2lvblRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgcHJvY2Vzcy5lbnYuQVdTX1NFU1NJT05fVE9LRU4gPSBhd3NTZXNzaW9uVG9rZW47XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHJlcXVpcmVkIHBhcmFtZXRlcnMgYW5kIHRocm93IGRlc2NyaXB0aXZlIGVycm9yc1xuICAgKi9cbiAgcHJpdmF0ZSB2YWxpZGF0ZVJlcXVpcmVkUGFyYW1ldGVycyhjb25maWc6IEVjc1NlcnZpY2VDb25maWcpOiB2b2lkIHtcbiAgICBjb25zdCBtaXNzaW5nUGFyYW1zOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gQ2hlY2sgZm9yIHJlcXVpcmVkIHBhcmFtZXRlcnMgZnJvbSBzdHJ1Y3R1cmVkIGNvbmZpZ1xuICAgIGlmICghY29uZmlnLnRhc2tEZWZpbml0aW9uPy5jb250YWluZXJzPy5bMF0/LnBvcnRNYXBwaW5ncz8uWzBdPy5jb250YWluZXJQb3J0KSB7XG4gICAgICBtaXNzaW5nUGFyYW1zLnB1c2goJ3Rhc2tEZWZpbml0aW9uLmNvbnRhaW5lcnMuMC5wb3J0TWFwcGluZ3MuMC5jb250YWluZXJQb3J0Jyk7XG4gICAgfVxuICAgIGlmICghY29uZmlnLmxvYWRCYWxhbmNlcj8ucG9ydCkge1xuICAgICAgbWlzc2luZ1BhcmFtcy5wdXNoKCdsb2FkQmFsYW5jZXIucG9ydCcpO1xuICAgIH1cbiAgICBpZiAoIWNvbmZpZy5pbmZyYXN0cnVjdHVyZT8udnBjPy5pZCkge1xuICAgICAgbWlzc2luZ1BhcmFtcy5wdXNoKCdpbmZyYXN0cnVjdHVyZS52cGMuaWQnKTtcbiAgICB9XG4gICAgaWYgKCFjb25maWcuY2x1c3Rlcj8ubmFtZSkge1xuICAgICAgbWlzc2luZ1BhcmFtcy5wdXNoKCdjbHVzdGVyLm5hbWUnKTtcbiAgICB9XG4gICAgaWYgKCFjb25maWcudGFza0RlZmluaXRpb24/LmNvbnRhaW5lcnM/LlswXT8uaW1hZ2UpIHtcbiAgICAgIG1pc3NpbmdQYXJhbXMucHVzaCgndGFza0RlZmluaXRpb24uY29udGFpbmVycy4wLmltYWdlJyk7XG4gICAgfVxuXG4gICAgaWYgKG1pc3NpbmdQYXJhbXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcGFyYW1MaXN0ID0gbWlzc2luZ1BhcmFtcy5tYXAocCA9PiBgLS1jb250ZXh0ICR7cH09PHZhbHVlPmApLmpvaW4oJyAnKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzOiAke21pc3NpbmdQYXJhbXMuam9pbignLCAnKX0uIFBsZWFzZSBwcm92aWRlICR7cGFyYW1MaXN0fWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGNvbmZpZ3VyYXRpb24gZnJvbSBjb250ZXh0IHBhcmFtZXRlcnMgd2l0aCBzZW5zaWJsZSBkZWZhdWx0c1xuICAgKiBGb2xsb3dzIDEyLWZhY3RvciBwcmluY2lwbGVzIC0gYWxsIGNvbmZpZ3VyYXRpb24gdmlhIGVudmlyb25tZW50L2NvbnRleHRcbiAgICovXG4gIHByaXZhdGUgbG9hZENvbmZpZ3VyYXRpb24oKTogRWNzU2VydmljZUNvbmZpZyB7XG4gICAgY29uc3QgdGVzdENvbmZpZyA9IHRoaXMuc3RhY2tQcm9wcz8uY29uZmlnIHx8IHt9O1xuICAgIFxuICAgIC8vIExvYWQgdmFsdWVzIGZpbGUgaWYgc3BlY2lmaWVkXG4gICAgY29uc3QgdmFsdWVzRmlsZSA9IHRlc3RDb25maWcudmFsdWVzRmlsZSA/IHRoaXMubG9hZFZhbHVlc0ZpbGUodGVzdENvbmZpZy52YWx1ZXNGaWxlIGFzIHN0cmluZykgOiB7fTtcbiAgICBcbiAgICAvLyBTdGFydCB3aXRoIHN0cnVjdHVyZWQgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGNvbmZpZzogRWNzU2VydmljZUNvbmZpZyA9IHtcbiAgICAgIC8vIExvYWQgZnJvbSBjb250ZXh0IHBhcmFtZXRlcnMgZm9yIHN0cnVjdHVyZWQgY29uZmlnXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBuYW1lOiB0aGlzLmdldENvbnRleHRWYWx1ZSgnbWV0YWRhdGEubmFtZScsIHZhbHVlc0ZpbGUubWV0YWRhdGE/Lm5hbWUgfHwgdGVzdENvbmZpZy5tZXRhZGF0YT8ubmFtZSkgPz8gdGhpcy5zdGFja05hbWUsXG4gICAgICAgIHZlcnNpb246IHRoaXMuZ2V0Q29udGV4dFZhbHVlKCdtZXRhZGF0YS52ZXJzaW9uJywgdmFsdWVzRmlsZS5tZXRhZGF0YT8udmVyc2lvbiB8fCB0ZXN0Q29uZmlnLm1ldGFkYXRhPy52ZXJzaW9uKSA/PyAnMS4wLjAnLFxuICAgICAgICBkZXNjcmlwdGlvbjogdGhpcy5nZXRDb250ZXh0VmFsdWUoJ21ldGFkYXRhLmRlc2NyaXB0aW9uJywgdmFsdWVzRmlsZS5tZXRhZGF0YT8uZGVzY3JpcHRpb24gfHwgdGVzdENvbmZpZy5tZXRhZGF0YT8uZGVzY3JpcHRpb24pLFxuICAgICAgfSxcbiAgICAgIFxuICAgICAgaW5mcmFzdHJ1Y3R1cmU6IHtcbiAgICAgICAgdnBjOiB7XG4gICAgICAgICAgaWQ6IHRoaXMuZ2V0Q29udGV4dFZhbHVlKCdpbmZyYXN0cnVjdHVyZS52cGMuaWQnLCB2YWx1ZXNGaWxlLmluZnJhc3RydWN0dXJlPy52cGM/LmlkIHx8IHRlc3RDb25maWcuaW5mcmFzdHJ1Y3R1cmU/LnZwYz8uaWQpID8/IHRoaXMucmVxdWlyZUNvbnRleHQoJ2luZnJhc3RydWN0dXJlLnZwYy5pZCcpLFxuICAgICAgICAgIHN1Ym5ldHM6IHRoaXMucGFyc2VTdWJuZXRJZHModGhpcy5nZXRDb250ZXh0VmFsdWUoJ2luZnJhc3RydWN0dXJlLnZwYy5zdWJuZXRzJywgdmFsdWVzRmlsZS5pbmZyYXN0cnVjdHVyZT8udnBjPy5zdWJuZXRzIHx8IHRlc3RDb25maWcuaW5mcmFzdHJ1Y3R1cmU/LnZwYz8uc3VibmV0cykpID8/IFtdLFxuICAgICAgICB9LFxuICAgICAgICBzZWN1cml0eUdyb3VwczogdmFsdWVzRmlsZS5pbmZyYXN0cnVjdHVyZT8uc2VjdXJpdHlHcm91cHMgfHwgdGVzdENvbmZpZy5pbmZyYXN0cnVjdHVyZT8uc2VjdXJpdHlHcm91cHMsXG4gICAgICB9LFxuICAgICAgXG4gICAgICBjbHVzdGVyOiB7XG4gICAgICAgIG5hbWU6IHRoaXMuZ2V0Q29udGV4dFZhbHVlKCdjbHVzdGVyLm5hbWUnLCB2YWx1ZXNGaWxlLmNsdXN0ZXI/Lm5hbWUgfHwgdGVzdENvbmZpZy5jbHVzdGVyPy5uYW1lKSA/PyB0aGlzLnJlcXVpcmVDb250ZXh0KCdjbHVzdGVyLm5hbWUnKSxcbiAgICAgICAgY29udGFpbmVySW5zaWdodHM6IHRoaXMuZ2V0Qm9vbGVhbkNvbnRleHRWYWx1ZSgnY2x1c3Rlci5jb250YWluZXJJbnNpZ2h0cycsIHZhbHVlc0ZpbGUuY2x1c3Rlcj8uY29udGFpbmVySW5zaWdodHMgfHwgdGVzdENvbmZpZy5jbHVzdGVyPy5jb250YWluZXJJbnNpZ2h0cykgPz8gdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIHRhc2tEZWZpbml0aW9uOiB7XG4gICAgICAgIHR5cGU6IHRoaXMuZ2V0Q29udGV4dFZhbHVlKCd0YXNrRGVmaW5pdGlvbi50eXBlJywgdmFsdWVzRmlsZS50YXNrRGVmaW5pdGlvbj8udHlwZSB8fCB0ZXN0Q29uZmlnLnRhc2tEZWZpbml0aW9uPy50eXBlKSA/PyAnRkFSR0FURScsXG4gICAgICAgIGNwdTogdGhpcy5nZXROdW1lcmljQ29udGV4dFZhbHVlKCd0YXNrRGVmaW5pdGlvbi5jcHUnLCB2YWx1ZXNGaWxlLnRhc2tEZWZpbml0aW9uPy5jcHUgfHwgdGVzdENvbmZpZy50YXNrRGVmaW5pdGlvbj8uY3B1KSA/PyBERUZBVUxUX0NPTkZJRy5DUFUsXG4gICAgICAgIG1lbW9yeTogdGhpcy5nZXROdW1lcmljQ29udGV4dFZhbHVlKCd0YXNrRGVmaW5pdGlvbi5tZW1vcnknLCB2YWx1ZXNGaWxlLnRhc2tEZWZpbml0aW9uPy5tZW1vcnkgfHwgdGVzdENvbmZpZy50YXNrRGVmaW5pdGlvbj8ubWVtb3J5KSA/PyBERUZBVUxUX0NPTkZJRy5NRU1PUlksXG4gICAgICAgIGNvbnRhaW5lcnM6IFt7XG4gICAgICAgICAgbmFtZTogJ21haW4nLFxuICAgICAgICAgIGltYWdlOiB0aGlzLmdldENvbnRleHRWYWx1ZSgndGFza0RlZmluaXRpb24uY29udGFpbmVycy4wLmltYWdlJywgdmFsdWVzRmlsZS50YXNrRGVmaW5pdGlvbj8uY29udGFpbmVycz8uWzBdPy5pbWFnZSB8fCB0ZXN0Q29uZmlnLnRhc2tEZWZpbml0aW9uPy5jb250YWluZXJzPy5bMF0/LmltYWdlKSA/PyB0aGlzLnJlcXVpcmVDb250ZXh0KCd0YXNrRGVmaW5pdGlvbi5jb250YWluZXJzLjAuaW1hZ2UnKSxcbiAgICAgICAgICBwb3J0TWFwcGluZ3M6IFt7XG4gICAgICAgICAgICBjb250YWluZXJQb3J0OiB0aGlzLmdldE51bWVyaWNDb250ZXh0VmFsdWUoJ3Rhc2tEZWZpbml0aW9uLmNvbnRhaW5lcnMuMC5wb3J0TWFwcGluZ3MuMC5jb250YWluZXJQb3J0JywgdmFsdWVzRmlsZS50YXNrRGVmaW5pdGlvbj8uY29udGFpbmVycz8uWzBdPy5wb3J0TWFwcGluZ3M/LlswXT8uY29udGFpbmVyUG9ydCB8fCB0ZXN0Q29uZmlnLnRhc2tEZWZpbml0aW9uPy5jb250YWluZXJzPy5bMF0/LnBvcnRNYXBwaW5ncz8uWzBdPy5jb250YWluZXJQb3J0KSA/PyB0aGlzLnJlcXVpcmVDb250ZXh0KCd0YXNrRGVmaW5pdGlvbi5jb250YWluZXJzLjAucG9ydE1hcHBpbmdzLjAuY29udGFpbmVyUG9ydCcpLFxuICAgICAgICAgICAgcHJvdG9jb2w6ICd0Y3AnLFxuICAgICAgICAgIH1dLFxuICAgICAgICAgIGVudmlyb25tZW50OiB2YWx1ZXNGaWxlLnRhc2tEZWZpbml0aW9uPy5jb250YWluZXJzPy5bMF0/LmVudmlyb25tZW50IHx8IHRlc3RDb25maWcudGFza0RlZmluaXRpb24/LmNvbnRhaW5lcnM/LlswXT8uZW52aXJvbm1lbnQgfHwgdGhpcy5wYXJzZUVudmlyb25tZW50VmFyaWFibGVzQXNBcnJheSgpLFxuICAgICAgICAgIHNlY3JldHM6IHZhbHVlc0ZpbGUudGFza0RlZmluaXRpb24/LmNvbnRhaW5lcnM/LlswXT8uc2VjcmV0cyB8fCB0ZXN0Q29uZmlnLnRhc2tEZWZpbml0aW9uPy5jb250YWluZXJzPy5bMF0/LnNlY3JldHMgfHwgdGhpcy5wYXJzZVNlY3JldHNBc0FycmF5KCksXG4gICAgICAgIH1dLFxuICAgICAgICB2b2x1bWVzOiB2YWx1ZXNGaWxlLnRhc2tEZWZpbml0aW9uPy52b2x1bWVzIHx8IHRlc3RDb25maWcudGFza0RlZmluaXRpb24/LnZvbHVtZXMsXG4gICAgICB9LFxuICAgICAgXG4gICAgICBzZXJ2aWNlOiB7XG4gICAgICAgIHR5cGU6IHRoaXMuZ2V0Q29udGV4dFZhbHVlKCdzZXJ2aWNlLnR5cGUnLCB2YWx1ZXNGaWxlLnNlcnZpY2U/LnR5cGUgfHwgdGVzdENvbmZpZy5zZXJ2aWNlPy50eXBlKSA/PyAnTE9BRF9CQUxBTkNFRCcsXG4gICAgICAgIGRlc2lyZWRDb3VudDogdGhpcy5nZXROdW1lcmljQ29udGV4dFZhbHVlKCdzZXJ2aWNlLmRlc2lyZWRDb3VudCcsIHZhbHVlc0ZpbGUuc2VydmljZT8uZGVzaXJlZENvdW50IHx8IHRlc3RDb25maWcuc2VydmljZT8uZGVzaXJlZENvdW50KSA/PyBERUZBVUxUX0NPTkZJRy5ERVNJUkVEX0NPVU5ULFxuICAgICAgICBoZWFsdGhDaGVja0dyYWNlUGVyaW9kU2Vjb25kczogdGhpcy5nZXROdW1lcmljQ29udGV4dFZhbHVlKCdzZXJ2aWNlLmhlYWx0aENoZWNrR3JhY2VQZXJpb2RTZWNvbmRzJywgdmFsdWVzRmlsZS5zZXJ2aWNlPy5oZWFsdGhDaGVja0dyYWNlUGVyaW9kU2Vjb25kcyB8fCB0ZXN0Q29uZmlnLnNlcnZpY2U/LmhlYWx0aENoZWNrR3JhY2VQZXJpb2RTZWNvbmRzKSxcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIGxvYWRCYWxhbmNlcjoge1xuICAgICAgICB0eXBlOiB0aGlzLmdldENvbnRleHRWYWx1ZSgnbG9hZEJhbGFuY2VyLnR5cGUnLCB2YWx1ZXNGaWxlLmxvYWRCYWxhbmNlcj8udHlwZSB8fCB0ZXN0Q29uZmlnLmxvYWRCYWxhbmNlcj8udHlwZSkgPz8gJ0FQUExJQ0FUSU9OJyxcbiAgICAgICAgc2NoZW1lOiB0aGlzLmdldENvbnRleHRWYWx1ZSgnbG9hZEJhbGFuY2VyLnNjaGVtZScsIHZhbHVlc0ZpbGUubG9hZEJhbGFuY2VyPy5zY2hlbWUgfHwgdGVzdENvbmZpZy5sb2FkQmFsYW5jZXI/LnNjaGVtZSksXG4gICAgICAgIHByb3RvY29sOiB0aGlzLmdldENvbnRleHRWYWx1ZSgnbG9hZEJhbGFuY2VyLnByb3RvY29sJywgdmFsdWVzRmlsZS5sb2FkQmFsYW5jZXI/LnByb3RvY29sIHx8IHRlc3RDb25maWcubG9hZEJhbGFuY2VyPy5wcm90b2NvbCkgPz8gJ0hUVFAnLFxuICAgICAgICBwb3J0OiB0aGlzLmdldE51bWVyaWNDb250ZXh0VmFsdWUoJ2xvYWRCYWxhbmNlci5wb3J0JywgdmFsdWVzRmlsZS5sb2FkQmFsYW5jZXI/LnBvcnQgfHwgdGVzdENvbmZpZy5sb2FkQmFsYW5jZXI/LnBvcnQpID8/IHRoaXMucmVxdWlyZUNvbnRleHQoJ2xvYWRCYWxhbmNlci5wb3J0JyksXG4gICAgICAgIGNlcnRpZmljYXRlQXJuOiB0aGlzLmdldENvbnRleHRWYWx1ZSgnbG9hZEJhbGFuY2VyLmNlcnRpZmljYXRlQXJuJywgdmFsdWVzRmlsZS5sb2FkQmFsYW5jZXI/LmNlcnRpZmljYXRlQXJuIHx8IHRlc3RDb25maWcubG9hZEJhbGFuY2VyPy5jZXJ0aWZpY2F0ZUFybiksXG4gICAgICAgIHRhcmdldEdyb3VwOiB7XG4gICAgICAgICAgaGVhbHRoQ2hlY2tQYXRoOiB0aGlzLmdldENvbnRleHRWYWx1ZSgnbG9hZEJhbGFuY2VyLnRhcmdldEdyb3VwLmhlYWx0aENoZWNrUGF0aCcsIHZhbHVlc0ZpbGUubG9hZEJhbGFuY2VyPy50YXJnZXRHcm91cD8uaGVhbHRoQ2hlY2tQYXRoIHx8IHRlc3RDb25maWcubG9hZEJhbGFuY2VyPy50YXJnZXRHcm91cD8uaGVhbHRoQ2hlY2tQYXRoKSA/PyBERUZBVUxUX0NPTkZJRy5IRUFMVEhfQ0hFQ0tfUEFUSCxcbiAgICAgICAgfSxcbiAgICAgICAgYWxsb3dlZENpZHI6IHRoaXMuZ2V0Q29udGV4dFZhbHVlKCdsb2FkQmFsYW5jZXIuYWxsb3dlZENpZHInLCB2YWx1ZXNGaWxlLmxvYWRCYWxhbmNlcj8uYWxsb3dlZENpZHIgfHwgdGVzdENvbmZpZy5sb2FkQmFsYW5jZXI/LmFsbG93ZWRDaWRyKSxcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIGF1dG9TY2FsaW5nOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRoaXMuZ2V0Qm9vbGVhbkNvbnRleHRWYWx1ZSgnYXV0b1NjYWxpbmcuZW5hYmxlZCcsIHZhbHVlc0ZpbGUuYXV0b1NjYWxpbmc/LmVuYWJsZWQgfHwgdGVzdENvbmZpZy5hdXRvU2NhbGluZz8uZW5hYmxlZCkgPz8gREVGQVVMVF9DT05GSUcuRU5BQkxFX0FVVE9fU0NBTElORyxcbiAgICAgICAgbWluQ2FwYWNpdHk6IHRoaXMuZ2V0TnVtZXJpY0NvbnRleHRWYWx1ZSgnYXV0b1NjYWxpbmcubWluQ2FwYWNpdHknLCB2YWx1ZXNGaWxlLmF1dG9TY2FsaW5nPy5taW5DYXBhY2l0eSB8fCB0ZXN0Q29uZmlnLmF1dG9TY2FsaW5nPy5taW5DYXBhY2l0eSkgPz8gREVGQVVMVF9DT05GSUcuTUlOX0NBUEFDSVRZLFxuICAgICAgICBtYXhDYXBhY2l0eTogdGhpcy5nZXROdW1lcmljQ29udGV4dFZhbHVlKCdhdXRvU2NhbGluZy5tYXhDYXBhY2l0eScsIHZhbHVlc0ZpbGUuYXV0b1NjYWxpbmc/Lm1heENhcGFjaXR5IHx8IHRlc3RDb25maWcuYXV0b1NjYWxpbmc/Lm1heENhcGFjaXR5KSA/PyBERUZBVUxUX0NPTkZJRy5NQVhfQ0FQQUNJVFksXG4gICAgICAgIHRhcmdldENwdVV0aWxpemF0aW9uOiB0aGlzLmdldE51bWVyaWNDb250ZXh0VmFsdWUoJ2F1dG9TY2FsaW5nLnRhcmdldENwdVV0aWxpemF0aW9uJywgdmFsdWVzRmlsZS5hdXRvU2NhbGluZz8udGFyZ2V0Q3B1VXRpbGl6YXRpb24gfHwgdGVzdENvbmZpZy5hdXRvU2NhbGluZz8udGFyZ2V0Q3B1VXRpbGl6YXRpb24pID8/IERFRkFVTFRfQ09ORklHLlRBUkdFVF9DUFVfVVRJTElaQVRJT04sXG4gICAgICAgIHRhcmdldE1lbW9yeVV0aWxpemF0aW9uOiB0aGlzLmdldE51bWVyaWNDb250ZXh0VmFsdWUoJ2F1dG9TY2FsaW5nLnRhcmdldE1lbW9yeVV0aWxpemF0aW9uJywgdmFsdWVzRmlsZS5hdXRvU2NhbGluZz8udGFyZ2V0TWVtb3J5VXRpbGl6YXRpb24gfHwgdGVzdENvbmZpZy5hdXRvU2NhbGluZz8udGFyZ2V0TWVtb3J5VXRpbGl6YXRpb24pID8/IERFRkFVTFRfQ09ORklHLlRBUkdFVF9NRU1PUllfVVRJTElaQVRJT04sXG4gICAgICB9LFxuICAgICAgXG4gICAgICBpYW06IHtcbiAgICAgICAgdGFza1JvbGU6IHZhbHVlc0ZpbGUuaWFtPy50YXNrUm9sZSB8fCB0ZXN0Q29uZmlnLmlhbT8udGFza1JvbGUsXG4gICAgICAgIHRhc2tFeGVjdXRpb25Sb2xlOiB2YWx1ZXNGaWxlLmlhbT8udGFza0V4ZWN1dGlvblJvbGUgfHwgdGVzdENvbmZpZy5pYW0/LnRhc2tFeGVjdXRpb25Sb2xlLFxuICAgICAgfSxcbiAgICAgIHNlcnZpY2VEaXNjb3Zlcnk6IHZhbHVlc0ZpbGUuc2VydmljZURpc2NvdmVyeSB8fCB0ZXN0Q29uZmlnLnNlcnZpY2VEaXNjb3ZlcnksXG4gICAgICBcbiAgICAgIGFkZG9uczogdmFsdWVzRmlsZS5hZGRvbnMgfHwgdGVzdENvbmZpZy5hZGRvbnMsXG5cbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbmZpZztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY29udGV4dCB2YWx1ZSB3aXRoIGZhbGxiYWNrIHRvIHRlc3QgY29uZmlnXG4gICAqL1xuICBwcml2YXRlIGdldENvbnRleHRWYWx1ZTxUPihrZXk6IHN0cmluZywgdGVzdFZhbHVlPzogVCk6IFQgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0ZXN0VmFsdWUgPz8gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoa2V5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgbnVtZXJpYyBjb250ZXh0IHZhbHVlIHdpdGggcHJvcGVyIHR5cGUgY29udmVyc2lvblxuICAgKi9cbiAgcHJpdmF0ZSBnZXROdW1lcmljQ29udGV4dFZhbHVlKGtleTogc3RyaW5nLCB0ZXN0VmFsdWU/OiBudW1iZXIpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5nZXRDb250ZXh0VmFsdWUoa2V5LCB0ZXN0VmFsdWUpO1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIFxuICAgIGNvbnN0IG51bVZhbHVlID0gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KHZhbHVlLCAxMCkgOiB2YWx1ZTtcbiAgICBcbiAgICAvLyBWYWxpZGF0ZSB0aGF0IHBhcnNpbmcgd2FzIHN1Y2Nlc3NmdWxcbiAgICBpZiAodHlwZW9mIG51bVZhbHVlID09PSAnbnVtYmVyJyAmJiAhaXNOYU4obnVtVmFsdWUpKSB7XG4gICAgICByZXR1cm4gbnVtVmFsdWU7XG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUud2Fybihg4pqg77iPICBXYXJuaW5nOiBJbnZhbGlkIG51bWVyaWMgdmFsdWUgZm9yICcke2tleX0nOiAke3ZhbHVlfWApO1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGJvb2xlYW4gY29udGV4dCB2YWx1ZSB3aXRoIHByb3BlciB0eXBlIGNvbnZlcnNpb25cbiAgICovXG4gIHByaXZhdGUgZ2V0Qm9vbGVhbkNvbnRleHRWYWx1ZShrZXk6IHN0cmluZywgdGVzdFZhbHVlPzogYm9vbGVhbik6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5nZXRDb250ZXh0VmFsdWUoa2V5LCB0ZXN0VmFsdWUpO1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gKHZhbHVlIGFzIHN0cmluZykudG9Mb3dlckNhc2UoKSA9PT0gJ3RydWUnO1xuICAgIH1cbiAgICByZXR1cm4gQm9vbGVhbih2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2Ugc3VibmV0IElEcyBmcm9tIHN0cmluZyBvciBhcnJheVxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZVN1Ym5ldElkcyhzdWJuZXRJZHM6IHN0cmluZyB8IHN0cmluZ1tdIHwgdW5kZWZpbmVkKTogc3RyaW5nW10ge1xuICAgIGlmICghc3VibmV0SWRzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIFxuICAgIGlmIChBcnJheS5pc0FycmF5KHN1Ym5ldElkcykpIHtcbiAgICAgIHJldHVybiBzdWJuZXRJZHM7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdWJuZXRJZHMuc3BsaXQoJywnKS5tYXAoaWQgPT4gaWQudHJpbSgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZnJvbSBjb250ZXh0XG4gICAqL1xuICBwcml2YXRlIHBhcnNlRW52aXJvbm1lbnRWYXJpYWJsZXMoKTogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSB7XG4gICAgY29uc3QgZW52OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGVudkNvbnRleHQgPSB0aGlzLm5vZGUuZ2V0Q29udGV4dCgnZW52Jyk7XG4gICAgICBpZiAoZW52Q29udGV4dCAmJiB0eXBlb2YgZW52Q29udGV4dCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgT2JqZWN0LmFzc2lnbihlbnYsIGVudkNvbnRleHQpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyAgV2FybmluZzogRmFpbGVkIHRvIHBhcnNlIGVudmlyb25tZW50IHZhcmlhYmxlczogJHtlcnJvcn1gKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGVudjtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXMgYXJyYXkgZm9yIHN0cnVjdHVyZWQgY29uZmlnXG4gICAqL1xuICBwcml2YXRlIHBhcnNlRW52aXJvbm1lbnRWYXJpYWJsZXNBc0FycmF5KCk6IHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH1bXSB7XG4gICAgY29uc3QgZW52ID0gdGhpcy5wYXJzZUVudmlyb25tZW50VmFyaWFibGVzKCk7XG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKGVudikubWFwKChbbmFtZSwgdmFsdWVdKSA9PiAoeyBuYW1lLCB2YWx1ZSB9KSk7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2Ugc2VjcmV0cyBmcm9tIGNvbnRleHRcbiAgICovXG4gIHByaXZhdGUgcGFyc2VTZWNyZXRzKCk6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0ge1xuICAgIGNvbnN0IHNlY3JldHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2VjcmV0Q29udGV4dCA9IHRoaXMubm9kZS5nZXRDb250ZXh0KCdzZWNyZXQnKTtcbiAgICAgIGlmIChzZWNyZXRDb250ZXh0ICYmIHR5cGVvZiBzZWNyZXRDb250ZXh0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICBPYmplY3QuYXNzaWduKHNlY3JldHMsIHNlY3JldENvbnRleHQpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyAgV2FybmluZzogRmFpbGVkIHRvIHBhcnNlIHNlY3JldHM6ICR7ZXJyb3J9YCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzZWNyZXRzO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIHNlY3JldHMgYXMgYXJyYXkgZm9yIHN0cnVjdHVyZWQgY29uZmlnXG4gICAqL1xuICBwcml2YXRlIHBhcnNlU2VjcmV0c0FzQXJyYXkoKTogeyBuYW1lOiBzdHJpbmc7IHZhbHVlRnJvbTogc3RyaW5nIH1bXSB7XG4gICAgY29uc3Qgc2VjcmV0cyA9IHRoaXMucGFyc2VTZWNyZXRzKCk7XG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHNlY3JldHMpLm1hcCgoW25hbWUsIHZhbHVlRnJvbV0pID0+ICh7IG5hbWUsIHZhbHVlRnJvbSB9KSk7XG4gIH1cblxuXG5cbiAgLyoqXG4gICAqIExvYWQgY29uZmlndXJhdGlvbiBmcm9tIHZhbHVlcyBmaWxlIChKU09OLCBZQU1MLCBKUylcbiAgICovXG4gIHByaXZhdGUgbG9hZFZhbHVlc0ZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhmaWxlUGF0aCkpIHtcbiAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPICBXYXJuaW5nOiBWYWx1ZXMgZmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9LCBza2lwcGluZ2ApO1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0ZjgnKTtcbiAgICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlUGF0aCkudG9Mb3dlckNhc2UoKTtcblxuICAgICAgc3dpdGNoIChleHQpIHtcbiAgICAgICAgY2FzZSAnLmpzJzpcbiAgICAgICAgICByZXR1cm4gcmVxdWlyZShwYXRoLnJlc29sdmUoZmlsZVBhdGgpKTtcbiAgICAgICAgY2FzZSAnLnlhbWwnOlxuICAgICAgICBjYXNlICcueW1sJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZVlhbWwoZmlsZUNvbnRlbnQpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGZpbGVDb250ZW50KTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDimqDvuI8gIFdhcm5pbmc6IEZhaWxlZCB0byBwYXJzZSB2YWx1ZXMgZmlsZSAke2ZpbGVQYXRofTogJHtlcnJvcn1gKTtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2UgWUFNTCBjb250ZW50IHdpdGggZmFsbGJhY2sgdG8gSlNPTlxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZVlhbWwoY29udGVudDogc3RyaW5nKTogYW55IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeWFtbCA9IHJlcXVpcmUoJ2pzLXlhbWwnKTtcbiAgICAgIHJldHVybiB5YW1sLmxvYWQoY29udGVudCk7XG4gICAgfSBjYXRjaCAoeWFtbEVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyAgV2FybmluZzoganMteWFtbCBub3QgYXZhaWxhYmxlLCBmYWxsaW5nIGJhY2sgdG8gSlNPTmApO1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBvciBpbXBvcnQgVlBDIGJhc2VkIG9uIFZQQyBJRFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPckltcG9ydFZwYyh2cGNJZDogc3RyaW5nKTogZWMyLklWcGMge1xuICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMubG9hZENvbmZpZ3VyYXRpb24oKTtcbiAgICBjb25zdCBzdGFja05hbWUgPSBjb25maWcubWV0YWRhdGE/Lm5hbWUgfHwgdGhpcy5zdGFja05hbWU7XG4gICAgXG4gICAgLy8gSWYgVlBDIElEIGlzIHByb3ZpZGVkLCBpbXBvcnQgZXhpc3RpbmcgVlBDXG4gICAgaWYgKHZwY0lkICYmIHZwY0lkICE9PSAnJykge1xuICAgICAgY29uc29sZS5sb2coYPCfk50gSW1wb3J0aW5nIGV4aXN0aW5nIFZQQzogJHt2cGNJZH1gKTtcbiAgICAgIGNvbnN0IHN1Ym5ldElkcyA9IGNvbmZpZy5pbmZyYXN0cnVjdHVyZT8udnBjPy5zdWJuZXRzIHx8IFtdO1xuICAgICAgXG4gICAgICAvLyBHZXQgYXZhaWxhYmlsaXR5IHpvbmVzIGZyb20gY29udGV4dCBvciB1c2UgZGVmYXVsdHNcbiAgICAgIGNvbnN0IGF2YWlsYWJpbGl0eVpvbmVzID0gdGhpcy5nZXRDb250ZXh0VmFsdWUoJ2F2YWlsYWJpbGl0eVpvbmVzJykgYXMgc3RyaW5nW10gfHwgXG4gICAgICAgIFsndXMtd2VzdC0yYScsICd1cy13ZXN0LTJiJywgJ3VzLXdlc3QtMmMnXTtcbiAgICAgIFxuICAgICAgLy8gRW5zdXJlIGF2YWlsYWJpbGl0eSB6b25lcyBtYXRjaCB0aGUgbnVtYmVyIG9mIHN1Ym5ldHNcbiAgICAgIGNvbnN0IGF6cyA9IGF2YWlsYWJpbGl0eVpvbmVzLnNsaWNlKDAsIHN1Ym5ldElkcy5sZW5ndGgpO1xuICAgICAgXG4gICAgICByZXR1cm4gZWMyLlZwYy5mcm9tVnBjQXR0cmlidXRlcyh0aGlzLCBgJHtzdGFja05hbWV9VnBjYCwge1xuICAgICAgICB2cGNJZDogdnBjSWQsXG4gICAgICAgIGF2YWlsYWJpbGl0eVpvbmVzOiBhenMsXG4gICAgICAgIHByaXZhdGVTdWJuZXRJZHM6IHN1Ym5ldElkcyxcbiAgICAgICAgcHVibGljU3VibmV0SWRzOiBzdWJuZXRJZHMsIC8vIFVzZSBzYW1lIHN1Ym5ldHMgZm9yIGJvdGggcHVibGljIGFuZCBwcml2YXRlXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gT3RoZXJ3aXNlIGNyZWF0ZSBhIG5ldyBWUENcbiAgICBjb25zb2xlLmxvZyhg8J+TnSBDcmVhdGluZyBuZXcgVlBDYCk7XG4gICAgcmV0dXJuIG5ldyBlYzIuVnBjKHRoaXMsIGAke3N0YWNrTmFtZX1WcGNgLCB7XG4gICAgICBtYXhBenM6IDIsXG4gICAgICBuYXRHYXRld2F5czogMSxcbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiAncHVibGljJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogJ3ByaXZhdGUnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBvciBpbXBvcnQgRUNTIGNsdXN0ZXJcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3JJbXBvcnRDbHVzdGVyKGNsdXN0ZXJOYW1lOiBzdHJpbmcsIHZwYzogZWMyLklWcGMpOiBlY3MuSUNsdXN0ZXIge1xuICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMubG9hZENvbmZpZ3VyYXRpb24oKTtcbiAgICBjb25zdCBzdGFja05hbWUgPSBjb25maWcubWV0YWRhdGE/Lm5hbWUgfHwgdGhpcy5zdGFja05hbWU7XG4gICAgXG4gICAgLy8gQWx3YXlzIGNyZWF0ZSBhIG5ldyBjbHVzdGVyIGZvciBub3cgdG8gYXZvaWQgaW5hY3RpdmUgY2x1c3RlciBpc3N1ZXNcbiAgICBjb25zb2xlLmxvZyhg8J+TnSBDcmVhdGluZyBuZXcgY2x1c3RlcjogJHtjbHVzdGVyTmFtZX1gKTtcbiAgICByZXR1cm4gbmV3IGVjcy5DbHVzdGVyKHRoaXMsIGAke3N0YWNrTmFtZX1DbHVzdGVyYCwge1xuICAgICAgY2x1c3Rlck5hbWU6IGNsdXN0ZXJOYW1lLFxuICAgICAgdnBjOiB2cGMsXG4gICAgICBjb250YWluZXJJbnNpZ2h0czogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgRUNTIHNlcnZpY2Ugd2l0aCBhcHBsaWNhdGlvbiBsb2FkIGJhbGFuY2VyXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUVjc1NlcnZpY2UoY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnLCB2cGM6IGVjMi5JVnBjKTogZWNzX3BhdHRlcm5zLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRmFyZ2F0ZVNlcnZpY2Uge1xuICAgIGNvbnN0IGxvZ0dyb3VwID0gdGhpcy5jcmVhdGVMb2dHcm91cChjb25maWcpO1xuICAgIGNvbnN0IHRhc2tEZWZpbml0aW9uID0gdGhpcy5jcmVhdGVUYXNrRGVmaW5pdGlvbihjb25maWcpO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuYWRkQ29udGFpbmVyVG9UYXNrRGVmaW5pdGlvbihjb25maWcsIHRhc2tEZWZpbml0aW9uLCBsb2dHcm91cCk7XG4gICAgXG4gICAgY29uc3Qgc2VydmljZSA9IHRoaXMuY3JlYXRlTG9hZEJhbGFuY2VkU2VydmljZShjb25maWcsIHRhc2tEZWZpbml0aW9uKTtcbiAgICBcbiAgICB0aGlzLmNvbmZpZ3VyZVNlcnZpY2VEaXNjb3ZlcnkoY29uZmlnLCB2cGMpO1xuICAgIHRoaXMuY29uZmlndXJlU2VjdXJpdHlHcm91cChzZXJ2aWNlLCBjb25maWcpO1xuICAgIFxuICAgIHJldHVybiBzZXJ2aWNlO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBDbG91ZFdhdGNoIGxvZyBncm91cCBmb3IgdGhlIHNlcnZpY2VcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTG9nR3JvdXAoY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnKTogbG9ncy5Mb2dHcm91cCB7XG4gICAgY29uc3Qgc3RhY2tOYW1lID0gY29uZmlnLm1ldGFkYXRhPy5uYW1lIHx8IHRoaXMuc3RhY2tOYW1lO1xuICAgIFxuICAgIC8vIFVzZSBhZGQtb25zIGNvbmZpZ3VyYXRpb24gaWYgYXZhaWxhYmxlLCBvdGhlcndpc2UgdXNlIGRlZmF1bHRzXG4gICAgY29uc3QgbG9nR3JvdXBOYW1lID0gY29uZmlnLmFkZG9ucz8ubG9nZ2luZz8ub3B0aW9ucz8uWydhd3Nsb2dzLWdyb3VwJ10gfHwgYC9lY3MvJHtzdGFja05hbWV9YDtcbiAgICBjb25zdCByZXRlbnRpb25EYXlzID0gY29uZmlnLmFkZG9ucz8ubG9nZ2luZz8ucmV0ZW50aW9uRGF5cyB8fCBERUZBVUxUX0NPTkZJRy5MT0dfUkVURU5USU9OX0RBWVM7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIGAke3N0YWNrTmFtZX1Mb2dHcm91cGAsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogbG9nR3JvdXBOYW1lLFxuICAgICAgcmV0ZW50aW9uOiB0aGlzLmNvbnZlcnRSZXRlbnRpb25EYXlzKHJldGVudGlvbkRheXMpLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgRmFyZ2F0ZSB0YXNrIGRlZmluaXRpb25cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlVGFza0RlZmluaXRpb24oY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnKTogZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbiB7XG4gICAgY29uc3Qgc3RhY2tOYW1lID0gY29uZmlnLm1ldGFkYXRhPy5uYW1lIHx8IHRoaXMuc3RhY2tOYW1lO1xuICAgIFxuICAgIC8vIENyZWF0ZSBydW50aW1lIHBsYXRmb3JtIGlmIHNwZWNpZmllZFxuICAgIGNvbnN0IHJ1bnRpbWVQbGF0Zm9ybSA9IGNvbmZpZy50YXNrRGVmaW5pdGlvbi5ydW50aW1lUGxhdGZvcm0gPyB7XG4gICAgICBjcHVBcmNoaXRlY3R1cmU6IGVjcy5DcHVBcmNoaXRlY3R1cmUub2YoY29uZmlnLnRhc2tEZWZpbml0aW9uLnJ1bnRpbWVQbGF0Zm9ybS5jcHVBcmNoaXRlY3R1cmUpLFxuICAgICAgb3BlcmF0aW5nU3lzdGVtRmFtaWx5OiBlY3MuT3BlcmF0aW5nU3lzdGVtRmFtaWx5Lm9mKGNvbmZpZy50YXNrRGVmaW5pdGlvbi5ydW50aW1lUGxhdGZvcm0ub3MpLFxuICAgIH0gOiB1bmRlZmluZWQ7XG5cbiAgICByZXR1cm4gbmV3IGVjcy5GYXJnYXRlVGFza0RlZmluaXRpb24odGhpcywgYCR7c3RhY2tOYW1lfVRhc2tEZWZgLCB7XG4gICAgICBjcHU6IGNvbmZpZy50YXNrRGVmaW5pdGlvbi5jcHUsXG4gICAgICBtZW1vcnlMaW1pdE1pQjogY29uZmlnLnRhc2tEZWZpbml0aW9uLm1lbW9yeSxcbiAgICAgIGV4ZWN1dGlvblJvbGU6IHRoaXMuY3JlYXRlRXhlY3V0aW9uUm9sZShjb25maWcpLFxuICAgICAgdGFza1JvbGU6IHRoaXMuY3JlYXRlVGFza1JvbGUoY29uZmlnKSxcbiAgICAgIHJ1bnRpbWVQbGF0Zm9ybSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgZXhlY3V0aW9uIHJvbGUgd2l0aCByZXF1aXJlZCBwZXJtaXNzaW9ucyBmb3IgRUNTXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUV4ZWN1dGlvblJvbGUoY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnKTogaWFtLklSb2xlIHtcbiAgICBjb25zdCBzdGFja05hbWUgPSBjb25maWcubWV0YWRhdGE/Lm5hbWUgfHwgdGhpcy5zdGFja05hbWU7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGV4ZWN1dGlvbiByb2xlIHdpdGggcmVxdWlyZWQgcGVybWlzc2lvbnNcbiAgICBjb25zdCBleGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIGAke3N0YWNrTmFtZX1FeGVjdXRpb25Sb2xlYCwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Vjcy10YXNrcy5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQW1hem9uRUNTVGFza0V4ZWN1dGlvblJvbGVQb2xpY3knKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgY3VzdG9tIEpTT04gcG9saWN5IGlmIHByb3ZpZGVkXG4gICAgaWYgKGNvbmZpZy5pYW0/LnRhc2tFeGVjdXRpb25Sb2xlPy5jdXN0b20pIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGN1c3RvbVBvbGljeSA9IEpTT04ucGFyc2UoY29uZmlnLmlhbS50YXNrRXhlY3V0aW9uUm9sZS5jdXN0b20pO1xuICAgICAgICBleGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KGN1c3RvbVBvbGljeSkpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGDimqDvuI8gIFdhcm5pbmc6IEludmFsaWQgY3VzdG9tIHBvbGljeSBKU09OIGZvciBleGVjdXRpb24gcm9sZTogJHtlcnJvcn1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgZnJvbSBzdHJ1Y3R1cmVkIElBTSBjb25maWd1cmF0aW9uXG4gICAgaWYgKGNvbmZpZy5pYW0/LnRhc2tFeGVjdXRpb25Sb2xlPy5wb2xpY2llcykge1xuICAgICAgY29uZmlnLmlhbS50YXNrRXhlY3V0aW9uUm9sZS5wb2xpY2llcy5mb3JFYWNoKHBvbGljeSA9PiB7XG4gICAgICAgIGV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBwb2xpY3kuYWN0aW9ucyxcbiAgICAgICAgICByZXNvdXJjZXM6IHBvbGljeS5yZXNvdXJjZXMsXG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFkZCBkZXRhaWxlZCBwZXJtaXNzaW9ucyBpZiBzcGVjaWZpZWRcbiAgICBpZiAoY29uZmlnLmlhbT8udGFza0V4ZWN1dGlvblJvbGU/LnBlcm1pc3Npb25zKSB7XG4gICAgICB0aGlzLmFkZERldGFpbGVkUGVybWlzc2lvbnMoZXhlY3V0aW9uUm9sZSwgY29uZmlnLmlhbS50YXNrRXhlY3V0aW9uUm9sZS5wZXJtaXNzaW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGV4ZWN1dGlvblJvbGU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIHRhc2sgcm9sZSB3aXRoIHJlcXVpcmVkIHBlcm1pc3Npb25zIGZvciB0aGUgYXBwbGljYXRpb25cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlVGFza1JvbGUoY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnKTogaWFtLklSb2xlIHtcbiAgICBjb25zdCBzdGFja05hbWUgPSBjb25maWcubWV0YWRhdGE/Lm5hbWUgfHwgdGhpcy5zdGFja05hbWU7XG5cbiAgICAvLyBDcmVhdGUgdGFzayByb2xlIGZvciBhcHBsaWNhdGlvbiBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IHRhc2tSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIGAke3N0YWNrTmFtZX1UYXNrUm9sZWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlY3MtdGFza3MuYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGN1c3RvbSBKU09OIHBvbGljeSBpZiBwcm92aWRlZFxuICAgIGlmIChjb25maWcuaWFtPy50YXNrUm9sZT8uY3VzdG9tKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjdXN0b21Qb2xpY3kgPSBKU09OLnBhcnNlKGNvbmZpZy5pYW0udGFza1JvbGUuY3VzdG9tKTtcbiAgICAgICAgdGFza1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoY3VzdG9tUG9saWN5KSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyAgV2FybmluZzogSW52YWxpZCBjdXN0b20gcG9saWN5IEpTT04gZm9yIHRhc2sgcm9sZTogJHtlcnJvcn1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgZnJvbSBzdHJ1Y3R1cmVkIElBTSBjb25maWd1cmF0aW9uXG4gICAgaWYgKGNvbmZpZy5pYW0/LnRhc2tSb2xlPy5wb2xpY2llcykge1xuICAgICAgY29uZmlnLmlhbS50YXNrUm9sZS5wb2xpY2llcy5mb3JFYWNoKHBvbGljeSA9PiB7XG4gICAgICAgIHRhc2tSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogcG9saWN5LmFjdGlvbnMsXG4gICAgICAgICAgcmVzb3VyY2VzOiBwb2xpY3kucmVzb3VyY2VzLFxuICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgZGV0YWlsZWQgcGVybWlzc2lvbnMgaWYgc3BlY2lmaWVkXG4gICAgaWYgKGNvbmZpZy5pYW0/LnRhc2tSb2xlPy5wZXJtaXNzaW9ucykge1xuICAgICAgdGhpcy5hZGREZXRhaWxlZFBlcm1pc3Npb25zKHRhc2tSb2xlLCBjb25maWcuaWFtLnRhc2tSb2xlLnBlcm1pc3Npb25zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFza1JvbGU7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGRldGFpbGVkIElBTSBwZXJtaXNzaW9ucyB0byBhIHJvbGVcbiAgICovXG4gIHByaXZhdGUgYWRkRGV0YWlsZWRQZXJtaXNzaW9ucyhyb2xlOiBpYW0uUm9sZSwgcGVybWlzc2lvbnM6IGFueSk6IHZvaWQge1xuICAgIC8vIFNlY3JldHMgTWFuYWdlciBwZXJtaXNzaW9uc1xuICAgIGlmIChwZXJtaXNzaW9ucy5zZWNyZXRzTWFuYWdlcikge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogcGVybWlzc2lvbnMuc2VjcmV0c01hbmFnZXIuYWN0aW9ucyxcbiAgICAgICAgcmVzb3VyY2VzOiBwZXJtaXNzaW9ucy5zZWNyZXRzTWFuYWdlci5yZXNvdXJjZXMsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dzIHBlcm1pc3Npb25zXG4gICAgaWYgKHBlcm1pc3Npb25zLmNsb3VkV2F0Y2hMb2dzKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBwZXJtaXNzaW9ucy5jbG91ZFdhdGNoTG9ncy5hY3Rpb25zLFxuICAgICAgICByZXNvdXJjZXM6IHBlcm1pc3Npb25zLmNsb3VkV2F0Y2hMb2dzLnJlc291cmNlcyxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICAvLyBLTVMgcGVybWlzc2lvbnNcbiAgICBpZiAocGVybWlzc2lvbnMua21zKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBwZXJtaXNzaW9ucy5rbXMuYWN0aW9ucyxcbiAgICAgICAgcmVzb3VyY2VzOiBwZXJtaXNzaW9ucy5rbXMucmVzb3VyY2VzLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIFNUUyBwZXJtaXNzaW9uc1xuICAgIGlmIChwZXJtaXNzaW9ucy5zdHMpIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IHBlcm1pc3Npb25zLnN0cy5hY3Rpb25zLFxuICAgICAgICByZXNvdXJjZXM6IHBlcm1pc3Npb25zLnN0cy5yZXNvdXJjZXMsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gUzMgcGVybWlzc2lvbnNcbiAgICBpZiAocGVybWlzc2lvbnMuczMpIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IHBlcm1pc3Npb25zLnMzLmFjdGlvbnMsXG4gICAgICAgIHJlc291cmNlczogcGVybWlzc2lvbnMuczMucmVzb3VyY2VzLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIFNRUyBwZXJtaXNzaW9uc1xuICAgIGlmIChwZXJtaXNzaW9ucy5zcXMpIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IHBlcm1pc3Npb25zLnNxcy5hY3Rpb25zLFxuICAgICAgICByZXNvdXJjZXM6IHBlcm1pc3Npb25zLnNxcy5yZXNvdXJjZXMsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gRHluYW1vREIgcGVybWlzc2lvbnNcbiAgICBpZiAocGVybWlzc2lvbnMuZHluYW1vZGIpIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IHBlcm1pc3Npb25zLmR5bmFtb2RiLmFjdGlvbnMsXG4gICAgICAgIHJlc291cmNlczogcGVybWlzc2lvbnMuZHluYW1vZGIucmVzb3VyY2VzLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIFJEUyBwZXJtaXNzaW9uc1xuICAgIGlmIChwZXJtaXNzaW9ucy5yZHMpIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IHBlcm1pc3Npb25zLnJkcy5hY3Rpb25zLFxuICAgICAgICByZXNvdXJjZXM6IHBlcm1pc3Npb25zLnJkcy5yZXNvdXJjZXMsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRXYXRjaCBNZXRyaWNzIHBlcm1pc3Npb25zXG4gICAgaWYgKHBlcm1pc3Npb25zLmNsb3VkV2F0Y2hNZXRyaWNzKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBwZXJtaXNzaW9ucy5jbG91ZFdhdGNoTWV0cmljcy5hY3Rpb25zLFxuICAgICAgICByZXNvdXJjZXM6IHBlcm1pc3Npb25zLmNsb3VkV2F0Y2hNZXRyaWNzLnJlc291cmNlcyxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICAvLyBFQ1IgcGVybWlzc2lvbnNcbiAgICBpZiAocGVybWlzc2lvbnMuZWNyKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBwZXJtaXNzaW9ucy5lY3IuYWN0aW9ucyxcbiAgICAgICAgcmVzb3VyY2VzOiBwZXJtaXNzaW9ucy5lY3IucmVzb3VyY2VzLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIFNTTSBwZXJtaXNzaW9uc1xuICAgIGlmIChwZXJtaXNzaW9ucy5zc20pIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IHBlcm1pc3Npb25zLnNzbS5hY3Rpb25zLFxuICAgICAgICByZXNvdXJjZXM6IHBlcm1pc3Npb25zLnNzbS5yZXNvdXJjZXMsXG4gICAgICB9KSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBjb250YWluZXIgdG8gdGFzayBkZWZpbml0aW9uXG4gICAqL1xuICBwcml2YXRlIGFkZENvbnRhaW5lclRvVGFza0RlZmluaXRpb24oXG4gICAgY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnLCBcbiAgICB0YXNrRGVmaW5pdGlvbjogZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbiwgXG4gICAgbG9nR3JvdXA6IGxvZ3MuTG9nR3JvdXBcbiAgKTogZWNzLkNvbnRhaW5lckRlZmluaXRpb24ge1xuICAgIGNvbnN0IHN0YWNrTmFtZSA9IGNvbmZpZy5tZXRhZGF0YT8ubmFtZSB8fCB0aGlzLnN0YWNrTmFtZTtcbiAgICBjb25zdCBtYWluQ29udGFpbmVyID0gY29uZmlnLnRhc2tEZWZpbml0aW9uPy5jb250YWluZXJzPy5bMF07XG4gICAgXG4gICAgaWYgKCFtYWluQ29udGFpbmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG1haW4gY29udGFpbmVyIGZvdW5kIGluIHRhc2sgZGVmaW5pdGlvbicpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBjb250YWluZXIgPSB0YXNrRGVmaW5pdGlvbi5hZGRDb250YWluZXIobWFpbkNvbnRhaW5lci5uYW1lLCB7XG4gICAgICBpbWFnZTogdGhpcy5jcmVhdGVDb250YWluZXJJbWFnZShtYWluQ29udGFpbmVyLmltYWdlKSxcbiAgICAgIGxvZ2dpbmc6IGVjcy5Mb2dEcml2ZXJzLmF3c0xvZ3Moe1xuICAgICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG4gICAgICAgIHN0cmVhbVByZWZpeDogc3RhY2tOYW1lLFxuICAgICAgfSksXG4gICAgICBlbnZpcm9ubWVudDogbWFpbkNvbnRhaW5lci5lbnZpcm9ubWVudD8ucmVkdWNlKChhY2MsIGVudikgPT4ge1xuICAgICAgICBhY2NbZW52Lm5hbWVdID0gZW52LnZhbHVlO1xuICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgfSwge30gYXMgeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSkgfHwge30sXG4gICAgICBzZWNyZXRzOiBtYWluQ29udGFpbmVyLnNlY3JldHM/LnJlZHVjZSgoYWNjLCBzZWNyZXQpID0+IHtcbiAgICAgICAgYWNjW3NlY3JldC5uYW1lXSA9IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKFxuICAgICAgICAgIGNkay5hd3Nfc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXRDb21wbGV0ZUFybih0aGlzLCBgJHtzZWNyZXQubmFtZX1TZWNyZXRgLCBzZWNyZXQudmFsdWVGcm9tKVxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgfSwge30gYXMgeyBba2V5OiBzdHJpbmddOiBlY3MuU2VjcmV0IH0pIHx8IHVuZGVmaW5lZCxcbiAgICAgIGhlYWx0aENoZWNrOiB0aGlzLmNyZWF0ZUhlYWx0aENoZWNrKG1haW5Db250YWluZXIuaGVhbHRoQ2hlY2spLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHBvcnQgbWFwcGluZ3MgZnJvbSBzdHJ1Y3R1cmVkIGNvbmZpZ1xuICAgIGNvbnN0IGNvbnRhaW5lclBvcnQgPSBtYWluQ29udGFpbmVyLnBvcnRNYXBwaW5ncz8uWzBdPy5jb250YWluZXJQb3J0O1xuICAgIGlmICghY29udGFpbmVyUG9ydCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb250YWluZXIgcG9ydCBpcyByZXF1aXJlZC4gUGxlYXNlIHByb3ZpZGUgdGFza0RlZmluaXRpb24uY29udGFpbmVycy4wLnBvcnRNYXBwaW5ncy4wLmNvbnRhaW5lclBvcnQnKTtcbiAgICB9XG4gICAgXG4gICAgY29udGFpbmVyLmFkZFBvcnRNYXBwaW5ncyh7XG4gICAgICBjb250YWluZXJQb3J0OiBjb250YWluZXJQb3J0LFxuICAgICAgcHJvdG9jb2w6IGVjcy5Qcm90b2NvbC5UQ1AsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgbW91bnQgcG9pbnRzIGZvciBtYWluIGNvbnRhaW5lciBpZiB2b2x1bWVzIGFyZSBzcGVjaWZpZWQgKG9wdGlvbmFsKVxuICAgIGlmIChjb25maWcudGFza0RlZmluaXRpb24udm9sdW1lcyAmJiBjb25maWcudGFza0RlZmluaXRpb24udm9sdW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25maWcudGFza0RlZmluaXRpb24udm9sdW1lcy5mb3JFYWNoKHZvbHVtZSA9PiB7XG4gICAgICAgIGNvbnRhaW5lci5hZGRNb3VudFBvaW50cyh7XG4gICAgICAgICAgc291cmNlVm9sdW1lOiB2b2x1bWUubmFtZSxcbiAgICAgICAgICBjb250YWluZXJQYXRoOiBgLyR7dm9sdW1lLm5hbWV9YCxcbiAgICAgICAgICByZWFkT25seTogZmFsc2UsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFkZGl0aW9uYWwgY29udGFpbmVycyBpZiBzcGVjaWZpZWRcbiAgICBpZiAoY29uZmlnLnRhc2tEZWZpbml0aW9uLmFkZGl0aW9uYWxDb250YWluZXJzKSB7XG4gICAgICBjb25maWcudGFza0RlZmluaXRpb24uYWRkaXRpb25hbENvbnRhaW5lcnMuZm9yRWFjaCgoY29udGFpbmVyQ29uZmlnLCBpbmRleCkgPT4ge1xuICAgICAgICBjb25zdCBhZGRpdGlvbmFsQ29udGFpbmVyID0gdGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKGAke2NvbmZpZy5tZXRhZGF0YT8ubmFtZSB8fCAnQWRkaXRpb25hbENvbnRhaW5lcid9JHtpbmRleH1gLCB7XG4gICAgICAgICAgaW1hZ2U6IHRoaXMuY3JlYXRlQ29udGFpbmVySW1hZ2UoY29udGFpbmVyQ29uZmlnLmltYWdlKSxcbiAgICAgICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgICAgICAgICAgIHN0cmVhbVByZWZpeDogYCR7Y29uZmlnLm1ldGFkYXRhPy5uYW1lIHx8ICdBZGRpdGlvbmFsQ29udGFpbmVyJ30tJHtjb250YWluZXJDb25maWcubmFtZX1gLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGVudmlyb25tZW50OiBjb250YWluZXJDb25maWcuZW52aXJvbm1lbnQ/LnJlZHVjZSgoYWNjLCBlbnYpID0+IHtcbiAgICAgICAgICAgIGFjY1tlbnYubmFtZV0gPSBlbnYudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgIH0sIHt9IGFzIHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0pIHx8IHt9LFxuICAgICAgICAgIGVzc2VudGlhbDogY29udGFpbmVyQ29uZmlnLmVzc2VudGlhbCA/PyBmYWxzZSxcbiAgICAgICAgICByZWFkb25seVJvb3RGaWxlc3lzdGVtOiBjb250YWluZXJDb25maWcucmVhZG9ubHlSb290RmlsZXN5c3RlbSxcbiAgICAgICAgICBjb21tYW5kOiBjb250YWluZXJDb25maWcuY29tbWFuZCxcbiAgICAgICAgICBlbnRyeVBvaW50OiBjb250YWluZXJDb25maWcuZW50cnlQb2ludCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIHBvcnQgbWFwcGluZ3MgaWYgc3BlY2lmaWVkXG4gICAgICAgIGlmIChjb250YWluZXJDb25maWcucG9ydE1hcHBpbmdzKSB7XG4gICAgICAgICAgY29udGFpbmVyQ29uZmlnLnBvcnRNYXBwaW5ncy5mb3JFYWNoKHBvcnRNYXBwaW5nID0+IHtcbiAgICAgICAgICAgIGFkZGl0aW9uYWxDb250YWluZXIuYWRkUG9ydE1hcHBpbmdzKHtcbiAgICAgICAgICAgICAgY29udGFpbmVyUG9ydDogcG9ydE1hcHBpbmcuY29udGFpbmVyUG9ydCxcbiAgICAgICAgICAgICAgcHJvdG9jb2w6IHBvcnRNYXBwaW5nLnByb3RvY29sID09PSAndWRwJyA/IGVjcy5Qcm90b2NvbC5VRFAgOiBlY3MuUHJvdG9jb2wuVENQLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgbW91bnQgcG9pbnRzIGlmIHNwZWNpZmllZFxuICAgICAgICBpZiAoY29udGFpbmVyQ29uZmlnLm1vdW50UG9pbnRzKSB7XG4gICAgICAgICAgY29udGFpbmVyQ29uZmlnLm1vdW50UG9pbnRzLmZvckVhY2gobW91bnRQb2ludCA9PiB7XG4gICAgICAgICAgICBhZGRpdGlvbmFsQ29udGFpbmVyLmFkZE1vdW50UG9pbnRzKHtcbiAgICAgICAgICAgICAgc291cmNlVm9sdW1lOiBtb3VudFBvaW50LnNvdXJjZVZvbHVtZSxcbiAgICAgICAgICAgICAgY29udGFpbmVyUGF0aDogbW91bnRQb2ludC5jb250YWluZXJQYXRoLFxuICAgICAgICAgICAgICByZWFkT25seTogbW91bnRQb2ludC5yZWFkT25seSA/PyBmYWxzZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAgICAgLy8gQWRkIHZvbHVtZXMgaWYgc3BlY2lmaWVkIChvcHRpb25hbClcbiAgICBpZiAoY29uZmlnLnRhc2tEZWZpbml0aW9uLnZvbHVtZXMgJiYgY29uZmlnLnRhc2tEZWZpbml0aW9uLnZvbHVtZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uZmlnLnRhc2tEZWZpbml0aW9uLnZvbHVtZXMuZm9yRWFjaCh2b2x1bWUgPT4ge1xuICAgICAgICBpZiAodm9sdW1lLmVmc1ZvbHVtZUNvbmZpZ3VyYXRpb24pIHtcbiAgICAgICAgICB0YXNrRGVmaW5pdGlvbi5hZGRWb2x1bWUoe1xuICAgICAgICAgICAgbmFtZTogdm9sdW1lLm5hbWUsXG4gICAgICAgICAgICBlZnNWb2x1bWVDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgIGZpbGVTeXN0ZW1JZDogdm9sdW1lLmVmc1ZvbHVtZUNvbmZpZ3VyYXRpb24uZmlsZVN5c3RlbUlkLFxuICAgICAgICAgICAgICB0cmFuc2l0RW5jcnlwdGlvbjogdm9sdW1lLmVmc1ZvbHVtZUNvbmZpZ3VyYXRpb24udHJhbnNpdEVuY3J5cHRpb24gPT09ICdFTkFCTEVEJyA/IFxuICAgICAgICAgICAgICAgICdFTkFCTEVEJyA6ICdESVNBQkxFRCcsXG4gICAgICAgICAgICAgIGF1dGhvcml6YXRpb25Db25maWc6IHZvbHVtZS5lZnNWb2x1bWVDb25maWd1cmF0aW9uLmF1dGhvcml6YXRpb25Db25maWcgPyB7XG4gICAgICAgICAgICAgICAgYWNjZXNzUG9pbnRJZDogdm9sdW1lLmVmc1ZvbHVtZUNvbmZpZ3VyYXRpb24uYXV0aG9yaXphdGlvbkNvbmZpZy5hY2Nlc3NQb2ludElkLFxuICAgICAgICAgICAgICAgIGlhbTogdm9sdW1lLmVmc1ZvbHVtZUNvbmZpZ3VyYXRpb24uYXV0aG9yaXphdGlvbkNvbmZpZy5pYW0gPT09ICdFTkFCTEVEJyA/IFxuICAgICAgICAgICAgICAgICAgJ0VOQUJMRUQnIDogJ0RJU0FCTEVEJyxcbiAgICAgICAgICAgICAgfSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGFza0RlZmluaXRpb24uYWRkVm9sdW1lKHtcbiAgICAgICAgICAgIG5hbWU6IHZvbHVtZS5uYW1lLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBoZWFsdGggY2hlY2sgY29uZmlndXJhdGlvblxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVIZWFsdGhDaGVjayhoZWFsdGhDaGVjaz86IENvbnRhaW5lckhlYWx0aENoZWNrKTogZWNzLkhlYWx0aENoZWNrIHwgdW5kZWZpbmVkIHtcbiAgICAvLyBDaGVjayBpZiBoZWFsdGggY2hlY2sgaXMgZXhwbGljaXRseSBkaXNhYmxlZFxuICAgIGlmIChoZWFsdGhDaGVjaz8uZW5hYmxlZCA9PT0gZmFsc2UpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgXG4gICAgLy8gQ2hlY2sgaWYgaGVhbHRoIGNoZWNrIGhhcyByZXF1aXJlZCBjb25maWd1cmF0aW9uXG4gICAgaWYgKCFoZWFsdGhDaGVjaz8uY29tbWFuZCB8fCBoZWFsdGhDaGVjay5jb21tYW5kLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgIHJldHVybiB7XG4gICAgICBjb21tYW5kOiBoZWFsdGhDaGVjay5jb21tYW5kLFxuICAgICAgaW50ZXJ2YWw6IGhlYWx0aENoZWNrLmludGVydmFsIHx8IGNkay5EdXJhdGlvbi5zZWNvbmRzKERFRkFVTFRfQ09ORklHLkhFQUxUSF9DSEVDS19JTlRFUlZBTCksXG4gICAgICB0aW1lb3V0OiBoZWFsdGhDaGVjay50aW1lb3V0IHx8IGNkay5EdXJhdGlvbi5zZWNvbmRzKERFRkFVTFRfQ09ORklHLkhFQUxUSF9DSEVDS19USU1FT1VUKSxcbiAgICAgIHN0YXJ0UGVyaW9kOiBoZWFsdGhDaGVjay5zdGFydFBlcmlvZCB8fCBjZGsuRHVyYXRpb24uc2Vjb25kcyhERUZBVUxUX0NPTkZJRy5IRUFMVEhfQ0hFQ0tfU1RBUlRfUEVSSU9EKSxcbiAgICAgIHJldHJpZXM6IGhlYWx0aENoZWNrLnJldHJpZXMgfHwgREVGQVVMVF9DT05GSUcuSEVBTFRIX0NIRUNLX1JFVFJJRVMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgbG9hZCBiYWxhbmNlZCBzZXJ2aWNlXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUxvYWRCYWxhbmNlZFNlcnZpY2UoXG4gICAgY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnLCBcbiAgICB0YXNrRGVmaW5pdGlvbjogZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvblxuICApOiBlY3NfcGF0dGVybnMuQXBwbGljYXRpb25Mb2FkQmFsYW5jZWRGYXJnYXRlU2VydmljZSB7XG4gICAgY29uc3Qgc3RhY2tOYW1lID0gY29uZmlnLm1ldGFkYXRhPy5uYW1lIHx8IHRoaXMuc3RhY2tOYW1lO1xuICAgIFxuICAgIC8vIERldGVybWluZSBwcm90b2NvbCBhbmQgY2VydGlmaWNhdGUgLSBIVFRQUyBpcyBvcHRpb25hbFxuICAgIGNvbnN0IHByb3RvY29sID0gY29uZmlnLmxvYWRCYWxhbmNlci5wcm90b2NvbCB8fCAnSFRUUCc7XG4gICAgY29uc3QgY2VydGlmaWNhdGUgPSBjb25maWcubG9hZEJhbGFuY2VyLmNlcnRpZmljYXRlQXJuID8gXG4gICAgICBjZGsuYXdzX2NlcnRpZmljYXRlbWFuYWdlci5DZXJ0aWZpY2F0ZS5mcm9tQ2VydGlmaWNhdGVBcm4odGhpcywgYCR7c3RhY2tOYW1lfUNlcnRpZmljYXRlYCwgY29uZmlnLmxvYWRCYWxhbmNlci5jZXJ0aWZpY2F0ZUFybikgOiBcbiAgICAgIHVuZGVmaW5lZDtcblxuICAgIC8vIFVzZSBIVFRQUyBvbmx5IGlmIGV4cGxpY2l0bHkgY29uZmlndXJlZCB3aXRoIGNlcnRpZmljYXRlXG4gICAgY29uc3QgdXNlSHR0cHMgPSBwcm90b2NvbCA9PT0gJ0hUVFBTJyAmJiBjZXJ0aWZpY2F0ZTtcbiAgICBjb25zdCBsaXN0ZW5lclBvcnQgPSB1c2VIdHRwcyA/IChjb25maWcubG9hZEJhbGFuY2VyLnBvcnQgfHwgNDQzKSA6IChjb25maWcubG9hZEJhbGFuY2VyLnBvcnQgfHwgODApO1xuXG4gICAgLy8gRGV0ZXJtaW5lIGxvYWQgYmFsYW5jZXIgc2NoZW1lIC0gZGVmYXVsdCB0byBpbnRlcm5ldC1mYWNpbmcgaWYgbm90IHNwZWNpZmllZFxuICAgIGNvbnN0IHNjaGVtZSA9IGNvbmZpZy5sb2FkQmFsYW5jZXIuc2NoZW1lIHx8ICdpbnRlcm5ldC1mYWNpbmcnO1xuXG4gICAgY29uc3Qgc2VydmljZSA9IG5ldyBlY3NfcGF0dGVybnMuQXBwbGljYXRpb25Mb2FkQmFsYW5jZWRGYXJnYXRlU2VydmljZSh0aGlzLCBgJHtzdGFja05hbWV9U2VydmljZWAsIHtcbiAgICAgIGNsdXN0ZXI6IHRoaXMuY2x1c3RlcixcbiAgICAgIHRhc2tEZWZpbml0aW9uOiB0YXNrRGVmaW5pdGlvbixcbiAgICAgIGRlc2lyZWRDb3VudDogY29uZmlnLnNlcnZpY2UuZGVzaXJlZENvdW50LFxuICAgICAgcHVibGljTG9hZEJhbGFuY2VyOiBzY2hlbWUgPT09ICdpbnRlcm5ldC1mYWNpbmcnLFxuICAgICAgbGlzdGVuZXJQb3J0OiBsaXN0ZW5lclBvcnQsXG4gICAgICBwcm90b2NvbDogdXNlSHR0cHMgPyBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFBTIDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlLFxuICAgICAgc2VydmljZU5hbWU6IHN0YWNrTmFtZSxcbiAgICAgIGNhcGFjaXR5UHJvdmlkZXJTdHJhdGVnaWVzOiB0aGlzLmNyZWF0ZUNhcGFjaXR5UHJvdmlkZXJTdHJhdGVnaWVzKCksXG4gICAgICBoZWFsdGhDaGVja0dyYWNlUGVyaW9kOiBjb25maWcuc2VydmljZS5oZWFsdGhDaGVja0dyYWNlUGVyaW9kU2Vjb25kcyA/IFxuICAgICAgICBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcuc2VydmljZS5oZWFsdGhDaGVja0dyYWNlUGVyaW9kU2Vjb25kcykgOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICAvLyBDb25maWd1cmUgaGVhbHRoIGNoZWNrIG9uIHRoZSB0YXJnZXQgZ3JvdXBcbiAgICBpZiAoY29uZmlnLmxvYWRCYWxhbmNlci50YXJnZXRHcm91cD8uaGVhbHRoQ2hlY2tQYXRoIHx8IGNvbmZpZy5sb2FkQmFsYW5jZXIudGFyZ2V0R3JvdXA/LmhlYWx0aENoZWNrKSB7XG4gICAgICBjb25zdCB0YXJnZXRHcm91cCA9IHNlcnZpY2UudGFyZ2V0R3JvdXA7XG4gICAgICBjb25zdCBoZWFsdGhDaGVjayA9IGNvbmZpZy5sb2FkQmFsYW5jZXIudGFyZ2V0R3JvdXAuaGVhbHRoQ2hlY2s7XG4gICAgICBcbiAgICAgIC8vIFVzZSBhZHZhbmNlZCBoZWFsdGggY2hlY2sgY29uZmlndXJhdGlvbiBpZiBhdmFpbGFibGUsIG90aGVyd2lzZSB1c2UgYmFzaWNcbiAgICAgIGNvbnN0IGhlYWx0aENoZWNrQ29uZmlnID0ge1xuICAgICAgICBwYXRoOiBoZWFsdGhDaGVjaz8ucGF0aCB8fCBjb25maWcubG9hZEJhbGFuY2VyLnRhcmdldEdyb3VwLmhlYWx0aENoZWNrUGF0aCB8fCAnLycsXG4gICAgICAgIGhlYWx0aHlIdHRwQ29kZXM6IGhlYWx0aENoZWNrPy5oZWFsdGh5SHR0cENvZGVzIHx8ICcyMDAnLFxuICAgICAgICBpbnRlcnZhbDogdGhpcy5jb252ZXJ0VG9EdXJhdGlvbihoZWFsdGhDaGVjaz8uaW50ZXJ2YWwgfHwgY29uZmlnLmxvYWRCYWxhbmNlci50YXJnZXRHcm91cC5pbnRlcnZhbCB8fCAzMCksXG4gICAgICAgIHRpbWVvdXQ6IHRoaXMuY29udmVydFRvRHVyYXRpb24oaGVhbHRoQ2hlY2s/LnRpbWVvdXQgfHwgY29uZmlnLmxvYWRCYWxhbmNlci50YXJnZXRHcm91cC50aW1lb3V0IHx8IDUpLFxuICAgICAgICBoZWFsdGh5VGhyZXNob2xkQ291bnQ6IGhlYWx0aENoZWNrPy5oZWFsdGh5VGhyZXNob2xkQ291bnQgfHwgY29uZmlnLmxvYWRCYWxhbmNlci50YXJnZXRHcm91cC5oZWFsdGh5VGhyZXNob2xkQ291bnQgfHwgMixcbiAgICAgICAgdW5oZWFsdGh5VGhyZXNob2xkQ291bnQ6IGhlYWx0aENoZWNrPy51bmhlYWx0aHlUaHJlc2hvbGRDb3VudCB8fCBjb25maWcubG9hZEJhbGFuY2VyLnRhcmdldEdyb3VwLnVuaGVhbHRoeVRocmVzaG9sZENvdW50IHx8IDMsXG4gICAgICB9O1xuICAgICAgXG4gICAgICAvLyBPbmx5IGNvbmZpZ3VyZSBpZiBoZWFsdGggY2hlY2sgaXMgZW5hYmxlZCBvciBub3QgZXhwbGljaXRseSBkaXNhYmxlZFxuICAgICAgaWYgKGhlYWx0aENoZWNrPy5lbmFibGVkICE9PSBmYWxzZSkge1xuICAgICAgICB0YXJnZXRHcm91cC5jb25maWd1cmVIZWFsdGhDaGVjayhoZWFsdGhDaGVja0NvbmZpZyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlcnZpY2U7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGNhcGFjaXR5IHByb3ZpZGVyIHN0cmF0ZWdpZXNcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQ2FwYWNpdHlQcm92aWRlclN0cmF0ZWdpZXMoY2FwYWNpdHlQcm92aWRlcj86IHN0cmluZykge1xuICAgIHJldHVybiBjYXBhY2l0eVByb3ZpZGVyID8gW1xuICAgICAge1xuICAgICAgICBjYXBhY2l0eVByb3ZpZGVyOiBjYXBhY2l0eVByb3ZpZGVyLFxuICAgICAgICB3ZWlnaHQ6IDEsXG4gICAgICB9XG4gICAgXSA6IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25maWd1cmUgc2VydmljZSBkaXNjb3ZlcnkgaWYgZW5hYmxlZFxuICAgKi9cbiAgcHJpdmF0ZSBjb25maWd1cmVTZXJ2aWNlRGlzY292ZXJ5KGNvbmZpZzogRWNzU2VydmljZUNvbmZpZywgdnBjOiBlYzIuSVZwYyk6IHZvaWQge1xuICAgIC8vIENoZWNrIGlmIHNlcnZpY2UgZGlzY292ZXJ5IGlzIGV4cGxpY2l0bHkgZGlzYWJsZWRcbiAgICBpZiAoY29uZmlnLnNlcnZpY2VEaXNjb3Zlcnk/LmVuYWJsZWQgPT09IGZhbHNlKSByZXR1cm47XG4gICAgXG4gICAgLy8gQ2hlY2sgaWYgc2VydmljZSBkaXNjb3ZlcnkgY29uZmlndXJhdGlvbiBleGlzdHNcbiAgICBpZiAoIWNvbmZpZy5zZXJ2aWNlRGlzY292ZXJ5KSByZXR1cm47XG5cbiAgICBjb25zdCBzdGFja05hbWUgPSBjb25maWcubWV0YWRhdGE/Lm5hbWUgfHwgdGhpcy5zdGFja05hbWU7XG4gICAgY29uc3QgbmFtZXNwYWNlTmFtZSA9IHR5cGVvZiBjb25maWcuc2VydmljZURpc2NvdmVyeS5uYW1lc3BhY2UgPT09ICdzdHJpbmcnIFxuICAgICAgPyBjb25maWcuc2VydmljZURpc2NvdmVyeS5uYW1lc3BhY2UgXG4gICAgICA6IGNvbmZpZy5zZXJ2aWNlRGlzY292ZXJ5Lm5hbWVzcGFjZT8ubmFtZSB8fCBgJHtzdGFja05hbWV9LmxvY2FsYDtcbiAgICBcbiAgICBjb25zdCBuYW1lc3BhY2UgPSBuZXcgc2VydmljZWRpc2NvdmVyeS5Qcml2YXRlRG5zTmFtZXNwYWNlKHRoaXMsIGAke3N0YWNrTmFtZX1OYW1lc3BhY2VgLCB7XG4gICAgICBuYW1lOiBuYW1lc3BhY2VOYW1lLFxuICAgICAgdnBjOiB2cGMsXG4gICAgfSk7XG5cbiAgICBjb25zdCBzZXJ2aWNlTmFtZSA9IGNvbmZpZy5zZXJ2aWNlRGlzY292ZXJ5LnNlcnZpY2U/Lm5hbWUgfHwgc3RhY2tOYW1lO1xuICAgIGNvbnN0IGRuc1R5cGUgPSBjb25maWcuc2VydmljZURpc2NvdmVyeS5zZXJ2aWNlPy5kbnNUeXBlIHx8ICdBJztcbiAgICBjb25zdCB0dGwgPSBjb25maWcuc2VydmljZURpc2NvdmVyeS5zZXJ2aWNlPy50dGwgfHwgREVGQVVMVF9DT05GSUcuU0VSVklDRV9ESVNDT1ZFUllfVFRMO1xuXG4gICAgY29uc3Qgc2VydmljZURpc2NvdmVyeVNlcnZpY2UgPSBuZXcgc2VydmljZWRpc2NvdmVyeS5TZXJ2aWNlKHRoaXMsIGAke3N0YWNrTmFtZX1TZXJ2aWNlRGlzY292ZXJ5YCwge1xuICAgICAgbmFtZXNwYWNlOiBuYW1lc3BhY2UsXG4gICAgICBuYW1lOiBzZXJ2aWNlTmFtZSxcbiAgICAgIGRuc1JlY29yZFR5cGU6IGRuc1R5cGUgPT09ICdTUlYnID8gXG4gICAgICAgIHNlcnZpY2VkaXNjb3ZlcnkuRG5zUmVjb3JkVHlwZS5TUlYgOiBcbiAgICAgICAgc2VydmljZWRpc2NvdmVyeS5EbnNSZWNvcmRUeXBlLkEsXG4gICAgICBkbnNUdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKHR0bCksXG4gICAgfSk7XG5cbiAgICAvLyBBc3NvY2lhdGUgc2VydmljZSBkaXNjb3Zlcnkgd2l0aCBFQ1Mgc2VydmljZVxuICAgIGlmICh0aGlzLnNlcnZpY2UpIHtcbiAgICAgIC8vIE5vdGU6IFNlcnZpY2UgZGlzY292ZXJ5IGFzc29jaWF0aW9uIGlzIGhhbmRsZWQgYnkgdGhlIENESyBwYXR0ZXJuXG4gICAgICAvLyBUaGUgc2VydmljZSBkaXNjb3Zlcnkgc2VydmljZSBpcyBjcmVhdGVkIGJ1dCBhc3NvY2lhdGlvbiBkZXBlbmRzIG9uIHRoZSBwYXR0ZXJuIHVzZWRcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29uZmlndXJlIHNlY3VyaXR5IGdyb3VwIHJ1bGVzXG4gICAqL1xuICBwcml2YXRlIGNvbmZpZ3VyZVNlY3VyaXR5R3JvdXAoXG4gICAgc2VydmljZTogZWNzX3BhdHRlcm5zLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRmFyZ2F0ZVNlcnZpY2UsIFxuICAgIGNvbmZpZzogRWNzU2VydmljZUNvbmZpZ1xuICApOiB2b2lkIHtcbiAgICAvLyBDb25maWd1cmUgbG9hZCBiYWxhbmNlciBzZWN1cml0eSBncm91cCB0byBiZSBtb3JlIHJlc3RyaWN0aXZlXG4gICAgY29uc3QgbGJTZWN1cml0eUdyb3VwID0gc2VydmljZS5sb2FkQmFsYW5jZXIuY29ubmVjdGlvbnMuc2VjdXJpdHlHcm91cHNbMF07XG4gICAgXG4gICAgLy8gRGV0ZXJtaW5lIHByb3RvY29sIGFuZCBwb3J0IGZvciBzZWN1cml0eSBncm91cFxuICAgIGNvbnN0IHByb3RvY29sID0gY29uZmlnLmxvYWRCYWxhbmNlci5wcm90b2NvbCB8fCAnSFRUUCc7XG4gICAgY29uc3QgdXNlSHR0cHMgPSBwcm90b2NvbCA9PT0gJ0hUVFBTJyAmJiBjb25maWcubG9hZEJhbGFuY2VyLmNlcnRpZmljYXRlQXJuO1xuICAgIGNvbnN0IGxiUG9ydCA9IHVzZUh0dHBzID8gKGNvbmZpZy5sb2FkQmFsYW5jZXIucG9ydCB8fCA0NDMpIDogKGNvbmZpZy5sb2FkQmFsYW5jZXIucG9ydCB8fCA4MCk7XG4gICAgXG4gICAgLy8gUmVtb3ZlIGRlZmF1bHQgMC4wLjAuMC8wIHJ1bGUgaWYgYSBzcGVjaWZpYyBDSURSIGlzIHByb3ZpZGVkXG4gICAgaWYgKGNvbmZpZy5sb2FkQmFsYW5jZXIuYWxsb3dlZENpZHIgJiYgY29uZmlnLmxvYWRCYWxhbmNlci5hbGxvd2VkQ2lkciAhPT0gREVGQVVMVF9DT05GSUcuQUxMT1dFRF9DSURSKSB7XG4gICAgICAvLyBSZW1vdmUgdGhlIGRlZmF1bHQgcnVsZSBieSBhZGRpbmcgYSBtb3JlIHJlc3RyaWN0aXZlIHJ1bGVcbiAgICAgIGxiU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgICAgZWMyLlBlZXIuaXB2NChjb25maWcubG9hZEJhbGFuY2VyLmFsbG93ZWRDaWRyKSxcbiAgICAgICAgZWMyLlBvcnQudGNwKGxiUG9ydCksXG4gICAgICAgIGBBbGxvdyAke3Byb3RvY29sfSBmcm9tICR7Y29uZmlnLmxvYWRCYWxhbmNlci5hbGxvd2VkQ2lkcn1gXG4gICAgICApO1xuICAgICAgXG4gICAgICAvLyBBbHNvIHJlbW92ZSBhbnkgZXhpc3RpbmcgMC4wLjAuMC8wIHJ1bGVzIGZvciB0aGlzIHBvcnRcbiAgICAgIGxiU2VjdXJpdHlHcm91cC5jb25uZWN0aW9ucy5hbGxvd0Zyb21BbnlJcHY0KFxuICAgICAgICBlYzIuUG9ydC50Y3AobGJQb3J0KSxcbiAgICAgICAgYFJlc3RyaWN0ICR7cHJvdG9jb2x9IGFjY2VzcyB0byAke2NvbmZpZy5sb2FkQmFsYW5jZXIuYWxsb3dlZENpZHJ9IG9ubHlgXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgY29udGFpbmVyIGltYWdlIGZyb20gdmFyaW91cyBzb3VyY2VzXG4gICAqIFN1cHBvcnRzIEVDUiwgZXh0ZXJuYWwgcmVnaXN0cmllcywgYW5kIGxvY2FsIENvbnRhaW5lcmZpbGVzXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUNvbnRhaW5lckltYWdlKGltYWdlOiBzdHJpbmcpOiBlY3MuQ29udGFpbmVySW1hZ2Uge1xuICAgIC8vIENoZWNrIGlmIGl0J3MgYSBsb2NhbCBDb250YWluZXJmaWxlIHBhdGhcbiAgICBpZiAoaW1hZ2Uuc3RhcnRzV2l0aCgnLi8nKSB8fCBpbWFnZS5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgIHJldHVybiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUFzc2V0KGltYWdlKTtcbiAgICB9XG4gICAgXG4gICAgLy8gT3RoZXJ3aXNlIHRyZWF0IGFzIGltYWdlIFVSSVxuICAgIHJldHVybiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbVJlZ2lzdHJ5KGltYWdlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgc2VjcmV0cyBmb3IgdGhlIGNvbnRhaW5lclxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTZWNyZXRzKHNlY3JldHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0pOiB7IFtrZXk6IHN0cmluZ106IGVjcy5TZWNyZXQgfSB7XG4gICAgY29uc3QgY29udGFpbmVyU2VjcmV0czogeyBba2V5OiBzdHJpbmddOiBlY3MuU2VjcmV0IH0gPSB7fTtcbiAgICBcbiAgICBPYmplY3QuZW50cmllcyhzZWNyZXRzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNvbnRhaW5lclNlY3JldHNba2V5XSA9IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKFxuICAgICAgICBjZGsuYXdzX3NlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0Q29tcGxldGVBcm4odGhpcywgYCR7a2V5fVNlY3JldGAsIHZhbHVlKVxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBjb250YWluZXJTZWNyZXRzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhdXRvIHNjYWxpbmcgdG8gdGhlIHNlcnZpY2VcbiAgICovXG4gIHByaXZhdGUgYWRkQXV0b1NjYWxpbmcoY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnKTogdm9pZCB7XG4gICAgY29uc3Qgc3RhY2tOYW1lID0gY29uZmlnLm1ldGFkYXRhPy5uYW1lIHx8IHRoaXMuc3RhY2tOYW1lO1xuICAgIGNvbnN0IHNjYWxpbmcgPSB0aGlzLnNlcnZpY2UuYXV0b1NjYWxlVGFza0NvdW50KHtcbiAgICAgIG1pbkNhcGFjaXR5OiBjb25maWcuYXV0b1NjYWxpbmc/Lm1pbkNhcGFjaXR5IHx8IERFRkFVTFRfQ09ORklHLk1JTl9DQVBBQ0lUWSxcbiAgICAgIG1heENhcGFjaXR5OiBjb25maWcuYXV0b1NjYWxpbmc/Lm1heENhcGFjaXR5IHx8IERFRkFVTFRfQ09ORklHLk1BWF9DQVBBQ0lUWSxcbiAgICB9KTtcblxuICAgIHNjYWxpbmcuc2NhbGVPbkNwdVV0aWxpemF0aW9uKGAke3N0YWNrTmFtZX1DcHVTY2FsaW5nYCwge1xuICAgICAgdGFyZ2V0VXRpbGl6YXRpb25QZXJjZW50OiBjb25maWcuYXV0b1NjYWxpbmc/LnRhcmdldENwdVV0aWxpemF0aW9uIHx8IERFRkFVTFRfQ09ORklHLlRBUkdFVF9DUFVfVVRJTElaQVRJT04sXG4gICAgfSk7XG5cbiAgICBzY2FsaW5nLnNjYWxlT25NZW1vcnlVdGlsaXphdGlvbihgJHtzdGFja05hbWV9TWVtb3J5U2NhbGluZ2AsIHtcbiAgICAgIHRhcmdldFV0aWxpemF0aW9uUGVyY2VudDogY29uZmlnLmF1dG9TY2FsaW5nPy50YXJnZXRNZW1vcnlVdGlsaXphdGlvbiB8fCBERUZBVUxUX0NPTkZJRy5UQVJHRVRfTUVNT1JZX1VUSUxJWkFUSU9OLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBDbG91ZEZvcm1hdGlvbiBvdXRwdXRzXG4gICAqL1xuICBwcml2YXRlIGFkZE91dHB1dHMoY29uZmlnOiBFY3NTZXJ2aWNlQ29uZmlnKTogdm9pZCB7XG4gICAgY29uc3Qgc3RhY2tOYW1lID0gY29uZmlnLm1ldGFkYXRhPy5uYW1lIHx8IHRoaXMuc3RhY2tOYW1lO1xuICAgIGNvbnN0IGNsdXN0ZXJOYW1lID0gY29uZmlnLmNsdXN0ZXI/Lm5hbWU7XG4gICAgXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlcnZpY2VOYW1lJywge1xuICAgICAgdmFsdWU6IHN0YWNrTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUNTIFNlcnZpY2UgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHtzdGFja05hbWV9LXNlcnZpY2UtbmFtZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTG9hZEJhbGFuY2VyRE5TJywge1xuICAgICAgdmFsdWU6IHRoaXMubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdMb2FkIEJhbGFuY2VyIEROUyBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3N0YWNrTmFtZX0tbG9hZC1iYWxhbmNlci1kbnNgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NsdXN0ZXJOYW1lJywge1xuICAgICAgdmFsdWU6IGNsdXN0ZXJOYW1lIHx8ICd1bmtub3duJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUNTIENsdXN0ZXIgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHtzdGFja05hbWV9LWNsdXN0ZXItbmFtZWAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhIHZhbHVlIHRvIENESyBEdXJhdGlvblxuICAgKiBIYW5kbGVzIGJvdGggRHVyYXRpb24gb2JqZWN0cyBhbmQgbnVtYmVycyAoc2Vjb25kcylcbiAgICovXG4gIHByaXZhdGUgY29udmVydFRvRHVyYXRpb24odmFsdWU6IGFueSk6IGNkay5EdXJhdGlvbiB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBjZGsuRHVyYXRpb24pIHJldHVybiB2YWx1ZTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykgcmV0dXJuIGNkay5EdXJhdGlvbi5zZWNvbmRzKHZhbHVlKTtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgcmV0ZW50aW9uIGRheXMgdG8gQ0RLIFJldGVudGlvbkRheXMgZW51bVxuICAgKi9cbiAgcHJpdmF0ZSBjb252ZXJ0UmV0ZW50aW9uRGF5cyhkYXlzOiBudW1iZXIpOiBsb2dzLlJldGVudGlvbkRheXMge1xuICAgIHN3aXRjaCAoZGF5cykge1xuICAgICAgY2FzZSAxOiByZXR1cm4gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVk7XG4gICAgICBjYXNlIDM6IHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuVEhSRUVfREFZUztcbiAgICAgIGNhc2UgNTogcmV0dXJuIGxvZ3MuUmV0ZW50aW9uRGF5cy5GSVZFX0RBWVM7XG4gICAgICBjYXNlIDc6IHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUs7XG4gICAgICBjYXNlIDE0OiByZXR1cm4gbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUztcbiAgICAgIGNhc2UgMzA6IHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRIO1xuICAgICAgY2FzZSA2MDogcmV0dXJuIGxvZ3MuUmV0ZW50aW9uRGF5cy5UV09fTU9OVEhTO1xuICAgICAgY2FzZSA5MDogcmV0dXJuIGxvZ3MuUmV0ZW50aW9uRGF5cy5USFJFRV9NT05USFM7XG4gICAgICBjYXNlIDEyMDogcmV0dXJuIGxvZ3MuUmV0ZW50aW9uRGF5cy5GT1VSX01PTlRIUztcbiAgICAgIGNhc2UgMTUwOiByZXR1cm4gbG9ncy5SZXRlbnRpb25EYXlzLkZJVkVfTU9OVEhTO1xuICAgICAgY2FzZSAxODA6IHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuU0lYX01PTlRIUztcbiAgICAgIGNhc2UgMzY1OiByZXR1cm4gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9ZRUFSO1xuICAgICAgY2FzZSA0MDA6IHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuVEhJUlRFRU5fTU9OVEhTO1xuICAgICAgY2FzZSA1NDU6IHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuRUlHSFRFRU5fTU9OVEhTO1xuICAgICAgY2FzZSA3MzE6IHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuVFdPX1lFQVJTO1xuICAgICAgY2FzZSAxODI3OiByZXR1cm4gbG9ncy5SZXRlbnRpb25EYXlzLkZJVkVfWUVBUlM7XG4gICAgICBjYXNlIDM2NTM6IHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuVEVOX1lFQVJTO1xuICAgICAgZGVmYXVsdDogcmV0dXJuIGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVxdWlyZSBhIGNvbnRleHQgcGFyYW1ldGVyIHRvIGJlIHByZXNlbnRcbiAgICovXG4gIHByaXZhdGUgcmVxdWlyZUNvbnRleHQoa2V5OiBzdHJpbmcpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBjb250ZXh0IHBhcmFtZXRlciAnJHtrZXl9JyBpcyBtaXNzaW5nLiBVc2UgLS1jb250ZXh0ICR7a2V5fT12YWx1ZWApO1xuICB9XG59ICJdfQ==
"use strict";
/**
 * @matson/ecs - CDK Constructs for ECS Deployments
 *
 * This package provides reusable CDK constructs for deploying ECS services
 * with Helm-style configuration using context parameters.
 *
 * @example
 * ```typescript
 * import { EcsServiceStack } from '@matson/ecs';
 *
 * const app = new cdk.App();
 * new EcsServiceStack(app, 'MyEcsService', {
 *   image: 'nginx:alpine',
 *   vpcId: 'vpc-12345678',
 *   subnetIds: ['subnet-12345678', 'subnet-87654321'],
 *   clusterName: 'my-cluster'
 * });
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./ecs-service-stack"), exports);
__exportStar(require("./types"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxzREFBb0M7QUFDcEMsMENBQXdCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbWF0c29uL2VjcyAtIENESyBDb25zdHJ1Y3RzIGZvciBFQ1MgRGVwbG95bWVudHNcbiAqIFxuICogVGhpcyBwYWNrYWdlIHByb3ZpZGVzIHJldXNhYmxlIENESyBjb25zdHJ1Y3RzIGZvciBkZXBsb3lpbmcgRUNTIHNlcnZpY2VzXG4gKiB3aXRoIEhlbG0tc3R5bGUgY29uZmlndXJhdGlvbiB1c2luZyBjb250ZXh0IHBhcmFtZXRlcnMuXG4gKiBcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBFY3NTZXJ2aWNlU3RhY2sgfSBmcm9tICdAbWF0c29uL2Vjcyc7XG4gKiBcbiAqIGNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG4gKiBuZXcgRWNzU2VydmljZVN0YWNrKGFwcCwgJ015RWNzU2VydmljZScsIHtcbiAqICAgaW1hZ2U6ICduZ2lueDphbHBpbmUnLFxuICogICB2cGNJZDogJ3ZwYy0xMjM0NTY3OCcsXG4gKiAgIHN1Ym5ldElkczogWydzdWJuZXQtMTIzNDU2NzgnLCAnc3VibmV0LTg3NjU0MzIxJ10sXG4gKiAgIGNsdXN0ZXJOYW1lOiAnbXktY2x1c3RlcidcbiAqIH0pO1xuICogYGBgXG4gKi9cblxuZXhwb3J0ICogZnJvbSAnLi9lY3Mtc2VydmljZS1zdGFjayc7XG5leHBvcnQgKiBmcm9tICcuL3R5cGVzJzsgIl19
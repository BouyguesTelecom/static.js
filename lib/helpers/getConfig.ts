import * as path from "node:path";
import {CONFIG} from "../server";

export const getConfigSync = () => {
    const stringifiedConsumerConfig = process.env.CONFIG || '{}';
    let consumerConfig: Record<string, any>;
    try {
        consumerConfig = JSON.parse(stringifiedConsumerConfig);
        console.log("Consumer configuration loaded successfully:", consumerConfig);
    } catch (error) {
        console.error("Failed to parse CONFIG environment variable:", error);
        consumerConfig = {};
    }

    return consumerConfig;
};

export const getConfigAsync = async () => {
    const consumerConfig = await import(path.join(CONFIG.PROJECT_ROOT, 'static.config.ts'));
    if (consumerConfig && consumerConfig.default) {
        console.log("[Server] Consumer configuration loaded successfully");
        return {...CONFIG, ...consumerConfig.default};
    } else {
        console.error("[Server] No consumer configuration found, using default configuration");
        return CONFIG;
    }
};

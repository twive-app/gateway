import "dotenv/config";
import "@infra/BeanManager";
import "@infra/ConfigManager";
import "@infra/DatabaseManager";
import "@infra/RedisManager";
import "@utils/Logger";
import "@twitch/TwitchWebhookService";
import "@infra/ServerManager";
import "@infra/LifecycleManager";
import "@gateway/GatewayService";
import "@utils/ApiRequestClient";
import "@twitch/EventSubSubscriptionManager";
import "@twitch/TwitchEventManager";
import "@twitch/Application";
import "@twitch/ApplicationManager";
import "@twitch/ConduitManager";

import {Autowired, MainClass} from "@infra/BeanManager.ts";
import type {Logger} from "@utils/Logger.ts";
import packageJson from "../package.json";

@MainClass()
export class Main {
    @Autowired()
    private logger!: Logger;

    constructor() {
        this.logger.header();
        this.logger.info("SYSTEM", "Starting process...");
        this.logger.info("SYSTEM", `Backend version: ${packageJson.version || "unknown"}`);
        this.logger.info("SYSTEM", `Node.js version: ${process.version}`);
        this.logger.info("SYSTEM", `Environment: ${process.env.ENVIRONMENT ?? "prod"}`);
        this.logger.info("SYSTEM", "Backend is now running!");
    }
}

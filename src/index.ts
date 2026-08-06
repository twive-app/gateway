import dotenv from "dotenv";
import {ConfigManager} from "@infra/ConfigManager";
import {Logger} from "@utils/Logger";
import {DatabaseManager} from "@infra/db/DatabaseManager";
import {RedisManager} from "@infra/db/RedisManager";
import packageJson from "../package.json";
dotenv.config();

export const configPath: string = process.env.CONFIG_PATH || ".";
export const configManager = new ConfigManager(configPath);
configManager.initialize();

export const logger: Logger = Logger.getInstance();

let database: DatabaseManager;

async function main(): Promise<void> {
    logger.header();
    logger.info("SYSTEM", "Starting process...");
    logger.info("SYSTEM", `Backend version: ${packageJson.version || "unknown"}`);
    logger.info("SYSTEM", `Node.js version: ${process.version}`);
    logger.info("SYSTEM", `Environment: ${process.env.ENVIRONMENT ?? "prod"}`);

    new RedisManager(configManager, logger);

    database = new DatabaseManager(configManager, logger);
    await database.initialize();

    logger.info("SYSTEM", "Backend is now running!");
}

main().catch();

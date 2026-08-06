import {Sequelize} from "sequelize";
import type {Logger} from "@utils/Logger";
import type {ConfigManager} from "@infra/ConfigManager";

class DatabaseException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DatabaseError";
    }
}

export class DatabaseManager {
    private readonly sequelize: Sequelize;
    private readonly logger: Logger;
    private modelsInitialized = false;

    public constructor(configManager: ConfigManager, logger: Logger) {
        this.logger = logger;

        this.sequelize = new Sequelize({
            host: configManager.getConfig().postgres.host,
            port: configManager.getConfig().postgres.port,
            username: configManager.getConfig().postgres.username,
            password: configManager.getConfig().postgres.password,
            schema: configManager.getConfig().postgres.schema,
            database: configManager.getConfig().postgres.database,
            dialect: "postgres",
            dialectOptions: {
                connectTimeout: 10000,
                requestTimeout: 10000,
                multipleStatements: true,
                useUTC: true,
                prependSearchPath: true,
                searchPath: configManager.getConfig().postgres.schema,
                options: `-c search_path=${configManager.getConfig().postgres.schema},public`,
            },
            define: {
                charset: "utf8mb4",
                collate: "utf8mb4_general_ci",
                timestamps: true,
                createdAt: "createdAt",
                updatedAt: "updatedAt",
            },
            pool: {
                max: 15,
                min: 0,
            },
            logging: (msg: string): void => {
                this.logger.debug("DATABASE", msg);
            },
            sync: {
                alter: false,
                force: false,
            },
        });
    }

    public getConnection(): Sequelize {
        return this.sequelize;
    }

    public async initialize(): Promise<void> {
        this.initModels();

        try {
            await this.sequelize.authenticate();
            this.logger.success("DATABASE", "Established connection successfully");
        } catch (error) {
            throw new DatabaseException(`Failed to establish connection: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private initModels(): void {
        if (this.modelsInitialized) return;

        this.modelsInitialized = true;
    }
}

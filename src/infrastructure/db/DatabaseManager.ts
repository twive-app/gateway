import {Sequelize} from "sequelize";
import type {Logger} from "@utils/Logger.ts";
import type {ConfigManager} from "@infra/ConfigManager.ts";
import {Autowired, Bean, PostConstruct} from "@infra/BeanManager.ts";

class DatabaseException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DatabaseError";
    }
}

@Bean()
export class DatabaseManager {
    private sequelize!: Sequelize;
    private modelsInitialized: boolean = false;

    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    @PostConstruct()
    public async initialize(): Promise<void> {
        this.sequelize = new Sequelize({
            host: this.configManager.get().postgres.host,
            port: this.configManager.get().postgres.port,
            username: this.configManager.get().postgres.username,
            password: this.configManager.get().postgres.password,
            schema: this.configManager.get().postgres.schema,
            database: this.configManager.get().postgres.database,
            dialect: "postgres",
            dialectOptions: {
                connectTimeout: 5000,
                requestTimeout: 5000,
                multipleStatements: true,
                useUTC: true,
                prependSearchPath: true,
                searchPath: this.configManager.get().postgres.schema,
                options: `-c search_path=${this.configManager.get().postgres.schema},public`,
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

        this.initModels();

        try {
            await this.sequelize.authenticate();
            this.logger.success("DATABASE", "Established connection successfully");
        } catch (error) {
            throw new DatabaseException(`Failed to establish connection: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public getConnection(): Sequelize {
        return this.sequelize;
    }

    private initModels(): void {
        if (this.modelsInitialized) return;

        this.modelsInitialized = true;
    }
}

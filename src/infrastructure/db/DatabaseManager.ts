import {DataTypes, Model, ModelStatic, Sequelize} from "sequelize";
import type {Logger} from "@utils/Logger.ts";
import type {ConfigManager} from "@infra/ConfigManager.ts";
import {Autowired, Bean, BeanManager, PostConstruct, type RegisteredModelsMap} from "@infra/BeanManager.ts";

class DatabaseException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DatabaseError";
    }
}

@Bean()
export class DatabaseManager {
    private sequelize!: Sequelize;

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
        });

        try {
            await this.sequelize.authenticate();
            this.logger.success("DATABASE", "Established connection successfully");

            await this.initModels();
            this.logger.success("DATABASE", "All models synced successfully");
        } catch (error) {
            throw new DatabaseException(`Failed to establish connection: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async initModels(): Promise<void> {
        BeanManager.initDatabaseModels(this.sequelize);
        await this.sequelize.sync({
            alter: false,
            force: false
        });
    }
}

export type DefaultOptionalAttributes = "id"|"createdAt"|"updatedAt";

export interface DefaultAttributes {
    id: number;
    createdAt: Date;
    updatedAt: Date;
}

type DefaultBaseAttributes = {
    id: {
        type: DataTypes.IntegerDataTypeConstructor;
        autoIncrement: true;
        primaryKey: true;
    };
    createdAt: {
        type: DataTypes.DateDataTypeConstructor;
        allowNull: false;
        defaultValue: typeof DataTypes.NOW;
    };
    updatedAt: {
        type: DataTypes.DateDataTypeConstructor;
        allowNull: false;
        defaultValue: typeof DataTypes.NOW;
    };
};

type InitAttributes<T extends Record<string, any>> = DefaultBaseAttributes & T;

export function initAttributes<T extends Record<string, any>>(customAttributes: T): InitAttributes<T> {
    return {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        ...customAttributes,
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    };
}

export abstract class DatabaseModel<A extends object, CA extends object = A> extends Model<A, CA> {
    declare id: number;
    declare createdAt: Date;
    declare updatedAt: Date;
}

export interface DatabaseModelStatic<A extends object, CA extends object = A, T extends DatabaseModel<A, CA> = DatabaseModel<A, CA>> extends ModelStatic<T> {
    initModel(sequelize: Sequelize): ModelStatic<T>;
    associate?(models: RegisteredModelsMap): void;
}

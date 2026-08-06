import {createClient, type RedisClientType, type RedisDefaultModules} from "redis";
import type {Logger} from "@utils/Logger.ts";
import type {ConfigManager} from "@infra/ConfigManager.ts";
import type {ZodSafeParseResult, ZodType} from "zod";
import {Autowired, Bean, PostConstruct} from "@infra/BeanManager.ts";

export type RedisClient = RedisClientType<RedisDefaultModules, {}, {}, 3, {}>;

class RedisException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RedisError";
    }
}

@Bean()
export class RedisManager {
    private redisClient!: Promise<RedisClient>;

    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    @PostConstruct()
    public initialize(): void {
        this.redisClient = createClient({
            url: `redis://${this.configManager.get().redis.username}:${this.configManager.get().redis.password}@${this.configManager.get().redis.host}:${this.configManager.get().redis.port}/${this.configManager.get().redis.db}`,
            database: this.configManager.get().redis.db,
            socket: {
                reconnectStrategy: (retries: number): number => {
                    const time: number = Math.min(retries * 1000, 5000);
                    this.logger.warning("REDIS", `Connection was lost. Reconnecting in ${time} (${retries} try).`);
                    return time;
                },
            },
            disableOfflineQueue: false,
            pingInterval: 10000,
        }).on("connect", (): void => {
            this.logger.success("REDIS", "Established connection successfully");
        }).on("error", (err: any): void => {
            this.logger.error("REDIS", `Connection error: ${err.message}`);
        }).connect();
    }

    public get<T>(key: string, schema?: ZodType<T>): Promise<T> {
        return this.redisClient.then(async (client: RedisClient): Promise<any> => {
            const value: string|null = await client.get(key);
            if (value === null) throw new RedisException(`Key ${key} not found`);

            if (schema) {
                const parsed: ZodSafeParseResult<T> = schema.safeParse(JSON.parse(value));
                if (!parsed.success) throw new RedisException(`Key ${key} has invalid value: ${parsed.error.message}`);
                return parsed.data;
            }
            return JSON.parse(value);
        });
    }

    public getKeys(pattern: string): Promise<string[]> {
        return this.redisClient.then(async (client: RedisClient): Promise<string[]> => {
            return await client.keys(pattern);
        });
    }

    public keyExist(key: string): Promise<boolean> {
        return this.redisClient.then(async (client: RedisClient): Promise<boolean> => {
            const value: string|null = await client.get(key);
            return value !== null;
        });
    }

    public set<T>(key: string, value: T, expireSeconds?: number): Promise<void> {
        return this.redisClient.then(async (client: RedisClient): Promise<void> => {
            const stringValue: string = JSON.stringify(value);
            if (expireSeconds) {
                await client.set(key, stringValue, {EX: expireSeconds});
            } else {
                await client.set(key, stringValue);
            }
        });
    }

    public delete(key: string): Promise<void> {
        return this.redisClient.then(async (client: RedisClient): Promise<void> => {
            await client.del(key);
        });
    }
}

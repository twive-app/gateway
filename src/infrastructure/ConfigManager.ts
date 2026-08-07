import fs from "node:fs";
import z from "zod";
import {Bean, PostConstruct} from "@infra/BeanManager.ts";

export class ConfigException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

@Bean()
export class ConfigManager {
    private config!: Config;
    
    @PostConstruct()
    public initialize(): void {
        const configPath: string = (process.env.CONFIG_PATH || ".") + "/config/config.json";

        if (!fs.existsSync(configPath)) throw new ConfigException("Config file not found");

        const configFile: string = fs.readFileSync(configPath, "utf8");

        try {
            this.config = configSchema.parse(JSON.parse(configFile));
        } catch (error) {
            throw new ConfigException("Config file is invalid: " + (error as Error).message);
        }
    }

    public get(): Config {
        if (!this.config) throw new ConfigException("Config is not initialized.");
        return this.config;
    }
}

export const isDevMode: boolean = process.env.ENVIRONMENT === "dev";

export const configSchema= z.object({
    postgres: z.object({
        host: z.string(),
        port: z.number(),
        username: z.string(),
        password: z.string(),
        database: z.string("postgres"),
        schema: z.string(),
    }),
    redis: z.object({
        host: z.string(),
        port: z.number(),
        username: z.string(),
        password: z.string(),
        db: z.number(),
    }),
    server: z.object({
        cors: z.object({
            origin: z.array(z.string()),
        }),
    }),
    logging: z.object({
        debug: z.boolean(),
    }),
    twitch: z.object({
        webhookSecret: z.string(),
    })
});

export type Config = z.infer<typeof configSchema>;

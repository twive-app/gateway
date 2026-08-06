import fs from "node:fs";
import z from "zod";

export class ConfigManager {
    private readonly path: string;
    private config: Config | undefined;

    public constructor(path: string) {
        this.path = path;
        this.config = undefined;
    }

    public initialize(): void {
        const configPath: string = this.path + "/config/config.json";

        if (!fs.existsSync(configPath)) throw new Error("Config file not found");

        const configFile: string = fs.readFileSync(configPath, "utf8");

        try {
            this.config = JSON.parse(configFile)
        } catch (error) {
            throw new Error("Config file is invalid: " + (error as Error).message);
        }
    }

    public getConfig(): Config {
        if (!this.config) throw new Error("Config is not initialized. Call initialize() first");
        return this.config;
    }
}

export const isDevMode: boolean = process.env.ENVIRONMENT === "dev";

export const config= z.object({
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
    webserver: z.object({
        cors: z.object({
            origin: z.array(z.string()),
        }),
    }),
    logging: z.object({
        debug: z.boolean(),
    }),
});

export type Config = z.infer<typeof config>;

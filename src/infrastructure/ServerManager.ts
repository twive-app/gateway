import fastify, {type FastifyInstance} from "fastify";
import formBody from "@fastify/formbody";
import cors from "@fastify/cors";
import {Bean, Autowired, PostConstruct, BeanManager} from "@infra/BeanManager.ts";
import type {ConfigManager} from "@infra/ConfigManager.ts";
import type {Logger} from "@utils/Logger.ts";

class ServerException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServerError";
    }
}

@Bean()
export class ServerManager {
    public readonly instance: FastifyInstance;

    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    constructor() {
        this.instance = fastify({
            logger: false,
        });

        this.instance.register(formBody);
        this.instance.register(cors, {
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            credentials: true,
            allowedHeaders: ["Content-Type", "Authorization"],
            origin: (origin: string|undefined, cb): void => {
                const allowedOrigins: string[] = this.configManager.get().server.cors.origin.map((origin: string): string => origin.toLowerCase());

                if (!origin || allowedOrigins.includes(origin)) {
                    cb(null, true);
                } else {
                    this.logger.warning("SERVER", `Origin ${origin} blocked`);
                    cb(new ServerException("Origin not allowed by CORS"), false);
                }
            },
        });

        BeanManager.registerServerRoutes(this.instance);
    }

    @PostConstruct()
    public async start(): Promise<void> {
        const port = (process.env.SERVER_PORT || 3000) as number;
        const host = (process.env.SERVER_HOST || "0.0.0.0") as string;

        try {
            await this.instance.listen({port, host});
            this.logger.success("SERVER", `Listening on port ${port}`);
        } catch (error) {
            this.logger.error("SERVER", `Failed on startup: ${error}`);
            process.exit(1);
        }
    }
}

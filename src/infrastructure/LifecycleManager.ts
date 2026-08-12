import {Bean, PostConstruct, Autowired, BeanManager, ShutdownHooks} from "@infra/BeanManager.ts";
import {Logger} from "@utils/Logger.ts";

class LifecycleException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LifecycleError";
    }
}

@Bean()
export class LifecycleManager {
    @Autowired()
    private logger!: Logger;

    private isShuttingDown: boolean = false;

    @PostConstruct()
    public initialize(): void {
        process.on("SIGINT", (): undefined => void this.triggerShutdown("SIGINT"));
        process.on("SIGTERM", (): undefined => void this.triggerShutdown("SIGTERM"));
    }

    private async triggerShutdown(signal: string): Promise<void> {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        console.log("");
        this.logger.warning("SYSTEM", `Received ${signal}. Initiating shutdown...`);

        const hooks: ShutdownHooks[] = BeanManager.getRegisteredShutdownHooks();

        for (const hook of hooks) {
            try {
                await hook.hook();
            } catch (error) {
                throw new LifecycleException(`Error executing shutdown hook [${hook.name}]: ${(error as Error).message}`)
            }
        }

        this.logger.success("SYSTEM", "All shutdown hooks completed. Exiting process...");
        process.exit(0);
    }
}

import {Autowired, Bean} from "@core/bean/BeanDecorators.ts";
import {BeanManager} from "@core/bean/BeanManager.ts";
import type {ErrorReporter} from "@core/error/ErrorReporter.ts";
import type {Logger} from "@core/logging/Logger.ts";

@Bean()
export class ProcessManager {
    @Autowired()
    private logger!: Logger;

    @Autowired()
    private errorReporter!: ErrorReporter;

    private installed: boolean = false;
    private shuttingDown: boolean = false;

    public install(): void {
        if (this.installed) return;
        this.installed = true;

        process.on("SIGINT", (): undefined => void this.shutdown("SIGINT"));
        process.on("SIGTERM", (): undefined => void this.shutdown("SIGTERM"));

        process.on("unhandledRejection", (reason: unknown): void => {
            this.logger.error("SYSTEM", "Unhandled promise rejection");
            this.errorReporter.handle(reason);
        });

        process.on("uncaughtException", (error: Error): void => {
            this.logger.error("SYSTEM", "Uncaught exception. Shutting down...");
            this.errorReporter.handle(error);
            void this.shutdown("uncaughtException", 1);
        });
    }

    public async shutdown(reason: string, exitCode: number = 0): Promise<void> {
        if (this.shuttingDown) return;
        this.shuttingDown = true;

        console.log("");
        this.logger.warning("SYSTEM", `Received ${reason}. Initiating shutdown hooks...`);

        await BeanManager.runShutdownHooks();

        this.logger.warning("SYSTEM", "All shutdown hooks completed. Exiting process...");
        process.exit(exitCode);
    }
}

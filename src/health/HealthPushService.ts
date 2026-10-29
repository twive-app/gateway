import {Autowired, Bean, Cron, PostConstruct, ShutdownHook} from "@core/bean/BeanDecorators.ts";
import type {ConfigManager, ConfigValues} from "@core/config/ConfigManager.ts";
import type {ErrorReporter} from "@core/error/ErrorReporter.ts";
import {MainError} from "@core/error/ErrorReporter.ts";
import type {Logger} from "@core/logging/Logger.ts";
import type {HealthCheck, HealthCheckService} from "@health/HealthCheckService.ts";

const pushTimeoutMs: number = 5000;
const tickToleranceMs: number = 500;

@Bean()
export class HealthPushService {
    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    @Autowired()
    private errorReporter!: ErrorReporter;

    @Autowired()
    private healthCheckService!: HealthCheckService;

    private lastPushAt: number = 0;
    private stopped: boolean = false;

    @PostConstruct()
    public initialize(): void {
        const {pushUrl, pushInterval}: ConfigValues["health"] = this.configManager.get().health;
        if (pushUrl) this.logger.info("SYSTEM", `Health push to ${new URL(pushUrl).host} every ${pushInterval} s`);
    }

    @Cron("* * * * * *")
    public async tick(): Promise<void> {
        const {pushUrl, pushInterval}: ConfigValues["health"] = this.configManager.get().health;
        if (!pushUrl || this.stopped) return;

        const now: number = Date.now();
        if (this.lastPushAt > 0 && now - this.lastPushAt < pushInterval * 1000 - tickToleranceMs) return;
        this.lastPushAt = now;

        await this.push(new URL(pushUrl));
    }

    @ShutdownHook(1)
    public stop(): void {
        this.stopped = true;
    }

    private async push(url: URL): Promise<void> {
        const health: HealthCheck = await this.healthCheckService.check();
        const params: URLSearchParams = url.searchParams;
        if (!health.healthy && !params.has("status")) return;

        if (params.has("status")) params.set("status", health.healthy ? "up" : "down");
        if (params.has("msg") || !health.healthy) params.set("msg", health.healthy ? "OK" : health.failures.join(", "));
        if (params.has("ping") && health.status.checks.redis.latencyMs !== null) params.set("ping", String(health.status.checks.redis.latencyMs));

        try {
            const response: Response = await fetch(url, {signal: AbortSignal.timeout(pushTimeoutMs)});
            await response.body?.cancel();
            if (!response.ok) throw new MainError("HEALTH_PUSH_FAILED", `Health push to ${url.host} answered ${response.status}`);
            this.logger.debug("SYSTEM", `Health push to ${url.host}: ${health.healthy ? "up" : `down (${health.failures.join(", ")})`}`);
        } catch (error) {
            const reported: unknown = error instanceof MainError ? error : new MainError("HEALTH_PUSH_FAILED", `Health push to ${url.host} failed: ${this.errorCode(error)}`);
            this.errorReporter.handleThrottled("SYSTEM", `Health push to ${url.host} failed`, reported);
        }
    }

    private errorCode(error: unknown): string {
        if (!(error instanceof Error)) return "unknown error";
        return (error as Error & {code?: string}).code ?? error.name;
    }
}

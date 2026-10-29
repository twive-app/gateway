import {Autowired, Bean, Route} from "@core/bean/BeanDecorators.ts";
import type {HealthCheck, HealthCheckService} from "@health/HealthCheckService.ts";

@Bean()
export class HealthController {
    @Autowired()
    private healthCheckService!: HealthCheckService;

    @Route("GET", "/health")
    public async health(): Promise<Response> {
        const health: HealthCheck = await this.healthCheckService.check();
        return Response.json(health.status, {status: health.healthy ? 200 : 503});
    }
}

import {Autowired, Bean} from "@infra/BeanManager.ts";
import type {ConfigManager} from "@infra/ConfigManager.ts";
import type {Application} from "@twitch/Application.ts";
import {APIEndpoint, type RESTPatchConduitsResponse, type RESTPostConduitsResponse} from "twitch-dev-types";
import type {ApiRequestClient} from "@utils/ApiRequestClient.ts";
import type {Logger} from "@utils/Logger.ts";

class ConduitManagementException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConduitManagementError";
    }
}

@Bean()
export class ConduitManager {
    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    @Autowired()
    private apiRequestClient!: ApiRequestClient;

    public async createConduit(app: Application): Promise<string> {
        let conduitCreationResponse: RESTPostConduitsResponse|null = null;
        try {
            conduitCreationResponse = await this.apiRequestClient.post<RESTPostConduitsResponse>(
                APIEndpoint.CreateConduits,
                {
                    shard_count: 1,
                },
                {
                    Authorization: `Bearer ${app.accessToken}`,
                    "Client-Id": app.clientId,
                },
            );
        } catch (error) {
            throw new ConduitManagementException(`Failed to create conduit for app ${app.clientId}: ${(error as Error).message}`);
        }

        const conduitId: string = conduitCreationResponse.data[0].id;

        try {
            await this.apiRequestClient.patch<RESTPatchConduitsResponse>(
                APIEndpoint.UpdateConduitShards,
                {
                    conduit_id: conduitId,
                    shards: [
                        {
                            id: "0",
                            transport: {
                                method: "webhook",
                                callback: `${this.configManager.get().twitch.webhook.callbackURL}?client_id=${app.clientId}`,
                                secret: this.configManager.get().twitch.webhook.secretKey,
                            },
                        },
                    ],
                },
                {
                    Authorization: `Bearer ${app.accessToken}`,
                    "Client-Id": app.clientId,
                }
            );
        } catch (error) {
            throw new ConduitManagementException(`Failed to update conduit for app ${app.clientId}: ${(error as Error).message}`);
        }

        app.conduitId = conduitCreationResponse.data[0].id;
        await app.save();

        this.logger.info("TWITCH", `Conduit created for app ${app.clientId} with id ${conduitId}`);
        return conduitId;
    }
}

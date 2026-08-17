import {Autowired, Bean} from "@infra/BeanManager.ts";
import type {GatewayService} from "@gateway/GatewayService.ts";
import {
    AccessTokenScopes,
    EventSubSubscriptionType,
    APIEndpoint,
    EventSubTransportMethod,
    type EventSubSubscriptionRequestBody,
    type EventSubWebhookNotificationRequestBody,
    type RESTGetAuthorizationByUserResponse,
    type UserAuthorizationGrantEvent,
} from "twitch-dev-types";
import {Application} from "@twitch/Application.ts";
import type {EventSubSubscriptionManager} from "@twitch/EventSubSubscriptionManager.ts";
import type {ApiRequestClient} from "@utils/ApiRequestClient.ts";

class TwitchEventManagementException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TwitchEventManagementError";
    }
}

@Bean()
export class TwitchEventManager {
    @Autowired()
    private gatewayService!: GatewayService;

    @Autowired()
    private apiRequestClient!: ApiRequestClient;

    @Autowired()
    private eventSubSubscriptionManager!: EventSubSubscriptionManager;

    public async handleEventSubEvents(clientId: string, notification: EventSubWebhookNotificationRequestBody): Promise<void> {
        switch (notification.subscription.type) {
            case EventSubSubscriptionType.UserAuthorizationGrant:
                await this.userAuthorizationGrantEvent(clientId, notification.event as UserAuthorizationGrantEvent);
                break;

            default:
                const eventName: string = notification.subscription.type.toLocaleUpperCase().replaceAll(".", "_");
                this.gatewayService.broadcastDispatch(clientId, eventName, notification.event);
                break;
        }
    }

    private async userAuthorizationGrantEvent(clientId: string, event: UserAuthorizationGrantEvent): Promise<void> {
        const application: Application|null = await Application.findOne({
            where: {
                clientId: clientId,
            },
        });
        if (!application) return;

        const userId: string = event.user_id;

        let scopes: AccessTokenScopes[] = [];
        try {
            const response: RESTGetAuthorizationByUserResponse = await this.apiRequestClient.get<RESTGetAuthorizationByUserResponse>(
                APIEndpoint.GetAuthorizationByUser,
                {
                    user_id: userId,
                },
                {
                    Authorization: `Bearer ${application.accessToken}`,
                    "Client-Id": clientId,
                },
            );

            scopes = response.data[0].scopes as AccessTokenScopes[];
        } catch (error) {
            throw new TwitchEventManagementException(`Failed to fetch authorization for user ${userId}: ${(error as Error).message}`);
        }

        const existingSubs: EventSubSubscriptionRequestBody[] = await this.eventSubSubscriptionManager.getSubscriptions(application.accessToken, clientId);
        const subs: EventSubSubscriptionRequestBody[] = this.eventSubSubscriptionManager.getScopeBasedSubscriptions(
            scopes,
            application.clientUserId,
            userId,
            {
                method: EventSubTransportMethod.Conduit,
                conduit_id: application.conduitId,
            },
            existingSubs
        );

        await this.eventSubSubscriptionManager.subscribe(subs, application.accessToken, clientId);
    }
}

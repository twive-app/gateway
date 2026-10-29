import {
    APIConduitShardTransportMethod,
    APIEndpoint,
    OAuth2Endpoint,
    OAuth2GrantType,
    type EventSubSubscription,
    type RESTGetAuthorizationByUserResponse,
    type RESTGetConduitShardsResponse,
    type RESTGetConduitsResponse,
    type RESTGetEventSubSubscriptionsRequestParams,
    type RESTGetEventSubSubscriptionsResponse,
    type RESTGetUsersResponse,
    type RESTPatchConduitShardsResponse,
    type RESTPostClientCredentialsGrantFlowTokenResponse,
    type RESTPostConduitsResponse,
    type RESTPostEventSubSubscriptionRequestBody,
    type RESTPostEventSubSubscriptionResponse,
} from "twitch-dev-types";
import {Autowired, Bean} from "@core/bean/BeanDecorators.ts";
import type {HttpClient} from "@core/http/HttpClient.ts";

interface AppAuth {
    accessToken: string;
    clientId: string;
}

export type TwitchSubscriptionFilter = Pick<RESTGetEventSubSubscriptionsRequestParams, "user_id" | "type" | "status">;

@Bean()
export class TwitchClient {
    @Autowired()
    private httpClient!: HttpClient;

    public async requestAppToken(clientId: string, clientSecret: string): Promise<RESTPostClientCredentialsGrantFlowTokenResponse> {
        return await this.httpClient.post<RESTPostClientCredentialsGrantFlowTokenResponse>(OAuth2Endpoint.Token, {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: OAuth2GrantType.ClientCredentials,
        });
    }

    public async getUsersById(ids: string[], auth: AppAuth): Promise<RESTGetUsersResponse> {
        return await this.httpClient.get<RESTGetUsersResponse>(APIEndpoint.GetUsers, {id: ids}, this.headers(auth));
    }

    public async getConduits(auth: AppAuth): Promise<RESTGetConduitsResponse> {
        return await this.httpClient.get<RESTGetConduitsResponse>(APIEndpoint.GetConduits, undefined, this.headers(auth));
    }

    public async getConduitShards(conduitId: string, auth: AppAuth): Promise<RESTGetConduitShardsResponse> {
        return await this.httpClient.get<RESTGetConduitShardsResponse>(APIEndpoint.GetConduitShards, {conduit_id: conduitId}, this.headers(auth));
    }

    public async createConduit(auth: AppAuth): Promise<RESTPostConduitsResponse> {
        return await this.httpClient.post<RESTPostConduitsResponse>(APIEndpoint.CreateConduits, {shard_count: 1}, this.headers(auth));
    }

    public async deleteConduit(conduitId: string, auth: AppAuth): Promise<void> {
        await this.httpClient.delete(APIEndpoint.DeleteConduit, {id: conduitId}, this.headers(auth));
    }

    public async updateConduitShard(conduitId: string, callback: string, secret: string, auth: AppAuth): Promise<RESTPatchConduitShardsResponse> {
        return await this.httpClient.patch<RESTPatchConduitShardsResponse>(APIEndpoint.UpdateConduitShards, {
            conduit_id: conduitId,
            shards: [
                {
                    id: "0",
                    transport: {
                        method: APIConduitShardTransportMethod.Webhook,
                        callback,
                        secret,
                    },
                },
            ],
        }, this.headers(auth));
    }

    public async createSubscription(subscription: RESTPostEventSubSubscriptionRequestBody, auth: AppAuth): Promise<RESTPostEventSubSubscriptionResponse> {
        return await this.httpClient.post<RESTPostEventSubSubscriptionResponse>(APIEndpoint.CreateEventSubSubscription, subscription, this.headers(auth));
    }

    public async getSubscriptions(auth: AppAuth, filter: TwitchSubscriptionFilter = {}): Promise<EventSubSubscription[]> {
        const subscriptions: EventSubSubscription[] = [];
        let cursor: string | undefined = undefined;

        do {
            const response: RESTGetEventSubSubscriptionsResponse = await this.httpClient.get<RESTGetEventSubSubscriptionsResponse>(
                APIEndpoint.GetEventSubSubscriptions,
                {
                    ...filter,
                    after: cursor,
                },
                this.headers(auth),
            );

            subscriptions.push(...response.data);
            cursor = response.pagination?.cursor || undefined;
        } while (cursor);

        return subscriptions;
    }

    public async deleteSubscription(subscriptionId: string, auth: AppAuth): Promise<void> {
        await this.httpClient.delete(APIEndpoint.DeleteEventSubSubscription, {id: subscriptionId}, this.headers(auth));
    }

    public async getAuthorization(userId: string, auth: AppAuth): Promise<RESTGetAuthorizationByUserResponse> {
        return await this.httpClient.get<RESTGetAuthorizationByUserResponse>(APIEndpoint.GetAuthorizationByUser, {user_id: userId}, this.headers(auth));
    }

    private headers(auth: AppAuth): Record<string, string> {
        return {
            "Authorization": `Bearer ${auth.accessToken}`,
            "Client-Id": auth.clientId,
        };
    }
}

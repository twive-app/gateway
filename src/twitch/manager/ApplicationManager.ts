import {Autowired, Bean} from "@infra/BeanManager.ts";
import {
    APIEndpoint,
    OAuth2Endpoint,
    type RESTGetUsersResponse,
    type RESTPostClientCredentialsGrantFlowTokenResponse,
} from "twitch-dev-types";
import {Application} from "@twitch/Application.ts";
import type {ApiRequestClient} from "@utils/ApiRequestClient.ts";
import type {Logger} from "@utils/Logger.ts";

export interface ApplicationCredentials {
    accessToken: string;
    clientUserId: string;
}

@Bean()
export class ApplicationManager {
    @Autowired()
    private apiRequestClient!: ApiRequestClient;

    @Autowired()
    private logger!: Logger;

    public async createOrGetApplication(clientId: string, clientUserId: string, accessToken: string): Promise<Application> {
        const existingApp: Application|null = await Application.findOne({
            where: {
                clientId: clientId,
            },
        });

        if (existingApp) return existingApp;

        this.logger.info("TWITCH", `Creating new application with client ${clientId}`);

        return await Application.create({
            clientId: clientId,
            clientUserId: clientUserId,
            accessToken: accessToken,
        });
    }

    public async getCredentials(clientId: string, clientSecret: string, loginName: string): Promise<ApplicationCredentials|null> {
        let tokenResponse: RESTPostClientCredentialsGrantFlowTokenResponse|null = null;
        try {
            tokenResponse = await this.apiRequestClient.post<RESTPostClientCredentialsGrantFlowTokenResponse>(
                OAuth2Endpoint.Token,
                {
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: "client_credentials",
                }
            );
        } catch (error) {
            return null;
        }

        let userResponse: RESTGetUsersResponse|null = null;
        try {
            userResponse = await this.apiRequestClient.get<RESTGetUsersResponse>(
                APIEndpoint.GetUsers,
                {
                    login: loginName,
                },
                {
                    Authorization: `Bearer ${tokenResponse.access_token}`,
                    "Client-Id": clientId,
                }
            );
        } catch (error) {
            return null;
        }

        return {
            accessToken: tokenResponse.access_token,
            clientUserId: userResponse.data[0].id,
        }
    }
}

import {ApiRequestClient} from "@utils/ApiRequestClient.ts";
import {Bean} from "@infra/BeanManager.ts";

@Bean()
export class TwitchApiClient extends ApiRequestClient {
    constructor() {
        super("https://api.twitch.tv/helix");
    }

    public setAuthentication(applicationId: string, accessToken: string) : void {
        this.setHeaders({
            "Client-Id": applicationId,
            "Authorization": `Bearer ${accessToken}`,
        });
    }
}

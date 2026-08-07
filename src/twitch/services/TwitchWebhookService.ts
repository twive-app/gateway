import {Autowired, Bean, Route} from "@infra/BeanManager.ts";
import type {ConfigManager} from "@infra/ConfigManager.ts";
import type {FastifyReply, FastifyRequest} from "fastify";
import type {IncomingHttpHeaders} from "node:http";
import {
    EventSubWebhookMessageType, EventSubWebhookRequestHeader, type EventSubWebhookNotificationRequestBody,
    type EventSubWebhookRevokeSubscriptionRequestBody, type EventSubWebhookVerificationChallengeRequestBody
} from "twitch-dev-types";
import crypto from "crypto";

@Bean()
export class TwitchWebhookService {
    private readonly hmacPrefix: string = "sha256=";

    @Autowired()
    private configManager!: ConfigManager;

    @Route("post", "/twitch/webhook/callback")
    public async handleCallback(request: FastifyRequest<{ Querystring: { app_id: string } }>, reply: FastifyReply): Promise<FastifyReply> {
        const headers: IncomingHttpHeaders = request.headers;
        const appID: string = request.query.app_id;

        console.log(headers);
        console.log(appID);

        const signature: string = headers[EventSubWebhookRequestHeader.TwitchEventSubMessageSignature] as string;
        const messageId: string = headers[EventSubWebhookRequestHeader.TwitchEventSubMessageId] as string;
        const timestamp: string = headers[EventSubWebhookRequestHeader.TwitchEventSubMessageTimestamp] as string;
        const messageType: EventSubWebhookMessageType = headers[EventSubWebhookRequestHeader.TwitchEventSubMessageType] as EventSubWebhookMessageType;

        const rawBody: string = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
        const secret: string = this.configManager.get().twitch?.webhookSecret || "1234567890";

        console.log(rawBody);

        if (signature && messageId && timestamp) {
            const hmacMessage: string = messageId + timestamp + rawBody;
            const expectedHmac: string = this.hmacPrefix + this.getHmac(secret, hmacMessage);

            if (!this.verifyMessage(expectedHmac, signature)) {
                console.log("Webhook signatures do not match");
                return reply.status(403).send();
            }

            let body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;

            switch (messageType) {
                case EventSubWebhookMessageType.WebhookCallbackVerification:
                    const callbackVerifyData: EventSubWebhookVerificationChallengeRequestBody = body as EventSubWebhookVerificationChallengeRequestBody;

                    console.log("Webhook verification challenge received");
                    return reply.header("Content-Type", "text/plain").status(200).send(callbackVerifyData.challenge);

                case EventSubWebhookMessageType.Revocation:
                    const revokeData: EventSubWebhookRevokeSubscriptionRequestBody = body as EventSubWebhookRevokeSubscriptionRequestBody;

                    console.log(`Notification revoked: ${revokeData.subscription.type}`);
                    console.log(`Reason: ${revokeData.subscription.status}`);
                    return reply.status(204).send();

                case EventSubWebhookMessageType.Notification:
                    const notification: EventSubWebhookNotificationRequestBody = body as EventSubWebhookNotificationRequestBody;

                    console.log(`Event received: ${body.subscription.type}`);
                    console.log(notification.event);
                    return reply.status(204).send();

                default:
                    console.log(`Unknown message type: ${messageType}`);
                    return reply.status(204).send();
            }
        }

        console.log("Missing headers");
        return reply.status(403).send();
    }

    private getHmac(secret: string, message: string): string {
        return crypto.createHmac("sha256", secret).update(message).digest("hex");
    }

    private verifyMessage(hmac: string, verifySignature: string): boolean {
        const hmacBuffer: Buffer<ArrayBuffer> = Buffer.from(hmac);
        const verifyBuffer: Buffer<ArrayBuffer> = Buffer.from(verifySignature);

        if (hmacBuffer.length !== verifyBuffer.length) return false;
        return crypto.timingSafeEqual(hmacBuffer, verifyBuffer);
    }
}

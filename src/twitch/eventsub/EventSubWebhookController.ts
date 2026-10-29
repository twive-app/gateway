import type {BunRequest} from "bun";
import {
    EventSubWebhookMessageType,
    EventSubWebhookRequestHeader,
    type EventSubWebhookNotificationRequestBody,
    type EventSubWebhookRevokeSubscriptionRequestBody,
    type EventSubWebhookVerificationChallengeRequestBody,
} from "twitch-dev-types";
import crypto from "node:crypto";
import {Autowired, Bean, Route} from "@core/bean/BeanDecorators.ts";
import type {ConfigManager} from "@core/config/ConfigManager.ts";
import type {ErrorReporter} from "@core/error/ErrorReporter.ts";
import type {Logger} from "@core/logging/Logger.ts";
import type {EventSubMessageHandler} from "@twitch/eventsub/EventSubMessageHandler.ts";
import type {EventSubWebhookStore} from "@twitch/eventsub/EventSubWebhookStore.ts";

const maxMessageAgeMs: number = 10 * 60 * 1000;
const hmacPrefix: string = "sha256=";

@Bean()
export class EventSubWebhookController {
    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private eventSubWebhookStore!: EventSubWebhookStore;

    @Autowired()
    private eventSubMessageHandler!: EventSubMessageHandler;

    @Autowired()
    private errorReporter!: ErrorReporter;

    @Autowired()
    private logger!: Logger;

    @Route("POST", "/twitch/webhook/callback")
    public async handleCallback(request: BunRequest): Promise<Response> {
        const clientId: string | null = new URL(request.url).searchParams.get("client_id");

        const signature: string | null = request.headers.get(EventSubWebhookRequestHeader.TwitchEventSubMessageSignature);
        const messageId: string | null = request.headers.get(EventSubWebhookRequestHeader.TwitchEventSubMessageId);
        const timestamp: string | null = request.headers.get(EventSubWebhookRequestHeader.TwitchEventSubMessageTimestamp);
        const messageType: EventSubWebhookMessageType | null = request.headers.get(EventSubWebhookRequestHeader.TwitchEventSubMessageType) as EventSubWebhookMessageType | null;

        if (!signature || !messageId || !timestamp || !messageType) {
            this.logger.warning("WEBHOOK", "Missing required headers for eventsub webhook");
            return new Response(null, {status: 403});
        }

        const rawBody: string = await request.text();
        const secret: string = this.configManager.get().twitch.webhook.secretKey;

        if (!EventSubWebhookController.verifySignature(secret, messageId, timestamp, rawBody, signature)) {
            this.logger.warning("WEBHOOK", "Invalid signature for incoming webhook message");
            return new Response(null, {status: 403});
        }

        let body: unknown;
        try {
            body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
        } catch (error) {
            return Response.json({error: error instanceof Error ? error.message : "Invalid JSON", statusCode: 400}, {status: 400});
        }

        if (messageType === EventSubWebhookMessageType.WebhookCallbackVerification) {
            // A subscription with webhook transport sends `subscription` along, the verification of a conduit shard only
            // `challenge`.
            const verification: Partial<EventSubWebhookVerificationChallengeRequestBody> = body as Partial<EventSubWebhookVerificationChallengeRequestBody>;
            if (typeof verification.challenge !== "string" || verification.challenge.length === 0) {
                this.logger.warning("WEBHOOK", "Webhook verification without challenge");
                return Response.json({error: "Missing challenge", statusCode: 400}, {status: 400});
            }

            const subject: string = verification.subscription?.type ?? `conduit shard${clientId ? ` of application ${clientId}` : ""}`;
            this.logger.info("WEBHOOK", `Webhook verification challenge received for ${subject}`);
            return new Response(verification.challenge, {status: 200, headers: {"Content-Type": "text/plain"}});
        }

        if (this.isOutdated(timestamp)) {
            this.logger.warning("WEBHOOK", `Dropped outdated eventsub message ${messageId}`);
            return new Response(null, {status: 204});
        }

        if (!(await this.isFirstDelivery(messageId))) {
            this.logger.debug("WEBHOOK", `Dropped duplicate eventsub message ${messageId}`);
            return new Response(null, {status: 204});
        }

        if (!clientId) {
            this.logger.warning("WEBHOOK", "Eventsub message without client_id query parameter");
            return new Response(null, {status: 204});
        }

        switch (messageType) {
            case EventSubWebhookMessageType.Revocation: {
                const revocation: EventSubWebhookRevokeSubscriptionRequestBody = body as EventSubWebhookRevokeSubscriptionRequestBody;

                this.logger.info("WEBHOOK", `Eventsub subscription revoked: ${revocation.subscription.type} (${revocation.subscription.status})`);
                this.process(this.eventSubMessageHandler.handleRevocation(clientId, revocation), clientId, messageId);
                return new Response(null, {status: 204});
            }

            case EventSubWebhookMessageType.Notification: {
                const notification: EventSubWebhookNotificationRequestBody = body as EventSubWebhookNotificationRequestBody;

                this.logger.debug("WEBHOOK", `Eventsub notification received: ${notification.subscription.type}`);
                this.process(this.eventSubMessageHandler.handleNotification(clientId, notification), clientId, messageId);
                return new Response(null, {status: 204});
            }

            default:
                this.logger.warning("WEBHOOK", `Unknown message type: ${String(messageType)}`);
                return new Response(null, {status: 204});
        }
    }

    private process(task: Promise<void>, clientId: string, messageId: string): void {
        task.catch((error: unknown): void => {
            this.logger.error("WEBHOOK", `Failed processing eventsub message ${messageId}`);
            this.errorReporter.handle(error, {clientId, messageId});
        });
    }

    private isOutdated(timestamp: string): boolean {
        const sentAt: number = Date.parse(timestamp);
        return Number.isNaN(sentAt) || Date.now() - sentAt > maxMessageAgeMs;
    }

    private async isFirstDelivery(messageId: string): Promise<boolean> {
        try {
            return await this.eventSubWebhookStore.markFirstDelivery(messageId, maxMessageAgeMs / 1000);
        } catch (error) {
            this.errorReporter.handle(error, {messageId});
            return true;
        }
    }

    private static createSignature(secret: string, messageId: string, timestamp: string, rawBody: string): string {
        return hmacPrefix + crypto.createHmac("sha256", secret).update(messageId + timestamp + rawBody).digest("hex");
    }

    private static verifySignature(secret: string, messageId: string, timestamp: string, rawBody: string, signature: string): boolean {
        const expected: Buffer = Buffer.from(EventSubWebhookController.createSignature(secret, messageId, timestamp, rawBody));
        const received: Buffer = Buffer.from(signature);

        if (expected.length !== received.length) return false;
        return crypto.timingSafeEqual(expected, received);
    }
}

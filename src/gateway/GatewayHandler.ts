import {Autowired, Bean} from "@core/bean/BeanDecorators.ts";
import type {ConfigManager} from "@core/config/ConfigManager.ts";
import type {ErrorReporter} from "@core/error/ErrorReporter.ts";
import type {Logger} from "@core/logging/Logger.ts";
import {
    GatewayCloseCode,
    GatewayDispatchEvent,
    GatewayOpCode,
    GatewayProtocol,
    type GatewayIdentifyData,
    type GatewayPayload,
    type GatewayReadyData,
    type GatewayResumeData,
} from "@gateway/GatewayProtocol.ts";
import type {ConnectionLimitManager} from "@gateway/connection/ConnectionLimitManager.ts";
import type {ConnectionRegistry, LocalConnection, SocketData} from "@gateway/connection/ConnectionRegistry.ts";
import type {ClaimResult, ConnectionStore, PendingConnection} from "@gateway/connection/ConnectionStore.ts";
import {SessionStore, type AttachedSession, type GatewaySessionData} from "@gateway/session/SessionStore.ts";
import type {AppAuthenticator, AppCredentialsResult, ClientCredentials} from "@twitch/app/AppAuthenticator.ts";
import type {AppSetupService, BotUserUpdate} from "@twitch/app/AppSetupService.ts";
import type {App, AppStore} from "@twitch/app/AppStore.ts";

@Bean()
export class GatewayHandler {
    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    @Autowired()
    private errorReporter!: ErrorReporter;

    @Autowired()
    private connectionLimitManager!: ConnectionLimitManager;

    @Autowired()
    private connectionRegistry!: ConnectionRegistry;

    @Autowired()
    private connectionStore!: ConnectionStore;

    @Autowired()
    private sessionStore!: SessionStore;

    @Autowired()
    private appAuthenticator!: AppAuthenticator;

    @Autowired()
    private appSetupService!: AppSetupService;

    @Autowired()
    private appStore!: AppStore;

    public heartbeat(connection: LocalConnection): void {
        this.connectionRegistry.send(connection, GatewayProtocol.createPayload(GatewayOpCode.HeartbeatAck));

        if (!connection.clientId || !connection.sessionId) return;
        this.connectionStore.heartbeat(connection.clientId, connection.connectionId, connection.sessionId)
            .catch((error: unknown): void => this.errorReporter.handleThrottled("CONNECTION", "Could not record a heartbeat", error));
    }

    public async identify(connection: LocalConnection, data: GatewayIdentifyData): Promise<void> {
        if (connection.clientId) return this.connectionRegistry.close(connection, GatewayCloseCode.AlreadyAuthenticated, "Already authenticated");
        if (this.closeIfAuthBlocked(connection)) return;

        let events: Set<string> | null = null;
        if (data.events) {
            events = new Set<string>(data.events.map(GatewayProtocol.toDispatchEventName));
            const invalid: string[] = [...events].filter((event: string): boolean => !GatewayProtocol.dispatchEventNames.has(event));

            if (invalid.length > 0) {
                return this.connectionRegistry.close(connection, GatewayCloseCode.InvalidEvents, `Unknown events: ${invalid.slice(0, 5).join(", ")}`);
            }
        }

        const pending: PendingConnection | null = await this.claimPending(connection, data.clientId);
        if (!pending) return;

        try {
            const result: AppCredentialsResult = await this.appAuthenticator.getCredentials(data.clientId, data.clientSecret);
            if (!this.connectionRegistry.isOpen(connection)) return;
            if (result.status !== "valid") return await this.credentialsNotAccepted(connection, pending, result, `Identification of ${data.clientId}`);

            const credentials: ClientCredentials = result.credentials;
            const botUser: BotUserUpdate | null = await this.appSetupService.updateBotUser(data.clientId, data.botUserId, credentials.accessToken);
            if (!botUser) {
                this.logger.warning("AUTH", `Identification with unknown bot user ${data.botUserId} (client id ${data.clientId})`);
                return this.authenticationFailed(connection, "Invalid botUserId");
            }

            const app: App | null = await this.appSetupService.setupApplication(data.clientId, credentials, botUser);
            if (!this.connectionRegistry.isOpen(connection)) return;

            if (!app) {
                await this.connectionStore.releasePending(pending);
                return this.connectionRegistry.sendInvalidSession(connection, false, "Could not set up EventSub for this application, try again later");
            }

            const authorizedUserIds: string[] = await this.appStore.getAuthorizedUsers(app.clientId);
            const session: GatewaySessionData = await this.sessionStore.create(app.clientId, events, pending);

            if (!this.connectionRegistry.isOpen(connection)) {
                await this.connectionStore.remove({connectionId: connection.connectionId, clientId: app.clientId, sessionId: session.sessionId});
                await this.sessionStore.destroy(app.clientId, session.sessionId);
                return this.logger.debug("SESSION", `Connection ${connection.connectionId} closed during IDENTIFY, session ${session.sessionId} discarded`);
            }

            this.connectionRegistry.send(connection, GatewayProtocol.createPayload<GatewayReadyData>(GatewayOpCode.Dispatch, {
                v: GatewayProtocol.version,
                sessionId: session.sessionId,
                application: {
                    clientId: app.clientId,
                    botUserId: app.botUserId,
                    conduitId: app.conduitId,
                    accessToken: credentials.accessToken,
                },
                authorizedUserIds,
                events: session.events,
            }, GatewayDispatchEvent.Ready));

            connection.clientId = app.clientId;
            connection.sessionId = session.sessionId;
            connection.sequence = 0;

            this.logger.success("SESSION", `Session ${session.sessionId} identified for app ${app.clientId}`);
        } catch (error) {
            await this.handleAuthenticationError(connection, pending, error, data.clientId);
        }
    }

    public async resume(connection: LocalConnection, data: GatewayResumeData): Promise<void> {
        if (connection.clientId) return this.connectionRegistry.close(connection, GatewayCloseCode.AlreadyAuthenticated, "Already authenticated");
        if (this.closeIfAuthBlocked(connection)) return;

        const pending: PendingConnection | null = await this.claimPending(connection, data.clientId);
        if (!pending) return;

        try {
            const result: AppCredentialsResult = await this.appAuthenticator.getCredentials(data.clientId, data.clientSecret);
            if (!this.connectionRegistry.isOpen(connection)) return;
            if (result.status !== "valid") return await this.credentialsNotAccepted(connection, pending, result, `Resume of ${data.clientId}`);

            const sequence: number | null = await this.sessionStore.getSequence(data.clientId, data.sessionId);
            if (sequence === null) return await this.sessionNotFound(connection, pending);

            if (data.seq > sequence) {
                await this.sessionStore.destroy(data.clientId, data.sessionId);
                return this.connectionRegistry.close(connection, GatewayCloseCode.InvalidSequence, "Invalid sequence");
            }

            const attached: AttachedSession | null = await this.sessionStore.attach(data.clientId, data.sessionId, pending);
            if (!attached) return await this.sessionNotFound(connection, pending);

            const replay: GatewayPayload[] | null = SessionStore.getReplay(attached.buffer, data.seq, sequence);
            if (!replay) {
                await this.sessionStore.abandonResume(data.clientId, data.sessionId, pending);
                return this.connectionRegistry.sendInvalidSession(connection, false, "Too many missed events to resume, IDENTIFY again");
            }

            if (!this.connectionRegistry.isOpen(connection)) {
                return await this.connectionRegistry.cleanUp({connectionId: connection.connectionId, clientId: data.clientId, sessionId: data.sessionId}, null);
            }

            this.replacePreviousConnection(attached.previousConnectionId, connection);

            for (const payload of replay) this.connectionRegistry.send(connection, payload);

            this.connectionRegistry.send(connection, GatewayProtocol.createPayload(GatewayOpCode.Dispatch, {
                sessionId: data.sessionId,
                replayed: replay.length,
            }, GatewayDispatchEvent.Resumed));

            connection.clientId = data.clientId;
            connection.sessionId = data.sessionId;
            connection.sequence = replay.at(-1)?.s ?? data.seq;

            this.logger.success("SESSION", `Session ${data.sessionId} resumed (${replay.length} replayed)`);
        } catch (error) {
            await this.handleAuthenticationError(connection, pending, error, data.clientId);
        }
    }

    /** Connections opened before the address hit the auth failure limit must not keep trying either. */
    private closeIfAuthBlocked(connection: LocalConnection): boolean {
        const rejection: SocketData["rejection"] = this.connectionLimitManager.getAuthRejection(connection.socket.data.remoteAddress);
        if (!rejection) return false;

        this.connectionRegistry.close(connection, rejection.code, rejection.reason);
        return true;
    }

    private async credentialsNotAccepted(
        connection: LocalConnection,
        pending: PendingConnection,
        result: Exclude<AppCredentialsResult, {status: "valid"}>,
        attempt: string,
    ): Promise<void> {
        if (result.status === "invalid") {
            this.logger.warning("AUTH", `${attempt} with invalid credentials`);
            return this.authenticationFailed(connection, "Invalid clientId or clientSecret");
        }

        // A Twitch outage says nothing about the credentials: no 4004, no failed attempt
        this.logger.warning("AUTH", `${attempt} not possible, Twitch is unavailable`);
        await this.connectionStore.releasePending(pending);
        this.connectionRegistry.sendInvalidSession(connection, false, "Twitch is unavailable, try again later");
    }

    private authenticationFailed(connection: LocalConnection, reason: string): void {
        this.connectionLimitManager.recordAuthFailure(connection.socket.data.remoteAddress);
        this.connectionRegistry.close(connection, GatewayCloseCode.AuthenticationFailed, reason);
    }

    private replacePreviousConnection(previousConnectionId: string | null, connection: LocalConnection): void {
        if (!previousConnectionId || previousConnectionId === connection.connectionId) return;

        const previous: LocalConnection | undefined = this.connectionRegistry.get(previousConnectionId);
        if (previous) this.connectionRegistry.replaceSession(previous);
    }

    private async sessionNotFound(connection: LocalConnection, pending: PendingConnection): Promise<void> {
        await this.connectionStore.releasePending(pending);
        this.connectionRegistry.sendInvalidSession(connection, false, "Session not found or expired, IDENTIFY again");
    }

    private async claimPending(connection: LocalConnection, clientId: string): Promise<PendingConnection | null> {
        let claim: ClaimResult;
        try {
            claim = await this.connectionStore.claimPending(connection.connectionId);
        } catch (error) {
            this.logger.error("AUTH", `Authentication of app ${clientId} failed, Redis unavailable?`);
            this.errorReporter.handle(error, {clientId, connectionId: connection.connectionId});
            this.connectionRegistry.sendInvalidSession(connection, false, "Service temporarily unavailable, try again later");
            return null;
        }

        if (claim.status === "busy") {
            this.connectionRegistry.close(connection, GatewayCloseCode.AlreadyAuthenticated, "Already authenticated");
            return null;
        }

        if (claim.status === "expired") {
            const seconds: number = this.configManager.get().gateway.identifyTimeout / 1000;
            this.connectionRegistry.close(connection, GatewayCloseCode.NotAuthenticated, `You must IDENTIFY or RESUME within ${seconds} seconds`);
            return null;
        }

        return claim.pending;
    }

    private async handleAuthenticationError(connection: LocalConnection, pending: PendingConnection, error: unknown, clientId: string): Promise<void> {
        this.logger.error("AUTH", `Authentication of app ${clientId} failed, Redis unavailable?`);
        this.errorReporter.handle(error, {clientId, connectionId: connection.connectionId});

        if (!this.connectionRegistry.isOpen(connection)) return;

        try {
            await this.connectionStore.releasePending(pending);
        } catch {
        }

        this.connectionRegistry.sendInvalidSession(connection, false, "Service temporarily unavailable, try again later");
    }
}

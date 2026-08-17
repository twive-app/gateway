import {WebSocket, WebSocketServer, RawData} from "ws";
import {v4 as uuid} from "uuid";
import {Bean, Autowired, PostConstruct, Cron, ShutdownHook} from "@infra/BeanManager.ts";
import type {ConfigManager} from "@infra/ConfigManager.ts";
import type {Logger} from "@utils/Logger.ts";
import {Application} from "@twitch/Application.ts";
import {EventSubTransportMethod, type EventSubSubscriptionRequestBody, } from "twitch-dev-types";
import type {ConduitManager} from "@twitch/ConduitManager.ts";
import type {ApplicationCredentials, ApplicationManager} from "@twitch/ApplicationManager.ts";
import type {EventSubSubscriptionManager} from "@twitch/EventSubSubscriptionManager.ts";

enum GatewayOpCode {
    IDENTIFY = 0,
    HELLO = 1,
    HEARTBEAT = 2,
    HEARTBEAT_ACK = 3,
    INVALID_SESSION = 4,
    DISPATCH = 5,
}

interface GatewayPayload<T = Record<string, any>> {
    op: GatewayOpCode;
    t?: string;
    d?: T;
}

interface GatewayClient extends WebSocket {
    connectionId: string;
    isAlive?: boolean;
    identified: boolean;
    identifyTimeout: NodeJS.Timeout;
    twitch: {
        clientId: string;
    };
}

class GatewayException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GatewayError";
    }
}

@Bean()
export class GatewayService {
    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    @Autowired()
    private conduitManager!: ConduitManager;

    @Autowired()
    private applicationManager!: ApplicationManager;

    @Autowired()
    private eventSubSubscriptionManager!: EventSubSubscriptionManager;

    private server!: WebSocketServer;
    private connections: Map<string, Set<GatewayClient>> = new Map<string, Set<GatewayClient>>();

    @PostConstruct()
    public initialize(): void {
        const port: number = this.configManager.get().gateway.port;

        this.server = new WebSocketServer({
            host: process.env.SERVER_HOST || "0.0.0.0",
            port,
        });

        this.logger.info("GATEWAY", `Ready on port ${port}`);

        this.server.on("connection", (client: GatewayClient): void => {
            this.logger.info("GATEWAY", `New client connection established`);

            client.connectionId = uuid();
            client.isAlive = true;

            this.handleEvents(client);
            this.handleIdentifyTimeout(client);
        });
    }

    private handleEvents(client: GatewayClient): void {
        client.on("close", (): void => {
            this.logger.info("GATEWAY", "Client disconnected");

            if (client?.twitch?.clientId) this.handleDisconnect(client);
        });

        client.on("message", (rawData: RawData): void => {
            let payload: GatewayPayload;
            try {
                payload = JSON.parse(rawData.toString());
            } catch (error) {
                throw new GatewayException(`Failed to parse message rawData: ${(error as Error).message}`);
            }

            this.handlePayload(client, payload);
        });
    }

    private handleDisconnect(client: GatewayClient): void {
        const clients: Set<GatewayClient>|undefined = this.connections.get(client.twitch.clientId);
        if (!clients) return;

        clients.delete(client);
        if (clients.size === 0) this.connections.delete(client.twitch.clientId);
    }

    private handlePayload(client: GatewayClient, payload: GatewayPayload): void {
        switch (payload.op) {
            case GatewayOpCode.IDENTIFY:
                this.handleIdentify(client, payload).then();
                break;

            case GatewayOpCode.HEARTBEAT:
                client.isAlive = true;

                this.sendPayload(client, {
                    op: GatewayOpCode.HEARTBEAT_ACK
                });
                break;

            default:
                this.logger.warning("GATEWAY", `Unknown OpCode: ${payload.op}`);
        }
    }

    private sendPayload(client: GatewayClient, payload: GatewayPayload): void {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
    }

    private async handleIdentify(client: GatewayClient, payload: GatewayPayload): Promise<void> {
        if (client.identifyTimeout) clearTimeout(client.identifyTimeout);

        this.sendPayload(client, {
            op: GatewayOpCode.HELLO,
            d: {
                heartbeatInterval: 15000,
            },
        });

        const { clientId, clientSecret, loginName } = payload.d || {};

        if (!clientId) {
            this.sendPayload(client, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "Missing clientId",
                },
            });

            return this.logger.warning("GATEWAY", "Identification without providing the twitch client id");
        }

        if (!clientSecret) {
            this.sendPayload(client, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "Missing clientSecret",
                },
            });

            return this.logger.warning("GATEWAY", "Identification without providing twitch client secret");
        }

        if (!loginName) {
            this.sendPayload(client, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "Missing loginName",
                },
            });

            return this.logger.warning("GATEWAY", "Identification without providing twitch login name");
        }

        const credentials: ApplicationCredentials|null = await this.applicationManager.getCredentials(
            clientId,
            clientSecret,
            loginName
        );

        if (!credentials) {
            this.sendPayload(client, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "Invalid credentials",
                },
            });

            return this.logger.warning("GATEWAY", "Identification with invalid credentials");
        }

        this.logger.success("GATEWAY", "New client identified");
        client.identified = true;
        client.twitch = {
            clientId: clientId,
        };

        if (!this.connections.has(clientId)) this.connections.set(clientId, new Set());
        this.connections.get(clientId)!.add(client);

        const app: Application|null = await this.applicationManager.createOrGetApplication(
            clientId,
            credentials.clientUserId,
            credentials.accessToken
        );

        if (!app) return;

        if (!app.conduitId || !app.subscribed) {
            const conduitId: string = await this.conduitManager.createConduit(app);
            if (!conduitId) return;

            const subs: EventSubSubscriptionRequestBody[] = this.eventSubSubscriptionManager.getAppSubscriptions(
                app.clientId,
                {
                method: EventSubTransportMethod.Conduit,
                conduit_id: conduitId
                }
            );

            await this.eventSubSubscriptionManager.subscribe(subs, app.accessToken, app.clientId);

            app.subscribed = true;
            await app.save();
        }

        this.broadcastDispatch(app.clientId, "READY", {
            connectionId: client.connectionId,
            twitch: {
                clientUserId: app.clientUserId,
                accessToken: app.accessToken,
                conduitId: app.conduitId,
            },
        });
    }

    @Cron("*/20 * * * * *") // every 20 seconds
    public checkHeartbeats(): void {
        if (this.connections.size === 0) return;

        this.logger.info("GATEWAY", "Checking clients heartbeat");

        this.connections.forEach((clients: Set<GatewayClient>, clientId: string): void => {
            clients.forEach((client: GatewayClient): void => {
                if (client.isAlive === false) {
                    this.logger.warning("GATEWAY", "Client connection is dead. Terminating.");

                    clients.delete(client);
                    return client.terminate();
                }

                client.isAlive = false;
            });

            if (clients.size === 0) this.connections.delete(clientId);
        });
    }

    @ShutdownHook()
    public closeConnections(): void {
        if (this.connections.size === 0) return;

        this.logger.info("GATEWAY", "Closing all client connections");

        this.connections.forEach((clients: Set<GatewayClient>): void => {
            clients.forEach((client: GatewayClient): void => {
                client.close(1012, "Backend is shutting down.")
            });
        });

        this.connections.clear();
    }

    private handleIdentifyTimeout(client: GatewayClient): void {
        client.identifyTimeout = setTimeout((): void => {
            this.logger.warning("GATEWAY", "Client not identified within 30 seconds. Terminating connection.");

            this.sendPayload(client, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "You must send OpCode 0 (IDENTIFY) within 30 seconds.",
                },
            });

            client.close(4002, "Client not identified within 30 seconds.");
        }, 30000); // 30 seconds
    }

    public broadcastDispatch(appClientId: string, eventName: string, data: Record<string, any>): void {
        const clients: Set<GatewayClient>|undefined = this.connections.get(appClientId);
        if (!clients || clients.size === 0) return;

        const payload: GatewayPayload = {
            op: GatewayOpCode.DISPATCH,
            t: eventName,
            d: data
        };

        clients.forEach((socket: GatewayClient): void => {
            if (socket.readyState === WebSocket.OPEN) this.sendPayload(socket, payload);
        });

        this.logger.info("GATEWAY", `Dispatched ${eventName} to app ${appClientId}`);
    }
}

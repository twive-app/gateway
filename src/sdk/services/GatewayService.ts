import {WebSocket, WebSocketServer, RawData} from "ws";
import {v4 as uuid} from "uuid";
import {Bean, Autowired, PostConstruct, Cron, ShutdownHook} from "@infra/BeanManager.ts";
import {ConfigManager} from "@infra/ConfigManager.ts";
import {Logger} from "@utils/Logger.ts";

enum GatewayOpCode {
    IDENTIFY = 0,
    HELLO = 1,
    HEARTBEAT = 2,
    HEARTBEAT_ACK = 3,
    INVALID_SESSION = 4,
    DISPATCH = 5,
}

interface GatewayPayload<T = any> {
    op: GatewayOpCode;
    t?: string;
    d?: T;
}

interface SocketClient extends WebSocket {
    id?: string;
    isAlive?: boolean;
    identified?: boolean;
    identifyTimeout?: NodeJS.Timeout;
    applicationId?: string;
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

    private socketServer!: WebSocketServer;
    private connections: Map<string, Set<SocketClient>> = new Map<string, Set<SocketClient>>();

    @PostConstruct()
    public initialize(): void {
        const port: number = this.configManager.get().gateway.port;

        this.socketServer = new WebSocketServer({
            host: process.env.SERVER_HOST || "0.0.0.0",
            port,
        });

        this.logger.info("GATEWAY", `Ready on port ${port}`);

        this.socketServer.on("connection", (socket: SocketClient): void => {
            this.logger.info("GATEWAY", `New client connection established`);

            socket.id = uuid();
            socket.isAlive = true;

            this.handleEvents(socket);
            this.handleIdentifyTimeout(socket);
        });
    }

    private handleEvents(socket: SocketClient): void {
        socket.on("close", (): void => {
            if (socket.applicationId) this.handleDisconnect(socket);
        });

        socket.on("message", (rawData: RawData): void => {
            try {
                const payload: GatewayPayload = JSON.parse(rawData.toString());
                this.handleSocketPayload(socket, payload);
            } catch (error) {
                throw new GatewayException(`Failed to parse payload: ${(error as Error).message}`);
            }
        });
    }

    private handleDisconnect(socket: SocketClient): void {
        const clients: Set<SocketClient>|undefined = this.connections.get(socket.applicationId as string);
        if (!clients) return;

        this.logger.info("GATEWAY", `Client disconnected from application ${socket.applicationId}`);

        clients.delete(socket);
        if (clients.size === 0) this.connections.delete(socket.applicationId as string);
    }

    private handleSocketPayload(socket: SocketClient, payload: GatewayPayload): void {
        switch (payload.op) {
            case GatewayOpCode.IDENTIFY:
                this.handleIdentify(socket, payload);
                break;

            case GatewayOpCode.HEARTBEAT:
                socket.isAlive = true;

                this.sendPayload(socket, {
                    op: GatewayOpCode.HEARTBEAT_ACK
                });
                break;

            default:
                this.logger.warning("GATEWAY", `Unhandled OpCode: ${payload.op}`);
        }
    }

    private sendPayload(socket: SocketClient, payload: GatewayPayload): void {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    }

    private handleIdentify(socket: SocketClient, payload: GatewayPayload): void {
        if (socket.identifyTimeout) clearTimeout(socket.identifyTimeout);

        const { applicationId } = payload.d || {};

        if (!applicationId) {
            this.sendPayload(socket, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "Missing applicationId",
                },
            });

            return this.logger.warning("GATEWAY", `Client identified without providing applicationId. Terminating connection.`);
        }

        socket.identified = true;
        socket.applicationId = applicationId;

        if (!this.connections.has(applicationId)) this.connections.set(applicationId, new Set());
        this.connections.get(applicationId)!.add(socket);

        this.logger.success("GATEWAY", `Client identified for application ${applicationId}`);

        this.sendPayload(socket, {
            op: GatewayOpCode.HELLO,
            d: {
                connectionId: socket.id,
                heartbeatInterval: 15000,
            },
        });
    }

    @Cron("*/20 * * * * *") // every 20 seconds
    public checkHeartbeats(): void {
        if (this.connections.size === 0) return;

        this.logger.info("GATEWAY", "Checking clients heartbeat");

        this.connections.forEach((sockets: Set<SocketClient>, applicationId: string): void => {
            sockets.forEach((socket: SocketClient): void => {
                if (socket.isAlive === false) {
                    this.logger.warning("GATEWAY", `Connection for application ${applicationId} is dead. Terminating.`);
                    sockets.delete(socket);
                    return socket.terminate();
                }

                socket.isAlive = false;
            });

            if (sockets.size === 0) this.connections.delete(applicationId);
        });
    }

    @ShutdownHook()
    public closeConnections(): void {
        if (this.connections.size === 0) return;

        this.logger.info("GATEWAY", "Closing all connections");

        this.connections.forEach((sockets: Set<SocketClient>): void => {
            sockets.forEach((socket: SocketClient): void => {
                socket.close(1012, "Backend is shutting down.")
            });
        });

        this.connections.clear();
    }

    private handleIdentifyTimeout(socket: SocketClient): void {
        socket.identifyTimeout = setTimeout((): void => {
            this.logger.warning("GATEWAY", `Client not identified within 30 seconds. Terminating connection.`);

            this.sendPayload(socket, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "You must send OpCode 0 (IDENTIFY) within 30 seconds.",
                },
            });

            socket.close(4002, "Client not identified within 30 seconds.");
        }, 30000); // 30 seconds
    }

    public broadcast(applicationId: string, eventName: string, data: unknown): void {
        const clients: Set<SocketClient>|undefined = this.connections.get(applicationId);
        if (!clients || clients.size === 0) return;

        const payload: GatewayPayload = {
            op: GatewayOpCode.DISPATCH,
            t: eventName,
            d: data
        };

        clients.forEach((socket: SocketClient): void => {
            if (socket.readyState === WebSocket.OPEN) this.sendPayload(socket, payload);
        });

        this.logger.info("GATEWAY", `Dispatched '${eventName}' to ${clients.size} clients of application ${applicationId}`);
    }
}

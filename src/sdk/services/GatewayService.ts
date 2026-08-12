import {WebSocket, WebSocketServer, RawData} from "ws";
import {v4 as uuid} from "uuid";
import {Bean, Autowired, PostConstruct, Cron, ShutdownHook} from "@infra/BeanManager.ts";
import {ConfigManager} from "@infra/ConfigManager.ts";
import {Logger} from "@utils/Logger.ts";

enum GatewayOpCode {
    HELLO = 0,
    HEARTBEAT = 1,
    HEARTBEAT_ACK = 2,
    IDENTIFY = 3,
    INVALID_SESSION = 4,
}

interface GatewayPayload<T = any> {
    op: GatewayOpCode;
    d?: T;
}

interface SocketClient extends WebSocket {
    id: string;
    isAlive: boolean;
    identified: boolean;
    applicationId: string;
    identifyTimeout: NodeJS.Timeout|undefined;
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
            socket.id = uuid();
            socket.isAlive = true;

            this.logger.info("GATEWAY", `New client connection established`);

            this.sendPayload(socket, {
                op: GatewayOpCode.HELLO,
                d: {
                    connectionId: socket.id,
                    heartbeatInterval: 15000,
                },
            });

            this.handleEvents(socket);
            this.handleIdentifyTimeout(socket);
        });
    }

    private sendPayload(socket: SocketClient, payload: GatewayPayload): void {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    }

    private handleDisconnect(socket: SocketClient, code: number, reason: string): void {
        const clients: Set<SocketClient>|undefined = this.connections.get(socket.applicationId as string);
        if (!clients) return;

        this.logger.info("GATEWAY", `Client disconnected from application ${socket.applicationId} with code ${code}: ${reason}`);

        clients.delete(socket);
        if (clients.size === 0) this.connections.delete(socket.applicationId as string);
    }

    private handleEvents(socket: SocketClient): void {
        socket.on("close", (code: number, reason: Buffer<ArrayBufferLike>): void => {
            if (socket.applicationId) this.handleDisconnect(socket, code, reason.toString());
        });

        socket.on("message", (rawMessage: RawData): void => {
            try {
                const payload: GatewayPayload = JSON.parse(rawMessage.toString());
                this.handleSocketPayload(socket, payload);
            } catch (error) {
                throw new GatewayException(`Failed to parse payload: ${(error as Error).message}`);
            }
        });
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

    @Cron("*/20 * * * * *")
    public checkHeartbeats(): void {
        if (this.connections.size === 0) return;

        this.logger.info("GATEWAY", "Checking heartbeats for all connections");

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
    public closeConnectionsOnShutdown(): void {
        if (this.connections.size === 0) return;

        this.logger.info("GATEWAY", "Closing all connections");

        this.connections.forEach((sockets: Set<SocketClient>): void => {
            sockets.forEach((socket: SocketClient): void => socket.close(1012, "Shutdown"));
        });
        this.connections.clear();
    }

    private handleIdentify(socket: SocketClient, payload: GatewayPayload): void {
        const { applicationId } = payload.d || {};

        if (!applicationId) {
            this.sendPayload(socket, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "Missing applicationId"
                }
            });

            this.logger.warning("GATEWAY", `Client identified without providing applicationId. Terminating connection.`);
            clearTimeout(socket.identifyTimeout);
            return;
        }

        if (socket.identifyTimeout) clearTimeout(socket.identifyTimeout);

        socket.identified = true;
        socket.applicationId = applicationId;

        if (!this.connections.has(applicationId)) this.connections.set(applicationId, new Set());
        this.connections.get(applicationId)!.add(socket);

        this.logger.success("GATEWAY", `Client identified for application ${applicationId}`);
    }

    private handleIdentifyTimeout(socket: SocketClient): void {
        socket.identifyTimeout = setTimeout((): void => {
            this.logger.warning("GATEWAY", `Client not identified within 10 seconds. Terminating connection.`);

            this.sendPayload(socket, {
                op: GatewayOpCode.INVALID_SESSION,
                d: {
                    message: "You must send OpCode 3 (IDENTIFY) within 10 seconds.",
                },
            });

            socket.close(4002, "Client not identified within 10 seconds.");
        }, 10000);
    }
}

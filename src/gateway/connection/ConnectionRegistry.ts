import type {ServerWebSocket} from "bun";
import {Autowired, Bean, Cron} from "@core/bean/BeanDecorators.ts";
import type {ConfigManager} from "@core/config/ConfigManager.ts";
import type {ErrorReporter} from "@core/error/ErrorReporter.ts";
import type {Logger} from "@core/logging/Logger.ts";
import {
    GatewayCloseCode,
    GatewayOpCode,
    GatewayProtocol,
    type GatewayInvalidSessionData,
    type GatewayPayload,
} from "@gateway/GatewayProtocol.ts";
import type {ConnectionRef, ConnectionState, ConnectionStore} from "@gateway/connection/ConnectionStore.ts";
import type {SessionStore} from "@gateway/session/SessionStore.ts";

const webSocketOpen: number = 1;
const heartbeatToleranceFactor: number = 1.5;

export interface SocketData {
    connectionId: string;
    remoteAddress: string;
    socketAddress: string;
    rejection: {code: GatewayCloseCode; reason: string} | null;
}

export interface LocalConnection extends ConnectionRef {
    socket: ServerWebSocket<SocketData>;
    sequence: number;
    delivery: Promise<void>;
    backlog: number;
}

@Bean()
export class ConnectionRegistry {
    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    @Autowired()
    private errorReporter!: ErrorReporter;

    @Autowired()
    private connectionStore!: ConnectionStore;

    @Autowired()
    private sessionStore!: SessionStore;

    private readonly connections: Map<string, LocalConnection> = new Map<string, LocalConnection>();

    public replaceSession(connection: LocalConnection): void {
        connection.sessionId = null;
        this.close(connection, GatewayCloseCode.SessionReplaced, "Session was resumed on another connection");
    }

    public add(socket: ServerWebSocket<SocketData>): LocalConnection {
        const connection: LocalConnection = {
            socket,
            connectionId: socket.data.connectionId,
            clientId: null,
            sessionId: null,
            sequence: 0,
            delivery: Promise.resolve(),
            backlog: 0,
        };
        this.connections.set(connection.connectionId, connection);
        return connection;
    }

    public get(connectionId: string): LocalConnection | undefined {
        return this.connections.get(connectionId);
    }

    public delete(connectionId: string): void {
        this.connections.delete(connectionId);
    }

    public all(): LocalConnection[] {
        return [...this.connections.values()];
    }

    public takeAll(): LocalConnection[] {
        const connections: LocalConnection[] = this.all();
        this.connections.clear();
        return connections;
    }

    public size(): number {
        return this.connections.size;
    }

    public send(connection: LocalConnection, payload: GatewayPayload): boolean {
        if (!this.isOpen(connection)) return false;

        const status: number = connection.socket.send(JSON.stringify(payload));
        if (status > 0) {
            connection.backlog = 0;
            return true;
        }
        if (status < 0 && ++connection.backlog <= this.maxBacklog()) return true;

        this.logger.warning("CONNECTION", `Connection ${connection.connectionId} can't keep up (${connection.backlog} frames buffered), closing it`);
        this.close(connection, GatewayCloseCode.UnknownError, "Client too slow, RESUME");
        return false;
    }

    private maxBacklog(): number {
        const replayBufferSize: number = this.configManager.get().gateway.replayBufferSize;
        return replayBufferSize > 0 ? Math.floor(replayBufferSize / 2) : Number.POSITIVE_INFINITY;
    }

    public close(connection: LocalConnection, code: number, reason: string): void {
        if (this.isOpen(connection)) connection.socket.close(code, reason);
    }

    public sendInvalidSession(connection: LocalConnection, resumable: boolean, message: string): void {
        this.send(connection, GatewayProtocol.createPayload<GatewayInvalidSessionData>(GatewayOpCode.InvalidSession, {resumable, message}));
    }

    public isOpen(connection: LocalConnection): boolean {
        return connection.socket.readyState === webSocketOpen;
    }

    public async cleanUp(ref: ConnectionRef, code: number | null): Promise<void> {
        await this.connectionStore.remove(ref);
        if (!ref.clientId || !ref.sessionId) return;

        if (code !== null && GatewayProtocol.sessionInvalidatingCloseCodes.has(code)) {
            await this.sessionStore.destroyOwned(ref.clientId, ref.sessionId, ref.connectionId);
        } else {
            await this.sessionStore.detach(ref.clientId, ref.sessionId, ref.connectionId);
        }
    }

    @Cron("*/5 * * * * *")
    public async checkTimeouts(): Promise<void> {
        const refs: ConnectionRef[] = this.all().map((connection: LocalConnection): ConnectionRef => ({
            connectionId: connection.connectionId,
            clientId: connection.clientId,
            sessionId: connection.sessionId,
        }));

        let states: ConnectionState[];
        try {
            states = await this.connectionStore.getStates(refs);
        } catch (error) {
            return this.errorReporter.handleThrottled("CONNECTION", "Could not check gateway timeouts", error);
        }

        const timeout: number = this.configManager.get().gateway.heartbeatInterval * heartbeatToleranceFactor;
        const now: number = Date.now();

        refs.forEach((ref: ConnectionRef, index: number): void => {
            const connection: LocalConnection | undefined = this.get(ref.connectionId);
            if (!connection || connection.clientId !== ref.clientId) return;

            const state: ConnectionState = states[index];
            if (state.status === "pending") {
                if (state.exists) return;

                const seconds: number = this.configManager.get().gateway.identifyTimeout / 1000;
                this.logger.debug("CONNECTION", `Connection ${ref.connectionId} did not identify in time`);
                return this.close(connection, GatewayCloseCode.NotAuthenticated, `You must IDENTIFY or RESUME within ${seconds} seconds`);
            }

            if (state.connection && now - state.connection.lastHeartbeatAt <= timeout) return;

            this.logger.warning("CONNECTION", `Connection ${ref.connectionId} missed its heartbeat. Closing.`);
            this.close(connection, GatewayCloseCode.HeartbeatTimeout, "Heartbeat timed out");
        });
    }
}

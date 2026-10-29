import z from "zod";
import {Autowired, Bean} from "@core/bean/BeanDecorators.ts";
import type {ConfigManager} from "@core/config/ConfigManager.ts";
import type {RedisClient} from "@core/redis/RedisClient.ts";
import type {RedisClientTransaction} from "@core/redis/RedisClient.ts";
import {RedisKeys} from "@core/redis/RedisKeys.ts";
import {SessionStore} from "@gateway/session/SessionStore.ts";

const pendingConnectionSchema = z.object({
    connectionId: z.string(),
    remoteAddress: z.string(),
    connectedAt: z.number(),
    authenticating: z.boolean(),
});

export interface PendingConnection {
    connectionId: string;
    remoteAddress: string;
    connectedAt: number;
    authenticating: boolean;
}

const gatewayConnectionSchema = z.object({
    connectionId: z.string(),
    sessionId: z.string(),
    remoteAddress: z.string(),
    connectedAt: z.number(),
    lastHeartbeatAt: z.number(),
});

interface GatewayConnectionData {
    connectionId: string;
    sessionId: string;
    remoteAddress: string;
    connectedAt: number;
    lastHeartbeatAt: number;
}

export interface ConnectionRef {
    connectionId: string;
    clientId: string | null;
    sessionId: string | null;
}

export type ClaimResult = {status: "claimed"; pending: PendingConnection} | {status: "expired"} | {status: "busy"};

export type ConnectionState =
    | {status: "pending"; exists: boolean}
    | {status: "authenticated"; connection: GatewayConnectionData | null};

const heartbeatScript: string = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local connection = cjson.decode(raw)
connection.lastHeartbeatAt = tonumber(ARGV[1])
redis.call("SET", KEYS[1], cjson.encode(connection), "PX", ARGV[2])
for i = 2, #KEYS do redis.call("PEXPIRE", KEYS[i], ARGV[3]) end
return 1
`;

@Bean()
export class ConnectionStore {
    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private redisClient!: RedisClient;

    public async createPending(connectionId: string, remoteAddress: string): Promise<void> {
        const pending: PendingConnection = {connectionId, remoteAddress, connectedAt: Date.now(), authenticating: false};
        await this.redisClient.transaction((multi: RedisClientTransaction): void => {
            this.addPending(multi, pending);
        });
    }

    public async claimPending(connectionId: string): Promise<ClaimResult> {
        let busy: boolean = false;
        const pending: PendingConnection | null = await this.redisClient.updateJson(
            RedisKeys.gateway.pendingConnection(connectionId),
            pendingConnectionSchema,
            (current: PendingConnection): PendingConnection => {
                busy = current.authenticating;
                return {...current, authenticating: true};
            },
        );

        if (!pending) return {status: "expired"};
        if (busy) return {status: "busy"};
        return {status: "claimed", pending};
    }

    public async releasePending(pending: PendingConnection): Promise<void> {
        await this.redisClient.transaction((multi: RedisClientTransaction): void => {
            this.addPending(multi, {...pending, authenticating: false});
        });
    }

    public addPromotion(multi: RedisClientTransaction, pending: PendingConnection, clientId: string, sessionId: string): void {
        const connection: GatewayConnectionData = {
            connectionId: pending.connectionId,
            sessionId,
            remoteAddress: pending.remoteAddress,
            connectedAt: pending.connectedAt,
            lastHeartbeatAt: Date.now(),
        };

        multi.del(RedisKeys.gateway.pendingConnection(pending.connectionId));
        multi.set(RedisKeys.gateway.connection(clientId, pending.connectionId), JSON.stringify(connection), {
            expiration: {type: "PX", value: this.connectionTtlMs()},
        });
    }

    public addDemotion(multi: RedisClientTransaction, pending: PendingConnection, clientId: string): void {
        multi.del(RedisKeys.gateway.connection(clientId, pending.connectionId));
        this.addPending(multi, {...pending, authenticating: false});
    }

    public async consumeRateLimit(connectionId: string, maxMessages: number, windowMs: number): Promise<boolean> {
        const [count]: unknown[] = await this.redisClient.transaction((multi: RedisClientTransaction): void => {
            multi.incr(RedisKeys.gateway.rateLimit(connectionId));
            multi.pExpire(RedisKeys.gateway.rateLimit(connectionId), windowMs, "NX");
        });
        return Number(count) <= maxMessages;
    }

    public async heartbeat(clientId: string, connectionId: string, sessionId: string): Promise<void> {
        await this.redisClient.evalScript(
            heartbeatScript,
            [
                RedisKeys.gateway.connection(clientId, connectionId),
                RedisKeys.gateway.session(clientId, sessionId),
                RedisKeys.gateway.sessionSeq(clientId, sessionId),
                RedisKeys.gateway.sessionBuffer(clientId, sessionId),
            ],
            [String(Date.now()), String(this.connectionTtlMs()), String(SessionStore.attachedTtlMs(this.configManager.get().gateway))],
        );
    }

    public async getStates(refs: ConnectionRef[]): Promise<ConnectionState[]> {
        if (refs.length === 0) return [];

        const replies: unknown[] = await this.redisClient.pipeline((multi: RedisClientTransaction): void => {
            for (const ref of refs) {
                if (ref.clientId) multi.get(RedisKeys.gateway.connection(ref.clientId, ref.connectionId));
                else multi.exists(RedisKeys.gateway.pendingConnection(ref.connectionId));
            }
        });

        return refs.map((ref: ConnectionRef, index: number): ConnectionState => {
            if (!ref.clientId) return {status: "pending", exists: Number(replies[index]) > 0};
            return {status: "authenticated", connection: this.redisClient.parse(replies[index], gatewayConnectionSchema)};
        });
    }

    private addRemoval(multi: RedisClientTransaction, ref: ConnectionRef): void {
        multi.del(RedisKeys.gateway.pendingConnection(ref.connectionId));
        multi.del(RedisKeys.gateway.rateLimit(ref.connectionId));
        if (ref.clientId) multi.del(RedisKeys.gateway.connection(ref.clientId, ref.connectionId));
    }

    public async remove(ref: ConnectionRef): Promise<void> {
        await this.redisClient.transaction((multi: RedisClientTransaction): void => this.addRemoval(multi, ref));
    }

    public async removeAll(refs: ConnectionRef[]): Promise<void> {
        await this.redisClient.pipeline((multi: RedisClientTransaction): void => {
            for (const ref of refs) this.addRemoval(multi, ref);
        });
    }

    private connectionTtlMs(): number {
        return this.configManager.get().gateway.heartbeatInterval * 2;
    }

    private addPending(multi: RedisClientTransaction, pending: PendingConnection): void {
        multi.set(RedisKeys.gateway.pendingConnection(pending.connectionId), JSON.stringify(pending), {
            expiration: {type: "PX", value: this.configManager.get().gateway.identifyTimeout},
        });
    }
}

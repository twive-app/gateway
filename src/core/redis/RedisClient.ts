import {RedisClient as BunRedisClient} from "bun";
import type {Logger} from "@core/logging/Logger.ts";
import type {ConfigManager, ConfigValues} from "@core/config/ConfigManager.ts";
import type {ZodSafeParseResult, ZodType} from "zod";
import {Autowired, Bean, PostConstruct, ShutdownHook} from "@core/bean/BeanDecorators.ts";
import {MainError} from "@core/error/ErrorReporter.ts";

const connectTimeoutMs: number = 3000;
const maxReconnectDelayMs: number = 5000;
const maxUpdateAttempts: number = 5;
const compareAndSetScript: string = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
    redis.call("SET", KEYS[1], ARGV[2], "KEEPTTL")
    return 1
end
return 0
`;

const transactionScript: string = `
local results = {}
local position = 2
local keyIndex = 1
for i = 1, tonumber(ARGV[1]) do
    local command = {ARGV[position]}
    local keyCount = tonumber(ARGV[position + 1])
    local argCount = tonumber(ARGV[position + 2])
    for j = 1, keyCount do
        command[#command + 1] = KEYS[keyIndex]
        keyIndex = keyIndex + 1
    end
    for j = 1, argCount do command[#command + 1] = ARGV[position + 2 + j] end
    position = position + 3 + argCount
    results[i] = redis.call(unpack(command))
end
return results
`;

interface SetOptions {
    expiration?: {type: "EX" | "PX"; value: number};
    condition?: "NX" | "XX";
}

interface RedisCommand {
    name: string;
    keys: string[];
    args: string[];
}

export class RedisClientTransaction {
    public readonly commands: RedisCommand[] = [];

    public set(key: string, value: string, options?: SetOptions): this {
        const args: string[] = [value];
        if (options?.expiration) args.push(options.expiration.type, String(Math.ceil(options.expiration.value)));
        if (options?.condition) args.push(options.condition);
        return this.add("SET", [key], args);
    }

    public get(key: string): this {
        return this.add("GET", [key]);
    }

    public del(keys: string | string[]): this {
        return this.add("DEL", this.list(keys));
    }

    public exists(key: string): this {
        return this.add("EXISTS", [key]);
    }

    public incr(key: string): this {
        return this.add("INCR", [key]);
    }

    public pExpire(key: string, milliseconds: number, mode?: "NX" | "XX" | "GT" | "LT"): this {
        const args: string[] = [String(Math.ceil(milliseconds))];
        if (mode) args.push(mode);
        return this.add("PEXPIRE", [key], args);
    }

    public sAdd(key: string, members: string | string[]): this {
        return this.add("SADD", [key], this.list(members));
    }

    public sRem(key: string, members: string | string[]): this {
        return this.add("SREM", [key], this.list(members));
    }

    public sCard(key: string): this {
        return this.add("SCARD", [key]);
    }

    public lRange(key: string, start: number, stop: number): this {
        return this.add("LRANGE", [key], [String(start), String(stop)]);
    }

    private add(name: string, keys: string[], args: string[] = []): this {
        this.commands.push({name, keys, args});
        return this;
    }

    private list(values: string | string[]): string[] {
        return Array.isArray(values) ? values : [values];
    }
}

@Bean()
export class RedisClient {
    private client: BunRedisClient | null = null;
    private reconnectTimer: Timer | null = null;
    private reconnectAttempts: number = 0;
    private shuttingDown: boolean = false;
    private readonly connectionWaiters: Set<() => void> = new Set<() => void>();

    @Autowired()
    private configManager!: ConfigManager;

    @Autowired()
    private logger!: Logger;

    @PostConstruct()
    public initialize(): void {
        const client: BunRedisClient = new BunRedisClient(this.connectionUrl(), {
            autoReconnect: false,
            enableOfflineQueue: false,
            connectionTimeout: connectTimeoutMs,
        });

        client.onconnect = (): void => {
            this.reconnectAttempts = 0;
            const {host, port, db}: ConfigValues["redis"] = this.configManager.get().redis;
            this.logger.success("REDIS", `Connected to Redis at ${host}:${port} (db ${db})`);
            for (const resolve of this.connectionWaiters) resolve();
            this.connectionWaiters.clear();
        };

        client.onclose = (error: Error): void => {
            if (this.shuttingDown) return;
            this.logger.error("REDIS", `Connection error: ${error.message}`);
            this.scheduleReconnect();
        };

        this.client = client;
        this.connect();
    }

    public isReady(): boolean {
        return this.client?.connected ?? false;
    }

    public async ping(timeoutMs: number): Promise<number | null> {
        const client: BunRedisClient | null = this.client;
        if (!client?.connected) return null;

        const startedAt: number = performance.now();
        try {
            const reply: unknown = await Promise.race([client.send("PING", []), Bun.sleep(timeoutMs).then((): null => null)]);
            return reply === "PONG" ? Math.round((performance.now() - startedAt) * 10) / 10 : null;
        } catch {
            return null;
        }
    }

    public get<T>(key: string, schema?: ZodType<T>): Promise<T | null> {
        return this.execute(async (client: BunRedisClient): Promise<T | null> => {
            const value: string | null = await client.get(key);
            if (value === null) return null;
            if (schema) return this.parse(value, schema);
            return JSON.parse(value) as T;
        });
    }

    public mGet<T>(keys: string[], schema: ZodType<T>): Promise<(T | null)[]> {
        return this.execute(async (client: BunRedisClient): Promise<(T | null)[]> => {
            if (keys.length === 0) return [];

            const values: unknown = await client.send("MGET", keys);
            return (values as unknown[]).map((value: unknown): T | null => this.parse(value, schema));
        });
    }

    public set<T>(key: string, value: T, expireSeconds?: number): Promise<void> {
        return this.execute(async (client: BunRedisClient): Promise<void> => {
            const args: string[] = [key, JSON.stringify(value)];
            if (expireSeconds) args.push("EX", String(Math.ceil(expireSeconds)));
            await client.send("SET", args);
        });
    }

    public setIfNotExists<T>(key: string, value: T, expireSeconds: number): Promise<boolean> {
        return this.execute(async (client: BunRedisClient): Promise<boolean> => {
            const result: unknown = await client.send("SET", [key, JSON.stringify(value), "NX", "EX", String(Math.ceil(expireSeconds))]);
            return result === "OK";
        });
    }

    public async createIfNotExists<T>(key: string, value: T, indexKey: string, member: string): Promise<boolean> {
        const [result]: unknown[] = await this.transaction((multi: RedisClientTransaction): void => {
            multi.set(key, JSON.stringify(value), {condition: "NX"}).sAdd(indexKey, member);
        });
        return result === "OK";
    }

    public async updateJson<T>(key: string, schema: ZodType<T>, mutate: (current: T) => T): Promise<T | null> {
        for (let attempt: number = 1; attempt <= maxUpdateAttempts; attempt++) {
            const written: T | null | undefined = await this.execute(async (client: BunRedisClient): Promise<T | null | undefined> => {
                const raw: string | null = await client.get(key);
                if (raw === null) return null;

                const parsed: ZodSafeParseResult<T> = schema.safeParse(JSON.parse(raw));
                if (!parsed.success) return null;

                const next: T = mutate(parsed.data);
                const swapped: unknown = await client.send("EVAL", [compareAndSetScript, "1", key, raw, JSON.stringify(next)]);
                return swapped === 1 ? next : undefined;
            });

            if (written !== undefined) return written;
        }

        throw new MainError("REDIS_UPDATE_CONFLICT", `Could not update ${key} after ${maxUpdateAttempts} attempts`);
    }

    public transaction(build: (multi: RedisClientTransaction) => void): Promise<unknown[]> {
        return this.execute(async (client: BunRedisClient): Promise<unknown[]> => {
            const multi: RedisClientTransaction = new RedisClientTransaction();
            build(multi);
            if (multi.commands.length === 0) return [];

            const keys: string[] = multi.commands.flatMap((command: RedisCommand): string[] => command.keys);
            const args: string[] = [String(multi.commands.length)];
            for (const command of multi.commands) args.push(command.name, String(command.keys.length), String(command.args.length), ...command.args);
            return await client.send("EVAL", [transactionScript, String(keys.length), ...keys, ...args]) as unknown[];
        });
    }

    public pipeline(build: (multi: RedisClientTransaction) => void): Promise<unknown[]> {
        return this.execute(async (client: BunRedisClient): Promise<unknown[]> => {
            const multi: RedisClientTransaction = new RedisClientTransaction();
            build(multi);
            return await Promise.all(multi.commands.map(({name, keys, args}: RedisCommand): Promise<unknown> => client.send(name, [...keys, ...args])));
        });
    }

    public evalScript(script: string, keys: string[], args: string[]): Promise<unknown> {
        return this.execute(async (client: BunRedisClient): Promise<unknown> => {
            return await client.send("EVAL", [script, String(keys.length), ...keys, ...args]);
        });
    }

    public addToSet(key: string, ...members: string[]): Promise<void> {
        return this.execute(async (client: BunRedisClient): Promise<void> => {
            if (members.length === 0) return;
            await client.send("SADD", [key, ...members]);
        });
    }

    public removeFromSet(key: string, ...members: string[]): Promise<void> {
        return this.execute(async (client: BunRedisClient): Promise<void> => {
            if (members.length === 0) return;
            await client.send("SREM", [key, ...members]);
        });
    }

    public getSetMembers(key: string): Promise<string[]> {
        return this.execute(async (client: BunRedisClient): Promise<string[]> => {
            return await client.smembers(key);
        });
    }

    public parse<T>(value: unknown, schema: ZodType<T>): T | null {
        if (typeof value !== "string") return null;

        let json: unknown;
        try {
            json = JSON.parse(value);
        } catch {
            return null;
        }

        const parsed: ZodSafeParseResult<T> = schema.safeParse(json);
        return parsed.success ? parsed.data : null;
    }

    @ShutdownHook(100)
    public close(): void {
        this.shuttingDown = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (!this.client?.connected) return;

        this.logger.info("REDIS", "Closing connection");
        this.client.close();
    }

    private async execute<T>(command: (client: BunRedisClient) => Promise<T>): Promise<T> {
        if (!this.client) throw new MainError("REDIS_NOT_INITIALIZED", "Redis has not been initialized yet");

        if (!this.client.connected) {
            await new Promise<void>((resolve: () => void): void => {
                const timer: Timer = setTimeout((): void => {
                    this.connectionWaiters.delete(done);
                    resolve();
                }, connectTimeoutMs);
                const done: () => void = (): void => {
                    clearTimeout(timer);
                    resolve();
                };
                this.connectionWaiters.add(done);
            });

            if (!this.client.connected) throw new MainError("REDIS_NOT_READY", "Redis is not connected");
        }

        return await command(this.client);
    }

    private connect(): void {
        this.client?.connect().catch((error: unknown): void => {
            if (this.shuttingDown || this.client?.connected) return;
            this.logger.error("REDIS", `Connection error: ${error instanceof Error ? error.message : String(error)}`);
            this.scheduleReconnect();
        });
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;

        this.reconnectAttempts++;
        const delay: number = Math.min(this.reconnectAttempts * 1000, maxReconnectDelayMs);
        this.logger.warning("REDIS", `Connection was lost. Reconnecting in ${delay}ms (${this.reconnectAttempts}. try).`);

        this.reconnectTimer = setTimeout((): void => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    private connectionUrl(): string {
        const {host, port, username, password, db}: ConfigValues["redis"] = this.configManager.get().redis;
        const auth: string = username || password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : "";
        return `redis://${auth}${host}:${port}/${db}`;
    }
}

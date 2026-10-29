import z from "zod";
import {Autowired, Bean} from "@core/bean/BeanDecorators.ts";
import {MainError} from "@core/error/ErrorReporter.ts";
import type {RedisClient} from "@core/redis/RedisClient.ts";
import {RedisKeys} from "@core/redis/RedisKeys.ts";

const appSchema = z.object({
    clientId: z.string(),
    botUserId: z.string().nullable().default(null),
    conduitId: z.string().nullable(),
    hasAuthorizationSubscriptions: z.boolean().default(false),
    createdAt: z.number(),
    updatedAt: z.number(),
});

export interface App {
    clientId: string;
    botUserId: string | null;
    conduitId: string | null;
    hasAuthorizationSubscriptions: boolean;
    createdAt: number;
    updatedAt: number;
}

type AppPatch = Partial<Pick<App, "botUserId" | "conduitId" | "hasAuthorizationSubscriptions">>;

const appTokenSchema = z.object({
    secretHash: z.string(),
    accessToken: z.string(),
    expiresAt: z.number(),
});

export type AppToken = z.infer<typeof appTokenSchema>;

@Bean()
export class AppStore {
    @Autowired()
    private redisClient!: RedisClient;

    private readonly conduitIds: Map<string, string | null> = new Map<string, string | null>();

    public async find(clientId: string): Promise<App | null> {
        return this.remember(clientId, await this.redisClient.get(RedisKeys.twitch.app(clientId), appSchema));
    }

    public async getConduitId(clientId: string, fresh: boolean = false): Promise<string | null> {
        const cached: string | null | undefined = this.conduitIds.get(clientId);
        if (cached !== undefined && !fresh) return cached;
        return (await this.find(clientId))?.conduitId ?? null;
    }

    public async findOrCreate(clientId: string): Promise<App> {
        const existing: App | null = await this.find(clientId);
        if (existing) return existing;

        const now: number = Date.now();
        const app: App = {
            clientId,
            botUserId: null,
            conduitId: null,
            hasAuthorizationSubscriptions: false,
            createdAt: now,
            updatedAt: now,
        };

        const created: boolean = await this.redisClient.createIfNotExists(RedisKeys.twitch.app(clientId), app, RedisKeys.twitch.appsIndex(), clientId);
        if (created) {
            this.remember(clientId, app);
            return app;
        }

        const winner: App | null = await this.find(clientId);
        if (!winner) throw new MainError("APP_NOT_FOUND", `Application ${clientId} vanished right after it was created`);
        return winner;
    }

    public async update(clientId: string, patch: AppPatch): Promise<App | null> {
        return this.remember(clientId, await this.redisClient.updateJson(RedisKeys.twitch.app(clientId), appSchema, (app: App): App => ({
            ...app,
            ...patch,
            updatedAt: Date.now(),
        })));
    }

    private remember(clientId: string, app: App | null): App | null {
        if (app) this.conduitIds.set(clientId, app.conduitId);
        return app;
    }

    public async getClientIds(): Promise<string[]> {
        return await this.redisClient.getSetMembers(RedisKeys.twitch.appsIndex());
    }

    public async getToken(clientId: string): Promise<AppToken | null> {
        return await this.redisClient.get(RedisKeys.twitch.appToken(clientId), appTokenSchema);
    }

    public async saveToken(clientId: string, token: AppToken, expiresInSeconds: number): Promise<void> {
        await this.redisClient.set<AppToken>(RedisKeys.twitch.appToken(clientId), token, expiresInSeconds);
    }

    public async getAuthorizedUsers(clientId: string): Promise<string[]> {
        return await this.redisClient.getSetMembers(RedisKeys.twitch.appUsers(clientId));
    }

    public async addAuthorizedUsers(clientId: string, ...userIds: string[]): Promise<void> {
        await this.redisClient.addToSet(RedisKeys.twitch.appUsers(clientId), ...userIds);
    }

    public async removeAuthorizedUser(clientId: string, userId: string): Promise<void> {
        await this.redisClient.removeFromSet(RedisKeys.twitch.appUsers(clientId), userId);
    }
}

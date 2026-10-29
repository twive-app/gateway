export const RedisKeys = {
    twitch: {
        appsIndex(): string {
            return "twitch:apps:index";
        },

        app(clientId: string): string {
            return `twitch:apps:${clientId}:app`;
        },

        appToken(clientId: string): string {
            return `twitch:apps:${clientId}:token`;
        },

        appUsers(clientId: string): string {
            return `twitch:apps:${clientId}:users`;
        },

        eventSubMessage(messageId: string): string {
            return `twitch:eventsub:messages:${messageId}`;
        },
    },
    gateway: {
        sessionsIndex(clientId: string): string {
            return `gateway:apps:${clientId}:sessions:index`;
        },

        session(clientId: string, sessionId: string): string {
            return `gateway:apps:${clientId}:sessions:${sessionId}:session`;
        },

        sessionSeq(clientId: string, sessionId: string): string {
            return `gateway:apps:${clientId}:sessions:${sessionId}:seq`;
        },

        sessionBuffer(clientId: string, sessionId: string): string {
            return `gateway:apps:${clientId}:sessions:${sessionId}:buffer`;
        },

        connection(clientId: string, connectionId: string): string {
            return `gateway:apps:${clientId}:connections:${connectionId}`;
        },

        pendingConnection(connectionId: string): string {
            return `gateway:pending:${connectionId}`;
        },

        rateLimit(connectionId: string): string {
            return `gateway:ratelimit:${connectionId}`;
        },
    },
} as const;

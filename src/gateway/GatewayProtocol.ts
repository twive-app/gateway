import z from "zod";
import {EventSubSubscriptionType} from "twitch-dev-types";

export enum GatewayOpCode {
    Hello = 0,
    Identify = 1,
    Resume = 2,
    Dispatch = 3,
    Heartbeat = 4,
    HeartbeatAck = 5,
    Reconnect = 6,
    InvalidSession = 7,
}

export enum GatewayCloseCode {
    UnknownError = 4000,
    UnknownOpCode = 4001,
    DecodeError = 4002,
    NotAuthenticated = 4003,
    AuthenticationFailed = 4004,
    AlreadyAuthenticated = 4005,
    InvalidSequence = 4006,
    RateLimited = 4007,
    HeartbeatTimeout = 4008,
    InvalidApiVersion = 4009,
    InvalidEvents = 4010,
    SessionReplaced = 4011,
}

export enum GatewayDispatchEvent {
    Ready = "READY",
    Resumed = "RESUMED",
    SubscriptionRevoked = "SUBSCRIPTION_REVOKED",
}

export interface GatewayPayload<D = unknown> {
    op: GatewayOpCode;
    d: D | null;
    s: number | null;
    t: string | null;
}

export interface GatewayHelloData {
    heartbeatInterval: number;
}

export interface GatewayInvalidSessionData {
    resumable: boolean;
    message: string;
}

export interface GatewayReadyData {
    v: number;
    sessionId: string;
    application: {
        clientId: string;
        botUserId: string | null;
        conduitId: string | null;
        accessToken: string;
    };
    authorizedUserIds: string[];
    events: string[] | null;
}

export const gatewayBasePayloadSchema = z.object({
    op: z.number().int(),
    d: z.unknown().optional(),
});

const credentialsSchema = {
    clientId: z.string().min(1).max(64),
    clientSecret: z.string().min(1).max(128),
} satisfies z.ZodRawShape;

export const gatewayIdentifySchema = z.object({
    ...credentialsSchema,
    botUserId: z.string().regex(/^\d{1,20}$/).nullable().optional(),
    events: z.array(z.string().min(1).max(100)).max(250).optional(),
});

export const gatewayResumeSchema = z.object({
    ...credentialsSchema,
    sessionId: z.uuid(),
    seq: z.number().int().min(0),
});

export const gatewayHeartbeatSchema = z.number().int().min(0).nullable().optional();

export type GatewayBasePayload = z.infer<typeof gatewayBasePayloadSchema>;
export type GatewayHeartbeatData = z.infer<typeof gatewayHeartbeatSchema>;
export type GatewayIdentifyData = z.infer<typeof gatewayIdentifySchema>;
export type GatewayResumeData = z.infer<typeof gatewayResumeSchema>;

function toDispatchEventName(subscriptionType: string): string {
    return subscriptionType.toUpperCase().replaceAll(".", "_");
}

function createPayload<D>(op: GatewayOpCode, d: D | null = null, t: string | null = null, s: number | null = null): GatewayPayload<D> {
    return {op, d, s, t};
}

export const GatewayProtocol = {
    version: 1,
    sessionInvalidatingCloseCodes: new Set<number>([
        1000,
        1001,
        GatewayCloseCode.AuthenticationFailed,
        GatewayCloseCode.InvalidSequence,
        GatewayCloseCode.InvalidApiVersion,
        GatewayCloseCode.InvalidEvents,
    ]),
    lifecycleEvents: new Set<string>([
        GatewayDispatchEvent.Ready,
        GatewayDispatchEvent.Resumed,
    ]),
    dispatchEventNames: new Set<string>([
        ...Object.values(EventSubSubscriptionType).map(toDispatchEventName),
        GatewayDispatchEvent.SubscriptionRevoked,
    ]),
    toDispatchEventName,
    createPayload,
} as const;

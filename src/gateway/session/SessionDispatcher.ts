import {Autowired, Bean} from "@core/bean/BeanDecorators.ts";
import type {ErrorReporter} from "@core/error/ErrorReporter.ts";
import type {Logger} from "@core/logging/Logger.ts";
import {GatewayOpCode, GatewayProtocol, type GatewayPayload} from "@gateway/GatewayProtocol.ts";
import type {ConnectionRegistry, LocalConnection} from "@gateway/connection/ConnectionRegistry.ts";
import type {DispatchTarget, SessionStore} from "@gateway/session/SessionStore.ts";

@Bean()
export class SessionDispatcher {
    @Autowired()
    private logger!: Logger;

    @Autowired()
    private errorReporter!: ErrorReporter;

    @Autowired()
    private sessionStore!: SessionStore;

    @Autowired()
    private connectionRegistry!: ConnectionRegistry;

    public dispatch(appClientId: string, eventName: string, data: unknown): void {
        this.sessionStore.dispatch(appClientId, eventName, data).then((targets: DispatchTarget[]): void => {
            let live: number = 0;
            for (const target of targets) {
                const connection: LocalConnection | undefined = this.connectionRegistry.get(target.connectionId);
                if (!connection) continue;

                this.deliver(connection, appClientId, target.sessionId, GatewayProtocol.createPayload(GatewayOpCode.Dispatch, data, eventName, target.sequence));
                live++;
            }

            if (targets.length > 0) {
                this.logger.debug("DISPATCH", `Dispatched ${eventName} to ${targets.length} session(s) of app ${appClientId} (${live} live)`);
            }
        }).catch((error: unknown): void => {
            this.errorReporter.handleThrottled("DISPATCH", `Could not dispatch ${eventName} to app ${appClientId}`, error);
        });
    }

    private deliver(connection: LocalConnection, clientId: string, sessionId: string, payload: GatewayPayload): void {
        const sequence: number | null = payload.s;
        if (sequence === null) {
            if (connection.sessionId === sessionId) this.connectionRegistry.send(connection, payload);
            return;
        }

        connection.delivery = connection.delivery.then(async (): Promise<void> => {
            if (connection.sessionId !== sessionId || sequence <= connection.sequence) return;

            if (sequence > connection.sequence + 1) {
                const missed: GatewayPayload[] = await this.sessionStore.getBuffered(clientId, sessionId, connection.sequence, sequence);
                if (connection.sessionId !== sessionId) return;
                for (const buffered of missed) this.sendSequenced(connection, buffered);
            }

            this.sendSequenced(connection, payload);
        }).catch((error: unknown): void => {
            this.errorReporter.handleThrottled("DISPATCH", `Could not deliver an event to connection ${connection.connectionId}`, error);
        });
    }

    private sendSequenced(connection: LocalConnection, payload: GatewayPayload): void {
        const sequence: number = payload.s ?? 0;
        if (sequence > connection.sequence && this.connectionRegistry.send(connection, payload)) connection.sequence = sequence;
    }
}

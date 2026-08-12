import type {FastifyInstance, FastifyRequest, FastifyReply} from "fastify";
import {CronJob} from "cron";

interface PostConstructorDefinition {
    classToken: string;
    methodName: string;
    handler: () => void|Promise<void>;
}

type RouteHttpMethod = "get" | "post" | "put" | "delete" | "patch";

interface RouteDefinition {
    classToken: string;
    methodName: string;
    httpMethod: RouteHttpMethod;
    path: string;
    handler: (req: FastifyRequest, reply: FastifyReply) => any;
}

interface CronDefinition {
    classToken: string;
    methodName: string;
    cronTime: string;
    handler: () => void | Promise<void>;
}

interface ShutdownHookDefinition {
    classToken: string;
    methodName: string;
    handler: () => void | Promise<void>;
}

export interface ShutdownHooks {
    name: string;
    hook: () => void | Promise<void>;
}

type BeansMap = Map<string, object>;
type PostConstructorsMap = Map<string, PostConstructorDefinition>;

class BeanException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BeanError";
    }
}

export class BeanManager {
    private static beansMap: BeansMap = new Map<string, object>();
    private static postConstructors: PostConstructorsMap = new Map<string, PostConstructorDefinition>();
    private static routes: RouteDefinition[] = [];
    private static crons: CronDefinition[] = [];
    private static shutdownHooks: ShutdownHookDefinition[] = [];

    public static registerBean(token: string, instance: object): void {
        this.beansMap.set(token.toUpperCase(), instance);
    }

    public static getBean<T>(token: string): T {
        const key: string = token.toUpperCase();
        const bean: object|undefined = this.beansMap.get(key);

        if (!bean) throw new BeanException(`Bean ${token} not found`);
        return bean as T;
    }

    public static addPostConstruct(def: PostConstructorDefinition): void {
        this.postConstructors.set(`${def.classToken}.${def.methodName}`, def);
    }

    public static afterStart(): void {
        for (const def of this.postConstructors.values()) {
            const instance: any = this.getBean<any>(def.classToken);
            const boundFn: () => (void|Promise<void>) = def.handler.bind(instance);
            boundFn();
        }

        this.registerCrons();
    }

    public static triggerGetters(key: string, instance: any): void {
        const prototype: any = Object.getPrototypeOf(instance);
        for (const prop of Object.getOwnPropertyNames(prototype)) {
            const descriptor: PropertyDescriptor|undefined = Object.getOwnPropertyDescriptor(prototype, prop);
            if (descriptor?.get) {
                try {
                    void instance[prop];
                } catch (error) {
                    throw new BeanException(`Error triggering getter ${key}.${prop}: ${(error as Error).message}`);
                }
            }
        }
    }

    public static addRoute(def: RouteDefinition): void {
        this.routes.push(def);
    }

    public static registerServerRoutes(server: FastifyInstance): void {
        for (const route of this.routes) {
            server[route.httpMethod](route.path, async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
                const instance: unknown = this.getBean(route.classToken);
                const boundHandler: (req: FastifyRequest, reply: FastifyReply) => any = route.handler.bind(instance);
                return await boundHandler(request, reply);
            });
        }
    }

    public static addCron(def: CronDefinition): void {
        this.crons.push(def);
    }

    private static registerCrons(): void {
        for (const cronDef of this.crons) {
            const instance: any = this.getBean<any>(cronDef.classToken);
            const boundFn: () => (void | Promise<void>) = cronDef.handler.bind(instance);

            try {
                new CronJob(
                    cronDef.cronTime,
                    async (): Promise<void> => {
                        try {
                            await boundFn();
                        } catch (error) {
                            throw new BeanException(`Error executing cron for ${cronDef.classToken}.${cronDef.methodName}: ${(error as Error).message}`);
                        }
                    },
                    null,
                    true,
                );
            } catch (error) {
                throw new BeanException(`Error registering cron for ${cronDef.classToken}.${cronDef.methodName}: ${(error as Error).message}`);
            }
        }
    }

    public static addShutdownHook(def: ShutdownHookDefinition): void {
        this.shutdownHooks.push(def);
    }

    public static getRegisteredShutdownHooks(): ShutdownHooks[] {
        return this.shutdownHooks.map((def: ShutdownHookDefinition): ShutdownHooks => {
            const instance: any = this.getBean<any>(def.classToken);

            return {
                name: `${def.classToken}.${def.methodName}`,
                hook: def.handler.bind(instance)
            };
        });
    }
}

type Bean = (target: any) => void;
export function Bean(token?: string): Bean {
    return function (target: any): void {
        const key: any = token || target.name;
        const instance = new target();
        BeanManager.registerBean(key, instance);
    };
}

type Autowired = (target: any, propertyKey: string) => void;
export function Autowired(token?: string): Autowired {
    return function (target: any, propertyKey: string): void {
        const key: string = token || propertyKey;

        Object.defineProperty(target.constructor.prototype, propertyKey, {
            get(): unknown {
                const bean: unknown = BeanManager.getBean(key);

                Object.defineProperty(this, propertyKey, {
                    value: bean,
                    writable: false,
                    enumerable: true,
                    configurable: false,
                });
                return bean;
            },
            configurable: true,
            enumerable: true,
        });
    };
}

type PostConstruct = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export function PostConstruct(): PostConstruct {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
        BeanManager.addPostConstruct({
            classToken: target.constructor.name.toUpperCase(),
            methodName: propertyKey,
            handler: descriptor.value,
        });
    };
}

type MainClass = (target: any) => void;
export function MainClass(token?: string): MainClass {
    return function (target: any): void {
        const key: string = token || target.name;
        const instance: any = new target();

        BeanManager.registerBean(key, instance);
        BeanManager.triggerGetters(key.toUpperCase(), instance);
        BeanManager.afterStart();
    };
}

type Route = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export function Route(method: RouteHttpMethod, path: string): Route {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
        const classToken: any = target.constructor.name.toUpperCase();

        BeanManager.addRoute({
            classToken,
            methodName: propertyKey,
            httpMethod: method,
            path,
            handler: descriptor.value,
        });
    };
}

type Cron = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export function Cron(cronTime: string): Cron {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
        const classToken: any = target.constructor.name.toUpperCase();

        BeanManager.addCron({
            classToken,
            methodName: propertyKey,
            cronTime: cronTime,
            handler: descriptor.value
        });
    };
}

type ShutdownHook = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export function ShutdownHook(): ShutdownHook {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
        const classToken: any = target.constructor.name.toUpperCase();

        BeanManager.addShutdownHook({
            classToken,
            methodName: propertyKey,
            handler: descriptor.value
        });
    };
}


export type GetBean = <T>(token: string) => T;
export const getBean: GetBean = BeanManager.getBean.bind(BeanManager);

export type AfterStart = () => void;
export const afterStart: AfterStart = BeanManager.afterStart.bind(BeanManager);

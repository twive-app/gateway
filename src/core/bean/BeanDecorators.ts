import type {ErrorReporter} from "@core/error/ErrorReporter.ts";
import {BeanManager, type LifecycleHandler, type RouteHandler, type RouteHttpMethod} from "@core/bean/BeanManager.ts";
import type {ProcessManager} from "@core/process/ProcessManager.ts";

type Constructor<T = object> = new (...args: never[]) => T;

type ClassDecoratorFn = (target: Constructor) => void;
type MethodDecoratorFn = (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void;
type PropertyDecoratorFn = (target: object, propertyKey: string) => void;

function classTokenOf(target: object): string {
    return target.constructor.name.toUpperCase();
}

export function Bean(token?: string): ClassDecoratorFn {
    return function (target: Constructor): void {
        const key: string = token ?? target.name;
        BeanManager.registerBean(key, new target());
    };
}

export function Autowired(token?: string): PropertyDecoratorFn {
    return function (target: object, propertyKey: string): void {
        const key: string = token ?? propertyKey;

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

export function PostConstruct(): MethodDecoratorFn {
    return function (target: object, propertyKey: string, descriptor: PropertyDescriptor): void {
        BeanManager.addPostConstruct({
            classToken: classTokenOf(target),
            methodName: propertyKey,
            handler: descriptor.value as LifecycleHandler,
        });
    };
}

export function MainClass(token?: string): ClassDecoratorFn {
    return function (target: Constructor): void {
        const key: string = token ?? target.name;
        const instance: object = new target();

        BeanManager.registerBean(key, instance);
        BeanManager.triggerGetters(key.toUpperCase(), instance);

        BeanManager.getBean<ProcessManager>("ProcessManager").install();
        BeanManager.afterStart().then((): void => {
            (instance as {onStarted?: () => void}).onStarted?.();
        }).catch((error: unknown): void => {
            const errorReporter: ErrorReporter = BeanManager.getBean<ErrorReporter>("ErrorReporter");
            errorReporter.log(errorReporter.normalize(error), {phase: "startup"});
            process.exit(1);
        });
    };
}

export function Route(method: RouteHttpMethod, path: string): MethodDecoratorFn {
    return function (target: object, propertyKey: string, descriptor: PropertyDescriptor): void {
        BeanManager.addRoute({
            classToken: classTokenOf(target),
            methodName: propertyKey,
            httpMethod: method,
            path,
            handler: descriptor.value as RouteHandler,
        });
    };
}

export function Cron(cronTime: string): MethodDecoratorFn {
    return function (target: object, propertyKey: string, descriptor: PropertyDescriptor): void {
        BeanManager.addCron({
            classToken: classTokenOf(target),
            methodName: propertyKey,
            cronTime: cronTime,
            handler: descriptor.value as LifecycleHandler,
        });
    };
}

export function ShutdownHook(order: number = 50): MethodDecoratorFn {
    return function (target: object, propertyKey: string, descriptor: PropertyDescriptor): void {
        BeanManager.addShutdownHook({
            classToken: classTokenOf(target),
            methodName: propertyKey,
            order,
            handler: descriptor.value as LifecycleHandler,
        });
    };
}

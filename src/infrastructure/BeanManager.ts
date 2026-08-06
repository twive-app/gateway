type PostConstructorDefinition = {
    classToken: string;
    methodName: string;
    handler: () => void|Promise<void>;
};

type BeansMap =  Map<string, object>;
type PostConstructorsMap = Map<string, PostConstructorDefinition>;

class BeanException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BeanError";
    }
}

class BeanManager {
    private static beansMap: BeansMap = new Map<string, object>();
    private static postConstructors: PostConstructorsMap = new Map<string, PostConstructorDefinition>();

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

export type GetBean = <T>(token: string) => T;
export const getBean: GetBean = BeanManager.getBean.bind(BeanManager);

export type AfterStart = () => void;
export const afterStart: AfterStart = BeanManager.afterStart.bind(BeanManager);

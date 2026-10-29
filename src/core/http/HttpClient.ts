import type {ZodType} from "zod";
import {Bean} from "@core/bean/BeanDecorators.ts";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export class HttpError extends Error {
    public constructor(
        public readonly status: number,
        public readonly method: HttpMethod,
        public readonly url: string,
        public readonly body: unknown,
    ) {
        super(`${method} ${url} failed with status ${status}`);
        this.name = "HttpError";
    }

    public static statusOf(error: unknown): number | null {
        return error instanceof HttpError ? error.status : null;
    }
}

type Headers = Record<string, string>;

const requestTimeoutMs: number = 10000;

function buildUrl(endpoint: string, params?: object): string {
    if (!params) return endpoint;

    const url: URL = new URL(endpoint);
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        const values: unknown[] = Array.isArray(value) ? value : [value];
        for (const item of values) {
            if (item !== undefined && item !== null) url.searchParams.append(key, String(item));
        }
    }
    return url.toString();
}

@Bean()
export class HttpClient {
    public async post<T>(url: string, data: object, headers?: Headers, schema?: ZodType<T>): Promise<T> {
        return await this.request("POST", url, data, headers, schema);
    }

    public async get<T>(url: string, params?: object, headers?: Headers, schema?: ZodType<T>): Promise<T> {
        return await this.request("GET", buildUrl(url, params), undefined, headers, schema);
    }

    public async delete<T>(url: string, params?: object, headers?: Headers, schema?: ZodType<T>): Promise<T> {
        return await this.request("DELETE", buildUrl(url, params), undefined, headers, schema);
    }

    public async patch<T>(url: string, data: object, headers?: Headers, schema?: ZodType<T>): Promise<T> {
        return await this.request("PATCH", url, data, headers, schema);
    }

    private async request<T>(method: HttpMethod, url: string, data?: object, headers?: Headers, schema?: ZodType<T>): Promise<T> {
        const response: Response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            body: data === undefined ? undefined : JSON.stringify(data),
            signal: AbortSignal.timeout(requestTimeoutMs),
        });

        const body: unknown = this.parseBody(await response.text());
        if (!response.ok) throw new HttpError(response.status, method, url, body);

        if (schema) return schema.parse(body);
        return body as T;
    }

    private parseBody(text: string): unknown {
        if (text.length === 0) return undefined;

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }
}

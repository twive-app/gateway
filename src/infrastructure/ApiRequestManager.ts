import axios, {type AxiosInstance, type AxiosRequestConfig, type AxiosResponse} from "axios";
import type {ZodType} from "zod";

export class ApiRequestException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ApiRequestError";
    }
}

export class ApiRequestManager {
    private client: AxiosInstance;

    public constructor(defaultConfig: AxiosRequestConfig = {}) {
        this.client = axios.create({
            headers: {
                "Content-Type": "application/json",
                ...defaultConfig.headers,
            },
            ...defaultConfig,
        });
    }

    public async post<T>(url: string, data: unknown, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.post(url, data);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            throw new ApiRequestException(`POST request to ${url} failed: ${(error as Error).message}`);
        }
    }

    public async get<T>(url: string, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.get(url);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            throw new ApiRequestException(`GET request to ${url} failed: ${(error as Error).message}`);
        }
    }

    public async put<T>(url: string, data: unknown, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.put(url, data);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            throw new ApiRequestException(`PUT request to ${url} failed: ${(error as Error).message}`);
        }
    }

    public async delete<T>(url: string, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.delete(url);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            throw new ApiRequestException(`DELETE request to ${url} failed: ${(error as Error).message}`);
        }
    }

    public async patch<T>(url: string, data: unknown, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.patch(url, data);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            throw new ApiRequestException(`PATCH request to ${url} failed: ${(error as Error).message}`);
        }
    }
}

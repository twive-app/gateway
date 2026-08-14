import axios, {type AxiosInstance, type AxiosRequestConfig, type AxiosResponse} from "axios";
import type {ZodType} from "zod";

export class ApiRequestException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ApiRequestError";
    }
}

export abstract class ApiRequestClient {
    protected client!: AxiosInstance;
    protected baseURL!: string;

    protected constructor(baseURL: string, defaultConfig: AxiosRequestConfig = {}) {
        this.baseURL = baseURL;
        this.client = axios.create({
            baseURL,
            headers: {
                "Content-Type": "application/json",
                ...defaultConfig.headers,
            },
            ...defaultConfig,
        });
    }

    public async post<T>(endpoint: string, data: unknown, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.post(endpoint, data);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(
                `POST request to ${this.baseURL}${endpoint} failed with status ${error.status}: ${error}`,
            );

            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public async get<T>(endpoint: string, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.get(endpoint);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(
                `GET request to ${this.baseURL}${endpoint} failed with status ${error.status}: ${error}`,
            );

            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public async put<T>(endpoint: string, data: unknown, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.put(endpoint, data);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(
                `PUT request to ${this.baseURL}${endpoint} failed with status ${error.status}: ${error}`,
            );

            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public async delete<T>(endpoint: string, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.delete(endpoint);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(
                `DELETE request to ${this.baseURL}${endpoint} failed with status ${error.status}: ${error}`,
            );

            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public async patch<T>(endpoint: string, data: unknown, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.patch(endpoint, data);
            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(
                `PATCH request to ${this.baseURL}${endpoint} failed with status ${error.status}: ${error}`,
            );

            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public setHeaders(headers: Record<string, any>): void {
        this.client.defaults.headers = {
            ...this.client.defaults.headers,
            ...headers,
        };
    }
}

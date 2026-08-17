import axios, {type AxiosInstance, type AxiosResponse} from "axios";
import type {ZodType} from "zod";
import type {APIEndpoint, OAuth2Endpoint} from "twitch-dev-types";
import {Bean, PostConstruct} from "@infra/BeanManager.ts";

type Endpoint = APIEndpoint|OAuth2Endpoint;

export class ApiRequestException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ApiRequestError";
    }
}

@Bean()
export class ApiRequestClient {
    private client!: AxiosInstance;

    @PostConstruct()
    public initialize(): void {
        this.client = axios.create({
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    public async post<T>(endpoint: Endpoint, data: Record<string, any>, headers?: Record<string, any>, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.post(endpoint, data, {
                headers: {
                    ...headers,
                },
            });

            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) throw new ApiRequestException(`POST request to ${endpoint} failed with status ${error.status}: ${error}`,);
            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public async get<T>(endpoint: Endpoint, params?: Record<string, any>, headers?: Record<string, any>, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.get(endpoint, {
                params: params,
                headers: {
                    ...headers,
                },
            });

            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(`GET request to ${endpoint} failed with status ${error.status}: ${error}`,);
            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public async put<T>(endpoint: Endpoint, data: Record<string, any>, headers?: Record<string, any>, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.put(endpoint, data, {
                headers: {
                    ...headers,
                },
            });

            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(`PUT request to ${endpoint} failed with status ${error.status}: ${error}`,);
            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public async delete<T>(endpoint: Endpoint, params?: Record<string, any>, headers?: Record<string, any>, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.delete(endpoint, {
                params: params,
                headers: {
                    ...headers,
                },
            });

            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(`DELETE request to ${endpoint} failed with status ${error.status}: ${error}`,);
            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }

    public async patch<T>(endpoint: Endpoint, data: Record<string, any>, headers?: Record<string, any>, schema?: ZodType<T>): Promise<T> {
        try {
            const response: AxiosResponse = await this.client.patch(endpoint, data, {
                headers: {
                    ...headers,
                },
            });

            if (schema) return schema.parse(response.data);
            return response.data as T;
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ApiRequestException(`PATCH request to ${endpoint} failed with status ${error.status}: ${error}`,);
            throw new ApiRequestException(`Unexpected error: ${(error as Error).message}`);
        }
    }
}

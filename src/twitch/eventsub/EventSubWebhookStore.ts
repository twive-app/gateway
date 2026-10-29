import {Autowired, Bean} from "@core/bean/BeanDecorators.ts";
import type {RedisClient} from "@core/redis/RedisClient.ts";
import {RedisKeys} from "@core/redis/RedisKeys.ts";

@Bean()
export class EventSubWebhookStore {
    @Autowired()
    private redisClient!: RedisClient;

    public async markFirstDelivery(messageId: string, ttlSeconds: number): Promise<boolean> {
        return await this.redisClient.setIfNotExists(RedisKeys.twitch.eventSubMessage(messageId), 1, ttlSeconds);
    }
}

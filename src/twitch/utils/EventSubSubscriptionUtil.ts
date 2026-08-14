import {Bean} from "@infra/BeanManager.ts";
import {
    AccessTokenScopes,
    EventSubSubscriptionRequestBody,
    EventSubSubscriptionType,
    EventSubTransportMethod,
    UserUpdateCondition,
    WhisperReceivedCondition
} from "twitch-dev-types";

@Bean()
export class EventSubSubscriptionUtil {
    public getScopeBasedSubscriptions(scopes: AccessTokenScopes[], userId: string, conduitId: string, currentSubs?: EventSubSubscriptionRequestBody[]): EventSubSubscriptionRequestBody[] {
        const subs: EventSubSubscriptionRequestBody[] = [...(currentSubs || [])];

        subs.push({
            type: EventSubSubscriptionType.StreamOnline,
            version: "1",
            condition: {
                broadcaster_user_id: userId,
            },
            transport: {
                method: EventSubTransportMethod.Conduit,
                conduit_id: conduitId,
            },
        }, {
            type: EventSubSubscriptionType.StreamOffline,
            version: "1",
            condition: {
                broadcaster_user_id: userId,
            },
            transport: {
                method: EventSubTransportMethod.Conduit,
                conduit_id: conduitId,
            },
        });

        for (const scope of scopes) {
            switch (scope) {
                case AccessTokenScopes.BitsRead:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelBitsUse)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelBitsUse,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelCheer)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelCheer,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelCustomPowerUpsRedemptionAdd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelCustomPowerUpsRedemptionAdd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelBot:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatClear)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatClear,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatClearUserMessages)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatClearUserMessages,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatMessage)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatMessage,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatMessageDelete)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatMessageDelete,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatNotification)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatNotification,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatSettingsUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatSettingsUpdate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadAds:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelAdBreakBegin)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelAdBreakBegin,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadCharity:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelCharityCampaignDonate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelCharityCampaignDonate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelCharityCampaignStart)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelCharityCampaignStart,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelCharityCampaignProgress)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelCharityCampaignProgress,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelCharityCampaignStop)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelCharityCampaignStop,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadGoals:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelGoalBegin)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelGoalBegin,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelGoalProgress)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelGoalProgress,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelGoalEnd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelGoalEnd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadGuestStar:
                case AccessTokenScopes.ChannelManageGuestStar:
                case AccessTokenScopes.ModeratorReadGuestStar:
                case AccessTokenScopes.ModeratorManageGuestStar:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelGuestStarSessionBegin)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelGuestStarSessionBegin,
                            version: "beta",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelGuestStarSessionEnd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelGuestStarSessionEnd,
                            version: "beta",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelGuestStarGuestUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelGuestStarGuestUpdate,
                            version: "beta",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelGuestStartSettingsUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelGuestStartSettingsUpdate,
                            version: "beta",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadHypeTrain:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.HypeTrainBegin)) {
                        subs.push({
                            type: EventSubSubscriptionType.HypeTrainBegin,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.HypeTrainProgress)) {
                        subs.push({
                            type: EventSubSubscriptionType.HypeTrainProgress,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.HypeTrainEnd)) {
                        subs.push({
                            type: EventSubSubscriptionType.HypeTrainEnd,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadPolls:
                case AccessTokenScopes.ChannelManagePolls:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPollBegin)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPollBegin,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPollProgress)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPollProgress,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPollEnd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPollEnd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadPredictions:
                case AccessTokenScopes.ChannelManagePredictions:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPredictionBegin)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPredictionBegin,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPredictionProgress)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPredictionProgress,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPredictionLook)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPredictionLook,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPredictionEnd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPredictionEnd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadRedemptions:
                case AccessTokenScopes.ChannelManageRedemptions:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPointsAutomaticRewardRedemptionAdd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPointsAutomaticRewardRedemptionAdd,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPointsCustomRewardAdd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPointsCustomRewardAdd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPointsCustomRewardUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPointsCustomRewardUpdate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPointsCustomRewardRemove)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPointsCustomRewardRemove,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPointsCustomRewardRedemptionAdd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPointsCustomRewardRedemptionAdd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelPointsCustomRewardRedemptionUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelPointsCustomRewardRedemptionUpdate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadSubscriptions:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelSubscribe)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelSubscribe,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelSubscriptionEnd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelSubscriptionEnd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelSubscriptionGift)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelSubscriptionGift,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelSubscriptionMessage)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelSubscriptionMessage,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelReadVIPs:
                case AccessTokenScopes.ChannelManageVIPs:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelVIPAdd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelVIPAdd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelVIPRemove)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelVIPRemove,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ChannelModerate:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelBan)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelBan,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelUnban)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelUnban,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModerationRead:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelModeratorAdd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelModeratorAdd,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelModeratorRemove)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelModeratorRemove,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorManageAutomod:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.AutomodMessageHold)) {
                        subs.push({
                            type: EventSubSubscriptionType.AutomodMessageHold,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.AutomodMessageUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.AutomodMessageUpdate,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.AutomodTermsUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.AutomodTermsUpdate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorReadAutomodSettings:
                case AccessTokenScopes.ModeratorManageAutomodSettings:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.AutomodSettingsUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.AutomodSettingsUpdate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorReadBlockedTerms:
                case AccessTokenScopes.ModeratorManageBlockedTerms:
                case AccessTokenScopes.ModeratorReadChatSettings:
                case AccessTokenScopes.ModeratorManageChatSettings:
                case AccessTokenScopes.ModeratorReadBannedUsers:
                case AccessTokenScopes.ModeratorManageBannedUsers:
                case AccessTokenScopes.ModeratorReadChatMessages:
                case AccessTokenScopes.ModeratorManageChatMessages:
                case AccessTokenScopes.ModeratorReadModerators:
                case AccessTokenScopes.ModeratorReadVIPs:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelModerate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelModerate,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorReadFollowers:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelFollow)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelFollow,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorReadShieldMode:
                case AccessTokenScopes.ModeratorManageShieldMode:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelShieldModeBegin)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelShieldModeBegin,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelShieldModeEnd)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelShieldModeEnd,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorReadShoutouts:
                case AccessTokenScopes.ModeratorManageShoutouts:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelShoutoutCreate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelShoutoutCreate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelShoutoutReceive)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelShoutoutReceive,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorReadSuspiciousUsers:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelSuspiciousUserMessage)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelSuspiciousUserMessage,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelSuspiciousUserUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelSuspiciousUserUpdate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorReadUnbanRequests:
                case AccessTokenScopes.ModeratorManageUnbanRequests:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelUnbanRequestCreate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelUnbanRequestCreate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelUnbanRequestResolve)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelUnbanRequestResolve,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelModerate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelModerate,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.ModeratorReadWarnings:
                case AccessTokenScopes.ModeratorManageWarnings:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelModerate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelModerate,
                            version: "2",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelWarningAcknowledge)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelWarningAcknowledge,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelWarningSend)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelWarningSend,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                moderator_user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.UserReadChat:
                case AccessTokenScopes.UserBot:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatClear)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatClear,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatClearUserMessages)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatClearUserMessages,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatMessage)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatMessage,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatMessageDelete)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatMessageDelete,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatNotification)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatNotification,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatSettingsUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatSettingsUpdate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatUserMessageHold)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatUserMessageHold,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }

                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.ChannelChatUserMessageUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.ChannelChatUserMessageUpdate,
                            version: "1",
                            condition: {
                                broadcaster_user_id: userId,
                                user_id: userId,
                            },
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.UserReadEmail:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.UserUpdate)) {
                        subs.push({
                            type: EventSubSubscriptionType.UserUpdate,
                            version: "1",
                            condition: {
                                user_id: userId,
                            } as UserUpdateCondition,
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;

                case AccessTokenScopes.UserReadWhispers:
                case AccessTokenScopes.UserManageWhispers:
                    if (!subs.some((sub: EventSubSubscriptionRequestBody): boolean => sub.type === EventSubSubscriptionType.WhisperMessage)) {
                        subs.push({
                            type: EventSubSubscriptionType.WhisperMessage,
                            version: "1",
                            condition: {
                                user_id: userId,
                            } as WhisperReceivedCondition,
                            transport: {
                                method: EventSubTransportMethod.Conduit,
                                conduit_id: conduitId,
                            },
                        });
                    }
                    break;
            }
        }

        return subs;
    }

    public getAppSubscriptions(applicationId: string, conduitId: string): EventSubSubscriptionRequestBody[] {
        return [{
            type: EventSubSubscriptionType.UserAuthorizationGrant,
            version: "1",
            condition: {
                client_id: applicationId,
            },
            transport: {
                method: EventSubTransportMethod.Conduit,
                conduit_id: conduitId,
            },
        }, {
            type: EventSubSubscriptionType.UserAuthorizationRevoke,
            version: "1",
            condition: {
                client_id: applicationId,
            },
            transport: {
                method: EventSubTransportMethod.Conduit,
                conduit_id: conduitId,
            },
        }];
    }
}

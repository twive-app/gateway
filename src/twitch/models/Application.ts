import {DataTypes, Optional, Sequelize} from "sequelize";
import {
    DatabaseModel,
    type DefaultAttributes,
    type DefaultOptionalAttributes,
    initAttributes
} from "@infra/DatabaseManager.ts";
import {InitModel} from "@infra/BeanManager.ts";

export interface ApplicationAttributes extends DefaultAttributes {
    clientId: string;
    clientUserId: string;
    accessToken: string;
    conduitId?: string;
    subscribed?: boolean;
}

export type ApplicationOptionalAttributes = DefaultOptionalAttributes;

export type ApplicationCreationAttributes = Optional<ApplicationAttributes, ApplicationOptionalAttributes>;

@InitModel()
export class Application extends DatabaseModel<ApplicationAttributes, ApplicationCreationAttributes> implements ApplicationAttributes {
    declare clientId: string;
    declare clientUserId: string;
    declare accessToken: string;
    declare conduitId: string;
    declare subscribed: boolean;

    public static initModel(sequelize: Sequelize): void {
        Application.init(
            initAttributes({
                clientId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                clientUserId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                accessToken: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                conduitId: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                subscribed: {
                    type: DataTypes.BOOLEAN,
                    allowNull: true,
                    defaultValue: false
                }
            }), {
                sequelize,
                tableName: "application",
            },
        );
    }
}

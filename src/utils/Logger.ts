import chalk from "chalk";
import figlet from "figlet";
import {DateFormatter} from "@utils/DateFormatter";
import {configManager} from "../index";

export class Logger {
    private static _instance: Logger;

    public static getInstance(): Logger {
        if (!Logger._instance) {
            Logger._instance = new Logger();
        }
        return Logger._instance;
    }

    public header(): void {
        const name = "backend";

        console.log("\n\n", chalk.hex("#3b26f6").bold(figlet.textSync(name, {
            font: "Slant",
            horizontalLayout: "fitted",
            width: 400,
        })), "\n\n");
    }

    private logToConsole(level: keyof typeof LogLevel, thematic: keyof typeof LogThematic, message: string, context: Record<string, unknown>): void {
        const logLevelColor: LogLevel = LogLevel[level];
        const logThematicColor: LogThematic = LogThematic[thematic];
        const timestamp: string = new DateFormatter(new Date(), {
            schema: "dd-MM-yyyy HH:mm:ss",
        }).format();

        console.log(`${timestamp} [${chalk.hex(logLevelColor)(level)}] [${chalk.hex(logThematicColor)(thematic)}] | ${message}`);
        if (Object.keys(context).length > 0) {
            console.log(chalk.hex("#ffffff")("Context: "), context);
        }
    }

    public info(thematic: keyof typeof LogThematic, message: string, context: Record<string, unknown> = {}): void {
        this.logToConsole("INFO", thematic, message, context);
    }

    public warning(thematic: keyof typeof LogThematic, message: string, context: Record<string, unknown> = {}): void {
        this.logToConsole("WARNING", thematic, message, context);
    }

    public error(thematic: keyof typeof LogThematic, message: string, context: Record<string, unknown> = {}): void {
        this.logToConsole("ERROR", thematic, message, context);
    }

    public success(thematic: keyof typeof LogThematic, message: string, context: Record<string, unknown> = {}): void {
        this.logToConsole("SUCCESS", thematic, message, context);
    }

    public debug(thematic: keyof typeof LogThematic, message: string, context: Record<string, unknown> = {}): void {
        if (configManager.getConfig().logging.debug) {
            this.logToConsole("DEBUG", thematic, message, context);
        }
    }
}

export enum LogLevel {
    INFO = "#3ae1ff",
    WARNING = "#fcb83a",
    ERROR = "#fc3a4a",
    SUCCESS = "#3afc77",
    DEBUG = "#d24cff",
}

export enum LogThematic {
    SYSTEM = "#3b26f6",
    DATABASE = "#ff5da6",
    REDIS = "#e74c3c",
    API = "#4fffdf",
}

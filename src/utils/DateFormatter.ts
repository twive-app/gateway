type DateSchema = "dd-MM-yyyy HH:mm:ss" | "ISO" | "timestamp" | string;

interface DateFormatterOptions {
    schema?: DateSchema;
    timezone?: string;
}

export class DateFormatter {
    private readonly defaultOptions: DateFormatterOptions = {
        schema: "dd-MM-yyyy HH:mm:ss",
        timezone: "UTC",
    };
    private readonly options: DateFormatterOptions;
    private readonly date: Date;

    constructor(date: Date, options: DateFormatterOptions = {}) {
        options = Object.assign({}, this.defaultOptions, options); // assign default options if no options provided
        this.options = options;
        this.date = date;
    }

    format(): string {
        const targetDate: Date = this.convertToTimezone(this.date, (this.options.timezone as string));

        switch (this.options.schema) {
            case "ISO":
                return targetDate.toISOString();
            case "timestamp":
                return targetDate.getTime().toString();
            default:
                return this.formatBySchema(targetDate, (this.options.schema as string));
        }
    }

    private formatBySchema(date: Date, schema: string): string {
        const pad: (n: number) => string = (n: number): string => n.toString().padStart(2, "0");

        // define tokens for the schema
        const tokens: Record<string, string> = {
            "yyyy": date.getFullYear().toString(),
            "MM": pad(date.getMonth() + 1),
            "dd": pad(date.getDate()),
            "HH": pad(date.getHours()),
            "mm": pad(date.getMinutes()),
            "ss": pad(date.getSeconds()),
            "SSS": date.getMilliseconds().toString().padStart(3, "0"),
        };

        let result: string = schema;
        // replace all occurrences of the token with its corresponding value
        Object.entries(tokens).forEach(([token, value]: [string, string]): void => {
            result = result.replace(new RegExp(token, "g"), value);
        });
        return result;
    }

    private convertToTimezone(date: Date, timezone: string): Date {
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });

        const parts: Intl.DateTimeFormatPart[] = formatter.formatToParts(date);
        const values: Record<string, number> = {};

        // extract the values from the parts array and store them in the values object
        parts.forEach(({type, value}: Intl.DateTimeFormatPart): void => {
            values[type] = parseInt(value, 10);
        });

        return new Date(
            values.year,
            values.month - 1,
            values.day,
            values.hour,
            values.minute,
            values.second,
        );
    }
}

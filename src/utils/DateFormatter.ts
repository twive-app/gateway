type DateSchema = "dd-MM-yyyy HH:mm:ss" | "ISO" | "timestamp" | string;

interface DateFormatterOptions {
    schema?: DateSchema;
    timezone?: string;
}

const defaultOptions: DateFormatterOptions = {
    schema: "dd-MM-yyyy HH:mm:ss",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
};

export function formatDate(date: Date, options?: DateFormatterOptions): string {
    options = Object.assign({}, defaultOptions, options);

    const targetDate: Date = convertToTimezone(date, (options.timezone as string));
    switch (options.schema) {
        case "ISO":
            return targetDate.toISOString();
        case "timestamp":
            return targetDate.getTime().toString();
        default:
            return formatBySchema(targetDate, (options.schema as string));
    }
}

function formatBySchema(date: Date, schema: string): string {
    const pad: (n: number) => string = (n: number): string => n.toString().padStart(2, "0");

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
    Object.entries(tokens).forEach(([token, value]: [string, string]): void => {
        result = result.replace(new RegExp(token, "g"), value);
    });
    return result;
}

function convertToTimezone(date: Date, timezone: string): Date {
    const formatter = new Intl.DateTimeFormat("de-DE", {
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
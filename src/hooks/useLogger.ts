// src/hooks/useLogger.ts
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import { tryCatchSync } from "../utils/tryCatch";

export interface LogEntry {
    type: string;
    message: unknown; // Keep as unknown to allow flexibility, stringified for storage
    timestamp: Date;
}
export interface Logger {
    debug(...data: unknown[]): void;
    error(...data: unknown[]): void;
    info(...data: unknown[]): void;
    log(...data: unknown[]): void;
    trace(...data: unknown[]): void;
    warn(...data: unknown[]): void;
}

export interface UseLoggerReturn {
    logs: LogEntry[];
    logger: Logger;
}

const safeStringify = (data: unknown): string => {
    if (typeof data === "string") {
        return data;
    }
    if (data === null || data === undefined) {
        return String(data);
    }
    // For objects and arrays, attempt to JSON.stringify
    if (typeof data === "object" || Array.isArray(data)) {
        const [parsed, error] = tryCatchSync<string>(() => JSON.stringify(data));
        // If JSON.stringify fails (e.g., circular object), fallback to String(data)
        return error ? String(data) : parsed;
    }
    // For other primitives (numbers, booleans, symbols, functions)
    return String(data);
};


type LogType = "debug" | "info" | "warn" | "error" | "log" | "trace";

const logLevelsMap: Record<LogType, number> = {
    trace: 0,
    debug: 1,
    log: 2,
    info: 2,
    warn: 3,
    error: 4,
};


type LogLevels = keyof typeof logLevelsMap;

export default function useLogger(logLevelInput?: string): UseLoggerReturn {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const pendingRef = useRef<LogEntry[]>([]);

    const logLevel = useMemo(() => {
        const level = logLevelInput?.toLowerCase();
        if (level && Object.keys(logLevelsMap).includes(level)) {
            return level as LogLevels;
        }
        return 'info'; // Default log level
    }, [logLevelInput]);

    const addLog = useCallback((type: LogType, ...data: unknown[]) => {
            if (logLevelsMap[type] < logLevelsMap[logLevel]) {
                // Still log to console even if not stored in stateful logs
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (console as any)[type]?.(...data);
                return;
            }

            let messageString: string;
            if (data.length === 0) {
                messageString = ""; // Or handle as an error/warning
            } else if (data.length === 1) {
                messageString = safeStringify(data[0]);
            } else {
                // data[0] is the primary message, data.slice(1) are additional parts
                const primaryMessage = safeStringify(data[0]);
                const additionalDataString = safeStringify(data.slice(1)); // Stringify the array of additional args
                messageString = `${primaryMessage}  ${additionalDataString}`;
            }

            const entry: LogEntry = {
                type,
                message: messageString,
                timestamp: new Date(),
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (console as any)[type]?.(...data); // Log original data to console

            pendingRef.current.push(entry);
        },
        [logLevel]
    );

    useEffect(() => {
        if (pendingRef.current.length > 0) {
            setLogs(ls => [...ls, ...pendingRef.current]);
            pendingRef.current = [];
        }
    }); // Runs on every render

    const logger: Logger = useMemo(
        () => ({
            log: (...data) => addLog("log", ...data),
            trace: (...data) => addLog("trace", ...data),
            debug: (...data) => addLog("debug", ...data),
            info: (...data) => addLog("info", ...data),
            warn: (...data) => addLog("warn", ...data),
            error: (...data) => addLog("error", ...data),
        }),
        [addLog]
    );

    return {logs, logger};
}
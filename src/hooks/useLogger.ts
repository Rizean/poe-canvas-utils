// src/hooks/useLogger.ts
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {tryCatch} from "../utils/tryCatch.ts";

export interface LogEntry {
    type: string;
    message: unknown;
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

const safeStringify = (data: unknown) => {
    if (typeof data === "string") {
        return data;
    }
    if (typeof data === "object") {
        const [parsed, error] = tryCatch(() => JSON.stringify(data));
        return error ? String(data) : parsed;
    }
    return String(data);
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addLog = useCallback((type: LogType, ...data: any[]) => {
            if (logLevelsMap[type] < logLevelsMap[logLevel]) {
                return;
            }

            let message = data[0];
            if (data.length > 1) {
                message = `${message}  ${safeStringify(data.slice(1))}`;
            }
            const entry: LogEntry = {
                type,
                message,
                timestamp: new Date(),
            };
            // always console.log immediately
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (console as any)[type]?.(...data);

            // but only push into a ref, not state
            pendingRef.current.push(entry);
        },
        [logLevel]
    );

    // once per tick (or whenever), flush pending logs into React state
    useEffect(() => {
        if (pendingRef.current.length) {
            setLogs(ls => [...ls, ...pendingRef.current]);
            pendingRef.current = [];
        }
    }); // Runs on every render, which is fine for flushing logs

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
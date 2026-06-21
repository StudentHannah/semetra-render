import ical from "node-ical";
import type {
    CourseEventResult,
    CourseProgress,
    CourseProgressResult,
    LvType,
    ParsedEvent
} from "./types";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const CALENDAR_URL = "http://stundenplan.fh-ooe.at/ics/d9806c7f5b0746697b.ics";
const PORT = Number(process.env["PORT"] ?? 3000);

let cachedRelevantEvents: ParsedEvent[] = [];
let lastSyncAt: string | null = null;
let isSyncing = false;

type AttendanceStatus = "open" | "attended" | "missed";

const attendanceFilePath = path.join(process.cwd(), "data", "attendance.json");

function ensureAttendanceFile(): void {
    const dir = path.dirname(attendanceFilePath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(attendanceFilePath)) {
        fs.writeFileSync(attendanceFilePath, "{}", "utf8");
    }
}

function readAttendanceMap(): Record<string, AttendanceStatus> {
    ensureAttendanceFile();

    const raw = fs.readFileSync(attendanceFilePath, "utf8");
    if (!raw.trim()) return {};

    return JSON.parse(raw) as Record<string, AttendanceStatus>;
}

function writeAttendanceMap(data: Record<string, AttendanceStatus>): void {
    ensureAttendanceFile();
    fs.writeFileSync(attendanceFilePath, JSON.stringify(data, null, 2), "utf8");
}

function getEventId(event: ParsedEvent): string {
    return `${event.code}__${event.start.toISOString()}`;
}

function getTextValue(value: any): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && "val" in value) return String(value.val ?? "");
    return String(value);
}

function extractCourseName(description: string): { code: string; courseName: string } {
    const lines = description
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    return {
        code: lines[0] ?? "",
        courseName: lines[1] ?? ""
    };
}

function extractCourseShort(code: string): string {
    const parts = code.split("_");
    if (parts.length < 2) return "";

    const raw = parts[1];
    const match = raw!.match(/^([A-Z0-9]+?)(?=\d)/);

    // @ts-ignore
    return match ? match[1] : raw;
}

function extractLvType(code: string): LvType {
    const parts = code.split("_");
    if (parts.length < 2) return "";

    const raw = parts[1];

    if (raw && raw.includes("IL")) return "IL";
    if (raw && raw.includes("UE")) return "UE";
    if (raw && raw.includes("VO")) return "VO";

    return "";
}

function calculateEh(minutes: number): number {
    if (minutes <= 50) return 1;
    if (minutes <= 100) return 2;
    if (minutes <= 150) return 3;
    if (minutes <= 200) return 4;

    return Math.round(minutes / 45);
}

function getRelevantEvents(
    events: ParsedEvent[],
    rangeStart: Date,
    rangeEnd: Date
): ParsedEvent[] {
    return events
        .filter((event) => {
            const isRelevantType = event.lvType === "IL" || event.lvType === "UE";
            const isInRange = event.start >= rangeStart && event.start <= rangeEnd;

            return isRelevantType && isInRange;
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function removeDuplicateEvents(events: ParsedEvent[]): ParsedEvent[] {
    const seen = new Set<string>();

    return events.filter((event) => {
        const key = [
            event.courseShort,
            event.lvType,
            event.start.toISOString(),
            event.end.toISOString()
        ].join("__");

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function getCourseProgress(events: ParsedEvent[]): CourseProgressResult[] {
    const grouped = new Map<string, CourseProgress>();
    const attendanceMap = readAttendanceMap();
    const now = new Date();

    for (const event of events) {
        const key = event.courseShort || event.courseName;

        if (!grouped.has(key)) {
            grouped.set(key, {
                courseShort: event.courseShort,
                courseName: event.courseName,
                totalIlEh: 0,
                totalUeEh: 0,
                completedIlEh: 0,
                completedUeEh: 0
            });
        }

        const progress = grouped.get(key)!;
        const eventId = getEventId(event);
        const attendanceStatus = attendanceMap[eventId] ?? "attended";

        const isPast = event.start < now;
        const countsAsCompleted = isPast && attendanceStatus !== "missed";

        if (event.lvType === "IL") {
            progress.totalIlEh += event.eh;

            if (countsAsCompleted) {
                progress.completedIlEh += event.eh;
            }
        } else if (event.lvType === "UE") {
            progress.totalUeEh += event.eh;

            if (countsAsCompleted) {
                progress.completedUeEh += event.eh;
            }
        }
    }

    return Array.from(grouped.values())
        .map((item): CourseProgressResult => {
            const totalEh = item.totalIlEh + item.totalUeEh;
            const completedEh = item.completedIlEh + item.completedUeEh;
            const remainingEh = totalEh - completedEh;
            const progressPercent = totalEh > 0 ? (completedEh / totalEh) * 100 : 0;

            return {
                courseShort: item.courseShort,
                courseName: item.courseName,
                totalIlEh: item.totalIlEh,
                totalUeEh: item.totalUeEh,
                totalEh,
                completedIlEh: item.completedIlEh,
                completedUeEh: item.completedUeEh,
                completedEh,
                remainingEh,
                progressPercent
            };
        })
        .sort((a, b) => a.courseName.localeCompare(b.courseName, "de"));
}

function parseEvent(event: any): ParsedEvent {
    const description = getTextValue(event.description);
    const location = getTextValue(event.location);

    const { code, courseName } = extractCourseName(description);
    const courseShort = extractCourseShort(code);
    const lvType = extractLvType(code);

    const durationMinutes = Math.round(
        (event.end.getTime() - event.start.getTime()) / 1000 / 60
    );

    const eh = calculateEh(durationMinutes);

    return {
        code,
        courseShort,
        courseName,
        lvType,
        start: event.start,
        end: event.end,
        location,
        durationMinutes,
        eh
    };
}

function buildCourseEvents(events: ParsedEvent[], courseShort: string): CourseEventResult[] {
    const attendanceMap = readAttendanceMap();
    const now = new Date();

    return events
        .filter((event) => event.courseShort === courseShort)
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .map((event) => {
            const id = getEventId(event);

            return {
                id,
                code: event.code,
                courseShort: event.courseShort,
                courseName: event.courseName,
                lvType: event.lvType,
                start: event.start.toISOString(),
                end: event.end.toISOString(),
                location: event.location,
                eh: event.eh,
                isCompleted: event.start < now,
                attendanceStatus: attendanceMap[id] ?? "attended"
            };
        });
}

function setNoCacheHeaders(res: express.Response): void {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
}

async function syncCalendarCache(): Promise<void> {
    if (isSyncing) {
        return;
    }

    try {
        isSyncing = true;
        console.log("Synchronisiere Kalender...");

        const data = await ical.async.fromURL(CALENDAR_URL);
        const rawEvents = Object.values(data).filter((e: any) => e.type === "VEVENT");
        const parsedEvents: ParsedEvent[] = rawEvents.map(parseEvent);

        const rangeStart = new Date("2026-02-23T00:00:00");
        const rangeEnd = new Date("2026-08-01T23:59:59");

        const relevantEvents = getRelevantEvents(parsedEvents, rangeStart, rangeEnd);
        cachedRelevantEvents = removeDuplicateEvents(relevantEvents);

        lastSyncAt = new Date().toISOString();

        console.log(
            `Kalender synchronisiert. Relevante Termine: ${relevantEvents.length}, nach Dublettenfilter: ${cachedRelevantEvents.length}`
        );
    } catch (error) {
        console.error("Fehler beim Kalender-Sync:");
        console.error(error);
    } finally {
        isSyncing = false;
    }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/courses/:courseShort/events", async (req, res) => {
    try {
        const courseShort = req.params["courseShort"] as string;
        const courseEvents = buildCourseEvents(cachedRelevantEvents, courseShort);

        setNoCacheHeaders(res);
        res.json(courseEvents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Course events could not be loaded" });
    }
});

app.patch("/api/events/:eventId/attendance", (req, res) => {
    try {
        const eventId = req.params["eventId"] as string;
        const status = req.body?.status as AttendanceStatus | undefined;

        if (!eventId) {
            return res.status(400).json({ error: "Missing eventId" });
        }

        if (status !== "open" && status !== "attended" && status !== "missed") {
            return res.status(400).json({ error: "Invalid attendance status" });
        }

        const attendanceMap = readAttendanceMap();
        attendanceMap[eventId] = status;
        writeAttendanceMap(attendanceMap);

        setNoCacheHeaders(res);
        return res.json({
            success: true,
            eventId,
            status
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Attendance could not be updated" });
    }
});

app.get("/api/progress", async (_req, res) => {
    try {
        const progress = getCourseProgress(cachedRelevantEvents);
        setNoCacheHeaders(res);
        res.json(progress);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Calendar parsing failed" });
    }
});

app.get("/api/status", (_req, res) => {
    setNoCacheHeaders(res);
    res.json({
        lastSyncAt,
        cachedEvents: cachedRelevantEvents.length,
        isSyncing
    });
});

const frontendDistPath = path.join(process.cwd(), "public");

if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    app.get(/.*/, (req, res, next) => {
        if (req.path.startsWith("/api")) {
            return next();
        }

        return res.sendFile(path.join(frontendDistPath, "index.html"));
    });
}

async function startServer(): Promise<void> {
    await syncCalendarCache();

    setInterval(() => {
        void syncCalendarCache();
    }, 60_000);

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server läuft auf Port ${PORT}`);
    });
}

void startServer();

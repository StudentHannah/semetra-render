export type LvType = "IL" | "UE" | "VO" | "";

export type ParsedEvent = {
    code: string;
    courseShort: string;
    courseName: string;
    lvType: LvType;
    start: Date;
    end: Date;
    location: string;
    durationMinutes: number;
    eh: number;
};

export type CourseProgress = {
    courseShort: string;
    courseName: string;
    totalIlEh: number;
    totalUeEh: number;
    completedIlEh: number;
    completedUeEh: number;
};

export type CourseProgressResult = {
    courseShort: string;
    courseName: string;
    totalIlEh: number;
    totalUeEh: number;
    totalEh: number;
    completedIlEh: number;
    completedUeEh: number;
    completedEh: number;
    remainingEh: number;
    progressPercent: number;
};

export type CourseEventResult = {
    id: string;
    code: string;
    courseShort: string;
    courseName: string;
    lvType: LvType;
    start: string;
    end: string;
    location: string;
    eh: number;
    isCompleted: boolean;
    attendanceStatus: AttendanceStatus;
};

export type AttendanceStatus = 'open' | 'attended' | 'missed';
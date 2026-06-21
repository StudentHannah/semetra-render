export type AttendanceStatus = 'open' | 'attended' | 'missed';

export interface CourseEvent {
  id: string;
  code: string;
  courseShort: string;
  courseName: string;
  lvType: 'IL' | 'UE' | 'VO' | '';
  start: string;
  end: string;
  location: string;
  eh: number;
  isCompleted: boolean;
  attendanceStatus: AttendanceStatus;
}

export interface CourseProgress {
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
}

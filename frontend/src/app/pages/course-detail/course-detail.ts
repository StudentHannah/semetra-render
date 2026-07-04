import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CourseEvent } from '../../models/course-event.model';
import { CourseProgress } from '../../models/course-progress.model';
import { ProgressService } from '../../services/progress';
import { Component, OnInit, inject, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import lottie, { AnimationItem } from 'lottie-web';
import { jelly } from 'ldrs';

@Component({
  selector: 'app-course-detail',
  imports: [CommonModule, NgOptimizedImage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private progressService = inject(ProgressService);
  private cdr = inject(ChangeDetectorRef);

  courseShort = '';
  courseName = '';
  events: CourseEvent[] = [];
  progressData: CourseProgress[] = [];
  loading = true;
  error = '';
  showTrophyAnimation = false;

  trophyEventId: string | number | null = null;
  happyEventId: string | number | null = null;
  private trophyAnimation?: AnimationItem;
  private happyAnimation?: AnimationItem;

  ngOnInit(): void {
    jelly.register();
    this.courseShort = this.route.snapshot.paramMap.get('courseShort') ?? '';

    if (!this.courseShort) {
      this.error = 'Kein Fach angegeben.';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    forkJoin({
      events: this.progressService.getCourseEvents(this.courseShort),
      progress: this.progressService.getProgress(),
    }).subscribe({
      next: ({ events, progress }) => {
        this.events = events;
        this.progressData = progress;
        this.courseName = events[0]?.courseName ?? this.courseShort;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.error = 'Fachtermine konnten nicht geladen werden.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  get totalEh(): number {
    return this.events.reduce((sum, event) => sum + event.eh, 0);
  }

  get completedEh(): number {
    return this.events
      .filter((event) => event.isCompleted)
      .reduce((sum, event) => sum + event.eh, 0);
  }

  get remainingEh(): number {
    return this.totalEh - this.completedEh;
  }

  get totalCourses(): number {
    return this.progressData.length;
  }

  get completedCoursesCount(): number {
    return this.progressData.filter((course) => course.progressPercent >= 100).length;
  }

  setAttendance(event: CourseEvent, newStatus: 'attended' | 'missed'): void {
    if (event.attendanceStatus === newStatus) {
      return;
    }

    this.progressService.updateAttendance(event.id, newStatus).subscribe({
      next: () => {
        event.attendanceStatus = newStatus;

        if (newStatus === 'missed') {
          this.playTrophyAnimation(event.id);
        } else if (newStatus === 'attended') {
          this.playHappyAnimation(event.id);
        }

        this.loadProgressCounts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  private loadProgressCounts(): void {
    this.progressService.getProgress().subscribe({
      next: (progress) => {
        this.progressData = progress;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  private playTrophyAnimation(eventId: string | number): void {
    this.trophyAnimation?.destroy();
    this.trophyAnimation = undefined;

    this.trophyEventId = eventId;
    this.cdr.detectChanges();

    setTimeout(() => {
      const container = document.getElementById(`trophy-container-${eventId}`);

      if (!container) {
        console.warn('Kein Trophy-Container für Event gefunden:', eventId);
        return;
      }

      this.trophyAnimation = lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: '/pokal.json',
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
        },
      });

      setTimeout(() => {
        this.trophyAnimation?.destroy();
        this.trophyAnimation = undefined;
        this.trophyEventId = null;
        this.cdr.detectChanges();
      }, 1800);
    }, 0);
  }

  private playHappyAnimation(eventId: string) {
    this.happyAnimation?.destroy();
    this.happyAnimation = undefined;

    this.happyEventId = eventId;
    this.cdr.detectChanges();

    setTimeout(() => {
      const container = document.getElementById(`happy-container-${eventId}`);

      if (!container) {
        console.warn('Kein Happy-Container für Event gefunden:', eventId);
        return;
      }

      this.happyAnimation = lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: '/semi_happy.json',
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
        },
      });

      setTimeout(() => {
        this.happyAnimation?.destroy();
        this.happyAnimation = undefined;
        this.happyEventId = null;
        this.cdr.detectChanges();
      }, 1800);
    }, 0);
  }
}

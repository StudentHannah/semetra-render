import { CommonModule, NgOptimizedImage } from '@angular/common';
import { CourseProgress } from '../../models/course-progress.model';
import { ProgressService } from '../../services/progress';
import { Router } from '@angular/router';
import confetti from 'canvas-confetti';
import {
  Component,
  OnInit,
  AfterViewInit,
  QueryList,
  ViewChildren,
  ElementRef,
  inject,
  ChangeDetectorRef,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { jelly } from 'ldrs';
import { StorageService } from '../../services/storage';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';
import type { AnimationItem } from 'lottie-web';

type AnimatedCourseProgress = CourseProgress & {
  animatedProgressPercent: number;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LottieComponent, NgOptimizedImage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private cdr = inject(ChangeDetectorRef);
  private progressService = inject(ProgressService);
  private router = inject(Router);
  private storage = inject(StorageService);

  animatedTotalCourses = 0;
  animatedTotalEh = 0;
  animatedCompletedEh = 0;
  animatedAverageProgress = 0;
  private summaryAnimationStarted = false;

  progressData: AnimatedCourseProgress[] = [];

  @ViewChildren('courseCard') courseCards!: QueryList<ElementRef>;

  private confettiTriggeredCourses = new Set<string>();

  loading = true;
  error = '';

  // Reset UI state
  resetConfirmOpen = false;
  resetInProgress = false;

  semiMood: 'happy' | 'neutral' | 'worried' = 'neutral';

  // keep the currently used mascot animation path separately because AnimationOptions type
  // does not expose a `path` property in its type definition
  private mascotPath = 'semi_neutral.json';
  options: AnimationOptions = {
    // casting to any to allow the path key at runtime (ngx-lottie accepts it)
    // but we keep mascotPath for type-safe checks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...( { path: this.mascotPath, loop: true, autoplay: true } as any ),
  };

  private mascotAnimation: AnimationItem | null = null;
  private mascotCompleteHandler = () => {
    // Nach der einmaligen semi_happy-Animation sicherstellen, dass die loopende Variante angezeigt wird
    this.mascotPath = 'semi_neutral.json';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.options = ( { path: this.mascotPath, loop: true, autoplay: true } as any );
    this.cdr.detectChanges();
  };

  onMascotCreated(anim: AnimationItem): void {
    // Entferne vorherige Listener
    if (this.mascotAnimation) {
      try {
        this.mascotAnimation.removeEventListener && this.mascotAnimation.removeEventListener('complete', this.mascotCompleteHandler);
      } catch {
        // ignore
      }
    }

    this.mascotAnimation = anim;

    // Wenn aktuell semi_happy abgespielt wird (nicht loop), möchten wir nach 'complete' automatisch zu semi_neutral wechseln
    const isPlayingHappy = this.mascotPath.includes('semi_happy') && !this.options.loop;
    if (isPlayingHappy) {
      try {
        anim.addEventListener && anim.addEventListener('complete', this.mascotCompleteHandler);
      } catch {
        // ignore
      }
    }
  }

  get totalCourses(): number {
    return this.progressData.length;
  }

  // Anzahl der vollständig abgeschlossenen Fächer (100% oder mehr)
  get completedCoursesCount(): number {
    return this.progressData.filter((c) => c.progressPercent >= 100).length;
  }

  get totalEh(): number {
    return this.progressData.reduce((sum, course) => sum + course.totalEh, 0);
  }

  get completedEh(): number {
    return this.progressData.reduce((sum, course) => sum + course.completedEh, 0);
  }

  get averageProgress(): number {
    if (this.progressData.length === 0) return 0;
    const total = this.progressData.reduce((sum, course) => sum + course.progressPercent, 0);
    return total / this.progressData.length;
  }

  ngOnInit(): void {
    this.loadProgress();
    jelly.register();
  }

  openResetConfirm(): void {
    this.resetConfirmOpen = true;
    this.cdr.detectChanges();
  }

  cancelReset(): void {
    this.resetConfirmOpen = false;
    this.cdr.detectChanges();
  }

  confirmReset(): void {
    if (this.resetInProgress) return;
    this.resetInProgress = true;
    this.cdr.detectChanges();

    // Entferne alle Animation-Flags
    try {
      this.storage.removeByPrefix('animations.');
    } finally {
      this.resetInProgress = false;
      this.resetConfirmOpen = false;
      this.cdr.detectChanges();
    }
  }

  ngAfterViewInit(): void {
    this.courseCards.changes.subscribe(() => {
      this.observeCourseCards();
    });
  }

  // Wird ausgelöst, wenn eine Karte per Klick aktiviert wird.
  onCourseClick(course: AnimatedCourseProgress, event: MouseEvent): void {
    const cardEl = (event.currentTarget as HTMLElement);
    // markiere als 'clicked' damit Fokus/Hover-Effekte sichtbar bleiben
    cardEl.classList.add('clicked');

    // Setze sofort die Breite (snap)
    course.animatedProgressPercent = course.progressPercent;
    this.cdr.detectChanges();

    // Füge eine kurze Pulse-Animation auf das Fill-Element hinzu, damit es "animiert" wirkt,
    // aber die Breite sofort gesprungen ist (snap behaviour)
    const fill = cardEl.querySelector('.progress-fill') as HTMLElement | null;
    if (fill) {
      fill.classList.add('pulse');
      // Entferne die Klasse nach Ende
      setTimeout(() => fill.classList.remove('pulse'), 700);
    }

    // falls vollständig, etwas Feier-UI
    if (course.progressPercent >= 100 && !this.confettiTriggeredCourses.has(course.courseShort)) {
      const confettiKey = `animations.confetti.${course.courseShort}`;
      const confettiPlayed = !!this.storage.getItem<boolean>(confettiKey);
      if (!confettiPlayed) {
        this.confettiTriggeredCourses.add(course.courseShort);
        // Wechsel auf die semi_happy Animation (einmalig, nicht loop) wenn noch nicht gespielt
        const semiHappyPlayed = !!this.storage.getItem<boolean>('animations.semi_happy.played');
        if (!semiHappyPlayed) {
          this.semiMood = 'happy';
          this.mascotPath = 'semi_happy.json';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.options = ( { path: this.mascotPath, loop: false, autoplay: true } as any );
          this.storage.setItem('animations.semi_happy.played', true);
        }
        // Markiere Confetti für dieses Fach als gespielt
        this.storage.setItem(confettiKey, true);
        setTimeout(() => this.launchConfettiAtCard(cardEl), 450);
      }
    }

    // Nach kurzer Verzögerung navigieren (nutzer sieht den Snap)
    setTimeout(() => this.openCourse(course.courseShort), 380);
  }

  onCourseKey(ev: Event, course: AnimatedCourseProgress): void {
    // Space/Enter soll wie Klick wirken
    ev.preventDefault();
    // find the focused card element
    const focused = document.activeElement as HTMLElement | null;
    if (focused) {
      this.onCourseClick(course, { currentTarget: focused } as unknown as MouseEvent);
      // navigate to course
      this.openCourse(course.courseShort);
    }
  }

  private animateSummaryNumbers(): void {
    if (this.summaryAnimationStarted) return;

    this.summaryAnimationStarted = true;

    const duration = 2000;
    const startTime = performance.now();

    const targetTotalCourses = this.totalCourses;
    const targetTotalEh = this.totalEh;
    const targetCompletedEh = this.completedEh;
    const targetAverageProgress = this.averageProgress;

    // Exponentielles Slowdown (eased): 1 - exp(-k * t) normalized
    const smoothFastStartSlowEnd = (t: number): number => {
      const k = 5; // steiler = schneller Start, langsameres Ende
      const raw = 1 - Math.exp(-k * t);
      const norm = 1 - Math.exp(-k);
      return raw / norm;
    };

    const animate = (currentTime: number): void => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = smoothFastStartSlowEnd(progress);

      this.animatedTotalCourses = Math.round(targetTotalCourses * easedProgress);
      this.animatedTotalEh = Math.round(targetTotalEh * easedProgress);
      this.animatedCompletedEh = Math.round(targetCompletedEh * easedProgress);
      this.animatedAverageProgress = targetAverageProgress * easedProgress;

      if (progress < 1) {
        this.cdr.detectChanges();
        requestAnimationFrame(animate);
        return;
      }

      this.animatedTotalCourses = targetTotalCourses;
      this.animatedTotalEh = targetTotalEh;
      this.animatedCompletedEh = targetCompletedEh;
      this.animatedAverageProgress = targetAverageProgress;
      this.cdr.detectChanges();
    };

    requestAnimationFrame(animate);
  }

  loadProgress(): void {
    this.loading = true;
    this.error = '';

    this.summaryAnimationStarted = false;
    this.animatedTotalCourses = 0;
    this.animatedTotalEh = 0;
    this.animatedCompletedEh = 0;
    this.animatedAverageProgress = 0;

    const fakeLoadingDelay = 0;

    this.progressService.getProgress().subscribe({
      next: (data) => {
        setTimeout(() => {
          this.progressData = data.map((course) => ({
            ...course,
            animatedProgressPercent: 0,
          }));

          this.updateSemiMood();

          this.loading = false;
          this.cdr.detectChanges();

          setTimeout(() => {
            this.animateSummaryNumbers();
            this.observeCourseCards();
          }, 0);
        }, fakeLoadingDelay);
      },
      error: () => {
        setTimeout(() => {
          this.error = 'Daten konnten nicht geladen werden.';
          this.loading = false;
          this.cdr.detectChanges();
        }, fakeLoadingDelay);
      },
    });
  }

  openCourse(courseShort: string): void {
    this.router.navigate(['/course', courseShort]);
  }

  private observeCourseCards(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const cardElement = entry.target as HTMLElement;
          const courseShort = cardElement.dataset['course'];

          // Entry-Animation starten
          cardElement.classList.add('card-visible');

          // Nach der Entry-Animation: animation entfernen damit
          // Hover-Transitions auf transform wieder funktionieren
          cardElement.addEventListener(
            'animationend',
            () => {
              cardElement.style.animation = 'none';
              cardElement.style.opacity = '1';
            },
            { once: true },
          );

          if (!courseShort) return;

          const course = this.progressData.find((c) => c.courseShort === courseShort);
          if (!course) return;

          // Progress Bar Fill-In
          course.animatedProgressPercent = course.progressPercent;
          this.cdr.detectChanges();

          // Confetti bei 100%
          if (course.progressPercent >= 100) {
            const confettiKey = `animations.confetti.${courseShort}`;
            const confettiPlayed = !!this.storage.getItem<boolean>(confettiKey);
            if (!confettiPlayed && !this.confettiTriggeredCourses.has(courseShort)) {
              this.confettiTriggeredCourses.add(courseShort);
              const semiHappyPlayed = !!this.storage.getItem<boolean>('animations.semi_happy.played');
              if (!semiHappyPlayed) {
                this.semiMood = 'happy';
                this.mascotPath = 'semi_happy.json';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this.options = ( { path: this.mascotPath, loop: false, autoplay: true } as any );
                this.storage.setItem('animations.semi_happy.played', true);
              }
              this.storage.setItem(confettiKey, true);
              setTimeout(() => this.launchConfettiAtCard(cardElement), 1450);
            }
          }

          observer.unobserve(cardElement);
        });
      },
      {
        rootMargin: '0px 0px 50px 0px',
      },
    );

    this.courseCards.forEach((card) => {
      observer.observe(card.nativeElement);
    });
  }

  private launchConfettiAtCard(cardElement: HTMLElement): void {
    const rect = cardElement.getBoundingClientRect();

    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 120,
      spread: 75,
      startVelocity: 42,
      scalar: 0.95,
      origin: { x, y },
    });

    setTimeout(() => {
      confetti({
        particleCount: 70,
        spread: 60,
        startVelocity: 32,
        scalar: 0.8,
        origin: { x: Math.max(0.1, x - 0.12), y },
      });

      confetti({
        particleCount: 70,
        spread: 60,
        startVelocity: 32,
        scalar: 0.8,
        origin: { x: Math.min(0.9, x + 0.12), y },
      });
    }, 180);
  }

  private updateSemiMood(): void {
    // Wenn mindestens ein Fach 100% oder mehr hat -> sofort semi_happy (einmalige Animation)
    const anyCompleted = this.progressData.some((c) => c.progressPercent >= 100);
    const semiHappyPlayed = !!this.storage.getItem<boolean>('animations.semi_happy.played');
    if (anyCompleted) {
      if (!semiHappyPlayed) {
        this.semiMood = 'happy';
        this.options = {
          path: 'semi_happy.json',
          loop: false,
          autoplay: true,
        };
        this.storage.setItem('animations.semi_happy.played', true);
      } else {
        // Zeige die loopende Variante, falls die Einmal-Animation bereits gespielt wurde
        this.semiMood = 'happy';
        this.options = {
          path: 'semi_neutral.json',
          loop: true,
          autoplay: true,
        };
      }
      return;
    }

    const progress = this.averageProgress;

    if (progress >= 80) {
      this.semiMood = 'happy';
      this.options = {
        path: 'semi_neutral.json',
        loop: true,
        autoplay: true,
      };
      return;
    }

    if (progress >= 50) {
      this.semiMood = 'neutral';
      this.options = {
        path: 'semi_neutral.json',
        loop: true,
        autoplay: true,
      };
      return;
    }

    this.semiMood = 'worried';
    this.options = {
      path: 'semi_worried.json',
      loop: true,
      autoplay: true,
    };
  }
}

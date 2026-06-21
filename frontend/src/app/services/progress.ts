import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CourseProgress } from '../models/course-progress.model';
import { CourseEvent } from '../models/course-event.model';

@Injectable({
  providedIn: 'root',
})
export class ProgressService {
  private http = inject(HttpClient);

  getProgress(): Observable<CourseProgress[]> {
    return this.http.get<CourseProgress[]>(`/api/progress?t=${Date.now()}`);
  }

  getCourseEvents(courseShort: string): Observable<CourseEvent[]> {
    return this.http.get<CourseEvent[]>(`/api/courses/${courseShort}/events?t=${Date.now()}`);
  }

  updateAttendance(eventId: string, status: 'open' | 'attended' | 'missed') {
    return this.http.patch(
      `/api/events/${encodeURIComponent(eventId)}/attendance?t=${Date.now()}`,
      { status },
    );
  }
}

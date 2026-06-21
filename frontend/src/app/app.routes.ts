import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { CourseDetailComponent } from './pages/course-detail/course-detail';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
  },
  {
    path: 'course/:courseShort',
    component: CourseDetailComponent,
  },
];

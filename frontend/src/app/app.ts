import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StorageService } from './services/storage';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class App implements OnInit {
  private storage = inject(StorageService);

  ngOnInit(): void {
    // Migriere ggf. vorhandene sessionStorage-Daten in localStorage
    this.storage.migrateFromSessionStorage();
  }
}

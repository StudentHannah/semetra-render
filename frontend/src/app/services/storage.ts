import { Injectable } from '@angular/core';

/**
 * StorageService
 * Verwaltet persistente Speicherung im Browser und verwendet dabei lokal `localStorage`.
 * Bietet sichere JSON-Serialisierung und eine Hilfsfunktion, um ggf. Daten aus
 * sessionStorage nach localStorage zu migrieren.
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null;

  /** Prüft, ob Storage verfügbar ist (z. B. Server-Side-Rendering ausschließen). */
  isAvailable(): boolean {
    return this.storage !== null;
  }

  /** Liest einen Eintrag und parsed ihn als JSON. Gibt `null` zurück, wenn nicht vorhanden oder fehlerhaft. */
  getItem<T = unknown>(key: string): T | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      // Im Fehlerfall nichts werfen — Aufrufer kann mit null umgehen.
      return null;
    }
  }

  /** Setzt einen JSON-serialisierten Eintrag im localStorage. */
  setItem<T = unknown>(key: string, value: T): void {
    if (!this.storage) return;
    try {
      const raw = JSON.stringify(value);
      this.storage.setItem(key, raw);
    } catch {
      // Silent fail: lokale Speichervorgänge dürfen die App nicht zum Absturz bringen.
    }
  }

  /** Entfernt einen Eintrag. */
  removeItem(key: string): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(key);
    } catch {
      // ignore
    }
  }

  /** Löscht alle Einträge im localStorage. Vorsicht: Globaler Effekt. */
  clear(): void {
    if (!this.storage) return;
    try {
      this.storage.clear();
    } catch {
      // ignore
    }
  }

  /** Entfernt alle Keys, die mit dem gegebenen Präfix beginnen. */
  removeByPrefix(prefix: string): void {
    if (!this.storage) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(prefix)) keysToRemove.push(key);
      }

      for (const k of keysToRemove) {
        try {
          this.storage.removeItem(k);
        } catch {
          // ignore individual failures
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Prüft, ob ein Schlüssel existiert.
   */
  hasKey(key: string): boolean {
    if (!this.storage) return false;
    try {
      return this.storage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Migriert alle Einträge aus sessionStorage nach localStorage.
   * Nützlich, wenn vorher sessionStorage verwendet wurde und Daten behalten werden sollen.
   * Bereits existierende Schlüssel in localStorage werden nicht überschrieben.
   */
  migrateFromSessionStorage(): void {
    if (typeof window === 'undefined' || !this.storage) return;
    try {
      const ss = window.sessionStorage;
      for (let i = 0; i < ss.length; i++) {
        const key = ss.key(i);
        if (!key) continue;
        try {
          const val = ss.getItem(key);
          if (val !== null && this.storage.getItem(key) === null) {
            this.storage.setItem(key, val);
          }
        } catch {
          // ignore individual key failures
        }
      }
    } catch {
      // ignore migration errors (e.g. blocked access)
    }
  }
}


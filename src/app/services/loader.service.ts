import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private pendientes = 0;
  private readonly _isLoading$ = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this._isLoading$.asObservable();

  show(): void {
    this.pendientes++;
    this._isLoading$.next(true);
  }

  hide(): void {
    this.pendientes = Math.max(0, this.pendientes - 1);
    if (this.pendientes === 0) this._isLoading$.next(false);
  }
}
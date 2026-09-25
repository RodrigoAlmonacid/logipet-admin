import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const required = (route.data['roles'] as string[] | undefined) ?? [];
  if (!required.length || auth.hasAnyRole(required)) return true;

  return router.createUrlTree(['/dashboard']);
};
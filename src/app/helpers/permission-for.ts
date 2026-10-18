import { computed, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export function permissionsFor(recurso: string) {
  const auth = inject(AuthService);

  const canView = computed(() => auth.can(`${recurso}:view`));
  const canCreate = computed(() => auth.can(`${recurso}:create`));
  const canUpdate = computed(() => auth.can(`${recurso}:update`));
  const canDelete = computed(() => auth.can(`${recurso}:delete`));
  const canConfirm = computed(() => auth.can(`${recurso}:confirm`));
  const canCancel = computed(() => auth.can(`${recurso}:cancel`));
  const canCancelAny = computed(() => auth.can(`${recurso}:cancel_any`));
  const canApprove = computed(() => auth.can(`${recurso}:approve`));
  const canReject = computed(() => auth.can(`${recurso}:reject`));
  const hasRowActions = computed(
    () => canUpdate() || canDelete() || canConfirm() || canCancel() || canCancelAny() || canApprove() || canReject(),
  );

  return {
    canView, canCreate, canUpdate, canDelete, canConfirm, canCancel,
    canCancelAny, canApprove, canReject, hasRowActions,
  };
}


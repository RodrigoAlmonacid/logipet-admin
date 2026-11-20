import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Observable } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Camion, CamionesService, CamionPayload } from '../../services/camiones.service';
import { permissionsFor } from '../../helpers/permission-for';

@Component({
    selector: 'app-camiones',
    imports: [
        DecimalPipe, ReactiveFormsModule, ButtonModule, CardModule, CheckboxModule, ConfirmDialogModule,
        DialogModule, InputNumberModule, InputTextModule, TableModule, TagModule, ToastModule,
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './camiones.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CamionesComponent implements OnInit {
    private readonly service = inject(CamionesService);
    private readonly messages = inject(MessageService);
    private readonly confirmation = inject(ConfirmationService);
    private readonly fb = inject(FormBuilder);
    private readonly auth = inject(AuthService);

    protected readonly puedeCrear = computed(() => this.auth.can('camion:create'));
    protected readonly puedeEditar = computed(() => this.auth.can('camion:update'));
    protected readonly puedeEliminar = computed(() => this.auth.can('camion:delete'));

    protected readonly camiones = signal<Camion[]>([]);
    protected readonly loading = signal(false);
    protected readonly guardando = signal(false);
    protected readonly dialogo = signal(false);
    private readonly editandoId = signal<number | null>(null);
    protected readonly titulo = computed(() => (this.editandoId() ? 'Editar camión' : 'Nuevo camión'));
    protected readonly permisoCamion = permissionsFor('camion');

    protected readonly form = this.fb.group({
        interno: [null as number | null, [Validators.required, Validators.min(1)]],
        marca: ['', [Validators.required, Validators.maxLength(50)]],
        modelo: ['', Validators.maxLength(50)],
        capacidad: [null as number | null, [Validators.required, Validators.min(1)]],
        capacidadVolumen: [null as number | null],
        disponible: [true],
    });

    ngOnInit(): void {
        this.cargar();
    }

    protected nuevo(): void {
    if (!this.permisoCamion.canCreate()) return;
        this.editandoId.set(null);
        this.form.reset({ disponible: true });
        this.dialogo.set(true);
    }

    protected editar(c: Camion): void {
    if (!this.permisoCamion.canUpdate()) return;
        this.editandoId.set(c.id);
        this.form.reset({ ...c, modelo: c.modelo ?? '' });
        this.dialogo.set(true);
    }

    protected guardar(): void {
        if (this.form.invalid) return this.form.markAllAsTouched();
        const v = this.form.getRawValue();
        const body = { ...v, modelo: v.modelo || null } as CamionPayload;
        const id = this.editandoId();
        this.ejecutar(
            id ? this.service.actualizar(id, body) : this.service.crear(body),
            id ? 'Camión actualizado.' : 'Camión creado.',
        );
    }

    protected eliminar(c: Camion): void {
    if (!this.permisoCamion.canDelete()) return;
        this.confirmation.confirm({
            header: 'Eliminar camión',
            message: `¿Eliminar el interno ${c.interno} (${c.marca})?`,
            acceptLabel: 'Eliminar',
            rejectLabel: 'Cancelar',
            accept: () => this.ejecutar(this.service.eliminar(c.id), 'Camión eliminado.'),
        });
    }

    private cargar(): void {
        this.loading.set(true);
        this.service.listar().subscribe({
            next: (lista) => { this.camiones.set(lista); this.loading.set(false); },
            error: (err: HttpErrorResponse) => { this.loading.set(false); this.mostrarError(err); },
        });
    }

    /** Guardar y eliminar comparten el mismo ciclo: loading, aviso, cierre del diálogo y recarga. */
    private ejecutar(operacion: Observable<unknown>, detalle: string): void {
        this.guardando.set(true);
        operacion.subscribe({
            next: () => {
                this.guardando.set(false);
                this.dialogo.set(false);
                this.messages.add({ severity: 'success', summary: 'Listo', detail: detalle });
                this.cargar();
            },
            error: (err: HttpErrorResponse) => { this.guardando.set(false); this.mostrarError(err); },
        });
    }

    private mostrarError(err: HttpErrorResponse): void {
        const m = err.error?.message;
        this.messages.add({ severity: 'error', summary: 'Error', detail: Array.isArray(m) ? m.join(' · ') : (m ?? 'Ocurrió un error inesperado.') });
    }
}
import { HttpClient } from '@angular/common/http';
import {
    ChangeDetectionStrategy, Component, ElementRef, EventEmitter,
    Output, ViewChild, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import * as L from 'leaflet';

export interface DireccionSeleccionada {
    direccion: string;
    latitud: number;
    longitud: number;
}

interface ResultadoNominatim {
    display_name: string;
    lat: string;
    lon: string;
}

@Component({
    selector: 'app-mapa-direccion',
    standalone: true,
    imports: [FormsModule, DialogModule, ButtonModule, InputTextModule],
    templateUrl: './mapa-direccion.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaDireccionComponent {
    @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;
    @Output() confirmado = new EventEmitter<DireccionSeleccionada>();

    protected visible = signal(false);
    protected busqueda = '';
    protected buscando = signal(false);
    protected resultados = signal<ResultadoNominatim[]>([]);
    protected direccionElegida = signal<string | null>(null);

    private map?: L.Map;
    private marker?: L.Marker;
    private lat = 0;
    private lon = 0;

    constructor(private readonly http: HttpClient) { }

    abrir(): void {
        this.visible.set(true);
        this.resultados.set([]);
        this.direccionElegida.set(null);
        this.busqueda = '';
    }

    protected onDialogShown(): void {
        this.initMap();
    }

    private initMap(): void {
        if (this.map) {
            this.map.remove();
        }

        // Centro por defecto: Neuquén capital
        this.map = L.map(this.mapContainer.nativeElement).setView([-38.9516, -68.0591], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(this.map);

        this.map.on('click', (e: L.LeafletMouseEvent) => {
            this.colocarPin(e.latlng.lat, e.latlng.lng);
        });
        setTimeout(() => this.map?.invalidateSize(), 100);
    }

    protected buscar(): void {
        if (!this.busqueda.trim()) {
            return;
        }
        this.buscando.set(true);

        const url = 'https://nominatim.openstreetmap.org/search';
        const params = {
            format: 'json',
            q: this.busqueda,
            countrycodes: 'ar',
            limit: '5',
        };

        this.http.get<ResultadoNominatim[]>(url, { params }).subscribe({
            next: (res) => {
                this.resultados.set(res);
                this.buscando.set(false);
            },
            error: () => this.buscando.set(false),
        });
    }

    protected elegirResultado(r: ResultadoNominatim): void {
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        this.direccionElegida.set(r.display_name);
        this.colocarPin(lat, lon);
        this.map?.setView([lat, lon], 16);
    }

    private colocarPin(lat: number, lon: number): void {
        this.lat = lat;
        this.lon = lon;

        if (this.marker) {
            this.marker.setLatLng([lat, lon]);
        } else {
            this.marker = L.marker([lat, lon], { draggable: true }).addTo(this.map!);
            this.marker.on('dragend', () => {
                const pos = this.marker!.getLatLng();
                this.lat = pos.lat;
                this.lon = pos.lng;
            });
        }
    }

    protected confirmar(): void {
        if (!this.marker) {
            return; // todavía no se eligió ni se clickeó ningún punto
        }
        this.confirmado.emit({
            direccion: this.direccionElegida() ?? this.busqueda,
            latitud: this.lat,
            longitud: this.lon,
        });
        this.visible.set(false);
    }

    protected cancelar(): void {
        this.visible.set(false);
    }
}
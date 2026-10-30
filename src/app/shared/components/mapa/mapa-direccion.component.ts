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
import { environment } from '../../../../environments/environment';

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

    private customIcon = L.icon({
        iconUrl: 'favicon.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
        shadowUrl: ''
    });

    constructor(private readonly http: HttpClient) { }

    abrir(datosPrevios?: DireccionSeleccionada): void {
        this.visible.set(true);
        this.resultados.set([]);
        this.marker = undefined; // Resetear el marcador previo

        if (datosPrevios?.latitud && datosPrevios?.longitud) {
            this.direccionElegida.set(datosPrevios.direccion);
            this.busqueda = datosPrevios.direccion;
            this.lat = datosPrevios.latitud;
            this.lon = datosPrevios.longitud;
        } else {
            this.direccionElegida.set(null);
            this.busqueda = '';
            this.lat = 0;
            this.lon = 0;
        }
    }

    protected onDialogShown(): void {
        this.initMap();
    }

    private initMap(): void {
        if (this.map) this.map.remove();

        const startLat = this.lat !== 0 ? this.lat : -38.9516;
        const startLon = this.lon !== 0 ? this.lon : -68.0591;
        const startZoom = this.lat !== 0 ? 16 : 13;

        this.map = L.map(this.mapContainer.nativeElement).setView([startLat, startLon], startZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19,
        }).addTo(this.map);

        this.map.on('click', (e: L.LeafletMouseEvent) => {
            this.colocarPin(e.latlng.lat, e.latlng.lng);
            this.buscarDireccionInversa(e.latlng.lat, e.latlng.lng);
        });

        if (this.lat !== 0 && this.lon !== 0) {
            this.colocarPin(this.lat, this.lon);
        }

        setTimeout(() => this.map?.invalidateSize(), 250);
    }

    protected buscar(): void {
        if (!this.busqueda.trim()) {
            return;
        }
        this.buscando.set(true);
        console.log('FRONT Pide a backend:', `${environment.apiUrl}/geocodificacion/buscar?q=${this.busqueda}`);  // mensajes para mostrar salidas en Framework e interoperabilidad

        this.http
            .get<ResultadoNominatim[]>(`${environment.apiUrl}/geocodificacion/buscar`, {
                params: { q: this.busqueda },
            })
            .subscribe({
                next: (res) => {
                    console.log('FRONT Recibe de backend (Buscar):', res);  // mensajes para mostrar salidas en Framework e interoperabilidad
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
        this.busqueda = r.display_name; // Sincroniza el input
        this.colocarPin(lat, lon);
        this.map?.setView([lat, lon], 16);
    }

    private colocarPin(lat: number, lon: number): void {
        this.lat = lat;
        this.lon = lon;

        if (this.marker) {
            this.marker.setLatLng([lat, lon]);
        } else {
            this.marker = L.marker([lat, lon], { draggable: true, icon: this.customIcon }).addTo(this.map!);

            this.marker.on('dragend', () => {
                const pos = this.marker!.getLatLng();
                this.lat = pos.lat;
                this.lon = pos.lng;
                this.buscarDireccionInversa(pos.lat, pos.lng); // Actualiza el nombre al soltar el pin
            });
        }
    }

    private buscarDireccionInversa(lat: number, lon: number): void {
        console.log('FRONT Pide a backend:', `${environment.apiUrl}/geocodificacion/inversa?lat=${lat}&lon=${lon}`);  // mensajes para mostrar salidas en Framework e interoperabilidad
        this.http
            .get<ResultadoNominatim>(`${environment.apiUrl}/geocodificacion/inversa`, {
                params: { lat: lat.toString(), lon: lon.toString() },
            })
            .subscribe({
                next: (res) => {
                    console.log('FRONT Recibe de backend (Inversa):', res);  // mensajes para mostrar salidas en Framework e interoperabilidad
                    this.direccionElegida.set(res.display_name);
                    this.busqueda = res.display_name; // Actualiza el input visualmente
                }
            });
    }

    protected confirmar(): void {
        if (!this.marker) return;
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
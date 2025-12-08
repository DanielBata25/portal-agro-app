import { Injectable, NgZone } from '@angular/core';
import {
    HubConnection,
    HubConnectionBuilder,
    HubConnectionState,
    LogLevel,
    HttpTransportType,
} from '@microsoft/signalr';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../../../environments/environment';
import { NotificationListItemDto } from 'src/app/shared/models/notificacions/notificacion.model';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

@Injectable({
    providedIn: 'root',
})
export class NotificationHubService {
    private hub?: HubConnection;

    private readonly status$ = new BehaviorSubject<ConnectionStatus>('disconnected');
    private readonly notifications$ = new Subject<NotificationListItemDto>();

    constructor(private readonly zone: NgZone) { }

    /** Estado actual de la conexión */
    connectionStatus(): Observable<ConnectionStatus> {
        return this.status$.asObservable();
    }

    /** Flujo de notificaciones entrantes */
    onNotification(): Observable<NotificationListItemDto> {
        return this.notifications$.asObservable();
    }

    /** Inicializa la conexión */
    async connect(): Promise<void> {
        if (!this.hub) {
            this.hub = this.buildConnection();
        }

        if (!this.hub) return;

        if (
            this.hub.state === HubConnectionState.Connected ||
            this.hub.state === HubConnectionState.Connecting
        ) {
            return;
        }

        this.zone.run(() => this.status$.next('connecting'));

        try {
            await this.hub.start();
            this.zone.run(() => this.status$.next('connected'));
            console.log('[NOTIFICATION-HUB] Conexión SignalR establecida');
        } catch (error: any) {
            const msg = (error?.message ?? '').toString();
            const is404 = msg.includes('404') || msg.includes('Status code \'404\'');
            // Evita spam de errores cuando el endpoint/hub no está disponible
            if (is404) {
                console.warn('[NOTIFICATION-HUB] Hub no disponible (404). Continuando sin tiempo real.');
            } else {
                console.error('Error al conectar con el hub de notificaciones', error);
            }
            this.zone.run(() => this.status$.next('disconnected'));
            return;
        }
    }

    /** Detiene la conexión */
    async disconnect(): Promise<void> {
        if (!this.hub) return;

        try {
            await this.hub.stop();
        } finally {
            this.zone.run(() => this.status$.next('disconnected'));
            this.hub = undefined;
        }
    }

    /** Construye la conexión */
    private buildConnection(): HubConnection {
        const hubUrl = this.buildHubUrl();

        const connection = new HubConnectionBuilder()
            .withUrl(hubUrl, {
                withCredentials: true,
                transport: HttpTransportType.WebSockets, // fuerza WebSockets, evita SSE/longPolling
            })
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Error) // reduce ruido en consola
            .build();

        connection.on('NewNotification', (notification: NotificationListItemDto) => {
            this.zone.run(() => this.notifications$.next(notification));
        });

        connection.onreconnecting(() => {
            this.zone.run(() => this.status$.next('reconnecting'));
        });

        connection.onreconnected(() => {
            this.zone.run(() => this.status$.next('connected'));
        });

        connection.onclose(() => {
            this.zone.run(() => this.status$.next('disconnected'));
        });

        return connection;
    }

    /** Construye la URL del hub al estilo ApiNative */
    private buildHubUrl(): string {
        const isNative = Capacitor.isNativePlatform();

        const explicit = (environment as any).hubUrl as string | undefined;
        if (explicit) {
            return explicit.replace(/\/+$/, '') + '/hubs/notifications';
        }

        const base = isNative
            ? environment.apiUrl
            : (environment.apiUrlBrowser || environment.apiUrl);

        // Reemplaza sufijo /api/v1 o /api/v1/ por /hubs/notifications
        const withoutApi = base.replace(/\/api\/v1\/?$/, '');
        return `${withoutApi.replace(/\/+$/, '')}/hubs/notifications`;
    }
}

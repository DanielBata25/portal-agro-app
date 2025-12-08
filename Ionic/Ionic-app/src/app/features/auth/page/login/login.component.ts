import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { take, switchMap, finalize } from 'rxjs/operators';

// Ionic standalone components & controllers
import {
  IonContent, IonGrid, IonRow, IonCol,
  IonCard, IonCardContent,
  IonItem, IonLabel, IonInput, IonNote,
  IonButton, IonIcon
} from '@ionic/angular/standalone';
import { LoadingController, ToastController, NavController, IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { eye, eyeOff } from 'ionicons/icons';

// Servicios propios
import { AuthService } from 'src/app/core/services/auth/auth.service';
import { AuthState } from 'src/app/core/services/auth/auth.state';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { PENDING_TWO_FACTOR_EMAIL_KEY } from 'src/app/core/constants/auth.constants';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    IonContent,
    IonCard, IonCardContent,
    IonItem, IonInput, IonNote,
    IonButton, IonIcon,
    IonicModule
],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private authState = inject(AuthState);
  private navCtrl = inject(NavController);
  private router = inject(Router);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private readonly pendingTwoFactorEmailKey = PENDING_TWO_FACTOR_EMAIL_KEY;
  
  loading = false;
  showPassword = false;
  showInlineSpinner = false;
  
  constructor() {
    // registra iconos usados (evita warnings en algunos entornos)
    addIcons({ eye, eyeOff });
  }

  formLogin: FormGroup = this.fb.group({
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(150),
        LoginComponent.notBlank,
      ],
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(6),
        LoginComponent.notBlank,
        LoginComponent.noSpaces,
      ],
    ],
  });

  getErrorMessage(field: 'email' | 'password'): string {
    const control = this.formLogin.get(field);
    if (control?.hasError('required')) {
      return field === 'email' ? 'El correo es requerido' : 'La contraseña es requerida';
    }
    if (control?.hasError('blank')) return field === 'email' ? 'El correo no puede estar en blanco.' : 'La contraseña no puede estar vacía.';
    if (control?.hasError('email')) return 'Ingrese un correo válido';
    if (control?.hasError('maxlength')) return 'El correo no debe superar 150 caracteres.';
    if (control?.hasError('minlength')) return 'La contraseña debe tener al menos 6 caracteres';
    if (control?.hasError('spaces')) return 'La contraseña no debe contener espacios.';
    return '';
  }

  private async toast(message: string, color: 'success' | 'danger' | 'medium' = 'medium') {
    const t = await this.toastCtrl.create({ message, duration: 1800, color, position: 'bottom' });
    await t.present();
  }

  async login() {
    if (this.loading) {
      console.warn('[LoginComponent] login ignored because loading is true');
      return;
    }

    if (this.formLogin.invalid) {
      this.formLogin.markAllAsTouched();
      const err = this.getFirstLoginError();
      if (err) {
        console.warn('[LoginComponent] validation error', err);
        await this.toast(err, 'danger');
      }
      return;
    }

    const payload = this.formLogin.value as { email: string; password: string };
    console.log('[LoginComponent] submit', payload);

    this.loading = true;
    this.showInlineSpinner = true;
    this.clearPendingTwoFactorEmail();
    console.log('[LoginComponent] inline spinner ON');

    try {
      const response = await firstValueFrom(this.auth.Login(payload));
      console.log('[LoginComponent] login response', response);

      if (response?.requiresTwoFactor) {
        this.cachePendingTwoFactorEmail(payload.email);
        this.showInlineSpinner = false;
        await this.toast(response?.message || 'Verificación requerida. Ingresa el código enviado a tu correo.', 'medium');
        await this.redirectToTwoFactor(payload.email);
        return;
      }

      const me = await firstValueFrom(this.authState.loadMe());
      console.log('[LoginComponent] loadMe success', me);

      this.showInlineSpinner = false;
      console.log('[LoginComponent] inline spinner OFF (success)');

      await this.navCtrl.navigateRoot('/home/inicio');
      await this.toast('Inicio de sesión exitoso.', 'success');
    } catch (err: any) {
      console.error('[LoginComponent] login error', err);
      const msg =
        err?.status === 401
          ? 'Credenciales inválidas o correo no verificado.'
          : err?.error?.message || 'No se pudo iniciar sesión.';
      await this.toast(msg, 'danger');
    } finally {
      this.loading = false;
      this.showInlineSpinner = false;
      console.log('[LoginComponent] inline spinner OFF (finally)');
    }
  }

  private cachePendingTwoFactorEmail(email: string) {
    try {
      sessionStorage.setItem(this.pendingTwoFactorEmailKey, email);
    } catch {
      /* ignore */
    }
  }

  private clearPendingTwoFactorEmail() {
    try {
      sessionStorage.removeItem(this.pendingTwoFactorEmailKey);
    } catch {
      /* ignore */
    }
  }

  private async redirectToTwoFactor(email: string) {
    console.log('[LoginComponent] redirectToTwoFactor start', email);
    try {
      this.loading = false;
      this.showInlineSpinner = false;
      const ok = await this.router.navigateByUrl('/auth/two-factor', { state: { email } });
      console.log('[LoginComponent] navigateByUrl /auth/two-factor result', ok);
      // En móviles el router puede no pintar de inmediato; fuerza carga si seguimos en login
      setTimeout(() => {
        if (location.pathname.endsWith('/login')) {
          console.log('[LoginComponent] hard redirect to /auth/two-factor');
          window.location.href = '/auth/two-factor';
        }
      }, 150);
    } catch (err) {
      console.error('[LoginComponent] navigation error to two-factor', err);
      await this.toast('No se pudo abrir el formulario de código. Intenta nuevamente.', 'danger');
    }
  }

  private getFirstLoginError(): string | null {
    const fields: Array<'email' | 'password'> = ['email', 'password'];
    for (const field of fields) {
      const control = this.formLogin.get(field);
      if (control?.invalid) {
        return this.getErrorMessage(field);
      }
    }
    return null;
  }

  private static notBlank(control: AbstractControl): ValidationErrors | null {
    const value = (control.value ?? '').toString();
    return value.trim().length ? null : { blank: true };
  }

  private static noSpaces(control: AbstractControl): ValidationErrors | null {
    const value = (control.value ?? '').toString();
    return value.includes(' ') ? { spaces: true } : null;
  }
}



import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { take, switchMap, finalize } from 'rxjs/operators';

// Ionic standalone components & controllers
import {
  IonContent,
  IonCard, IonCardContent,
  IonItem, IonInput, IonNote,
  IonButton, IonIcon
} from '@ionic/angular/standalone';
import { ToastController, NavController, IonicModule } from '@ionic/angular';

// Servicios propios
import { AuthService } from 'src/app/core/services/auth/auth.service';
import { AuthState } from 'src/app/core/services/auth/auth.state';
import { PENDING_TWO_FACTOR_EMAIL_KEY } from 'src/app/core/constants/auth.constants';
import { TwoFactorVerificationModel } from 'src/app/core/models/login.model';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-two-factor',
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    IonContent,
    IonCard, IonCardContent,
    IonItem, IonInput, IonNote,
    IonicModule
  ],
  templateUrl: './two-factor.component.html',
  styleUrls: ['./two-factor.component.scss'],
})
export class TwoFactorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private authState = inject(AuthState);
  private navCtrl = inject(NavController);
  private toastCtrl = inject(ToastController);

  email = '';
  loading = false;
  showInlineSpinner = false;

  formCode: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  ngOnInit(): void {
    const stateEmail = history.state?.email as string | undefined;
    const storedEmail = sessionStorage.getItem(PENDING_TWO_FACTOR_EMAIL_KEY);
    this.email = stateEmail || storedEmail || '';

    console.log('[TwoFactorComponent] ngOnInit', { stateEmail, storedEmail, email: this.email });

    if (!this.email) {
      console.warn('[TwoFactorComponent] No email found, redirecting to login');
      this.navCtrl.navigateRoot('/auth/login');
      return;
    }

    sessionStorage.setItem(PENDING_TWO_FACTOR_EMAIL_KEY, this.email);
  }

  get codeControl() {
    return this.formCode.get('code');
  }

  getErrorMessage(field: string): string {
    const control = this.formCode.get(field);
    if (control?.hasError('required')) {
      return 'El código es requerido';
    }
    if (control?.hasError('minlength') || control?.hasError('maxlength')) {
      return 'El código debe tener 6 caracteres';
    }
    return '';
  }

  private async toast(message: string, color: 'success' | 'danger' | 'medium' = 'medium') {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }

  async confirmCode() {
    if (this.formCode.invalid || this.loading || !this.email) {
      this.formCode.markAllAsTouched();
      return;
    }

    const payload: TwoFactorVerificationModel = {
      email: this.email,
      code: String(this.formCode.value.code ?? '').trim(),
    };

    this.loading = true;
    this.showInlineSpinner = true;

    try {
      await firstValueFrom(this.authService.ConfirmTwoFactorLogin(payload));
      const me = await firstValueFrom(this.authState.loadMe());

      this.showInlineSpinner = false;
      sessionStorage.removeItem(PENDING_TWO_FACTOR_EMAIL_KEY);

      if (!me) {
        await this.toast('No se pudo cargar tu sesión. Intenta nuevamente.', 'danger');
        return;
      }

      await this.toast('Código verificado. Inicio de sesión exitoso.', 'success');
      await this.navCtrl.navigateRoot('/home/inicio');
    } catch (err: any) {
      console.error('[TwoFactorComponent] verification error', err);
      const msg =
        err?.status === 401
          ? 'Código inválido o expirado.'
          : err?.error?.message || 'No se pudo verificar el código.';
      await this.toast(msg, 'danger');
    } finally {
      this.loading = false;
      this.showInlineSpinner = false;
    }
  }
}

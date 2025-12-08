// src/app/core/services/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { from, map, switchMap } from 'rxjs';
import { ConfirmEmailVerificationModel, RegisterUserModel, RequestEmailVerificationModel } from '../../models/register.user.model';
import { LoginAttemptResponse, LoginModel, TwoFactorVerificationModel, UserMeDto } from '../../models/login.model';
import { PersonUpdateModel, UserSelectModel } from '../../models/user.model';
import {
  ChangePasswordModel,
  RecoverPasswordConfirmModel,
  RecoverPasswordModel
} from '../../models/changePassword.model';
import { Preferences } from '@capacitor/preferences';
import { CapacitorCookies } from '@capacitor/core';
import { environment } from 'src/environments/environment';
import { ApiNative } from '../http/api.native';
import { HttpErrorResponse } from '@angular/common/http';

const API_ORIGIN = new URL(environment.apiUrl.replace(/\/+$/, '') + '/').origin;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = '/Auth/';


  Register(obj: RegisterUserModel) {
    return from(ApiNative.post<void>(`${this.base}Register`, obj));
  }

  RequestEmailVerification(obj: RequestEmailVerificationModel) {
    return from(ApiNative.post<void>(`${this.base}verify/send-code`, obj));
  }

  ConfirmEmailVerification(obj: ConfirmEmailVerificationModel) {
    return from(ApiNative.post<void>(`${this.base}verify/confirm`, obj));
  }

  Login(obj: LoginModel) {
    return from(ApiNative.post<LoginAttemptResponse>(`${this.base}login`, obj));
  }

  ConfirmTwoFactorLogin(obj: TwoFactorVerificationModel) {
    return from(ApiNative.post<void>(`${this.base}login/two-factor`, obj));
  }

  ChangePassword(obj: ChangePasswordModel) {
    return from(ApiNative.put<void>(`${this.base}ChangePassword`, obj));
  }

  GetMe() {
    return from(ApiNative.get<UserMeDto>(`${this.base}me`));
  }

  GetMeOptional() {
    return from(ApiNative.get<UserMeDto>(`${this.base}me`));
  }

  GetDataBasic() {
    return from(ApiNative.get<UserSelectModel>(`${this.base}DataBasic`));
  }

  LogOut() {
    return from(ApiNative.post<void>(`${this.base}logout`, {})).pipe(
      // Limpieza local de XSRF (no HttpOnly)
      switchMap(async () => {
        await Preferences.remove({ key: 'XSRF' });
        await CapacitorCookies.deleteCookie({ key: 'XSRF-TOKEN', url: API_ORIGIN }).catch(() => {});
      }),
      map(() => void 0)
    );
  }

  RefreshToken() {
    // Mantén el patrón: refresh y luego /me
    return from(ApiNative.refresh()).pipe(
      switchMap(() => from(ApiNative.get<UserMeDto>(`${this.base}me`)))
    );
  }

  UpdatePerson(obj: PersonUpdateModel) {
    // En tu back es [HttpPut("updatePerson")] (minúsculas)
    return from(ApiNative.put<void>(`${this.base}updatePerson`, obj));
  }

  UpdateTwoFactorPreference(enable: boolean) {
    return from(ApiNative.put<void>(`${this.base}two-factor`, { enable }));
  }

  RequestRecoverPassword(obj: RecoverPasswordModel) {
    return from(ApiNative.post<void>(`${this.base}recover/send-code`, obj));
  }

  ConfirmRecoverPassword(obj: RecoverPasswordConfirmModel) {
    return from(ApiNative.post<void>(`${this.base}recover/confirm`, obj));
  }
  
}

import { Routes } from "@angular/router";
import { LoginComponent } from "./page/login/login.component";
import { RecoverPasswordComponent } from "./page/recover-password/recover-password.component";
import { RegisterComponent } from "./page/register/register.component";
import { IntroComponent } from "./page/intro/intro.component";
import { TwoFactorComponent } from "./page/two-factor/two-factor.component";


export const AUTH_ROUTES: Routes=[
    { path: 'intro', component: IntroComponent},
    { path:'login', component: LoginComponent},
    { path: 'register', component: RegisterComponent},
    { path: 'recover-password', component:RecoverPasswordComponent},
    { path: 'two-factor', component: TwoFactorComponent},

    { path: '', pathMatch: 'full', redirectTo: 'intro' }
];

import { Component } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  googleAuthUrl = `${process.env['NG_APP_API_URL']}/auth/google`;
  currentYear = new Date().getFullYear();
}

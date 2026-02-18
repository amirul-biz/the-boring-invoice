import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Component({
  imports: [CommonModule, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private router = inject(Router);
  private location = inject(Location);
  private http = inject(HttpClient);
  private apiUrl = process.env['NG_APP_API_URL'];

  isLoginPage = true;

  ngOnInit(): void {
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
    ).subscribe((event) => {
      this.isLoginPage = (event as NavigationEnd).urlAfterRedirects === '/';
    });
  }

  onBack(): void {
    this.location.back();
  }

  onLogout(): void {
    this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
  }
}

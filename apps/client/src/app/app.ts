import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcome } from './nx-welcome';

@Component({
  imports: [NxWelcome, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit{
  ngOnInit(): void {
    console.error('Api endpoint is running on', process.env['NG_APP_API_URL'])
  }
  protected title = 'client';
}

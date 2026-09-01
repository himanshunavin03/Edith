import { Component } from '@angular/core';
import { Assistant } from './features/assistant/assistant';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Assistant],
  template: `<app-assistant />`,
})
export class App {}

import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from './../../../services/loader.service';

@Component({
  standalone: true,
  selector: 'app-spinner',
  imports: [CommonModule],
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.scss',
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class SpinnerComponent {
constructor(public loader: LoaderService) {}
}

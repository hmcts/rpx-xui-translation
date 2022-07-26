import { Component } from '@angular/core';
import { RpxLanguage, RpxTranslationService } from 'projects/rpx-translation/src/public-api';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  public get currentLang() {
    return this.langService.language;
  }

  constructor(private langService: RpxTranslationService) {}

  public toggleLanguage(lang: RpxLanguage) {
    this.langService.language = lang;
  }
}

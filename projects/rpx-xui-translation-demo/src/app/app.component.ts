import { Component } from '@angular/core';
import { RpxTranslationService } from '../../../rpx-xui-translation/src/lib/rpx-translation.service';
import { RpxLanguage } from '../../../rpx-xui-translation/src/lib/rpx-language.enum';

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

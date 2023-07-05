import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { RpxTranslationModule } from 'projects/rpx-xui-translation/src/public-api';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    RpxTranslationModule.forRoot({
      baseUrl: '',
      debounceTimeMs: 300,
      validity: {
        days: 1
      },
      testMode: true
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

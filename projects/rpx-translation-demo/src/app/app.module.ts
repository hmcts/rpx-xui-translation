import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { RpxTranslationModule } from 'projects/rpx-translation/src/public-api';

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
      }
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

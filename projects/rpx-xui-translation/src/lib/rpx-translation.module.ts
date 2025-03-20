import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { RpxTranslatePipe } from './rpx-translate.pipe';
import { RpxTranslationConfig } from './rpx-translation.config';
import { RpxTranslationService } from './rpx-translation.service';

@NgModule({ declarations: [RpxTranslatePipe],
  exports: [RpxTranslatePipe], imports: [], providers: [provideHttpClient(withInterceptorsFromDi())] })
export class RpxTranslationModule {
  public static forRoot(config: RpxTranslationConfig): ModuleWithProviders<RpxTranslationModule> {
    return {
      ngModule: RpxTranslationModule,
      providers: [
        {
          provide: RpxTranslationConfig, useValue: config
        },
        RpxTranslationService
      ]
    };
  }

  public static forChild(): ModuleWithProviders<RpxTranslationModule> {
    return {
      ngModule: RpxTranslationModule
    };
  }
}

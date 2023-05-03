import { Injectable } from "@angular/core";

export type ValidityDurationSpec = {
  years?: number;
  quarters?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
};

@Injectable({ providedIn: 'root' })
export class RpxTranslationConfig {
  validity: ValidityDurationSpec;
  baseUrl: string;

  debounceTimeMs = 300;
  testMode = false;
}

export interface TranslationModel {
  phrase: string;
  yesOrNoField: boolean,
  yes: string;
  no: string;
}

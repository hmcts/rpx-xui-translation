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

export class RpxTranslationConfig {
    validity: ValidityDurationSpec;
    baseUrl: string;

    debounceTimeMs = 300;
}

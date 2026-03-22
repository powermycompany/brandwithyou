declare module "country-telephone-data" {
  export type CountryTelephoneDataItem = {
    name?: string;
    dialCode?: string;
    iso2?: string;
    [key: string]: unknown;
  };

  export const allCountries: CountryTelephoneDataItem[];
}

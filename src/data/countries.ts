export interface Country { code: string; name: string }

// ISO 3166 country → ISO 4217 currency, from java.util.Currency (JDK 21; BG updated to EUR for 2026). AQ has none.
const CURRENCY: Record<string, string> = Object.fromEntries(
  ('AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AQ AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN BA:BAM ' +
    'BB:BBD BD:BDT BE:EUR BF:XOF BG:EUR BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BQ:USD BR:BRL BS:BSD BT:BTN BV:NOK ' +
    'BW:BWP BY:BYN BZ:BZD CA:CAD CC:AUD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP ' +
    'CV:CVE CW:XCG CX:AUD CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP EH:MAD ER:ERN ES:EUR ' +
    'ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD ' +
    'GN:GNF GP:EUR GQ:XAF GR:EUR GS:GBP GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HM:AUD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR ' +
    'IL:ILS IM:GBP IN:INR IO:USD IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KI:AUD KM:KMF ' +
    'KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD ' +
    'MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR ' +
    'MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NF:AUD NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NU:NZD ' +
    'NZ:NZD OM:OMR PA:PAB PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PN:NZD PR:USD PS:ILS PT:EUR PW:USD PY:PYG QA:QAR ' +
    'RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SJ:NOK SK:EUR SL:SLE SM:EUR ' +
    'SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:SVC SX:XCG SY:SYP SZ:SZL TC:USD TD:XAF TF:EUR TG:XOF TH:THB TJ:TJS TK:NZD TL:USD ' +
    'TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX UM:USD US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES ' +
    'VG:USD VI:USD VN:VND VU:VUV WF:XPF WS:WST YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:ZWG').split(' ').map((p) => p.split(':')),
)

export function countryName(code: string): string {
  try { return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) || code } catch { return code }
}

let all: Country[] | undefined
/** Every ISO country with its name in the device language, sorted by name. */
export const countries = (): Country[] =>
  (all ??= Object.keys(CURRENCY).map((code) => ({ code, name: countryName(code) })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)))

/** The country of the browser's language region (e.g. "en-SG" → "SG"), else US. No permission needed. */
export function detectCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase()
  } catch { /* no navigator or unknown tag */ }
  return 'US'
}

export const currencyOf = (country: string): string => CURRENCY[country] || 'USD'

let codes: string[] | undefined
export const currencyCodes = (): string[] =>
  (codes ??= (() => {
    try { return Intl.supportedValuesOf('currency') } catch { return [...new Set(Object.values(CURRENCY).filter(Boolean))].sort() }
  })())

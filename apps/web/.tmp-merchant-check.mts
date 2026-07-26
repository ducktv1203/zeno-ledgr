import { cleanMerchantLabel } from "./lib/merchant-label.ts";
const cases = [
  "9 Value Date 28 Jan HANARO TOOWONG PTY LTD TOOWONG AUS Card xx4198 Value Date 28 Jan HANARO TOOWONG PTY LTD TOOWONG AUS Card xx4198",
  "Value Date 28 Jan HANARO TOOWONG PTY LTD TOOWONG AUS Card xx4198",
  "NETFLIX.COM SYDNEY AU",
  "WOOLWORTHS 1234 BONDI",
  "SPOTIFY P1A2B3C4",
  "EFTPOS COLES 0456 SURRY HILLS AUS",
  "Value Date 03 Feb UBER *TRIP HELP.UBER.COM AUS Card xx4198",
  "Direct Debit 12 Mar TELSTRA CORP LTD ref 88ax991200",
];
for (const c of cases) console.log(JSON.stringify(c.slice(0,58)), "\n   ->", JSON.stringify(cleanMerchantLabel(c)), "\n");

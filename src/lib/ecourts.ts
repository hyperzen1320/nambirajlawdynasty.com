// eCourts CNR helper.
//
// The public eCourts portal (services.ecourts.gov.in) gates its
// "search by CNR" lookup behind a captcha, and — crucially — appending the
// CNR as a query param hits the portal's AJAX route, which answers with raw
// JSON (a `div_captcha` blob) instead of the search page. So we do the
// reliable thing: open the eCourts services app itself and copy the CNR to
// the clipboard (done in <CnrLink/>), so the advocate pastes it in one
// stroke and only has to solve the captcha.

export const ECOURTS_CNR_SEARCH =
  "https://services.ecourts.gov.in/ecourtindia_v6/";

// Returns the eCourts URL to open. The CNR rides along on the clipboard, not
// the URL — passing it as a param breaks the portal (see note above), so we
// intentionally ignore it here.
export function ecourtsCnrUrl(_cnr?: string): string {
  return ECOURTS_CNR_SEARCH;
}

export const iosGuideDismissedKey = "fermentstation.ios-guide-dismissed";

export function shouldShowIosInstallGuide(input: {
  native: boolean;
  vendor: string;
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  displayModeStandalone: boolean;
  dismissed: boolean;
}): boolean {
  const ios = /iPhone|iPad|iPod/i.test(input.userAgent) ||
    (/Macintosh/i.test(input.userAgent) && input.maxTouchPoints > 1);
  return !input.native && /Apple/i.test(input.vendor) && ios &&
    !input.standalone && !input.displayModeStandalone && !input.dismissed;
}

/**
 * CAPTCHA verifier abstraction.
 *
 * The endpoint pipeline (src/app/api/auth/session/route.ts) calls
 * `captcha.verify(token, ip)` as a no-op today so the hook is wired and
 * tested. To turn CAPTCHA on, swap `captcha` for a real implementation
 * (TurnstileVerifier or ReCaptchaVerifier) — no other code changes
 * required.
 *
 * Why a no-op default: the public login form is currently behind
 * honeypot + per-IP rate-limit + per-email lockout. Adding CAPTCHA is
 * the next layer if those prove insufficient.
 */

export interface CaptchaVerifyResult {
  success: boolean;
  reason?: string;
}

export interface CaptchaVerifier {
  /**
   * @param token  Token issued by the client widget. `undefined` means
   *               the client didn't include one (allowed under the no-op).
   * @param ip     Caller IP — pass-through; some providers (Turnstile)
   *               will cross-check against the token's bound IP.
   */
  verify(token: string | undefined, ip: string): Promise<CaptchaVerifyResult>;
}

export const noopCaptcha: CaptchaVerifier = {
  async verify(): Promise<CaptchaVerifyResult> {
    return { success: true };
  },
};

// TODO: implement TurnstileVerifier or ReCaptchaVerifier when a provider
// is chosen, and export it as `captcha` here. Until then this remains a
// no-op so the endpoint pipeline keeps the verification step wired.
export const captcha: CaptchaVerifier = noopCaptcha;

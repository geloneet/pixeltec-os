/**
 * CAPTCHA verifier abstraction.
 *
 * `captcha.verify(token, ip)` es un no-op hoy — el hook queda cableado y
 * probado, listo para activarse. Para prender CAPTCHA, reemplazar `captcha`
 * por una implementación real (TurnstileVerifier o ReCaptchaVerifier); no
 * requiere otros cambios de código. (Nota: no está conectado desde ningún
 * endpoint todavía — el login del equipo interno migró a NextAuth en
 * src/lib/auth/config.ts, que sí preserva el rate-limit/lockout de abajo.)
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

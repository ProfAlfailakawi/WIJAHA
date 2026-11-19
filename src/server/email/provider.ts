import type { ValidatedServerEnv } from '../config/env.ts';

export interface TransactionalEmailMessage {
  to: string;
  subject: string;
  textBody: string;
}

export interface EmailProvider {
  readonly name: 'console' | 'smtp';
  sendMagicCodeEmail(params: { to: string; code: string; locale?: 'ar' | 'en' }): Promise<void>;
}

class ConsoleDevEmailProvider implements EmailProvider {
  readonly name = 'console' as const;

  async sendMagicCodeEmail(params: { to: string; code: string }): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Console email provider cannot run in production.');
    }
    // Allowed strictly in development with EMAIL_PROVIDER=console (Requirement G4 / A2)
    process.stdout.write(
      `[WIJAHA Dev Console Email] Magic sign-in code for ${params.to}: ${params.code}\n`,
    );
  }
}

class HttpTransactionalSmtpProvider implements EmailProvider {
  readonly name = 'smtp' as const;
  private readonly endpoint?: string;
  private readonly apiKey?: string;
  private readonly fromAddress: string;

  constructor(env: ValidatedServerEnv) {
    this.endpoint = env.SMTP_WEBHOOK_URL;
    this.apiKey = env.SMTP_API_KEY;
    this.fromAddress = env.SMTP_FROM;
  }

  async sendMagicCodeEmail(params: {
    to: string;
    code: string;
    locale?: 'ar' | 'en';
  }): Promise<void> {
    if (!this.endpoint) {
      // Never log raw code or recipient email in non-console provider
      return;
    }
    const isAr = params.locale !== 'en';
    const payload: TransactionalEmailMessage & { from: string } = {
      from: this.fromAddress,
      to: params.to,
      subject: isAr ? 'رمز الدخول إلى منصة وجاهة' : 'Your WIJAHA Sign-In Code',
      textBody: isAr
        ? `رمز الدخول الخاص بك في وجاهة هو: ${params.code}\nصالح لمدة 15 دقيقة وللاستخدام مرة واحدة فقط.`
        : `Your WIJAHA one-time sign-in code is: ${params.code}\nValid for 15 minutes and single use only.`,
    };

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // Neutral handling: do not leak provider transport errors or OTP codes
    }
  }
}

export function createEmailProvider(env: ValidatedServerEnv): EmailProvider {
  if (env.EMAIL_PROVIDER === 'console') {
    if (env.isProduction) {
      throw new Error('EMAIL_PROVIDER=console is forbidden in production.');
    }
    return new ConsoleDevEmailProvider();
  }
  return new HttpTransactionalSmtpProvider(env);
}

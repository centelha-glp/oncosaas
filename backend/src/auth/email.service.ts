import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  /** Retorna true se SMTP_HOST estiver configurado. */
  isConfigured(): boolean {
    return !!this.configService.get<string>('SMTP_HOST');
  }

  /**
   * Envia o e-mail de redefinição de senha.
   * Retorna true se enviado com sucesso, false caso SMTP não esteja configurado.
   * Lança exceção em caso de falha de envio (SMTP configurado mas com erro).
   */
  async sendPasswordReset(
    toEmail: string,
    resetLink: string
  ): Promise<boolean> {
    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('SMTP_PORT') ?? 587,
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') ??
      'noreply@onconav.com.br';

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Redefinição de senha — ONCONAV',
      text: [
        'Você solicitou a redefinição de sua senha no ONCONAV.',
        '',
        'Clique no link abaixo para criar uma nova senha (válido por 1 hora):',
        resetLink,
        '',
        'Se você não solicitou esta redefinição, ignore este e-mail.',
        'Sua senha permanece a mesma.',
      ].join('\n'),
      html: `
        <p>Você solicitou a redefinição de sua senha no <strong>ONCONAV</strong>.</p>
        <p>Clique no botão abaixo para criar uma nova senha (válido por 1 hora):</p>
        <p>
          <a href="${resetLink}" style="
            display:inline-block;padding:12px 24px;background:#1a56db;color:#fff;
            text-decoration:none;border-radius:6px;font-weight:600;
          ">Redefinir senha</a>
        </p>
        <p style="color:#666;font-size:0.85em">
          Se o botão não funcionar, copie e cole este link no navegador:<br/>
          <code>${resetLink}</code>
        </p>
        <p style="color:#999;font-size:0.8em">
          Se você não solicitou esta redefinição, ignore este e-mail.
          Sua senha permanece a mesma.
        </p>
      `,
    });

    this.logger.log(`Password reset email sent to: ${toEmail}`);
    return true;
  }
}

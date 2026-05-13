import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WhatsAppChannel } from './whatsapp.channel';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  whatsAppConnection: { findFirst: jest.fn() },
};

/**
 * Builds a valid HMAC-SHA256 signature string for the given payload and secret.
 */
function buildSignature(payload: Buffer, secret: string): string {
  return (
    'sha256=' +
    crypto.createHmac('sha256', secret).update(payload).digest('hex')
  );
}

describe('WhatsAppChannel.validateWebhookSignature', () => {
  let channel: WhatsAppChannel;
  let configGet: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    configGet = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppChannel,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    channel = module.get<WhatsAppChannel>(WhatsAppChannel);
  });

  describe('quando META_APP_SECRET não está configurado', () => {
    it('deve retornar true (skip) em NODE_ENV=development', () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'META_APP_SECRET') {
          return undefined;
        }
        if (key === 'NODE_ENV') {
          return 'development';
        }
        return undefined;
      });

      const result = channel.validateWebhookSignature(
        Buffer.from('qualquer-payload'),
        'sha256=qualquer-assinatura'
      );

      expect(result).toBe(true);
    });

    it('deve retornar false em NODE_ENV=staging', () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'META_APP_SECRET') {
          return undefined;
        }
        if (key === 'NODE_ENV') {
          return 'staging';
        }
        return undefined;
      });

      const result = channel.validateWebhookSignature(
        Buffer.from('qualquer-payload'),
        'sha256=qualquer-assinatura'
      );

      expect(result).toBe(false);
    });

    it('deve retornar false em NODE_ENV=production', () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'META_APP_SECRET') {
          return undefined;
        }
        if (key === 'NODE_ENV') {
          return 'production';
        }
        return undefined;
      });

      const result = channel.validateWebhookSignature(
        Buffer.from('qualquer-payload'),
        'sha256=qualquer-assinatura'
      );

      expect(result).toBe(false);
    });
  });

  describe('quando META_APP_SECRET está configurado', () => {
    const APP_SECRET = 'meu-app-secret-para-testes';
    const payload = Buffer.from('{"entry":[{"changes":[]}]}');

    beforeEach(() => {
      configGet.mockImplementation((key: string) => {
        if (key === 'META_APP_SECRET') {
          return APP_SECRET;
        }
        if (key === 'NODE_ENV') {
          return 'production';
        }
        return undefined;
      });
    });

    it('deve retornar true para assinatura HMAC-SHA256 correta', () => {
      const validSignature = buildSignature(payload, APP_SECRET);

      const result = channel.validateWebhookSignature(payload, validSignature);

      expect(result).toBe(true);
    });

    it('deve retornar false para assinatura incorreta', () => {
      const wrongSignature = buildSignature(payload, 'chave-errada');

      const result = channel.validateWebhookSignature(payload, wrongSignature);

      expect(result).toBe(false);
    });

    it('deve retornar false para assinatura com payload adulterado', () => {
      const originalPayload = Buffer.from('payload-original');
      const tamperedPayload = Buffer.from('payload-adulterado');
      const signatureForOriginal = buildSignature(originalPayload, APP_SECRET);

      // Usa o payload adulterado mas a assinatura do original
      const result = channel.validateWebhookSignature(
        tamperedPayload,
        signatureForOriginal
      );

      expect(result).toBe(false);
    });
  });
});

describe('WhatsAppChannel.parseWebhookPayload', () => {
  let channel: WhatsAppChannel;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn().mockReturnValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppChannel,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();
    channel = module.get<WhatsAppChannel>(WhatsAppChannel);
  });

  it('propaga metadata.phone_number_id para cada mensagem', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'PNID-999' },
                messages: [
                  {
                    from: '5511999999999',
                    id: 'wamid.1',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: 'Oi' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const parsed = channel.parseWebhookPayload(body);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].whatsappPhoneNumberId).toBe('PNID-999');
    expect(parsed[0].phone).toBe('5511999999999');
    expect(parsed[0].content).toBe('Oi');
  });

  it('omite whatsappPhoneNumberId quando metadata ausente', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '5511888888888',
                    id: 'wamid.2',
                    timestamp: '1700000001',
                    type: 'text',
                    text: { body: 'x' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const parsed = channel.parseWebhookPayload(body);
    expect(parsed[0].whatsappPhoneNumberId).toBeUndefined();
  });
});

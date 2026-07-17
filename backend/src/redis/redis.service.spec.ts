import { RedisService } from './redis.service';

describe('RedisService', () => {
  it('executa RPUSH e EXPIRE NX em script atômico com rollback', async () => {
    const client = {
      eval: jest.fn().mockResolvedValue(1),
    };
    const service = Object.create(RedisService.prototype) as RedisService;
    Object.defineProperty(service, 'client', { value: client });

    await expect(
      service.rpushWithTtl('buffer:key', 'file-json', 600)
    ).resolves.toBe(1);

    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.pcall('EXPIRE'"),
      1,
      'buffer:key',
      'file-json',
      '600'
    );
    expect(client.eval.mock.calls[0][0]).toContain("redis.call('RPOP'");
  });

  it('propaga falha do script em vez de reportar upload bem-sucedido', async () => {
    const expireError = new Error('ERR expire failed');
    const client = {
      eval: jest.fn().mockRejectedValue(expireError),
    };
    const service = Object.create(RedisService.prototype) as RedisService;
    Object.defineProperty(service, 'client', {
      value: client,
    });

    await expect(
      service.rpushWithTtl('buffer:key', 'file-json', 600)
    ).rejects.toBe(expireError);
  });
});

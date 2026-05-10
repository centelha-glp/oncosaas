import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  const validBase = (): RegisterDto =>
    Object.assign(new RegisterDto(), {
      email: 'new@example.com',
      password: 'secret12',
      name: 'User',
      inviteToken: 'invite-token-value',
    });

  it('rejeita crmUf que não é sigla de UF válida', async () => {
    const dto = validBase();
    dto.crmUf = 'XX';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'crmUf')).toBe(true);
  });

  it('rejeita corenUf que não é sigla de UF válida', async () => {
    const dto = validBase();
    dto.corenUf = 'ZZ';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'corenUf')).toBe(true);
  });

  it('aceita crmUf e corenUf com siglas válidas', async () => {
    const dto = validBase();
    dto.crmUf = 'SP';
    dto.corenUf = 'RJ';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('aceita payload sem crmUf/corenUf', async () => {
    const errors = await validate(validBase());
    expect(errors).toHaveLength(0);
  });
});

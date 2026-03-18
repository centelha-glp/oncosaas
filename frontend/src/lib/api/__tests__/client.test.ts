import { describe, it, expect } from 'vitest';
import { ApiClientError } from '../client';

describe('ApiClientError', () => {
  it('extends Error', () => {
    const err = new ApiClientError('Não autorizado', 401, 'Unauthorized');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiClientError);
  });

  it('sets name to ApiClientError', () => {
    const err = new ApiClientError('msg', 500, 'Server Error');
    expect(err.name).toBe('ApiClientError');
  });

  it('stores statusCode and error fields', () => {
    const err = new ApiClientError('Recurso não encontrado', 404, 'Not Found');
    expect(err.message).toBe('Recurso não encontrado');
    expect(err.statusCode).toBe(404);
    expect(err.error).toBe('Not Found');
  });

  it('is catchable as a plain Error', () => {
    const fn = () => {
      throw new ApiClientError('erro', 400, 'Bad Request');
    };
    expect(fn).toThrow(Error);
    expect(fn).toThrow('erro');
  });

  it('allows instanceof narrowing', () => {
    try {
      throw new ApiClientError('falha', 503, 'Service Unavailable');
    } catch (e) {
      if (e instanceof ApiClientError) {
        expect(e.statusCode).toBe(503);
      } else {
        throw new Error('Should have been ApiClientError');
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { validateRequestBody, validateRequestArray } from '../apiUtils';

interface TestBody {
  name: string;
  age: number;
}

describe('validateRequestBody', () => {
  it('returns invalid when required fields are missing', () => {
    const result = validateRequestBody<TestBody>({ name: 'Alice' }, ['name', 'age']);
    expect(result).toEqual({
      valid: false,
      error: 'Missing required field: age',
      status: 400,
    });
  });

  it('returns valid when all fields are present', () => {
    const result = validateRequestBody<TestBody>({ name: 'Alice', age: 30 }, ['name', 'age']);
    expect(result).toEqual({ valid: true });
  });
});

describe('validateRequestArray', () => {
  it('rejects non-arrays', () => {
    const result = validateRequestArray('not array');
    expect(result).toEqual({
      valid: false,
      error: 'Missing or invalid "entries" array.',
      status: 400,
    });
  });

  it('rejects empty arrays', () => {
    const result = validateRequestArray([]);
    expect(result).toEqual({
      valid: false,
      error: '"entries" array cannot be empty.',
      status: 400,
    });
  });

  it('returns valid for non-empty arrays', () => {
    const result = validateRequestArray([1, 2, 3]);
    expect(result).toEqual({ valid: true });
  });
});

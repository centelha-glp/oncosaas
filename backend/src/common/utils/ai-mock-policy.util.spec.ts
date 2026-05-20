import { isAiMockResponsesAllowed } from './ai-mock-policy.util';

describe('isAiMockResponsesAllowed', () => {
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.AI_ALLOW_MOCK_RESPONSES;

  afterEach(() => {
    process.env.NODE_ENV = prevNode;
    if (prevFlag === undefined) {
      delete process.env.AI_ALLOW_MOCK_RESPONSES;
    } else {
      process.env.AI_ALLOW_MOCK_RESPONSES = prevFlag;
    }
  });

  it('allows mock in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AI_ALLOW_MOCK_RESPONSES;
    expect(isAiMockResponsesAllowed()).toBe(true);
  });

  it('blocks mock in production without flag', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AI_ALLOW_MOCK_RESPONSES;
    expect(isAiMockResponsesAllowed()).toBe(false);
  });

  it('allows mock in production with explicit flag', () => {
    process.env.NODE_ENV = 'production';
    process.env.AI_ALLOW_MOCK_RESPONSES = 'true';
    expect(isAiMockResponsesAllowed()).toBe(true);
  });
});

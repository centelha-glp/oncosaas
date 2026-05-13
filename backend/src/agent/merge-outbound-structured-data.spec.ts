import { mergeOutboundStructuredData } from './merge-outbound-structured-data';

describe('mergeOutboundStructuredData', () => {
  it('inclui pipelineTrace quando é objeto', () => {
    const trace = { pipeline_path: 'main', spans: [] };
    const out = mergeOutboundStructuredData({}, {}, trace);
    expect(out.pipelineTrace).toEqual(trace);
  });

  it('omite pipelineTrace quando ausente ou não-objeto', () => {
    expect(mergeOutboundStructuredData({}, {}, undefined)).toEqual({});
    expect(mergeOutboundStructuredData({}, {}, 'x')).toEqual({});
  });

  it('preserva baseStructured e symptoms', () => {
    const out = mergeOutboundStructuredData(
      { foo: 1 },
      { dor: 8 },
      { trace_id: 'abc' }
    );
    expect(out).toMatchObject({
      foo: 1,
      symptoms: { dor: 8 },
      pipelineTrace: { trace_id: 'abc' },
    });
  });
});

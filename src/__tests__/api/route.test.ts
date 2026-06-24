/**
 * @jest-environment node
 */
import { GET } from '@/app/api/aircraft/route';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('Aircraft API Route', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns data on successful API call', async () => {
    const mockData = { states: [['abc123']], time: 1234567890 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const request = new Request('http://localhost:3000/api/aircraft');
    const response = await GET(request);
    const data = await response.json();

    expect(data.states).toHaveLength(1);
    expect(data.time).toBe(1234567890);
  });

  it('returns empty states on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const request = new Request('http://localhost:3000/api/aircraft');
    const response = await GET(request);
    const data = await response.json();

    expect(data.states).toHaveLength(0);
    expect(data.time).toBeGreaterThan(0);
  });

  it('returns empty states on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const request = new Request('http://localhost:3000/api/aircraft');
    const response = await GET(request);
    const data = await response.json();

    expect(data.states).toHaveLength(0);
  });

  it('passes bounds parameter to API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ states: [], time: 0 }),
    });

    const request = new Request('http://localhost:3000/api/aircraft?bounds=40,-80,50,-70');
    await GET(request);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('lamin=40'),
      expect.any(Object)
    );
  });

  it('calls OpenSky API without bounds when none provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ states: [], time: 0 }),
    });

    const request = new Request('http://localhost:3000/api/aircraft');
    await GET(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://opensky-network.org/api/states/all',
      expect.any(Object)
    );
  });
});

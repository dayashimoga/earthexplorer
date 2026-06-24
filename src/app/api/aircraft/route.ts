import { NextResponse } from 'next/server';

/**
 * Aircraft data API proxy
 * Proxies to OpenSky Network REST API (free, no auth required)
 * Falls back to empty array on error
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bounds = searchParams.get('bounds'); // lamin,lomin,lamax,lomax

  try {
    let url = 'https://opensky-network.org/api/states/all';
    if (bounds) {
      const [lamin, lomin, lamax, lomax] = bounds.split(',');
      url += `?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    }

    const response = await fetch(url, {
      next: { revalidate: 15 }, // Cache for 15 seconds
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return NextResponse.json({ states: [], time: Date.now() / 1000 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // Return empty on error - the app uses simulated data as primary
    return NextResponse.json({ states: [], time: Date.now() / 1000 });
  }
}
